import { useEffect, useState, type ReactNode } from "react";
import type { AdminRestaurant, RestaurantStatus } from "@cardapio/shared";
import { BASE_URL } from "../lib/api";
import { fmtDate } from "../lib/format";
import { useDashboardState } from "../state/DashboardStateContext";
import { Segmented } from "../components/Segmented";
import { Field } from "../components/SlideOver";
import { Toast } from "../components/Toast";

const KEY_STORAGE = "mesapronta.adminKey";
const STATUS_LABEL: Record<RestaurantStatus, string> = { ativo: "Ativo", pendente: "Pendente", inativo: "Inativo" };
const STATUS_FG: Record<RestaurantStatus, string> = { ativo: "var(--ok)", pendente: "var(--warn)", inativo: "var(--ink3)" };
const EMPTY_FORM = { name: "", cnpj: "", contact: "", ownerName: "", ownerEmail: "" };

function loadKey(): string {
  try {
    return sessionStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

/** Super admin (ADMIN-01) at /admin: platform key instead of a staff login; lists, registers and (de)activates restaurants. */
export default function AdminScreen() {
  const { notify } = useDashboardState();
  const [key, setKey] = useState(loadKey);
  const [keyDraft, setKeyDraft] = useState("");
  const [list, setList] = useState<AdminRestaurant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"todos" | RestaurantStatus>("todos");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<typeof EMPTY_FORM | null>(null);
  // Shown once after a sign-up: the API never returns the temporary password again.
  const [ownerAccess, setOwnerAccess] = useState<{ restaurant: string; email: string; password: string } | null>(null);

  // Own tiny fetch: the staff request() would attach the staff token and log the staff out on a 401.
  const call = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(`${BASE_URL}/api/admin${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` } });
    const body = await res.json().catch(() => null);
    if (res.status === 401) {
      signOut();
      throw new Error("Chave de administrador inválida");
    }
    if (!res.ok) throw new Error(body?.error ?? `Erro ${res.status}`);
    return body as T;
  };

  const signOut = (message?: string) => {
    try {
      sessionStorage.removeItem(KEY_STORAGE);
    } catch {
      // ignore
    }
    setKey("");
    setList(null);
    setError(message ?? null);
  };

  useEffect(() => {
    if (!key) return;
    call<AdminRestaurant[]>("/restaurants")
      .then((l) => {
        setList(l);
        try {
          sessionStorage.setItem(KEY_STORAGE, key);
        } catch {
          // ignore — works for this page load
        }
      })
      .catch((e: Error) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const create = async () => {
    if (!form) return;
    try {
      const { ownerPassword, ...created } = await call<AdminRestaurant & { ownerPassword: string }>("/restaurants", { method: "POST", body: JSON.stringify(form) });
      setList((prev) => [created, ...(prev ?? [])]);
      setOwnerAccess({ restaurant: created.name, email: form.ownerEmail.trim().toLowerCase(), password: ownerPassword });
      setForm(null);
      notify(`${created.name} cadastrado como pendente`);
    } catch (e) {
      const msg = (e as Error).message;
      notify(
        msg.includes("cnpj already") ? "Esse CNPJ já está cadastrado"
        : msg.includes("cnpj") ? "CNPJ precisa ter 14 dígitos"
        : msg.includes("owner email already") ? "Esse e-mail já é usado por outra pessoa"
        : msg.includes("ownerEmail") ? "E-mail do dono inválido"
        : msg.includes("ownerName") ? "Informe o nome do dono"
        : "Não foi possível cadastrar"
      );
    }
  };

  const setStatus = async (r: AdminRestaurant, status: "ativo" | "inativo") => {
    try {
      const updated = await call<AdminRestaurant>(`/restaurants/${r.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      setList((prev) => prev!.map((x) => (x.id === r.id ? updated : x)));
      notify(`${r.name} ${status === "ativo" ? "ativado" : "desativado"}`);
    } catch {
      notify("Não foi possível alterar o status");
    }
  };

  const page = (children: ReactNode) => (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "28px 16px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: "-.015em" }}>Restaurantes</h1>
            <div className="mono" style={{ fontSize: 10, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink3)" }}>
              MesaPronta · Plataforma
            </div>
          </div>
          {key && (
            <button type="button" className="btn btn-outline" onClick={() => signOut()}>
              Sair
            </button>
          )}
        </div>
        {children}
      </div>
      <Toast />
    </div>
  );

  if (!key) {
    return page(
      <form
        className="card"
        style={{ padding: 18, maxWidth: 420, display: "flex", flexDirection: "column", gap: 12 }}
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setKey(keyDraft);
        }}
      >
        <Field label="Chave de administrador">
          <input className="field" type="password" autoComplete="current-password" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} autoFocus />
        </Field>
        {error && <div style={{ fontSize: 12.5, color: "var(--alert)" }}>{error}</div>}
        <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
          Entrar
        </button>
      </form>
    );
  }

  if (!list) return page(error ? <p style={{ color: "var(--ink2)" }}>{error}</p> : <div className="skeleton" style={{ height: 300 }} />);

  const q = query.trim().toLowerCase();
  const digitsQ = q.replace(/\D/g, "");
  const shown = list.filter(
    (r) => (filter === "todos" || r.status === filter) && (!q || r.name.toLowerCase().includes(q) || (!!digitsQ && r.cnpj.replace(/\D/g, "").includes(digitsQ)))
  );
  const count = (s: RestaurantStatus) => list.filter((r) => r.status === s).length;
  const cols = "minmax(0,1.4fr) 160px minmax(0,1fr) 100px 95px 110px";

  return page(
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <input className="field" style={{ width: 260 }} placeholder="Buscar por nome ou CNPJ" aria-label="Buscar restaurante" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "todos", label: "Todos", count: list.length },
            { value: "ativo", label: "Ativos", count: count("ativo") },
            { value: "pendente", label: "Pendentes", count: count("pendente") },
            { value: "inativo", label: "Inativos", count: count("inativo") }
          ]}
        />
        <div style={{ flex: 1 }} />
        <button type="button" className="btn btn-primary" onClick={() => setForm(form ? null : EMPTY_FORM)}>
          Novo restaurante
        </button>
      </div>

      {form && (
        <section className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="field-label">Cadastrar restaurante · entra como pendente</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
            <Field label="Nome">
              <input className="field" value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="CNPJ">
              <input className="field mono" inputMode="numeric" placeholder="00.000.000/0000-00" value={form.cnpj} maxLength={18} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
            </Field>
            <Field label="Contato">
              <input className="field" placeholder="Nome, telefone ou e-mail" value={form.contact} maxLength={200} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
            </Field>
            <Field label="Nome do dono">
              <input className="field" value={form.ownerName} maxLength={120} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
            </Field>
            <Field label="E-mail do dono">
              <input className="field" type="email" placeholder="Vira o login do Dono" value={form.ownerEmail} maxLength={254} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} />
            </Field>
          </div>
          <button type="button" className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={create}>
            Cadastrar
          </button>
        </section>
      )}

      {ownerAccess && (
        <section className="card" role="status" style={{ padding: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", borderColor: "var(--ok)" }}>
          <div style={{ flex: 1, minWidth: 240, fontSize: 13, lineHeight: 1.5 }}>
            Acesso do Dono de <b>{ownerAccess.restaurant}</b> (entra depois de ativar): <span className="mono">{ownerAccess.email}</span> · senha provisória{" "}
            <span className="mono" style={{ fontWeight: 600 }}>{ownerAccess.password}</span>
            <div style={{ fontSize: 12, color: "var(--ink3)" }}>Anote agora: ela não aparece de novo. O Dono troca em Configurações › Equipe & Permissões.</div>
          </div>
          <button type="button" className="btn btn-outline" onClick={() => setOwnerAccess(null)}>
            Anotei
          </button>
        </section>
      )}

      <section className="card" style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 760 }}>
          <div style={{ display: "grid", gridTemplateColumns: cols, gap: 12, padding: "9px 16px", background: "var(--surface2)", borderBottom: "1px solid var(--line)" }}>
            {["Restaurante", "CNPJ", "Contato", "Status", "Cadastro", ""].map((h) => (
              <div key={h} className="field-label">
                {h}
              </div>
            ))}
          </div>
          {shown.length === 0 && <div style={{ padding: "20px 16px", fontSize: 13, color: "var(--ink3)" }}>Nenhum restaurante encontrado.</div>}
          {shown.map((r) => (
            <div key={r.id} style={{ display: "grid", gridTemplateColumns: cols, gap: 12, alignItems: "center", padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{r.name}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink3)" }}>
                  {r.id}
                </div>
              </div>
              <div className="mono" style={{ fontSize: 12.5, color: "var(--ink2)" }}>
                {r.cnpj || "—"}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.contact || "—"}</div>
              <span className="pill" style={{ justifySelf: "start", background: "var(--surface2)", color: STATUS_FG[r.status] }}>
                <span className="dot" style={{ background: STATUS_FG[r.status] }} />
                {STATUS_LABEL[r.status]}
              </span>
              <div className="mono" style={{ fontSize: 11.5, color: "var(--ink3)" }}>
                {fmtDate(r.createdAt)}
              </div>
              <button
                type="button"
                className={r.status === "ativo" ? "btn btn-outline" : "btn btn-primary"}
                style={{ padding: "6px 13px", fontSize: 12.5 }}
                onClick={() => setStatus(r, r.status === "ativo" ? "inativo" : "ativo")}
              >
                {r.status === "ativo" ? "Desativar" : "Ativar"}
              </button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
