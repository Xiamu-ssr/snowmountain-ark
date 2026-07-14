import { createHash, timingSafeEqual } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import type { Environment, Session, ToolCall } from "@snowmountain/contracts";
import { Sandbox } from "../../api/src/sandbox.js";

export interface WorkerOptions {
  token: string;
  dataDir: string;
  hostDataDir?: string | undefined;
  image: string;
  driver?: "local" | "docker";
  logger?: boolean;
}

function authorized(header: string | undefined, expected: string): boolean {
  if (!header?.startsWith("Bearer ") || !expected) return false;
  const left = createHash("sha256").update(header.slice(7)).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

const sessionId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/);
const sessionIdInput = z.object({ sessionId });

export async function buildWorker(options: WorkerOptions): Promise<FastifyInstance> {
  if (!options.token) throw new Error("SANDBOX_WORKER_TOKEN is required");
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 2_000_000 });
  const sandbox = new Sandbox({
    dataDir: options.dataDir,
    driver: options.driver ?? "docker",
    image: options.image,
    hostDataDir: options.hostDataDir
  });
  app.addHook("onRequest", async (request, reply) => {
    if (request.url === "/health") return;
    if (!authorized(request.headers.authorization, options.token)) return reply.code(401).send({ error: "invalid_worker_token" });
  });
  app.get("/health", async () => ({ status: "ok", role: "sandbox-worker", driver: options.driver ?? "docker" }));
  app.post("/v1/provision", async (request, reply) => {
    const parsed = sessionIdInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_session" });
    await sandbox.provision(parsed.data.sessionId);
    return { path: "/workspace" };
  });
  app.post("/v1/inspect", async (request, reply) => {
    const parsed = sessionIdInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_session" });
    return sandbox.inspect(parsed.data.sessionId);
  });
  app.delete("/v1/session", async (request, reply) => {
    const parsed = sessionIdInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_session" });
    await sandbox.destroy(parsed.data.sessionId);
    return { deleted: true };
  });
  app.post("/v1/execute", async (request, reply) => {
    const parsed = z.object({
      call: z.object({ id: z.string(), name: z.string(), input: z.record(z.unknown()) }),
      session: z.object({ id: sessionId }).passthrough(),
      environment: z.object({ id: z.string() }).passthrough()
    }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_execution", details: parsed.error.flatten() });
    return sandbox.execute(parsed.data.call as ToolCall, parsed.data.session as unknown as Session, parsed.data.environment as unknown as Environment);
  });
  return app;
}
