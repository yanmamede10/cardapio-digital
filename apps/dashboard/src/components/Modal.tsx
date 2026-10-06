import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { useBack } from "../lib/back";

/** UX-08, once for every form panel (Modal, SlideOver and the phone's form screens): X, Cancelar, Esc and the Android back
 *  close at once when nothing changed, and ask "Descartar alterações?" when something did. The background never closes. */
export function useDiscardGuard(dirty: boolean, close: () => void, name?: string) {
  const [asking, setAsking] = useState(false);
  const request = () => (dirty ? setAsking(true) : close());
  useBack(request);
  return {
    /** What X and Cancelar call. */
    request,
    confirm: asking && (
      <DiscardDialog
        name={name}
        onKeep={() => setAsking(false)}
        onDiscard={() => {
          setAsking(false);
          close();
        }}
      />
    )
  };
}

/** "Descartar alterações?" (UX-07 · 3e, 4e). Esc or back here means Continuar editando. */
function DiscardDialog({ name, onKeep, onDiscard }: { name?: string; onKeep: () => void; onDiscard: () => void }) {
  const id = useId();
  useBack(onKeep);
  return (
    <div className="modal-overlay" style={{ zIndex: 36 }}>
      <div className="modal-panel" role="alertdialog" aria-modal="true" aria-labelledby={id} aria-describedby={`${id}-body`} style={{ maxWidth: 440 }}>
        <div id={id} style={{ padding: "22px 24px 4px", fontSize: 17, fontWeight: 600, letterSpacing: "-.015em" }}>
          Descartar alterações?
        </div>
        <div id={`${id}-body`} style={{ padding: "6px 24px 22px", fontSize: 13.5, color: "var(--ink2)", lineHeight: 1.5 }}>
          {name ? `As alterações em “${name}” não serão salvas.` : "As alterações não serão salvas."}
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-outline" autoFocus onClick={onKeep}>
            Continuar editando
          </button>
          <button type="button" className="btn btn-danger" onClick={onDiscard}>
            Descartar
          </button>
        </div>
      </div>
    </div>
  );
}

/** The app's modal (02a/02b shell): a centered box on the desktop, a bottom sheet on the phone (base.css). Closes only by
 *  its own buttons — they get `close`, which goes through the discard guard. */
export function Modal({
  label,
  dirty = false,
  name,
  onClose,
  style,
  children
}: {
  /** Its accessible name (role="dialog"). */
  label: string;
  dirty?: boolean;
  /** For "As alterações em “…” não serão salvas." */
  name?: string;
  onClose: () => void;
  style?: CSSProperties;
  children: (close: () => void) => ReactNode;
}) {
  const guard = useDiscardGuard(dirty, onClose, name);
  return (
    <div className="modal-overlay">
      <div className="modal-panel" role="dialog" aria-modal="true" aria-label={label} style={style}>
        {children(guard.request)}
      </div>
      {guard.confirm}
    </div>
  );
}
