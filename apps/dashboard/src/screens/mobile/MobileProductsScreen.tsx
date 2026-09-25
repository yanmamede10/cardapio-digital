import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import type { Product, StockMovement } from "@cardapio/shared";
import { ApiError, api } from "../../lib/api";
import { brl, dayMonth, localIso } from "../../lib/format";
import { useMobileScreen } from "../../components/mobile/MobileLayout";
import { MobileChip } from "../../components/mobile/MobileChip";
import { MobileEmptyState } from "../../components/mobile/MobileEmptyState";
import { FilterPopover, type FilterValues } from "../../components/FilterPopover";
import {
  CATALOG_FILTERS,
  EMPTY_DRAFT,
  MOVEMENT_FILTERS,
  ProductForm,
  TYPE_LABEL,
  catalogMatch,
  draftOf,
  movementMatch,
  parseNfe,
  pill,
  qty,
  stockStatus,
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
  const [catFilter, setCatFilter] = useState<FilterValues>({});
  const [movFilter, setMovFilter] = useState<FilterValues>({});
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const { notify } = useMobileScreen({
    title: "Produtos",
    subtitle: tab === "catalogo" ? "Catálogo e estoque" : "Entradas e saídas de estoque",
    fab: tab === "catalogo" && products ? { label: "Novo item", onClick: () => setDraft({ ...EMPTY_DRAFT }) } : undefined
  });

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

  const shownProducts = products.filter((p) => catalogMatch(p, catFilter));
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
      <div style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--bg)", padding: "11px 12px 9px", borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 9 }}>
        <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
          <MobileChip grow active={tab === "catalogo"} onClick={() => setTab("catalogo")}>
            Catálogo
          </MobileChip>
          <MobileChip grow active={tab === "mov"} onClick={() => setTab("mov")}>
            Movimentações
          </MobileChip>
          {(tab === "catalogo" || movements.length > 0) && (
            <FilterPopover
              sheet
              groups={tab === "catalogo" ? CATALOG_FILTERS : MOVEMENT_FILTERS}
              value={tab === "catalogo" ? catFilter : movFilter}
              onChange={tab === "catalogo" ? setCatFilter : setMovFilter}
              resultCount={tab === "catalogo" ? shownProducts.length : shownMovements.length}
            />
          )}
        </div>
        {tab === "mov" && (
          <button type="button" className="btn btn-primary" style={{ minHeight: 44 }} disabled={importing} onClick={pickXml}>
            <i className="fa-solid fa-file-import" style={{ fontSize: 13 }} />
            {importing ? "Importando…" : "Importar XML"}
          </button>
        )}
      </div>

      <div style={{ padding: "12px 12px 90px", display: "flex", flexDirection: "column", gap: 10 }}>
        {tab === "catalogo" ? (
          shownProducts.length === 0 ? (
            <MobileEmptyState
              icon="fa-boxes-stacked"
              title={products.length ? "Nenhum item com esses filtros" : "Catálogo vazio"}
              sub={products.length ? "Ajuste os filtros para ver outros itens." : "Cadastre produtos e insumos pelo botão +."}
            />
          ) : (
            <section style={card}>
              {shownProducts.map((p) => {
                const st = stockStatus(p);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setDraft(draftOf(p))}
                    style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", background: "transparent", border: 0, borderBottom: "1px solid var(--line)", cursor: "pointer", font: "inherit", color: "var(--ink)", padding: "11px 13px", minHeight: 62 }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>
                        {TYPE_LABEL[p.type]} · {p.type === "produto" && p.price ? brl(p.price) : `custo ${brl(p.cost)}`}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: p.composed ? "var(--ink3)" : p.stock > 0 ? "var(--ink)" : "var(--alert)" }}>
                        {p.composed ? "Composto" : `${qty(p.stock)} ${p.unit}`}
                      </span>
                      <span style={{ ...pill(st.tone), fontSize: 10.5, padding: "1px 8px" }}>{st.label}</span>
                    </div>
                    <i className="fa-solid fa-chevron-right" style={{ fontSize: 13, color: "var(--ink3)" }} />
                  </button>
                );
              })}
            </section>
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
            <div style={{ fontSize: 13, color: "var(--ink2)" }}>Arraste o arquivo da nota do fornecedor. Os itens entram no estoque automaticamente.</div>
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
                      <span style={{ ...pill(m.kind === "in" ? "ok" : "sec"), fontSize: 10.5, padding: "1px 8px" }}>{m.kind === "in" ? "Entrada" : "Saída"}</span>
                      <span style={{ fontSize: 13.5, fontWeight: 500, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.productName}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--ink3)", minWidth: 0 }}>
                      <i className={`fa-solid ${xml ? "fa-file-code" : "fa-receipt"}`} style={{ fontSize: 11 }} />
                      <span className={xml ? "mono" : undefined} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {m.source}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                    <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: m.kind === "in" ? "var(--ok)" : "var(--ink)", whiteSpace: "nowrap" }}>
                      {m.kind === "in" ? "+" : "−"} {qty(m.quantity)} {m.unit}
                    </span>
                    <span className="mono" style={{ fontSize: 11, color: "var(--ink3)" }}>
                      {dayMonth(localIso(new Date(m.createdAt)))}
                    </span>
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </div>

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
          onError={notify}
        />
      )}
    </div>
  );
}
