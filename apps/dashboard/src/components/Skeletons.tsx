/** Shimmering placeholder grid shown while a module's first fetch is in flight. */
export function LoadingBlocks({ blocks = 4, height = 150 }: { blocks?: number; height?: number }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: "var(--ink3)", marginBottom: 14 }}>
        <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 15 }} />
        Carregando dados do restaurante…
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
        {Array.from({ length: blocks }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height, animationDelay: `${i * 0.12}s` }} />
        ))}
      </div>
    </div>
  );
}
