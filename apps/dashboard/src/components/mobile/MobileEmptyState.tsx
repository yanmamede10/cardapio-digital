import type { ReactNode } from "react";

export function MobileEmptyState({ icon, title, sub, action }: { icon: string; title: string; sub: string; action?: ReactNode }) {
  return (
    <div style={{ padding: "52px 22px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 11 }}>
      <div style={{ width: 62, height: 62, borderRadius: "50%", background: "var(--surface2)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink3)" }}>
        <i className={`fa-solid ${icon}`} style={{ fontSize: "var(--icon-lg)" }} />
      </div>
      <div style={{ fontSize: "var(--text-headline)", fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: "var(--text-subheadline)", color: "var(--ink3)", textWrap: "pretty" }}>{sub}</div>
      {action}
    </div>
  );
}
