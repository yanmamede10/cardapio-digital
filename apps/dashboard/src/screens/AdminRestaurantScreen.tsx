import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { PAYMENT_MODE_LABEL, PLAN_MODULES, ROLE_LABEL, TAX_REGIME_LABEL, type AdminRestaurantDetail, type PlanModule, type StaffMember } from "@cardapio/shared";
import type { ApiError } from "../lib/api";
import { fmtDate } from "../lib/format";
import { moduleLabel } from "../lib/modules";
import { useDashboardState } from "../state/DashboardStateContext";
import { Field } from "../components/SlideOver";
import { WhatsAppBadge } from "../components/WhatsApp";
import { TEMPLATES } from "./SettingsAppearanceTab";
import { StatusPill, signUpErrorText, type AdminCall } from "./AdminScreen";

type Form = { name: string; cnpj: string; contact: string; ownerEmail: string };
const formOf = (r: AdminRestaurantDetail): Form => ({ name: r.name, cnpj: r.cnpj, contact: r.contact, ownerEmail: r.ownerEmail });
const dateTime = (iso: string) => `${fmtDate(iso)} às ${new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="field-label">{title}</div>
      {children}
    </section>
  );
}

/** Super admin → one restaurant: sign-up data (editable), contracted modules, current settings (read-only), team, WhatsApp. */
export default function AdminRestaurantScreen({ id, call }: { id: string; call: AdminCall }) {
  const { notify } = useDashboardState();
  const [r, setR] = useState<AdminRestaurantDetail | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState({ price: "", day: "" });
  // Shown once after a reset: the API never returns the provisional password again.
  const [reset, setReset] = useState<{ name: string; email: string; password: string } | null>(null);

  useEffect(() => {
    call<AdminRestaurantDetail>(`/restaurants/${encodeURIComponent(id)}`)
      .then((d) => {
        setR(d);
        setForm(formOf(d));
        setPlan({ price: String(d.planPrice), day: String(d.planDueDay) });
      })
      .catch((e: ApiError) => setError(e.detail.includes("not found") ? "Restaurante não encontrado." : e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const back = (
    <Link to="/admin" style={{ fontSize: 13, color: "var(--ink2)" }}>
      ← Restaurantes
    </Link>
  );
  if (!r || !form) return error ? <>{back}<p style={{ color: "var(--ink2)" }}>{error}</p></> : <div className="skeleton" style={{ height: 300 }} />;

  const save = async () => {
    // Only what changed: a restaurant without a Dono has ownerEmail "", which the API would reject as an e-mail.
    const changed = Object.fromEntries(Object.entries(form).filter(([k, v]) => v !== formOf(r)[k as keyof Form]));
    if (!Object.keys(changed).length) return notify("Nada mudou");
    try {
      const updated = await call<AdminRestaurantDetail>(`/restaurants/${encodeURIComponent(r.id)}`, { method: "PATCH", body: JSON.stringify(changed) });
      setR(updated);
      setForm(formOf(updated));
      notify("Dados salvos");
    } catch (e) {
      notify(signUpErrorText((e as ApiError).detail, "Não foi possível salvar"));
    }
  };

  const toggleModule = async (m: PlanModule, on: boolean) => {
    const modules = on ? [...r.modules, m] : r.modules.filter((x) => x !== m);
    try {
      const res = await call<{ modules: PlanModule[] }>(`/restaurants/${encodeURIComponent(r.id)}/modules`, { method: "PATCH", body: JSON.stringify({ modules }) });
      setR({ ...r, modules: res.modules });
      notify(`${moduleLabel(m)} ${on ? "ligado" : "desligado"}`);
    } catch {
      notify("Não foi possível alterar o módulo");
    }
  };

  const savePlan = async () => {
    try {
      const updated = await call<AdminRestaurantDetail>(`/restaurants/${encodeURIComponent(r.id)}/plan`, {
        method: "PATCH",
        body: JSON.stringify({ planPrice: Number(plan.price.replace(",", ".")), planDueDay: Number(plan.day) })
      });
      setR(updated);
      notify("Mensalidade salva");
    } catch (e) {
      notify((e as ApiError).detail.includes("planDueDay") ? "O vencimento é um dia de 1 a 28" : "Informe um valor válido para a mensalidade");
    }
  };

  const resetPassword = async (s: StaffMember) => {
    try {
      const { password } = await call<{ password: string }>(`/restaurants/${encodeURIComponent(r.id)}/staff/${s.id}/reset-password`, { method: "POST" });
      setReset({ name: s.name, email: s.email, password });
    } catch {
      notify("Não foi possível resetar a senha");
    }
  };

  const settings: [string, ReactNode][] = [
    ["Template", TEMPLATES.find((t) => t.id === r.template)?.name ?? r.template],
    [
      "Cor",
      <span key="cor" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
        <span style={{ width: 14, height: 14, borderRadius: 4, background: r.brandColor, border: "1px solid var(--line2)" }} />
        <span className="mono">{r.brandColor}</span>
      </span>
    ],
    ["Recebimento", PAYMENT_MODE_LABEL[r.paymentMode] ?? r.paymentMode],
    ["Regime tributário", r.taxRegime ? TAX_REGIME_LABEL[r.taxRegime] : "Não informado"]
  ];

  return (
    <>
      {back}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{r.name}</h2>
        <StatusPill status={r.status} />
        <span className="mono" style={{ fontSize: 11.5, color: "var(--ink3)" }}>
          {r.id} · desde {fmtDate(r.createdAt)}
        </span>
      </div>

      <Card title="Dados cadastrais">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          <Field label="Nome">
            <input className="field" value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="CNPJ">
            <input className="field mono" inputMode="numeric" value={form.cnpj} maxLength={18} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
          </Field>
          <Field label="Contato">
            <input className="field" value={form.contact} maxLength={200} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
          </Field>
          <Field label="E-mail do dono">
            <input className="field" type="email" placeholder={r.ownerEmail ? "" : "Sem Dono na equipe"} disabled={!r.ownerEmail} value={form.ownerEmail} maxLength={254} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} />
          </Field>
        </div>
        <button type="button" className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={save}>
          Salvar dados
        </button>
      </Card>

      <Card title="Mensalidade">
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <Field label="Valor (R$)">
            <input className="field mono" inputMode="decimal" style={{ width: 140 }} value={plan.price} onChange={(e) => setPlan({ ...plan, price: e.target.value })} />
          </Field>
          <Field label="Dia de vencimento">
            <input className="field mono" type="number" min={1} max={28} style={{ width: 110 }} value={plan.day} onChange={(e) => setPlan({ ...plan, day: e.target.value })} />
          </Field>
          <button type="button" className="btn btn-primary" onClick={savePlan}>
            Salvar mensalidade
          </button>
          <Link to="/admin/mensalidades" style={{ fontSize: 12.5, color: "var(--ink2)", alignSelf: "center" }}>
            Ver cobranças →
          </Link>
        </div>
      </Card>

      <Card title="Módulos contratados">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 8 }}>
          {PLAN_MODULES.map((m) => (
            <label key={m} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={r.modules.includes(m)} onChange={(e) => toggleModule(m, e.target.checked)} />
              {moduleLabel(m)}
            </label>
          ))}
        </div>
        <div style={{ fontSize: 12, color: "var(--ink3)" }}>Desligado some do menu do restaurante e a API recusa; sem Delivery, o restaurante sai da lista do app do cliente (mesa e tablet seguem). Minha Fatura e Configurações ficam sempre ligados.</div>
      </Card>

      <Card title="Configurações atuais · só leitura">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
          {settings.map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>{label}</div>
              <div style={{ fontSize: 13.5 }}>{value}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title={`Equipe · ${r.staff.length}`}>
        {reset && (
          <div role="status" style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: 12, border: "1px solid var(--ok)", borderRadius: 10, fontSize: 13, lineHeight: 1.5 }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              Nova senha provisória de <b>{reset.name}</b> (<a className="mono" href={`mailto:${reset.email}`}>{reset.email}</a>):{" "}
              <span className="mono" style={{ fontWeight: 600 }}>{reset.password}</span>
              <div style={{ fontSize: 12, color: "var(--ink3)" }}>Anote agora: ela não aparece de novo. No próximo login a pessoa troca por uma senha dela; até lá, as sessões abertas param.</div>
            </div>
            <button type="button" className="btn btn-outline" onClick={() => setReset(null)}>
              Anotei
            </button>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {r.staff.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderTop: "1px solid var(--line)", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{s.name}</div>
                <a className="mono" href={`mailto:${s.email}`} style={{ fontSize: 11.5 }}>
                  {s.email}
                </a>
              </div>
              <span className="pill" style={{ background: "var(--surface2)", color: "var(--ink2)" }}>
                {ROLE_LABEL[s.role] ?? s.role}
              </span>
              <button type="button" className="btn btn-outline" style={{ padding: "6px 13px", fontSize: 12.5 }} aria-label={`Resetar senha de ${s.name}`} onClick={() => resetPassword(s)}>
                Resetar senha
              </button>
            </div>
          ))}
          {r.staff.length === 0 && <div style={{ fontSize: 13, color: "var(--ink3)" }}>Ninguém na equipe.</div>}
        </div>
      </Card>

      <Card title="WhatsApp · só leitura">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 13 }}>
          <WhatsAppBadge state={r.whatsapp.state} />
          <span style={{ color: "var(--ink2)" }}>
            {r.whatsapp.termsAcceptedAt
              ? `Aviso de risco aceito por ${r.whatsapp.termsAcceptedBy ?? "alguém que não está mais na equipe"} em ${dateTime(r.whatsapp.termsAcceptedAt)}`
              : "Aviso de risco ainda não aceito — o WhatsApp nunca foi configurado."}
          </span>
        </div>
      </Card>
    </>
  );
}
