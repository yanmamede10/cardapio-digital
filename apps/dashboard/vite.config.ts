import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ command, mode }) => ({
  // The web build is served by Caddy under /painel/ (deploy/Caddyfile); the APK (mode android, page at https://localhost) and
  // the dev server stay at the root. main.tsx gives the router the same base.
  base: command === "build" && mode !== "android" ? "/painel/" : "/",
  plugins: [react()],
  // The platform's mark (item 11): packages/shared/brand is both apps' public folder — /logo.svg (favicon, Logo), one file.
  publicDir: "../../packages/shared/brand",
  server: { port: 5174 }
}));
