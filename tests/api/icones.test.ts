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

// Checklist 4: the APKs (dashboard and cardápio) carry the platform's mark — the one logo file, like the dashboard's sidebar
// and the favicon — not the icons of Capacitor's Android template (their MD5s below, as `cap add android` writes them).
const CAPACITOR_TEMPLATE_ICONS = new Set(["7ed1b3739b83215d0c4a0b4a7f2dcab4", "a49547a32c7d9b529af607b033811d81", "5b77e8aec8b17eed320a97567c7cb8bf", "1956941339dd5fe36d5c66601c89a08d", "f43e5674865a00186dd76183cf1f2f8e", "73b1e06d769fa08a9c3b8328cc15fd75", "5689511ee4e41a367d0342f37ac48bdf", "c890fa4af62a63486d5dea62441ce7ab", "15cdded29b9877ac98c5931024c5da5d", "a3285eeaedda8201f04e7737b9df8421", "14cde87848553e24d7106f56eb8ceb6f", "4e9584ecc16d1fc75afb798688ce576f", "9e029293ab1ae8e3a6a7b7d0b7177e46", "85addb4159ecd3f76f02fbacd5ec86de", "ed3696b7c52d9747411a475dbe3fa34a"]);
test("APK do painel e do cardápio: ícone da plataforma, não o do modelo do Capacitor; fundo do ícone adaptativo na cor da marca", async () => {
  const { createHash } = await import("node:crypto");
  for (const app of ["dashboard", "web"]) {
    const res = `apps/${app}/android/app/src/main/res`;
    for (const density of ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"]) {
      for (const name of ["ic_launcher", "ic_launcher_round", "ic_launcher_foreground"]) {
        const png = readFileSync(new URL(`${res}/mipmap-${density}/${name}.png`, ROOT));
        assert.equal(CAPACITOR_TEMPLATE_ICONS.has(createHash("md5").update(png).digest("hex")), false, `${app} ${density} ${name}`);
      }
    }
    assert.match(read(`${res}/values/ic_launcher_background.xml`), /<color name="ic_launcher_background">#732009<\/color>/, app);
  }
});

// L-11: one logo file for everything — the dashboard's Logo component, both favicons and the APK icons, rendered from it by
// scripts/gerar-icones.mjs, which writes the logo's hash next to it. A new logo.svg without new icons fails here.
test("logo num lugar só: Logo, os dois favicons e os ícones dos APKs vêm de packages/shared/brand/logo.svg", async () => {
  const { createHash } = await import("node:crypto");
  const logo = readFileSync(new URL("packages/shared/brand/logo.svg", ROOT), "utf8").replaceAll("\r\n", "\n"); // a Windows checkout may have CRLF
  assert.equal(read("scripts/icones.sha256").trim(), createHash("sha256").update(logo).digest("hex"), "rode node scripts/gerar-icones.mjs");
  for (const app of ["dashboard", "web"]) {
    assert.match(read(`apps/${app}/vite.config.ts`), /publicDir: "\.\.\/\.\.\/packages\/shared\/brand"/, app); // served as /logo.svg
    assert.match(read(`apps/${app}/index.html`), /<link rel="icon" type="image\/svg\+xml" href="\/logo\.svg" \/>/, app);
  }
  assert.match(read("apps/dashboard/src/components/Logo.tsx"), /src=\{`\$\{import\.meta\.env\.BASE_URL\}logo\.svg`\}/);
  // Nobody draws the mark by hand any more: the "MP" text lived in the sidebar and the phone's header.
  const drawn = sources("apps/dashboard/src").filter((s) => />\s*MP\s*</.test(s));
  assert.deepEqual(drawn, []);
});
