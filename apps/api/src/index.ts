import app from "./app.js";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
// Loopback by default: in production the only way in is the Cloudflare tunnel (cloudflared runs on this machine), and the
// rate limit trusts CF-Connecting-IP only on loopback connections. HOST=0.0.0.0 to reach it from a phone on the LAN in dev.
const HOST = process.env.HOST || "127.0.0.1";

app.listen(PORT, HOST, () => {
  console.log(`Cardápio Digital API listening on http://${HOST}:${PORT}`);
});
