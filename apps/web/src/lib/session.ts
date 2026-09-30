const SESSION_KEY = "cardapio.sessionId";

export function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/** The table this tab was opened for (its QR code), from the state AppContext keeps in sessionStorage; null outside a table.
 *  Sent on every request: the API's rate limit counts a table's phones together (apps/api/src/lib/rateLimit.ts). */
export function getTableCode(): string | null {
  try {
    const s = JSON.parse(sessionStorage.getItem("cardapio.tableSession") ?? "{}") as { mode?: string; tableCode?: string | null };
    return s.mode === "table" ? s.tableCode ?? null : null;
  } catch {
    return null;
  }
}
