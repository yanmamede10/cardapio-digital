import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

// UX-03: the accessibility half of the screen sweep (varredura.spec.ts). Two checks per screen:
// - axe-core with the WCAG 2.0/2.1 A and AA rules: contrast 4.5:1 (3:1 for large text), a name for every button, link,
//   image and field, and the rest of the automatable AA rules;
// - touch targets of at least 44 × 44 (Apple HIG: 44 pt; one CSS px is one pt), which axe doesn't measure at that size.

/** Everything a finger or pointer can act on. */
const TARGETS = "button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=switch], [role=tab], [role=radio], [role=checkbox], [role=menuitem], [role=option]";

/** Returns what's wrong on the page as it is now, one line per problem (empty = fine). */
export async function a11yProblems(page: Page, where: string): Promise<string[]> {
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  // The first node's own message says why (for contrast: both colors and the ratio found).
  const why = (v: (typeof axe.violations)[number]) => v.nodes[0]?.any[0]?.message ?? v.help;
  const problems = axe.violations.map((v) => `${where}: ${v.id} × ${v.nodes.length} — ${v.nodes.slice(0, 4).map((n) => n.target.join(" ")).join(" | ")} — ${why(v)}`);
  const small = await page.evaluate((selector) => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      // A checkbox/radio is acted on through its label: the label is the target.
      const target = (el as HTMLInputElement).type === "checkbox" || (el as HTMLInputElement).type === "radio" ? el.closest("label") ?? el : el;
      const r = target.getBoundingClientRect();
      const style = getComputedStyle(target);
      if (!r.width || !r.height || style.visibility === "hidden" || style.display === "none" || target.closest("[aria-hidden=true], [inert]")) continue;
      if (r.width >= 43.5 && r.height >= 43.5) continue;
      const name = (target.getAttribute("aria-label") || target.textContent || target.getAttribute("title") || target.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
      out.push(`${Math.round(r.width)}×${Math.round(r.height)} "${name}"`);
    }
    return out;
  }, TARGETS);
  if (small.length) problems.push(`${where}: alvo < 44×44 × ${small.length} — ${[...new Set(small)].slice(0, 6).join(" | ")}`);
  return problems;
}
