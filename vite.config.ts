import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("/node_modules/firebase/") ||
            id.includes("/node_modules/@firebase/")
          ) {
            return "firebase";
          }
          if (id.includes("/node_modules/lucide-react/")) {
            return "icons";
          }
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/react-router")
          ) {
            return "react";
          }
          return undefined;
        },
      },
    },
  },
});
