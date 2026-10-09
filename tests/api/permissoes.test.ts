import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer, request } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { ADMIN_KEY, login } from "./helpers.ts";

// Item 9: scripts/conferir-permissoes.mjs against this API, through a proxy that writes down every request. It calls only GET
// (never POST, PUT, PATCH or DELETE), and on the seed's Chapa 27 nothing answers differently from the matrix (item 10).
const API = new URL(process.env.API_URL ?? "http://localhost:4200");

test("conferir-permissoes: só GET, todas as colunas, e nenhuma divergência na pilha do seed (Chapa 27)", async () => {
  const methods: string[] = [];
  const proxy = createServer((req, res) => {
    methods.push(req.method ?? "?");
    const forward = request({ host: API.hostname, port: API.port, path: req.url, method: req.method, headers: req.headers }, (answer) => {
      res.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(res);
    });
    req.pipe(forward);
  });
  await new Promise<void>((ok) => proxy.listen(0, "127.0.0.1", ok));
  const [cozinha, garcom, gerente, dono] = await Promise.all(["cozinha", "garcom", "gerente", "dono"].map((u) => login(`${u}@chapa27.example`)));
  const env = {
    ...process.env,
    PERMISSOES_URL: `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`,
    PERMISSOES_TOKEN_COZINHA: cozinha,
    PERMISSOES_TOKEN_GARCOM: garcom,
    PERMISSOES_TOKEN_ADMINISTRADOR: gerente,
    PERMISSOES_TOKEN_DONO: dono,
    PERMISSOES_SUPER_ADMIN_KEY: ADMIN_KEY
  };
  // Not spawnSync: the proxy answers from this same process.
  const run = await new Promise<{ code: number | null; out: string }>((done) => {
    const child = spawn(process.execPath, ["scripts/conferir-permissoes.mjs"], { env });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("exit", (code) => done({ code, out }));
  });
  proxy.close();

  assert.ok(methods.length > 150, `${methods.length} chamadas`);
  assert.deepEqual([...new Set(methods)], ["GET"], "só GET");
  assert.match(run.out, / 0 divergência\(s\) /, run.out);
  assert.doesNotMatch(run.out, /Sem token/, "as seis colunas conferidas");
  assert.equal(run.code, 0, run.out);
});
