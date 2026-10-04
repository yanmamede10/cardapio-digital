import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { test } from "node:test";

// G-7: tests/run.mjs refuses to run with :4200 taken — an API left from an earlier run used to answer its health check in
// place of the new one. Inside `npm test` the suite's own API holds the port; run alone, this test takes it itself.
test("run.mjs falha com mensagem clara se a porta 4200 estiver ocupada, antes de subir banco ou API", async () => {
  const own = createServer();
  await new Promise<void>((resolve) => own.once("error", () => resolve()).listen(4200, "127.0.0.1", () => resolve()));
  try {
    const run = spawnSync(process.execPath, ["tests/run.mjs", "api"], { cwd: new URL("../../", import.meta.url), encoding: "utf8", timeout: 30_000 });
    assert.equal(run.status, 1, `${run.stdout}${run.stderr}`);
    assert.match(run.stderr, /A porta 4200 está ocupada/);
    assert.doesNotMatch(run.stdout, /Postgres de teste/, "recusou antes de mexer no banco");
  } finally {
    own.close();
  }
});
