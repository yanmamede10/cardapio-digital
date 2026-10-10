import { useEffect, useState } from "react";
import type { FinanceEntry, FinanceEntryKind } from "@cardapio/shared";
import { ApiError, api } from "../../lib/api";
import { brl, dayMonth } from "../../lib/format";
import { useMobileScreen } from "../../components/mobile/MobileLayout";
import { MobileEmptyState } from "../../components/mobile/MobileEmptyState";
import { FilterPopover, type FilterValues } from "../../components/FilterPopover";
import { EntryFormModal, EntryStatus, PayModal, accountFilters, deleteEntry, entryStatus, entrySums, visibleEntries } from "../AccountsScreen";

const card = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" } as const;

export default function MobileAccountsScreen({ kind }: { kind: FinanceEntryKind }) {
  const payable = kind === "payable";
  const [entries, setEntries] = useState<FinanceEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValues>({});
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<FinanceEntry | null>(null);
  const { notify } = useMobileScreen({ title: payable ? "Contas a pagar" : "Contas a receber", subtitle: "Financeiro", fab: entries ? { label: "Novo lançamento", onClick: () => setCreating(true) } : undefined });

  const reload = () => api.listFinanceEntries(kind).then(setEntries);

  useEffect(() => {
    reload().catch((err) => setError(err instanceof ApiError && err.status === 403 ? "Você não tem permissão para acessar o Financeiro." : "Não foi possível carregar as contas."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <p style={{ padding: 16, color: "var(--ink2)" }}>{error}</p>;
  if (!entries) {
    return (
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="skeleton" style={{ height: 120 }} />
        <div className="skeleton" style={{ height: 240 }} />
      </div>
    );
  }

  const rows = visibleEntries(entries, filter);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--bg)", padding: "11px 12px 9px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 9 }}>
        <div className="mono" style={{ flex: 1, fontSize: "var(--text-footnote)", color: "var(--ink3)" }}>
          {rows.length === 1 ? "1 lançamento" : `${rows.length} lançamentos`}
        </div>
        <FilterPopover sheet groups={accountFilters(kind)} value={filter} onChange={setFilter} resultCount={rows.length} />
      </div>

      <div style={{ padding: "12px 12px 90px", display: "flex", flexDirection: "column", gap: 10 }}>
        <section style={card}>
          {entrySums(entries, kind).map((k) => (
            <div key={k.label} style={{ display: "flex", alignItems: "center", padding: "11px 14px", borderBottom: "1px solid var(--line)" }}>
              <span style={{ flex: 1, fontSize: "var(--text-subheadline)", color: "var(--ink2)" }}>{k.label}</span>
              <span className="mono" style={{ fontSize: "var(--text-headline)", fontWeight: 600, letterSpacing: "-.02em", color: k.fg }}>
                {k.value}
              </span>
            </div>
          ))}
        </section>

        {rows.length === 0 ? (
          <MobileEmptyState
            icon="fa-file-invoice-dollar"
            title={entries.length ? "Nenhum lançamento com esses filtros" : "Nenhum lançamento ainda"}
            sub={entries.length ? "Ajuste os filtros para ver outras contas." : "Registre a primeira conta pelo botão +."}
          />
        ) : (
          <section style={card}>
            {rows.map((e) => (
              <div key={e.id} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 13px", borderBottom: "1px solid var(--line)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "var(--text-body)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.description}</div>
                    <div style={{ fontSize: "var(--text-footnote)", color: entryStatus(e) === "Atrasado" ? "var(--alert)" : "var(--ink3)" }}>
                      Vence {dayMonth(e.dueDate)} · {e.category || "Sem categoria"}
                      {e.costCenter ? ` · ${e.costCenter}` : ""}
                    </div>
                  </div>
                  <span className="mono" style={{ fontSize: "var(--text-body)", fontWeight: 600 }}>
                    {brl(e.amount)}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <EntryStatus entry={e} />
                  </div>
                  {e.status !== "paid" && (
                    <button type="button" className="btn btn-ghost" style={{ minHeight: 40, padding: "0 16px", fontSize: "var(--text-subheadline)", color: "var(--brandText)" }} onClick={() => setPaying(e)}>
                      Quitar
                    </button>
                  )}
                  <button type="button" className="icon-btn" style={{ minWidth: 40, minHeight: 40 }} aria-label={`Excluir ${e.description}`} onClick={() => deleteEntry(e, notify, reload)}>
                    <i className="fa-solid fa-trash" style={{ fontSize: "var(--icon-sm)" }} />
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}
      </div>

      {creating && (
        <EntryFormModal
          kind={kind}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
      {paying && (
        <PayModal
          entry={paying}
          onClose={() => setPaying(null)}
          onPaid={() => {
            setPaying(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
