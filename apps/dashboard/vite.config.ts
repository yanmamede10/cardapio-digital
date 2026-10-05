import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ command, mode }) => ({
  // The web build is served by Caddy under /painel/ (deploy/Caddyfile); the APK (mode android, page at https://localhost) and
  // the dev server stay at the root. main.tsx gives the router the same base.
  base: command === "build" && mode !== "android" ? "/painel/" : "/",
  plugins: [react()],
  server: { port: 5174 }
}));
