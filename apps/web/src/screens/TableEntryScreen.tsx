import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError, api } from "../lib/api";
import { usePageTitle } from "../lib/title";
import { useApp } from "../context/AppContext";

export default function TableEntryScreen() {
  const { tableCode } = useParams();
  const navigate = useNavigate();
  const { enterTableMode } = useApp();
  const [error, setError] = useState<string | null>(null);
  usePageTitle(!error ? "Identificando a mesa" : error.startsWith("Mesa não encontrada") ? "Mesa não encontrada" : "Chame um atendente");

  useEffect(() => {
    let cancelled = false;
    if (!tableCode) return;
    api
      .resolveTable(tableCode)
      .then((res) => {
        if (cancelled) return;
        enterTableMode(res.restaurantId, res.tableNumber, tableCode);
        navigate(`/r/${res.restaurantId}/menu`, { replace: true });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError && err.status === 403 ? "Neste restaurante os pedidos são feitos pelo garçom. É só chamar um atendente." : "Mesa não encontrada. Confira o código do QR ou chame um atendente.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableCode]);

  return (
    <div className="screen" style={{ alignItems: "center", justifyContent: "center", padding: "var(--pad)", textAlign: "center", gap: 14 }}>
      {error ? (
        <>
          <i className="fa-solid fa-qrcode" style={{ fontSize: 38, color: "var(--ink2)", opacity: 0.6 }} />
          <div style={{ font: "700 var(--t-m) var(--font)" }}>{error}</div>
        </>
      ) : (
        <>
          <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 28, color: "var(--acc)" }} />
          <div className="mono-label">identificando a mesa…</div>
        </>
      )}
    </div>
  );
}

/** UX-05: an address the app doesn't know, outside a table (NotAtATable sends a table back to its menu) — the look of
 *  "Mesa não encontrada" above, its own message: a wrong link, not a bad QR. */
export function NotFound() {
  usePageTitle("Link não encontrado");
  return (
    <div className="screen" style={{ alignItems: "center", justifyContent: "center", padding: "var(--pad)", textAlign: "center", gap: 14 }}>
      <i className="fa-solid fa-link-slash" style={{ fontSize: 38, color: "var(--ink2)", opacity: 0.6 }} />
      <h1 style={{ margin: 0, font: "700 var(--t-m) var(--font)" }}>Link não encontrado</h1>
      <p style={{ margin: 0, maxWidth: 420, font: "400 var(--t-b)/1.45 var(--font)", color: "var(--ink2)" }}>Para fazer seu pedido, escaneie o QR code da mesa ou chame um atendente.</p>
    </div>
  );
}
