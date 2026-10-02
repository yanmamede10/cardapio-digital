import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { PRODUCT_UNITS, type Product, type ProductType, type StockMovement, type UpsertProductRequest, type XmlImportRequest } from "@cardapio/shared";
import { ApiError, api } from "../lib/api";
import { brl, dayMonth, localIso } from "../lib/format";
import { useDashboardState } from "../state/DashboardStateContext";
import { Segmented } from "../components/Segmented";
import { SlideOver } from "../components/SlideOver";
import { FilterPopover, PAST_PERIODS, inPeriod, type FilterGroup, type FilterValues } from "../components/FilterPopover";

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
}

export const EMPTY_DRAFT: Draft = { id: null, name: "", type: "produto", unit: "un", price: "", cost: "", ncm: "", cst: "", taxRate: "", composed: false, lines: [] };

/** "1.234,5" and "0.35" both parse — a comma means pt-BR decimals, otherwise the dot is the decimal point. */
const num = (s: string) => Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s) || 0;
const decimal = (n: number) => (n ? String(n).replace(".", ",") : "");
export const qty = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
export const pill = (tone: string) => ({ fontSize: 11.5, fontWeight: 600, borderRadius: 999, padding: "2px 11px", whiteSpace: "nowrap" as const, background: `color-mix(in srgb, var(--${tone}) 16%, transparent)`, color: `var(--${tone})` });
const headRow = { display: "grid", gap: 16, padding: "12px 20px", background: "var(--surface2)", borderBottom: "1px solid var(--line)" } as const;
export const TYPE_LABEL: Record<ProductType, string> = { produto: "Produto", insumo: "Insumo" };

export const CATALOG_FILTERS: FilterGroup[] = [
  { id: "tipo", label: "Tipo", options: ["Produto", "Insumo"] },
  { id: "status", label: "Status", options: ["Em estoque", "Sem estoque", "Ficha técnica"] }
];
export const MOVEMENT_FILTERS: FilterGroup[] = [
  { id: "tipo", label: "Tipo", options: ["Entrada", "Saída"] },
  { id: "per", label: "Período", options: PAST_PERIODS }
];
export const catalogMatch = (p: Product, f: FilterValues) => (!f.tipo || TYPE_LABEL[p.type] === f.tipo) && (!f.status || stockStatus(p).label === f.status);
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
  lines: p.components.map((c) => ({ name: c.name, qty: decimal(c.quantity) }))
});

export function stockStatus(p: Product) {
  if (p.composed) return { label: "Ficha técnica", tone: "ink3" };
  return p.stock > 0 ? { label: "Em estoque", tone: "ok" } : { label: "Sem estoque", tone: "alert" };
}

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
  const [catFilter, setCatFilter] = useState<FilterValues>({});
  const [movFilter, setMovFilter] = useState<FilterValues>({});
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const reload = () =>
    Promise.all([api.listProducts(), api.listStockMovements()]).then(([p, m]) => {
      setProducts(p);
      setMovements(m);
      return p;
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

  const shownProducts = products.filter((p) => catalogMatch(p, catFilter));
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
    <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 1120 }}>
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
        <section className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>Produtos e insumos</div>
            <FilterPopover
              groups={CATALOG_FILTERS}
              value={catFilter}
              onChange={setCatFilter}
              resultCount={shownProducts.length}
            />
            <button type="button" className="btn btn-primary" onClick={() => setDraft({ ...EMPTY_DRAFT })}>
              <i className="fa-solid fa-plus" style={{ fontSize: 13 }} />
              Novo item
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 760 }}>
              <div style={{ ...headRow, gridTemplateColumns: "minmax(160px,1fr) 110px 120px 110px 120px 18px" }}>
                {["Item", "Tipo", "Estoque atual", "Custo", "Status", ""].map((h) => (
                  <div key={h} className="field-label">
                    {h}
                  </div>
                ))}
              </div>
              {shownProducts.map((p) => {
                const st = stockStatus(p);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => openEdit(p)}
                    style={{ display: "grid", gridTemplateColumns: "minmax(160px,1fr) 110px 120px 110px 120px 18px", gap: 16, alignItems: "center", width: "100%", textAlign: "left", padding: "13px 20px", border: 0, borderBottom: "1px solid var(--line)", background: "transparent", cursor: "pointer", color: "var(--ink)" }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }}>{p.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>{p.type === "produto" && p.price ? brl(p.price) : p.unit}</div>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--ink2)" }}>{TYPE_LABEL[p.type]}</div>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: p.composed ? "var(--ink3)" : p.stock > 0 ? "var(--ink)" : "var(--alert)" }}>
                      {p.composed ? "Composto" : `${qty(p.stock)} ${p.unit}`}
                    </div>
                    <div className="mono" style={{ fontSize: 13 }}>
                      {brl(p.cost)}
                    </div>
                    <div>
                      <span style={pill(st.tone)}>{st.label}</span>
                    </div>
                    <i className="fa-solid fa-chevron-right" style={{ fontSize: 11, color: "var(--ink3)" }} />
                  </button>
                );
              })}
              {shownProducts.length === 0 && (
                <div style={{ padding: "36px 20px", textAlign: "center", fontSize: 13, color: "var(--ink3)" }}>
                  {products.length ? "Nenhum resultado com esses filtros." : "Nenhum item cadastrado ainda."}
                </div>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="card">
          {xmlInput}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>Histórico de entradas e saídas</div>
            {movements.length > 0 && (
              <FilterPopover
                groups={MOVEMENT_FILTERS}
                value={movFilter}
                onChange={setMovFilter}
                resultCount={shownMovements.length}
              />
            )}
            <button type="button" className="btn btn-primary" disabled={importing} onClick={() => fileInput.current?.click()}>
              <i className="fa-solid fa-file-import" style={{ fontSize: 13 }} />
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
                  <i className="fa-solid fa-file-import" style={{ fontSize: 22 }} />
                </div>
                <div style={{ fontSize: 13, color: "var(--ink2)", textWrap: "pretty" } as React.CSSProperties}>
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
                    <div key={m.id} style={{ display: "grid", gridTemplateColumns: "90px 100px minmax(160px,1fr) 110px minmax(180px,1.2fr)", gap: 16, padding: "14px 20px", borderBottom: "1px solid var(--line)", alignItems: "center", fontSize: 13 }}>
                      <div className="mono" style={{ fontSize: 12.5, color: "var(--ink2)" }}>
                        {dayMonth(localIso(new Date(m.createdAt)))}
                      </div>
                      <div>
                        <span style={pill(m.kind === "in" ? "ok" : "sec")}>{m.kind === "in" ? "Entrada" : "Saída"}</span>
                      </div>
                      <div style={{ fontWeight: 500 }}>{m.productName}</div>
                      <div className="mono" style={{ fontWeight: 600, color: m.kind === "in" ? "var(--ok)" : "var(--ink)" }}>
                        {m.kind === "in" ? "+" : "−"} {qty(m.quantity)} {m.unit}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, color: "var(--ink2)" }}>
                        <i className={`fa-solid ${xml ? "fa-file-code" : "fa-receipt"}`} style={{ fontSize: 12, color: "var(--ink3)" }} />
                        <span className={xml ? "mono" : undefined} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: xml ? 12 : undefined }}>
                          {m.source}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {shownMovements.length === 0 && <div style={{ padding: "36px 20px", textAlign: "center", fontSize: 13, color: "var(--ink3)" }}>Nenhum resultado com esses filtros.</div>}
              </div>
            </div>
          )}
        </section>
      )}

      {draft && (
        <ProductForm
          draft={draft}
          setDraft={setDraft}
          products={products}
          onSaved={(saved) => {
            setDraft(null);
            notify(`${saved.name} ${draft.id ? "atualizado" : "cadastrado"} no Catálogo`);
            reload();
          }}
          onAdjusted={(p) => {
            notify(`Estoque de ${p.name}: ${qty(p.stock)} ${p.unit}`);
            reload();
          }}
          onError={notify}
        />
      )}
    </div>
  );
}

const ADJUST_HINT = { in: "Chegou mercadoria sem nota", out: "Perda, quebra ou consumo interno", count: "Contei o estoque: fica exatamente esta quantidade" } as const;

export function ProductForm({
  draft,
  setDraft,
  products,
  onSaved,
  onAdjusted,
  onError
}: {
  draft: Draft;
  setDraft: (d: Draft | null) => void;
  products: Product[];
  onSaved: (p: Product) => void;
  /** After an Ajustar estoque (the form stays open, the list refreshes). */
  onAdjusted: (p: Product) => void;
  onError: (msg: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [adj, setAdj] = useState({ kind: "in" as keyof typeof ADJUST_HINT, qty: "", reason: "" });
  const current = draft.id ? products.find((p) => p.id === draft.id) : undefined;
  const adjust = async () => {
    if (!current || !adj.qty) return;
    setSaving(true);
    try {
      onAdjusted(await api.adjustStock(current.id, adj.kind, num(adj.qty), adj.reason.trim()));
      setAdj({ ...adj, qty: "", reason: "" });
    } catch (err) {
      onError(err instanceof ApiError && err.status === 400 ? "Informe uma quantidade válida" : err instanceof ApiError ? err.message : "Não foi possível ajustar o estoque");
    } finally {
      setSaving(false);
    }
  };
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
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

  const save = async () => {
    if (!draft.name.trim()) return onError("Informe o nome do item");
    if (composed && (lines.some((l) => !l.match || num(l.qty) <= 0) || lines.length === 0)) {
      return onError("Revise a composição: cada linha precisa de um item do Catálogo e quantidade");
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
      components: composed ? lines.map((l) => ({ componentId: l.match!.id, quantity: num(l.qty) })) : []
    };
    setSaving(true);
    try {
      onSaved(draft.id ? await api.updateProduct(draft.id, payload) : await api.createProduct(payload));
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Não foi possível salvar o item");
    } finally {
      setSaving(false);
    }
  };

  const money = (value: string, onChange: (v: string) => void, label: string) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span className="field-label">{label}</span>
      <div style={{ position: "relative" }}>
        <span className="mono" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--ink3)" }}>
          R$
        </span>
        <input className="field mono" inputMode="decimal" placeholder="0,00" value={value} onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ""))} style={{ paddingLeft: 44, fontWeight: 600 }} />
      </div>
    </label>
  );

  return (
    <SlideOver
      title={draft.id ? draft.name || "Editar item" : "Novo item"}
      subtitle="Produtos · Catálogo"
      width={520}
      onClose={() => setDraft(null)}
      footer={
        <>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn btn-outline" onClick={() => setDraft(null)}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>
            Salvar item
          </button>
        </>
      }
    >
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span className="field-label">Nome</span>
        <input className="field" value={draft.name} maxLength={80} placeholder={isProduto ? "Ex.: Hambúrguer da casa" : "Ex.: Pão brioche"} onChange={(e) => set({ name: e.target.value })} />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)", gap: 14, alignItems: "end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="field-label">Tipo</span>
          {draft.id ? (
            <div className="field" style={{ color: "var(--ink2)" }} title="O tipo não muda depois do cadastro">
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
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="field-label">Unidade de medida</span>
          {/* Once stock moved, the history and the fichas técnicas are in this unit: it can't change (the API refuses too). */}
          <select className="field" value={draft.unit} disabled={!!current?.unitLocked} aria-describedby={current?.unitLocked ? "unit-locked" : undefined} onChange={(e) => set({ unit: e.target.value })}>
            {PRODUCT_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
      </div>
      {current?.unitLocked && (
        <div id="unit-locked" style={{ fontSize: 12.5, color: "var(--ink2)", marginTop: -6 }}>
          A unidade não pode mudar depois que o produto teve movimentação. Cadastre um novo produto.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Valores</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14 }}>
          {isProduto && money(draft.price, (price) => set({ price }), "Preço de venda")}
          {composed ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="field-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                Custo <i className="fa-solid fa-lock" style={{ fontSize: 10 }} />
              </span>
              <div className="field mono" style={{ background: "var(--surface3)", color: "var(--ink2)", fontWeight: 600 }}>
                {brl(autoCost)}
              </div>
            </div>
          ) : (
            money(draft.cost, (cost) => set({ cost }), "Custo")
          )}
        </div>
        {composed && (
          <div style={{ fontSize: 12, color: "var(--ink3)" }}>
            Somado automaticamente pela composição abaixo (quantidade × custo médio atual de cada item). Para mudar o custo, ajuste os itens ou as quantidades.
          </div>
        )}
      </div>

      {current && !current.composed && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16, borderRadius: 16, border: "1px solid var(--line)", background: "var(--surface2)" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>Ajustar estoque</div>
            <div style={{ fontSize: 12.5, color: "var(--ink2)" }}>
              Atual: <span className="mono" style={{ fontWeight: 600, color: current.stock < 0 ? "var(--alert)" : "var(--ink)" }}>{qty(current.stock)} {current.unit}</span>
            </div>
          </div>
          <Segmented
            value={adj.kind}
            onChange={(kind) => setAdj({ ...adj, kind })}
            options={[
              { value: "in", label: "Entrada" },
              { value: "out", label: "Saída" },
              { value: "count", label: "Contagem" }
            ]}
          />
          <div style={{ fontSize: 12, color: "var(--ink3)" }}>{ADJUST_HINT[adj.kind]}</div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.6fr)", gap: 10 }}>
            <input className="field mono" inputMode="decimal" placeholder={`Qtd. (${current.unit})`} aria-label="Quantidade do ajuste" value={adj.qty} onChange={(e) => setAdj({ ...adj, qty: e.target.value.replace(/[^0-9.,]/g, "") })} style={{ background: "var(--surface)" }} />
            <input className="field" maxLength={80} placeholder="Motivo (opcional)" aria-label="Motivo do ajuste" value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} style={{ background: "var(--surface)" }} />
          </div>
          <button type="button" className="btn btn-outline" style={{ alignSelf: "flex-start" }} disabled={saving || !adj.qty} onClick={adjust}>
            Registrar {adj.kind === "count" ? "contagem" : adj.kind === "in" ? "entrada" : "saída"}
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Tributação</div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr) minmax(0,.8fr)", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="field-label">NCM</span>
            <input inputMode="numeric" className="field mono" maxLength={20} placeholder="0000.00.00" value={draft.ncm} onChange={(e) => set({ ncm: e.target.value })} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="field-label">CST / CSOSN</span>
            <input inputMode="numeric" className="field mono" maxLength={20} placeholder="102" value={draft.cst} onChange={(e) => set({ cst: e.target.value })} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="field-label">Alíquota %</span>
            <input className="field mono" inputMode="decimal" placeholder="0" value={draft.taxRate} onChange={(e) => set({ taxRate: e.target.value.replace(/[^0-9.,]/g, "") })} />
          </label>
        </div>
      </div>

      {isProduto && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: 16, borderRadius: 16, border: "1px solid var(--line)", background: "var(--surface2)" }}>
          <button
            type="button"
            role="switch"
            aria-checked={composed}
            onClick={() => set({ composed: !draft.composed, lines: !draft.composed && draft.lines.length === 0 ? [{ name: "", qty: "" }] : draft.lines })}
            style={{ display: "flex", alignItems: "center", gap: 14, border: 0, background: "transparent", padding: 0, cursor: "pointer", textAlign: "left", color: "var(--ink)" }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>Este item é composto por outros produtos/insumos?</span>
              <span style={{ display: "block", fontSize: 12, color: "var(--ink3)", marginTop: 2 }}>
                {composed ? "Sem estoque próprio: cada venda baixa o estoque dos itens da composição." : "Desligado: o item tem estoque próprio, controlado em Movimentações."}
              </span>
            </span>
            <span className="toggle-track" style={{ background: composed ? "var(--ok)" : "var(--line2)" }}>
              <span className="toggle-knob" style={{ left: composed ? 16 : 2 }} />
            </span>
          </button>

          {composed && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="comp-line comp-head">
                {["Produto ou insumo", "Qtd.", "", "Custo", ""].map((h, i) => (
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
                    style={{ padding: "9px 10px", fontSize: 13, background: "var(--surface)", borderColor: l.name && !l.match ? "var(--warn)" : undefined }}
                  />
                  <input
                    className="field mono"
                    inputMode="decimal"
                    placeholder="0"
                    aria-label="Quantidade"
                    value={l.qty}
                    onChange={(e) => setLine(i, { qty: e.target.value.replace(/[^0-9.,]/g, "") })}
                    style={{ padding: "9px 10px", fontSize: 13, background: "var(--surface)" }}
                  />
                  <div style={{ fontSize: 12, color: "var(--ink3)" }}>{l.match?.unit}</div>
                  <div className="mono" style={{ fontSize: 12.5, fontWeight: 600, textAlign: "right" }}>
                    {l.match && num(l.qty) ? brl(l.cost) : "—"}
                  </div>
                  <button
                    type="button"
                    title="Remover"
                    aria-label="Remover item da composição"
                    onClick={() => set({ lines: draft.lines.filter((_, j) => j !== i) })}
                    style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink3)", cursor: "pointer", display: "grid", placeItems: "center" }}
                  >
                    <i className="fa-solid fa-minus" style={{ fontSize: 11 }} />
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
                  style={{ display: "flex", alignItems: "center", gap: 7, border: 0, background: "transparent", padding: "4px 0", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--brandText)" }}
                >
                  <i className="fa-solid fa-plus" style={{ fontSize: 12 }} />
                  Adicionar item
                </button>
                <div style={{ flex: 1 }} />
                <div style={{ fontSize: 12, color: "var(--ink3)" }}>Total</div>
                <div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>
                  {brl(autoCost)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </SlideOver>
  );
}
