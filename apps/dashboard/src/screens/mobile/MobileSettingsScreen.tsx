import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { useMobileScreen } from "../../components/mobile/MobileLayout";

export default function MobileSettingsScreen() {
  const navigate = useNavigate();
  const [restaurantName, setRestaurantName] = useState("");
  const [staffCount, setStaffCount] = useState<number | null>(null);
  useMobileScreen({ title: "Configurações", subtitle: restaurantName });

  useEffect(() => {
    api.getProfile().then((p) => setRestaurantName(p.name)).catch(() => {});
    api.getStaff().then((s) => setStaffCount(s.length)).catch(() => {});
  }, []);

  const groups = [
    {
      label: "Restaurante",
      items: [
        { label: "Perfil do restaurante", sub: "Nome, logo, capa e descrição", icon: "fa-store", go: () => navigate("/config/perfil") },
        { label: "Horários de funcionamento", sub: "Por dia da semana", icon: "fa-clock", go: () => navigate("/config/horarios") }
      ]
    },
    {
      label: "Operação",
      items: [
        { label: "Equipe e permissões", sub: staffCount != null ? `${staffCount} ${staffCount === 1 ? "membro ativo" : "membros ativos"}` : "…", icon: "fa-users", go: () => navigate("/config/equipe") },
        { label: "Dados fiscais", sub: "CNPJ, razão social, endereço", icon: "fa-file-invoice", go: () => navigate("/config/fiscal") }
      ]
    }
  ];

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      {groups.map((g) => (
        <section key={g.label} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
          <div className="mono" style={{ padding: "10px 13px", borderBottom: "1px solid var(--line)", fontSize: 10, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink3)" }}>
            {g.label}
          </div>
          {g.items.map((i) => (
            <button key={i.label} type="button" onClick={i.go} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: "transparent", border: 0, borderBottom: "1px solid var(--line)", cursor: "pointer", font: "inherit", color: "var(--ink)", padding: "0 13px", minHeight: 58 }}>
              <div style={{ width: 34, height: 34, flex: "0 0 34px", borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--line)", color: "var(--ink2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className={`fa-solid ${i.icon}`} style={{ fontSize: 14 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{i.label}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.sub}</div>
              </div>
              <i className="fa-solid fa-chevron-right" style={{ fontSize: 13, color: "var(--ink3)" }} />
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}
