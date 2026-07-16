import { execFile } from "node:child_process";
import { mkdir, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import type { Environment, Session, ToolCall } from "@snowmountain/contracts";
import { searchWeb } from "./web-search.js";

const execFileAsync = promisify(execFile);
const validSessionId = /^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/;

function assertSessionId(sessionId: string): void {
  if (!validSessionId.test(sessionId)) throw new Error("Invalid session ID");
}

export interface SandboxOptions {
  dataDir: string;
  driver: "local" | "docker" | "remote";
  image: string;
  workerUrl?: string | undefined;
  workerToken?: string | undefined;
  hostDataDir?: string | undefined;
}

export class Sandbox {
  constructor(private readonly options: SandboxOptions) {}

  async provision(sessionId: string): Promise<string> {
    assertSessionId(sessionId);
    if (this.options.driver === "remote") {
      await this.remote("/v1/provision", "POST", { sessionId });
      return "/workspace";
    }
    const workspace = resolve(this.options.dataDir, "workspaces", sessionId);
    await mkdir(workspace, { recursive: true });
    return workspace;
  }

  async workspacePath(sessionId: string, requested: string): Promise<string> {
    const workspace = await this.provision(sessionId);
    const relativePath = requested === "/workspace"
      ? ""
      : requested.startsWith("/workspace/")
        ? requested.slice("/workspace/".length)
        : requested;
    const target = resolve(workspace, relativePath);
    if (target !== workspace && !target.startsWith(`${workspace}${sep}`)) {
      throw new Error("Path escapes the session workspace");
    }

    const existing = existsSync(target) ? target : dirname(target);
    if (existsSync(existing)) {
      const resolvedExisting = await realpath(existing);
      const resolvedWorkspace = await realpath(workspace);
      if (resolvedExisting !== resolvedWorkspace && !resolvedExisting.startsWith(`${resolvedWorkspace}${sep}`)) {
        throw new Error("Symlink escapes the session workspace");
      }
    }
    return target;
  }

  async execute(call: ToolCall, session: Session, environment: Environment): Promise<unknown> {
    if (this.options.driver === "remote") return this.remote("/v1/execute", "POST", { call, session, environment });
    switch (call.name) {
      case "bash":
        return this.runCommand(session, environment, String(call.input.command ?? ""));
      case "read": {
        const filePath = await this.workspacePath(session.id, String(call.input.file_path ?? ""));
        return { content: await readFile(filePath, "utf8"), file_path: this.publicPath(session.id, filePath) };
      }
      case "write": {
        const filePath = await this.workspacePath(session.id, String(call.input.file_path ?? ""));
        const content = String(call.input.content ?? "");
        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, content, "utf8");
        return { bytes_written: Buffer.byteLength(content), file_path: this.publicPath(session.id, filePath) };
      }
      case "edit": {
        const filePath = await this.workspacePath(session.id, String(call.input.file_path ?? ""));
        const before = String(call.input.old_string ?? "");
        const after = String(call.input.new_string ?? "");
        const source = await readFile(filePath, "utf8");
        if (!source.includes(before)) throw new Error("edit old_string was not found");
        await writeFile(filePath, source.replace(before, after), "utf8");
        return { replacements: 1, file_path: this.publicPath(session.id, filePath) };
      }
      case "glob":
        return this.runCommand(session, environment, "find . -type f -maxdepth 6 | sort | head -200");
      case "grep": {
        const query = String(call.input.pattern ?? "").replaceAll("'", "'\\''");
        return this.runCommand(session, environment, `grep -RIn -- '${query}' . | head -200`);
      }
      case "web_fetch": {
        const response = await fetch(String(call.input.url), { signal: AbortSignal.timeout(15_000) });
        const text = await response.text();
        return { status: response.status, content: text.slice(0, 50_000) };
      }
      case "web_search":
        return searchWeb(String(call.input.query ?? ""), {
          ...(typeof call.input.max_results === "number" ? { maxResults: call.input.max_results } : {})
        });
      default:
        throw new Error(`Unsupported tool: ${String(call.name)}`);
    }
  }

  private publicPath(sessionId: string, path: string): string {
    const workspace = resolve(this.options.dataDir, "workspaces", sessionId);
    const suffix = relative(workspace, path);
    return suffix ? `/workspace/${suffix}` : "/workspace";
  }

  private async runCommand(session: Session, environment: Environment, command: string): Promise<unknown> {
    const workspace = await this.provision(session.id);
    const resource = session.resourceConfig ?? { cpu: 1, memoryMiB: 512, maxRuntimeSeconds: 3600, networkMode: "full" as const };
    const environmentArgs = environment.variables.filter((variable) => !variable.secret).flatMap((variable) => ["-e", `${variable.key}=${variable.value}`]);
    if (this.options.driver === "docker") {
      const runtimeMs = Math.min(Math.max(resource.maxRuntimeSeconds, 1), 3600) * 1000;
      const mountWorkspace = this.options.hostDataDir
        ? resolve(this.options.hostDataDir, "workspaces", session.id)
        : workspace;
      const networkArgs = resource.networkMode === "deny" ? ["--network", "none"] : [];
      const { stdout, stderr } = await execFileAsync("docker", [
        "run", "--rm", ...networkArgs, "--read-only",
        "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",
        "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
        "--pids-limit", "128", "--memory", `${resource.memoryMiB}m`, "--cpus", String(resource.cpu),
        ...environmentArgs,
        "-v", `${mountWorkspace}:/workspace:rw`, "-w", "/workspace",
        this.options.image, "sh", "-lc", command
      ], { timeout: runtimeMs, maxBuffer: 2_000_000 });
      return { stdout, stderr, exit_code: 0, driver: "docker" };
    }

    const { stdout, stderr } = await execFileAsync("/bin/sh", ["-lc", command], {
      cwd: workspace,
      timeout: Math.min(Math.max(resource.maxRuntimeSeconds, 1), 3600) * 1000,
      maxBuffer: 2_000_000,
      env: {
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        HOME: workspace,
        ...Object.fromEntries(environment.variables.filter((variable) => !variable.secret).map((variable) => [variable.key, variable.value]))
      }
    });
    const canonicalWorkspace = await realpath(workspace);
    const normalizePath = (value: string) => value
      .replaceAll(canonicalWorkspace, "/workspace")
      .replaceAll(workspace, "/workspace");
    return {
      stdout: normalizePath(stdout),
      stderr: normalizePath(stderr),
      exit_code: 0,
      driver: "local-development"
    };
  }

  async inspect(sessionId: string): Promise<{ path: string; exists: boolean; bytes: number }> {
    if (this.options.driver === "remote") return this.remote("/v1/inspect", "POST", { sessionId }) as Promise<{ path: string; exists: boolean; bytes: number }>;
    const workspace = await this.provision(sessionId);
    const info = await stat(workspace);
    return { path: "/workspace", exists: info.isDirectory(), bytes: info.size };
  }

  async destroy(sessionId: string): Promise<void> {
    assertSessionId(sessionId);
    if (this.options.driver === "remote") {
      await this.remote("/v1/session", "DELETE", { sessionId });
      return;
    }
    await rm(resolve(this.options.dataDir, "workspaces", sessionId), { recursive: true, force: true });
  }

  private async remote(path: string, method: string, body: unknown): Promise<unknown> {
    if (!this.options.workerUrl || !this.options.workerToken) throw new Error("Remote Sandbox Worker is not configured");
    const response = await fetch(`${this.options.workerUrl.replace(/\/$/, "")}${path}`, {
      method,
      headers: { "content-type": "application/json", authorization: `Bearer ${this.options.workerToken}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(path === "/v1/execute" ? 3_610_000 : 30_000)
    });
    if (!response.ok) throw new Error(`Sandbox Worker returned ${response.status}: ${(await response.text()).slice(0, 500)}`);
    return response.json();
  }
}
