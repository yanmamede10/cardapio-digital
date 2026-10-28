import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readableError } from '../../packages/shared/src/errors.ts';

test('mensagem de negócio em português é preservada e texto técnico é traduzido', () => {
  assert.equal(readableError(409, 'feche a conta antes de excluir a mesa'), 'Feche a conta antes de excluir a mesa');
  assert.equal(readableError(500, 'the server is unavailable'), 'Algo deu errado no servidor. Tente novamente em instantes.');
  assert.equal(readableError(500, 'Erro 500'), 'Algo deu errado no servidor. Tente novamente em instantes.');
});

test('mensagens por status, inclusive credenciais e limite de upload', () => {
  const messages = [
    [0, 'Não foi possível conectar ao servidor. Tente novamente.'],
    [400, 'Confira os dados informados e tente de novo.'],
    [401, 'Sua sessão terminou. Entre de novo.'],
    [403, 'Você não tem permissão para fazer isso.'],
    [404, 'Não encontramos o que você procurou. Atualize a página e tente de novo.'],
    [409, 'Isso mudou enquanto você olhava. Atualize a página e confira.'],
    [429, 'Muitas tentativas em pouco tempo. Aguarde um pouco e tente de novo.'],
    [502, 'Este serviço está indisponível agora. Tente novamente mais tarde.'],
    [503, 'Este serviço está indisponível agora. Tente novamente mais tarde.'],
    [999, 'Algo deu errado no servidor. Tente novamente em instantes.']
  ] as const;
  for (const [status, expected] of messages) assert.equal(readableError(status), expected);
  assert.equal(readableError(401, 'invalid credentials'), 'E-mail ou senha incorretos.');
  assert.equal(readableError(413), 'Arquivo grande demais.');
  assert.equal(readableError(400, 'limit is 8 MB'), 'Arquivo grande demais: o limite é 8 MB.');
});
