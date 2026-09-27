import assert from "node:assert/strict";
import { test } from "node:test";
import { call } from "./helpers.ts";

const login = (email: unknown, password: unknown) => call("POST", "/api/auth/login", { body: { email, password } });
const claims = (token: string) => JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());

test("a sessão vale 24 horas (um turno inteiro no tablet)", async () => {
  const { token } = (await login("garcom@chapa27.example", "senha123")).body;
  const { iat, exp } = claims(token);
  assert.equal(exp - iat, 24 * 60 * 60);
});

test("e-mail com maiúsculas e espaços entra; senha errada e campos vazios não", async () => {
  assert.equal((await login("  DONO@Chapa27.example ", "senha123")).status, 200);
  assert.equal((await login("dono@chapa27.example", "errada")).status, 401);
  assert.equal((await login("naoexiste@chapa27.example", "senha123")).status, 401);
  for (const [e, p] of [["", "senha123"], ["dono@chapa27.example", ""], [undefined, undefined]]) assert.equal((await login(e, p)).status, 400);
});

test("token adulterado, de outro sistema ou ausente → 401", async () => {
  const { token } = (await login("dono@chapa27.example", "senha123")).body;
  const [h, p, s] = token.split(".");
  const forged = `${h}.${Buffer.from(JSON.stringify({ ...claims(token), role: "owner", staffId: "outro" })).toString("base64url")}.${s}`;
  for (const t of ["abc", forged, `${h}.${p}.assinatura`]) assert.equal((await call("GET", "/api/auth/me", { token: t })).status, 401, t);
  assert.equal((await call("GET", "/api/auth/me")).status, 401);
});
