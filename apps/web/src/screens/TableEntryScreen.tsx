import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useApp } from "../context/AppContext";

export default function TableEntryScreen() {
  const { tableCode } = useParams();
  const navigate = useNavigate();
  const { enterTableMode } = useApp();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!tableCode) return;
    api
      .resolveTable(tableCode)
      .then((res) => {
        if (cancelled) return;
        enterTableMode(res.restaurantId, res.tableNumber);
        navigate(`/r/${res.restaurantId}/menu`, { replace: true });
      })
      .catch(() => {
        if (!cancelled) setError("Mesa não encontrada. Confira o código do QR ou chame um atendente.");
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
