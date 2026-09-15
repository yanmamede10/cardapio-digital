import cors from "cors";
import express from "express";
import { addressesRouter } from "./routes/addresses.js";
import { couponsRouter } from "./routes/coupons.js";
import { dashboardCouponsRouter } from "./routes/dashboardCoupons.js";
import { menuManagementRouter } from "./routes/menuManagement.js";
import { ordersRouter } from "./routes/orders.js";
import { paymentMethodsRouter } from "./routes/paymentMethods.js";
import { reportsRouter } from "./routes/reports.js";
import { restaurantsRouter } from "./routes/restaurants.js";
import { restaurantTablesRouter } from "./routes/restaurantTables.js";
import { settingsRouter } from "./routes/settings.js";
import { supportRouter } from "./routes/support.js";
import { tablesRouter } from "./routes/tables.js";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/restaurants", restaurantsRouter);
app.use("/api/restaurants", restaurantTablesRouter);
app.use("/api/restaurants", menuManagementRouter);
app.use("/api/restaurants", dashboardCouponsRouter);
app.use("/api/restaurants", supportRouter);
app.use("/api/restaurants", reportsRouter);
app.use("/api/restaurants", settingsRouter);
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

app.listen(PORT, () => {
  console.log(`Cardápio Digital API listening on http://localhost:${PORT}`);
});
