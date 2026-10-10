import { useEffect, useState } from "react";
import type { OperatingHoursRow } from "@cardapio/shared";
import { api } from "../../lib/api";
import { useMobileScreen } from "../../components/mobile/MobileLayout";
import { MobileToggle } from "../../components/mobile/MobileToggle";

const WEEKDAY_LABEL = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export default function MobileHoursScreen() {
  const { notify } = useMobileScreen({ title: "Horários", subtitle: "Funcionamento por dia da semana" });
  const [hours, setHours] = useState<OperatingHoursRow[] | null>(null);

  useEffect(() => {
    api.getHours().then(setHours);
  }, []);

  const toggle = async (row: OperatingHoursRow) => {
    if (!hours) return;
    const next = hours.map((h) => (h.weekday === row.weekday ? { ...h, isOpen: !h.isOpen } : h));
    setHours(next);
    try {
      const updated = await api.updateHours(next);
      setHours(updated);
    } catch {
      notify("Não foi possível atualizar o horário");
      setHours(hours);
    }
  };

  if (!hours) {
    return (
      <div style={{ padding: 12 }}>
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
        {hours.map((row) => (
          <div key={row.weekday} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 13px", borderBottom: "1px solid var(--line)", minHeight: 58 }}>
            <div style={{ width: 42, fontSize: "var(--text-subheadline)", fontWeight: 600 }}>{WEEKDAY_LABEL[row.weekday]}</div>
            <div className="mono" style={{ flex: 1, fontSize: "var(--text-subheadline)", color: row.isOpen ? "var(--ink2)" : "var(--ink3)" }}>
              {row.isOpen ? `${row.lunch} · ${row.dinner}` : "Fechado"}
            </div>
            <MobileToggle on={row.isOpen} onClick={() => toggle(row)} label={`Aberto ${WEEKDAY_LABEL[row.weekday]}`} />
          </div>
        ))}
      </section>
    </div>
  );
}
