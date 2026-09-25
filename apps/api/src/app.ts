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

// Day/month boundaries ("hoje", "mês corrente") are computed in server-local time. Vercel runs in UTC,
// which would shift them 3h vs. a Brazilian dev machine, so pin the zone explicitly.
process.env.TZ = process.env.APP_TZ || "America/Sao_Paulo";

const app = express();

// CORS_ORIGINS = comma-separated frontend origins (the dashboard and cardápio .vercel.app URLs).
// Unset → open to any origin, which keeps local dev and the Capacitor Android builds working.
const origins = process.env.CORS_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean);
app.use(cors(origins?.length ? { origin: origins } : undefined));
app.use(express.json());

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
  console.error(err);
  res.status(500).json({ error: "internal error" });
});

export default app;
