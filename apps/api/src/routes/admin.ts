import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import type { Restaurant } from "@prisma/client";
import { PLAN_MODULES, type AdminRestaurant, type AdminRestaurantDetail, type RestaurantStatus } from "@cardapio/shared";
import { prisma } from "../db.js";
import { hashPassword } from "../lib/auth.js";
import { serializeStaff } from "../lib/serialize.js";
import { statusOf } from "./whatsapp.js";

// Super admin (ADMIN-01): the platform team, i.e. one person for now. A single key from env sent as a Bearer
// token — deliberately not a staff JWT, so no staff token can ever pass here and vice versa.
// ponytail: one shared key, no users/audit log; swap for real accounts when a second operator shows up.
function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.SUPER_ADMIN_KEY;
  if (!expected) return res.status(503).json({ error: "super admin disabled: SUPER_ADMIN_KEY is not set" });
  const header = req.header("Authorization");
  const given = header?.startsWith("Bearer ") ? header.slice(7) : "";
  // Hash both sides so timingSafeEqual gets equal lengths and the key length doesn't leak.
  const digest = (s: string) => createHash("sha256").update(s).digest();
  if (!timingSafeEqual(digest(given), digest(expected))) return res.status(401).json({ error: "invalid admin key" });
  next();
}

export const adminRouter = Router();
adminRouter.use(requireSuperAdmin); // own mount point (/api/admin), so router-wide is safe here

const MAX_NAME_LENGTH = 80;
const MAX_CONTACT_LENGTH = 200;
const MAX_OWNER_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;

type SignUpFields = { name?: string; cnpj?: string; contact?: string; ownerName?: string; ownerEmail?: string };

/** Checks the fields that are present — sign-up passes all of them (missing = ""), an edit only what changed. */
function fieldError(b: SignUpFields): string | null {
  if (b.name !== undefined && (!b.name.trim() || b.name.length > MAX_NAME_LENGTH)) return `name must be 1-${MAX_NAME_LENGTH} characters`;
  if (b.cnpj !== undefined && b.cnpj.replace(/\D/g, "").length !== 14) return "cnpj must have 14 digits";
  if (b.contact !== undefined && b.contact.length > MAX_CONTACT_LENGTH) return `contact must be at most ${MAX_CONTACT_LENGTH} characters`;
  if (b.ownerName !== undefined && (!b.ownerName.trim() || b.ownerName.length > MAX_OWNER_NAME_LENGTH)) return `ownerName must be 1-${MAX_OWNER_NAME_LENGTH} characters`;
  if (b.ownerEmail !== undefined && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.ownerEmail.trim()) || b.ownerEmail.length > MAX_EMAIL_LENGTH)) return "ownerEmail must be a valid e-mail";
  return null;
}

// Same "12.345.678/0001-90" shape the Fiscal settings tab shows.
const formatCnpj = (cnpj: string) => cnpj.replace(/\D/g, "").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

const serialize = (r: Restaurant): AdminRestaurant => ({
  id: r.id,
  name: r.name,
  cnpj: r.cnpj,
  contact: r.contact,
  status: r.status as RestaurantStatus,
  createdAt: r.createdAt.toISOString()
});

async function detail(r: Restaurant): Promise<AdminRestaurantDetail> {
  const staff = await prisma.staffMember.findMany({ where: { restaurantId: r.id }, orderBy: { invitedAt: "asc" } });
  return {
    ...serialize(r),
    ownerEmail: staff.find((s) => s.role === "owner")?.email ?? "",
    template: r.template as AdminRestaurantDetail["template"],
    brandColor: r.brandColor,
    paymentMode: r.paymentMode as AdminRestaurantDetail["paymentMode"],
    taxRegime: r.taxRegime as AdminRestaurantDetail["taxRegime"],
    modules: JSON.parse(r.planModulesJson),
    staff: staff.map(serializeStaff),
    whatsapp: await statusOf(r.id)
  };
}

adminRouter.get("/restaurants", async (_req, res) => {
  const list = await prisma.restaurant.findMany({ orderBy: { createdAt: "desc" } });
  res.json(list.map(serialize));
});

adminRouter.post("/restaurants", async (req, res) => {
  const { name = "", cnpj = "", contact = "", ownerName = "", ownerEmail = "" } = req.body as SignUpFields;
  const error = fieldError({ name, cnpj, contact, ownerName, ownerEmail });
  if (error) return res.status(400).json({ error });
  const email = ownerEmail.trim().toLowerCase();
  const formatted = formatCnpj(cnpj);
  if (await prisma.restaurant.findFirst({ where: { cnpj: formatted } })) return res.status(409).json({ error: "cnpj already registered" });
  if (await prisma.staffMember.findUnique({ where: { email } })) return res.status(409).json({ error: "owner email already in use" });

  // The first Dono, so the restaurant can log in once activated. Temporary password returned once, for the super
  // admin to pass on; the Dono changes it in Equipe & Permissões.
  const ownerPassword = randomBytes(9).toString("base64url");

  const slug = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  const initials = name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const r = await prisma.restaurant.create({
    data: {
      id: `${slug || "restaurante"}-${randomBytes(2).toString("hex")}`,
      name: name.trim(),
      initials,
      cnpj: formatted,
      contact: contact.trim(),
      status: "pendente",
      // Storefront fields the delivery listing requires; the restaurant fills the real ones in its own dashboard.
      cuisine: "",
      cuisineTagsJson: "[]",
      rating: 0,
      reviewCount: 0,
      etaMinMinutes: 30,
      etaMaxMinutes: 45,
      deliveryFee: 0,
      isOpen: false,
      coverLabel: name.trim(),
      staff: { create: { name: ownerName.trim(), email, role: "owner", passwordHash: hashPassword(ownerPassword) } }
    }
  });
  res.status(201).json({ ...serialize(r), ownerPassword });
});

adminRouter.get("/restaurants/:id", async (req, res) => {
  const r = await prisma.restaurant.findUnique({ where: { id: req.params.id } });
  if (!r) return res.status(404).json({ error: "restaurant not found" });
  res.json(await detail(r));
});

// Sign-up data: name, CNPJ, contact and the first Dono's login e-mail. Only the fields sent change.
adminRouter.patch("/restaurants/:id", async (req, res) => {
  const { name, cnpj, contact, ownerEmail } = req.body as SignUpFields;
  const error = fieldError({ name, cnpj, contact, ownerEmail });
  if (error) return res.status(400).json({ error });
  const r = await prisma.restaurant.findUnique({ where: { id: req.params.id } });
  if (!r) return res.status(404).json({ error: "restaurant not found" });

  const formatted = cnpj === undefined ? undefined : formatCnpj(cnpj);
  if (formatted && (await prisma.restaurant.findFirst({ where: { cnpj: formatted, id: { not: r.id } } }))) return res.status(409).json({ error: "cnpj already registered" });
  const email = ownerEmail?.trim().toLowerCase();
  const owner = email ? await prisma.staffMember.findFirst({ where: { restaurantId: r.id, role: "owner" }, orderBy: { invitedAt: "asc" } }) : null;
  if (email && !owner) return res.status(409).json({ error: "restaurant has no owner" });
  if (email && owner && email !== owner.email && (await prisma.staffMember.findUnique({ where: { email } }))) return res.status(409).json({ error: "owner email already in use" });

  const [updated] = await prisma.$transaction([
    prisma.restaurant.update({
      where: { id: r.id },
      data: { ...(name !== undefined ? { name: name.trim() } : {}), ...(formatted ? { cnpj: formatted } : {}), ...(contact !== undefined ? { contact: contact.trim() } : {}) }
    }),
    ...(email && owner ? [prisma.staffMember.update({ where: { id: owner.id }, data: { email } })] : [])
  ]);
  res.json(await detail(updated));
});

adminRouter.patch("/restaurants/:id/status", async (req, res) => {
  const { status } = req.body as { status?: RestaurantStatus };
  if (status !== "ativo" && status !== "inativo") return res.status(400).json({ error: "status must be ativo or inativo" });
  if (!(await prisma.restaurant.findUnique({ where: { id: req.params.id } }))) return res.status(404).json({ error: "restaurant not found" });
  const r = await prisma.restaurant.update({ where: { id: req.params.id }, data: { status } });
  res.json(serialize(r));
});

// ADMIN-03: the contracted modules — the restaurant's menu and API follow on the very next request (requireStaff reads them live).
adminRouter.patch("/restaurants/:id/modules", async (req, res) => {
  const { modules } = req.body as { modules?: unknown };
  if (!Array.isArray(modules) || !modules.every((m) => (PLAN_MODULES as readonly unknown[]).includes(m))) {
    return res.status(400).json({ error: `modules must be a list of ${PLAN_MODULES.join(", ")}` });
  }
  if (!(await prisma.restaurant.findUnique({ where: { id: req.params.id } }))) return res.status(404).json({ error: "restaurant not found" });
  const ordered = PLAN_MODULES.filter((m) => modules.includes(m));
  await prisma.restaurant.update({ where: { id: req.params.id }, data: { planModulesJson: JSON.stringify(ordered) } });
  res.json({ modules: ordered });
});
