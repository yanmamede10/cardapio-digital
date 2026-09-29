import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useMobileScreen } from "../components/mobile/MobileLayout";
import { useDashboardState } from "../state/DashboardStateContext";

type Salon = { qrOrdering: boolean; serviceCharge: boolean };

const SWITCHES: { key: keyof Salon; title: string; on: string; off: string; saved: [string, string] }[] = [
  {
    key: "qrOrdering",
    title: "Clientes pedem pelo QR da mesa",
    on: "Ligado: o cliente escaneia o QR da mesa (ou usa o tablet fixo) e o pedido vai para a Central. Os garçons também lançam.",
    off: "Desligado: só os garçons lançam os pedidos (Mesas → mesa → Lançar pedido). Não é preciso imprimir QR nas mesas.",
    saved: ["Clientes voltam a pedir pelo QR da mesa", "Pedidos da mesa só pelos garçons"]
  },
  {
    key: "serviceCharge",
    title: "Cobrar 10% de serviço nas mesas",
    on: "Ligado: a comanda soma 10% sobre os itens, e esse total é o que entra em Contas a Receber.",
    off: "Desligado: a comanda cobra só os itens.",
    saved: ["As comandas das mesas passam a somar 10% de serviço", "As comandas das mesas deixam de somar serviço"]
  }
];

/** Configurações → Salão: how the tables order and pay. */
export default function SettingsSalonTab() {
  const { notify } = useDashboardState();
  const [salon, setSalon] = useState<Salon | null>(null);

  useEffect(() => {
    api.getPaymentMode().then((r) => setSalon({ qrOrdering: r.qrOrdering, serviceCharge: r.serviceCharge })).catch(() => notify("Não foi possível carregar as configurações do salão"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = async (s: (typeof SWITCHES)[number]) => {
    if (!salon) return;
    const next = !salon[s.key];
    setSalon({ ...salon, [s.key]: next });
    try {
      await api.setPaymentMode({ [s.key]: next });
      notify(s.saved[next ? 0 : 1]);
    } catch {
      setSalon({ ...salon, [s.key]: !next });
      notify("Não foi possível salvar — tente de novo");
    }
  };

  if (!salon) return <div className="skeleton" style={{ height: 180 }} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
      {SWITCHES.map((s) => (
        <section key={s.key} className="card" style={{ padding: 22 }}>
          <button
            type="button"
            role="switch"
            aria-checked={salon[s.key]}
            onClick={() => toggle(s)}
            style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", border: 0, background: "transparent", padding: 0, cursor: "pointer", textAlign: "left", color: "var(--ink)" }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 600, fontSize: 14 }}>{s.title}</span>
              <span style={{ display: "block", fontSize: 12.5, color: "var(--ink2)", lineHeight: 1.6, marginTop: 4 }}>{salon[s.key] ? s.on : s.off}</span>
            </span>
            <span className="toggle-track" style={{ background: salon[s.key] ? "var(--ok)" : "var(--line2)" }}>
              <span className="toggle-knob" style={{ left: salon[s.key] ? 16 : 2 }} />
            </span>
          </button>
        </section>
      ))}
    </div>
  );
}

export function MobileSalonScreen() {
  useMobileScreen({ title: "Salão", subtitle: "Pedidos pelo QR e serviço" });
  return (
    <div style={{ padding: 12 }}>
      <SettingsSalonTab />
    </div>
  );
}
