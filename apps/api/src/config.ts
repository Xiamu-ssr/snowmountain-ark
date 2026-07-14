import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const envPath = process.env.DATA_DIR ?? "../../data";
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export const config = {
  host: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 4310),
  dataDir: resolve(process.cwd(), envPath),
  sandboxDriver: process.env.SANDBOX_DRIVER === "remote" ? "remote" : process.env.SANDBOX_DRIVER === "docker" ? "docker" : "local",
  sandboxImage: process.env.SANDBOX_IMAGE ?? "alpine:3.20",
  sandboxWorkerUrl: process.env.SANDBOX_WORKER_URL ?? "http://127.0.0.1:4312",
  sandboxWorkerToken: process.env.SANDBOX_WORKER_TOKEN ?? "",
  sandboxHostDataDir: process.env.SANDBOX_HOST_DATA_DIR,
  marketIndexUrl: process.env.MARKET_INDEX_URL ?? "https://xiamu-ssr.github.io/snowmountain-market/api/catalog.json",
  marketPublicUrl: process.env.MARKET_PUBLIC_URL ?? "https://xiamu-ssr.github.io/snowmountain-market/",
  specBundlePath: process.env.SPEC_BUNDLE_PATH
    ? resolve(process.cwd(), process.env.SPEC_BUNDLE_PATH)
    : resolve(repositoryRoot, "spec/generated/bundle.json"),
  adminUsername: process.env.ADMIN_USERNAME ?? "admin",
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  authCookieSecure: process.env.AUTH_COOKIE_SECURE === "true",
  authCookiePath: process.env.AUTH_COOKIE_PATH ?? "/",
  authSessionHours: Math.max(1, Number(process.env.AUTH_SESSION_HOURS ?? 24))
} as const;
