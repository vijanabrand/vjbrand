import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    spa: true, // Hii inaiambia TanStack Start ibuild kama Single Page App (Static)
  },
  nitro: {
    output: {
      publicDir: "dist",
    },
  },
});