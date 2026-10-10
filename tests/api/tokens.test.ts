import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

// L-12 (UI-01): the dashboard's tokens live in one file, apps/dashboard/src/styles/tokens.css — the palette asked for (warm
// off-white, white surface, #626266 secondary text, brand #732009, the accent decorative only), the HIG type scale in rem,
// spacing, radii, elevation and motion; and every text color reads 4.5:1 or more on every surface, light and dark.
const ROOT = new URL("../../", import.meta.url);
const css = readFileSync(new URL("apps/dashboard/src/styles/tokens.css", ROOT), "utf8");
const block = (selector: string) => {
  const body = css.slice(css.indexOf(`${selector} {`)).split(/\n}/)[0].replace(/\/\*[\s\S]*?\*\//g, "");
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, k, v]) => [k, v.trim()]));
};
const light = block(":root");
const dark = { ...light, ...block(".dark") };

const hex = (h: string) => (h.replace("#", "").match(/../g) ?? []).map((x) => parseInt(x, 16));
const lum = (h: string) => hex(h).map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((t, v, i) => t + v * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

test("L-12 · tokens num arquivo só: paleta, escala de tipo da HIG em rem, espaçamento, raios, elevação e movimento", () => {
  assert.deepEqual([light.bg, light.surface, light.ink2, light.brand, light.sec], ["#FAF7F2", "#FFFFFF", "#626266", "#732009", "#CD8C52"]);
  assert.ok(lum(light.surface2) < lum(light.bg), "superfície secundária um pouco mais escura que o fundo");
  assert.ok(ratio(light.ink, "#020304") < 1.2, "texto principal próximo de #020304");
  assert.equal(dark.bg, "#020304");
  assert.ok(lum(dark.surface) < lum(dark.surface2) && lum(dark.surface2) < lum(dark.surface3), "escuro: superfícies em camadas");
  for (const name of ["caption", "footnote", "subheadline", "body", "headline", "title3", "title2", "title1", "largeTitle"]) {
    assert.match(light[`text-${name}`] ?? "", /^[\d.]+rem$/, `--text-${name} em rem`);
  }
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((n) => light[`space-${n}`]), ["4px", "8px", "12px", "16px", "24px", "32px", "48px"]);
  assert.deepEqual([light["radius-control"], light["radius-card"], light["radius-sheet"], light["radius-pill"]], ["8px", "12px", "16px", "999px"]);
  assert.deepEqual([light["dur-fast"], light.dur, light["dur-slow"], light.ease], ["150ms", "200ms", "250ms", "cubic-bezier(0.2, 0, 0, 1)"]);
  assert.deepEqual([light["icon-sm"], light["icon-md"], light["icon-lg"]], ["1rem", "1.25rem", "1.5rem"]);
  assert.ok(light["shadow-float"] && light.shadow1 === "none", "sombra só no que flutua");
});

test("L-12 · todo texto a 4,5:1 ou mais em toda superfície, claro e escuro; o acento nunca é cor de texto", () => {
  const wrong: string[] = [];
  for (const [theme, t] of [["claro", light], ["escuro", dark]] as const) {
    for (const ink of ["ink", "ink2", "ink3", "brandText", "secText", "ok", "warn", "alert"]) {
      for (const surface of ["bg", "surface", "surface2", "surface3"]) {
        const r = ratio(t[ink], t[surface]);
        if (r < 4.5) wrong.push(`${theme}: --${ink} em --${surface} ${r.toFixed(2)}:1`);
      }
    }
    if (ratio(t.brandInk, t.brand) < 4.5) wrong.push(`${theme}: --brandInk em --brand`);
  }
  assert.deepEqual(wrong, []);
  // --sec as a text color anywhere in the dashboard (CSS or inline styles); a decorative icon next to its text (<i>) may use it.
  const files = readdirSync(new URL("apps/dashboard/src", ROOT), { recursive: true, encoding: "utf8" }).filter((f) => /\.(tsx?|css)$/.test(f));
  const asText = files.flatMap((f) =>
    readFileSync(new URL(`apps/dashboard/src/${f.replaceAll("\\", "/")}`, ROOT), "utf8")
      .split("\n")
      .flatMap((line, i) => (/(^|[^-])color:\s*["']?var\(--sec\)/.test(line) && !/<i\b/.test(line) ? [`${f}:${i + 1}`] : []))
  );
  assert.deepEqual(asText, [], "--sec como cor de texto");
});
