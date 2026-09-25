import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import type { Restaurant } from "@prisma/client";
import type { AdminRestaurant, RestaurantStatus } from "@cardapio/shared";
import { prisma } from "../db.js";
import { hashPassword } from "../lib/auth.js";

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

const serialize = (r: Restaurant): AdminRestaurant => ({
  id: r.id,
  name: r.name,
  cnpj: r.cnpj,
  contact: r.contact,
  status: r.status as RestaurantStatus,
  createdAt: r.createdAt.toISOString()
});

adminRouter.get("/restaurants", async (_req, res) => {
  const list = await prisma.restaurant.findMany({ orderBy: { createdAt: "desc" } });
  res.json(list.map(serialize));
});

adminRouter.post("/restaurants", async (req, res) => {
  const { name = "", cnpj = "", contact = "", ownerName = "", ownerEmail = "" } = req.body as Record<string, string | undefined>;
  const digits = cnpj.replace(/\D/g, "");
  const email = ownerEmail.trim().toLowerCase();
  if (!name.trim() || name.length > MAX_NAME_LENGTH) return res.status(400).json({ error: `name must be 1-${MAX_NAME_LENGTH} characters` });
  if (digits.length !== 14) return res.status(400).json({ error: "cnpj must have 14 digits" });
  if (contact.length > MAX_CONTACT_LENGTH) return res.status(400).json({ error: `contact must be at most ${MAX_CONTACT_LENGTH} characters` });
  if (!ownerName.trim() || ownerName.length > MAX_OWNER_NAME_LENGTH) return res.status(400).json({ error: `ownerName must be 1-${MAX_OWNER_NAME_LENGTH} characters` });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > MAX_EMAIL_LENGTH) return res.status(400).json({ error: "ownerEmail must be a valid e-mail" });

  // Same "12.345.678/0001-90" shape the Fiscal settings tab shows.
  const formatted = digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
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

adminRouter.patch("/restaurants/:id/status", async (req, res) => {
  const { status } = req.body as { status?: RestaurantStatus };
  if (status !== "ativo" && status !== "inativo") return res.status(400).json({ error: "status must be ativo or inativo" });
  if (!(await prisma.restaurant.findUnique({ where: { id: req.params.id } }))) return res.status(404).json({ error: "restaurant not found" });
  const r = await prisma.restaurant.update({ where: { id: req.params.id }, data: { status } });
  res.json(serialize(r));
});
