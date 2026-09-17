import { useEffect, useState } from "react";
import type { FiscalInfo, OperatingHoursRow, RestaurantProfile, StaffMember, StaffRole } from "@cardapio/shared";
import { ApiError, api } from "../lib/api";
import { fmtDate } from "../lib/format";
import { useDashboardState } from "../state/DashboardStateContext";
import { Segmented } from "../components/Segmented";
import { Field } from "../components/SlideOver";

type Tab = "profile" | "hours" | "staff" | "fiscal";

const WEEKDAY_LABEL = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const ROLE_LABEL: Record<StaffRole, string> = { owner: "Dono", manager: "Gerente", waiter: "Garçom", kitchen: "Cozinha" };

export default function SettingsScreen() {
  const { notify } = useDashboardState();
  const [tab, setTab] = useState<Tab>("profile");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<RestaurantProfile | null>(null);
  const [hours, setHours] = useState<OperatingHoursRow[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [fiscal, setFiscal] = useState<FiscalInfo | null>(null);
  const [invite, setInvite] = useState({ name: "", email: "", role: "waiter" as StaffRole });

  useEffect(() => {
    Promise.all([api.getProfile(), api.getHours(), api.getStaff(), api.getFiscal()])
      .then(([p, h, s, f]) => {
        setProfile(p);
        setHours(h);
        setStaff(s);
        setFiscal(f);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof ApiError && err.status === 403 ? "Você não tem permissão para acessar Configurações." : "Não foi possível carregar Configurações.");
        setLoading(false);
      });
  }, []);

  const saveProfile = async () => {
    if (!profile) return;
    try {
      await api.updateProfile(profile);
      notify("Perfil do restaurante atualizado");
    } catch {
      notify("Não foi possível salvar o perfil");
    }
  };

  const saveHours = async () => {
    try {
      const updated = await api.updateHours(hours);
      setHours(updated);
      notify("Horário de funcionamento atualizado");
    } catch {
      notify("Não foi possível salvar os horários");
    }
  };

  const saveFiscal = async () => {
    if (!fiscal) return;
    try {
      await api.updateFiscal(fiscal);
      notify("Dados fiscais atualizados");
    } catch {
      notify("Não foi possível salvar os dados fiscais");
    }
  };

  const sendInvite = async () => {
    if (!invite.name.trim() || !invite.email.trim()) return;
    try {
      const created = await api.inviteStaff(invite);
      setStaff((prev) => [...prev, created]);
      setInvite({ name: "", email: "", role: "waiter" });
      notify(`Convite enviado para ${created.name}`);
    } catch {
      notify("Não foi possível enviar o convite");
    }
  };

  if (error) {
    return <p style={{ color: "var(--ink2)" }}>{error}</p>;
  }

  if (loading || !profile || !fiscal) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="skeleton" style={{ height: 40, width: 320 }} />
        <div className="skeleton" style={{ height: 380 }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "profile", label: "Perfil" },
          { value: "hours", label: "Horários" },
          { value: "staff", label: "Equipe" },
          { value: "fiscal", label: "Fiscal" }
        ]}
      />

      {tab === "profile" && (
        <section className="card" style={{ padding: 18, maxWidth: 520, display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Nome do restaurante">
            <input className="field" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          </Field>
          <Field label="Categoria da cozinha">
            <input className="field" value={profile.cuisineCategory} onChange={(e) => setProfile({ ...profile, cuisineCategory: e.target.value })} />
          </Field>
          <Field label="Descrição">
            <textarea className="field" rows={4} value={profile.description} onChange={(e) => setProfile({ ...profile, description: e.target.value })} />
          </Field>
          <button type="button" className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={saveProfile}>
            Salvar perfil
          </button>
        </section>
      )}

      {tab === "hours" && (
        <section className="card" style={{ padding: 18, maxWidth: 620, display: "flex", flexDirection: "column", gap: 12 }}>
          {hours.map((row, i) => (
            <div key={row.weekday} style={{ display: "grid", gridTemplateColumns: "110px 1fr 1fr 70px", gap: 10, alignItems: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{WEEKDAY_LABEL[row.weekday]}</div>
              <input
                className="field mono"
                style={{ fontSize: 12.5, padding: "8px 10px" }}
                value={row.lunch}
                disabled={!row.isOpen}
                placeholder="Fechado"
                onChange={(e) => setHours(hours.map((h, j) => (i === j ? { ...h, lunch: e.target.value } : h)))}
              />
              <input
                className="field mono"
                style={{ fontSize: 12.5, padding: "8px 10px" }}
                value={row.dinner}
                disabled={!row.isOpen}
                placeholder="Fechado"
                onChange={(e) => setHours(hours.map((h, j) => (i === j ? { ...h, dinner: e.target.value } : h)))}
              />
              <button
                type="button"
                onClick={() => setHours(hours.map((h, j) => (i === j ? { ...h, isOpen: !h.isOpen } : h)))}
                style={{ display: "flex", justifyContent: "flex-end", background: "transparent", border: 0, cursor: "pointer", padding: 0 }}
              >
                <span className="toggle-track" style={{ background: row.isOpen ? "var(--ok)" : "var(--line2)" }}>
                  <span className="toggle-knob" style={{ left: row.isOpen ? 16 : 2 }} />
                </span>
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-primary" style={{ alignSelf: "flex-start", marginTop: 6 }} onClick={saveHours}>
            Salvar horários
          </button>
        </section>
      )}

      {tab === "staff" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 620 }}>
          <section className="card" style={{ overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 110px 110px", gap: 12, padding: "9px 16px", background: "var(--surface2)", borderBottom: "1px solid var(--line)" }}>
              {["Nome", "E-mail", "Função", "Convidado em"].map((h) => (
                <div key={h} className="field-label">
                  {h}
                </div>
              ))}
            </div>
            {staff.map((s) => (
              <div key={s.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 110px 110px", gap: 12, alignItems: "center", padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                <div style={{ fontSize: 12.5, color: "var(--ink2)" }}>{s.email}</div>
                <span className="pill" style={{ alignSelf: "start", background: "var(--surface2)", color: "var(--brandText)" }}>
                  {ROLE_LABEL[s.role]}
                </span>
                <div className="mono" style={{ fontSize: 11.5, color: "var(--ink3)" }}>
                  {fmtDate(s.invitedAt)}
                </div>
              </div>
            ))}
          </section>
          <section className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="field-label">Convidar novo membro</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 130px auto", gap: 10 }}>
              <input className="field" placeholder="Nome" value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} />
              <input className="field" placeholder="E-mail" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
              <select className="field" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value as StaffRole })}>
                {(Object.keys(ROLE_LABEL) as StaffRole[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-primary" onClick={sendInvite}>
                Convidar
              </button>
            </div>
          </section>
        </div>
      )}

      {tab === "fiscal" && (
        <section className="card" style={{ padding: 18, maxWidth: 520, display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Razão social">
            <input className="field" value={fiscal.legalName} onChange={(e) => setFiscal({ ...fiscal, legalName: e.target.value })} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="CNPJ">
              <input className="field mono" value={fiscal.cnpj} onChange={(e) => setFiscal({ ...fiscal, cnpj: e.target.value })} />
            </Field>
            <Field label="Inscrição estadual">
              <input className="field mono" value={fiscal.stateRegistration} onChange={(e) => setFiscal({ ...fiscal, stateRegistration: e.target.value })} />
            </Field>
          </div>
          <Field label="Regime tributário">
            <input className="field" value={fiscal.taxRegime} onChange={(e) => setFiscal({ ...fiscal, taxRegime: e.target.value })} />
          </Field>
          <Field label="Endereço fiscal">
            <input className="field" value={fiscal.fiscalAddress} onChange={(e) => setFiscal({ ...fiscal, fiscalAddress: e.target.value })} />
          </Field>
          <button type="button" className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={saveFiscal}>
            Salvar dados fiscais
          </button>
        </section>
      )}
    </div>
  );
}
