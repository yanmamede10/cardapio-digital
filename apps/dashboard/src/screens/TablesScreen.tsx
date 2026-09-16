import { useEffect, useState } from "react";
import type { RestaurantTable, TableComanda, TableStatus } from "@cardapio/shared";
import { api } from "../lib/api";
import { brl } from "../lib/format";
import { useDashboardState } from "../state/DashboardStateContext";

const STATUS_MAP: Record<TableStatus, { label: string; bg: string; fg: string; bd: string }> = {
  free: { label: "Livre", bg: "var(--surface2)", fg: "var(--ink3)", bd: "var(--line)" },
  occupied: { label: "Ocupada", bg: "var(--brandSoft)", fg: "var(--brandText)", bd: "var(--sec)" },
  awaiting_payment: { label: "Aguardando pagamento", bg: "color-mix(in srgb, var(--warn) 16%, transparent)", fg: "var(--warn)", bd: "var(--warn)" }
};

export default function TablesScreen() {
  const { notify } = useDashboardState();
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [comanda, setComanda] = useState<TableComanda | null>(null);
  const [splitMode, setSplitMode] = useState<"pessoa" | "item" | null>(null);
  const [people, setPeople] = useState(2);
  const [transferTo, setTransferTo] = useState<number | "">("");

  const loadTables = () => api.listTables().then((t) => {
    setTables(t);
    if (selected == null && t.length) setSelected(t[0].number);
  });

  useEffect(() => {
    loadTables();
    const id = setInterval(loadTables, 10000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selected == null) return;
    setSplitMode(null);
    api.getComanda(selected).then(setComanda).catch(() => setComanda(null));
  }, [selected]);

  const selT = tables.find((t) => t.number === selected) || null;

  const closeBill = async () => {
    if (selected == null) return;
    try {
      await api.closeTable(selected);
      notify(`Conta da Mesa ${String(selected).padStart(2, "0")} fechada`);
      loadTables();
      api.getComanda(selected).then(setComanda).catch(() => setComanda(null));
    } catch {
      notify("Não foi possível fechar a conta");
    }
  };

  const doTransfer = async () => {
    if (selected == null || transferTo === "") return;
    try {
      await api.transferTable(selected, Number(transferTo));
      notify(`Itens transferidos para a Mesa ${String(transferTo).padStart(2, "0")}`);
      setTransferTo("");
      loadTables();
      api.getComanda(selected).then(setComanda).catch(() => setComanda(null));
    } catch {
      notify("Não foi possível transferir a mesa");
    }
  };

  const showQr = async () => {
    if (selected == null) return;
    try {
      const { tableCode } = await api.getTableQr(selected);
      const url = `${(import.meta.env.VITE_CUSTOMER_APP_URL as string) || "http://localhost:5173"}/t/${tableCode}`;
      try {
        await navigator.clipboard.writeText(url);
        notify(`Link copiado: ${url}`);
      } catch {
        notify(`Link da Mesa: ${url}`);
      }
    } catch {
      notify("Não foi possível gerar o QR code");
    }
  };

  const newTable = async () => {
    try {
      await api.createTable(4);
      notify("Nova mesa adicionada ao mapa");
      loadTables();
    } catch {
      notify("Não foi possível criar a mesa");
    }
  };

  const legend: TableStatus[] = ["free", "occupied", "awaiting_payment"];
  const freeTables = tables.filter((t) => t.status === "free" && t.number !== selected);

  const subtotal = comanda?.subtotal ?? 0;
  const service = comanda?.service ?? 0;
  const total = comanda?.total ?? 0;
  const splitRows =
    splitMode === "pessoa"
      ? Array.from({ length: people }, (_, i) => ({ k: `Pessoa ${i + 1}`, v: brl(Math.round((total / people) * 100) / 100) }))
      : splitMode === "item"
      ? (comanda?.lines || []).map((l) => ({ k: `${l.name} · ${l.quantity}`, v: brl(l.subtotal) }))
      : [];

  return (
    <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
      <section className="card" style={{ flex: 1, minWidth: 320, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Mapa do salão</div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {legend.map((k) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink2)" }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: STATUS_MAP[k].fg }} />
                {STATUS_MAP[k].label}
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-ghost" onClick={newTable}>
            <i className="fa-solid fa-plus" style={{ fontSize: 16, lineHeight: 1 }} />
            Nova mesa
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))", gap: 12 }}>
          {tables.map((t) => {
            const st = STATUS_MAP[t.status];
            const isSel = selected === t.number;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelected(t.number)}
                className="tap"
                style={{
                  textAlign: "left",
                  borderRadius: 15,
                  padding: 12,
                  cursor: "pointer",
                  font: "inherit",
                  display: "flex",
                  flexDirection: "column",
                  gap: 7,
                  background: st.bg,
                  border: `1.5px solid ${isSel ? "var(--brand)" : st.bd}`,
                  boxShadow: isSel ? "0 0 0 3px color-mix(in srgb, var(--brand) 22%, transparent)" : "none"
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                  <span className="mono" style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-.03em", color: st.fg }}>
                    {String(t.number).padStart(2, "0")}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--ink3)" }}>{t.seats} lug.</span>
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: st.fg }}>{st.label}</div>
                <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>—</div>
              </button>
            );
          })}
        </div>
      </section>

      <aside className="card" style={{ width: 330, flex: "0 0 330px", overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-.015em", flex: 1 }}>{selT ? `Mesa ${String(selT.number).padStart(2, "0")}` : "Selecione uma mesa"}</div>
            {selT && (
              <span className="pill" style={{ background: STATUS_MAP[selT.status].bg, color: STATUS_MAP[selT.status].fg }}>
                {STATUS_MAP[selT.status].label}
              </span>
            )}
          </div>
          {selT && <div style={{ fontSize: 12, color: "var(--ink3)" }}>{selT.seats} lugares{selT.openedAt ? ` · aberta às ${new Date(selT.openedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}</div>}
        </div>
        <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 7 }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink3)", marginBottom: 2 }}>
            Comanda em tempo real
          </div>
          {(comanda?.lines || []).map((l, i) => (
            <div key={i} style={{ display: "flex", gap: 9, alignItems: "baseline", fontSize: 13 }}>
              <span className="mono" style={{ color: "var(--ink2)" }}>
                {l.quantity}×
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>{l.name}</span>
              <span className="mono" style={{ fontWeight: 500 }}>
                {brl(l.subtotal)}
              </span>
            </div>
          ))}
          {(!comanda || comanda.lines.length === 0) && <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>Nenhum pedido em aberto nesta mesa.</div>}
        </div>
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", fontSize: 12.5, color: "var(--ink2)" }}>
            <span style={{ flex: 1 }}>Subtotal</span>
            <span className="mono">{brl(subtotal)}</span>
          </div>
          <div style={{ display: "flex", fontSize: 12.5, color: "var(--ink2)" }}>
            <span style={{ flex: 1 }}>Serviço {comanda ? comanda.servicePct : 10}%</span>
            <span className="mono">{brl(service)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", marginTop: 4 }}>
            <span style={{ flex: 1, fontWeight: 600, fontSize: 13.5 }}>Total</span>
            <span className="mono" style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-.03em" }}>
              {brl(total)}
            </span>
          </div>
        </div>
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 9 }}>
          <button type="button" className="btn btn-primary" onClick={closeBill} disabled={!selT || selT.status === "free"}>
            Fechar conta
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setSplitMode(splitMode === "pessoa" ? null : "pessoa")}
              className="tap"
              style={{ flex: 1, border: "1px solid var(--line2)", borderRadius: 12, padding: 9, cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 600, background: splitMode === "pessoa" ? "var(--brand)" : "var(--surface2)", color: splitMode === "pessoa" ? "var(--brandInk)" : "var(--ink2)" }}
            >
              Por pessoa
            </button>
            <button
              type="button"
              onClick={() => setSplitMode(splitMode === "item" ? null : "item")}
              className="tap"
              style={{ flex: 1, border: "1px solid var(--line2)", borderRadius: 12, padding: 9, cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 600, background: splitMode === "item" ? "var(--brand)" : "var(--surface2)", color: splitMode === "item" ? "var(--brandInk)" : "var(--ink2)" }}
            >
              Por item
            </button>
          </div>
          {splitMode && (
            <div style={{ background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 13, padding: 11, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink2)", flex: 1 }}>{splitMode === "pessoa" ? "Dividir por pessoa" : "Dividir por item"}</div>
                {splitMode === "pessoa" && (
                  <input
                    type="number"
                    min={1}
                    value={people}
                    onChange={(e) => setPeople(Math.max(1, Number(e.target.value) || 1))}
                    style={{ width: 48, border: "1px solid var(--line)", borderRadius: 8, padding: "3px 6px", background: "var(--surface)", color: "var(--ink)", fontFamily: "inherit", fontSize: 12 }}
                  />
                )}
              </div>
              {splitRows.map((r, i) => (
                <div key={i} style={{ display: "flex", fontSize: 12.5 }}>
                  <span style={{ flex: 1, minWidth: 0, color: "var(--ink2)" }}>{r.k}</span>
                  <span className="mono" style={{ fontWeight: 500 }}>
                    {r.v}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={showQr}>
              <i className="fa-solid fa-qrcode" style={{ fontSize: 16, lineHeight: 1 }} />
              QR code
            </button>
            <select value={transferTo} onChange={(e) => setTransferTo(e.target.value ? Number(e.target.value) : "")} className="field" style={{ flex: 1, padding: "9px 10px", fontSize: 12.5 }}>
              <option value="">Transferir p/…</option>
              {freeTables.map((t) => (
                <option key={t.id} value={t.number}>
                  Mesa {String(t.number).padStart(2, "0")}
                </option>
              ))}
            </select>
          </div>
          {transferTo !== "" && (
            <button type="button" className="btn btn-ghost" onClick={doTransfer}>
              <i className="fa-solid fa-right-left" style={{ fontSize: 16, lineHeight: 1 }} />
              Confirmar transferência
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
