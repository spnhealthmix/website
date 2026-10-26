import { defineConfig } from "vitest/config";
import path from "node:path";
import * as fs from "node:fs";

function parseEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const envPath = path.resolve(__dirname, ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim();
        env[k] = v;
        process.env[k] = v;
      }
    }
  }
  return env;
}

const env = parseEnv();

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    fileParallelism: false,
    testTimeout: 180000,
    hookTimeout: 180000,
    include: ["tests/**/*.test.ts"],
    env,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
