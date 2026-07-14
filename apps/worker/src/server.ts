import { resolve } from "node:path";
import { buildWorker } from "./app.js";

async function main(): Promise<void> {
  const port = Number(process.env.WORKER_PORT ?? 4312);
  const host = process.env.WORKER_HOST ?? "0.0.0.0";
  const app = await buildWorker({
    token: process.env.SANDBOX_WORKER_TOKEN ?? "",
    dataDir: resolve(process.env.WORKER_DATA_DIR ?? "/data"),
    hostDataDir: process.env.SANDBOX_HOST_DATA_DIR,
    image: process.env.SANDBOX_IMAGE ?? "alpine:3.20",
    driver: "docker",
    logger: true
  });

  try {
    await app.listen({ host, port });
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;
  }
}

void main();
