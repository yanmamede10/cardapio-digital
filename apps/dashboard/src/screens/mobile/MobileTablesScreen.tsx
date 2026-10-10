import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { RestaurantTable, TableStatus } from "@cardapio/shared";
import { api } from "../../lib/api";
import { useMobileScreen } from "../../components/mobile/MobileLayout";
import { MobileChip } from "../../components/mobile/MobileChip";
import { MobileEmptyState } from "../../components/mobile/MobileEmptyState";
import { ClearSearch } from "../../components/ClearSearch";

const STATUS_MAP: Record<TableStatus, { label: string; bg: string; fg: string; accent: string }> = {
  free: { label: "Livre", bg: "color-mix(in srgb, var(--ok) 15%, transparent)", fg: "var(--ok)", accent: "var(--line)" },
  occupied: { label: "Ocupada", bg: "var(--brandSoft)", fg: "var(--brandText)", accent: "var(--sec)" },
  awaiting_payment: { label: "Aguardando pagamento", bg: "color-mix(in srgb, var(--warn) 18%, transparent)", fg: "var(--warn)", accent: "var(--warn)" }
};

const FILTERS: { key: "all" | TableStatus; label: string; dot: string }[] = [
  { key: "all", label: "Todas", dot: "var(--ink3)" },
  { key: "free", label: "Livre", dot: "var(--ok)" },
  { key: "occupied", label: "Ocupada", dot: "var(--sec)" },
  { key: "awaiting_payment", label: "Aguardando pagamento", dot: "var(--warn)" }
];

export default function MobileTablesScreen() {
  const navigate = useNavigate();
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | TableStatus>("all");

  useMobileScreen({ title: "Mesas e Comandas", subtitle: `${tables.length} ${tables.length === 1 ? "mesa" : "mesas"} · salão principal` });

  useEffect(() => {
    let alive = true;
    const load = () => api.listTables().then((t) => alive && (setTables(t), setLoaded(true))).catch(() => {});
    load();
    const id = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return tables.filter((t) => (filter === "all" || t.status === filter) && (!query || String(t.number).includes(query)));
  }, [tables, q, filter]);

  const countFor = (k: "all" | TableStatus) => (k === "all" ? tables.length : tables.filter((t) => t.status === k).length);

  if (!loaded) {
    return (
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 11 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton" style={{ height: 66 }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div className="glass" style={{ position: "sticky", top: 0, zIndex: 5, padding: "11px 12px 9px", borderBottom: "1px solid var(--glassBd)", display: "flex", flexDirection: "column", gap: 9 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 11, padding: "0 12px", minHeight: 44 }}>
          <i className="fa-solid fa-magnifying-glass" style={{ fontSize: "var(--icon-sm)", color: "var(--ink3)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar mesa" style={{ border: 0, background: "transparent", outline: "none", font: "inherit", fontSize: "var(--text-body)", color: "var(--ink)", width: "100%", minWidth: 0 }} />
          <ClearSearch value={q} onClear={() => setQ("")} />
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          {FILTERS.map((f) => (
            <MobileChip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)} dot={f.dot}>
              {f.label} <span className="mono" style={{ fontSize: "var(--text-caption)" }}>{countFor(f.key)}</span>
            </MobileChip>
          ))}
        </div>
      </div>

      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 9 }}>
        {filtered.map((t) => {
          const st = STATUS_MAP[t.status];
          const meta = t.status === "free" ? "disponível" : t.openedAt ? `aberta há ${Math.max(0, Math.floor((Date.now() - new Date(t.openedAt).getTime()) / 60000))} min` : "";
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => navigate(`/mesas/${t.number}`)}
              style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", background: "var(--surface)", border: "1px solid var(--line)", borderLeft: `3px solid ${st.accent}`, borderRadius: 13, padding: "11px 12px", minHeight: 66, cursor: "pointer", font: "inherit", color: "var(--ink)" }}
            >
              <div style={{ width: 44, height: 44, flex: "0 0 44px", borderRadius: 12, background: t.status === "free" ? "var(--surface2)" : st.bg, border: `1px solid ${t.status === "free" ? "var(--line)" : "transparent"}`, color: t.status === "free" ? "var(--ink3)" : st.fg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1 }}>
                <span style={{ fontSize: "var(--text-caption)", letterSpacing: ".06em" }}>MESA</span>
                <span style={{ fontSize: "var(--text-headline)", fontWeight: 600 }}>{String(t.number).padStart(2, "0")}</span>
              </div>
              <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: "var(--text-footnote)", fontWeight: 600, borderRadius: 20, padding: "2px 9px", background: st.bg, color: st.fg, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{st.label}</span>
                  <span style={{ fontSize: "var(--text-footnote)", color: "var(--ink3)", whiteSpace: "nowrap" }}>{meta}</span>
                </div>
                <div style={{ fontSize: "var(--text-footnote)", color: "var(--ink3)" }}>{t.seats} lugares</div>
              </div>
              <i className="fa-solid fa-chevron-right" style={{ fontSize: "var(--icon-sm)", color: "var(--ink3)" }} />
            </button>
          );
        })}
        {filtered.length === 0 && <MobileEmptyState icon="fa-chair" title="Nenhuma mesa encontrada" sub="Ajuste a busca ou cadastre as mesas do salão nas configurações." />}
      </div>
    </div>
  );
}
