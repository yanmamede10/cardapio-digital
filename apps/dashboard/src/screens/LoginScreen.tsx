import { useEffect, useState } from "react";
import { MIN_PASSWORD_LENGTH, PLATFORM_NAME } from "@cardapio/shared";
import { ApiError, changePassword, login, logout } from "../lib/api";
import { Field } from "../components/SlideOver";
import { Logo } from "../components/Logo";

export default function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    document.title = `Entrar · ${PLATFORM_NAME}`;
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      onLoggedIn();
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 403
          ? `Este restaurante não está ativo. Fale com o suporte da ${PLATFORM_NAME}.`
          : err instanceof ApiError
            ? err.message
            : "Não foi possível entrar. Tente novamente."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        fontFamily: "var(--font)"
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: 320,
          maxWidth: "calc(100vw - 32px)",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 16,
          padding: 28,
          boxShadow: "var(--shadow1)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <Logo size={32} />
          <span style={{ fontWeight: 600, letterSpacing: "-.01em", color: "var(--ink)" }}>{PLATFORM_NAME}</span>
        </div>
        <h1 style={{ margin: "0 0 4px", fontSize: "var(--text-title2)", color: "var(--ink)" }}>Entrar</h1>
        <p style={{ margin: "0 0 20px", fontSize: "var(--text-subheadline)", color: "var(--ink3)" }}>Acesse com seu e-mail cadastrado no restaurante.</p>

        <label htmlFor="login-email" style={{ display: "block", fontSize: "var(--text-subheadline)", color: "var(--ink2)", marginBottom: 6 }}>E-mail</label>
        <input
          id="login-email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />

        <label htmlFor="login-password" style={{ display: "block", fontSize: "var(--text-subheadline)", color: "var(--ink2)", margin: "14px 0 6px" }}>Senha</label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        {error && (
          <p style={{ color: "var(--alert)", fontSize: "var(--text-subheadline)", margin: "12px 0 0" }} role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 20,
            width: "100%",
            padding: "11px 0",
            borderRadius: 10,
            border: "none",
            background: "var(--brand)",
            color: "var(--brandInk)",
            fontSize: "var(--text-headline)",
            fontWeight: 600,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--line)",
  background: "var(--surface2)",
  color: "var(--ink)",
  fontSize: "var(--text-headline)"
};

/** First login with a provisional password (super admin sign-up or reset): replace it before anything else. */
export function ChangePasswordScreen({ onDone }: { onDone: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== repeat) return setError("As duas senhas novas não são iguais.");
    setError(null);
    setLoading(true);
    try {
      await changePassword(current, next);
      onDone();
    } catch (err) {
      const msg = err instanceof ApiError ? err.detail : "";
      setError(
        msg.includes("current password") ? "A senha provisória não confere."
        : msg.includes("at least") ? `A senha nova precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`
        : msg.includes("differ") ? "A senha nova precisa ser diferente da provisória."
        : "Não foi possível trocar a senha. Tente novamente."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", fontFamily: "var(--font)" }}>
      <form onSubmit={handleSubmit} className="card" style={{ width: 340, maxWidth: "calc(100vw - 32px)", padding: 28, display: "flex", flexDirection: "column", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: "var(--text-title2)", color: "var(--ink)" }}>Crie sua senha</h1>
        <p style={{ margin: 0, fontSize: "var(--text-subheadline)", color: "var(--ink3)" }}>Você entrou com uma senha provisória. Troque por uma senha sua para continuar.</p>
        <Field label="Senha provisória">
          <input className="field" type="password" autoComplete="current-password" required autoFocus value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field label="Nova senha">
          <input className="field" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="Repita a nova senha">
          <input className="field" type="password" autoComplete="new-password" required value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        </Field>
        {error && (
          <p style={{ color: "var(--alert)", fontSize: "var(--text-subheadline)", margin: 0 }} role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Salvando…" : "Salvar e entrar"}
        </button>
        <button type="button" className="btn btn-outline" onClick={() => (logout(), location.reload())}>
          Sair
        </button>
      </form>
    </div>
  );
}
