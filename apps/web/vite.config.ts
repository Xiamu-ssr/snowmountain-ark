import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react()],
  server: {
    proxy: { "/v1": "http://127.0.0.1:4310", "/health": "http://127.0.0.1:4310" }
  }
});
