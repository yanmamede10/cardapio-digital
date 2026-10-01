import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { RestaurantTable, TableComanda, TableStatus } from "@cardapio/shared";
import { api } from "../../lib/api";
import { brl } from "../../lib/format";
import { useMobileScreen } from "../../components/mobile/MobileLayout";
import { ActionSheet } from "../../components/mobile/ActionSheet";

const STATUS_MAP: Record<TableStatus, { label: string; bg: string; fg: string }> = {
  free: { label: "Livre", bg: "color-mix(in srgb, var(--ok) 15%, transparent)", fg: "var(--ok)" },
  occupied: { label: "Ocupada", bg: "var(--brandSoft)", fg: "var(--brandText)" },
  awaiting_payment: { label: "Aguardando pagamento", bg: "color-mix(in srgb, var(--warn) 18%, transparent)", fg: "var(--warn)" }
};

const ACTION_BTN: CSSProperties = {
  minHeight: 48,
  background: "var(--surface)",
  border: "1px solid var(--line2)",
  color: "var(--ink)",
  borderRadius: 12,
  cursor: "pointer",
  font: "inherit",
  fontSize: 12.5,
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8
};

export default function MobileTableDetailScreen() {
  const { number } = useParams<{ number: string }>();
  const num = Number(number);
  const navigate = useNavigate();
  const { notify } = useMobileScreen({ title: `Mesa ${number}`, subtitle: "Comanda em tempo real" });

  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [comanda, setComanda] = useState<TableComanda | null>(null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitMode, setSplitMode] = useState<"pessoa" | "item">("pessoa");
  const [people, setPeople] = useState(4);
  const [transferOpen, setTransferOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [qrOrdering, setQrOrdering] = useState(true);

  useEffect(() => {
    api.getPaymentMode().then((r) => setQrOrdering(r.qrOrdering)).catch(() => {});
  }, []);

  const loadComanda = () => api.getComanda(num).then(setComanda).catch(() => setComanda(null));

  useEffect(() => {
    const load = () => {
      api.listTables().then(setTables).catch(() => {});
      loadComanda();
    };
    load();
    setSplitOpen(false);
    const id = setInterval(load, 10000); // same as the desktop map: the total on screen is the one being charged
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [num]);

  const table = tables.find((t) => t.number === num) || null;
  const free = table?.status === "free";
  const st = table ? STATUS_MAP[table.status] : STATUS_MAP.free;
  const freeTables = tables.filter((t) => t.status === "free" && t.number !== num);

  const subtotal = comanda?.subtotal ?? 0;
  const service = comanda?.service ?? 0;
  const total = comanda?.total ?? 0;

  const closeBill = async (paymentMethod: string) => {
    setPayOpen(false);
    try {
      const { remaining } = await api.closeTable(num, { orderIds: comanda?.orderIds ?? [], paymentMethod });
      if (remaining) {
        notify(`Conta fechada — chegou pedido novo na Mesa ${number}, confira a comanda`);
        loadComanda();
      } else {
        notify(`Conta da Mesa ${number} fechada`);
        navigate("/mesas");
      }
    } catch {
      notify("Não foi possível fechar a conta");
    }
  };

  const showQr = () => navigate(`/mesas/qr?mesa=${num}`);

  const doTransfer = async (toNumber: number) => {
    setTransferOpen(false);
    try {
      await api.transferTable(num, toNumber);
      notify(`Itens transferidos para a Mesa ${String(toNumber).padStart(2, "0")}`);
      api.listTables().then(setTables).catch(() => {});
      loadComanda();
    } catch {
      notify("Não foi possível transferir a mesa");
    }
  };

  if (!table && tables.length === 0) {
    return (
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="skeleton" style={{ height: 90 }} />
        <div className="skeleton" style={{ height: 220 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 52, height: 52, flex: "0 0 52px", borderRadius: 14, background: free ? "var(--surface2)" : st.bg, border: `1px solid ${free ? "var(--line)" : "transparent"}`, color: free ? "var(--ink3)" : st.fg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1 }}>
          <span style={{ fontSize: 9, letterSpacing: ".06em" }}>MESA</span>
          <span style={{ fontSize: 20, fontWeight: 600 }}>{number}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, borderRadius: 20, padding: "2px 9px", background: st.bg, color: st.fg }}>{st.label}</span>
          <div style={{ fontSize: 12.5, color: "var(--ink3)", marginTop: 4 }}>
            {free ? "Sem comanda aberta" : `${table?.seats ?? 0} lugares${table?.openedAt ? ` · aberta há ${Math.max(0, Math.floor((Date.now() - new Date(table.openedAt).getTime()) / 60000))} min` : ""}`}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink3)" }}>
            Comanda
          </div>
          <div className="mono" style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-.02em" }}>
            {free ? "—" : brl(total)}
          </div>
        </div>
      </section>

      {!free && (comanda?.lines.length ?? 0) > 0 && (
        <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "11px 14px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>Itens da comanda</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--ink3)" }}>
              tempo real
            </div>
          </div>
          {comanda!.lines.map((l, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>
              <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink3)", width: 22 }}>
                {l.quantity}×
              </div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>{l.name}</div>
              <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
                {brl(l.subtotal)}
              </div>
            </div>
          ))}
          <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--ink2)" }}>
              <span>Subtotal</span>
              <span className="mono">{brl(subtotal)}</span>
            </div>
            {!!comanda?.servicePct && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--ink2)" }}>
                <span>Serviço {comanda.servicePct}%</span>
                <span className="mono">{brl(service)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontWeight: 600, paddingTop: 6, borderTop: "1px solid var(--line)" }}>
              <span style={{ fontSize: 13 }}>Total</span>
              <span className="mono" style={{ fontSize: 18, letterSpacing: "-.02em" }}>
                {brl(total)}
              </span>
            </div>
          </div>
        </section>
      )}

      {free && (
        <div style={{ padding: "44px 22px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 11, background: "var(--surface)", border: "1px dashed var(--line2)", borderRadius: 14 }}>
          <div style={{ width: 58, height: 58, borderRadius: "50%", background: "var(--surface2)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink3)" }}>
            <i className="fa-solid fa-chair" style={{ fontSize: 22 }} />
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 600 }}>Mesa livre</div>
          <div style={{ fontSize: 12.5, color: "var(--ink3)", textWrap: "pretty" }}>{qrOrdering ? "Nenhuma comanda aberta. Lance o pedido aqui ou peça para o cliente escanear o QR code da mesa." : "Nenhuma comanda aberta. Lance o pedido aqui."}</div>
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap", justifyContent: "center" }}>
            <button type="button" onClick={() => navigate(`/mesas/${num}/pedido`)} style={{ minHeight: 46, background: "var(--brand)", color: "var(--brandInk)", border: 0, borderRadius: 11, padding: "0 18px", cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
              <i className="fa-solid fa-plus" style={{ fontSize: 13 }} />
              Lançar pedido
            </button>
            {qrOrdering && (
              <button type="button" onClick={showQr} style={{ minHeight: 46, background: "var(--surface2)", border: "1px solid var(--line2)", color: "var(--ink)", borderRadius: 11, padding: "0 16px", cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                <i className="fa-solid fa-qrcode" style={{ fontSize: 13 }} />
                QR da mesa
              </button>
            )}
          </div>
        </div>
      )}

      {splitOpen && !free && (
        <section style={{ background: "var(--surface)", border: "1px solid var(--sec)", borderRadius: 14, padding: 13, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Dividir conta</div>
          <div style={{ display: "flex", gap: 7 }}>
            {(["pessoa", "item"] as const).map((m) => {
              const active = splitMode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSplitMode(m)}
                  style={{ flex: 1, minHeight: 42, borderRadius: 11, cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 600, background: active ? "var(--brandSoft)" : "var(--surface2)", color: active ? "var(--brandText)" : "var(--ink2)", border: `1px solid ${active ? "var(--brand)" : "var(--line)"}` }}
                >
                  {m === "pessoa" ? "Por pessoa" : "Por item"}
                </button>
              );
            })}
          </div>
          {splitMode === "pessoa" ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 11, background: "var(--surface2)", borderRadius: 11, padding: "10px 12px" }}>
                <div style={{ flex: 1, fontSize: 12.5, color: "var(--ink2)" }}>Pessoas na mesa</div>
                <button type="button" aria-label="Uma pessoa a menos" onClick={() => setPeople((p) => Math.max(2, p - 1))} style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid var(--line2)", background: "var(--surface)", color: "var(--ink)", cursor: "pointer", fontSize: 14 }}>
                  <i className="fa-solid fa-minus" />
                </button>
                <div className="mono" style={{ fontSize: 16, fontWeight: 600, minWidth: 22, textAlign: "center" }}>
                  {people}
                </div>
                <button type="button" aria-label="Uma pessoa a mais" onClick={() => setPeople((p) => Math.min(12, p + 1))} style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid var(--line2)", background: "var(--surface)", color: "var(--ink)", cursor: "pointer", fontSize: 14 }}>
                  <i className="fa-solid fa-plus" />
                </button>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 12.5, color: "var(--ink2)" }}>Valor por pessoa</span>
                <span className="mono" style={{ fontSize: 18, fontWeight: 600, color: "var(--brandText)" }}>
                  {brl(total / people)}
                </span>
              </div>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(comanda?.lines || []).map((l, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, background: "var(--surface2)", borderRadius: 9, padding: "8px 11px" }}>
                  <span style={{ color: "var(--ink2)" }}>
                    {l.name} · {l.quantity}
                  </span>
                  <span className="mono" style={{ fontWeight: 600 }}>
                    {brl(l.subtotal)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {!free && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
            <button type="button" onClick={() => setSplitOpen((v) => !v)} style={ACTION_BTN}>
              <i className="fa-solid fa-divide" style={{ fontSize: 13 }} />
              Dividir conta
            </button>
            {qrOrdering && (
              <button type="button" onClick={showQr} style={ACTION_BTN}>
                <i className="fa-solid fa-qrcode" style={{ fontSize: 13 }} />
                QR da mesa
              </button>
            )}
            <button type="button" onClick={() => setTransferOpen(true)} style={{ ...ACTION_BTN, opacity: freeTables.length === 0 ? 0.5 : 1, cursor: freeTables.length === 0 ? "not-allowed" : "pointer" }} disabled={freeTables.length === 0}>
              <i className="fa-solid fa-right-left" style={{ fontSize: 13 }} />
              Transferir itens
            </button>
            <button type="button" onClick={() => notify("Comanda enviada à impressora")} style={ACTION_BTN}>
              <i className="fa-solid fa-print" style={{ fontSize: 13 }} />
              Imprimir
            </button>
          </div>
          <button type="button" onClick={() => navigate(`/mesas/${num}/pedido`)} style={{ ...ACTION_BTN, minHeight: 52, fontSize: 14 }}>
            <i className="fa-solid fa-plus" style={{ fontSize: 14 }} />
            Lançar pedido
          </button>
          <button
            type="button"
            onClick={() => setPayOpen(true)}
            style={{ minHeight: 52, width: "100%", background: "var(--brand)", color: "var(--brandInk)", border: 0, borderRadius: 13, cursor: "pointer", font: "inherit", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 9 }}
          >
            <i className="fa-solid fa-receipt" style={{ fontSize: 15 }} />
            Fechar conta · {brl(total)}
          </button>
        </>
      )}

      <ActionSheet
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        title="Transferir para qual mesa?"
        actions={freeTables.map((t) => ({ label: `Mesa ${String(t.number).padStart(2, "0")}`, icon: "fa-chair", onClick: () => doTransfer(t.number) }))}
      />
      <ActionSheet
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title={`Fechar ${brl(total)} · forma de pagamento na maquininha`}
        actions={[
          { label: "Cartão", icon: "fa-credit-card", onClick: () => closeBill("Cartão") },
          { label: "PIX", icon: "fa-qrcode", onClick: () => closeBill("PIX") },
          { label: "Dinheiro", icon: "fa-money-bill-wave", onClick: () => closeBill("Dinheiro") }
        ]}
      />
    </div>
  );
}
