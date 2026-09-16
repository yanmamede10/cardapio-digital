import { useEffect, useState } from "react";
import type { StaffMember, StaffRole } from "@cardapio/shared";
import { api } from "../../lib/api";
import { useMobileScreen } from "../../components/mobile/MobileLayout";

const ROLE_LABEL: Record<StaffRole, string> = { owner: "Dono", manager: "Gerente", waiter: "Garçom", kitchen: "Cozinha" };

export default function MobileTeamScreen() {
  const { notify } = useMobileScreen({ title: "Equipe", subtitle: "Usuários e permissões" });
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("waiter");

  useEffect(() => {
    api.getStaff().then((s) => (setStaff(s), setLoaded(true)));
  }, []);

  const sendInvite = async () => {
    if (!name.trim() || !email.trim()) return;
    try {
      const created = await api.inviteStaff({ name: name.trim(), email: email.trim(), role });
      setStaff((prev) => [...prev, created]);
      setName("");
      setEmail("");
      setRole("waiter");
      setInviteOpen(false);
      notify(`Convite enviado para ${created.name}`);
    } catch {
      notify("Não foi possível enviar o convite");
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
      <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
        {staff.map((p) => {
          const initials = p.name.split(" ").map((w) => w[0]).slice(0, 2).join("");
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderBottom: "1px solid var(--line)", minHeight: 62 }}>
              <div style={{ width: 40, height: 40, flex: "0 0 40px", borderRadius: "50%", background: "var(--surface2)", border: "1px solid var(--line)", color: "var(--ink2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 600 }}>{initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{p.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.email}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "3px 9px", background: p.role === "owner" ? "var(--brandSoft)" : "var(--surface2)", color: p.role === "owner" ? "var(--brandText)" : "var(--ink2)" }}>{ROLE_LABEL[p.role]}</span>
            </div>
          );
        })}
      </section>

      {inviteOpen && (
        <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: 13, display: "flex", flexDirection: "column", gap: 10 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" className="field-mobile" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" className="field-mobile" />
          <select value={role} onChange={(e) => setRole(e.target.value as StaffRole)} className="field-mobile">
            {(Object.keys(ROLE_LABEL) as StaffRole[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <button type="button" onClick={sendInvite} style={{ minHeight: 48, background: "var(--brand)", color: "var(--brandInk)", border: 0, borderRadius: 11, cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600 }}>
            Enviar convite
          </button>
        </section>
      )}

      <button
        type="button"
        onClick={() => setInviteOpen((v) => !v)}
        style={{ minHeight: 50, background: "var(--brand)", color: "var(--brandInk)", border: 0, borderRadius: 12, cursor: "pointer", font: "inherit", fontSize: 13.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        <i className="fa-solid fa-user-plus" style={{ fontSize: 14 }} />
        Convidar membro
      </button>
    </div>
  );
}
