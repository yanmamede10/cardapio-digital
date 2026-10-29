# Quality gates do QAOps

Workflow: [qaops.yml](../../.github/workflows/qaops.yml). Executa em push na `master`, PR com destino `master` e acionamento manual. A concorrência cancela execuções anteriores da mesma ref. Permissão do workflow: apenas `contents: read`.

O job `qualidade` executa os gates 1–5 em sequência; uma falha impede os seguintes e bloqueia os jobs dependentes. `testes-api` e `testes-e2e` começam em paralelo somente após a qualidade aprovar. Nenhum gate usa `continue-on-error`. A meta do job rápido é menos de cinco minutos; o timeout de dez minutos acomoda instalação com cache frio. A duração real deve ser medida nas execuções, não presumida.

## Gate 1 — Dependências

- **Critério:** `npm run audit:deps` termina com código zero (`npm audit --omit=dev --audit-level=critical`): nenhuma vulnerabilidade crítica na árvore de produção.
- **Justificativa:** componentes vulneráveis podem comprometer a API, dados de restaurantes e controles de acesso.
- **Momento:** job `qualidade`, primeiro gate, após `npm ci` e geração do Prisma Client, nos três eventos acima.
- **Evidência:** log do npm e `reports/npm-audit.json`, salvo pelo `preaudit:deps` mesmo quando a auditoria encontra vulnerabilidades. Falha de rede/registro não é tratada como aprovação.
- **Consequência:** crítica ou impossibilidade de concluir a auditoria bloqueia o job e seus dependentes; severidades inferiores aparecem como alerta.
- **Limitação/exceção:** depende da base de advisories do npm; exclui dependências de desenvolvimento. Não substitui revisão de código nem garante ausência de vulnerabilidades ainda não publicadas.

Em 28/10/2026, havia 1 crítica, 2 altas e 3 moderadas em produção. `proxy-addr` foi atualizado de 2.0.7 para 2.0.8, dentro do intervalo aceito pelo Express, em commit separado. Resultado: **0 críticas, 2 altas e 3 moderadas**. Pendências: `body-parser` e `multer` (altas), `qs`, `react-router` e `react-router-dom` (moderadas). A correção proposta pelo npm para React Router exige major 7; não foi aplicada. As demais correções não críticas ficam para manutenção específica; o gate solicitado usa nível `critical`. A contagem considera pacotes afetados, não necessariamente advisories distintos.

## Gate 2 — Lint

- **Critério:** `npm run lint` termina com código zero: **zero erros e no máximo 1 warning**. `lint:report` aplica o mesmo teto e grava JSON.
- **Justificativa:** impedir hooks inválidos, código inalcançável, chaves duplicadas, debugger e acúmulo de novos avisos.
- **Momento:** job `qualidade`, após dependências, nos eventos do workflow.
- **Evidência:** log e `reports/eslint.json`; a etapa de JSON usa `always()` para tentar gerar diagnóstico mesmo após falha anterior.
- **Consequência:** qualquer erro ou total de warnings maior que 1 bloqueia os próximos gates e jobs dependentes.
- **Limitação/exceção:** análise sem execução e sem inferência de tipos do ESLint. O teto é global: a remoção de um aviso permite outro até o mesmo total. Reduzir o teto quando a dívida diminuir.

A configuração usa ESLint 9, `@eslint/js` recommended, `typescript-eslint` recommended e React Hooks nos fronts. `react-hooks/rules-of-hooks`, `no-debugger`, `no-dupe-keys`, `no-unreachable` e `@typescript-eslint/no-unused-vars` permanecem `error`. Somente o `any` do mock heterogêneo da Evolution em `tests/api/whatsapp.test.ts` vira `warn`, com escopo nesse arquivo; no restante a regra permanece erro. `dist`, Android, dependências, relatórios e `.agents` são ignorados.

Ajustes triviais: retirada de bindings não utilizados, mantendo as chamadas de hooks e de `templateLayout`; remoção de duas diretivas ESLint sem efeito e de dois escapes redundantes nos testes; comentários nos `catch` de espera/limpeza. Nenhuma regra de negócio foi alterada. ESLint 9 foi mantido conforme a tarefa, embora o npm já emita aviso de fim de suporte para essa versão.

## Gate 3 — Typecheck

- **Critério:** os três comandos `tsc --noEmit -p ...` de `npm run typecheck` terminam sem diagnóstico de erro: API, dashboard e web.
- **Justificativa:** detectar incompatibilidades em contratos, modelos Prisma e props antes de testar pedidos, pagamentos e permissões.
- **Momento:** job `qualidade`, após lint, em todos os eventos.
- **Evidência:** log do TypeScript e resultado do gate em `reports/gates.json` e `reports/summary.md`.
- **Consequência:** qualquer erro bloqueia os gates seguintes e os jobs de integração/telas.
- **Limitação/exceção:** os tsconfigs existentes cobrem `src` dos apps, incluindo os módulos shared importados; não garantem tipagem de todos os testes e scripts. Gerar o Prisma Client após cada instalação limpa é pré-requisito; não requer banco nem `.env` real.

## Gate 4 — Testes unitários e cobertura

- **Critério:** todos os testes em `tests/unit/*.test.ts` passam e a cobertura agregada dos módulos selecionados atinge **80% de linhas e 70% de branches**, medida pelo próprio Node 22. O processo termina com erro se qualquer condição falhar.
- **Justificativa:** proteger cálculo de preço e desconto, arredondamento, legibilidade das cores, mensagens de erro e horário de funcionamento que atravessa meia-noite.
- **Momento:** job `qualidade`, após typecheck, em todos os eventos.
- **Evidência:** reporter `spec` no log, `reports/coverage.lcov` e percentuais no resumo do job.
- **Consequência:** teste reprovado ou cobertura insuficiente bloqueia build e os dois jobs dependentes.
- **Limitação/exceção:** cobertura dos cinco módulos abaixo, não da aplicação inteira. Os limites são agregados, não por arquivo; cobertura alta não prova correção de todas as entradas. O Node mede arquivos carregados no processo; mantenha testes/imports de cada módulo ao evoluir a suíte.

Escopo: `packages/shared/src/{money,color,errors}.ts`, `apps/api/src/lib/pricing.ts` e `apps/web/src/lib/hours.ts`. `pricing` importa apenas tipos externos; os testes não instanciam Prisma, não abrem servidor e não usam Docker. `openingNow` é determinístico com `now` explícito; o caminho com data padrão usa relógio simulado.

`apps/dashboard/src/lib/format.ts` não é integralmente puro: `minutesSince` e `todayIso` consultam o relógio, e algumas funções usam o fuso local. Por isso foi substituído no escopo do gate pelo módulo puro `errors.ts`, conforme a alternativa prevista na tarefa. Há testes complementares de formatação, inclusive datas bissextas, estrelas e SLA, com relógio controlado por `node:test`; eles também precisam passar, mas não entram na cobertura do gate. A API MockTimers ainda gera aviso experimental no Node 22.

Os limites iniciais de 80/70 foram mantidos: permitem evolução sem exigir 100% da instrumentação experimental, mas barram perdas amplas de testes. Na validação com Node 22.23.4: **20 testes, 100% de linhas e 95,89% de branches**. Casos caracterizados sem mudar produção: grupo desconhecido no preço é ignorado; cor com seis caracteres inválidos produz `NaN`; horários iguais significam turno de 24 horas. Não foi instrumentado `tests/api`: a API está em outro processo e essa cobertura seria enganosa.

## Gate 5 — Build

- **Critério:** `npm run build` compila API, web e dashboard com código de saída zero.
- **Justificativa:** prevenir entrega que passa em testes isolados mas não gera os bundles e a API compilada.
- **Momento:** último gate de `qualidade`, em todos os eventos.
- **Evidência:** logs do Prisma, TypeScript e Vite; status no JSON e Markdown do job.
- **Consequência:** falha bloqueia `testes-api` e `testes-e2e`.
- **Limitação/exceção:** não produz APK e não faz deploy; aviso de chunk do Vite acima de 500 kB é informativo, não bloqueante. Os bundles ficam no runner, não nos artefatos de QA.

O passo de build de `packages/shared` foi removido: esse workspace não tem script de build e é consumido a partir dos fontes. Os builds dos três apps são preservados.

## Gate 6 — Testes de API (integração)

- **Critério:** `npm run test:api` termina com código zero; todos os testes de API passam, incluindo os contratos e permissões já existentes.
- **Justificativa:** detectar regressões em autorização, pedidos, banco, migrações e integrações simuladas.
- **Momento:** job `testes-api`, após `qualidade`, nos eventos do workflow; timeout de 20 minutos.
- **Evidência:** log `spec` e `reports/api-junit.xml` com um segundo reporter JUnit.
- **Consequência:** falha marca o job e o workflow como reprovados; E2E, que está em job independente, pode terminar e preservar suas próprias evidências.
- **Limitação/exceção:** exige Docker e usa Postgres descartável, com serviços externos simulados. Não mede disponibilidade dos serviços de produção. Falha durante preparação pode ocorrer antes de existir JUnit; o log e o resumo registram esse caso.

## Gate 7 — Testes E2E

- **Critério:** `npm run test:e2e` termina com código zero, com todos os cenários Playwright existentes aprovados.
- **Justificativa:** detectar regressões nos fluxos reais de atendimento, pedidos e permissões visuais, nos tamanhos desktop/tablet/mobile já configurados.
- **Momento:** job `testes-e2e`, após `qualidade`, em todos os eventos; timeout de 40 minutos.
- **Evidência:** log `list`, `reports/e2e-junit.xml`, relatório HTML em `playwright-report/` e screenshots/traces de falhas em `test-results/`.
- **Consequência:** qualquer falha reprova o job e o workflow.
- **Limitação/exceção:** exige Docker, Compose e Google Chrome (`channel: chrome`, disponível no runner Ubuntu). A suíte usa portas 80/443 para testar Caddy, além das portas dos apps. Não cobre Android nativo nem depende do banco real.

## Preservação, merge e validação inicial

Cada job gera `reports/summary.md` e `reports/gates.json`, e publica o resumo em `$GITHUB_STEP_SUMMARY` com sucesso, falha, cancelamento ou etapa pulada. O job de qualidade acrescenta a cobertura se houver LCOV; ausência não é representada como 0% nem como aprovação. Os três uploads usam `if: always()`, ignoram pastas ausentes e guardam `reports/`, `test-results/` e `playwright-report/` por **30 dias**, em artefatos distintos: `qaops-qualidade`, `qaops-api` e `qaops-e2e`.

Os artefatos preservam também execuções reprovadas. Jobs que nem iniciam por falha de `needs` não geram arquivos. Interrupção forçada do runner, falha no checkout ou indisponibilidade do serviço de artefatos podem impedir a publicação; não há garantia de upload nesses casos. O status do GitHub Actions e seus logs continuam sendo a referência da execução. Para impedir merge com falha, o administrador deve tornar os três checks obrigatórios na proteção da `master`; este PR não altera configurações do repositório.

Validação local em 28/10/2026, Windows, Node **22.23.4**, instalação limpa (`npm ci`) e `db:generate`:

| Comando | Resultado |
| --- | --- |
| `npm run lint` / `npm run lint:report` | Passou: 0 erros, 1 warning |
| `npm run typecheck` | Passou nos três apps |
| `npm run test:unit` | Passou: 20 testes, linhas 100%, branches 95,89% |
| `npm run audit:deps` | Passou: 0 críticas; 2 altas e 3 moderadas como alertas |
| `npm run build` | Passou nos três apps; alerta de chunk do dashboard |
| `npm run test:api` | Não executado localmente: Docker ausente |
| `npm run test:e2e` | Não executado localmente: Docker ausente |

Higiene: `.mcp.json` retirado do índice e ignorado, com cópia local preservada; `reports/` ignorado. Foram revisados os nomes dos arquivos rastreados de ambiente (apenas `.env.example`, `.env.development` e `.env.android`) e buscadas assinaturas de chaves privadas/tokens, sem ocorrência. Os arquivos de desenvolvimento contêm endereços locais; os exemplos contêm placeholders e credenciais de teste. Isso não equivale a auditoria de todo o histórico Git nem a um gate automático de detecção de segredos.

O [experimento](experimento.md) permanece como modelo vazio. Nenhuma reprovação proposital foi introduzida nesta branch.
