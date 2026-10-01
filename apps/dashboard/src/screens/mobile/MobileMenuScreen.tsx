import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { MenuCategory, MenuItem } from "@cardapio/shared";
import { LEVEL } from "@cardapio/shared";
import { api } from "../../lib/api";
import { myLevel } from "../../lib/modules";
import { brl } from "../../lib/format";
import { useMobileScreen } from "../../components/mobile/MobileLayout";
import { MobileEmptyState } from "../../components/mobile/MobileEmptyState";
import { MobileToggle } from "../../components/mobile/MobileToggle";
import { ActionSheet } from "../../components/mobile/ActionSheet";
import { LinkDishModal } from "../../components/LinkDishModal";
import { categoryActions } from "../MenuScreen";

export default function MobileMenuScreen() {
  // Funcionário (garçom, cozinha) only flips Esgotado/Disponível; adding, editing and removing dishes is Administrador+.
  const canEdit = myLevel() >= LEVEL.ADMINISTRADOR;
  const navigate = useNavigate();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [reorderOn, setReorderOn] = useState(false);
  const [openCats, setOpenCats] = useState<string[]>([]);
  const [menuFor, setMenuFor] = useState<MenuItem | null>(null);
  const [linking, setLinking] = useState(false);

  const { notify } = useMobileScreen({
    title: "Cardápio",
    subtitle: `${items.length} ${items.length === 1 ? "prato" : "pratos"} em ${categories.length} ${categories.length === 1 ? "categoria" : "categorias"}`,
    fab: items.length > 0 && canEdit ? { label: "Adicionar prato", onClick: () => setLinking(true) } : undefined
  });

  const cats = categoryActions(notify, () => reload());
  const reload = () =>
    Promise.all([api.listCategories(), api.listItems()]).then(([c, i]) => {
      setCategories(c);
      setItems(i);
      setLoaded(true);
      setOpenCats((prev) => (prev.length ? prev : c.map((cat) => cat.id)));
    });

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
  }, [items, query]);

  const groups = categories.filter((c) => filtered.some((i) => i.categoryId === c.id)).map((c) => ({ cat: c, items: filtered.filter((i) => i.categoryId === c.id) }));

  const toggleCat = (id: string) => setOpenCats((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleAvailable = async (m: MenuItem) => {
    try {
      const updated = await api.setSoldOut(m.id, !m.soldOut);
      setItems((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
      notify(m.name + (m.soldOut ? " disponível novamente" : " marcado como esgotado"));
    } catch {
      notify("Não foi possível atualizar a disponibilidade");
    }
  };

  const moveCat = async (c: MenuCategory, dir: "up" | "down") => {
    try {
      await api.moveCategory(c.id, dir);
      reload();
    } catch {
      // already first/last
    }
  };

  /** Takes the dish off the menu; the catalog product stays. Photo, description and adicionais go with it, hence the confirm. */
  const unlink = async (m: MenuItem) => {
    setMenuFor(null);
    if (!window.confirm(`Remover "${m.name}" do cardápio? O cadastro continua no Catálogo, mas foto, descrição e adicionais do prato serão perdidos.`)) return;
    try {
      await api.deleteItem(m.id);
      notify(`"${m.name}" removido do cardápio`);
      reload();
    } catch {
      notify("Não foi possível remover o prato");
    }
  };

  if (!loaded) {
    return (
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 11 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 130 }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--bg)", padding: "11px 12px 9px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 9, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 11, padding: "0 12px", minHeight: 44 }}>
          <i className="fa-solid fa-magnifying-glass" style={{ fontSize: 14, color: "var(--ink3)" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar prato" style={{ border: 0, background: "transparent", outline: "none", font: "inherit", fontSize: 13.5, color: "var(--ink)", width: "100%", minWidth: 0 }} />
        </div>
        {canEdit && <button
          type="button"
          onClick={() => setReorderOn((v) => !v)}
          title="Reordenar categorias"
          style={{ width: 44, height: 44, flex: "0 0 44px", borderRadius: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: reorderOn ? "var(--brandSoft)" : "var(--surface2)", color: reorderOn ? "var(--brandText)" : "var(--ink2)", border: `1px solid ${reorderOn ? "var(--brand)" : "var(--line)"}` }}
        >
          <i className="fa-solid fa-grip-vertical" style={{ fontSize: 15 }} />
        </button>}
      </div>

      <div style={{ padding: "12px 12px 90px", display: "flex", flexDirection: "column", gap: 10 }}>
        {reorderOn && (
          <div style={{ background: "var(--surface)", border: "1px dashed var(--sec)", borderRadius: 13, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", fontSize: 12, color: "var(--ink2)", borderBottom: "1px solid var(--line)" }}>
              <span style={{ flex: 1 }}>Use as setas para reordenar as categorias.</span>
              <button type="button" className="btn btn-outline" style={{ minHeight: 40, padding: "0 12px", fontSize: 12.5 }} onClick={cats.create}>
                <i className="fa-solid fa-plus" style={{ fontSize: 12 }} />
                Nova categoria
              </button>
            </div>
            {categories.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderBottom: "1px solid var(--line)", minHeight: 52 }}>
                <i className="fa-solid fa-grip-vertical" style={{ fontSize: 15, color: "var(--ink3)" }} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                <button type="button" aria-label={`Renomear categoria ${c.name}`} onClick={() => cats.rename(c)} style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid var(--line2)", background: "var(--surface2)", color: "var(--ink2)", cursor: "pointer" }}>
                  <i className="fa-solid fa-pen" style={{ fontSize: 13 }} />
                </button>
                <button type="button" aria-label={`Excluir categoria ${c.name}`} onClick={() => cats.remove(c)} style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid var(--line2)", background: "var(--surface2)", color: "var(--ink2)", cursor: "pointer" }}>
                  <i className="fa-solid fa-trash" style={{ fontSize: 13 }} />
                </button>
                <button type="button" aria-label={`Subir ${c.name}`} onClick={() => moveCat(c, "up")} style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid var(--line2)", background: "var(--surface2)", color: "var(--ink2)", cursor: "pointer" }}>
                  <i className="fa-solid fa-angle-up" style={{ fontSize: 14 }} />
                </button>
                <button type="button" aria-label={`Descer ${c.name}`} onClick={() => moveCat(c, "down")} style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid var(--line2)", background: "var(--surface2)", color: "var(--ink2)", cursor: "pointer" }}>
                  <i className="fa-solid fa-angle-down" style={{ fontSize: 14 }} />
                </button>
              </div>
            ))}
          </div>
        )}

        {!reorderOn &&
          groups.map((g) => {
            const open = openCats.includes(g.cat.id);
            const available = g.items.filter((i) => !i.soldOut).length;
            return (
              <section key={g.cat.id} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
                <button type="button" onClick={() => toggleCat(g.cat.id)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: "transparent", border: 0, cursor: "pointer", font: "inherit", color: "var(--ink)", padding: 13, minHeight: 54 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-.015em" }}>{g.cat.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>
                      {g.items.length} {g.items.length === 1 ? "item" : "itens"} · {available} disponíveis
                    </div>
                  </div>
                  <i className={`fa-solid ${open ? "fa-chevron-up" : "fa-chevron-down"}`} style={{ fontSize: 14, color: "var(--ink3)" }} />
                </button>
                {open && (
                  <div style={{ borderTop: "1px solid var(--line)" }}>
                    {g.items.map((p) => (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderBottom: "1px solid var(--line)", minHeight: 62 }}>
                        <div style={{ width: 42, height: 42, flex: "0 0 42px", borderRadius: 10, background: "repeating-linear-gradient(135deg,var(--surface2),var(--surface2) 5px,var(--surface3) 5px,var(--surface3) 10px)", border: "1px solid var(--line)" }} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: p.soldOut ? "var(--ink3)" : "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <span className="mono" style={{ fontSize: 12.5, fontWeight: 600 }}>
                              {brl(p.price)}
                            </span>
                            <span style={{ fontSize: 11, color: "var(--ink3)" }}>{p.scheduleLabel}</span>
                          </div>
                        </div>
                        <MobileToggle on={!p.soldOut} onClick={() => toggleAvailable(p)} title={p.soldOut ? "Disponível" : "Esgotado"} label={`${p.name} disponível`} />
                        {canEdit && (
                          <button type="button" aria-label={`Opções de ${p.name}`} onClick={() => setMenuFor(p)} style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink2)", cursor: "pointer" }}>
                            <i className="fa-solid fa-ellipsis" style={{ fontSize: 14 }} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}

        {!reorderOn && groups.length === 0 && items.length > 0 && (
          <MobileEmptyState icon="fa-magnifying-glass" title="Nenhum prato encontrado" sub="Ajuste a busca para encontrar o prato desejado." />
        )}
        {!reorderOn && items.length === 0 && (
          <MobileEmptyState
            icon="fa-utensils"
            title="Seu cardápio está vazio"
            sub={categories.length ? "Vincule o primeiro prato do Catálogo para começar a receber pedidos." : "Crie as categorias (ex.: Hambúrgueres, Bebidas) e depois vincule os pratos do Catálogo."}
            action={
              canEdit && <button type="button" onClick={() => (categories.length ? setLinking(true) : cats.create())} style={{ minHeight: 48, background: "var(--brand)", color: "var(--brandInk)", border: 0, borderRadius: 12, padding: "0 20px", cursor: "pointer", font: "inherit", fontSize: 13.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                <i className="fa-solid fa-plus" style={{ fontSize: 13 }} />
                {categories.length ? "Adicionar primeiro prato" : "Criar primeira categoria"}
              </button>
            }
          />
        )}
      </div>

      <ActionSheet
        open={!!menuFor}
        onClose={() => setMenuFor(null)}
        title={menuFor?.name ?? ""}
        actions={
          menuFor
            ? [
                { label: "Organizar prato", icon: "fa-pen", onClick: () => navigate(`/cardapio/${menuFor.id}/editar`) },
                { label: "Remover do cardápio", icon: "fa-link-slash", danger: true, onClick: () => unlink(menuFor) }
              ]
            : []
        }
      />
      {linking && <LinkDishModal categories={categories} items={items} onClose={() => setLinking(false)} onLinked={reload} />}
    </div>
  );
}
