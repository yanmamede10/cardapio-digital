import { useEffect, useState } from "react";
import { PAYMENT_METHODS, type FinanceEntry, type FinanceEntryKind } from "@cardapio/shared";
import { ApiError, api } from "../lib/api";
import { brl, dayMonth, shortDate, todayIso } from "../lib/format";
import { useDashboardState } from "../state/DashboardStateContext";
import { Segmented } from "../components/Segmented";
import { Calendar } from "../components/Calendar";
import { DUE_PERIODS, FilterPopover, inPeriod, type FilterGroup, type FilterValues } from "../components/FilterPopover";

const PAYABLE_CATEGORIES = ["Insumos e bebidas", "Folha e encargos", "Aluguel", "Energia e gás", "Impostos (DAS)", "Outras despesas"];
const RECEIVABLE_CATEGORIES = ["Vendas salão", "Vendas delivery"];
const COST_CENTERS = ["Salão", "Cozinha", "Delivery", "Administrativo"];
export const STATUS_TONE = { Pago: "ok", Pendente: "warn", Atrasado: "alert" } as const;

/** Pending past its due date shows as "Atrasado" — derived, never stored. */
export const entryStatus = (e: FinanceEntry): keyof typeof STATUS_TONE => (e.status === "paid" ? "Pago" : e.dueDate < todayIso() ? "Atrasado" : "Pendente");

const num = (s: string) => Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s) || 0;
const categoriesFor = (kind: FinanceEntryKind) => (kind === "payable" ? PAYABLE_CATEGORIES : RECEIVABLE_CATEGORIES);

export const accountFilters = (kind: FinanceEntryKind): FilterGroup[] => [
  { id: "status", label: "Status", options: ["Pendente", "Atrasado", "Pago"] },
  { id: "cat", label: "Categoria", options: categoriesFor(kind) },
  { id: "cc", label: "Centro de custo", options: COST_CENTERS },
  { id: "per", label: "Vencimento", options: DUE_PERIODS }
];

/** Filtered rows, open ones first by due date, paid ones last. */
export const visibleEntries = (entries: FinanceEntry[], f: FilterValues) =>
  entries
    .filter((e) => (!f.status || entryStatus(e) === f.status) && (!f.cat || e.category === f.cat) && (!f.cc || e.costCenter === f.cc) && inPeriod(e.dueDate, f))
    .sort((a, b) => Number(a.status === "paid") - Number(b.status === "paid") || a.dueDate.localeCompare(b.dueDate));

export function entrySums(entries: FinanceEntry[], kind: FinanceEntryKind) {
  const sum = (fn: (e: FinanceEntry) => boolean) => brl(entries.filter(fn).reduce((t, e) => t + e.amount, 0));
  const month = todayIso().slice(0, 7);
  const paidThisMonth = (e: FinanceEntry) => e.status === "paid" && (e.paidOn ?? "").startsWith(month);
  const late = { label: "Em atraso", value: sum((e) => entryStatus(e) === "Atrasado"), fg: "var(--alert)" };
  return kind === "payable"
    ? [late, { label: "A vencer", value: sum((e) => entryStatus(e) === "Pendente"), fg: "var(--ink)" }, { label: "Pago no mês", value: sum(paidThisMonth), fg: "var(--ok)" }]
    : [{ label: "A receber", value: sum((e) => entryStatus(e) === "Pendente"), fg: "var(--ink)" }, { label: "Recebido no mês", value: sum(paidThisMonth), fg: "var(--ok)" }, late];
}

export default function AccountsScreen({ kind }: { kind: FinanceEntryKind }) {
  const payable = kind === "payable";
  const [entries, setEntries] = useState<FinanceEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValues>({});
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<FinanceEntry | null>(null);
  const { notify } = useDashboardState();

  const reload = () => api.listFinanceEntries(kind).then(setEntries);

  useEffect(() => {
    reload().catch((err) => setError(err instanceof ApiError && err.status === 403 ? "Você não tem permissão para acessar o Financeiro." : "Não foi possível carregar as contas."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <p style={{ color: "var(--ink2)" }}>{error}</p>;
  if (!entries) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="skeleton" style={{ height: 90 }} />
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    );
  }

  const rows = visibleEntries(entries, filter);
  const cols = "96px minmax(160px,1fr) 150px 116px 130px 124px";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 1120 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
        {entrySums(entries, kind).map((k) => (
          <section key={k.label} className="card" style={{ padding: "18px 22px" }}>
            <div style={{ fontSize: 12.5, color: "var(--ink2)" }}>{k.label}</div>
            <div className="mono" style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-.03em", marginTop: 6, color: k.fg }}>
              {k.value}
            </div>
          </section>
        ))}
      </div>

      <section className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{payable ? "Contas a pagar" : "Contas a receber"}</div>
          <FilterPopover groups={accountFilters(kind)} value={filter} onChange={setFilter} resultCount={rows.length} />
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            <i className="fa-solid fa-plus" style={{ fontSize: 13 }} />
            Novo lançamento
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 820 }}>
            <div style={{ display: "grid", gridTemplateColumns: cols, gap: 16, padding: "12px 20px", background: "var(--surface2)", borderBottom: "1px solid var(--line)" }}>
              {["Vencimento", "Descrição", "Categoria", "Valor", "Status", ""].map((h) => (
                <div key={h} className="field-label">
                  {h}
                </div>
              ))}
            </div>
            {rows.map((e) => {
              const st = entryStatus(e);
              return (
                <div key={e.id} style={{ display: "grid", gridTemplateColumns: cols, gap: 16, padding: "13px 20px", borderBottom: "1px solid var(--line)", alignItems: "center", fontSize: 13 }}>
                  <div className="mono" style={{ fontSize: 12.5, color: st === "Atrasado" ? "var(--alert)" : "var(--ink2)" }}>
                    {dayMonth(e.dueDate)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.description}</div>
                    {e.costCenter && <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>{e.costCenter}</div>}
                  </div>
                  <div style={{ color: "var(--ink2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.category || "Sem categoria"}</div>
                  <div className="mono" style={{ fontWeight: 600 }}>
                    {brl(e.amount)}
                  </div>
                  <EntryStatus entry={e} />
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}>
                    {e.status !== "paid" && (
                      <button type="button" className="btn btn-ghost" style={{ padding: "6px 13px", fontSize: 12.5, color: "var(--brandText)" }} onClick={() => setPaying(e)}>
                        Quitar
                      </button>
                    )}
                    <button type="button" className="icon-btn" title="Excluir" aria-label={`Excluir ${e.description}`} onClick={() => deleteEntry(e, notify, reload)}>
                      <i className="fa-solid fa-trash" style={{ fontSize: 14 }} />
                    </button>
                  </div>
                </div>
              );
            })}
            {rows.length === 0 && (
              <div style={{ padding: "36px 20px", textAlign: "center", fontSize: 13, color: "var(--ink3)" }}>
                {entries.length ? "Nenhum resultado com esses filtros." : "Nenhum lançamento ainda."}
              </div>
            )}
          </div>
        </div>
      </section>

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

/** Excluir (with confirmation): the only way to fix a typo or a duplicate. */
export async function deleteEntry(e: FinanceEntry, notify: (m: string) => void, onDeleted: () => void) {
  if (!window.confirm(`Excluir "${e.description}" (${brl(e.amount)})? Some também da Visão Geral e do DRE.`)) return;
  try {
    await api.deleteFinanceEntry(e.id);
    notify("Lançamento excluído");
    onDeleted();
  } catch (err) {
    notify(err instanceof ApiError ? err.message : "Não foi possível excluir o lançamento");
  }
}

/** Status pill plus "em 21/09 · PIX" once paid. */
export function EntryStatus({ entry: e }: { entry: FinanceEntry }) {
  const st = entryStatus(e);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3 }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, borderRadius: 999, padding: "2px 11px", background: `color-mix(in srgb, var(--${STATUS_TONE[st]}) 16%, transparent)`, color: `var(--${STATUS_TONE[st]})` }}>{st}</span>
      {e.paidOn && (
        <span style={{ fontSize: 11, color: "var(--ink3)" }}>
          em {dayMonth(e.paidOn)}
          {e.paymentMethod ? ` · ${e.paymentMethod}` : ""}
        </span>
      )}
    </div>
  );
}

/** "Novo lançamento": valor, descrição, vencimento and status up front; categoria/centro de custo behind "Mais opções". */
export function EntryFormModal({ kind, onClose, onSaved }: { kind: FinanceEntryKind; onClose: () => void; onSaved: () => void }) {
  const { notify } = useDashboardState();
  const payable = kind === "payable";
  const [form, setForm] = useState({ amount: "", description: "", dueDate: todayIso(), status: "pending" as "pending" | "paid", more: false, category: "", costCenter: "" });

  const save = async () => {
    if (!num(form.amount) || !form.description.trim()) return notify("Preencha valor e descrição");
    try {
      await api.createFinanceEntry({ kind, amount: num(form.amount), description: form.description, dueDate: form.dueDate, status: form.status, category: form.category, costCenter: form.costCenter });
      notify("Lançamento salvo");
      onSaved();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Não foi possível salvar o lançamento");
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel" role="dialog" aria-label="Novo lançamento" style={{ maxWidth: 480 }}>
        <div style={{ padding: "20px 24px 4px" }}>
          <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-.015em" }}>Novo lançamento</div>
          <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>{payable ? "Contas a pagar" : "Contas a receber"}</div>
        </div>
        <div style={{ padding: "20px 24px 22px", display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="field-label">Valor</span>
            <div style={{ position: "relative" }}>
              <span className="mono" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--ink3)" }}>
                R$
              </span>
              <input autoFocus className="field mono" inputMode="decimal" placeholder="0,00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^0-9.,]/g, "") })} style={{ paddingLeft: 44, fontSize: 18, fontWeight: 600 }} />
            </div>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="field-label">Descrição</span>
            <input className="field" maxLength={120} placeholder={payable ? "Ex.: Fornecedor de hortifrúti" : "Ex.: Repasse do cartão"} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14, alignItems: "end" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="field-label">Vencimento</span>
              <input className="field" type="date" required value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value || form.dueDate })} />
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="field-label">Status</span>
              <Segmented
                value={form.status}
                onChange={(status) => setForm({ ...form, status })}
                options={[
                  { value: "pending", label: "Pendente" },
                  { value: "paid", label: "Pago" }
                ]}
              />
            </div>
          </div>
          <button
            type="button"
            aria-expanded={form.more}
            onClick={() => setForm({ ...form, more: !form.more })}
            style={{ display: "flex", alignItems: "center", gap: 8, border: 0, background: "transparent", padding: "4px 0", cursor: "pointer", fontSize: 13, fontWeight: 500, color: "var(--brandText)", alignSelf: "flex-start" }}
          >
            <i className={`fa-solid ${form.more ? "fa-chevron-down" : "fa-chevron-right"}`} style={{ fontSize: 11, width: 11 }} />
            Mais opções<span style={{ fontWeight: 400, color: "var(--ink3)" }}>· categoria e centro de custo</span>
          </button>
          {form.more && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14, padding: 16, borderRadius: 14, background: "var(--surface2)", border: "1px solid var(--line)" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="field-label">Categoria</span>
                <select className="field" style={{ background: "var(--surface)" }} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="">Sem categoria</option>
                  {categoriesFor(kind).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="field-label">Centro de custo</span>
                <select className="field" style={{ background: "var(--surface)" }} value={form.costCenter} onChange={(e) => setForm({ ...form, costCenter: e.target.value })}>
                  <option value="">Nenhum</option>
                  {COST_CENTERS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "18px 24px 22px", borderTop: "1px solid var(--line)" }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            Salvar lançamento
          </button>
        </div>
      </div>
    </div>
  );
}

/** "Quitar": single-date calendar (defaults to today) + forma de pagamento. */
export function PayModal({ entry, onClose, onPaid }: { entry: FinanceEntry; onClose: () => void; onPaid: () => void }) {
  const { notify } = useDashboardState();
  const [paidOn, setPaidOn] = useState(todayIso());
  const [method, setMethod] = useState("PIX");

  const confirm = async () => {
    try {
      await api.payFinanceEntry(entry.id, paidOn, method);
      notify(`Conta quitada em ${dayMonth(paidOn)}`);
      onPaid();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Não foi possível quitar a conta");
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel" role="dialog" aria-label="Quitar conta" style={{ maxWidth: 420 }}>
        <div style={{ padding: "20px 24px 4px", fontSize: 17, fontWeight: 600, letterSpacing: "-.015em" }}>Quitar conta</div>
        <div style={{ padding: "18px 24px 22px", display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 14, background: "var(--surface2)", border: "1px solid var(--line)" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>{entry.description}</div>
              <div style={{ fontSize: 12, color: "var(--ink3)" }}>Vencimento {dayMonth(entry.dueDate)}</div>
            </div>
            <div className="mono" style={{ fontSize: 17, fontWeight: 600 }}>
              {brl(entry.amount)}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span className="field-label" style={{ flex: 1 }}>
                Data do pagamento
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--brandText)" }}>{paidOn === todayIso() ? `Hoje, ${shortDate(paidOn)}` : `${shortDate(paidOn)} ${paidOn.slice(0, 4)}`}</span>
            </div>
            <div style={{ border: "1px solid var(--line)", borderRadius: 16, padding: "10px 10px 8px" }}>
              <Calendar from={paidOn} onPick={setPaidOn} />
            </div>
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="field-label">Forma de pagamento</span>
            <select className="field" value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "18px 24px 22px", borderTop: "1px solid var(--line)" }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={confirm}>
            Confirmar quitação
          </button>
        </div>
      </div>
    </div>
  );
}
