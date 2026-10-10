import { useEffect, useMemo, useState } from "react";
import { brl } from "../../lib/format";
import { Segmented } from "../Segmented";

export type PixStatus = "waiting" | "paid" | "expired";

const WAIT_SECONDS = 296;

/** Deterministic pseudo-QR pattern (with finder corners) — no real payload, just a believable visual for the mock flow. */
function fakeQrDataUri(seed: number): string {
  const N = 25, cell = 4, size = N * cell;
  const finder = (i: number, j: number) => {
    for (const [fx, fy] of [[0, 0], [N - 7, 0], [0, N - 7]] as const) {
      if (i >= fx && i < fx + 7 && j >= fy && j < fy + 7) {
        const di = i - fx, dj = j - fy;
        const ring = di === 0 || di === 6 || dj === 0 || dj === 6;
        const core = di >= 2 && di <= 4 && dj >= 2 && dj <= 4;
        return ring || core ? 1 : 2;
      }
    }
    return 0;
  };
  let d = "";
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const f = finder(i, j);
      let on = f === 1;
      if (f === 0) {
        const v = Math.sin(i * 12.9898 + j * 78.233 + seed * 3.7) * 43758.5453;
        on = v - Math.floor(v) > 0.47;
      }
      if (on) d += `M${i * cell} ${j * cell}h${cell}v${cell}h-${cell}z`;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><path d="${d}" fill="#111"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Decoupled from any screen: timer + status machine only. Reusable by the delivery checkout later. */
export function usePixPayment(open: boolean) {
  const [status, setStatus] = useState<PixStatus>("waiting");
  const [secondsLeft, setSecondsLeft] = useState(WAIT_SECONDS);

  useEffect(() => {
    if (open) {
      setStatus("waiting");
      setSecondsLeft(WAIT_SECONDS);
    }
  }, [open]);

  useEffect(() => {
    if (!open || status !== "waiting") return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setStatus("expired");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [open, status]);

  const regenerate = () => {
    setStatus("waiting");
    setSecondsLeft(WAIT_SECONDS);
  };
  const forceStatus = (s: PixStatus) => {
    setStatus(s);
    if (s === "waiting") setSecondsLeft(WAIT_SECONDS);
  };

  return { status, secondsLeft, regenerate, markPaid: () => setStatus("paid"), forceStatus };
}

interface Props {
  open: boolean;
  title: string;
  amount: number;
  itemsLabel?: string;
  onClose: () => void;
  /** Called once the customer's payment is confirmed and the caller should settle the bill/order. */
  onConfirmed: () => void;
  onNotify?: (message: string) => void;
  /** Shows the state-forcing dev footer. Flip off once a real PIX webhook drives status. */
  devControls?: boolean;
}

export function PixPaymentModal({ open, title, amount, itemsLabel, onClose, onConfirmed, onNotify, devControls = true }: Props) {
  const { status, secondsLeft, regenerate, markPaid, forceStatus } = usePixPayment(open);

  const qr = useMemo(() => fakeQrDataUri(Math.round(amount * 100)), [amount]);
  const code = useMemo(
    () => `00020126580014BR.GOV.BCB.PIX0136${Math.round(amount * 100).toString(16).padStart(8, "0")}-pyro52040000530398654${amount.toFixed(2).replace(".", "")}5802BR5919${title.toUpperCase().slice(0, 20)}6009SAO PAULO6304ABCD`,
    [amount, title]
  );

  if (!open) return null;

  const pad2 = (n: number) => String(n).padStart(2, "0");
  const timer = `${pad2(Math.floor(secondsLeft / 60))}:${pad2(secondsLeft % 60)}`;
  const urgent = secondsLeft <= 60;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      onNotify?.("Código copia-e-cola copiado");
    } catch {
      onNotify?.("Não foi possível copiar o código");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-panel" style={{ maxWidth: 420 }}>
        <div className="glass" style={{ display: "flex", alignItems: "center", gap: 13, padding: "18px 22px", borderBottom: "1px solid var(--glassBd)" }}>
          <div style={{ width: 34, height: 34, borderRadius: 12, background: "var(--brandSoft)", color: "var(--brandText)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 34px" }}>
            <i className="fa-solid fa-qrcode" style={{ fontSize: 18, lineHeight: 1 }} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: "var(--text-headline)", fontWeight: 600, letterSpacing: "-.015em" }}>Pagamento PIX</div>
            <div style={{ fontSize: "var(--text-footnote)", color: "var(--ink3)" }}>{title}{itemsLabel ? ` · ${itemsLabel}` : ""}</div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} title="Fechar" aria-label="Fechar">
            <i className="fa-solid fa-xmark" style={{ fontSize: 18 }} />
          </button>
        </div>

        {status === "waiting" && (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div className="mono" style={{ fontSize: "var(--text-largeTitle)", fontWeight: 600, letterSpacing: "-.03em" }}>{brl(amount)}</div>
              <div style={{ fontSize: "var(--text-subheadline)", color: "var(--ink3)" }}>Mostre esta tela ao cliente</div>
            </div>
            <div style={{ padding: 16, borderRadius: 22, background: "#fff", border: "1px solid var(--line2)", boxShadow: "var(--shadow1)" }}>
              <img src={qr} width={196} height={196} alt="QR code PIX" style={{ display: "block", imageRendering: "pixelated" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, border: `1px solid ${urgent ? "var(--alert)" : "var(--line2)"}`, borderRadius: 999, padding: "8px 16px" }}>
              <i className="fa-solid fa-clock" style={{ fontSize: 15, lineHeight: 1, color: urgent ? "var(--alert)" : "var(--ink)" }} />
              <span className="mono" style={{ fontSize: "var(--text-headline)", fontWeight: 600, letterSpacing: ".02em", color: urgent ? "var(--alert)" : "var(--ink)" }}>{timer}</span>
              <span style={{ fontSize: "var(--text-footnote)", color: "var(--ink3)" }}>para expirar</span>
            </div>
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="field-label">PIX copia e cola</div>
              <div style={{ display: "flex", alignItems: "center", gap: 11, border: "1px solid var(--line)", background: "var(--surface2)", borderRadius: 14, padding: "12px 14px" }}>
                <span className="mono" style={{ flex: 1, minWidth: 0, fontSize: "var(--text-footnote)", color: "var(--ink2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{code}</span>
                <button type="button" className="btn btn-outline" style={{ padding: "8px 13px", fontSize: "var(--text-footnote)" }} onClick={copy}>
                  <i className="fa-regular fa-copy" style={{ fontSize: 14, lineHeight: 1 }} />
                  Copiar
                </button>
              </div>
            </div>
            <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "12px 14px", borderRadius: 14, background: "var(--surface2)", border: "1px solid var(--line)" }}>
              <span style={{ position: "relative", width: 8, height: 8, flex: "0 0 8px" }}>
                <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--warn)" }} />
                <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--warn)", animation: "pulse 1.8s ease-out infinite" }} />
              </span>
              <span style={{ fontSize: "var(--text-subheadline)", color: "var(--ink2)" }}>Aguardando confirmação do banco…</span>
            </div>
            <button type="button" className="btn btn-outline" style={{ width: "100%" }} onClick={onClose}>
              Cancelar cobrança
            </button>
          </div>
        )}

        {status === "paid" && (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "30px 24px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
            <div style={{ width: 84, height: 84, borderRadius: 999, background: "color-mix(in srgb, var(--ok) 16%, transparent)", color: "var(--ok)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="fa-solid fa-check" style={{ fontSize: 38, lineHeight: 1 }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div style={{ fontSize: "var(--text-title3)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--ok)" }}>Pagamento confirmado</div>
              <div className="mono" style={{ fontSize: "var(--text-title1)", fontWeight: 600, letterSpacing: "-.03em" }}>{brl(amount)}</div>
              <div style={{ fontSize: "var(--text-subheadline)", color: "var(--ink3)", textAlign: "center" }}>{title} liberada · valor a caminho da conta do restaurante</div>
            </div>
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 2 }}>
              {[["Recebido em", "agora mesmo"], ["Forma", "PIX"], ["Liquidação", "D+1 na subconta"]].map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "11px 0", borderBottom: "1px solid var(--line)" }}>
                  <span style={{ flex: 1, fontSize: "var(--text-subheadline)", color: "var(--ink3)" }}>{k}</span>
                  <span style={{ fontSize: "var(--text-subheadline)", fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ width: "100%", display: "flex", gap: 10 }}>
              <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => onNotify?.("Recibo enviado para a impressora")}>
                <i className="fa-solid fa-print" style={{ fontSize: 16, lineHeight: 1 }} />
                Recibo
              </button>
              <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={onConfirmed}>
                Concluir
              </button>
            </div>
          </div>
        )}

        {status === "expired" && (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "30px 24px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
            <div style={{ width: 84, height: 84, borderRadius: 999, background: "var(--surface2)", border: "1px solid var(--line)", color: "var(--ink3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="fa-solid fa-clock-rotate-left" style={{ fontSize: 34, lineHeight: 1 }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div style={{ fontSize: "var(--text-title3)", fontWeight: 600, letterSpacing: "-.02em" }}>QR code expirado</div>
              <div style={{ fontSize: "var(--text-subheadline)", color: "var(--ink2)", textAlign: "center", maxWidth: 280 }}>O código ficou 5 minutos disponível e não foi pago. Gere um novo para continuar o fechamento de {title}.</div>
            </div>
            <div style={{ width: "100%", padding: "14px 16px", borderRadius: 14, background: "var(--surface2)", border: "1px solid var(--line)", display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ flex: 1, fontSize: "var(--text-subheadline)", color: "var(--ink3)" }}>Valor da comanda</span>
              <span className="mono" style={{ fontSize: "var(--text-title3)", fontWeight: 600, letterSpacing: "-.02em" }}>{brl(amount)}</span>
            </div>
            <button type="button" className="btn btn-primary" style={{ width: "100%" }} onClick={regenerate}>
              <i className="fa-solid fa-rotate-right" style={{ fontSize: 17, lineHeight: 1 }} />
              Gerar novo QR
            </button>
            <button type="button" className="btn btn-outline" style={{ width: "100%" }} onClick={onClose}>
              Voltar à comanda
            </button>
          </div>
        )}

        {devControls && (
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 11, padding: "14px 22px", borderTop: "1px solid var(--line)", background: "var(--surface2)", flexWrap: "wrap" }}>
            <span className="field-label">Simular (dev)</span>
            <Segmented
              value={status}
              onChange={forceStatus}
              options={[
                { value: "waiting", label: "Aguardando" },
                { value: "paid", label: "Pago" },
                { value: "expired", label: "Expirado" }
              ]}
            />
            <div style={{ flex: 1 }} />
            {status === "waiting" && (
              <button type="button" onClick={markPaid} style={{ background: "transparent", border: 0, padding: 0, cursor: "pointer", font: "inherit", fontSize: "var(--text-footnote)", fontWeight: 500, color: "var(--brandText)" }}>
                Simular pagamento
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
