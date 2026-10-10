/** Filter pill used across mobile list screens (channel, status, period filters). */
export function MobileChip({
  active,
  onClick,
  children,
  icon,
  dot,
  grow
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: string;
  dot?: string;
  grow?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: grow ? 1 : "0 0 auto",
        minHeight: 34,
        borderRadius: 20,
        padding: "0 13px",
        cursor: "pointer",
        font: "inherit",
        fontSize: "var(--text-footnote)",
        fontWeight: 500,
        background: active ? "var(--brandSoft)" : "var(--surface)",
        color: active ? "var(--brandText)" : "var(--ink2)",
        border: `1px solid ${active ? "var(--brand)" : "var(--line)"}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        whiteSpace: "nowrap"
      }}
    >
      {dot && <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot }} />}
      {icon && <i className={`fa-solid ${icon}`} style={{ fontSize: "var(--icon-sm)" }} />}
      {children}
    </button>
  );
}
