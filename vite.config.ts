import { defineConfig } from "vite";
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          babylon: ["@babylonjs/core/Engines/engine", "@babylonjs/core/scene"],
        },
      },
    },
  },
});
