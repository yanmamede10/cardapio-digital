import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { MenuCategory, MenuItem } from "@cardapio/shared";
import { api } from "../../lib/api";
import { brl } from "../../lib/format";
import { useMobileScreen } from "../../components/mobile/MobileLayout";
import { MobileEmptyState } from "../../components/mobile/MobileEmptyState";
import { MobileToggle } from "../../components/mobile/MobileToggle";
import { ActionSheet } from "../../components/mobile/ActionSheet";

export default function MobileMenuScreen() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [reorderOn, setReorderOn] = useState(false);
  const [openCats, setOpenCats] = useState<string[]>([]);
  const [menuFor, setMenuFor] = useState<MenuItem | null>(null);

  const { notify } = useMobileScreen({
    title: "Cardápio",
    subtitle: `${items.length} ${items.length === 1 ? "item" : "itens"} em ${categories.length} ${categories.length === 1 ? "categoria" : "categorias"}`,
    fab: items.length > 0 ? { label: "Novo produto", onClick: () => navigate("/cardapio/novo") } : undefined
  });

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
      const updated = await api.updateItem(m.id, { soldOut: !m.soldOut });
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

  const duplicate = async (m: MenuItem) => {
    setMenuFor(null);
    try {
      await api.duplicateItem(m.id);
      notify(`"${m.name}" duplicado como rascunho`);
      reload();
    } catch {
      notify("Não foi possível duplicar o produto");
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
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar produto" style={{ border: 0, background: "transparent", outline: "none", font: "inherit", fontSize: 13.5, color: "var(--ink)", width: "100%", minWidth: 0 }} />
        </div>
        <button
          type="button"
          onClick={() => setReorderOn((v) => !v)}
          title="Reordenar categorias"
          style={{ width: 44, height: 44, flex: "0 0 44px", borderRadius: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: reorderOn ? "var(--brandSoft)" : "var(--surface2)", color: reorderOn ? "var(--brandText)" : "var(--ink2)", border: `1px solid ${reorderOn ? "var(--brand)" : "var(--line)"}` }}
        >
          <i className="fa-solid fa-grip-vertical" style={{ fontSize: 15 }} />
        </button>
      </div>

      <div style={{ padding: "12px 12px 90px", display: "flex", flexDirection: "column", gap: 10 }}>
        {reorderOn && (
          <div style={{ background: "var(--surface)", border: "1px dashed var(--sec)", borderRadius: 13, overflow: "hidden" }}>
            <div style={{ padding: "10px 13px", fontSize: 12, color: "var(--ink2)", borderBottom: "1px solid var(--line)" }}>Use as setas para reordenar as categorias.</div>
            {categories.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderBottom: "1px solid var(--line)", minHeight: 52 }}>
                <i className="fa-solid fa-grip-vertical" style={{ fontSize: 15, color: "var(--ink3)" }} />
                <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{c.name}</div>
                <button type="button" onClick={() => moveCat(c, "up")} style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid var(--line2)", background: "var(--surface2)", color: "var(--ink2)", cursor: "pointer" }}>
                  <i className="fa-solid fa-angle-up" style={{ fontSize: 14 }} />
                </button>
                <button type="button" onClick={() => moveCat(c, "down")} style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid var(--line2)", background: "var(--surface2)", color: "var(--ink2)", cursor: "pointer" }}>
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
                        <MobileToggle on={!p.soldOut} onClick={() => toggleAvailable(p)} title={p.soldOut ? "Disponível" : "Esgotado"} />
                        <button type="button" onClick={() => setMenuFor(p)} style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink2)", cursor: "pointer" }}>
                          <i className="fa-solid fa-ellipsis" style={{ fontSize: 14 }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}

        {!reorderOn && groups.length === 0 && items.length > 0 && (
          <MobileEmptyState icon="fa-magnifying-glass" title="Nenhum produto encontrado" sub="Ajuste a busca para encontrar o item desejado." />
        )}
        {!reorderOn && items.length === 0 && (
          <MobileEmptyState
            icon="fa-utensils"
            title="Seu cardápio está vazio"
            sub="Cadastre o primeiro produto para começar a receber pedidos pelo QR code das mesas."
            action={
              <button type="button" onClick={() => navigate("/cardapio/novo")} style={{ minHeight: 48, background: "var(--brand)", color: "var(--brandInk)", border: 0, borderRadius: 12, padding: "0 20px", cursor: "pointer", font: "inherit", fontSize: 13.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                <i className="fa-solid fa-plus" style={{ fontSize: 13 }} />
                Criar primeiro produto
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
                { label: "Editar produto", icon: "fa-pen", onClick: () => navigate(`/cardapio/${menuFor.id}/editar`) },
                { label: "Duplicar produto", icon: "fa-copy", onClick: () => duplicate(menuFor) }
              ]
            : []
        }
      />
    </div>
  );
}
