import type { ReactNode } from "react";

export function EmptyState({ icon, title, sub, action }: { icon: string; title: string; sub: string; action?: ReactNode }) {
  return (
    <div
      className="card"
      style={{
        border: "1px dashed var(--line2)",
        borderRadius: 14,
        padding: "64px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        textAlign: "center"
      }}
    >
      <div style={{ width: 56, height: 56, borderRadius: 14, background: "var(--surface2)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink3)" }}>
        <i className={`fa-solid ${icon}`} style={{ fontSize: 28, lineHeight: 1 }} />
      </div>
      <div>
        <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-.015em" }}>{title}</div>
        <div style={{ fontSize: 13.5, color: "var(--ink2)", maxWidth: 380, marginTop: 4 }}>{sub}</div>
      </div>
      {action}
    </div>
  );
}
