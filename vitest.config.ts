import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Tests live beside nothing — they mirror the source tree under tests/.
// Only pure modules are covered here; anything needing a browser or a live
// Supabase connection is verified per the tiers in conductor/workflow.md.
export default defineConfig({
  resolve: {
    alias: {
      // Mirrors the "@/*" -> "./*" mapping in tsconfig.json.
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
