import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { roleLevel, type PlanModule, type StaffRole } from "@cardapio/shared";
import { prisma } from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === "production" ? "" : "dev-only-insecure-secret");
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}
const TOKEN_TTL = "24h"; // a tablet lasts the whole service; revocation is live anyway (requireStaff reads the DB)

export interface StaffTokenPayload {
  staffId: string;
  restaurantId: string;
  role: StaffRole;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function signStaffToken(payload: StaffTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      staff?: StaffTokenPayload & { modules: string[] };
    }
  }
}

/** Verifies the token, then reads the staff member's current role and restaurant status/modules — one query per request,
 *  so a role change (Equipe & Permissões) or a deactivation/module toggle (super admin) applies to the very next request. */
export const requireStaff = staffGuard(false);
/** Also lets through a login still on a provisional password — only for /api/auth/me and changing that password. */
export const requireStaffWithProvisionalPassword = staffGuard(true);

function staffGuard(allowProvisional: boolean) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.header("Authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) return res.status(401).json({ error: "authentication required" });
    let payload: StaffTokenPayload;
    try {
      payload = jwt.verify(token, JWT_SECRET) as StaffTokenPayload;
    } catch {
      return res.status(401).json({ error: "invalid or expired token" });
    }
    prisma.staffMember
      .findUnique({
        where: { id: payload.staffId },
        select: { role: true, restaurantId: true, mustChangePassword: true, restaurant: { select: { status: true, planModulesJson: true } } }
      })
      .then((s) => {
        if (!s || s.restaurant.status !== "ativo") return res.status(401).json({ error: "session revoked" });
        // A reset also stops sessions opened before it: nothing but the password change until it's replaced.
        if (s.mustChangePassword && !allowProvisional) return res.status(403).json({ error: "password change required" });
        req.staff = { staffId: payload.staffId, restaurantId: s.restaurantId, role: s.role as StaffRole, modules: JSON.parse(s.restaurant.planModulesJson) };
        next();
      })
      .catch(next);
  };
}

/** Contracted-module gate (ADMIN-03), run after requireStaff (which loaded the restaurant's current modules). */
export const hasModule = (req: Request, key: PlanModule) => !!req.staff?.modules.includes(key);
export function requireModule(key: PlanModule) {
  return (req: Request, res: Response, next: NextFunction) => (hasModule(req, key) ? next() : res.status(403).json({ error: "forbidden: module not contracted" }));
}

/** Rejects if the :id route param doesn't match the authenticated staff's own restaurant. */
export function requireOwnRestaurant(req: Request, res: Response, next: NextFunction) {
  if (req.staff?.restaurantId !== req.params.id) {
    return res.status(403).json({ error: "forbidden: restaurant mismatch" });
  }
  next();
}

/** Ordinal check (Funcionário 1 < Administrador 2 < Dono 3), run after requireStaff (which loaded the current role). */
export function requireMinRole(min: number) {
  return (req: Request, res: Response, next: NextFunction) =>
    req.staff && roleLevel(req.staff.role) >= min ? next() : res.status(403).json({ error: "forbidden: role not allowed" });
}

/** Exact-role allowlist, for the rare screen that splits a level (see SUPPORT_ROLES). Also runs after requireStaff. */
export function requireRole(...roles: StaffRole[]) {
  return (req: Request, res: Response, next: NextFunction) =>
    req.staff && roles.includes(req.staff.role) ? next() : res.status(403).json({ error: "forbidden: role not allowed" });
}
