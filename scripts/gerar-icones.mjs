// node scripts/gerar-icones.mjs — the APK launcher icons (dashboard and cardápio, every density) rendered from the platform's
// one logo file, packages/shared/brand/logo.svg (item 11), with the Chrome that Playwright already uses. Swap the logo, run this,
// commit the PNGs: tests/api/icones.test.ts fails while the PNGs come from another logo (scripts/icones.sha256).
//   ic_launcher        the logo, square
//   ic_launcher_round  the logo in a circle
//   ic_launcher_foreground  the adaptive icon's foreground: the logo inside the 66 dp safe zone of the 108 dp canvas; the
//                      background is the brand color (res/values/ic_launcher_background.xml)
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const ROOT = new URL("../", import.meta.url);
const { chromium } = createRequire(import.meta.url)("@playwright/test");
const svg = readFileSync(new URL("packages/shared/brand/logo.svg", ROOT), "utf8").replaceAll("\r\n", "\n"); // as git stores it, whatever the checkout
const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const KINDS = {
  ic_launcher: { dp: 48, html: (px) => `<img src="${src}" width="${px}" height="${px}">` },
  ic_launcher_round: { dp: 48, html: (px) => `<div style="width:${px}px;height:${px}px;border-radius:50%;overflow:hidden"><img src="${src}" width="${px}" height="${px}" style="transform:scale(1.42)"></div>` },
  ic_launcher_foreground: { dp: 108, html: (px) => `<div style="width:${px}px;height:${px}px;display:grid;place-items:center"><img src="${src}" width="${Math.round((px * 66) / 108)}" height="${Math.round((px * 66) / 108)}"></div>` }
};

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
for (const app of ["dashboard", "web"]) {
  for (const [density, scale] of Object.entries(DENSITIES)) {
    for (const [name, kind] of Object.entries(KINDS)) {
      const px = Math.round(kind.dp * scale);
      await page.setViewportSize({ width: px, height: px });
      await page.setContent(`<body style="margin:0;background:transparent">${kind.html(px)}</body>`);
      await page.locator("img").evaluate((img) => img.decode());
      const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: px, height: px } });
      writeFileSync(new URL(`apps/${app}/android/app/src/main/res/mipmap-${density}/${name}.png`, ROOT), png);
    }
  }
}
await browser.close();
writeFileSync(new URL("scripts/icones.sha256", ROOT), `${createHash("sha256").update(svg).digest("hex")}\n`);
console.log("ícones gerados de packages/shared/brand/logo.svg");
