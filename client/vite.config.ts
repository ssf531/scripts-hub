import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:5220",
        changeOrigin: true,
      },
      "/hubs": {
        target: "http://localhost:5220",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: "../src/SmartScript.Api/wwwroot",
    emptyOutDir: true,
  },
});
