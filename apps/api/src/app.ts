import "./env.js";
import cors from "cors";
import express from "express";
import { addressesRouter } from "./routes/addresses.js";
import { adminRouter } from "./routes/admin.js";
import { appearanceRouter } from "./routes/appearance.js";
import { authRouter } from "./routes/auth.js";
import { couponsRouter } from "./routes/coupons.js";
import { dashboardCouponsRouter } from "./routes/dashboardCoupons.js";
import { financeRouter } from "./routes/finance.js";
import { menuManagementRouter } from "./routes/menuManagement.js";
import { ordersRouter } from "./routes/orders.js";
import { paymentMethodsRouter } from "./routes/paymentMethods.js";
import { productsRouter } from "./routes/products.js";
import { reportsRouter } from "./routes/reports.js";
import { restaurantsRouter } from "./routes/restaurants.js";
import { restaurantTablesRouter } from "./routes/restaurantTables.js";
import { settingsRouter } from "./routes/settings.js";
import { supportRouter } from "./routes/support.js";
import { tablesRouter } from "./routes/tables.js";
import { whatsappRouter, whatsappWebhookRouter } from "./routes/whatsapp.js";
import { rateLimit } from "./lib/rateLimit.js";

// Day/month boundaries ("hoje", "mês corrente") are computed in server-local time. Containers run in UTC,
// which would shift them 3h vs. a Brazilian dev machine, so pin the zone explicitly.
process.env.TZ = process.env.APP_TZ || "America/Sao_Paulo";

const app = express();
app.disable("x-powered-by");
// Every answer is JSON for the apps: nothing here renders as a page, gets framed or sniffed into another type. Set here, not
// in the Caddyfile, so dev and the tests get them too.
app.use((_req, res, next) => {
  res.set({ "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'", "Referrer-Policy": "no-referrer" });
  next();
});

// CORS_ORIGINS = comma-separated frontend origins (the dashboard and cardápio .vercel.app URLs).
// Unset → open to any origin, which keeps local dev and the Capacitor Android builds working.
const origins = process.env.CORS_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean);
app.use(cors(origins?.length ? { origin: origins } : undefined));
// Evolution posts received media as base64 inside the JSON, far past express.json()'s 100kb default: this one route checks
// its secret and then parses with its own limit (routes/whatsapp.ts), before the global parser below.
app.use("/api/whatsapp/webhook", whatsappWebhookRouter);
app.use(express.json());
// Per staff member, per table, per IP ceiling (lib/rateLimit.ts). After the parser: an order's table is in its body.
app.use(rateLimit);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/restaurants", restaurantsRouter);
app.use("/api/restaurants", restaurantTablesRouter);
app.use("/api/restaurants", menuManagementRouter);
app.use("/api/restaurants", dashboardCouponsRouter);
app.use("/api/restaurants", supportRouter);
app.use("/api/restaurants", reportsRouter);
app.use("/api/restaurants", settingsRouter);
app.use("/api/restaurants", appearanceRouter);
app.use("/api/restaurants", productsRouter);
app.use("/api/restaurants", financeRouter);
app.use("/api/restaurants", whatsappRouter);
app.use("/api/tables", tablesRouter);
app.use("/api/addresses", addressesRouter);
app.use("/api/payment-methods", paymentMethodsRouter);
app.use("/api/coupons", couponsRouter);
app.use("/api/orders", ordersRouter);

app.use((req, res) => {
  res.status(404).json({ error: `no route for ${req.method} ${req.path}` });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // The body parser's own errors (malformed JSON 400, body over the limit 413) keep their status.
  const status = (err as { status?: number }).status;
  if (status && status >= 400 && status < 500) return res.status(status).json({ error: (err as Error).message });
  console.error(err);
  res.status(500).json({ error: "internal error" });
});

export default app;
