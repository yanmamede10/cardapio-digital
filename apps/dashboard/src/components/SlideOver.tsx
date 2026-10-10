import type { ReactNode } from "react";
import { useIsMobile } from "../lib/useIsMobile";
import { useDiscardGuard } from "./Modal";

interface Props {
  title: string;
  subtitle: string;
  onClose: () => void;
  /** The drawer's own footer (Cupom); as a function it gets `close`, the guarded Cancelar. A sheet draws its own. */
  footer?: ReactNode | ((close: () => void) => ReactNode);
  /** Something changed: X, Cancelar, Esc and the Android back ask "Descartar alterações?" (UX-08). A sheet says it in `sheet`. */
  dirty?: boolean;
  /** For "As alterações em “…” não serão salvas." */
  discardName?: string;
  children: ReactNode;
  width?: number;
  /** UX-07 · 3: a sheet instead of the side drawer — 720 px, up to 28 px from the top, the status and Cancelar/Salvar always in
   *  the footer; on the phone the whole screen, with Cancelar and Salvar in the top bar (4b). */
  sheet?: { saveLabel: string; onSave: () => void; saving?: boolean; dirty: boolean; status: string };
}

const bar = { position: "sticky", zIndex: 2 } as const;
const textButton = { minWidth: 88, border: 0, background: "transparent", padding: "0 10px", cursor: "pointer", font: "inherit", fontSize: "var(--text-headline)", color: "var(--brandText)" } as const;

/** Right-hand slide-over panel used by the coupon editor; the product cadastro opens it as a sheet. */
export function SlideOver({ title, subtitle, onClose, footer, children, width, sheet, dirty, discardName }: Props) {
  const phone = useIsMobile();
  const guard = useDiscardGuard(sheet?.dirty ?? !!dirty, onClose, discardName);
  return (
    <div className={`drawer-overlay${sheet ? " sheet" : ""}`}>
      <div className={`drawer-panel${sheet ? " sheet" : ""}`} role="dialog" aria-modal="true" aria-label={title} style={width && !sheet ? { width } : undefined}>
        {sheet && phone ? (
          <div className="glass" style={{ ...bar, top: 0, display: "flex", alignItems: "center", padding: "6px 8px", minHeight: 52, borderBottom: "1px solid var(--glassBd)" }}>
            <button type="button" onClick={guard.request} style={{ ...textButton, textAlign: "left" }}>
              Cancelar
            </button>
            <div style={{ flex: 1, minWidth: 0, textAlign: "center", fontSize: "var(--text-headline)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
            <button type="button" onClick={sheet.onSave} disabled={sheet.saving} style={{ ...textButton, textAlign: "right", fontWeight: 600 }}>
              {sheet.saveLabel}
            </button>
          </div>
        ) : (
          <div className="glass" style={{ ...bar, top: 0, display: "flex", alignItems: "center", gap: 12, padding: sheet ? "16px 16px 16px 32px" : "20px 24px", borderBottom: "1px solid var(--glassBd)" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: sheet ? "var(--text-title3)" : "var(--text-headline)", fontWeight: 600, letterSpacing: "-.015em" }}>{title}</div>
              <div style={{ fontSize: "var(--text-subheadline)", color: sheet ? "var(--ink2)" : "var(--ink3)", marginTop: sheet ? 0 : 2 }}>{subtitle}</div>
            </div>
            <button type="button" className="icon-btn" onClick={guard.request} title="Fechar" aria-label="Fechar" style={sheet ? { borderRadius: "50%" } : undefined}>
              <i className="fa-solid fa-xmark" style={{ fontSize: 16 }} />
            </button>
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: sheet ? (phone ? "20px 16px 32px" : "24px 32px 36px") : "22px 24px", display: "flex", flexDirection: "column", gap: sheet ? 24 : 20 }}>
          {children}
        </div>
        {!(sheet && phone) && (
          <div className="glass" style={{ ...bar, bottom: 0, display: "flex", alignItems: "center", gap: 10, padding: sheet ? "14px 24px 14px 32px" : "16px 24px", borderTop: "1px solid var(--glassBd)" }}>
            {sheet ? (
              <>
                {sheet.dirty && <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--brandText)" }} />}
                <span style={{ flex: 1, fontSize: "var(--text-subheadline)", color: "var(--ink2)" }}>{sheet.status}</span>
                <button type="button" className="btn btn-outline" onClick={guard.request}>
                  Cancelar
                </button>
                <button type="button" className="btn btn-primary" disabled={sheet.saving} onClick={sheet.onSave}>
                  {sheet.saveLabel}
                </button>
              </>
            ) : typeof footer === "function" ? (
              footer(guard.request)
            ) : (
              footer
            )}
          </div>
        )}
      </div>
      {guard.confirm}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <div className="field-label" style={{ marginBottom: 5 }}>
        {label}
      </div>
      {children}
    </label>
  );
}
