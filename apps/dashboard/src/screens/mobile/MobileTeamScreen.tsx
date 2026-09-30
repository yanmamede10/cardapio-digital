import { useEffect, useState } from "react";
import type { StaffMember, StaffRole } from "@cardapio/shared";
import { MIN_PASSWORD_LENGTH, ROLE_LABEL } from "@cardapio/shared";
import { ApiError, api, getSession } from "../../lib/api";
import { useMobileScreen } from "../../components/mobile/MobileLayout";
import { LEVELS_HINT } from "../SettingsScreen";

const EMPTY_MEMBER = { id: null as string | null, name: "", email: "", role: "waiter" as StaffRole, password: "" };

export default function MobileTeamScreen() {
  const { notify } = useMobileScreen({ title: "Equipe e permissões", subtitle: "Usuários e papéis" });
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [member, setMember] = useState(EMPTY_MEMBER);

  useEffect(() => {
    api.getStaff().then((s) => (setStaff(s), setLoaded(true)));
  }, []);

  const open = (next: typeof EMPTY_MEMBER) => (setMember(next), setFormOpen(true));

  // id null = adding (password required), id set = editing (password optional, resets it).
  const save = async () => {
    const { id, name, email, role, password } = member;
    if (!name.trim() || !email.trim()) return notify("Preencha nome e e-mail");
    if ((!id || password) && password.length < MIN_PASSWORD_LENGTH) return notify(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres`);
    try {
      const saved = id ? await api.updateStaff(id, { name, email, role, ...(password ? { password } : {}) }) : await api.inviteStaff({ name, email, role, password });
      setStaff((prev) => (id ? prev.map((s) => (s.id === id ? saved : s)) : [...prev, saved]));
      setMember(EMPTY_MEMBER);
      setFormOpen(false);
      notify(id ? `${saved.name} atualizado` : `${saved.name} adicionado à equipe`);
    } catch (err) {
      notify(err instanceof ApiError && err.status === 409 ? "Esse e-mail já está em uso" : err instanceof ApiError && err.status === 400 ? err.message : "Não foi possível salvar");
    }
  };

  if (!loaded) {
    return (
      <div style={{ padding: 12 }}>
        <div className="skeleton" style={{ height: 260 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 12, color: "var(--ink3)" }}>{LEVELS_HINT}</p>
      <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
        {staff.map((p) => {
          const initials = p.name.split(" ").map((w) => w[0]).slice(0, 2).join("");
          return (
            <button
              key={p.id}
              type="button"
              aria-label={`Editar ${p.name}`}
              onClick={() => open({ id: p.id, name: p.name, email: p.email, role: p.role, password: "" })}
              style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", background: "transparent", border: 0, borderBottom: "1px solid var(--line)", cursor: "pointer", font: "inherit", color: "var(--ink)", padding: "11px 13px", minHeight: 62 }}
            >
              <div style={{ width: 40, height: 40, flex: "0 0 40px", borderRadius: "50%", background: "var(--surface2)", border: "1px solid var(--line)", color: "var(--ink2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 600 }}>{initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{p.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.email}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "3px 9px", background: p.role === "owner" ? "var(--brandSoft)" : "var(--surface2)", color: p.role === "owner" ? "var(--brandText)" : "var(--ink2)" }}>{ROLE_LABEL[p.role] ?? p.role}</span>
            </button>
          );
        })}
      </section>

      {formOpen && (
        <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: 13, display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink3)" }}>{member.id ? "Editar membro" : "Adicionar membro"}</div>
          <input value={member.name} onChange={(e) => setMember({ ...member, name: e.target.value })} placeholder="Nome" maxLength={120} className="field-mobile" />
          <input value={member.email} onChange={(e) => setMember({ ...member, email: e.target.value })} placeholder="E-mail" type="email" maxLength={254} className="field-mobile" />
          <select value={member.role} disabled={member.id === getSession()?.staffId} onChange={(e) => setMember({ ...member, role: e.target.value as StaffRole })} className="field-mobile" aria-label="Papel">
            {(Object.keys(ROLE_LABEL) as StaffRole[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <input value={member.password} onChange={(e) => setMember({ ...member, password: e.target.value })} placeholder={member.id ? `Nova senha (opcional, mín. ${MIN_PASSWORD_LENGTH})` : `Senha inicial (mín. ${MIN_PASSWORD_LENGTH})`} type="password" autoComplete="new-password" className="field-mobile" />
          <button type="button" onClick={save} style={{ minHeight: 48, background: "var(--brand)", color: "var(--brandInk)", border: 0, borderRadius: 11, cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600 }}>
            {member.id ? "Salvar alterações" : "Adicionar"}
          </button>
        </section>
      )}

      <button
        type="button"
        onClick={() => (formOpen && !member.id ? setFormOpen(false) : open(EMPTY_MEMBER))}
        style={{ minHeight: 50, background: "var(--brand)", color: "var(--brandInk)", border: 0, borderRadius: 12, cursor: "pointer", font: "inherit", fontSize: 13.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        <i className="fa-solid fa-user-plus" style={{ fontSize: 14 }} />
        Adicionar membro
      </button>
    </div>
  );
}
