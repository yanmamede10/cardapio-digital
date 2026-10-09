import type { CapacitorConfig } from "@capacitor/cli";

// The server's scheme decides how the app is served inside the APK. `cap sync` reads this with the same environment as the
// vite build before it, so VITE_PUBLIC_URL in the environment (it beats .env files) drives both.
// - Demo APK (VITE_PUBLIC_URL=https://<IP or domain>, README "APK do painel"): https scheme, and plain http stays blocked by
//   Android.
// - Dev builds (.env.android → http://10.0.2.2:4100): an https page can't call an http API, so the http scheme; and
//   cleartext, which `cap sync` writes into the generated manifest that Gradle merges into the app's.
const httpsApi = process.env.VITE_PUBLIC_URL?.startsWith("https://") ?? false;

const config: CapacitorConfig = {
  appId: "com.mesapronta.gestao",
  appName: "Pyro Gestão", // what the launcher shows (also res/values/strings.xml); the appId above stays: Firebase knows it
  webDir: "dist",
  server: {
    androidScheme: httpsApi ? "https" : "http",
    cleartext: !httpsApi
  }
};

export default config;
