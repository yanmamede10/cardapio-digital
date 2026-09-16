import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
}

/** Right-hand slide-over panel used by the product and coupon editors. */
export function SlideOver({ title, subtitle, onClose, footer, children }: Props) {
  return (
    <div className="drawer-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer-panel">
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            padding: "20px 24px",
            borderBottom: "1px solid var(--glassBd)",
            position: "sticky",
            top: 0,
            background: "var(--glassBg)",
            backdropFilter: "var(--blur)",
            WebkitBackdropFilter: "var(--blur)",
            zIndex: 2
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-.015em" }}>{title}</div>
            <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 2 }}>{subtitle}</div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} title="Fechar">
            <i className="fa-solid fa-xmark" style={{ fontSize: 16 }} />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "22px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
          {children}
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            padding: "16px 24px",
            borderTop: "1px solid var(--glassBd)",
            position: "sticky",
            bottom: 0,
            background: "var(--glassBg)",
            backdropFilter: "var(--blur)",
            WebkitBackdropFilter: "var(--blur)"
          }}
        >
          {footer}
        </div>
      </div>
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
