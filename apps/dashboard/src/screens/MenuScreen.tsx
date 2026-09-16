import { useEffect, useMemo, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import type { MenuCategory, MenuItem } from "@cardapio/shared";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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

/** Sortable ids for category rows are prefixed so they never collide with item ids in the shared DndContext. */
const catSortId = (id: string) => `cat-${id}`;

/** Category rows and item rows share one DndContext; scope collisions to same-kind droppables so
 *  dragging a category (a small handle spanning a large distance) can't resolve to a nested item row. */
const scopedCollisionDetection: CollisionDetection = (args) => {
  const isCategoryDrag = String(args.active.id).startsWith("cat-");
  const droppableContainers = args.droppableContainers.filter((c) => String(c.id).startsWith("cat-") === isCategoryDrag);
  return closestCenter({ ...args, droppableContainers });
};

export default function MenuScreen() {
  const { notify } = useDashboardState();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState("Todas");
  const [drawer, setDrawer] = useState<Draft | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

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

  /** Drag replaces the old up/down buttons but calls the exact same move-by-one-step API repeatedly. */
  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith("cat-")) {
      const rawId = activeId.slice(4);
      const oldIndex = categories.findIndex((c) => c.id === rawId);
      const newIndex = categories.findIndex((c) => catSortId(c.id) === overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      const dir: "up" | "down" = newIndex > oldIndex ? "down" : "up";
      const steps = Math.abs(newIndex - oldIndex);
      const cat = categories[oldIndex];
      try {
        for (let i = 0; i < steps; i++) await api.moveCategory(rawId, dir);
        notify(`Categoria ${cat.name} movida para ${dir === "up" ? "cima" : "baixo"}`);
      } catch {
        // ignore edge (already first/last)
      } finally {
        reload();
      }
      return;
    }

    const group = groups.find((g) => g.items.some((m) => m.id === activeId));
    if (!group) return;
    const oldIndex = group.items.findIndex((m) => m.id === activeId);
    const newIndex = group.items.findIndex((m) => m.id === overId);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
    const dir: "up" | "down" = newIndex > oldIndex ? "down" : "up";
    const steps = Math.abs(newIndex - oldIndex);
    try {
      for (let i = 0; i < steps; i++) await api.moveItem(activeId, dir);
    } catch {
      // ignore edge (already first/last)
    } finally {
      reload();
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
        <div style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 13, padding: "9px 14px", width: 250 }}>
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
                className="tap"
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
        <DndContext
          sensors={sensors}
          collisionDetection={scopedCollisionDetection}
          onDragStart={({ active }) => setActiveDragId(String(active.id))}
          onDragEnd={(e) => {
            setActiveDragId(null);
            handleDragEnd(e);
          }}
          onDragCancel={() => setActiveDragId(null)}
        >
          <SortableContext items={groups.map((g) => catSortId(g.cat.id))} strategy={verticalListSortingStrategy}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {groups.map((g) => (
                <CategorySection key={g.cat.id} cat={g.cat} count={g.items.length}>
                  <SortableContext items={g.items.map((m) => m.id)} strategy={verticalListSortingStrategy}>
                    {g.items.map((m) => (
                      <ItemRow key={m.id} item={m} onToggleAvailable={() => toggleAvailable(m)} onDuplicate={() => duplicate(m)} onEdit={() => openEdit(m)} />
                    ))}
                  </SortableContext>
                </CategorySection>
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeDragId?.startsWith("cat-") ? (
              (() => {
                const cat = categories.find((c) => catSortId(c.id) === activeDragId);
                return cat ? <CategoryDragPreview name={cat.name} /> : null;
              })()
            ) : activeDragId ? (
              (() => {
                const m = items.find((it) => it.id === activeDragId);
                return m ? <ItemDragPreview name={m.name} price={brl(m.price)} /> : null;
              })()
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {drawer && (
        <div className="drawer-overlay" onClick={() => setDrawer(null)}>
          <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px 24px", borderBottom: "1px solid var(--glassBd)", position: "sticky", top: 0, background: "var(--glassBg)", backdropFilter: "var(--blur)", WebkitBackdropFilter: "var(--blur)" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-.015em" }}>{drawer.id ? "Editar produto" : "Novo produto"}</div>
                <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>Publicado no cardápio digital ao salvar</div>
              </div>
              <button type="button" className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => setDrawer(null)}>
                <i className="fa-solid fa-xmark" style={{ fontSize: 18, lineHeight: 1 }} />
              </button>
            </div>
            <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
              <div
                style={{
                  height: 132,
                  borderRadius: 15,
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
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 13, border: "1px solid var(--line)", borderRadius: 13, background: "var(--surface2)" }}>
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
            <div style={{ marginTop: "auto", display: "flex", gap: 10, padding: "16px 24px", borderTop: "1px solid var(--glassBd)", position: "sticky", bottom: 0, background: "var(--glassBg)", backdropFilter: "var(--blur)", WebkitBackdropFilter: "var(--blur)" }}>
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

function DragHandle({ ariaLabel, ...rest }: { ariaLabel: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      {...rest}
      style={{ flex: "none", background: "transparent", border: 0, padding: 4, cursor: "grab", color: "var(--ink3)", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none" }}
    >
      <i className="fa-solid fa-grip-vertical" style={{ fontSize: 18, lineHeight: 1 }} />
    </button>
  );
}

function CategoryDragPreview({ name }: { name: string }) {
  return (
    <div className="card" style={{ padding: "13px 18px", boxShadow: "var(--shadow2)", transform: "scale(1.02)", display: "flex", alignItems: "center", gap: 10, fontWeight: 600, fontSize: 13.5 }}>
      <i className="fa-solid fa-grip-vertical" style={{ fontSize: 18, lineHeight: 1, color: "var(--ink3)" }} />
      {name}
    </div>
  );
}

function ItemDragPreview({ name, price }: { name: string; price: string }) {
  return (
    <div className="card" style={{ padding: "13px 18px", boxShadow: "var(--shadow2)", transform: "scale(1.02)", display: "flex", alignItems: "center", gap: 12, minWidth: 280 }}>
      <i className="fa-solid fa-grip-vertical" style={{ fontSize: 18, lineHeight: 1, color: "var(--ink3)" }} />
      <div style={{ flex: 1, fontWeight: 600, fontSize: 13.5 }}>{name}</div>
      <div className="mono" style={{ fontWeight: 600, fontSize: 14 }}>{price}</div>
    </div>
  );
}

function CategorySection({ cat, count, children }: { cat: MenuCategory; count: number; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: catSortId(cat.id) });
  const style: CSSProperties = { overflowX: "auto", transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  return (
    <section ref={setNodeRef} style={style} className="card">
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 18px", background: "var(--surface2)", borderBottom: "1px solid var(--line)", minWidth: 820 }}>
        <DragHandle ariaLabel={`Reordenar categoria ${cat.name}`} {...attributes} {...listeners} />
        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{cat.name}</div>
        <span className="mono" style={{ fontSize: 11, color: "var(--ink3)", background: "var(--surface3)", borderRadius: 20, padding: "1px 8px" }}>
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

function ItemRow({ item: m, onToggleAvailable, onDuplicate, onEdit }: { item: MenuItem; onToggleAvailable: () => void; onDuplicate: () => void; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: m.id });
  const style: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "28px 58px minmax(190px,1fr) 96px 150px 118px 68px",
    gap: 16,
    alignItems: "center",
    padding: "13px 18px",
    borderBottom: "1px solid var(--line)",
    minWidth: 820,
    background: "var(--surface)",
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1
  };
  return (
    <div ref={setNodeRef} style={style}>
      <DragHandle ariaLabel={`Reordenar ${m.name}`} {...attributes} {...listeners} />
      <div
        style={{
          height: 44,
          borderRadius: 12,
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
      <button type="button" onClick={onToggleAvailable} style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: 0, cursor: "pointer", font: "inherit", padding: 0 }}>
        <span className="toggle-track" style={{ background: m.soldOut ? "var(--line2)" : "var(--ok)" }}>
          <span className="toggle-knob" style={{ left: m.soldOut ? 2 : 16 }} />
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: m.soldOut ? "var(--ink3)" : "var(--ok)" }}>{m.soldOut ? "Esgotado" : "Disponível"}</span>
      </button>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button type="button" title="Duplicar" className="icon-btn" onClick={onDuplicate}>
          <i className="fa-solid fa-copy" style={{ fontSize: 16, lineHeight: 1 }} />
        </button>
        <button type="button" title="Editar" className="icon-btn" onClick={onEdit}>
          <i className="fa-solid fa-pen" style={{ fontSize: 16, lineHeight: 1 }} />
        </button>
      </div>
    </div>
  );
}
