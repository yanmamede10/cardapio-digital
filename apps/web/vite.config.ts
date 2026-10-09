import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // The platform's mark (item 11): packages/shared/brand is both apps' public folder — /logo.svg (favicon, Logo), one file.
  publicDir: "../../packages/shared/brand",
  server: { port: 5173 }
});
