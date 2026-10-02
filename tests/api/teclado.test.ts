import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

// Checklist 20: on the phone, each field opens the keyboard it needs — digits for a price, a CNPJ or a quantity, the
// @ keyboard for an e-mail — and the page is a phone page (device width, zoom allowed).
const ROOT = new URL("../../", import.meta.url);
const NUMERIC = /^(price|value|amount|qty|quantity|cnpj|ncm|cst|usageLimit|comboPrice|taxRate|day|people)$/;

function inputs() {
  const found: { at: string; attrs: string; field: string }[] = [];
  for (const app of ["apps/dashboard/src", "apps/web/src"]) {
    for (const f of readdirSync(new URL(app, ROOT), { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".tsx"))) {
      const code = readFileSync(new URL(`${app}/${f.replaceAll("\\", "/")}`, ROOT), "utf8");
      for (const m of code.matchAll(/<input\b([\s\S]*?)\/>/g)) {
        const field = m[1].match(/value=\{([\w.]+)\}/)?.[1].split(".").pop() ?? "";
        found.push({ at: `${app}/${f}:${code.slice(0, m.index).split("\n").length}`, attrs: m[1], field });
      }
    }
  }
  return found;
}

test("campo de número abre o teclado numérico; campo de e-mail, o de e-mail; senha é senha", () => {
  const all = inputs();
  assert.ok(all.length > 60, `${all.length} campos`);
  for (const { at, attrs, field } of all) {
    if (NUMERIC.test(field)) assert.match(attrs, /inputMode="(numeric|decimal)"|type="number"/, `${at} (${field})`);
    if (/email/i.test(field)) assert.match(attrs, /type="email"/, `${at} (${field})`);
    if (/password|^current$|^next$|^repeat$|keyDraft/.test(field)) assert.match(attrs, /type="password"/, `${at} (${field})`);
  }
});

test("as duas páginas têm viewport de celular e deixam dar zoom", () => {
  for (const app of ["dashboard", "web"]) {
    const viewport = readFileSync(new URL(`apps/${app}/index.html`, ROOT), "utf8").match(/<meta name="viewport" content="([^"]+)"/)?.[1] ?? "";
    assert.match(viewport, /width=device-width/, app);
    assert.match(viewport, /initial-scale=1/, app);
    assert.doesNotMatch(viewport, /user-scalable=no|maximum-scale/, app);
  }
});
