export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Pill-group segmented control (Todos / Mesa / Delivery, period switchers, tabs). */
export function Segmented<T extends string>({
  options,
  value,
  onChange
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    // Narrower than its options (the Super Admin's four filters at 360 px): it scrolls inside instead of widening the page.
    <div className="no-scrollbar" style={{ display: "inline-flex", maxWidth: "100%", overflowX: "auto", gap: 3, padding: 3, background: "var(--surface2)", borderRadius: 12 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className="tap"
            style={{
              display: "inline-flex",
              flex: "none",
              whiteSpace: "nowrap",
              alignItems: "center",
              gap: 6,
              border: 0,
              cursor: "pointer",
              borderRadius: 20,
              padding: "6px 13px",
              fontSize: "var(--text-subheadline)",
              fontWeight: active ? 600 : 500,
              background: active ? "var(--surface)" : "transparent",
              color: active ? "var(--brandText)" : "var(--ink2)"
            }}
          >
            {o.label}
            {typeof o.count === "number" && (
              <span className="mono" style={{ fontSize: "var(--text-caption)", color: active ? "var(--brandText)" : "var(--ink3)" }}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Standalone filter chip (category filters, ticket status/channel filters). */
export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap"
      style={{
        cursor: "pointer",
        borderRadius: 20,
        padding: "5px 12px",
        fontSize: "var(--text-subheadline)",
        fontWeight: active ? 600 : 500,
        whiteSpace: "nowrap",
        background: active ? "var(--brandSoft)" : "var(--surface2)",
        border: "1px solid transparent",
        color: active ? "var(--brandText)" : "var(--ink2)"
      }}
    >
      {children}
    </button>
  );
}
