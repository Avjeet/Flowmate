import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 7843 },
  resolve: {
    alias: { "@flowmate/shared": "../../packages/shared/src/index.ts" },
  },
});
