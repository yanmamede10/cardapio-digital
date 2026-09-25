import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { roleLevel, type StaffRole } from "@cardapio/shared";
import { prisma } from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === "production" ? "" : "dev-only-insecure-secret");
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}
const TOKEN_TTL = "12h";

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
      staff?: StaffTokenPayload;
    }
  }
}

export function requireStaff(req: Request, res: Response, next: NextFunction) {
  const header = req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) return res.status(401).json({ error: "authentication required" });
  try {
    req.staff = jwt.verify(token, JWT_SECRET) as StaffTokenPayload;
    next();
  } catch {
    return res.status(401).json({ error: "invalid or expired token" });
  }
}

/** Rejects if the :id route param doesn't match the authenticated staff's own restaurant. */
export function requireOwnRestaurant(req: Request, res: Response, next: NextFunction) {
  if (req.staff?.restaurantId !== req.params.id) {
    return res.status(403).json({ error: "forbidden: restaurant mismatch" });
  }
  next();
}

/** Ordinal check (Funcionário 1 < Administrador 2 < Dono 3), run after requireStaff. The role is read from the
 *  database, not the token, so a change made in Equipe & Permissões applies on the next request. */
export function requireMinRole(min: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.staff) return res.status(401).json({ error: "authentication required" });
    prisma.staffMember
      .findUnique({ where: { id: req.staff.staffId }, select: { role: true } })
      .then((s) => (s && roleLevel(s.role) >= min ? next() : res.status(403).json({ error: "forbidden: role not allowed" })))
      .catch(next);
  };
}
