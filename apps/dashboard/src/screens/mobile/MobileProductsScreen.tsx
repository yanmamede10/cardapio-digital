import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import type { MenuCategory, Product, StockMovement } from "@cardapio/shared";
import { ApiError, api } from "../../lib/api";
import { brl, dayMonth, localIso } from "../../lib/format";
import { useMobileScreen } from "../../components/mobile/MobileLayout";
import { MobileChip } from "../../components/mobile/MobileChip";
import { MobileEmptyState } from "../../components/mobile/MobileEmptyState";
import { ActionSheet } from "../../components/mobile/ActionSheet";
import { CategoryReorderPanel } from "../../components/mobile/CategoryReorderPanel";
import { FilterPopover, type FilterValues } from "../../components/FilterPopover";
import { Segmented } from "../../components/Segmented";
import { useCategoryDialog } from "../../components/CategoryDialog";
import { NO_CATEGORY_GROUP } from "../MenuScreen";
import {
  EMPTY_DRAFT,
  MOVEMENT_FILTERS,
  NONE_NOTE,
  NO_FILTER,
  ONLY_INSUMOS,
  PRODUCTS_CATEGORY_HELP,
  ProductForm,
  StatusPill,
  TYPE_LABEL,
  TYPE_OPTIONS,
  catalogGroups,
  countLabel,
  draftOf,
  movementMatch,
  parseNfe,
  pill,
  movementQty,
  movementSource,
  movementTag,
  qty,
  type CatalogFilter,
  type Draft
} from "../ProductsScreen";

const card = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" } as const;

export default function MobileProductsScreen() {
  const location = useLocation();
  const [tab, setTab] = useState<"catalogo" | "mov">("catalogo");
  const [products, setProducts] = useState<Product[] | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [filter, setFilter] = useState<CatalogFilter>(NO_FILTER);
  const [closed, setClosed] = useState<string[]>([]);
  const [menuFor, setMenuFor] = useState<MenuCategory | null>(null); // the "…" of a category
  const [ordering, setOrdering] = useState(false);
  const [movFilter, setMovFilter] = useState<FilterValues>({});
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const { notify } = useMobileScreen({
    title: "Produtos",
    subtitle: tab === "catalogo" ? "Catálogo e estoque" : "Entradas e saídas de estoque",
    fab: tab === "catalogo" && products ? { label: "Novo item", onClick: () => setDraft({ ...EMPTY_DRAFT }) } : undefined
  });

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
  const moveCat = async (c: MenuCategory, dir: "up" | "down") => {
    try {
      await api.moveCategory(c.id, dir);
      reload();
    } catch {
      // already first/last
    }
  };

  useEffect(() => {
    reload()
      .then((p) => {
        // Cardápio's "Abrir no Catálogo" lands here with the product to edit.
        const target = p.find((x) => x.id === (location.state as { edit?: string } | null)?.edit);
        if (target) setDraft(draftOf(target));
      })
      .catch((err) => setError(err instanceof ApiError && err.status === 403 ? "Você não tem permissão para acessar Produtos." : "Não foi possível carregar Produtos."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  if (error) return <p style={{ padding: 16, color: "var(--ink2)" }}>{error}</p>;
  if (!products) {
    return (
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton" style={{ height: 64 }} />
        ))}
      </div>
    );
  }

  const { shown, groups, filtered, chips } = catalogGroups(products, categories, filter);
  const set = (patch: Partial<CatalogFilter>) => setFilter({ ...filter, ...patch });
  const shownMovements = movements.filter((m) => movementMatch(m, movFilter));
  const pickXml = () => fileInput.current?.click();

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
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
      <div className="glass" style={{ position: "sticky", top: 0, zIndex: 5, padding: "11px 12px 9px", borderBottom: "1px solid var(--glassBd)", display: "flex", flexDirection: "column", gap: 9 }}>
        <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
          <MobileChip grow active={tab === "catalogo"} onClick={() => setTab("catalogo")}>
            Catálogo
          </MobileChip>
          <MobileChip grow active={tab === "mov"} onClick={() => setTab("mov")}>
            Movimentações
          </MobileChip>
          {tab === "mov" && movements.length > 0 && <FilterPopover sheet groups={MOVEMENT_FILTERS} value={movFilter} onChange={setMovFilter} resultCount={shownMovements.length} />}
        </div>
        {tab === "catalogo" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 9, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 11, padding: "0 4px 0 12px", minHeight: 44 }}>
                <i className="fa-solid fa-magnifying-glass" aria-hidden="true" style={{ fontSize: 14, color: "var(--ink3)" }} />
                <input value={filter.q} onChange={(e) => set({ q: e.target.value })} placeholder="Buscar por nome" aria-label="Buscar por nome" style={{ border: 0, background: "transparent", outline: "none", font: "inherit", fontSize: "var(--text-headline)", color: "var(--ink)", width: "100%", minWidth: 0 }} />
                {filter.q && (
                  <button type="button" aria-label="Limpar busca" onClick={() => set({ q: "" })} style={{ border: 0, background: "transparent", color: "var(--ink3)", cursor: "pointer" }}>
                    <i className="fa-solid fa-circle-xmark" style={{ fontSize: 15 }} />
                  </button>
                )}
              </div>
              <button type="button" aria-label="Nova categoria" title="Nova categoria" onClick={cats.create} style={{ width: 44, height: 44, flex: "0 0 44px", borderRadius: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface2)", color: "var(--brandText)", border: "1px solid var(--line)" }}>
                <i className="fa-solid fa-folder-plus" style={{ fontSize: 17 }} />
              </button>
            </div>
            {products.length > 0 && (
              <>
                <div className="no-scrollbar" style={{ display: "flex", gap: 7, overflowX: "auto", margin: "0 -12px", padding: "0 12px" }}>
                  <MobileChip active={filter.cat === null} onClick={() => set({ cat: null })}>
                    Todas
                  </MobileChip>
                  {chips.map((c) => (
                    <MobileChip key={c.id || "none"} active={filter.cat === c.id} onClick={() => set({ cat: c.id })}>
                      {c.name}
                    </MobileChip>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Segmented value={filter.tipo} onChange={(tipo) => set({ tipo })} options={TYPE_OPTIONS} />
                  </div>
                  <span className="mono" style={{ fontSize: "var(--text-footnote)", color: "var(--ink2)", whiteSpace: "nowrap" }}>
                    {filtered ? `${shown.length} de ${countLabel(products.length)}` : countLabel(products.length)}
                  </span>
                </div>
              </>
            )}
          </>
        )}
        {tab === "mov" && (
          <button type="button" className="btn btn-primary" style={{ minHeight: 44 }} disabled={importing} onClick={pickXml}>
            <i className="fa-solid fa-file-import" style={{ fontSize: 13 }} />
            {importing ? "Importando…" : "Importar XML"}
          </button>
        )}
      </div>

      <div style={{ padding: "12px 12px 90px", display: "flex", flexDirection: "column", gap: 10 }}>
        {tab === "catalogo" ? (
          ordering ? (
            <CategoryReorderPanel categories={categories} onCreate={cats.create} onRename={cats.rename} onDelete={cats.remove} onMove={moveCat} onDone={() => setOrdering(false)} />
          ) : products.length === 0 && categories.length === 0 ? (
            <MobileEmptyState
              icon="fa-box-open"
              title="Seu catálogo ainda está vazio"
              sub="Cadastre o que você vende (produtos) e o que usa no preparo (insumos). Categorias como Hambúrgueres ou Carnes organizam os dois e o cardápio."
              action={
                <button type="button" className="btn btn-primary" style={{ minHeight: 48 }} onClick={() => setDraft({ ...EMPTY_DRAFT })}>
                  <i className="fa-solid fa-plus" style={{ fontSize: 13 }} />
                  Cadastrar primeiro item
                </button>
              }
            />
          ) : filtered && shown.length === 0 ? (
            <MobileEmptyState
              icon="fa-magnifying-glass"
              title={filter.q.trim() ? `Nenhum item com “${filter.q.trim()}”` : "Nenhum item com esses filtros"}
              sub="A busca olha o nome em todas as categorias e nos dois tipos."
              action={
                <button type="button" className="btn btn-outline" style={{ minHeight: 48 }} onClick={() => setFilter(NO_FILTER)}>
                  {filter.q.trim() ? "Limpar busca" : "Limpar filtros"}
                </button>
              }
            />
          ) : (
            groups.map((g) => {
              const open = !closed.includes(g.cat.id);
              const note = g.cat === NO_CATEGORY_GROUP ? NONE_NOTE : g.items.length && g.items.every((p) => p.type === "insumo") ? ONLY_INSUMOS : null;
              return (
                <div key={g.cat.id || "none"} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <button type="button" aria-expanded={open} onClick={() => setClosed(open ? [...closed, g.cat.id] : closed.filter((x) => x !== g.cat.id))} style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, border: 0, background: "transparent", padding: "0 4px", cursor: "pointer", font: "inherit", color: "var(--ink)", textAlign: "left" }}>
                      <i className={`fa-solid ${open ? "fa-chevron-down" : "fa-chevron-right"}`} style={{ fontSize: 11, width: 12, color: "var(--ink3)" }} />
                      <span style={{ fontSize: "var(--text-headline)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.cat.name}</span>
                      <span className="mono" style={{ fontSize: "var(--text-footnote)", color: "var(--ink2)", background: "var(--surface3)", borderRadius: 999, padding: "1px 9px" }}>
                        {g.items.length}
                      </span>
                    </button>
                    {g.cat !== NO_CATEGORY_GROUP && (
                      <button type="button" aria-label={`Opções da categoria ${g.cat.name}`} onClick={() => setMenuFor(g.cat)} style={{ width: 44, height: 44, border: 0, background: "transparent", color: "var(--ink2)", cursor: "pointer" }}>
                        <i className="fa-solid fa-ellipsis" style={{ fontSize: 16 }} />
                      </button>
                    )}
                  </div>
                  {note && <div style={{ fontSize: "var(--text-footnote)", color: "var(--ink2)", padding: "0 4px 4px" }}>{note}</div>}
                  {open && (
                    <section style={card}>
                      {g.items.length === 0 && <div style={{ padding: "14px 16px", fontSize: "var(--text-subheadline)", color: "var(--ink2)" }}>Nenhum item nesta categoria ainda.</div>}
                      {g.items.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setDraft(draftOf(p))}
                          style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: "transparent", border: 0, borderBottom: "1px solid var(--line)", cursor: "pointer", font: "inherit", color: "var(--ink)", padding: "10px 14px 10px 16px", minHeight: 66 }}
                        >
                          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                            <div style={{ fontSize: "var(--text-headline)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <StatusPill p={p} />
                              <span style={{ fontSize: "var(--text-subheadline)", color: "var(--ink2)" }}>{p.type === "produto" ? brl(p.price) : TYPE_LABEL[p.type]}</span>
                            </div>
                          </div>
                          <span className="mono" style={{ fontSize: "var(--text-body)", fontWeight: 600, whiteSpace: "nowrap", color: p.composed ? "var(--ink2)" : p.stock > 0 ? "var(--ink)" : "var(--alert)" }}>
                            {p.composed ? "Composto" : `${qty(p.stock)} ${p.unit}`}
                          </span>
                          <i className="fa-solid fa-chevron-right" aria-hidden="true" style={{ fontSize: 11, color: "var(--ink3)" }} />
                        </button>
                      ))}
                    </section>
                  )}
                </div>
              );
            })
          )
        ) : movements.length === 0 ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) importFile(file);
            }}
            style={{ ...card, borderStyle: "dashed", borderColor: "var(--line2)", padding: "30px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}
          >
            <div style={{ width: 54, height: 54, borderRadius: 16, background: "var(--brandSoft)", color: "var(--brandText)", display: "grid", placeItems: "center" }}>
              <i className="fa-solid fa-file-import" style={{ fontSize: 21 }} />
            </div>
            <div style={{ fontSize: "var(--text-subheadline)", color: "var(--ink2)" }}>Arraste o arquivo da nota do fornecedor. Os itens entram no estoque automaticamente.</div>
            <button type="button" className="btn btn-primary" style={{ minHeight: 44 }} disabled={importing} onClick={pickXml}>
              Selecionar
            </button>
          </div>
        ) : shownMovements.length === 0 ? (
          <MobileEmptyState icon="fa-filter" title="Nenhuma movimentação" sub="Nenhum resultado com esses filtros." />
        ) : (
          <section style={card}>
            {shownMovements.map((m) => {
              const xml = m.source.toLowerCase().endsWith(".xml");
              return (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderBottom: "1px solid var(--line)", minHeight: 62 }}>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ ...pill(movementTag(m).tone), fontSize: "var(--text-caption)", padding: "1px 8px" }}>{movementTag(m).label}</span>
                      <span style={{ fontSize: "var(--text-body)", fontWeight: 500, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.productName}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--text-footnote)", color: "var(--ink3)", minWidth: 0 }}>
                      <i className={`fa-solid ${xml ? "fa-file-code" : "fa-receipt"}`} style={{ fontSize: 11 }} />
                      <span className={xml ? "mono" : undefined} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {movementSource(m)}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                    <span className="mono" style={{ fontSize: "var(--text-subheadline)", fontWeight: 600, color: m.kind === "in" ? "var(--ok)" : "var(--ink)", whiteSpace: "nowrap" }}>
                      {movementQty(m)}
                    </span>
                    <span className="mono" style={{ fontSize: "var(--text-caption)", color: "var(--ink3)" }}>
                      {dayMonth(localIso(new Date(m.createdAt)))}
                    </span>
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </div>

      <ActionSheet
        open={!!menuFor}
        onClose={() => setMenuFor(null)}
        title={menuFor?.name ?? ""}
        actions={
          menuFor
            ? [
                { label: "Renomear", icon: "fa-pen", onClick: () => (setMenuFor(null), cats.rename(menuFor)) },
                { label: "Excluir", icon: "fa-trash", danger: true, onClick: () => (setMenuFor(null), cats.remove(menuFor)) },
                { label: "Ordenar categorias", icon: "fa-grip-vertical", onClick: () => (setMenuFor(null), setOrdering(true)) }
              ]
            : []
        }
      />
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
