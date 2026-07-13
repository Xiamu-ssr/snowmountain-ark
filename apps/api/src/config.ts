import { resolve } from "node:path";

const envPath = process.env.DATA_DIR ?? "../../data";

export const config = {
  host: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 4310),
  dataDir: resolve(process.cwd(), envPath),
  sandboxDriver: process.env.SANDBOX_DRIVER === "docker" ? "docker" : "local",
  sandboxImage: process.env.SANDBOX_IMAGE ?? "alpine:3.20",
  marketIndexUrl: process.env.MARKET_INDEX_URL ?? "https://xiamu-ssr.github.io/snowmountain-market/api/catalog.json"
} as const;
