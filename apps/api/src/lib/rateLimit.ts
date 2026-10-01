import type { NextFunction, Request, Response } from "express";
import { staffIdOf } from "./auth.js";

const MINUTE = 60_000;

/**
 * Every limit of the API, per fixed window. The IP is not who the client is: on the restaurant's Wi-Fi everyone leaves by
 * the same IP, and phones on mobile data share IPs (CGNAT). So a staff member counts by the user in their token, a customer
 * at a table by the table (its QR code), a login by the account — and the IP only gets a high ceiling against floods.
 * The numbers come from the apps' polling (docs/adr/0009-pedido-pelo-qr-e-limites.md has the arithmetic):
 * dashboard — Central 3 requests every 4 s + menu badges 3 every 15 s ≈ 57/min per device (the heaviest screen);
 * customer app — order status every 3 s + menu availability every 12 s + opening dishes ≈ 30/min per phone.
 */
export const LIMITS = {
  /** A logged-in staff member, all their devices together: ~10 devices on the Central with the same login. `npm test` raises
   *  it (env STAFF_PER_MINUTE): the suites act as a few logins from this machine, far faster than people. */
  STAFF_PER_MINUTE: Number(process.env.STAFF_PER_MINUTE) || 600,
  /** A table (every phone that read its QR, plus its fixed tablet): a group of 30 phones at full polling. */
  TABLE_PER_MINUTE: 900,
  /** Orders sent from one table in 5 minutes: a group of 20 ordering together, twice. */
  TABLE_ORDERS_PER_5_MINUTES: 40,
  /** Wrong passwords (login or password change) for one account, from anywhere: the next attempt waits the window out. */
  ACCOUNT_FAILURES_PER_15_MINUTES: 5,
  /** Login attempts from one IP: the whole team logging in at the start of a shift behind the same Wi-Fi, with typos. */
  LOGIN_ATTEMPTS_PER_IP_PER_15_MINUTES: 50,
  /** Everything from one IP, only against floods: a full house on one Wi-Fi (40 tables × 7 devices × 25/min + 10 staff
   *  devices × 57/min ≈ 7 600/min) fits twice. */
  IP_PER_MINUTE: 15_000
};

// ponytail: counters in this process's memory — the API runs as one instance (the demo PC) and a restart clears them.
// Move them to Postgres or Redis if it ever runs as more than one process.
const windows = new Map<string, { count: number; resetAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [key, w] of windows) if (w.resetAt <= now) windows.delete(key);
}, MINUTE).unref();

/** One more hit on `key` in a window of `ms`. Returns the seconds left in the window when it went over `max`, else 0. */
function hit(key: string, max: number, ms: number): number {
  const now = Date.now();
  let w = windows.get(key);
  if (!w || w.resetAt <= now) windows.set(key, (w = { count: 0, resetAt: now + ms }));
  w.count++;
  return w.count > max ? Math.ceil((w.resetAt - now) / 1000) : 0;
}

/** Seconds left if `key` already reached `max` in its window (nothing is counted), else 0. */
function full(key: string, max: number): number {
  const w = windows.get(key);
  const now = Date.now();
  return w && w.resetAt > now && w.count >= max ? Math.ceil((w.resetAt - now) / 1000) : 0;
}

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/**
 * The client's IP. Behind the Cloudflare tunnel every request reaches the API from this machine (cloudflared), with the
 * visitor's IP in CF-Connecting-IP, which Cloudflare's edge sets itself. So that header is believed only on a loopback
 * connection; from anywhere else the socket's address counts and the header is ignored. A loopback request without it is
 * this machine itself (Evolution, someone on the PC, the tests): null — no per-IP limit applies to it; the staff member's,
 * the table's and the account's still do.
 */
export function clientIp(req: Pick<Request, "header"> & { socket: { remoteAddress?: string } }): string | null {
  const peer = req.socket.remoteAddress ?? "";
  if (!LOOPBACK.has(peer)) return peer;
  return req.header("cf-connecting-ip")?.trim() || null;
}

export function tooMany(res: Response, seconds: number) {
  const wait = seconds <= 60 ? `${seconds} s` : `${Math.ceil(seconds / 60)} min`;
  return res.set("Retry-After", String(seconds)).status(429).json({ error: `Muitas tentativas em pouco tempo. Tente de novo em ${wait}.` });
}

/** Mounted after the body parser (an order's table is in its body) and before every route. */
export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = clientIp(req);
  const staff = staffIdOf(req.header("Authorization"));
  const bodyTable = typeof req.body?.tableCode === "string" ? (req.body.tableCode as string) : null;
  const table = staff ? null : bodyTable ?? req.header("X-Table-Code") ?? null;
  const ordering = req.method === "POST" && req.path === "/api/orders" && bodyTable !== null;
  const wait = Math.max(
    ip ? hit(`ip:${ip}`, LIMITS.IP_PER_MINUTE, MINUTE) : 0,
    staff ? hit(`staff:${staff}`, LIMITS.STAFF_PER_MINUTE, MINUTE) : 0,
    table ? hit(`table:${table}`, LIMITS.TABLE_PER_MINUTE, MINUTE) : 0,
    ordering ? hit(`table-orders:${bodyTable}`, LIMITS.TABLE_ORDERS_PER_5_MINUTES, 5 * MINUTE) : 0
  );
  if (wait) return tooMany(res, wait);
  next();
}

/** Before checking a password (login, password change): the account's lock and, for a login, the IP's attempts. */
export function passwordAttempt(req: Request, account: string, login: boolean): number {
  const locked = full(`account:${account}`, LIMITS.ACCOUNT_FAILURES_PER_15_MINUTES);
  if (locked) return locked;
  const ip = login ? clientIp(req) : null;
  return ip ? hit(`login-ip:${ip}`, LIMITS.LOGIN_ATTEMPTS_PER_IP_PER_15_MINUTES, 15 * MINUTE) : 0;
}

/** A wrong password for the account, wherever it came from (this machine included). */
export function passwordFailed(account: string) {
  hit(`account:${account}`, LIMITS.ACCOUNT_FAILURES_PER_15_MINUTES, 15 * MINUTE);
}
