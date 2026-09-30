// First import of app.ts. In production the API refuses to start without the settings it can't run safely without;
// outside production nothing changes (a dev JWT secret and open CORS).
// db.js comes first: importing Prisma Client is what loads apps/api/.env into process.env.
import "./db.js";

if (process.env.NODE_ENV === "production") {
  const missing = [
    (process.env.JWT_SECRET ?? "").length < 32 && "JWT_SECRET com pelo menos 32 caracteres (gere com: openssl rand -base64 48)",
    !process.env.CORS_ORIGINS?.split(",").some((o) => o.trim()) && "CORS_ORIGINS com as URLs do painel e do cardápio, separadas por vírgula"
  ].filter(Boolean);
  if (missing.length) {
    console.error(`A API não sobe em produção sem:\n- ${missing.join("\n- ")}`);
    process.exit(1);
  }
}
