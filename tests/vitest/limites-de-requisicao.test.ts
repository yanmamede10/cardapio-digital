// Limites de requisição da API (apps/api/src/lib/rateLimit.ts): a proteção contra força bruta no login e contra uma mesa
// ou um funcionário inundando a API. O relógio é falso (vi.useFakeTimers), então as janelas de 1, 5 e 15 minutos passam
// na hora, sem esperar.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

// O token do funcionário vira o id dele sem JWT nem banco: o que se testa aqui é a contagem, não a autenticação.
vi.mock("../../apps/api/src/lib/auth.ts", () => ({
  staffIdOf: (header?: string) => (header?.startsWith("Bearer ") ? header.slice(7) : null)
}));

const { LIMITS, clientIp, passwordAttempt, passwordFailed, rateLimit } = await import("../../apps/api/src/lib/rateLimit.ts");

type Req = Parameters<typeof rateLimit>[0];
function requisicao(o: { ip?: string; cf?: string; staff?: string; mesa?: string; pedido?: boolean } = {}): Req {
  const headers: Record<string, string | undefined> = {
    "cf-connecting-ip": o.cf,
    authorization: o.staff ? `Bearer ${o.staff}` : undefined,
    "x-table-code": o.pedido ? undefined : o.mesa
  };
  return {
    method: o.pedido ? "POST" : "GET",
    path: o.pedido ? "/api/orders" : "/api/restaurants/chapa27/menu",
    body: o.pedido ? { tableCode: o.mesa } : {},
    header: (name: string) => headers[name.toLowerCase()],
    socket: { remoteAddress: o.ip ?? "198.51.100.7" }
  } as unknown as Req;
}

/** Passa uma requisição pelo middleware: null se seguiu adiante, senão o status, o Retry-After e a mensagem. */
function passa(req: Req) {
  let resposta: { status: number; retryAfter?: string; erro?: string } | null = null;
  const res = {
    set(_: string, valor: string) { resposta = { status: 0, retryAfter: valor }; return this; },
    status(code: number) { resposta = { ...resposta, status: code }; return this; },
    json(body: { error: string }) { resposta = { ...resposta!, erro: body.error }; return this; }
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  rateLimit(req, res, next);
  return next.mock.calls.length ? null : resposta;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-26T19:00:00-03:00")); // sexta à noite, casa cheia
});
afterEach(() => vi.useRealTimers());

describe("IP do cliente", () => {
  it("só acredita no CF-Connecting-IP quando a conexão vem do proxy confiável", () => {
    // De fora, o cabeçalho é ignorado: um atacante não escapa do limite trocando o IP no cabeçalho a cada tentativa.
    expect(clientIp(requisicao({ ip: "203.0.113.50", cf: "1.2.3.4" }))).toBe("203.0.113.50");
    // Pelo Caddy/Cloudflare (loopback em dev e nos testes), vale o IP que o proxy repassou.
    expect(clientIp(requisicao({ ip: "127.0.0.1", cf: " 203.0.113.10 " }))).toBe("203.0.113.10");
    expect(clientIp(requisicao({ ip: "::ffff:127.0.0.1", cf: "203.0.113.10" }))).toBe("203.0.113.10");
    // A própria máquina sem o cabeçalho (Evolution, os testes): sem limite por IP.
    expect(clientIp(requisicao({ ip: "::1" }))).toBeNull();
  });
});

describe("limites por funcionário e por mesa", () => {
  it(`um funcionário passa ${LIMITS.STAFF_PER_MINUTE} vezes no minuto; a seguinte recebe 429 até a janela virar`, () => {
    for (let i = 0; i < LIMITS.STAFF_PER_MINUTE; i++) expect(passa(requisicao({ staff: "garcom-1" }))).toBeNull();
    expect(passa(requisicao({ staff: "garcom-1" }))).toEqual({
      status: 429, retryAfter: "60", erro: "Muitas tentativas em pouco tempo. Tente de novo em 60 s."
    });
    // Outro funcionário no mesmo Wi-Fi não é afetado.
    expect(passa(requisicao({ staff: "cozinha-1" }))).toBeNull();
    vi.advanceTimersByTime(60_000);
    expect(passa(requisicao({ staff: "garcom-1" }))).toBeNull();
  });

  it(`uma mesa envia até ${LIMITS.TABLE_ORDERS_PER_5_MINUTES} pedidos em 5 minutos; o 41º espera e a mesa ao lado não`, () => {
    for (let i = 0; i < LIMITS.TABLE_ORDERS_PER_5_MINUTES; i++) expect(passa(requisicao({ mesa: "MESA-07", pedido: true }))).toBeNull();
    vi.advanceTimersByTime(60_000); // um minuto depois o bloqueio continua: a janela é de 5
    expect(passa(requisicao({ mesa: "MESA-07", pedido: true }))).toMatchObject({ status: 429, retryAfter: "240", erro: expect.stringContaining("4 min") });
    expect(passa(requisicao({ mesa: "MESA-08", pedido: true }))).toBeNull();
    // Ver o cardápio continua liberado na mesa bloqueada: só os pedidos têm o limite de 5 minutos.
    expect(passa(requisicao({ mesa: "MESA-07" }))).toBeNull();
  });
});

describe("tentativas de senha", () => {
  it(`depois de ${LIMITS.ACCOUNT_FAILURES_PER_15_MINUTES} senhas erradas a conta espera 15 minutos, de qualquer IP`, () => {
    const conta = "dono@chapa27.example";
    for (let i = 0; i < LIMITS.ACCOUNT_FAILURES_PER_15_MINUTES; i++) {
      expect(passwordAttempt(requisicao({ ip: `203.0.113.${i}` }) as Request, conta, true)).toBe(0);
      passwordFailed(conta);
    }
    expect(passwordAttempt(requisicao({ ip: "203.0.113.99" }) as Request, conta, true)).toBe(900);
    vi.advanceTimersByTime(15 * 60_000);
    expect(passwordAttempt(requisicao({ ip: "203.0.113.99" }) as Request, conta, true)).toBe(0);
  });

  it(`um IP tem ${LIMITS.LOGIN_ATTEMPTS_PER_IP_PER_15_MINUTES} tentativas de login em 15 minutos, mesmo trocando de conta`, () => {
    const ip = requisicao({ ip: "198.51.100.200" }) as Request;
    for (let i = 0; i < LIMITS.LOGIN_ATTEMPTS_PER_IP_PER_15_MINUTES; i++) expect(passwordAttempt(ip, `conta-${i}@x.example`, true)).toBe(0);
    expect(passwordAttempt(ip, "outra@x.example", true)).toBe(900);
    // Trocar a própria senha (login=false) não conta tentativa por IP.
    expect(passwordAttempt(ip, "outra@x.example", false)).toBe(0);
  });
});
