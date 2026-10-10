import { useEffect, useRef, useState } from "react";
import { WHATSAPP_MEDIA_MAX_BYTES, WHATSAPP_MEDIA_TOO_BIG, type SupportMessage, type TicketChannel, type WhatsAppState, type WhatsAppStatus } from "@cardapio/shared";
import { api, getSession } from "../lib/api";

export const CHANNEL_ICON: Record<TicketChannel, string> = { table: "fa-solid fa-chair", delivery: "fa-solid fa-motorcycle", whatsapp: "fa-brands fa-whatsapp" };

/** WhatsApp connection, re-read every pollMs. null until loaded (or for a role that can't read it). */
export function useWhatsAppStatus(pollMs = 10000) {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => api.getWhatsApp().then((s) => alive && setStatus(s)).catch(() => {});
    load();
    const id = setInterval(load, pollMs);
    // Browsers slow timers in background tabs to ~1/min — re-check the moment someone looks at the tab again.
    const onShow = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [pollMs]);
  return [status, setStatus] as const;
}

const LOOK: Record<WhatsAppState, { label: string; color: string }> = {
  connected: { label: "WhatsApp conectado", color: "var(--ok)" },
  connecting: { label: "WhatsApp conectando…", color: "var(--warn)" },
  disconnected: { label: "WhatsApp desconectado", color: "var(--alert)" }
};

export function WhatsAppBadge({ state }: { state: WhatsAppState }) {
  const { label, color } = LOOK[state];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--text-footnote)", fontWeight: 600, color, border: `1px solid ${color}`, borderRadius: 999, padding: "4px 11px", whiteSpace: "nowrap" }}>
      <i className="fa-brands fa-whatsapp" style={{ fontSize: "var(--icon-sm)" }} />
      {label}
    </span>
  );
}

/** Always shown in Atendimento. Once set up, a dropped session is a loud banner: the real risk is to stop receiving in silence. */
export function WhatsAppIndicator({ status }: { status: WhatsAppStatus | null }) {
  if (!status) return null;
  if (!status.termsAcceptedAt) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--text-footnote)", color: "var(--ink3)", whiteSpace: "nowrap" }}>
        <i className="fa-brands fa-whatsapp" style={{ fontSize: "var(--icon-sm)" }} />
        WhatsApp não configurado
      </span>
    );
  }
  if (status.state !== "disconnected") return <WhatsAppBadge state={status.state} />;
  const who = getSession()?.role === "owner" ? "Reconecte em Configurações → WhatsApp." : "Avise o Dono para reconectar em Configurações → WhatsApp.";
  return (
    <div role="alert" style={{ flexBasis: "100%", display: "flex", alignItems: "center", gap: 10, fontSize: "var(--text-subheadline)", fontWeight: 600, color: "var(--alert)", background: "color-mix(in srgb, var(--alert) 12%, transparent)", border: "1px solid var(--alert)", borderRadius: 12, padding: "10px 14px" }}>
      <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: "var(--icon-sm)" }} />
      <span>
        WhatsApp desconectado — mensagens novas não estão chegando no sistema. <span style={{ fontWeight: 500 }}>{who}</span>
      </span>
    </div>
  );
}

/** Message bubble content: the image or voice note of a WhatsApp message, then its text. */
export function MessageBody({ m }: { m: SupportMessage }) {
  return (
    <>
      {m.mediaType === "image" && m.mediaUrl && (
        <a href={m.mediaUrl} target="_blank" rel="noreferrer">
          <img src={m.mediaUrl} alt="Imagem da conversa" style={{ display: "block", maxWidth: "100%", maxHeight: 280, borderRadius: 10 }} />
        </a>
      )}
      {m.mediaType === "audio" && m.mediaUrl && <audio controls preload="metadata" src={m.mediaUrl} aria-label="Mensagem de voz" style={{ display: "block", maxWidth: "100%" }} />}
      {m.text && <div style={{ marginTop: m.mediaUrl ? 6 : 0, whiteSpace: "pre-wrap" }}>{m.text}</div>}
    </>
  );
}

export const lastMessagePreview = (m: SupportMessage | undefined) => m?.text || (m?.mediaType === "image" ? "📷 Imagem" : m?.mediaType === "audio" ? "🎤 Áudio" : "");

const btn = { width: 44, height: 44, flex: "0 0 44px", borderRadius: 11, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink2)", cursor: "pointer" } as const;

/** WhatsApp composer extras: attach an image, record a voice note with the browser's mic. Nothing goes out until the person taps send. */
export function MediaButtons({ onSend, onError }: { onSend: (file: Blob, name: string) => Promise<void>; onError: (message: string) => void }) {
  const picker = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const discard = useRef(false);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => recorder.current?.stream.getTracks().forEach((t) => t.stop()), []);

  const send = (file: Blob, name: string) => {
    // Checked here too, so a big file never crosses the connection just to be refused.
    if (file.size > WHATSAPP_MEDIA_MAX_BYTES) return onError(WHATSAPP_MEDIA_TOO_BIG);
    setBusy(true);
    onSend(file, name).finally(() => setBusy(false));
  };

  const record = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        recorder.current = null;
        setRecording(false);
        const blob = new Blob(chunks, { type: r.mimeType });
        // Whatever the browser records (webm/ogg/mp4) — the provider turns it into a WhatsApp voice note.
        if (!discard.current && blob.size) send(blob, `audio.${r.mimeType.includes("mp4") ? "m4a" : r.mimeType.includes("ogg") ? "ogg" : "webm"}`);
      };
      discard.current = false;
      r.start();
      recorder.current = r;
      setRecording(true);
    } catch {
      onError("Não foi possível usar o microfone");
    }
  };

  const stop = (keep: boolean) => {
    discard.current = !keep;
    recorder.current?.stop();
  };

  if (recording) {
    return (
      <>
        <button type="button" aria-label="Descartar gravação" onClick={() => stop(false)} style={btn}>
          <i className="fa-solid fa-trash" style={{ fontSize: "var(--icon-sm)" }} />
        </button>
        <button type="button" aria-label="Enviar gravação" onClick={() => stop(true)} style={{ ...btn, background: "var(--alert)", borderColor: "var(--alert)", color: "var(--alertInk)", width: "auto", flex: "0 0 auto", padding: "0 12px", display: "flex", alignItems: "center", gap: 7, fontSize: "var(--text-subheadline)", fontWeight: 600 }}>
          <i className="fa-solid fa-circle" style={{ fontSize: "var(--icon-sm)" }} />
          Gravando · enviar
        </button>
      </>
    );
  }
  return (
    <>
      <input
        ref={picker}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) send(f, f.name);
        }}
      />
      <button type="button" aria-label="Enviar imagem" disabled={busy} onClick={() => picker.current?.click()} style={btn}>
        <i className="fa-solid fa-image" style={{ fontSize: "var(--icon-sm)" }} />
      </button>
      <button type="button" aria-label="Gravar áudio" disabled={busy} onClick={record} style={btn}>
        <i className={`fa-solid ${busy ? "fa-spinner fa-spin" : "fa-microphone"}`} style={{ fontSize: "var(--icon-sm)" }} />
      </button>
    </>
  );
}
