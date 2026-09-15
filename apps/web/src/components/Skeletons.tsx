export function DiscoveryListSkeleton() {
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", padding: "var(--pad)", gap: 14 }}>
      <div className="skeleton" style={{ flex: "none", height: 44, borderRadius: 14 }} />
      <div style={{ flex: "none", display: "flex", gap: 8 }}>
        <div className="skeleton" style={{ height: 34, width: 74, borderRadius: 999 }} />
        <div className="skeleton" style={{ height: 34, width: 112, borderRadius: 999 }} />
        <div className="skeleton" style={{ height: 34, width: 96, borderRadius: 999 }} />
      </div>
      <div className="skeleton" style={{ flex: "none", height: 118, borderRadius: 18 }} />
      <div style={{ flex: 1, minHeight: 60, overflow: "hidden", display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="skeleton" style={{ flex: 1, borderRadius: 18 }} />
        <div className="skeleton" style={{ flex: 1, borderRadius: 18 }} />
      </div>
      <div className="mono-label" style={{ textAlign: "center" }}>buscando restaurantes perto de você…</div>
    </div>
  );
}

export function MenuSkeleton() {
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", padding: "0 0 24px" }}>
      <div className="skeleton" style={{ flex: "none", height: "var(--banner)" }} />
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", padding: "var(--pad)", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: -40 }}>
          <div className="skeleton" style={{ width: 62, height: 62, borderRadius: 20, border: "3px solid var(--bg)" }} />
        </div>
        <div className="skeleton" style={{ height: 22, width: "62%", borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 13, width: "40%", borderRadius: 8 }} />
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <div className="skeleton" style={{ height: 34, width: 78, borderRadius: 999 }} />
          <div className="skeleton" style={{ height: 34, width: 116, borderRadius: 999 }} />
          <div className="skeleton" style={{ height: 34, width: 92, borderRadius: 999 }} />
        </div>
        <div style={{ flex: 1, minHeight: 60, overflow: "hidden", display: "grid", gridTemplateColumns: "repeat(var(--cols), minmax(0,1fr))", gap: 12, marginTop: 6 }}>
          <div className="skeleton" style={{ height: "calc(var(--photo) + 96px)", borderRadius: 18 }} />
          <div className="skeleton" style={{ height: "calc(var(--photo) + 96px)", borderRadius: 18 }} />
          <div className="skeleton" style={{ height: "calc(var(--photo) + 96px)", borderRadius: 18 }} />
        </div>
        <div className="mono-label" style={{ textAlign: "center", marginTop: 6 }}>carregando cardápio…</div>
      </div>
    </div>
  );
}
