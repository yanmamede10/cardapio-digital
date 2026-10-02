import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { readableError } from "@cardapio/shared";

// Checklist 13: what a person reads when something fails is plain Portuguese, never the API's developer text
// ("forbidden: role not allowed") or a bare "Erro 500". The dashboard's and the cardápio's ApiError (and the Super
// Admin's fetch) pass every error through readableError.
const ENGLISH = /\b(not|must|invalid|forbidden|required|found|already|error|is|are|the|unknown|cannot|credentials|revoked)\b/i;
const API = new URL("../../apps/api/src/", import.meta.url);

test("toda mensagem de erro da API chega em português: a técnica (em inglês) vira uma frase pelo status, a já escrita em português passa", () => {
  const found: [number, string][] = [];
  for (const f of readdirSync(API, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".ts"))) {
    const code = readFileSync(new URL(f.replaceAll("\\", "/"), API), "utf8");
    for (const m of code.matchAll(/status\((\d{3})\)\.json\(\{ error: [`"]([^`"]*)/g)) found.push([Number(m[1]), m[2]]);
  }
  assert.ok(found.length > 80, `${found.length} mensagens`);
  for (const [status, raw] of found) {
    const shown = readableError(status, raw);
    assert.doesNotMatch(shown, ENGLISH, `${status} "${raw}" → "${shown}"`);
    assert.match(shown, /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/, `${status} "${raw}" → "${shown}"`);
  }
});

test("cada situação tem sua frase: rede, validação, login, sessão, permissão, conflito, limite de tentativas, arquivo grande, servidor", () => {
  const network = "Não foi possível conectar ao servidor. Tente novamente.";
  assert.equal(readableError(0, network), network);
  assert.equal(readableError(400, "email and password are required"), "Confira os dados informados e tente de novo.");
  assert.equal(readableError(401, "invalid credentials"), "E-mail ou senha incorretos.");
  assert.equal(readableError(401, "session revoked"), "Sua sessão terminou. Entre de novo.");
  assert.equal(readableError(403, "forbidden: role not allowed"), "Você não tem permissão para fazer isso.");
  assert.equal(readableError(404, "table not found"), "Não encontramos o que você procurou. Atualize a página e tente de novo.");
  assert.equal(readableError(409, "order is not pending"), "Isso mudou enquanto você olhava. Atualize a página e confira.");
  assert.equal(readableError(409, "feche a conta antes de excluir a mesa"), "Feche a conta antes de excluir a mesa");
  const tooMany = "Muitas tentativas em pouco tempo. Tente de novo em 5 min.";
  assert.equal(readableError(429, tooMany), tooMany);
  assert.equal(readableError(429, ""), "Muitas tentativas em pouco tempo. Aguarde um pouco e tente de novo.");
  assert.equal(readableError(413, "file too large — limit is 5 MB"), "Arquivo grande demais: o limite é 5 MB.");
  assert.equal(readableError(500, "Erro 500"), "Algo deu errado no servidor. Tente novamente em instantes.");
  assert.equal(readableError(503, "WhatsApp is not configured on this server"), "Este serviço está indisponível agora. Tente novamente mais tarde.");
});
