import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** UI-01 · 18: the panel's one tooltip. A button with only an icon shows its aria-label (the one source of its name); a
 *  button with data-tip — an action with a consequence — explains it. Mouse: after a short delay; keyboard: on focus; phone:
 *  a long press (the tap that ends it doesn't press the button). Nothing essential lives only here: the name is the
 *  aria-label, and the consequences are asked again in the confirmation dialogs. */
const DELAY = 450;
const ID = "pyro-tooltip";

type Tip = { text: string; x: number; top: number; bottom: number };

/** The text a button shows, leaving out what's aria-hidden (the bell's count, already in its aria-label). */
const shownText = (n: Node): string =>
  n.nodeType === Node.TEXT_NODE ? (n.textContent ?? "") : n instanceof Element && n.getAttribute("aria-hidden") === "true" ? "" : [...n.childNodes].map(shownText).join("");

function tipOf(target: EventTarget | null): { el: HTMLElement; text: string } | null {
  const el = target instanceof Element ? target.closest<HTMLElement>("[data-tip], button[aria-label], a[aria-label]") : null;
  if (!el || (el as HTMLButtonElement).disabled) return null;
  const text = el.dataset.tip ?? (shownText(el).trim() ? "" : (el.getAttribute("aria-label") ?? ""));
  return text ? { el, text } : null;
}

export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timer = 0;
    let shown: HTMLElement | null = null;
    let longPress = false;
    const show = ({ el, text }: { el: HTMLElement; text: string }) => {
      const r = el.getBoundingClientRect();
      shown = el;
      // A description for screen readers only when it says more than the name.
      if (el.dataset.tip) el.setAttribute("aria-describedby", ID);
      setTip({ text, x: r.left + r.width / 2, top: r.top, bottom: r.bottom });
    };
    const hide = () => {
      clearTimeout(timer);
      shown?.removeAttribute("aria-describedby");
      shown = null;
      setTip(null);
    };
    const later = (t: { el: HTMLElement; text: string } | null) => {
      if (t) timer = window.setTimeout(() => show(t), DELAY);
    };
    const over = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const t = tipOf(e.target);
      if (t?.el === shown) return;
      hide();
      later(t);
    };
    const out = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && !tipOf(e.relatedTarget)) hide();
    };
    const focus = (e: FocusEvent) => {
      hide();
      const el = e.target as HTMLElement;
      if (el.matches?.(":focus-visible")) {
        const t = tipOf(el);
        if (t) show(t);
      }
    };
    const down = (e: PointerEvent) => {
      hide();
      longPress = false;
      if (e.pointerType === "mouse") return;
      const t = tipOf(e.target);
      if (t)
        timer = window.setTimeout(() => {
          longPress = true;
          show(t);
        }, DELAY);
    };
    const up = () => {
      clearTimeout(timer);
      if (longPress) timer = window.setTimeout(hide, 1500);
    };
    // The long press was for reading: the click that follows it doesn't act.
    const click = (e: MouseEvent) => {
      if (!longPress) return;
      longPress = false;
      e.preventDefault();
      e.stopPropagation();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && hide();
    const opts = { capture: true } as const;
    document.addEventListener("pointerover", over, opts);
    document.addEventListener("pointerout", out, opts);
    document.addEventListener("focusin", focus, opts);
    document.addEventListener("focusout", hide, opts);
    document.addEventListener("pointerdown", down, opts);
    document.addEventListener("pointerup", up, opts);
    document.addEventListener("pointercancel", up, opts);
    document.addEventListener("click", click, opts);
    document.addEventListener("keydown", key, opts);
    window.addEventListener("scroll", hide, opts);
    return () => {
      hide();
      document.removeEventListener("pointerover", over, opts);
      document.removeEventListener("pointerout", out, opts);
      document.removeEventListener("focusin", focus, opts);
      document.removeEventListener("focusout", hide, opts);
      document.removeEventListener("pointerdown", down, opts);
      document.removeEventListener("pointerup", up, opts);
      document.removeEventListener("pointercancel", up, opts);
      document.removeEventListener("click", click, opts);
      document.removeEventListener("keydown", key, opts);
      window.removeEventListener("scroll", hide, opts);
    };
  }, []);

  // Above the button, or below when there's no room; never past the screen's edges.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || !tip) return;
    const { width, height } = el.getBoundingClientRect();
    const below = tip.top - height - 8 < 8;
    el.style.left = `${Math.min(Math.max(8, tip.x - width / 2), window.innerWidth - width - 8)}px`;
    el.style.top = `${below ? tip.bottom + 8 : tip.top - height - 8}px`;
    el.style.setProperty("--tip-from", below ? "-4px" : "4px");
    el.style.visibility = "visible";
  }, [tip]);

  if (!tip) return null;
  return (
    <div ref={box} id={ID} role="tooltip" className="tooltip" key={`${tip.text}${tip.x}${tip.top}`} style={{ visibility: "hidden" }}>
      {tip.text}
    </div>
  );
}
