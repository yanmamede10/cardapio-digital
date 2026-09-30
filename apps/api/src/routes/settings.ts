import { asyncRouter } from "../lib/router.js";
import { LEVEL, MIN_PASSWORD_LENGTH, ROLE_LEVEL, type FiscalInfo, type OperatingHoursRow, type PaymentMode, type RestaurantProfile, type StaffRole, type TaxRegime } from "@cardapio/shared";
import { prisma } from "../db.js";
import { hashPassword, requireOwnRestaurant, requireMinRole, requireStaff } from "../lib/auth.js";
import { serializeFiscal, serializeHours, serializeProfile, serializeStaff } from "../lib/serialize.js";

export const settingsRouter = asyncRouter();
// Applied per-route (not via router.use) — several routers share the
// "/api/restaurants" mount point, and a path-based router.use() here would
// also run for sibling routers' routes.
const staffGuard = [requireStaff, requireOwnRestaurant, requireMinRole(LEVEL.ADMINISTRADOR)];
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_RESTAURANT_NAME_LENGTH = 80;
const MAX_CUISINE_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_HOURS_LENGTH = 40; // free text, e.g. "11:30 – 15:00"; "" = closed at that meal
const TAX_REGIMES: TaxRegime[] = ["mei", "simples_nacional", "lucro_presumido", "lucro_real", "lucro_arbitrado"];
const PAYMENT_MODES: PaymentMode[] = ["sistema", "maquininha_propria"];

async function requireRestaurant(id: string) {
  return prisma.restaurant.findUnique({ where: { id } });
}

settingsRouter.get("/:id/profile", ...staffGuard, async (req, res) => {
  const r = await requireRestaurant(req.params.id);
  if (!r) return res.status(404).json({ error: "restaurant not found" });
  res.json(serializeProfile(r));
});

settingsRouter.patch("/:id/profile", ...staffGuard, async (req, res) => {
  const body = req.body as Partial<RestaurantProfile>;
  if (body.name !== undefined && body.name.length > MAX_RESTAURANT_NAME_LENGTH) {
    return res.status(400).json({ error: `name must be at most ${MAX_RESTAURANT_NAME_LENGTH} characters` });
  }
  if (body.cuisineCategory !== undefined && body.cuisineCategory.length > MAX_CUISINE_LENGTH) {
    return res.status(400).json({ error: `cuisineCategory must be at most ${MAX_CUISINE_LENGTH} characters` });
  }
  if (body.description !== undefined && body.description.length > MAX_DESCRIPTION_LENGTH) {
    return res.status(400).json({ error: `description must be at most ${MAX_DESCRIPTION_LENGTH} characters` });
  }
  const existing = await requireRestaurant(req.params.id);
  if (!existing) return res.status(404).json({ error: "restaurant not found" });
  const r = await prisma.restaurant.update({
    where: { id: req.params.id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.cuisineCategory !== undefined ? { cuisine: body.cuisineCategory } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl } : {}),
      ...(body.coverUrl !== undefined ? { coverUrl: body.coverUrl } : {})
    }
  });
  res.json(serializeProfile(r));
});

settingsRouter.get("/:id/hours", ...staffGuard, async (req, res) => {
  const rows = await prisma.operatingHour.findMany({ where: { restaurantId: req.params.id } });
  res.json(serializeHours(rows));
});

settingsRouter.patch("/:id/hours", ...staffGuard, async (req, res) => {
  const { rows } = req.body as { rows?: OperatingHoursRow[] };
  const okRow = (r: OperatingHoursRow) =>
    !!r && Number.isInteger(r.weekday) && r.weekday >= 0 && r.weekday <= 6 && typeof r.isOpen === "boolean" &&
    [r.lunch, r.dinner].every((t) => typeof t === "string" && t.length <= MAX_HOURS_LENGTH);
  if (!Array.isArray(rows) || rows.length > 7 || !rows.every(okRow) || new Set(rows.map((r) => r.weekday)).size !== rows.length) {
    return res.status(400).json({ error: `rows: up to 7 distinct weekdays (0-6), lunch and dinner up to ${MAX_HOURS_LENGTH} characters, isOpen true or false` });
  }
  await prisma.$transaction(
    rows.map((row) =>
      prisma.operatingHour.upsert({
        where: { restaurantId_weekday: { restaurantId: req.params.id, weekday: row.weekday } },
        create: { restaurantId: req.params.id, weekday: row.weekday, lunch: row.lunch, dinner: row.dinner, isOpen: row.isOpen },
        update: { lunch: row.lunch, dinner: row.dinner, isOpen: row.isOpen }
      })
    )
  );
  const updated = await prisma.operatingHour.findMany({ where: { restaurantId: req.params.id } });
  res.json(serializeHours(updated));
});

// Equipe & Permissões is Dono-only: an Administrador who could write here could promote themselves to Dono.
const ownerGuard = [requireStaff, requireOwnRestaurant, requireMinRole(LEVEL.DONO)];
type StaffBody = { name?: string; email?: string; role?: StaffRole; password?: string };

/** Error message for a bad staff payload, or null. `partial` (edit) allows omitted fields. */
function staffError(b: StaffBody, partial: boolean): string | null {
  if (!partial && (!b.name?.trim() || !b.email?.trim() || !b.role)) return "name, email and role are required";
  if (b.name !== undefined && (!b.name.trim() || b.name.length > MAX_NAME_LENGTH)) return `name must be 1-${MAX_NAME_LENGTH} characters`;
  if (b.email !== undefined && (!b.email.includes("@") || b.email.length > MAX_EMAIL_LENGTH)) return `email must be valid and at most ${MAX_EMAIL_LENGTH} characters`;
  if (b.role !== undefined && !Object.hasOwn(ROLE_LEVEL, b.role)) return `role must be one of ${Object.keys(ROLE_LEVEL).join(", ")}`;
  if (b.password !== undefined && (typeof b.password !== "string" || b.password.length < MIN_PASSWORD_LENGTH)) return `password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  return null;
}

settingsRouter.get("/:id/staff", ...ownerGuard, async (req, res) => {
  const staff = await prisma.staffMember.findMany({ where: { restaurantId: req.params.id }, orderBy: { invitedAt: "asc" } });
  res.json(staff.map(serializeStaff));
});

settingsRouter.post("/:id/staff", ...ownerGuard, async (req, res) => {
  const body = req.body as StaffBody;
  const error = staffError(body, false);
  if (error) return res.status(400).json({ error });
  const email = body.email!.trim().toLowerCase();
  if (await prisma.staffMember.findUnique({ where: { email } })) return res.status(409).json({ error: "email already in use" });
  const staff = await prisma.staffMember.create({
    data: { restaurantId: req.params.id, name: body.name!.trim(), email, role: body.role!, passwordHash: body.password ? hashPassword(body.password) : "" }
  });
  res.status(201).json(serializeStaff(staff));
});

settingsRouter.patch("/:id/staff/:staffId", ...ownerGuard, async (req, res) => {
  const body = req.body as StaffBody;
  const error = staffError(body, true);
  if (error) return res.status(400).json({ error });
  const existing = await prisma.staffMember.findFirst({ where: { id: req.params.staffId, restaurantId: req.params.id } });
  if (!existing) return res.status(404).json({ error: "staff member not found" });
  // A Dono demoting themselves could leave the restaurant with nobody able to manage the team.
  if (existing.id === req.staff!.staffId && body.role !== undefined && body.role !== existing.role) {
    return res.status(400).json({ error: "you cannot change your own role" });
  }
  const email = body.email?.trim().toLowerCase();
  if (email && email !== existing.email && (await prisma.staffMember.findUnique({ where: { email } }))) {
    return res.status(409).json({ error: "email already in use" });
  }
  const staff = await prisma.staffMember.update({
    where: { id: existing.id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(email ? { email } : {}),
      ...(body.role !== undefined ? { role: body.role } : {}),
      ...(body.password ? { passwordHash: hashPassword(body.password) } : {})
    }
  });
  res.json(serializeStaff(staff));
});

settingsRouter.get("/:id/fiscal", ...staffGuard, async (req, res) => {
  const r = await requireRestaurant(req.params.id);
  if (!r) return res.status(404).json({ error: "restaurant not found" });
  res.json(serializeFiscal(r));
});

settingsRouter.patch("/:id/fiscal", ...staffGuard, async (req, res) => {
  const body = req.body as Partial<FiscalInfo>;
  if (body.taxRegime !== undefined && !TAX_REGIMES.includes(body.taxRegime)) {
    return res.status(400).json({ error: `taxRegime must be one of ${TAX_REGIMES.join(", ")}` });
  }
  const existing = await requireRestaurant(req.params.id);
  if (!existing) return res.status(404).json({ error: "restaurant not found" });
  const r = await prisma.restaurant.update({
    where: { id: req.params.id },
    data: {
      ...(body.cnpj !== undefined ? { cnpj: body.cnpj } : {}),
      ...(body.legalName !== undefined ? { legalName: body.legalName } : {}),
      ...(body.stateRegistration !== undefined ? { stateRegistration: body.stateRegistration } : {}),
      ...(body.taxRegime !== undefined ? { taxRegime: body.taxRegime } : {}),
      ...(body.fiscalAddress !== undefined ? { fiscalAddress: body.fiscalAddress } : {})
    }
  });
  res.json(serializeFiscal(r));
});

// Read by every role: the waiter's "Fechar conta" follows it (maquininha própria or PIX via sistema).
settingsRouter.get("/:id/payment-mode", requireStaff, requireOwnRestaurant, async (req, res) => {
  const r = await requireRestaurant(req.params.id);
  if (!r) return res.status(404).json({ error: "restaurant not found" });
  res.json({ paymentMode: r.paymentMode as PaymentMode, serviceCharge: r.serviceCharge, qrOrdering: r.qrOrdering });
});

// How the salon works: payment at the table (Configurações → Financeiro), the 10% service and ordering by QR
// (Configurações → Salão). Only the fields sent change.
settingsRouter.patch("/:id/payment-mode", ...staffGuard, async (req, res) => {
  const { paymentMode, serviceCharge, qrOrdering } = req.body as { paymentMode?: PaymentMode; serviceCharge?: unknown; qrOrdering?: unknown };
  if (paymentMode === undefined && serviceCharge === undefined && qrOrdering === undefined) return res.status(400).json({ error: "nothing to change" });
  if (paymentMode !== undefined && !PAYMENT_MODES.includes(paymentMode)) return res.status(400).json({ error: `paymentMode must be one of ${PAYMENT_MODES.join(", ")}` });
  if ([serviceCharge, qrOrdering].some((v) => v !== undefined && typeof v !== "boolean")) return res.status(400).json({ error: "serviceCharge and qrOrdering must be true or false" });
  const existing = await requireRestaurant(req.params.id);
  if (!existing) return res.status(404).json({ error: "restaurant not found" });
  const r = await prisma.restaurant.update({ where: { id: req.params.id }, data: { paymentMode, serviceCharge: serviceCharge as boolean | undefined, qrOrdering: qrOrdering as boolean | undefined } });
  res.json({ paymentMode: r.paymentMode as PaymentMode, serviceCharge: r.serviceCharge, qrOrdering: r.qrOrdering });
});
