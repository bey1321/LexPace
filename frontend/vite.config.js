import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: everything that is not the React shell goes to FastAPI on 8000, so the shell and
// the LexPace iframes share one origin (and one localStorage).
const backend = "http://127.0.0.1:8000";
const toBackend = { target: backend, changeOrigin: false };

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": toBackend,
      "/lexpace": toBackend,
      "/rap": toBackend,
      "/dev/login": toBackend,
      "/internal": toBackend,
    },
  },
});
