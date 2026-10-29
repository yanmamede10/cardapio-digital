# Experimento QAOps — aprovado, reprovado e corrigido

Registro das execuções reais do experimento. O cenário reprovado foi feito numa branch separada (`experimento/cupom-arredondamento`), sem afetar a `master` nem produção.

## Identificação

- Responsáveis: Yan Mamede e Yuri Boeira
- Data e fuso: 29/10/2026, America/Sao_Paulo (horários das execuções em UTC nos links)
- Repositório / PR: [yanmamede10/cardapio-digital](https://github.com/yanmamede10/cardapio-digital); pipeline entregue no [PR #2](https://github.com/yanmamede10/cardapio-digital/pull/2); experimento no [PR #4](https://github.com/yanmamede10/cardapio-digital/pull/4)
- Branch do experimento: `experimento/cupom-arredondamento`
- Hipótese / gate escolhido: uma regressão no cálculo do desconto de cupom é barrada pelo **Gate 4 — Unitários e cobertura** antes de chegar à `master`, em cerca de 1 minuto e sem gastar tempo com os testes de API e de tela.
- Alteração controlada prevista: em `packages/shared/src/money.ts`, trocar `Math.round` por `Math.floor` no arredondamento de `couponDiscount`. Num cupom de 10% sobre R$ 19,99, o desconto cai de R$ 2,00 para R$ 1,99: o cliente pagaria 1 centavo a mais.
- Ambiente e versões: GitHub Actions, runner `ubuntu-latest` (em migração para o Ubuntu 26), Node 22, Google Chrome do runner (Playwright no canal `chrome`), Postgres 16 descartável em Docker. Regra de proteção da `master` ativa, com os checks **Qualidade**, **Testes de API** e **Testes E2E** obrigatórios.

## Execuções

| Cenário | Link da execução | Commit (SHA) | Gate que barrou / aprovado | Duração total | Qualidade | API | E2E | Artefatos |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Aprovado | [QAOps #3](https://github.com/yanmamede10/cardapio-digital/actions/runs/40872738714) (push na `master`) | `a3bc9c4` | Os 7 gates aprovados | 21 min 53 s | ✅ 1 min 14 s | ✅ 1 min 34 s | ✅ 20 min 32 s | 3 |
| Reprovado | [QAOps #5](https://github.com/yanmamede10/cardapio-digital/actions/runs/40872897083) (PR #4) | `30a02b4` | ❌ Gate 4 — Unitários e cobertura | 37 s | ❌ 33 s | ⏭️ pulado | ⏭️ pulado | 1 |
| Corrigido | [QAOps #6](https://github.com/yanmamede10/cardapio-digital/actions/runs/40874561785) (PR #4) | `620f02c` | Os 7 gates aprovados | 25 min 10 s | ✅ 1 min 10 s | ✅ 1 min 12 s | ✅ 23 min 52 s | 3 |

## Cenário aprovado

- Condições iniciais: `master` logo após o merge do PR #2 (pipeline QAOps), sem nenhuma alteração controlada.
- Resultado esperado: os três jobs verdes e as evidências publicadas.
- Resultado observado: os 5 gates do job Qualidade aprovados, seguidos dos testes de API e de tela em paralelo, também aprovados.
- Cobertura e contagem de testes: 20 testes unitários com cobertura de 99,25% das linhas e 95,89% dos branches nos módulos selecionados (limites de 80% e 70%); 195 testes de integração da API em 31 arquivos; 9 suítes de tela no desktop, tablet e celular.
- Logs / screenshots / relatórios: resumo dos gates na página da execução; artefatos `qaops-qualidade`, `qaops-api` e `qaops-e2e`.

## Cenário reprovado

- Mudança controlada e commit: `30a02b4`, `Math.floor` no lugar de `Math.round` em `couponDiscount` (`packages/shared/src/money.ts`).
- Gate e critério violado: Gate 4, "todos os testes unitários passam".
- Resultado esperado: o job Qualidade reprova no Gate 4 e os jobs de API e de tela não rodam.
- Resultado observado e mensagem de erro: o teste `cupons percentuais e fixos respeitam subtotal, zero e centavos` (`tests/unit/money.test.ts:12`) falhou com `AssertionError: Expected values to be strictly equal: 1.99 !== 2`. Os gates 1 a 3 passaram, o 4 reprovou e o 5 (build) foi pulado.
- Etapas/jobs impedidos de executar: Gate 5 (build), Testes de API e Testes E2E. No PR, o botão de merge ficou desabilitado pela regra de proteção da `master`.
- Evidências preservadas apesar da falha: resumo dos gates na execução e o artefato `qaops-qualidade` (relatório do ESLint, auditoria de dependências e cobertura).

## Cenário corrigido

- Correção aplicada e commit: `620f02c`, volta o `Math.round`, que era a causa identificada pelo Gate 4.
- Resultado esperado: o pipeline volta a ficar verde no mesmo PR.
- Resultado observado: os três jobs aprovados; o histórico do PR #4 mantém a execução reprovada e a corrigida, uma depois da outra.
- Evidências de recuperação: [QAOps #6](https://github.com/yanmamede10/cardapio-digital/actions/runs/40874561785), com os três artefatos.

## Comparação e conclusão

- Comparação dos tempos: o cenário reprovado respondeu em **37 s**, contra **21 min 53 s** e **25 min 10 s** dos ciclos completos. A diferença vem da ordem dos jobs: como os testes de API e de tela dependem do job Qualidade, uma falha nos gates rápidos economiza os cerca de 20 minutos dos testes de tela. Nos ciclos completos, os testes de API e de tela rodam em paralelo; a instalação usa o cache do npm.
- O gate controlou o risco esperado? Sim. Uma diferença de 1 centavo no desconto, que passaria despercebida num teste manual, foi barrada antes da `master`, com a mensagem exata do valor esperado e do recebido.
- Limitações / resultados inesperados: durante a preparação, o Gate 7 reprovou 8 testes de tela no desktop que nada tinham a ver com o experimento. O GitHub migrou o `ubuntu-latest` para o Ubuntu 26, o texto ficou mais largo e o quadro da Central de Pedidos passou a rolar na horizontal; o axe acusou a regra `scrollable-region-focusable` (região rolável que o teclado não alcança). Era um problema real de acessibilidade, corrigido no PR #2 tornando o quadro focável pelo teclado. Mostra o valor do gate, mas também o custo de manter testes de tela sensíveis ao ambiente.
- Data de download das evidências (retenção de 30 dias): os artefatos ficam disponíveis até 28/11/2026.
