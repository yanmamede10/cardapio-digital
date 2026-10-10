import { useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { LEVEL, NO_CATEGORY, type MenuCategory, type MenuItem, type Product } from "@cardapio/shared";
import { ClearSearch } from "../components/ClearSearch";
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
import { myLevel } from "../lib/modules";
import { brl } from "../lib/format";
import { useDashboardState } from "../state/DashboardStateContext";
import { EmptyState } from "../components/EmptyState";
import { LinkDishModal } from "../components/LinkDishModal";
import { SlideOver } from "../components/SlideOver";
import { useCategoryDialog } from "../components/CategoryDialog";

interface DraftExtra {
  name: string;
  price: string;
  /** Stock this adicional takes per unit sold (Bacon extra → 0,03 kg of bacon); "" = none. */
  productId: string;
  qty: string;
}

/** Dishes whose product has no category (J-1) are listed under this one, always last; it isn't dragged, renamed or deleted. */
export const NO_CATEGORY_GROUP: MenuCategory = { id: "", restaurantId: "", name: NO_CATEGORY, sortOrder: Number.MAX_SAFE_INTEGER };
/** The categories to group by (dishes here, the Catálogo in Produtos): the list, plus "Sem categoria" when something has none. */
export const withNoCategory = (categories: MenuCategory[], items: { categoryId: string | null }[]) => (items.some((i) => !i.categoryId) ? [...categories, NO_CATEGORY_GROUP] : categories);

/** "Nova categoria" in the Cardápio (UX-07 · 2e): the same box as in Produtos, only this sentence changes. */
export const MENU_CATEGORY_HELP = "É a mesma lista do Catálogo de Produtos. Aparece no cardápio do cliente quando tiver um prato.";
/** The dishes on screen in a category: the delete box lists them (insumos and produtos off the menu, the API counts). */
export const dishesIn = (items: MenuItem[]) => (c: MenuCategory) => items.filter((i) => i.categoryId === c.id).map((i) => i.name);

/** "Organizar prato": name/price come from the catalog product and are read-only here. */
interface Draft {
  id: string;
  productId: string | null;
  name: string;
  price: number;
  desc: string;
  categoryId: string;
  lunch: string;
  dinner: string;
  extras: DraftExtra[];
  imageUrl: string | null;
}

/** Sortable ids for category rows are prefixed so they never collide with item ids in the shared DndContext. */
export const catSortId = (id: string) => `cat-${id}`;

/** A category dropped on another's place (Cardápio and Produtos, one order): the same move-by-one-step API, repeated. */
export async function dropCategory(categories: MenuCategory[], activeSortId: string, overSortId: string, notify: (m: string) => void) {
  const oldIndex = categories.findIndex((c) => catSortId(c.id) === activeSortId);
  const newIndex = categories.findIndex((c) => catSortId(c.id) === overSortId);
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
  const dir: "up" | "down" = newIndex > oldIndex ? "down" : "up";
  const cat = categories[oldIndex];
  try {
    for (let i = 0; i < Math.abs(newIndex - oldIndex); i++) await api.moveCategory(cat.id, dir);
    notify(`Categoria ${cat.name} movida para ${dir === "up" ? "cima" : "baixo"}`);
  } catch {
    // ignore edge (already first/last)
  }
}

/** Category rows and item rows share one DndContext; scope collisions to same-kind droppables so
 *  dragging a category (a small handle spanning a large distance) can't resolve to a nested item row. */
const scopedCollisionDetection: CollisionDetection = (args) => {
  const isCategoryDrag = String(args.active.id).startsWith("cat-");
  const droppableContainers = args.droppableContainers.filter((c) => String(c.id).startsWith("cat-") === isCategoryDrag);
  return closestCenter({ ...args, droppableContainers });
};

export default function MenuScreen() {
  // Funcionário (garçom, cozinha) only flips Esgotado/Disponível; adding, editing, reordering and removing is Administrador+.
  const canEdit = myLevel() >= LEVEL.ADMINISTRADOR;
  const { notify } = useDashboardState();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState("Todas");
  const [drawer, setDrawer] = useState<Draft | null>(null);
  // What Organizar prato opened with (UX-08); the photo is saved on its own, so it isn't a change to discard.
  const drawerStart = useRef("");
  const snap = (d: Draft) => JSON.stringify({ ...d, imageUrl: null });
  const [linking, setLinking] = useState(false);
  const [stockItems, setStockItems] = useState<Product[]>([]); // what an adicional can take from stock
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Without a search or a category filter every category shows, empty ones too (a new one must be visible to fill).
  const showAll = !query.trim() && activeCat === "Todas";
  const groups = withNoCategory(categories, filtered)
    .filter((c) => showAll || filtered.some((m) => (m.categoryId ?? "") === c.id))
    .map((c) => ({ cat: c, items: filtered.filter((m) => (m.categoryId ?? "") === c.id) }));

  const openLink = () => setLinking(true);
  const cats = useCategoryDialog({ categories, help: MENU_CATEGORY_HELP, itemsIn: dishesIn(items), notify, onChanged: () => reload() });

  useEffect(() => {
    if (canEdit) api.listProducts().then((p) => setStockItems(p.filter((x) => !x.composed))).catch(() => {});
  }, [canEdit]);

  const openDrawer = (d: Draft) => {
    drawerStart.current = snap(d);
    setDrawer(d);
  };
  const openEdit = (m: MenuItem) =>
    openDrawer({
      id: m.id,
      productId: m.productId ?? null,
      name: m.name,
      price: m.price,
      desc: m.shortDescription,
      categoryId: m.categoryId ?? "",
      lunch: "11:00 – 15:00",
      dinner: "18:00 – 23:00",
      extras:
        m.optionGroups.find((g) => g.id === "extra")?.options.map((o) => ({ name: o.label, price: o.priceDelta.toFixed(2).replace(".", ","), productId: o.productId ?? "", qty: o.quantity ? String(o.quantity).replace(".", ",") : "" })) || [],
      imageUrl: m.imageUrl
    });

  const save = async () => {
    if (!drawer) return;
    const payload = {
      categoryId: drawer.categoryId,
      shortDescription: drawer.desc,
      scheduleLabel: `Almoço ${drawer.lunch} · Jantar ${drawer.dinner}`,
      extras: drawer.extras.map((x) => ({ name: x.name, priceDelta: Number(x.price.replace(",", ".")) || 0, ...(x.productId ? { productId: x.productId, quantity: Number(x.qty.replace(",", ".")) || 0 } : {}) }))
    };
    try {
      await api.updateItem(drawer.id, payload);
      setDrawer(null);
      notify("Prato salvo e publicado no cardápio");
      reload();
    } catch {
      notify("Não foi possível salvar o prato");
    }
  };

  const uploadImage = async (file: File) => {
    if (!drawer) return;
    try {
      const updated = await api.uploadItemImage(drawer.id, file);
      setDrawer((d) => (d ? { ...d, imageUrl: updated.imageUrl } : d));
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      notify("Foto do prato atualizada");
    } catch {
      notify("Não foi possível enviar a foto");
    }
  };

  const toggleAvailable = async (m: MenuItem) => {
    try {
      const updated = await api.setSoldOut(m.id, !m.soldOut);
      setItems((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
      notify(m.name + (m.soldOut ? " disponível novamente" : " marcado esgotado"));
    } catch {
      notify("Não foi possível atualizar a disponibilidade");
    }
  };

  /** Takes the dish off the menu; the catalog product stays. Photo, description and adicionais go with it, hence the confirm. */
  const unlink = async (m: MenuItem) => {
    if (!window.confirm(`Remover "${m.name}" do cardápio? O cadastro continua no Catálogo, mas foto, descrição e adicionais do prato serão perdidos.`)) return;
    try {
      await api.deleteItem(m.id);
      notify(`"${m.name}" removido do cardápio`);
      reload();
    } catch {
      notify("Não foi possível remover o prato");
    }
  };

  /** Drag replaces the old up/down buttons but calls the exact same move-by-one-step API repeatedly. */
  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith("cat-")) {
      await dropCategory(categories, activeId, overId, notify);
      reload();
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

  const catPills = ["Todas", ...withNoCategory(categories, items).map((c) => c.name)];

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
          <i className="fa-solid fa-magnifying-glass" style={{ fontSize: "var(--icon-md)", lineHeight: 1, color: "var(--ink3)" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar prato" style={{ border: 0, background: "transparent", outline: "none", font: "inherit", fontSize: "var(--text-subheadline)", color: "var(--ink)", width: "100%", minWidth: 0 }} />
          <ClearSearch value={query} onClear={() => setQuery("")} />
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
                style={{ borderRadius: 20, padding: "6px 13px", cursor: "pointer", fontSize: "var(--text-subheadline)", fontWeight: 500, background: active ? "var(--brandSoft)" : "transparent", color: active ? "var(--brandText)" : "var(--ink2)", border: `1px solid ${active ? "var(--brand)" : "var(--line)"}` }}
              >
                {c}
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1 }} />
        <div className="mono" style={{ fontSize: "var(--text-footnote)", color: "var(--ink3)" }}>
          {filtered.length} de {items.length} pratos
        </div>
        {canEdit && (
          <button type="button" className="btn btn-outline" onClick={cats.create}>
            <i className="fa-solid fa-folder-plus" style={{ fontSize: "var(--icon-sm)", lineHeight: 1 }} />
            Nova categoria
          </button>
        )}
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={openLink}>
            <i className="fa-solid fa-plus" style={{ fontSize: "var(--icon-md)", lineHeight: 1 }} />
            Adicionar prato
          </button>
        )}
      </div>

      {categories.length === 0 ? (
        <EmptyState
          icon="fa-utensils"
          title="Seu cardápio ainda está vazio"
          sub="Crie as categorias (ex.: Hambúrgueres, Bebidas) e depois vincule os pratos do Catálogo — eles aparecem no cardápio digital e no Lançar pedido."
          action={
            canEdit && <button type="button" className="btn btn-primary" onClick={cats.create}>
              <i className="fa-solid fa-plus" style={{ fontSize: "var(--icon-md)", lineHeight: 1 }} />
              Criar primeira categoria
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
                <CategorySection key={g.cat.id} cat={g.cat} count={g.items.length} canEdit={canEdit} onRename={() => cats.rename(g.cat)} onDelete={() => cats.remove(g.cat)}>
                  <SortableContext items={g.items.map((m) => m.id)} strategy={verticalListSortingStrategy}>
                    {g.items.map((m) => (
                      <ItemRow key={m.id} item={m} canEdit={canEdit} onToggleAvailable={() => toggleAvailable(m)} onUnlink={() => unlink(m)} onEdit={() => openEdit(m)} />
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
        <SlideOver
          title="Organizar prato"
          subtitle={`${drawer.name} · ${brl(drawer.price)}`}
          onClose={() => setDrawer(null)}
          dirty={snap(drawer) !== drawerStart.current}
          discardName={drawer.name}
          footer={(close) => (
            <>
              <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={save}>
                Salvar prato
              </button>
              <button type="button" className="btn btn-outline" onClick={close}>
                Cancelar
              </button>
            </>
          )}
        >
            <>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) uploadImage(file);
                }}
                style={{
                  height: 132,
                  borderRadius: 15,
                  border: "1px dashed var(--line2)",
                  backgroundColor: "var(--surface2)",
                  backgroundImage: drawer.imageUrl ? `url(${drawer.imageUrl})` : "repeating-linear-gradient(135deg,var(--surface2),var(--surface2) 6px,var(--surface3) 6px,var(--surface3) 12px)",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  color: "var(--ink3)",
                  cursor: "pointer"
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) uploadImage(file);
                  }}
                />
                {!drawer.imageUrl && (
                  <>
                    <i className="fa-solid fa-image" style={{ fontSize: "var(--icon-lg)", lineHeight: 1 }} />
                    <span className="mono" style={{ fontSize: "var(--text-caption)", letterSpacing: ".06em", textAlign: "center", padding: "0 12px" }}>
                      ARRASTE A FOTO DO PRATO · 1200×900
                    </span>
                  </>
                )}
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="field-label">Categoria no cardápio</span>
                <select className="field" value={drawer.categoryId} onChange={(e) => setDrawer({ ...drawer, categoryId: e.target.value })}>
                  {!drawer.categoryId && <option value="">{NO_CATEGORY}</option>}
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", borderRadius: 14, background: "var(--surface2)", border: "1px solid var(--line)", fontSize: "var(--text-subheadline)", color: "var(--ink2)" }}>
                <i className="fa-solid fa-circle-info" style={{ fontSize: "var(--icon-sm)", color: "var(--ink3)" }} />
                <span style={{ flex: 1 }}>Nome, preço, composição e tributação são editados no cadastro do Catálogo.</span>
                {drawer.productId && (
                  <button
                    type="button"
                    onClick={() => navigate("/produtos", { state: { edit: drawer.productId } })}
                    style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer", fontSize: "var(--text-subheadline)", fontWeight: 600, color: "var(--brandText)", whiteSpace: "nowrap" }}
                  >
                    Abrir
                  </button>
                )}
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="field-label">Descrição</span>
                <textarea className="field" rows={3} value={drawer.desc} onChange={(e) => setDrawer({ ...drawer, desc: e.target.value })} placeholder="O que vem no prato, porção, acompanhamentos" maxLength={200} />
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="field-label">Variações e adicionais</span>
                  <div style={{ flex: 1 }} />
                  <button
                    type="button"
                    onClick={() => setDrawer({ ...drawer, extras: [...drawer.extras, { name: "Novo adicional", price: "0,00", productId: "", qty: "" }] })}
                    style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: 0, color: "var(--brandText)", font: "inherit", fontSize: "var(--text-subheadline)", fontWeight: 600, cursor: "pointer", padding: 0 }}
                  >
                    <i className="fa-solid fa-plus" style={{ fontSize: "var(--icon-sm)", lineHeight: 1 }} />
                    Adicionar
                  </button>
                </div>
                {drawer.extras.map((x, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 104px 44px", gap: 8, alignItems: "center" }}>
                    <input
                      className="field"
                      aria-label="Nome do adicional"
                      style={{ padding: "8px 10px" }}
                      value={x.name}
                      onChange={(e) => setDrawer({ ...drawer, extras: drawer.extras.map((y, j) => (i === j ? { ...y, name: e.target.value } : y)) })}
                    />
                    <input inputMode="decimal"
                      className="field mono"
                      aria-label={`Preço de ${x.name}`}
                      style={{ padding: "8px 10px" }}
                      value={x.price}
                      onChange={(e) => setDrawer({ ...drawer, extras: drawer.extras.map((y, j) => (i === j ? { ...y, price: e.target.value } : y)) })}
                    />
                    <button type="button" title="Remover adicional" aria-label="Remover adicional" className="icon-btn" onClick={() => setDrawer({ ...drawer, extras: drawer.extras.filter((_, j) => j !== i) })}>
                      <i className="fa-solid fa-trash" style={{ fontSize: "var(--icon-sm)", lineHeight: 1 }} />
                    </button>
                    <select
                      className="field"
                      aria-label={`Baixa no estoque de ${x.name}`}
                      style={{ gridColumn: x.productId ? "1" : "1 / -1", padding: "7px 10px", fontSize: "var(--text-subheadline)" }}
                      value={x.productId}
                      onChange={(e) => setDrawer({ ...drawer, extras: drawer.extras.map((y, j) => (i === j ? { ...y, productId: e.target.value } : y)) })}
                    >
                      <option value="">Não baixa estoque</option>
                      {stockItems.map((p) => (
                        <option key={p.id} value={p.id}>
                          Baixa: {p.name} ({p.unit})
                        </option>
                      ))}
                    </select>
                    {x.productId && (
                      <input
                        className="field mono"
                        inputMode="decimal"
                        placeholder="Qtd."
                        aria-label={`Quantidade de ${x.name} no estoque`}
                        style={{ gridColumn: "2 / -1", padding: "7px 10px", fontSize: "var(--text-subheadline)" }}
                        value={x.qty}
                        onChange={(e) => setDrawer({ ...drawer, extras: drawer.extras.map((y, j) => (i === j ? { ...y, qty: e.target.value.replace(/[^0-9.,]/g, "") } : y)) })}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 13, border: "1px solid var(--line)", borderRadius: 13, background: "var(--surface2)" }}>
                <div className="field-label">Agendamento de disponibilidade</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: "var(--text-footnote)", color: "var(--ink2)" }}>
                    Almoço
                    <input className="field mono" style={{ padding: "8px 10px", fontSize: "var(--text-subheadline)" }} value={drawer.lunch} onChange={(e) => setDrawer({ ...drawer, lunch: e.target.value })} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: "var(--text-footnote)", color: "var(--ink2)" }}>
                    Jantar
                    <input className="field mono" style={{ padding: "8px 10px", fontSize: "var(--text-subheadline)" }} value={drawer.dinner} onChange={(e) => setDrawer({ ...drawer, dinner: e.target.value })} />
                  </label>
                </div>
              </div>
            </>
        </SlideOver>
      )}

      {linking && <LinkDishModal categories={categories} items={items} onClose={() => setLinking(false)} onLinked={reload} />}
      {cats.dialog}
    </div>
  );
}

export function DragHandle({ ariaLabel, ...rest }: { ariaLabel: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      {...rest}
      style={{ flex: "none", background: "transparent", border: 0, padding: 4, cursor: "grab", color: "var(--ink3)", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none" }}
    >
      <i className="fa-solid fa-grip-vertical" style={{ fontSize: "var(--icon-md)", lineHeight: 1 }} />
    </button>
  );
}

export function CategoryDragPreview({ name }: { name: string }) {
  return (
    <div className="card" style={{ padding: "13px 18px", boxShadow: "var(--shadow2)", transform: "scale(1.02)", display: "flex", alignItems: "center", gap: 10, fontWeight: 600, fontSize: "var(--text-body)" }}>
      <i className="fa-solid fa-grip-vertical" style={{ fontSize: "var(--icon-md)", lineHeight: 1, color: "var(--ink3)" }} />
      {name}
    </div>
  );
}

function ItemDragPreview({ name, price }: { name: string; price: string }) {
  return (
    <div className="card" style={{ padding: "13px 18px", boxShadow: "var(--shadow2)", transform: "scale(1.02)", display: "flex", alignItems: "center", gap: 12, minWidth: 280 }}>
      <i className="fa-solid fa-grip-vertical" style={{ fontSize: "var(--icon-md)", lineHeight: 1, color: "var(--ink3)" }} />
      <div style={{ flex: 1, fontWeight: 600, fontSize: "var(--text-body)" }}>{name}</div>
      <div className="mono" style={{ fontWeight: 600, fontSize: "var(--text-body)" }}>{price}</div>
    </div>
  );
}

/** A category's card (Cardápio and Produtos): handle, name and count, rename and delete. With onToggle (Produtos) the name
 *  collapses the section. "Sem categoria" is fixed: no handle, no rename or delete, always last. */
export function CategorySection({
  cat,
  count,
  canEdit,
  onRename,
  onDelete,
  children,
  open = true,
  onToggle,
  note,
  empty = 'Nenhum prato nesta categoria ainda. Use "Adicionar prato".',
  minWidth = 820
}: {
  cat: MenuCategory;
  count: number;
  canEdit: boolean;
  onRename: () => void;
  onDelete: () => void;
  children: ReactNode;
  open?: boolean;
  onToggle?: () => void;
  note?: ReactNode;
  empty?: string;
  minWidth?: number;
}) {
  const fixed = cat === NO_CATEGORY_GROUP;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: catSortId(cat.id), disabled: fixed });
  const style: CSSProperties = { overflowX: "auto", transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  const title = (
    <>
      <span style={{ fontWeight: 600, fontSize: "var(--text-body)" }}>{cat.name}</span>
      <span className="mono" style={{ fontSize: "var(--text-caption)", color: "var(--ink3)", background: "var(--surface3)", borderRadius: 20, padding: "1px 8px" }}>
        {count}
      </span>
    </>
  );
  return (
    <section ref={setNodeRef} style={style} className="card">
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 18px 4px 10px", minHeight: 52, background: "var(--surface2)", borderBottom: open ? "1px solid var(--line)" : 0, minWidth }}>
        {fixed ? (
          <i className="fa-solid fa-folder-open" aria-hidden="true" style={{ width: 26, textAlign: "center", fontSize: "var(--icon-sm)", color: "var(--ink3)" }} />
        ) : (
          canEdit && <DragHandle ariaLabel={`Reordenar categoria ${cat.name}`} {...attributes} {...listeners} />
        )}
        {onToggle ? (
          <button type="button" aria-expanded={open} onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 10, border: 0, background: "transparent", padding: "0 8px", borderRadius: 10, cursor: "pointer", font: "inherit", color: "var(--ink)" }}>
            <i className={`fa-solid ${open ? "fa-chevron-down" : "fa-chevron-right"}`} style={{ fontSize: "var(--icon-sm)", width: 12, color: "var(--ink3)" }} />
            {title}
          </button>
        ) : (
          title
        )}
        {note && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--text-footnote)", color: "var(--ink2)" }}>{note}</span>}
        <div style={{ flex: 1 }} />
        {canEdit && !fixed && (
          <>
            <button type="button" className="icon-btn" title="Renomear categoria" aria-label={`Renomear categoria ${cat.name}`} onClick={onRename}>
              <i className="fa-solid fa-pen" style={{ fontSize: "var(--icon-sm)", lineHeight: 1 }} />
            </button>
            <button type="button" className="icon-btn" title="Excluir categoria" aria-label={`Excluir categoria ${cat.name}`} onClick={onDelete}>
              <i className="fa-solid fa-trash" style={{ fontSize: "var(--icon-sm)", lineHeight: 1 }} />
            </button>
          </>
        )}
      </div>
      {open && count === 0 && <div style={{ padding: "14px 18px", fontSize: "var(--text-subheadline)", color: "var(--ink3)", minWidth }}>{empty}</div>}
      {open && children}
    </section>
  );
}

function ItemRow({ item: m, canEdit, onToggleAvailable, onUnlink, onEdit }: { item: MenuItem; canEdit: boolean; onToggleAvailable: () => void; onUnlink: () => void; onEdit: () => void }) {
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
      {canEdit ? <DragHandle ariaLabel={`Reordenar ${m.name}`} {...attributes} {...listeners} /> : <span />}
      <div
        style={{
          height: 44,
          borderRadius: 12,
          border: "1px solid var(--line)",
          backgroundColor: "var(--surface2)",
          backgroundImage: m.imageUrl ? `url(${m.imageUrl})` : "repeating-linear-gradient(135deg,var(--surface2),var(--surface2) 5px,var(--surface3) 5px,var(--surface3) 10px)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          paddingBottom: 3
        }}
      >
        {!m.imageUrl && (
          <span className="mono" style={{ fontSize: "var(--text-caption)", color: "var(--ink3)", letterSpacing: ".04em" }}>
            FOTO
          </span>
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "var(--text-body)", fontWeight: 600, letterSpacing: "-.01em" }}>{m.name}</div>
        <div style={{ fontSize: "var(--text-footnote)", color: "var(--ink3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.shortDescription}</div>
      </div>
      <div className="mono" style={{ fontSize: "var(--text-body)", fontWeight: 600, letterSpacing: "-.02em" }}>
        {brl(m.price)}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--text-footnote)", color: "var(--ink2)" }}>
        <i className="fa-solid fa-clock" style={{ fontSize: "var(--icon-sm)", lineHeight: 1, color: "var(--ink3)" }} />
        {m.scheduleLabel}
      </div>
      <button type="button" onClick={onToggleAvailable} style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: 0, cursor: "pointer", font: "inherit", padding: 0 }}>
        <span className="toggle-track" style={{ background: m.soldOut ? "var(--line2)" : "var(--ok)" }}>
          <span className="toggle-knob" style={{ left: m.soldOut ? 2 : 16 }} />
        </span>
        <span style={{ fontSize: "var(--text-footnote)", fontWeight: 600, color: m.soldOut ? "var(--ink3)" : "var(--ok)" }}>{m.soldOut ? "Esgotado" : "Disponível"}</span>
      </button>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", visibility: canEdit ? undefined : "hidden" }}>
        <button type="button" title="Remover do cardápio" aria-label={`Remover ${m.name} do cardápio`} className="icon-btn" onClick={onUnlink}>
          <i className="fa-solid fa-link-slash" style={{ fontSize: "var(--icon-sm)", lineHeight: 1 }} />
        </button>
        <button type="button" title="Organizar prato" aria-label={`Organizar ${m.name}`} className="icon-btn" onClick={onEdit}>
          <i className="fa-solid fa-pen" style={{ fontSize: "var(--icon-sm)", lineHeight: 1 }} />
        </button>
      </div>
    </div>
  );
}
