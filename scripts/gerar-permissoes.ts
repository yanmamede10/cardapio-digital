// npx tsx scripts/gerar-permissoes.ts → docs/seguranca/permissoes.md, the permission matrix (item 8), from the one list of
// routes (tests/api/rotas.mjs) and the screens each role sees (SCREENS, @cardapio/shared — the dashboard's menu reads the same).
// tests/api/autorizacao.test.ts fails when the file isn't what this writes: don't edit the .md by hand.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SCREENS, roleLevel, type StaffRole } from "@cardapio/shared";
import { ROLES, ROUTES, expected, reaches } from "../tests/api/rotas.mjs";

type Rule = (typeof ROUTES)[number][1];
const ROLE_NAME: Record<StaffRole, string> = { kitchen: "Cozinha", waiter: "Garçom", manager: "Administrador", owner: "Dono" };
const PLACE: Record<string, string> = { cliente: "app do cliente", login: "login", admin: "Super Admin", todas: "todas (cabeçalho, sessão)" };

const sees = (role: StaffRole, screen: string) => {
  const s = SCREENS[screen];
  if (!s) throw new Error(`rotas.mjs: tela desconhecida "${screen}"`);
  return s.roles ? s.roles.includes(role) : roleLevel(role) >= s.level;
};
/** The staff roles whose dashboard calls the route: they see one of its screens (and the part of it, after @). */
const uiRoles = (rule: Rule) =>
  (ROLES as StaffRole[]).filter((role) =>
    rule.ui.some((u: string) => {
      if (u === "todas") return true;
      if (u in PLACE) return false;
      const [screen, min] = u.split("@");
      return sees(role, screen) && (!min || reaches(role, min));
    })
  );
/** Roles that reach the route through the API (by the rule) but whose screens never call it. Public and own-login routes are for
 *  anyone by design: only staff and "own" routes count. */
export const unseen = (rule: Rule): StaffRole[] =>
  rule.access === "staff" || rule.access === "own" ? (ROLES as StaffRole[]).filter((r) => expected(rule)[r] === 200 && !uiRoles(rule).includes(r)) : [];

const where = (rule: Rule) => (rule.ui.length ? rule.ui.map((u: string) => PLACE[u] ?? (u.includes("@") ? `${SCREENS[u.split("@")[0]].label} (só ${u.split("@")[1]}+)` : SCREENS[u].label)).join(", ") : "nenhuma");
const MODULE = (m: string | null | undefined) => (m ? m.split("|").map((k) => SCREENS[k]?.label ?? k).join(" ou ") : "—");

export function render(): string {
  const head = "| Método | Caminho | Para que serve | Módulo | Onde aparece | Sem login | Cozinha | Garçom | Administrador | Dono | Super Admin |";
  const rows = ROUTES.map(([route, rule]) => {
    const [method, path] = route.split(" ");
    const e = expected(rule);
    const flagged = unseen(rule);
    const cell = (role: StaffRole) => `${e[role]}${flagged.includes(role) ? " ⚠" : ""}`;
    const module = rule.access === "staff" ? MODULE(rule.module) : "—";
    return `| ${method} | \`${path}\` | ${rule.what} | ${module} | ${where(rule)} | ${e.anon} | ${cell("kitchen")} | ${cell("waiter")} | ${cell("manager")} | ${cell("owner")} | ${e.superadmin} |`;
  });
  const highlights = ROUTES.filter(([, rule]) => unseen(rule).length).map(([route, rule]) => {
    const who = unseen(rule).map((r) => ROLE_NAME[r]).join(", ");
    return `- \`${route}\` (${rule.what}) — ${who}: ${rule.ui.length ? `a tela que chama (${where(rule)}) não aparece para esse papel` : "nenhuma tela do painel chama esta rota"}.`;
  });
  return [
    "# Permissões por rota",
    "",
    "Gerado por `npx tsx scripts/gerar-permissoes.ts` a partir de `tests/api/rotas.mjs` (a lista de rotas do teste de autorização) e de",
    "`SCREENS` (`packages/shared`: quem vê cada tela do painel). Não edite à mão: `tests/api/autorizacao.test.ts` falha se este arquivo",
    "não for o gerado. `scripts/conferir-permissoes.mjs` confere as rotas GET numa pilha no ar (ver README, \"Conferir permissões\").",
    "",
    "**Esperado:** 200 = acessa; 401 = sem login ou credencial que não vale aqui (o token da equipe nas rotas do Super Admin, a chave do",
    "Super Admin nas rotas da equipe); 403 = papel abaixo do mínimo. Com o módulo desligado, toda rota do módulo responde 403, até para o",
    "Dono. Token de outro restaurante: 403 ou 404 em toda rota da equipe. Cozinha e Garçom são o nível Funcionário; o Garçom passa onde a",
    "Cozinha não (Atendimento, Fechar conta).",
    "",
    "**⚠** = o papel acessa pela API algo que a tela dele não mostra (o menu e os botões que ele vê nunca chamam a rota).",
    "",
    head,
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "## Destaques: o papel acessa algo que a tela dele não mostra",
    "",
    ...(highlights.length ? highlights : ["Nenhum."]),
    ""
  ].join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(new URL("../docs/seguranca/permissoes.md", import.meta.url), render());
  console.log("docs/seguranca/permissoes.md");
}
