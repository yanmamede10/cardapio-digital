import { asyncRouter } from "../lib/router.js";
import { prisma } from "../db.js";
import { serializeStaff } from "../lib/serialize.js";
import { hashPassword, requireStaffWithProvisionalPassword, signStaffToken, verifyPassword } from "../lib/auth.js";
import { MIN_PASSWORD_LENGTH, type StaffRole } from "@cardapio/shared";

export const authRouter = asyncRouter();

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });

  const staff = await prisma.staffMember.findUnique({ where: { email: email.trim().toLowerCase() }, include: { restaurant: { select: { status: true } } } });
  if (!staff || !staff.passwordHash || !verifyPassword(password, staff.passwordHash)) {
    return res.status(401).json({ error: "invalid credentials" });
  }
  if (staff.restaurant.status !== "ativo") return res.status(403).json({ error: "restaurant is not active" });

  const token = signStaffToken({ staffId: staff.id, restaurantId: staff.restaurantId, role: staff.role as StaffRole });
  res.json({ token, staff: serializeStaff(staff), mustChangePassword: staff.mustChangePassword });
});

// The dashboard re-reads this on every start: current role, the restaurant's contracted modules (menu filter) and
// whether the password is still provisional (then it shows only the change-password screen).
authRouter.get("/me", requireStaffWithProvisionalPassword, async (req, res) => {
  const staff = await prisma.staffMember.findUniqueOrThrow({ where: { id: req.staff!.staffId } });
  res.json({ staff: serializeStaff(staff), modules: req.staff!.modules, mustChangePassword: staff.mustChangePassword });
});

// Replaces the caller's own password. Asks for the current one so a session opened before a reset can't use it.
authRouter.post("/password", requireStaffWithProvisionalPassword, async (req, res) => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  const staff = await prisma.staffMember.findUniqueOrThrow({ where: { id: req.staff!.staffId } });
  // 400, not 401: a 401 would make the dashboard drop the session.
  if (!currentPassword || !staff.passwordHash || !verifyPassword(currentPassword, staff.passwordHash)) return res.status(400).json({ error: "current password is wrong" });
  if (typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD_LENGTH) return res.status(400).json({ error: `password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  if (newPassword === currentPassword) return res.status(400).json({ error: "new password must differ from the current one" });
  await prisma.staffMember.update({ where: { id: staff.id }, data: { passwordHash: hashPassword(newPassword), mustChangePassword: false } });
  res.json({ ok: true });
});
