import app from "./app.js";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
// Loopback by default: only this machine reaches it. In the VM's container HOST=0.0.0.0 (apps/api/Dockerfile), and only
// Caddy, on the compose network, gets to it. HOST=0.0.0.0 also to reach it from a phone on the LAN in dev.
const HOST = process.env.HOST || "127.0.0.1";

app.listen(PORT, HOST, () => {
  console.log(`Cardápio Digital API listening on http://${HOST}:${PORT}`);
});
