import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { encode } from "uqr";
import type { RestaurantTable } from "@cardapio/shared";
import { api, getSession } from "../lib/api";
import { useDashboardState } from "../state/DashboardStateContext";
import { useMobileScreen } from "../components/mobile/MobileLayout";

// The cardápio at the server's public address (deploy/.env's PUBLIC_URL, built in as VITE_PUBLIC_URL), never this page's own
// origin: inside the APK that is https://localhost.
export const tableLink = (code: string) => `${import.meta.env.VITE_PUBLIC_URL as string}/t/${code}`;
const pad = (n: number) => String(n).padStart(2, "0");

/** The QR as inline SVG: black modules on white, with the 4-module quiet zone phone cameras expect. */
function Qr({ text, label }: { text: string; label: string }) {
  const { data } = encode(text, { ecc: "M", border: 4 });
  const n = data.length;
  const d = data.flatMap((row, y) => row.flatMap((dark, x) => (dark ? [`M${x} ${y}h1v1h-1z`] : []))).join("");
  return (
    <svg viewBox={`0 0 ${n} ${n}`} role="img" aria-label={label} className="qr-svg" shapeRendering="crispEdges">
      <rect width={n} height={n} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}

/** One table's sheet: what goes on the table, on screen as a preview and on paper as is. */
function QrCard({ restaurant, table, code }: { restaurant: string; table: number; code: string }) {
  return (
    <article className="qr-card">
      <div className="qr-card-restaurant">{restaurant}</div>
      <div className="qr-card-table">Mesa {pad(table)}</div>
      <Qr text={tableLink(code)} label={`QR code da Mesa ${pad(table)}`} />
      <div className="qr-card-hint">Aponte a câmera para pedir</div>
    </article>
  );
}

/** Mesas → QR das mesas: one table (?mesa=12) or all of them, ready for the browser's print (A4, two per row). */
export default function TablesQrScreen({ mobile = false }: { mobile?: boolean }) {
  const { notify } = useDashboardState();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const only = params.get("mesa") ? Number(params.get("mesa")) : null;
  const [restaurant, setRestaurant] = useState("");
  const [tables, setTables] = useState<RestaurantTable[] | null>(null);
  const [codes, setCodes] = useState<Record<number, string>>({});
  const [qrOrdering, setQrOrdering] = useState(true);

  useEffect(() => {
    api.getRestaurant().then((r) => setRestaurant(r.name)).catch(() => {});
    api.getPaymentMode().then((r) => setQrOrdering(r.qrOrdering)).catch(() => {});
    api.listTables().then(setTables).catch(() => setTables([]));
  }, []);

  const shown = (tables ?? []).filter((t) => only == null || t.number === only);
  useEffect(() => {
    const missing = shown.filter((t) => !codes[t.number]);
    if (!missing.length) return;
    Promise.all(missing.map((t) => api.getTableQr(t.number).then((r) => [t.number, r.tableCode] as const)))
      .then((pairs) => setCodes((c) => ({ ...c, ...Object.fromEntries(pairs) })))
      .catch(() => notify("Não foi possível carregar os QR codes"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables, only]);

  const ready = shown.filter((t) => codes[t.number]);
  const cards = ready.map((t) => <QrCard key={t.id} restaurant={restaurant} table={t.number} code={codes[t.number]} />);

  // Dono and Administrador only (the API refuses the others).
  const canRegenerate = getSession()?.role === "owner" || getSession()?.role === "manager";
  const regenerate = async (n: number) => {
    if (!window.confirm(`Gerar um QR novo para a Mesa ${pad(n)}? As folhas impressas desta mesa deixarão de funcionar.`)) return;
    try {
      const { tableCode } = await api.regenerateTableQr(n);
      setCodes((c) => ({ ...c, [n]: tableCode }));
      notify(`QR novo da Mesa ${pad(n)} gerado. Imprima a folha nova: a antiga já não abre o cardápio.`);
    } catch {
      notify("Não foi possível gerar o QR novo");
    }
  };

  const copyLink = async (n: number) => {
    const url = tableLink(codes[n]);
    try {
      await navigator.clipboard.writeText(url);
      notify(`Link copiado: ${url}`);
    } catch {
      notify(`Link da Mesa ${pad(n)}: ${url}`);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: mobile ? 12 : 0 }}>
      <section className="card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {!mobile && (
          <button type="button" className="btn btn-ghost" onClick={() => navigate("/mesas", only != null ? { state: { select: only } } : undefined)}>
            <i className="fa-solid fa-chevron-left" aria-hidden="true" style={{ fontSize: 14 }} />
            Mesas
          </button>
        )}
        <div style={{ flex: 1, minWidth: 180 }}>
          <h1 style={{ margin: 0, fontSize: "var(--text-title3)", fontWeight: 600, letterSpacing: "-.015em" }}>{only != null ? `QR da Mesa ${pad(only)}` : "QR de todas as mesas"}</h1>
          <div style={{ fontSize: "var(--text-subheadline)", color: "var(--ink3)" }}>Folha A4, duas mesas por linha. Cada QR abre o cardápio daquela mesa.</div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-subheadline)" }}>
          <span className="field-label" style={{ margin: 0 }}>Mesas</span>
          <select className="field" style={{ width: "auto" }} value={only ?? ""} onChange={(e) => setParams(e.target.value ? { mesa: e.target.value } : {})}>
            <option value="">Todas</option>
            {(tables ?? []).map((t) => (
              <option key={t.id} value={t.number}>
                Mesa {pad(t.number)}
              </option>
            ))}
          </select>
        </label>
        {only != null && codes[only] && (
          <button type="button" className="btn btn-outline" onClick={() => copyLink(only)}>
            <i className="fa-solid fa-link" aria-hidden="true" style={{ fontSize: 14 }} />
            Copiar link
          </button>
        )}
        {only != null && codes[only] && canRegenerate && (
          <button type="button" className="btn btn-outline" style={{ color: "var(--alert)" }} onClick={() => regenerate(only)}>
            <i className="fa-solid fa-rotate" aria-hidden="true" style={{ fontSize: 14 }} />
            Gerar novo QR
          </button>
        )}
        <button type="button" className="btn btn-primary" disabled={!ready.length} onClick={() => window.print()}>
          <i className="fa-solid fa-print" aria-hidden="true" style={{ fontSize: 15 }} />
          Imprimir
        </button>
      </section>

      {!qrOrdering && (
        <div role="status" className="card" style={{ padding: 14, fontSize: "var(--text-subheadline)", color: "var(--ink2)" }}>
          O pedido pelo QR está desligado em Configurações → Salão: quem ler estes QR vê o aviso para chamar o garçom.
        </div>
      )}
      {tables && !shown.length && <div className="card" style={{ padding: 22, fontSize: "var(--text-subheadline)", color: "var(--ink3)" }}>{only != null ? `A Mesa ${pad(only)} não existe.` : "Nenhuma mesa cadastrada."}</div>}
      {only != null && codes[only] && (
        <div className="mono" style={{ fontSize: "var(--text-footnote)", color: "var(--ink3)", wordBreak: "break-all" }}>
          {tableLink(codes[only])}
        </div>
      )}

      <div className="qr-preview">{cards}</div>
      {/* On paper only this goes out: a copy of the cards straight under <body>, outside the app's layout. */}
      {createPortal(<div className="qr-print">{cards}</div>, document.body)}
    </div>
  );
}

export function MobileTablesQrScreen() {
  useMobileScreen({ title: "QR das mesas", subtitle: "Imprimir e compartilhar" });
  return <TablesQrScreen mobile />;
}
