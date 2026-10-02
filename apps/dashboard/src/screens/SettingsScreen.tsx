import { useEffect, useState } from "react";
import type { FiscalInfo, OperatingHoursRow, RestaurantProfile, StaffMember, StaffRole, TaxRegime } from "@cardapio/shared";
import { MIN_PASSWORD_LENGTH, ROLE_LABEL, TAX_REGIME_LABEL } from "@cardapio/shared";
import { ApiError, api, getSession } from "../lib/api";
import { fmtDate } from "../lib/format";
import { moduleOn } from "../lib/modules";
import { useDashboardState } from "../state/DashboardStateContext";
import { Segmented } from "../components/Segmented";
import { Field } from "../components/SlideOver";
import AppearanceTab from "./SettingsAppearanceTab";
import PaymentSubaccountTab from "./SettingsFinanceTab";
import WhatsAppTab from "./SettingsWhatsAppTab";
import SettingsSalonTab from "./SettingsSalonTab";

type Tab = "profile" | "appearance" | "hours" | "salon" | "staff" | "finance" | "fiscal" | "whatsapp";

const WEEKDAY_LABEL = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const EMPTY_MEMBER = { id: null as string | null, name: "", email: "", role: "waiter" as StaffRole, password: "" };
export const LEVELS_HINT = "Funcionário: Operação (pedidos, mesas, cardápio; garçom também Atendimento) · Administrador: também Produtos, Relatórios e Financeiro · Dono: tudo, inclusive Configurações e DRE.";

export default function SettingsScreen() {
  const { notify } = useDashboardState();
  const [tab, setTab] = useState<Tab>("profile");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<RestaurantProfile | null>(null);
  const [hours, setHours] = useState<OperatingHoursRow[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [fiscal, setFiscal] = useState<FiscalInfo | null>(null);
  const [member, setMember] = useState(EMPTY_MEMBER);

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

  // One form for both: id null = adding (password required), id set = editing (password optional, resets it).
  const saveMember = async () => {
    const { id, name, email, role, password } = member;
    if (!name.trim() || !email.trim()) return notify("Preencha nome e e-mail");
    if ((!id || password) && password.length < MIN_PASSWORD_LENGTH) return notify(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres`);
    try {
      const saved = id ? await api.updateStaff(id, { name, email, role, ...(password ? { password } : {}) }) : await api.inviteStaff({ name, email, role, password });
      setStaff((prev) => (id ? prev.map((s) => (s.id === id ? saved : s)) : [...prev, saved]));
      setMember(EMPTY_MEMBER);
      notify(id ? `${saved.name} atualizado` : `${saved.name} adicionado à equipe`);
    } catch (err) {
      notify(err instanceof ApiError && err.status === 409 ? "Esse e-mail já está em uso" : err instanceof ApiError && err.status === 400 ? err.message : "Não foi possível salvar");
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
          { value: "appearance", label: "Aparência" },
          { value: "hours", label: "Horários" },
          { value: "salon", label: "Salão" },
          { value: "staff", label: "Equipe & Permissões" },
          { value: "finance", label: "Financeiro" },
          { value: "fiscal", label: "Fiscal" },
          ...(moduleOn("atendimento") ? [{ value: "whatsapp" as const, label: "WhatsApp" }] : [])
        ]}
      />

      {tab === "profile" && (
        <section className="card" style={{ padding: 18, maxWidth: 520, display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Nome do restaurante">
            <input className="field" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} maxLength={80} />
          </Field>
          <Field label="Categoria da cozinha">
            <input className="field" value={profile.cuisineCategory} onChange={(e) => setProfile({ ...profile, cuisineCategory: e.target.value })} maxLength={60} />
          </Field>
          <Field label="Descrição">
            <textarea className="field" rows={4} value={profile.description} onChange={(e) => setProfile({ ...profile, description: e.target.value })} maxLength={500} />
          </Field>
          <button type="button" className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={saveProfile}>
            Salvar perfil
          </button>
        </section>
      )}

      {tab === "appearance" && <AppearanceTab restaurantName={profile.name} />}

      {tab === "salon" && <SettingsSalonTab />}
      {tab === "finance" && <PaymentSubaccountTab />}

      {tab === "whatsapp" && <WhatsAppTab />}

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
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 720 }}>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink3)" }}>{LEVELS_HINT}</p>
          <section className="card" style={{ overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px 90px 70px", gap: 12, padding: "9px 16px", background: "var(--surface2)", borderBottom: "1px solid var(--line)" }}>
              {["Nome", "E-mail", "Papel", "Desde", ""].map((h) => (
                <div key={h} className="field-label">
                  {h}
                </div>
              ))}
            </div>
            {staff.map((s) => (
              <div key={s.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px 90px 70px", gap: 12, alignItems: "center", padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                <div style={{ fontSize: 12.5, color: "var(--ink2)", overflow: "hidden", textOverflow: "ellipsis" }}>{s.email}</div>
                <span className="pill" style={{ alignSelf: "start", background: "var(--surface2)", color: "var(--brandText)" }}>
                  {ROLE_LABEL[s.role] ?? s.role}
                </span>
                <div className="mono" style={{ fontSize: 11.5, color: "var(--ink3)" }}>
                  {fmtDate(s.invitedAt)}
                </div>
                <button type="button" className="btn btn-ghost" style={{ padding: "6px 13px", fontSize: 12.5, color: "var(--brandText)" }} onClick={() => setMember({ id: s.id, name: s.name, email: s.email, role: s.role, password: "" })}>
                  Editar
                </button>
              </div>
            ))}
          </section>
          <section className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="field-label">{member.id ? `Editar ${staff.find((s) => s.id === member.id)?.name ?? "membro"}` : "Adicionar membro"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Nome">
                <input className="field" value={member.name} maxLength={120} onChange={(e) => setMember({ ...member, name: e.target.value })} />
              </Field>
              <Field label="E-mail">
                <input className="field" type="email" value={member.email} maxLength={254} onChange={(e) => setMember({ ...member, email: e.target.value })} />
              </Field>
              <Field label="Papel">
                <select className="field" value={member.role} disabled={member.id === getSession()?.staffId} onChange={(e) => setMember({ ...member, role: e.target.value as StaffRole })}>
                  {(Object.keys(ROLE_LABEL) as StaffRole[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={member.id ? "Nova senha (opcional)" : "Senha inicial"}>
                <input className="field" type="password" autoComplete="new-password" value={member.password} onChange={(e) => setMember({ ...member, password: e.target.value })} placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`} />
              </Field>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn btn-primary" onClick={saveMember}>
                {member.id ? "Salvar alterações" : "Adicionar"}
              </button>
              {member.id && (
                <button type="button" className="btn btn-outline" onClick={() => setMember(EMPTY_MEMBER)}>
                  Cancelar
                </button>
              )}
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
              <input inputMode="numeric" className="field mono" value={fiscal.cnpj} onChange={(e) => setFiscal({ ...fiscal, cnpj: e.target.value })} />
            </Field>
            <Field label="Inscrição estadual">
              <input className="field mono" value={fiscal.stateRegistration} onChange={(e) => setFiscal({ ...fiscal, stateRegistration: e.target.value })} />
            </Field>
          </div>
          <Field label="Regime tributário">
            <select className="field" value={fiscal.taxRegime} onChange={(e) => setFiscal({ ...fiscal, taxRegime: e.target.value as TaxRegime })}>
              {(Object.keys(TAX_REGIME_LABEL) as TaxRegime[]).map((r) => (
                <option key={r} value={r}>
                  {TAX_REGIME_LABEL[r]}
                </option>
              ))}
            </select>
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
