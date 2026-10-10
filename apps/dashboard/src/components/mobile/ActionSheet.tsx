export interface ActionSheetAction {
  label: string;
  icon: string;
  danger?: boolean;
  onClick: () => void;
}

/** Bottom sheet used for per-row contextual actions (product menu, team member menu). */
export function ActionSheet({ open, onClose, title, actions }: { open: boolean; onClose: () => void; title: string; actions: ActionSheetAction[] }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 25, background: "rgba(0,0,0,.42)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ flex: 1 }} />
      <div style={{ background: "var(--surface)", borderRadius: "20px 20px 0 0", padding: "10px 12px calc(18px + env(safe-area-inset-bottom, 0px))" }}>
        <div style={{ width: 40, height: 4, borderRadius: 3, background: "var(--line2)", margin: "4px auto 10px" }} />
        <div style={{ fontSize: "var(--text-body)", fontWeight: 600, padding: "6px 8px 10px" }}>{title}</div>
        {actions.map((a, i) => (
          <button
            key={i}
            type="button"
            onClick={a.onClick}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              width: "100%",
              textAlign: "left",
              background: "transparent",
              border: 0,
              cursor: "pointer",
              font: "inherit",
              color: a.danger ? "var(--alert)" : "var(--ink)",
              padding: "0 8px",
              minHeight: 52
            }}
          >
            <i className={`fa-solid ${a.icon}`} style={{ fontSize: "var(--icon-sm)", width: 20 }} />
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
