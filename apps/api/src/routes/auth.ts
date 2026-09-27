import { Router } from "express";
import { prisma } from "../db.js";
import { serializeStaff } from "../lib/serialize.js";
import { requireStaff, signStaffToken, verifyPassword } from "../lib/auth.js";
import type { StaffRole } from "@cardapio/shared";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });

  const staff = await prisma.staffMember.findUnique({ where: { email: email.trim().toLowerCase() }, include: { restaurant: { select: { status: true } } } });
  if (!staff || !staff.passwordHash || !verifyPassword(password, staff.passwordHash)) {
    return res.status(401).json({ error: "invalid credentials" });
  }
  if (staff.restaurant.status !== "ativo") return res.status(403).json({ error: "restaurant is not active" });

  const token = signStaffToken({ staffId: staff.id, restaurantId: staff.restaurantId, role: staff.role as StaffRole });
  res.json({ token, staff: serializeStaff(staff) });
});

// The dashboard re-reads this on every start: current role and the restaurant's contracted modules (menu filter).
authRouter.get("/me", requireStaff, async (req, res) => {
  const staff = await prisma.staffMember.findUniqueOrThrow({ where: { id: req.staff!.staffId } });
  res.json({ staff: serializeStaff(staff), modules: req.staff!.modules });
});
