import { useState } from "react";
import { ApiError, login } from "../lib/api";

export default function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
          ? "Este restaurante não está ativo. Fale com o suporte da MesaPronta."
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
        <h1 style={{ margin: "0 0 4px", fontSize: 20, color: "var(--ink)" }}>Entrar</h1>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--ink3)" }}>Acesse com seu e-mail cadastrado no restaurante.</p>

        <label style={{ display: "block", fontSize: 13, color: "var(--ink2)", marginBottom: 6 }}>E-mail</label>
        <input
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />

        <label style={{ display: "block", fontSize: 13, color: "var(--ink2)", margin: "14px 0 6px" }}>Senha</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        {error && (
          <p style={{ color: "var(--alert)", fontSize: 13, margin: "12px 0 0" }} role="alert">
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
            fontSize: 15,
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
  fontSize: 15
};
