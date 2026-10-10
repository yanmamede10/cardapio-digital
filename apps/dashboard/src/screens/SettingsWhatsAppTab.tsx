import { useEffect, useState } from "react";
import { ApiError, api } from "../lib/api";
import { fmtDateTime } from "../lib/format";
import { useDashboardState } from "../state/DashboardStateContext";
import { useMobileScreen } from "../components/mobile/MobileLayout";
import { WhatsAppBadge, useWhatsAppStatus } from "../components/WhatsApp";

const p = { margin: 0, fontSize: "var(--text-subheadline)", lineHeight: 1.55, color: "var(--ink2)" } as const;

/** Configurações → WhatsApp (Dono): risk notice → QR → live status → disconnect. */
export default function SettingsWhatsAppTab() {
  const { notify } = useDashboardState();
  const [status, setStatus] = useWhatsAppStatus(5000);
  const [agreed, setAgreed] = useState(false);
  const [linking, setLinking] = useState(false); // QR on screen: keep asking until it's scanned
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    if (!linking) return;
    let alive = true;
    const tick = () =>
      api
        .connectWhatsApp()
        .then((r) => {
          if (!alive) return;
          setQr(r.qr);
          if (r.state !== "connected") return;
          setLinking(false);
          setStatus((s) => s && { ...s, state: "connected" });
          notify("WhatsApp conectado");
        })
        .catch((err) => {
          // 503 = this server has no provider configured; anything else is transient — the next tick retries.
          if (alive && err instanceof ApiError && err.status === 503) {
            setLinking(false);
            notify("O WhatsApp não está configurado neste servidor");
          }
        });
    tick();
    const id = setInterval(tick, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [linking, notify, setStatus]);

  const accept = () =>
    api
      .acceptWhatsAppTerms()
      .then(setStatus)
      .catch(() => notify("Não foi possível registrar o aceite"));

  const disconnect = () =>
    api
      .disconnectWhatsApp()
      .then((s) => {
        setStatus(s);
        setLinking(false);
        setQr(null);
        notify("WhatsApp desconectado");
      })
      .catch(() => notify("Não foi possível desconectar"));

  if (!status) return <div className="skeleton" style={{ height: 260, maxWidth: 560 }} />;

  if (!status.termsAcceptedAt) {
    return (
      <section className="card" style={{ padding: 18, maxWidth: 560, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, fontWeight: 600, fontSize: "var(--text-headline)" }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ color: "var(--warn)" }} />
          Antes de conectar o WhatsApp
        </div>
        <p style={p}>
          Esta conexão <b>não é a API oficial do WhatsApp</b>. Ela funciona como o WhatsApp Web: o sistema passa a receber e enviar mensagens pelo número do restaurante.
        </p>
        <p style={p}>
          A Meta, dona do WhatsApp, não permite esse tipo de conexão e <b>pode bloquear o número</b> — por um tempo ou de vez. Se isso acontecer, o restaurante perde o WhatsApp nesse número, inclusive no celular.
        </p>
        <p style={p}>O sistema nunca manda mensagem sozinho: só o que alguém da equipe escrever no Atendimento. Mesmo assim, o risco existe.</p>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: "var(--text-subheadline)", fontWeight: 500, cursor: "pointer" }}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 3 }} />
          Entendi que a conexão não é oficial e que o número pode ser bloqueado pela Meta.
        </label>
        <button type="button" className="btn btn-primary" style={{ alignSelf: "flex-start" }} disabled={!agreed} onClick={accept}>
          Continuar
        </button>
      </section>
    );
  }

  return (
    <section className="card" style={{ padding: 18, maxWidth: 560, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 600, fontSize: "var(--text-headline)", flex: 1 }}>Conexão do WhatsApp</div>
        <WhatsAppBadge state={status.state} />
      </div>

      {status.state === "connected" ? (
        <>
          <p style={p}>Mensagens desse número chegam em Atendimento → Conversas. O que for respondido pelo celular também aparece lá, para ninguém responder em dobro.</p>
          <button type="button" className="btn btn-outline" style={{ alignSelf: "flex-start" }} onClick={disconnect}>
            Desconectar
          </button>
        </>
      ) : linking ? (
        <>
          <ol style={{ ...p, paddingLeft: 20 }}>
            <li>Abra o WhatsApp no celular do restaurante.</li>
            <li>Toque em ⋮ (Android) ou Configurações (iPhone) → Aparelhos conectados → Conectar um aparelho.</li>
            <li>Aponte a câmera para o código abaixo. Ele se renova sozinho.</li>
          </ol>
          {qr ? <img src={qr} alt="QR code para conectar o WhatsApp" width={264} height={264} style={{ alignSelf: "center", borderRadius: 12, background: "#fff" }} /> : <div className="skeleton" style={{ width: 264, height: 264, alignSelf: "center" }} />}
          <button type="button" className="btn btn-outline" style={{ alignSelf: "flex-start" }} onClick={disconnect}>
            Cancelar
          </button>
        </>
      ) : (
        <>
          <p style={p}>{status.state === "connecting" ? "A conexão ficou pela metade." : "Nenhum número conectado agora — mensagens do WhatsApp não chegam no sistema."}</p>
          <button type="button" className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={() => setLinking(true)}>
            Conectar (mostrar QR code)
          </button>
        </>
      )}

      <p style={{ ...p, fontSize: "var(--text-footnote)", color: "var(--ink3)" }}>
        Aviso de conexão não oficial aceito por {status.termsAcceptedBy ?? "—"} em {fmtDateTime(status.termsAcceptedAt)}.
      </p>
    </section>
  );
}

export function MobileWhatsAppScreen() {
  useMobileScreen({ title: "WhatsApp", subtitle: "Conexão do Atendimento" });
  return (
    <div style={{ padding: 12 }}>
      <SettingsWhatsAppTab />
    </div>
  );
}
