import { useEffect, useMemo, useState } from "react";
import type { MenuCategory, MenuItem } from "@cardapio/shared";
import { api } from "../lib/api";
import { brl } from "../lib/format";
import { useDashboardState } from "../state/DashboardStateContext";
import { EmptyState } from "../components/EmptyState";

interface DraftExtra {
  name: string;
  price: string;
}

interface Draft {
  id: string | null;
  name: string;
  desc: string;
  price: string;
  categoryId: string;
  lunch: string;
  dinner: string;
  extras: DraftExtra[];
}

const EMPTY_DRAFT: Draft = { id: null, name: "", desc: "", price: "", categoryId: "", lunch: "11:00 – 15:00", dinner: "18:00 – 23:00", extras: [] };

export default function MenuScreen() {
  const { notify } = useDashboardState();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState("Todas");
  const [drawer, setDrawer] = useState<Draft | null>(null);

  const reload = () => Promise.all([api.listCategories(), api.listItems()]).then(([c, i]) => {
    setCategories(c);
    setItems(i);
    setLoading(false);
  });

  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((m) => (activeCat === "Todas" || m.categoryName === activeCat) && (!q || m.name.toLowerCase().includes(q)));
  }, [items, query, activeCat]);

  const groups = categories
    .filter((c) => filtered.some((m) => m.categoryId === c.id))
    .map((c) => ({ cat: c, items: filtered.filter((m) => m.categoryId === c.id) }));

  const openNew = () => setDrawer({ ...EMPTY_DRAFT, categoryId: categories[0]?.id || "" });
  const openEdit = (m: MenuItem) =>
    setDrawer({
      id: m.id,
      name: m.name,
      desc: m.shortDescription,
      price: m.price.toFixed(2).replace(".", ","),
      categoryId: m.categoryId,
      lunch: "11:00 – 15:00",
      dinner: "18:00 – 23:00",
      extras: m.optionGroups[0]?.options.map((o) => ({ name: o.label, price: o.priceDelta.toFixed(2).replace(".", ",") })) || []
    });

  const save = async () => {
    if (!drawer) return;
    const price = Number(drawer.price.replace(/\./g, "").replace(",", ".")) || 0;
    const payload = {
      categoryId: drawer.categoryId,
      name: drawer.name || "Novo item",
      shortDescription: drawer.desc,
      price,
      scheduleLabel: `Almoço ${drawer.lunch} · Jantar ${drawer.dinner}`,
      extras: drawer.extras.map((x) => ({ name: x.name, priceDelta: Number(x.price.replace(",", ".")) || 0 }))
    };
    try {
      if (drawer.id) await api.updateItem(drawer.id, payload);
      else await api.createItem(payload);
      setDrawer(null);
      notify("Produto salvo e publicado no cardápio");
      reload();
    } catch {
      notify("Não foi possível salvar o produto");
    }
  };

  const toggleAvailable = async (m: MenuItem) => {
    try {
      const updated = await api.updateItem(m.id, { soldOut: !m.soldOut });
      setItems((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
      notify(m.name + (m.soldOut ? " disponível novamente" : " marcado esgotado"));
    } catch {
      notify("Não foi possível atualizar a disponibilidade");
    }
  };

  const duplicate = async (m: MenuItem) => {
    try {
      await api.duplicateItem(m.id);
      notify(`"${m.name}" duplicado como rascunho`);
      reload();
    } catch {
      notify("Não foi possível duplicar o produto");
    }
  };

  const moveItem = async (m: MenuItem, dir: "up" | "down") => {
    try {
      await api.moveItem(m.id, dir);
      reload();
    } catch {
      // ignore edge (already first/last)
    }
  };

  const moveCat = async (c: MenuCategory, dir: "up" | "down") => {
    try {
      await api.moveCategory(c.id, dir);
      notify(`Categoria ${c.name} movida para ${dir === "up" ? "cima" : "baixo"}`);
      reload();
    } catch {
      // ignore
    }
  };

  const catPills = ["Todas", ...categories.map((c) => c.name)];

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="skeleton" style={{ height: 44 }} />
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 9, padding: "8px 11px", width: 250 }}>
          <i className="fa-solid fa-magnifying-glass" style={{ fontSize: 18, lineHeight: 1, color: "var(--ink3)" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar produto" style={{ border: 0, background: "transparent", outline: "none", font: "inherit", fontSize: 13, color: "var(--ink)", width: "100%", minWidth: 0 }} />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {catPills.map((c) => {
            const active = activeCat === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setActiveCat(c)}
                style={{ borderRadius: 20, padding: "6px 13px", cursor: "pointer", fontSize: 12.5, fontWeight: 500, background: active ? "var(--brandSoft)" : "transparent", color: active ? "var(--brandText)" : "var(--ink2)", border: `1px solid ${active ? "var(--brand)" : "var(--line)"}` }}
              >
                {c}
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1 }} />
        <div className="mono" style={{ fontSize: 12, color: "var(--ink3)" }}>
          {filtered.length} de {items.length} produtos
        </div>
        <button type="button" className="btn btn-primary" onClick={openNew}>
          <i className="fa-solid fa-plus" style={{ fontSize: 18, lineHeight: 1 }} />
          Novo produto
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon="fa-utensils"
          title="Seu cardápio ainda está vazio"
          sub="Cadastre o primeiro produto para que ele apareça no cardápio digital e possa ser pedido nas mesas e no delivery."
          action={
            <button type="button" className="btn btn-primary" onClick={openNew}>
              <i className="fa-solid fa-plus" style={{ fontSize: 18, lineHeight: 1 }} />
              Criar primeiro produto
            </button>
          }
        />
      ) : (
        groups.map((g) => (
          <section key={g.cat.id} className="card" style={{ overflowX: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", background: "var(--surface2)", borderBottom: "1px solid var(--line)", minWidth: 820 }}>
              <i className="fa-solid fa-grip-vertical" style={{ fontSize: 18, lineHeight: 1, color: "var(--ink3)", cursor: "grab" }} />
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{g.cat.name}</div>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink3)", background: "var(--surface3)", borderRadius: 20, padding: "1px 8px" }}>
                {g.items.length}
              </span>
              <div style={{ flex: 1 }} />
              <button type="button" title="Subir categoria" className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => moveCat(g.cat, "up")}>
                <i className="fa-solid fa-angle-up" style={{ fontSize: 16, lineHeight: 1 }} />
              </button>
              <button type="button" title="Descer categoria" className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => moveCat(g.cat, "down")}>
                <i className="fa-solid fa-angle-down" style={{ fontSize: 16, lineHeight: 1 }} />
              </button>
            </div>
            {g.items.map((m) => (
              <div key={m.id} style={{ display: "grid", gridTemplateColumns: "28px 58px minmax(190px,1fr) 96px 150px 118px 68px", gap: 12, alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--line)", minWidth: 820 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <button type="button" onClick={() => moveItem(m, "up")} style={{ height: 14, background: "transparent", border: 0, color: "var(--ink3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                    <i className="fa-solid fa-chevron-up" style={{ fontSize: 15, lineHeight: 1 }} />
                  </button>
                  <button type="button" onClick={() => moveItem(m, "down")} style={{ height: 14, background: "transparent", border: 0, color: "var(--ink3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                    <i className="fa-solid fa-chevron-down" style={{ fontSize: 15, lineHeight: 1 }} />
                  </button>
                </div>
                <div
                  style={{
                    height: 44,
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    background: "repeating-linear-gradient(135deg,var(--surface2),var(--surface2) 5px,var(--surface3) 5px,var(--surface3) 10px)",
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                    paddingBottom: 3
                  }}
                >
                  <span className="mono" style={{ fontSize: 8, color: "var(--ink3)", letterSpacing: ".04em" }}>
                    FOTO
                  </span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "-.01em" }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: "var(--ink3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.shortDescription}</div>
                </div>
                <div className="mono" style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-.02em" }}>
                  {brl(m.price)}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink2)" }}>
                  <i className="fa-solid fa-clock" style={{ fontSize: 15, lineHeight: 1, color: "var(--ink3)" }} />
                  {m.scheduleLabel}
                </div>
                <button type="button" onClick={() => toggleAvailable(m)} style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: 0, cursor: "pointer", font: "inherit", padding: 0 }}>
                  <span className="toggle-track" style={{ background: m.soldOut ? "var(--line2)" : "var(--ok)" }}>
                    <span className="toggle-knob" style={{ left: m.soldOut ? 2 : 16 }} />
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: m.soldOut ? "var(--ink3)" : "var(--ok)" }}>{m.soldOut ? "Esgotado" : "Disponível"}</span>
                </button>
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button type="button" title="Duplicar" className="icon-btn" onClick={() => duplicate(m)}>
                    <i className="fa-solid fa-copy" style={{ fontSize: 16, lineHeight: 1 }} />
                  </button>
                  <button type="button" title="Editar" className="icon-btn" onClick={() => openEdit(m)}>
                    <i className="fa-solid fa-pen" style={{ fontSize: 16, lineHeight: 1 }} />
                  </button>
                </div>
              </div>
            ))}
          </section>
        ))
      )}

      {drawer && (
        <div className="drawer-overlay" onClick={() => setDrawer(null)}>
          <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: "1px solid var(--line)", position: "sticky", top: 0, background: "var(--surface)" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-.015em" }}>{drawer.id ? "Editar produto" : "Novo produto"}</div>
                <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>Publicado no cardápio digital ao salvar</div>
              </div>
              <button type="button" className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => setDrawer(null)}>
                <i className="fa-solid fa-xmark" style={{ fontSize: 18, lineHeight: 1 }} />
              </button>
            </div>
            <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  height: 132,
                  borderRadius: 11,
                  border: "1px dashed var(--line2)",
                  background: "repeating-linear-gradient(135deg,var(--surface2),var(--surface2) 6px,var(--surface3) 6px,var(--surface3) 12px)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  color: "var(--ink3)",
                  cursor: "pointer"
                }}
              >
                <i className="fa-solid fa-image" style={{ fontSize: 24, lineHeight: 1 }} />
                <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".06em" }}>
                  ARRASTE A FOTO DO PRATO · 1200×900
                </span>
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="field-label">Nome</span>
                <input className="field" value={drawer.name} onChange={(e) => setDrawer({ ...drawer, name: e.target.value })} placeholder="Ex.: Picanha na chapa" />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="field-label">Descrição</span>
                <textarea className="field" rows={3} value={drawer.desc} onChange={(e) => setDrawer({ ...drawer, desc: e.target.value })} placeholder="O que vem no prato, porção, acompanhamentos" />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span className="field-label">Preço</span>
                  <input className="field mono" value={drawer.price} onChange={(e) => setDrawer({ ...drawer, price: e.target.value })} placeholder="R$ 0,00" />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span className="field-label">Categoria</span>
                  <select className="field" value={drawer.categoryId} onChange={(e) => setDrawer({ ...drawer, categoryId: e.target.value })}>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="field-label">Variações e adicionais</span>
                  <div style={{ flex: 1 }} />
                  <button
                    type="button"
                    onClick={() => setDrawer({ ...drawer, extras: [...drawer.extras, { name: "Novo adicional", price: "0,00" }] })}
                    style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: 0, color: "var(--brandText)", font: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0 }}
                  >
                    <i className="fa-solid fa-plus" style={{ fontSize: 16, lineHeight: 1 }} />
                    Adicionar
                  </button>
                </div>
                {drawer.extras.map((x, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 104px 32px", gap: 8, alignItems: "center" }}>
                    <input
                      className="field"
                      style={{ padding: "8px 10px" }}
                      value={x.name}
                      onChange={(e) => setDrawer({ ...drawer, extras: drawer.extras.map((y, j) => (i === j ? { ...y, name: e.target.value } : y)) })}
                    />
                    <input
                      className="field mono"
                      style={{ padding: "8px 10px" }}
                      value={x.price}
                      onChange={(e) => setDrawer({ ...drawer, extras: drawer.extras.map((y, j) => (i === j ? { ...y, price: e.target.value } : y)) })}
                    />
                    <button type="button" className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => setDrawer({ ...drawer, extras: drawer.extras.filter((_, j) => j !== i) })}>
                      <i className="fa-solid fa-trash" style={{ fontSize: 16, lineHeight: 1 }} />
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 13, border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface2)" }}>
                <div className="field-label">Agendamento de disponibilidade</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink2)" }}>
                    Almoço
                    <input className="field mono" style={{ padding: "8px 10px", fontSize: 12.5 }} value={drawer.lunch} onChange={(e) => setDrawer({ ...drawer, lunch: e.target.value })} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink2)" }}>
                    Jantar
                    <input className="field mono" style={{ padding: "8px 10px", fontSize: 12.5 }} value={drawer.dinner} onChange={(e) => setDrawer({ ...drawer, dinner: e.target.value })} />
                  </label>
                </div>
              </div>
            </div>
            <div style={{ marginTop: "auto", display: "flex", gap: 10, padding: "14px 20px", borderTop: "1px solid var(--line)", position: "sticky", bottom: 0, background: "var(--surface)" }}>
              <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={save}>
                Salvar produto
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setDrawer(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
