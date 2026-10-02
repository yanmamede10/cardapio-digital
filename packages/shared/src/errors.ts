// What a person reads when a request fails (checklist 13). The API writes in Portuguese what is meant to be shown
// ("feche a conta antes de excluir a mesa") and in English what is for developers ("forbidden: role not allowed");
// the English kind — and a bare "Erro 500" — becomes a plain sentence for its status.
// ponytail: tells the two apart by English words; an English message without any of them would pass through as is.
const DEVELOPER_TEXT = /\b(the|is|are|be|not|must|required|invalid|forbidden|unknown|already|cannot|too|nothing|unavailable|configured|first|only|disabled|wrong|differ|revoked|error|or|and|has|for|found|mismatch|credentials)\b|^Erro \d+$/i;

export function readableError(status: number, raw = ""): string {
  if (raw && !DEVELOPER_TEXT.test(raw)) return raw.charAt(0).toUpperCase() + raw.slice(1);
  const limit = raw.match(/limit is (\d+) MB/)?.[1];
  if (status === 413 || limit) return `Arquivo grande demais${limit ? `: o limite é ${limit} MB` : ""}.`;
  if (status === 0) return "Não foi possível conectar ao servidor. Tente novamente.";
  if (status === 400) return "Confira os dados informados e tente de novo.";
  if (status === 401) return raw.includes("credentials") ? "E-mail ou senha incorretos." : "Sua sessão terminou. Entre de novo.";
  if (status === 403) return "Você não tem permissão para fazer isso.";
  if (status === 404) return "Não encontramos o que você procurou. Atualize a página e tente de novo.";
  if (status === 409) return "Isso mudou enquanto você olhava. Atualize a página e confira.";
  if (status === 429) return "Muitas tentativas em pouco tempo. Aguarde um pouco e tente de novo.";
  if (status === 502 || status === 503) return "Este serviço está indisponível agora. Tente novamente mais tarde.";
  return "Algo deu errado no servidor. Tente novamente em instantes.";
}
