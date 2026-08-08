// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // Tunaiambia Nitro itoe Static Site pekee kwenye folder la dist
  nitro: {
    preset: "static",
    output: {
      publicDir: "dist",
    },
  },
});