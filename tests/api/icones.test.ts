import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

// The icons come from each app's src/styles/icons.css (Font Awesome SVGs), not from cdnjs: no app page loads anything from
// another origin, and every fa-* name the app (or the data it shows) uses has its rule there — a missing one is invisible.
const ROOT = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, ROOT), "utf8");
const sources = (dir: string) => readdirSync(new URL(dir, ROOT), { recursive: true, encoding: "utf8" }).filter((f) => /\.tsx?$/.test(f)).map((f) => read(`${dir}/${f.replaceAll("\\", "/")}`));
const NOT_ICONS = new Set(["fa-solid", "fa-regular", "fa-brands", "fa-spin"]);

for (const [app, code] of [
  ["web", [...sources("apps/web/src"), read("apps/api/prisma/seed.ts"), read("apps/api/prisma/seed-demo.ts")]],
  ["dashboard", sources("apps/dashboard/src")]
] as const) {
  test(`${app}: ícones locais, sem cdnjs, e toda classe fa-* usada existe em icons.css`, () => {
    assert.doesNotMatch(read(`apps/${app}/index.html`), /https?:\/\//, "index.html não carrega nada de outra origem");
    const css = read(`apps/${app}/src/styles/icons.css`);
    const used = new Set(code.flatMap((c) => c.match(/fa-[a-z0-9-]+/g) ?? []).filter((n) => !NOT_ICONS.has(n)));
    const missing = [...used].filter((n) => !new RegExp(`\\.${n}\\{--fa`).test(css));
    assert.deepEqual(missing, []);
    assert.ok(used.size > 40, `${used.size} ícones`);
  });
}
