import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.mesapronta.cardapio",
  appName: "Cardápio Digital",
  webDir: "dist",
  // Dev-only: the local API is plain HTTP, and Capacitor's default "https"
  // scheme makes Chromium block it as mixed content. Switch back to "https"
  // once the API is served over TLS.
  server: {
    androidScheme: "http"
  }
};

export default config;
