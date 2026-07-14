import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["cjs"],
  platform: "node",
  target: "node24",
  outDir: "dist",
  clean: true,
  outExtension: () => ({ js: ".cjs" }),
  noExternal: ["fastify", "zod", "@snowmountain/contracts"]
});
