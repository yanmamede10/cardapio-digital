import { Router } from "express";
import { prisma } from "../db.js";
import { serializeStaff } from "../lib/serialize.js";
import { signStaffToken, verifyPassword } from "../lib/auth.js";
import type { StaffRole } from "@cardapio/shared";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });

  const staff = await prisma.staffMember.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!staff || !staff.passwordHash || !verifyPassword(password, staff.passwordHash)) {
    return res.status(401).json({ error: "invalid credentials" });
  }

  const token = signStaffToken({ staffId: staff.id, restaurantId: staff.restaurantId, role: staff.role as StaffRole });
  res.json({ token, staff: serializeStaff(staff) });
});
