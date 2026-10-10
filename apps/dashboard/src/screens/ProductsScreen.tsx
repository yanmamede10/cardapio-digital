import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { NO_CATEGORY, PRODUCT_UNITS, type MenuCategory, type Product, type ProductType, type StockMovement, type UpsertProductRequest, type XmlImportRequest } from "@cardapio/shared";
import { ApiError, api } from "../lib/api";
import { brl, dayMonth, localIso } from "../lib/format";
import { useDashboardState } from "../state/DashboardStateContext";
import { Chip, Segmented } from "../components/Segmented";
import { SlideOver } from "../components/SlideOver";
import { EmptyState } from "../components/EmptyState";
import { useCategoryDialog } from "../components/CategoryDialog";
import { FilterPopover, PAST_PERIODS, inPeriod, type FilterGroup, type FilterValues } from "../components/FilterPopover";
import { CategoryDragPreview, CategorySection, NO_CATEGORY_GROUP, catSortId, dropCategory, withNoCategory } from "./MenuScreen";

export interface Draft {
  id: string | null;
  name: string;
  type: ProductType;
  unit: string;
  price: string;
  cost: string;
  ncm: string;
  cst: string;
  taxRate: string;
  composed: boolean;
  lines: { name: string; qty: string }[];
  /** null = Sem categoria (J-1). */
  categoryId: string | null;
  /** Saldo inicial of a new item (an Entrada manual after it's created). */
  stock: string;
}

export const EMPTY_DRAFT: Draft = { id: null, name: "", type: "produto", unit: "un", price: "", cost: "", ncm: "", cst: "", taxRate: "", composed: false, lines: [], categoryId: null, stock: "" };

/** "1.234,5" and "0.35" both parse — a comma means pt-BR decimals, otherwise the dot is the decimal point. */
const num = (s: string) => Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s) || 0;
const decimal = (n: number) => (n ? String(n).replace(".", ",") : "");
export const qty = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
export const pill = (tone: string) => ({ fontSize: "var(--text-footnote)", fontWeight: 600, borderRadius: 999, padding: "2px 11px", whiteSpace: "nowrap" as const, background: `color-mix(in srgb, var(--${tone}) 16%, transparent)`, color: `var(--${tone}Text, var(--${tone}))` });
const headRow = { display: "grid", gap: 16, padding: "12px 20px", background: "var(--surface2)", borderBottom: "1px solid var(--line)" } as const;
export const TYPE_LABEL: Record<ProductType, string> = { produto: "Produto", insumo: "Insumo" };

export const MOVEMENT_FILTERS: FilterGroup[] = [
  { id: "tipo", label: "Tipo", options: ["Entrada", "Saída"] },
  { id: "per", label: "Período", options: PAST_PERIODS }
];
/** A movement's pill (Entrada, Saída, or Custo when it only corrected the cost — item 3), its quantity and its origin. */
export const movementTag = (m: StockMovement) => (m.quantity === 0 ? { label: "Custo", tone: "ink2" } : m.kind === "in" ? { label: "Entrada", tone: "ok" } : { label: "Saída", tone: "sec" });
export const movementQty = (m: StockMovement) => (m.quantity === 0 ? "—" : `${m.kind === "in" ? "+" : "−"} ${qty(m.quantity)} ${m.unit}`);
export const movementSource = (m: StockMovement) => (m.unitCost == null ? m.source : `${m.source} · custo ${brl(m.unitCost)}/${m.unit}`);
export const movementMatch = (m: StockMovement, f: FilterValues) => (!f.tipo || (m.kind === "in" ? "Entrada" : "Saída") === f.tipo) && inPeriod(localIso(new Date(m.createdAt)), f);

/** Edit-form draft for an existing product. */
export const draftOf = (p: Product): Draft => ({
  id: p.id,
  name: p.name,
  type: p.type,
  unit: p.unit,
  price: p.price ? p.price.toFixed(2).replace(".", ",") : "",
  cost: !p.composed && p.cost ? p.cost.toFixed(2).replace(".", ",") : "",
  ncm: p.ncm,
  cst: p.cst,
  taxRate: decimal(p.taxRate),
  composed: p.composed,
  lines: p.components.map((c) => ({ name: c.name, qty: decimal(c.quantity) })),
  categoryId: p.categoryId,
  stock: ""
});

export function stockStatus(p: Product) {
  if (p.composed) return { label: "Ficha técnica", tone: "ink3", icon: "fa-list-ul" };
  return p.stock > 0 ? { label: "Em estoque", tone: "ok", icon: "fa-check" } : { label: "Sem estoque", tone: "alert", icon: "fa-circle-exclamation" };
}

/** Status pill with its icon (UX-07: icon + text, never color alone). */
export function StatusPill({ p }: { p: Product }) {
  const st = stockStatus(p);
  return (
    <span style={{ ...pill(st.tone), display: "inline-flex", alignItems: "center", gap: 5 }}>
      <i className={`fa-solid ${st.icon}`} aria-hidden="true" style={{ fontSize: "var(--icon-sm)" }} />
      {st.label}
    </span>
  );
}

/** EST-04 (alerta de estoque) is not built yet: its "Abaixo do aviso" pill and strip go here when it is (UX-07 design). */

export type CatalogType = "todos" | ProductType;
/** Catálogo filters: name, type, and a category (its id, "" = Sem categoria, null = Todas). */
export interface CatalogFilter {
  q: string;
  tipo: CatalogType;
  cat: string | null;
}
export const NO_FILTER: CatalogFilter = { q: "", tipo: "todos", cat: null };
export const TYPE_OPTIONS: { value: CatalogType; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "produto", label: "Produtos" },
  { value: "insumo", label: "Insumos" }
];
export const PRODUCTS_CATEGORY_HELP = "Uma lista só para Catálogo e Cardápio. Categoria sem produto não aparece no cardápio do cliente.";
export const ONLY_INSUMOS = "Só insumos · não aparece no cardápio do cliente";
export const NONE_NOTE = "Itens antigos · abra o item e escolha uma categoria. Fica sempre no fim.";
export const countLabel = (n: number) => (n === 1 ? "1 item" : `${n} itens`);

/** The Catálogo by category, in the Cardápio's order (UX-07), "Sem categoria" last. Without a filter every category shows,
 *  empty ones too (a new one must be visible to fill); with one, only the categories with a match. */
export function catalogGroups(products: Product[], categories: MenuCategory[], f: CatalogFilter) {
  const q = f.q.trim().toLowerCase();
  const shown = products.filter((p) => (f.tipo === "todos" || p.type === f.tipo) && (!q || p.name.toLowerCase().includes(q)) && (f.cat === null || (p.categoryId ?? "") === f.cat));
  const filtered = !!q || f.tipo !== "todos" || f.cat !== null;
  const groups = withNoCategory(categories, shown)
    .map((cat) => ({ cat, items: shown.filter((p) => (p.categoryId ?? "") === cat.id) }))
    .filter((g) => g.items.length > 0 || (!filtered && g.cat !== NO_CATEGORY_GROUP));
  return { shown, groups, filtered, chips: withNoCategory(categories, products) };
}
const onlyInsumos = (items: Product[]) => items.length > 0 && items.every((p) => p.type === "insumo");
const COLS = "minmax(160px,1fr) 84px 150px 96px 96px 140px 44px";
const ROW_MIN = 900;

/** Supplier NF-e → import payload. Parsed in the browser (native DOMParser) so the API needs no XML dependency. */
export async function parseNfe(file: File): Promise<XmlImportRequest> {
  const doc = new DOMParser().parseFromString(await file.text(), "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("Arquivo XML inválido");
  const text = (el: Element, tag: string) => el.getElementsByTagNameNS("*", tag)[0]?.textContent?.trim() ?? "";
  const items = [...doc.getElementsByTagNameNS("*", "prod")].map((p) => ({
    name: text(p, "xProd"),
    ncm: text(p, "NCM"),
    unit: text(p, "uCom"),
    quantity: Number(text(p, "qCom")),
    unitCost: Number(text(p, "vUnCom"))
  }));
  if (items.length === 0) throw new Error("Nenhum item de NF-e encontrado no arquivo");
  return { fileName: file.name, items };
}

export default function ProductsScreen() {
  const { notify } = useDashboardState();
  const location = useLocation();
  const [tab, setTab] = useState<"catalogo" | "mov">("catalogo");
  const [products, setProducts] = useState<Product[] | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [filter, setFilter] = useState<CatalogFilter>(NO_FILTER);
  const [closed, setClosed] = useState<string[]>([]); // collapsed sections
  const [dragging, setDragging] = useState<string | null>(null);
  const [movFilter, setMovFilter] = useState<FilterValues>({});
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }) // Space picks up, arrows move, Space drops, Esc cancels
  );

  const reload = () =>
    Promise.all([api.listProducts(), api.listStockMovements(), api.listCategories()]).then(([p, m, c]) => {
      setProducts(p);
      setMovements(m);
      setCategories(c);
      return p;
    });
  const cats = useCategoryDialog({
    categories,
    help: PRODUCTS_CATEGORY_HELP,
    itemsIn: (c) => (products ?? []).filter((p) => p.categoryId === c.id).map((p) => p.name),
    notify,
    onChanged: () => reload()
  });

  useEffect(() => {
    reload()
      .then((p) => {
        // Cardápio's "Abrir no Catálogo" lands here with the product to edit.
        const editId = (location.state as { edit?: string } | null)?.edit;
        const target = editId && p.find((x) => x.id === editId);
        if (target) openEdit(target);
      })
      .catch((err) => setError(err instanceof ApiError && err.status === 403 ? "Você não tem permissão para acessar Produtos." : "Não foi possível carregar Produtos."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEdit = (p: Product) => setDraft(draftOf(p));

  const importFile = async (file: File) => {
    setImporting(true);
    try {
      const { imported } = await api.importXml(await parseNfe(file));
      notify(`XML importado · ${imported} ${imported === 1 ? "item entrou" : "itens entraram"} no estoque`);
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Não foi possível importar o XML");
    } finally {
      setImporting(false);
    }
  };

  if (error) return <p style={{ color: "var(--ink2)" }}>{error}</p>;
  if (!products) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="skeleton" style={{ height: 44 }} />
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    );
  }

  const { shown, groups, filtered, chips } = catalogGroups(products, categories, filter);
  const set = (patch: Partial<CatalogFilter>) => setFilter({ ...filter, ...patch });
  const toggle = (id: string) => setClosed(closed.includes(id) ? closed.filter((x) => x !== id) : [...closed, id]);
  const newItem = () => setDraft({ ...EMPTY_DRAFT, categoryId: filter.cat || null }); // the chip's category, if one is on
  const shownMovements = movements.filter((m) => movementMatch(m, movFilter));

  const xmlInput = (
    <input
      ref={fileInput}
      type="file"
      accept=".xml,text/xml,application/xml"
      style={{ display: "none" }}
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) importFile(file);
      }}
    />
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "catalogo", label: "Catálogo" },
            { value: "mov", label: "Movimentações" }
          ]}
        />
      </div>

      {tab === "catalogo" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap" }}>
            {products.length > 0 && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 13, padding: "0 4px 0 14px", width: 260 }}>
                  <i className="fa-solid fa-magnifying-glass" aria-hidden="true" style={{ fontSize: "var(--icon-sm)", color: "var(--ink3)" }} />
                  <input value={filter.q} onChange={(e) => set({ q: e.target.value })} placeholder="Buscar por nome" aria-label="Buscar por nome" style={{ border: 0, background: "transparent", outline: "none", font: "inherit", fontSize: "var(--text-subheadline)", color: "var(--ink)", width: "100%", minWidth: 0 }} />
                  {filter.q && (
                    <button type="button" aria-label="Limpar busca" onClick={() => set({ q: "" })} style={{ border: 0, background: "transparent", color: "var(--ink3)", cursor: "pointer" }}>
                      <i className="fa-solid fa-circle-xmark" style={{ fontSize: "var(--icon-sm)" }} />
                    </button>
                  )}
                </div>
                <Segmented value={filter.tipo} onChange={(tipo) => set({ tipo })} options={TYPE_OPTIONS} />
              </>
            )}
            <div style={{ flex: 1 }} />
            <div className="mono" style={{ fontSize: "var(--text-footnote)", color: "var(--ink2)" }}>
              {filtered ? `${shown.length} de ${countLabel(products.length)}` : countLabel(products.length)}
            </div>
            <button type="button" className="btn btn-outline" onClick={cats.create}>
              <i className="fa-solid fa-folder-plus" style={{ fontSize: "var(--icon-sm)" }} />
              Nova categoria
            </button>
            <button type="button" className="btn btn-primary" onClick={newItem}>
              <i className="fa-solid fa-plus" style={{ fontSize: "var(--icon-sm)" }} />
              Novo item
            </button>
          </div>

          {products.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Chip active={filter.cat === null} onClick={() => set({ cat: null })}>
                Todas
              </Chip>
              {chips.map((c) => (
                <Chip key={c.id || "none"} active={filter.cat === c.id} onClick={() => set({ cat: c.id })}>
                  {c.name}
                </Chip>
              ))}
            </div>
          )}

          {products.length === 0 && categories.length === 0 ? (
            <EmptyState
              icon="fa-box-open"
              title="Seu catálogo ainda está vazio"
              sub="Cadastre o que você vende (produtos) e o que usa no preparo (insumos). Categorias como Hambúrgueres ou Carnes organizam os dois e o cardápio."
              action={
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                  <button type="button" className="btn btn-primary" onClick={newItem}>
                    <i className="fa-solid fa-plus" style={{ fontSize: "var(--icon-sm)" }} />
                    Cadastrar primeiro item
                  </button>
                  <button type="button" className="btn btn-outline" onClick={cats.create}>
                    <i className="fa-solid fa-folder-plus" style={{ fontSize: "var(--icon-sm)" }} />
                    Criar categoria
                  </button>
                </div>
              }
            />
          ) : filtered && shown.length === 0 ? (
            <EmptyState
              icon="fa-magnifying-glass"
              title={filter.q.trim() ? `Nenhum item com “${filter.q.trim()}”` : "Nenhum item com esses filtros"}
              sub="A busca olha o nome em todas as categorias e nos dois tipos. Confira a grafia ou tente outra palavra."
              action={
                <button type="button" className="btn btn-outline" onClick={() => setFilter(NO_FILTER)}>
                  {filter.q.trim() ? "Limpar busca" : "Limpar filtros"}
                </button>
              }
            />
          ) : (
            <div style={{ overflowX: "auto" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: ROW_MIN }}>
                <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 16, padding: "0 19px 0 27px", marginBottom: -6 }}>
                  {["Item", "Tipo", "Estoque atual", "Custo", "Preço", "Status", ""].map((h, i) => (
                    <div key={i} className="field-label">
                      {h}
                    </div>
                  ))}
                </div>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={({ active }) => setDragging(String(active.id))}
                  onDragCancel={() => setDragging(null)}
                  onDragEnd={async ({ active, over }) => {
                    setDragging(null);
                    if (over && active.id !== over.id) {
                      await dropCategory(categories, String(active.id), String(over.id), notify);
                      reload();
                    }
                  }}
                >
                  <SortableContext items={groups.map((g) => catSortId(g.cat.id))} strategy={verticalListSortingStrategy}>
                    {groups.map((g) => (
                      <CategorySection
                        key={g.cat.id || "none"}
                        cat={g.cat}
                        count={g.items.length}
                        canEdit
                        onRename={() => cats.rename(g.cat)}
                        onDelete={() => cats.remove(g.cat)}
                        open={!dragging && !closed.includes(g.cat.id)} // while a category is dragged, only the titles
                        onToggle={() => toggle(g.cat.id)}
                        note={
                          g.cat === NO_CATEGORY_GROUP ? (
                            NONE_NOTE
                          ) : onlyInsumos(g.items) ? (
                            <>
                              <i className="fa-solid fa-eye-slash" aria-hidden="true" style={{ fontSize: "var(--icon-sm)" }} />
                              {ONLY_INSUMOS}
                            </>
                          ) : undefined
                        }
                        empty="Nenhum item nesta categoria ainda."
                        minWidth={ROW_MIN}
                      >
                        {g.items.map((p) => (
                          <CatalogRow key={p.id} p={p} onOpen={() => openEdit(p)} />
                        ))}
                      </CategorySection>
                    ))}
                  </SortableContext>
                  <DragOverlay>{dragging ? <CategoryDragPreview name={categories.find((c) => catSortId(c.id) === dragging)?.name ?? ""} /> : null}</DragOverlay>
                </DndContext>
              </div>
            </div>
          )}
        </div>
      ) : (
        <section className="card">
          {xmlInput}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 600, fontSize: "var(--text-body)", flex: 1 }}>Histórico de entradas e saídas</div>
            {movements.length > 0 && (
              <FilterPopover
                groups={MOVEMENT_FILTERS}
                value={movFilter}
                onChange={setMovFilter}
                resultCount={shownMovements.length}
              />
            )}
            <button type="button" className="btn btn-primary" disabled={importing} onClick={() => fileInput.current?.click()}>
              <i className="fa-solid fa-file-import" style={{ fontSize: "var(--icon-sm)" }} />
              {importing ? "Importando…" : "Importar XML"}
            </button>
          </div>

          {movements.length === 0 ? (
            <div style={{ padding: "56px 24px", display: "grid", placeItems: "center" }}>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) importFile(file);
                }}
                style={{ maxWidth: 420, width: "100%", border: "1px dashed var(--line2)", borderRadius: 20, padding: "34px 28px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}
              >
                <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--brandSoft)", color: "var(--brandText)", display: "grid", placeItems: "center" }}>
                  <i className="fa-solid fa-file-import" style={{ fontSize: "var(--icon-lg)" }} />
                </div>
                <div style={{ fontSize: "var(--text-subheadline)", color: "var(--ink2)", textWrap: "pretty" } as React.CSSProperties}>
                  Arraste o arquivo da nota do fornecedor. Os itens entram no estoque automaticamente.
                </div>
                <button type="button" className="btn btn-primary" disabled={importing} onClick={() => fileInput.current?.click()}>
                  Selecionar
                </button>
              </div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: 780 }}>
                <div style={{ ...headRow, gridTemplateColumns: "90px 100px minmax(160px,1fr) 110px minmax(180px,1.2fr)" }}>
                  {["Data", "Tipo", "Item", "Quantidade", "Origem"].map((h) => (
                    <div key={h} className="field-label">
                      {h}
                    </div>
                  ))}
                </div>
                {shownMovements.map((m) => {
                  const xml = m.source.toLowerCase().endsWith(".xml");
                  return (
                    <div key={m.id} style={{ display: "grid", gridTemplateColumns: "90px 100px minmax(160px,1fr) 110px minmax(180px,1.2fr)", gap: 16, padding: "14px 20px", borderBottom: "1px solid var(--line)", alignItems: "center", fontSize: "var(--text-subheadline)" }}>
                      <div className="mono" style={{ fontSize: "var(--text-subheadline)", color: "var(--ink2)" }}>
                        {dayMonth(localIso(new Date(m.createdAt)))}
                      </div>
                      <div>
                        <span style={pill(movementTag(m).tone)}>{movementTag(m).label}</span>
                      </div>
                      <div style={{ fontWeight: 500 }}>{m.productName}</div>
                      <div className="mono" style={{ fontWeight: 600, color: m.kind === "in" ? "var(--ok)" : "var(--ink)" }}>
                        {movementQty(m)}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, color: "var(--ink2)" }}>
                        <i className={`fa-solid ${xml ? "fa-file-code" : "fa-receipt"}`} style={{ fontSize: "var(--icon-sm)", color: "var(--ink3)" }} />
                        <span className={xml ? "mono" : undefined} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: xml ? "var(--text-footnote)" : undefined }}>
                          {movementSource(m)}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {shownMovements.length === 0 && <div style={{ padding: "36px 20px", textAlign: "center", fontSize: "var(--text-subheadline)", color: "var(--ink3)" }}>Nenhum resultado com esses filtros.</div>}
              </div>
            </div>
          )}
        </section>
      )}

      {cats.dialog}
      {draft && (
        <ProductForm
          draft={draft}
          setDraft={setDraft}
          products={products}
          categories={categories}
          onCategoriesChanged={setCategories}
          onSaved={(saved) => {
            setDraft(null);
            notify(`${saved.name} ${draft.id ? "atualizado" : "cadastrado"} no Catálogo`);
            reload();
          }}
          onAdjusted={(message) => {
            notify(message);
            reload();
          }}
          onError={notify}
        />
      )}
    </div>
  );
}

/** A Catálogo row (UX-07 · 1a): one button, the pencil included, opens the cadastro. */
function CatalogRow({ p, onOpen }: { p: Product; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} style={{ display: "grid", gridTemplateColumns: COLS, gap: 16, alignItems: "center", width: "100%", textAlign: "left", padding: "7px 18px 7px 26px", minHeight: 58, border: 0, borderTop: "1px solid var(--line)", background: "transparent", color: "var(--ink)", font: "inherit", cursor: "pointer", minWidth: ROW_MIN }}>
      <div style={{ minWidth: 0, fontSize: "var(--text-body)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
      <div style={{ fontSize: "var(--text-subheadline)", color: "var(--ink2)" }}>{TYPE_LABEL[p.type]}</div>
      <div className="mono" style={{ fontSize: "var(--text-subheadline)", fontWeight: 600, color: p.composed ? "var(--ink2)" : p.stock > 0 ? "var(--ink)" : "var(--alert)" }}>
        {p.composed ? "Composto" : `${qty(p.stock)} ${p.unit}`}
      </div>
      <div className="mono" style={{ fontSize: "var(--text-subheadline)" }}>
        {brl(p.cost)}
      </div>
      <div className="mono" style={{ fontSize: "var(--text-subheadline)", fontWeight: 600 }}>
        {p.type === "produto" ? brl(p.price) : "—"}
      </div>
      <div>
        <StatusPill p={p} />
      </div>
      <span className="icon-btn" aria-hidden="true" title="Editar">
        <i className="fa-solid fa-pen" style={{ fontSize: "var(--icon-sm)" }} />
      </span>
    </button>
  );
}

const ADJUST_HINT = { in: "Chegou mercadoria sem nota", out: "Perda, quebra ou consumo interno", count: "Contei o estoque: fica exatamente esta quantidade" } as const;
const label = { fontSize: "var(--text-footnote)", fontWeight: 500, color: "var(--ink2)" } as const;
const help = { fontSize: "var(--text-footnote)", color: "var(--ink2)", lineHeight: 1.45 } as const;
const fieldError = (message: string | null) =>
  message && (
    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--text-footnote)", fontWeight: 500, color: "var(--alert)" }}>
      <i className="fa-solid fa-circle-exclamation" aria-hidden="true" style={{ fontSize: "var(--icon-sm)" }} />
      {message}
    </span>
  );
/** One section of the cadastro (UX-07 · 3): a title and, after the first, a line above. */
function Section({ title, first, children }: { title: string; first?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, ...(first ? {} : { paddingTop: 22, borderTop: "1px solid var(--line)" }) }}>
      <div style={{ fontSize: "var(--text-headline)", fontWeight: 600, letterSpacing: "-.01em" }}>{title}</div>
      {children}
    </div>
  );
}

/** Cadastro de Produto/Insumo (UX-07 · 3a–3g, 4b): a sheet with Dados, Preço e custo, Estoque, Ficha técnica and Tributação
 *  (folded, with a summary: the Chapa 27 issues no invoices). Cancelar and Salvar always in sight. */
export function ProductForm({
  draft,
  setDraft,
  products,
  categories,
  onCategoriesChanged,
  onSaved,
  onAdjusted,
  onError
}: {
  draft: Draft;
  setDraft: (d: Draft | null) => void;
  products: Product[];
  /** The Cardápio's list (J-1): the item's category is one of them, or none. */
  categories: MenuCategory[];
  onCategoriesChanged: (list: MenuCategory[]) => void;
  onSaved: (p: Product) => void;
  /** After an Ajustar estoque (the form stays open, the list refreshes): what to tell the person. */
  onAdjusted: (message: string) => void;
  onError: (msg: string) => void;
}) {
  const [initial] = useState(draft); // "Alterações não salvas" compares with what the sheet opened with
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false); // after a Criar item/Salvar with problems, the fields say which
  const [adjusting, setAdjusting] = useState(false);
  const [taxOpen, setTaxOpen] = useState(false);
  const [adj, setAdj] = useState({ kind: "in" as keyof typeof ADJUST_HINT, qty: "", reason: "", cost: "" });
  const current = draft.id ? products.find((p) => p.id === draft.id) : undefined;
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  // "Nova categoria" right here (3f): the new one comes back selected.
  const newCategory = useCategoryDialog({
    categories,
    help: "Fica selecionada neste item. Vale também para o Cardápio.",
    confirm: "Criar e usar",
    itemsIn: () => [],
    notify: onError,
    onChanged: (list, created) => {
      onCategoriesChanged(list);
      if (created) set({ categoryId: created.id });
    }
  });
  const adjust = async () => {
    if (!current || !(adj.qty || adj.cost)) return;
    setSaving(true);
    try {
      // Item 3: the cost alone (no quantity) only corrects the cost — a Contagem with an empty quantity doesn't zero the stock.
      const saved = await api.adjustStock(current.id, adj.kind, adj.qty ? num(adj.qty) : undefined, adj.reason.trim(), adj.cost ? num(adj.cost) : undefined);
      const stock = `Estoque de ${saved.name}: ${qty(saved.stock)} ${saved.unit}`;
      const cost = `custo ${brl(saved.cost)}/${saved.unit}`;
      onAdjusted(!adj.qty ? `Custo de ${saved.name}: ${brl(saved.cost)}/${saved.unit}` : adj.cost ? `${stock} · ${cost}` : stock);
      if (adj.cost) set({ cost: saved.cost.toFixed(2).replace(".", ",") }); // the locked field shows the new cost
      setAdj({ ...adj, qty: "", reason: "", cost: "" });
    } catch (err) {
      onError(err instanceof ApiError && err.status === 400 ? "Informe uma quantidade ou um custo válido" : err instanceof ApiError ? err.message : "Não foi possível ajustar o estoque");
    } finally {
      setSaving(false);
    }
  };
  const isProduto = draft.type === "produto";
  const composed = isProduto && draft.composed;
  // One level of composition: composed products can't be components (the API enforces it too).
  const options = products.filter((p) => p.id !== draft.id && !p.composed);
  const lines = draft.lines.map((l) => {
    const match = options.find((p) => p.name.toLowerCase() === l.name.trim().toLowerCase());
    return { ...l, match, cost: match ? match.cost * num(l.qty) : 0 };
  });
  const autoCost = lines.reduce((t, l) => t + l.cost, 0);
  const setLine = (i: number, patch: Partial<Draft["lines"][number]>) => set({ lines: draft.lines.map((l, j) => (i === j ? { ...l, ...patch } : l)) });
  const cost = composed ? autoCost : num(draft.cost);
  const margin = num(draft.price) > 0 ? `${(((num(draft.price) - cost) / num(draft.price)) * 100).toFixed(1).replace(".", ",")}%` : "—";
  // A cost corrected in Ajustar estoque updates the locked field; that isn't an unsaved change of the form.
  const dirty = JSON.stringify({ ...draft, cost: "" }) !== JSON.stringify({ ...initial, cost: "" }) || (!current?.costLocked && draft.cost !== initial.cost);
  const errors = { name: draft.name.trim() ? null : "Informe o nome do item.", price: isProduto && !(num(draft.price) > 0) ? "Informe o preço de venda." : null };
  const problems = tried ? Object.values(errors).filter(Boolean).length : 0;
  const taxFilled = !!(draft.ncm.trim() || draft.cst.trim() || num(draft.taxRate));

  const save = async () => {
    setTried(true);
    if (errors.name || errors.price) return;
    if (composed && (lines.some((l) => !l.match || num(l.qty) <= 0) || lines.length === 0)) {
      return onError("Revise a ficha técnica: cada componente precisa de um item do Catálogo e quantidade");
    }
    const payload: UpsertProductRequest = {
      name: draft.name.trim(),
      type: draft.type,
      unit: draft.unit,
      price: isProduto ? num(draft.price) : 0,
      cost: composed ? 0 : num(draft.cost),
      ncm: draft.ncm.trim(),
      cst: draft.cst.trim(),
      taxRate: num(draft.taxRate),
      composed,
      components: composed ? lines.map((l) => ({ componentId: l.match!.id, quantity: num(l.qty) })) : [],
      categoryId: draft.categoryId
    };
    setSaving(true);
    try {
      let saved = draft.id ? await api.updateProduct(draft.id, payload) : await api.createProduct(payload);
      // Saldo inicial: an entry like any other (the history shows where the stock came from).
      if (!draft.id && !composed && num(draft.stock) > 0) saved = await api.adjustStock(saved.id, "in", num(draft.stock), "Saldo inicial");
      onSaved(saved);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Não foi possível salvar o item");
    } finally {
      setSaving(false);
    }
  };

  const money = (value: string, onChange: (v: string) => void, text: string, error: string | null = null) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <span style={label}>{text}</span>
      <div style={{ position: "relative" }}>
        <span className="mono" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--ink2)" }}>
          R$
        </span>
        <input className="field mono" inputMode="decimal" placeholder="0,00" aria-invalid={!!error} value={value} onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ""))} style={{ paddingLeft: 44, fontWeight: 600, ...(error ? { border: "1.5px solid var(--alert)" } : {}) }} />
      </div>
      {fieldError(error)}
    </label>
  );
  const withUnit = (value: string, onChange: (v: string) => void, text: string) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <span style={label}>{text}</span>
      <div style={{ position: "relative" }}>
        <input className="field mono" inputMode="decimal" placeholder="0" value={value} onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ""))} style={{ paddingRight: 44, fontWeight: 600 }} />
        <span className="mono" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "var(--ink2)" }}>
          {draft.unit}
        </span>
      </div>
    </label>
  );
  const locked = { ...label, display: "flex", alignItems: "center", gap: 6 } as const;
  const grid3 = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14, alignItems: "start" } as const;

  return (
    <SlideOver
      title={draft.id ? current?.name ?? draft.name : "Novo item"}
      subtitle={draft.id ? TYPE_LABEL[draft.type] : "Produtos · Catálogo"}
      onClose={() => setDraft(null)}
      discardName={draft.id ? current?.name ?? draft.name : undefined}
      sheet={{ saveLabel: draft.id ? "Salvar" : "Criar item", onSave: save, saving, dirty, status: draft.id ? (dirty ? "Alterações não salvas" : "Sem alterações") : "Item novo" }}
    >
      {problems > 0 && (
        <div role="alert" style={{ display: "flex", gap: 10, alignItems: "center", padding: "12px 14px", borderRadius: 12, background: "color-mix(in srgb, var(--alert) 14%, var(--surface))", color: "var(--alert)", fontSize: "var(--text-subheadline)", fontWeight: 500 }}>
          <i className="fa-solid fa-circle-exclamation" aria-hidden="true" style={{ fontSize: "var(--icon-sm)" }} />
          Corrija {problems === 1 ? "1 campo" : `${problems} campos`} para salvar.
        </div>
      )}

      <Section title="Dados" first>
        <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <span style={label}>Nome</span>
          <input className="field" value={draft.name} maxLength={80} placeholder={isProduto ? "Ex.: X-Salada" : "Ex.: Pão brioche"} aria-invalid={tried && !!errors.name} onChange={(e) => set({ name: e.target.value })} style={tried && errors.name ? { border: "1.5px solid var(--alert)" } : undefined} />
          {tried && fieldError(errors.name)}
        </label>
        <div style={grid3}>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <span style={locked}>
              Tipo{draft.id && <i className="fa-solid fa-lock" aria-hidden="true" style={{ fontSize: "var(--icon-sm)" }} />}
            </span>
            {draft.id ? (
              <div className="field" style={{ background: "var(--surface3)", color: "var(--ink2)" }}>
                {TYPE_LABEL[draft.type]}
              </div>
            ) : (
              <Segmented
                value={draft.type}
                onChange={(type) => set({ type })}
                options={[
                  { value: "produto", label: "Produto" },
                  { value: "insumo", label: "Insumo" }
                ]}
              />
            )}
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <span style={locked}>
              Unidade{current?.unitLocked && <i className="fa-solid fa-lock" aria-hidden="true" style={{ fontSize: "var(--icon-sm)" }} />}
            </span>
            {/* Once stock moved, the history and the fichas técnicas are in this unit: it can't change (the API refuses too). */}
            <select className="field" value={draft.unit} disabled={!!current?.unitLocked} aria-describedby={current?.unitLocked ? "unit-locked" : undefined} onChange={(e) => set({ unit: e.target.value })} style={current?.unitLocked ? { background: "var(--surface3)", color: "var(--ink2)" } : undefined}>
              {PRODUCT_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <span style={label}>Categoria</span>
              <select className="field" value={draft.categoryId ?? ""} onChange={(e) => set({ categoryId: e.target.value || null })}>
                <option value="">{NO_CATEGORY}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={newCategory.create} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 5, border: 0, background: "transparent", padding: 0, cursor: "pointer", font: "inherit", fontSize: "var(--text-subheadline)", fontWeight: 600, color: "var(--brandText)" }}>
              <i className="fa-solid fa-plus" style={{ fontSize: "var(--icon-sm)" }} />
              Nova categoria
            </button>
          </div>
        </div>
        {draft.id && (
          <div id="unit-locked" style={{ display: "flex", gap: 8, alignItems: "baseline", ...help }}>
            <i className="fa-solid fa-lock" aria-hidden="true" style={{ fontSize: "var(--icon-sm)" }} />
            <span>
              O tipo não muda depois de criado.{current?.unitLocked && " A unidade não pode mudar depois que o produto teve movimentação. Cadastre um novo produto."}
            </span>
          </div>
        )}
      </Section>

      <Section title={isProduto ? "Preço e custo" : "Custo"}>
        <div style={grid3}>
          {isProduto && money(draft.price, (price) => set({ price }), "Preço de venda", tried ? errors.price : null)}
          {composed || current?.costLocked ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <span style={locked}>
                {composed ? "Custo" : isProduto ? "Custo" : "Custo médio"} <i className="fa-solid fa-lock" aria-hidden="true" style={{ fontSize: "var(--icon-sm)" }} />
              </span>
              <div className="field mono" aria-describedby="cost-help" style={{ background: "var(--surface3)", color: "var(--ink2)", fontWeight: 600 }}>
                {brl(composed ? autoCost : current!.cost)}
              </div>
            </div>
          ) : (
            money(draft.cost, (c) => set({ cost: c }), draft.id ? (isProduto ? "Custo" : "Custo médio") : "Custo inicial")
          )}
          {isProduto && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <span style={label}>Margem</span>
              <div className="mono" style={{ minHeight: 44, display: "flex", alignItems: "center", fontSize: "var(--text-headline)", fontWeight: 600, color: margin !== "—" && cost > num(draft.price) ? "var(--alert)" : "var(--ok)" }}>
                {margin}
              </div>
            </div>
          )}
        </div>
        <div id="cost-help" style={help}>
          {composed
            ? "Calculado pela ficha técnica com o custo médio de cada componente."
            : current?.costLocked
              ? "Travado depois da primeira movimentação: muda sozinho a cada entrada de nota (média ponderada). Para corrigir, use Ajustar estoque e informe o custo."
              : draft.id
                ? "Muda sozinho a cada entrada de nota (média ponderada). Corrija aqui se precisar."
                : "Depois da primeira entrada de estoque, o custo passa a ser a média das entradas."}
        </div>
      </Section>

      <Section title="Estoque">
        {composed ? (
          <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "13px 15px", borderRadius: 14, background: "var(--surface2)", border: "1px solid var(--line)", fontSize: "var(--text-subheadline)", color: "var(--ink2)" }}>
            <i className="fa-solid fa-diagram-project" aria-hidden="true" style={{ fontSize: "var(--icon-sm)" }} />
            <span style={{ flex: 1 }}>Sem saldo próprio. Cada venda baixa os componentes da ficha técnica.</span>
          </div>
        ) : !current ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
            {withUnit(draft.stock, (stock) => set({ stock }), "Saldo inicial")}
            {/* EST-04 (not built yet): "Avisar quando o saldo chegar a · opcional" goes in this column. */}
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={label}>Saldo atual</span>
              <span className="mono" style={{ fontSize: "var(--text-headline)", fontWeight: 600, color: current.stock < 0 ? "var(--alert)" : "var(--ink)" }}>
                {qty(current.stock)} {current.unit}
              </span>
              <StatusPill p={current} />
              {/* EST-04: the "Abaixo do aviso" pill and the warning field go here. */}
              <span style={{ flex: 1 }} />
              <button type="button" className="btn btn-outline" aria-expanded={adjusting} onClick={() => setAdjusting(!adjusting)}>
                <i className="fa-solid fa-arrow-right-arrow-left" aria-hidden="true" style={{ fontSize: "var(--icon-sm)" }} />
                Ajustar estoque
              </button>
            </div>
            {adjusting && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16, borderRadius: 16, border: "1px solid var(--line)", background: "var(--surface2)" }}>
                <Segmented
                  value={adj.kind}
                  onChange={(kind) => setAdj({ ...adj, kind })}
                  options={[
                    { value: "in", label: "Entrada" },
                    { value: "out", label: "Saída" },
                    { value: "count", label: "Contagem" }
                  ]}
                />
                <div style={help}>{ADJUST_HINT[adj.kind]}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
                  <input className="field mono" inputMode="decimal" placeholder={`Qtd. (${current.unit})`} aria-label="Quantidade do ajuste" value={adj.qty} onChange={(e) => setAdj({ ...adj, qty: e.target.value.replace(/[^0-9.,]/g, "") })} style={{ background: "var(--surface)" }} />
                  <div style={{ position: "relative" }}>
                    <span className="mono" aria-hidden="true" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--ink2)" }}>
                      R$
                    </span>
                    <input className="field mono" inputMode="decimal" placeholder={`Custo/${current.unit} (opcional)`} aria-label={`Custo por ${current.unit} (opcional)`} aria-describedby="adjust-cost-help" value={adj.cost} onChange={(e) => setAdj({ ...adj, cost: e.target.value.replace(/[^0-9.,]/g, "") })} style={{ background: "var(--surface)", paddingLeft: 44 }} />
                  </div>
                  <input className="field" maxLength={80} placeholder="Motivo (opcional)" aria-label="Motivo do ajuste" value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} style={{ background: "var(--surface)", gridColumn: "1 / -1" }} />
                </div>
                <div id="adjust-cost-help" style={help}>
                  Custo, se informado, substitui o atual ({brl(current.cost)}/{current.unit}) e fica registrado na movimentação. Só o custo, sem quantidade, corrige o custo sem mexer no saldo.
                </div>
                <button type="button" className="btn btn-outline" style={{ alignSelf: "flex-start" }} disabled={saving || !(adj.qty || adj.cost)} onClick={adjust}>
                  {!adj.qty && adj.cost ? "Registrar custo" : `Registrar ${adj.kind === "count" ? "contagem" : adj.kind === "in" ? "entrada" : "saída"}`}
                </button>
              </div>
            )}
          </>
        )}
      </Section>

      {isProduto && (
        <Section title="Ficha técnica">
          <button
            type="button"
            role="switch"
            aria-checked={composed}
            onClick={() => set({ composed: !draft.composed, lines: !draft.composed && draft.lines.length === 0 ? [{ name: "", qty: "" }] : draft.lines })}
            style={{ display: "flex", alignItems: "center", gap: 14, border: 0, background: "transparent", padding: 0, cursor: "pointer", textAlign: "left", color: "var(--ink)", font: "inherit" }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: "var(--text-body)", fontWeight: 500 }}>Produto composto</span>
              <span style={{ display: "block", ...help }}>Montado com insumos. Custo e baixa de estoque passam a vir da ficha técnica.</span>
            </span>
            <span className="toggle-track" style={{ width: 44, height: 26, flex: "0 0 44px", background: composed ? "var(--ok)" : "var(--line2)" }}>
              <span className="toggle-knob" style={{ top: 3, width: 20, height: 20, left: composed ? 21 : 3 }} />
            </span>
          </button>

          {composed && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="comp-line comp-head">
                {["Componente", "Qtd.", "", "Custo", ""].map((h, i) => (
                  <div key={i} className="field-label" style={{ textAlign: h === "Custo" ? "right" : undefined }}>
                    {h}
                  </div>
                ))}
              </div>
              {lines.map((l, i) => (
                <div key={i} className="comp-line">
                  <input
                    className="field"
                    list="product-component-options"
                    placeholder="Buscar item"
                    aria-label="Produto ou insumo"
                    value={l.name}
                    onChange={(e) => setLine(i, { name: e.target.value })}
                    style={{ padding: "9px 10px", fontSize: "var(--text-subheadline)", background: "var(--surface)", borderColor: l.name && !l.match ? "var(--warn)" : undefined }}
                  />
                  <input
                    className="field mono"
                    inputMode="decimal"
                    placeholder="0"
                    aria-label="Quantidade"
                    value={l.qty}
                    onChange={(e) => setLine(i, { qty: e.target.value.replace(/[^0-9.,]/g, "") })}
                    style={{ padding: "9px 10px", fontSize: "var(--text-subheadline)", background: "var(--surface)" }}
                  />
                  <div style={{ fontSize: "var(--text-footnote)", color: "var(--ink2)" }}>{l.match?.unit}</div>
                  <div className="mono" style={{ fontSize: "var(--text-subheadline)", fontWeight: 600, textAlign: "right" }}>
                    {l.match && num(l.qty) ? brl(l.cost) : "—"}
                  </div>
                  <button
                    type="button"
                    title="Remover"
                    aria-label="Remover componente"
                    onClick={() => set({ lines: draft.lines.filter((_, j) => j !== i) })}
                    style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink2)", cursor: "pointer", display: "grid", placeItems: "center" }}
                  >
                    <i className="fa-solid fa-xmark" style={{ fontSize: "var(--icon-sm)" }} />
                  </button>
                </div>
              ))}
              <datalist id="product-component-options">
                {options.map((p) => (
                  <option key={p.id} value={p.name}>
                    {`${TYPE_LABEL[p.type]} · ${p.unit} · ${brl(p.cost)}`}
                  </option>
                ))}
              </datalist>
              <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 6 }}>
                <button
                  type="button"
                  onClick={() => set({ lines: [...draft.lines, { name: "", qty: "" }] })}
                  style={{ display: "flex", alignItems: "center", gap: 7, border: 0, background: "transparent", padding: "4px 0", cursor: "pointer", fontSize: "var(--text-subheadline)", fontWeight: 600, color: "var(--brandText)" }}
                >
                  <i className="fa-solid fa-plus" style={{ fontSize: "var(--icon-sm)" }} />
                  Adicionar componente
                </button>
                <div style={{ flex: 1 }} />
                <div style={help}>Custo da ficha</div>
                <div className="mono" style={{ fontSize: "var(--text-body)", fontWeight: 600 }}>
                  {brl(autoCost)}
                </div>
              </div>
            </div>
          )}
        </Section>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
        <button type="button" aria-expanded={taxOpen} onClick={() => setTaxOpen(!taxOpen)} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 52, border: 0, background: "transparent", padding: 0, cursor: "pointer", font: "inherit", color: "var(--ink)", textAlign: "left" }}>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: "var(--text-headline)", fontWeight: 600, letterSpacing: "-.01em" }}>Tributação</span>
            <span style={{ display: "block", ...help }}>NCM, CST/CSOSN e alíquota · usada só na emissão de nota fiscal</span>
          </span>
          <span style={{ fontSize: "var(--text-subheadline)", color: "var(--ink2)" }}>{taxFilled ? "Preenchida" : "Não preenchida"}</span>
          <i className={`fa-solid ${taxOpen ? "fa-chevron-up" : "fa-chevron-down"}`} aria-hidden="true" style={{ fontSize: "var(--icon-sm)", color: "var(--ink2)" }} />
        </button>
        {taxOpen && (
          <>
            <div style={grid3}>
              <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <span style={label}>NCM</span>
                <input inputMode="numeric" className="field mono" maxLength={20} placeholder="0000.00.00" value={draft.ncm} onChange={(e) => set({ ncm: e.target.value })} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <span style={label}>CST/CSOSN</span>
                <input inputMode="numeric" className="field mono" maxLength={20} placeholder="102" value={draft.cst} onChange={(e) => set({ cst: e.target.value })} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <span style={label}>Alíquota</span>
                <div style={{ position: "relative" }}>
                  <input className="field mono" inputMode="decimal" placeholder="0,00" value={draft.taxRate} onChange={(e) => set({ taxRate: e.target.value.replace(/[^0-9.,]/g, "") })} style={{ paddingRight: 36 }} />
                  <span className="mono" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "var(--ink2)" }}>
                    %
                  </span>
                </div>
              </label>
            </div>
            <div style={help}>Preencha quando o restaurante passar a emitir nota fiscal ou se o contador pedir.</div>
          </>
        )}
      </div>
      {newCategory.dialog}
    </SlideOver>
  );
}
