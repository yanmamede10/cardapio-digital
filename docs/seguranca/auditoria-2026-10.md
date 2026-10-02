# Auditoria de segurança — outubro de 2026 (rodada E)

Feita em 01–02/10/2026 (rodada E; as decisões, na rodada F, também em 02/10), sobre a `master` a partir de `cccd0cd` (a última versão validada antes desta rodada). Roteiro: OWASP Top 10 (2021) e OWASP ASVS 4.0.3 nível 2. Cobriu a API (as 104 rotas), o painel e o app do cliente, a pilha de produção da VM (`deploy/`, `apps/api/Dockerfile`), os fronts na Vercel, o projeto Supabase de testes (RLS, políticas, buckets) e as dependências.

**Como foi feita.** Leitura de todo o código da API (rotas, autenticação, limites, pedidos, uploads, webhook), dos pontos dos fronts que montam HTML, URLs e redirecionamentos, e de toda a pilha de produção; um teste automático que percorre todas as rotas do Express (seção 3); reprodução de cada achado contra a API de teste antes de corrigir (cada correção tem um teste que falhava antes); consultas ao Supabase de testes (RLS, `pg_policies`, `storage.buckets`, funções no `public`, advisors de segurança); `npm audit --omit=dev` em cada workspace; e, no fim, o `/security-review` do Claude Code sobre as mudanças da rodada (seção 6).

## 1. Resumo

| Gravidade | Achados | Corrigidos | Decisão pendente | Sem ação (informativo aceito) |
| --- | --- | --- | --- | --- |
| Crítico | 0 | — | — | — |
| Alto | 1 | 1 | 0 | — |
| Médio | 7 | 7 | 0 | — |
| Baixo | 13 | 9 | 4 | — |
| Informativo | 12 | 2 | 0 | 10 |
| **Total** | **33** | **19** | **4** | **10** |

O `/security-review` sobre as mudanças da rodada não achou vulnerabilidade (seção 6). Nenhum crítico na auditoria: não há injeção de SQL, toda rota da equipe exige token e confere o restaurante, o papel e o módulo (provado rota a rota), o RLS do Supabase fecha as tabelas para as chaves públicas, e segredos não estão no código nem no bundle. O único **alto** (cupom) era regra de negócio: ficou para decisão na rodada E e foi resolvido na rodada F (02/10/2026), junto com as outras quatro decisões tomadas (SEG-A06, A07, A21, A31). Continuam pendentes SEG-A17 a SEG-A20 e duas questões novas do cupom, com recomendação e exemplo na seção 5.

| ID | Gravidade | Achado | Status |
| --- | --- | --- | --- |
| SEG-A01 | Alto | Qualquer texto no campo de cupom dá 10% de desconto no delivery | Resolvido (decisão de 02/10) — `4f2f9ae` (F-1) |
| SEG-A02 | Médio | Administrador alterava Configurações (perfil, fiscal, serviço 10%, QR, aparência) pela API; a tela e a ADR 0005 são só do Dono | Corrigido — `fe64437` |
| SEG-A03 | Médio | Restaurante inativo ou pendente recebia pedido de delivery | Corrigido — `da7b110` |
| SEG-A04 | Médio | Pedido malformado devolvia o erro interno do Prisma (caminho do arquivo, trecho do código, consulta) a qualquer um | Corrigido — `e43f959` |
| SEG-A05 | Médio | Fronts na Vercel sem CSP nem cabeçalhos de segurança | Corrigido — `27f3d60` |
| SEG-A06 | Médio | Troca ou reset de senha não derruba as sessões já abertas | Resolvido (decisão de 02/10) — `c593198` (F-2) |
| SEG-A07 | Médio | O status do pedido muda sem regra: pedido de comanda já paga pode virar "cancelado" ou "preparando" | Resolvido (decisão de 02/10) — `63782c8` (F-3) |
| SEG-A08 | Médio | Nenhum registro de quem mudou o pedido (aceitou, recusou, cancelou, fechou) | Corrigido — `7aa29d3` (E-5) |
| SEG-A09 | Baixo | API sem cabeçalhos de segurança e anunciando `X-Powered-By: Express` | Corrigido — `99590a8` |
| SEG-A10 | Baixo | Logo e capas aceitavam qualquer URL (outro site, pixel de rastreio, `javascript:`) | Corrigido — `de6f1f6` |
| SEG-A11 | Baixo | Cardápio, fotos e aparência de restaurante inativo ou pendente continuavam públicos | Corrigido — `62cc07e` |
| SEG-A12 | Baixo | O tempo de resposta do login dizia quais e-mails têm conta | Corrigido — `e1809ef` |
| SEG-A13 | Baixo | Chave do super admin de qualquer tamanho aceita em produção | Corrigido — `a4b6b3f`, `d2f03fd` |
| SEG-A14 | Baixo | Logo, capa ou foto acima de 8 MB virava erro 500 | Corrigido — `f1d44dd` |
| SEG-A15 | Baixo | `deploy/.env` podia ficar legível por qualquer usuário da VM | Corrigido — `c2d1f7b` |
| SEG-A16 | Baixo | Arquivos do Storage (fotos, mídia do WhatsApp) sem backup | Corrigido — `a00fedd` (E-4) |
| SEG-A17 | Baixo | `react-router-dom` 6.30.6 com 2 avisos moderados do `npm audit` | Decisão pendente |
| SEG-A18 | Baixo | Senhas com scrypt no custo padrão do Node (N=2¹⁴), abaixo do recomendado | Decisão pendente |
| SEG-A19 | Baixo | Backups sem criptografia e só no disco da VM | Decisão pendente |
| SEG-A20 | Baixo | Logins com falha e ações do super admin não ficam registrados | Decisão pendente |
| SEG-A21 | Informativo | Garçom e cozinha fecham conta, excluem e renumeram mesa | Resolvido (decisão de 02/10) — `2707c25` (F-4) |
| SEG-A22 | Informativo | Token da equipe e chave do super admin ficam no armazenamento do navegador | Aceito (CSP do SEG-A05) |
| SEG-A23 | Informativo | Filtros do query string aceitam objetos que viram operadores do Prisma | Sem ação |
| SEG-A24 | Informativo | Supabase: RLS sem políticas nas 22 tabelas, buckets e `storage.objects` | Sem ação (está certo) |
| SEG-A25 | Informativo | SQL cru: nenhum `$queryRawUnsafe`/`$executeRawUnsafe` | Sem ação |
| SEG-A26 | Informativo | Webhook do WhatsApp: um segredo para todos os restaurantes | Sem ação |
| SEG-A27 | Informativo | `/api/addresses` e `/api/payment-methods` são listas globais de demonstração | Sem ação (lacuna de produto) |
| SEG-A28 | Informativo | Postgres da Evolution com senha fixa | Sem ação |
| SEG-A29 | Informativo | 5 senhas erradas travam a conta por 15 min, para qualquer um que tente | Risco aceito (ADR 0009) |
| SEG-A30 | Informativo | Sem HSTS (o acesso é por IP) | Sem ação até ter domínio |
| SEG-A31 | Informativo | Destaques da tela inicial do delivery fixos no código | Resolvido (decisão de 02/10) — `1fedf6f` (F-5) |
| SEG-A32 | Informativo | Cardápio público mostra o vínculo do prato com o estoque (ids) | Sem ação |
| SEG-A33 | Baixo | Logs dos contêineres sem limite de tamanho no disco da VM | Corrigido — `cfe1df7` |

## 2. Achados

Os testes citados rodam no `npm test` (API: `tests/api/*.test.ts`; telas: `tests/e2e/*.spec.ts`) e no CI.

### SEG-A01 · Alto · Qualquer texto no campo de cupom dá 10% de desconto no delivery — resolvido (F-1)

- **Onde:** `apps/api/src/lib/coupons.ts`, `evaluateCoupon`: `if (!trimmed) … return { valid: true, discountPercent: 10 }` — qualquer texto não vazio vale 10%. Usado por `POST /api/coupons/apply` e por `placeOrder` (`apps/api/src/lib/orders.ts`, `const coupon = mode === "delivery" ? evaluateCoupon(body.couponCode) …`). Os cupons cadastrados em Promoções (`Coupon`: validade, canal, limite de uso) não são consultados.
- **Reproduzir:** `POST /api/orders` com `{"mode":"delivery", …, "couponCode":"QUALQUER"}` → `discount` = 10% do subtotal. Pelo app: Checkout → campo Cupom → "abc" → "Cupom aplicado: 10% de desconto no subtotal".
- **Por que não foi corrigido:** é a regra do desconto (o que é cupom válido, combo, limite de uso, canal). A correção muda o que o cliente vê no checkout.
- **Recomendação:** validar contra a tabela `Coupon` do restaurante (ativo, `validUntil`, canal delivery, `usedCount < usageLimit`, tipo e valor) e somar o uso na mesma transação do pedido; até lá, recusar todo código. Hoje nenhum restaurante usa delivery próprio, então o prejuízo é zero — mas qualquer um que ligar o módulo Delivery passa a perder 10% em todo pedido.
- **Decisão (02/10/2026) e correção (F-1, `4f2f9ae`):** o cupom só vale se for um dos cupons do restaurante em Promoções e estiver válido pelas regras daquela tela (ligado, dentro da validade, com usos sobrando, canal Delivery ou Ambos). O desconto vem do cupom (percentual do subtotal ou valor fixo, nunca maior que o subtotal), é calculado no servidor e gravado no pedido com o código; um uso é contado na mesma transação do pedido. Código inexistente ou inválido é recusado com o motivo, e o pedido não é criado. O servidor não lê desconto nem total vindos do aparelho. **Teste:** `tests/api/cupom.test.ts` (4 de 5 falhavam no código antigo). Cupom de **combo** é recusado ("ainda não vale no app"): como ele se aplica a um carrinho não foi decidido (seção 5).

### SEG-A02 · Médio · Administrador alterava Configurações pela API — corrigido

- **Onde:** `apps/api/src/routes/settings.ts` (`staffGuard = … requireMinRole(LEVEL.ADMINISTRADOR)` em perfil, horários, fiscal e `PATCH payment-mode`) e `apps/api/src/routes/appearance.ts` (aparência). O menu mostra Configurações só ao Dono (`apps/dashboard/src/lib/modules.ts`, `level: DONO`) e a ADR 0005 diz o mesmo.
- **Reproduzir (antes):** login do gerente (`bruno@fogoeno.com.br`) → `PATCH /api/restaurants/fogo/payment-mode {"serviceCharge":false}` → 200: o serviço de 10% some da comanda; `PATCH …/fiscal {"cnpj":…}` → 200.
- **Correção:** essas rotas exigem Dono; `GET payment-mode` continua para todos (o Fechar conta lê). Nenhuma tela muda: só o Dono chega a elas. **Teste:** `tests/api/autorizacao.test.ts` ("papel abaixo do mínimo") — antes, as 11 rotas respondiam 200 (ou 400, por validação) ao gerente.

### SEG-A03 · Médio · Restaurante inativo ou pendente recebia pedido de delivery — corrigido

- **Onde:** `apps/api/src/lib/orders.ts`, `placeOrder`: só conferia `if (!restaurant)`. O pedido de mesa já exigia `status === "ativo"`.
- **Reproduzir (antes):** Super Admin → desativar o restaurante → `POST /api/orders {"mode":"delivery","restaurantId":…}` → 201. A equipe não consegue mais entrar, então ninguém vê o pedido.
- **Correção:** delivery para restaurante não ativo → 404. **Teste:** `tests/api/seguranca.test.ts`, "restaurante inativo (ou pendente) não recebe pedido de delivery".

### SEG-A04 · Médio · Erro interno do Prisma devolvido a qualquer um — corrigido

- **Onde:** `apps/api/src/lib/orders.ts`, `catch (err) { return { status: 400, error: err instanceof Error ? err.message : … } }` em volta da leitura dos itens.
- **Reproduzir (antes):** `POST /api/orders` (sem login) com `"lines":[{"itemId":123}]` → 400 com `Invalid prisma.menuItem.findUnique() invocation in F:\Delivery\apps\api\src\lib\orders.ts:39:42`, as linhas 36–39 do arquivo e a consulta.
- **Correção:** `itemId` precisa ser texto (senão "unknown item") e só erros de preço (`PricingError`) voltam ao cliente; o resto vira 500 "internal error". **Teste:** `tests/api/seguranca.test.ts`, "pedido malformado responde 400 sem detalhe interno".

### SEG-A05 · Médio · Fronts sem CSP nem cabeçalhos de segurança — corrigido

- **Onde:** `apps/web/vercel.json` e `apps/dashboard/vercel.json` tinham só o rewrite da SPA. O token da equipe e a chave do super admin ficam no navegador (SEG-A22): sem CSP, uma falha de XSS levaria os dois.
- **Correção:** os dois mandam `Content-Security-Policy` (`default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' https:; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` e `X-Frame-Options: DENY`. `img-src`/`connect-src` aceitam `https:` porque o endereço da API (`https://<IP da VM>`) e o do Supabase mudam por ambiente e o `vercel.json` é estático. Os previews da Vercel deixam de carregar a barra de comentários da Vercel (script de outra origem); a produção não usa.
- **Teste:** `tests/e2e/csp.spec.ts` — os dois apps construídos como na Vercel e servidos com esses cabeçalhos; o navegador percorre o login, 12 telas do Dono e o Super Admin, e a lista, o cardápio, o prato e a mesa pelo QR do app do cliente: nada bloqueado, e um `<script>` injetado na página não roda. Tirar `data:` do `img-src` faz o teste falhar (os ícones são SVG em `data:`).

### SEG-A06 · Médio · Troca ou reset de senha não derruba as sessões abertas — resolvido (F-2)

- **Onde:** `apps/api/src/lib/auth.ts`, `staffGuard`: confere a assinatura, a validade (24 h), o restaurante ativo e `mustChangePassword` — não confere se a senha mudou depois que o token foi emitido.
- **Reproduzir:** o garçom entra no tablet; o Dono troca a senha dele em Equipe & Permissões; o tablet continua funcionando por até 24 h. No reset do super admin, as sessões antigas param só até a pessoa trocar a senha provisória; depois voltam a valer.
- **Recomendação:** gravar `passwordChangedAt` no `StaffMember` e recusar (401) token emitido antes dele; quem troca a própria senha recebe um token novo naquele aparelho. **Efeito que a pessoa vê:** os outros aparelhos com o mesmo login voltam para a tela de login — se o restaurante usa um login só em vários tablets, todos pedem a senha nova.
- **Decisão (02/10/2026) e correção (F-2, `c593198`):** troca ou reset feito pelo Dono ou pelo Super Admin encerra todas as sessões da pessoa na próxima requisição; quando a própria pessoa troca, o aparelho em que ela está segue logado (recebe um token novo) e os outros caem. Feito com a revogação por requisição que já existia: `StaffMember.sessionVersion` (migração `9l`), levado no token e comparado pelo `requireStaff`; sem tabela de sessões. **Teste:** `tests/api/sessoes.test.ts` (4 de 5 falhavam no código antigo).

### SEG-A07 · Médio · Status do pedido muda sem regra de transição — resolvido para o pedido de comanda fechada (F-3)

- **Onde:** `apps/api/src/routes/orders.ts`, `PATCH /:id/stage`: aceita qualquer status de `VALID_STAGES` a partir de qualquer status (menos "aguardando aceite").
- **Reproduzir:** fechar a comanda de um pedido (R$ 80 entram em Contas a Receber como pago) → `PATCH /api/orders/<id>/stage {"stage":"cancelled"}` → 200. Os Relatórios deixam de contar o pedido (`apps/api/src/lib/analytics.ts` ignora cancelados), mas os R$ 80 continuam recebidos: os números passam a não bater. O mesmo vale para entregue → preparando.
- **Recomendação:** recusar mudança de status em pedido de comanda já fechada e a partir de entregue ou cancelado; um estorno, se for preciso, vira uma ação própria (com o seu lançamento em Contas). Desde o E-5, toda mudança fica registrada com quem fez (SEG-A08).
- **Decisão (02/10/2026) e correção (F-3, `63782c8`):** depois que a comanda do pedido é fechada, a API recusa qualquer mudança de status daquele pedido (409, "Comanda já fechada: o status deste pedido não muda mais."), também dentro da transação, se o fechamento chegar ao mesmo tempo; a Central não deixa arrastar o cartão. Pedido de delivery entregue ou cancelado não entrou na decisão e segue como estava. **Teste:** `tests/api/fechado.test.ts` (antes, "cancelado" era aceito).

### SEG-A08 · Médio · Nenhum registro de quem mudou o pedido — corrigido (E-5)

- **Onde:** não havia histórico: quem aceitou, recusou, cancelou ou fechou a conta não ficava gravado.
- **Correção:** tabela `OrderEvent` (migração `9j_order_events`, RLS ligado), gravada na mesma transação de cada mudança, com o papel e o id de quem fez (ou "cliente"/"sistema"). Detalhes no E-5. **Teste:** `tests/api/eventos.test.ts`.

### SEG-A09 · Baixo · API sem cabeçalhos de segurança — corrigido

- **Onde:** `apps/api/src/app.ts`. Toda resposta saía com `X-Powered-By: Express` e sem `nosniff`.
- **Correção:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` e `Referrer-Policy: no-referrer` em toda resposta, sem `X-Powered-By`. Ficam na API e não no Caddyfile para valer também em dev e nos testes. HSTS não: ver SEG-A30. **Teste:** `tests/api/seguranca.test.ts`, "toda resposta da API sai com cabeçalhos de segurança".

### SEG-A10 · Baixo · Logo e capas aceitavam qualquer URL — corrigido

- **Onde:** `PATCH /api/restaurants/:id/appearance/draft` (`logoUrl`, `coverPhotos`) e `PATCH …/profile` (`logoUrl`, `coverUrl`) gravavam qualquer texto, e o cardápio do cliente usa essas URLs como estão (`<img src>`, `background-image`).
- **Reproduzir (antes):** `PATCH …/appearance/draft {"logoUrl":"https://rastreio.example/pixel.png"}` → 200; publicado, todo cliente que abre o cardápio carrega o pixel.
- **Correção:** URL nova só se começar com `STORAGE_PUBLIC_URL` (o que o upload devolve); uma URL que o restaurante já tem continua valendo (remover uma capa antiga funciona). **Teste:** `tests/api/seguranca.test.ts`, "logo e capas: só URL do bucket público".

### SEG-A11 · Baixo · Cardápio de restaurante inativo ou pendente continuava público — corrigido

- **Onde:** `apps/api/src/routes/restaurants.ts` (`GET /:id`, `/:id/categories`, `/:id/items`, `/:id/items/:itemId`) e `appearance.ts` (`GET /:id/appearance`) não conferiam o status.
- **Correção:** só restaurante ativo existe para o público (`activeRestaurant`); os outros dão 404, como a lista e o QR da mesa já faziam. **Teste:** `tests/api/seguranca.test.ts`, "restaurante inativo (ou pendente): o cardápio público some".

### SEG-A12 · Baixo · O tempo do login dizia quem tem conta — corrigido

- **Onde:** `apps/api/src/routes/auth.ts`: e-mail inexistente não passava pelo scrypt.
- **Reproduzir (antes, medido pelo teste):** e-mail que não existe, mediana de 4,2 ms; senha errada de um e-mail que existe, 66,7 ms.
- **Correção:** e-mail inexistente (ou conta sem senha) é conferido contra um hash aleatório: mesmo custo, mesmo 401. **Teste:** `tests/api/seguranca.test.ts`, "login: e-mail que não existe leva o mesmo tempo".

### SEG-A13 · Baixo · Chave do super admin de qualquer tamanho em produção — corrigido

- **Onde:** `apps/api/src/env.ts` exigia 32+ caracteres só no `JWT_SECRET`. A chave do super admin abre todos os restaurantes e não tem bloqueio por tentativas próprio.
- **Correção:** em produção, definida e com menos de 32 caracteres, a API não sobe e diz o motivo; vazia continua desligando o super admin (503). `deploy/.env.example` explica. **Teste:** `tests/api/seguranca.test.ts`, "em produção a chave do super admin, se definida, tem 32+ caracteres".

### SEG-A14 · Baixo · Upload acima de 8 MB virava 500 — corrigido

- **Onde:** o limite do multer (`menuManagement.ts`, `appearance.ts`) não tem status HTTP; o tratador de erros de `app.ts` o registrava como erro do servidor.
- **Correção:** 413 "file too large — limit is 8 MB" em todo upload (o Atendimento já fazia isso). **Teste:** `tests/api/seguranca.test.ts`, "logo, capa ou foto acima de 8 MB: 413".

### SEG-A15 · Baixo · `deploy/.env` legível por outros usuários da VM — corrigido

- **Onde:** o README manda `chmod 600`, mas nada garantia: um `cp` com umask comum deixa 644, e o arquivo tem a senha do banco, o `JWT_SECRET` e todas as chaves.
- **Correção:** `deploy/deploy.sh` faz `chmod 600 deploy/.env` a cada execução. **Teste:** `tests/api/seguranca.test.ts`, "deploy.sh deixa o deploy/.env legível só pelo dono (600)" (roda no CI, Linux; no Windows o NTFS não guarda o modo). Provado aqui num contêiner `bash:5.2`: 644 antes, 600 depois.

### SEG-A16 · Baixo · Arquivos do Storage sem backup — corrigido (E-4)

Ver E-4: serviço `storage-backup` no compose de produção. **Teste:** o teste do compose de produção (`tests/api/seguranca.test.ts`) confere o serviço, a pasta e as chaves; a prova contra o Supabase de testes está no plano de testes (Rodada E).

### SEG-A17 · Baixo · `react-router-dom` com avisos do `npm audit` — decisão pendente

- **Onde:** `apps/web` e `apps/dashboard`, `react-router-dom@6.30.6`: GHSA-wrjc-x8rr-h8h6 (redirecionamento aberto com barra invertida em `<Link>`/`useNavigate` quando o destino vem de fora) e GHSA-337j-9hxr-rhxg (SSR). Moderados.
- **Por que não é explorável aqui:** nenhum `navigate`/`<Link>` recebe destino vindo de URL ou de dado do usuário — todos começam com um caminho fixo (`/r/…`, `/mesas/…`, `/admin/restaurantes/…`) — e os apps não fazem SSR.
- **Recomendação:** subir para o React Router 7 (`npm audit fix --force` instala o 7.18.4, que muda a API) numa rodada com as telas testadas; não há correção na linha 6.

### SEG-A18 · Baixo · scrypt no custo padrão do Node — decisão pendente

- **Onde:** `apps/api/src/lib/auth.ts`, `scryptSync(password, salt, 64)`: N=2¹⁴, r=8, p=1. O OWASP (Password Storage Cheat Sheet) recomenda N=2¹⁷ para scrypt.
- **Recomendação:** guardar os parâmetros no hash (`scrypt$N$r$p$salt$hash`), usar N=2¹⁷ (precisa de `maxmem` ~ 160 MB por cálculo) para senhas novas e regravar a senha no próximo login correto. Custo: ~8× mais CPU por login. Sem urgência com senha mínima de 8 e o bloqueio por conta (5 tentativas em 15 min).

### SEG-A19 · Baixo · Backups sem criptografia e só na VM — decisão pendente

- **Onde:** `deploy/backups/` (dump diário e, desde o E-4, a cópia do Storage), arquivos 600 de root, sem criptografia, no mesmo disco da VM.
- **Recomendação:** uma cópia fora da VM, criptografada (por exemplo `age` com uma chave pública guardada fora do servidor, enviada a um bucket de outro provedor), semanal. Enquanto isso, o README mostra como copiar com `sudo tar` pela SSH.

### SEG-A20 · Baixo · Logins com falha e ações do super admin não ficam registrados — decisão pendente

- **Onde:** `apps/api/src/routes/auth.ts` e `admin.ts` não registram nada; o `console.error` só pega erros 500. ASVS V7.1/7.2 pedem registro de eventos de autenticação e de ações administrativas.
- **Recomendação:** uma linha no log por login recusado/bloqueado (conta e IP) e por ação do super admin (o que e em qual restaurante), sem senha nem token; o `docker compose logs` da VM já guarda. Ou uma tabela, no mesmo molde do `OrderEvent`, se for para aparecer numa tela.

### SEG-A21 · Informativo · Garçom e cozinha fecham conta, excluem e renumeram mesa — resolvido (F-4)

- **Onde:** `apps/api/src/routes/restaurantTables.ts`: todas as rotas de Mesas pedem só o módulo "mesas" e qualquer papel, exceto "Gerar novo QR" (Administrador). A ADR 0005 diz que Funcionário vê Operação, mas não diz quais ações.
- **Pergunta:** a cozinha (Igor) precisa poder fechar a conta da Mesa 5 no cartão, excluir a Mesa 12 ou mudar o tamanho do mapa? Se não, essas rotas passam a exigir o garçom ou Administrador+.
- **Decisão (02/10/2026) e correção (F-4, `2707c25`):** fechar conta: garçom, Administrador e Dono (a cozinha recebe 403); excluir mesa e editar o mapa do salão — o "Editar ambiente" da tela: nova mesa, renumerar, mover, excluir, tamanho da grade —: Administrador e Dono. A tela esconde o que o papel não pode. Transferir, Lançar pedido, comanda e QR ficaram como estavam (não entraram na decisão). **Testes:** o teste de autorização (`autorizacao.test.ts`) e os de tela por papel (`desktop.spec.ts`, `mobile.spec.ts`).

### SEG-A22 · Informativo · Token e chave do super admin no navegador — aceito

O painel guarda o token em `localStorage` e a chave do super admin em `sessionStorage`. Com React escapando todo texto, nenhum `dangerouslySetInnerHTML`, `eval` ou `href`/`src` com `javascript:` (procurado nos dois apps) e a CSP do SEG-A05, uma XSS que os leia fica muito improvável. Cookie `httpOnly` exigiria proteção contra CSRF e mudaria o APK.

### SEG-A23 · Informativo · Filtros do query string aceitam objetos — sem ação

`?status[not]=x` (Atendimento), `?categoryId[not]=x` (cardápio público) e `?mode[not]=x` (pedidos do aparelho) chegam ao Prisma como operadores. Sempre junto do `restaurantId`/sessão da própria requisição: não alcança dado de outro restaurante nem de outro aparelho. Sem ação.

### SEG-A24 · Informativo · Supabase — sem ação

Projeto de testes (`rfzhmxnmwpjuxmcvnewe`), 01/10/2026: RLS ligado nas 21 tabelas do `public` (22 em 02/10, depois de aplicar as migrações `9i` e `9j` desta rodada com `npm run db:deploy`: `OrderEvent` com RLS, e os 7 restaurantes com o módulo Delivery), sem nenhuma política (as chaves `anon`/`authenticated` não leem nem gravam nada; a API é dona das tabelas); o advisor de segurança só aponta "RLS Enabled No Policy" (INFO), que é exatamente o desejado. A tabela nova `OrderEvent` nasce com RLS (migração `9j`; o teste de RLS do `npm test` confere todas). `storage.buckets`: `cardapio` público, 8 MB, PNG/JPEG/WebP; `whatsapp-media` privado, 8 MB, imagens e áudios. `storage.objects` sem políticas: sem a chave S3, ninguém lista nem grava. Nenhuma função no schema `public`. Para o projeto de produção, o checklist (`checklist-deploy.md`) repete essas consultas.

### SEG-A25 · Informativo · SQL cru — sem ação

Nenhum `$queryRawUnsafe` ou `$executeRawUnsafe`. Os quatro SQL crus (`lib/stock.ts`, fechamento de comanda e "Gerar novo QR" em `restaurantTables.ts`, `prisma/buckets.ts`) usam template do Prisma, que manda os valores como parâmetros.

### SEG-A26 · Informativo · Webhook do WhatsApp — sem ação

Um segredo (`WHATSAPP_WEBHOOK_SECRET`, comparado em tempo constante) para todos os restaurantes, e o restaurante vem do corpo (`instance`). Só a Evolution tem o segredo, e ela fala com a API pela rede interna do compose. O webhook é conferido antes de ler o corpo e tem limite de 2 MB.

### SEG-A27 · Informativo · Endereços e formas de pagamento globais — sem ação

`GET /api/addresses` e `GET /api/payment-methods` devolvem as listas de demonstração do seed, iguais para todo mundo: não há dado pessoal. É uma lacuna do delivery (o cliente não cadastra endereço), não de segurança.

### SEG-A28 · Informativo · Postgres da Evolution com senha fixa — sem ação

`deploy/docker-compose.prod.yml`, `evolution-db`: `POSTGRES_PASSWORD: evolution`. Sem porta publicada; só os contêineres da rede do compose o alcançam.

### SEG-A29 · Informativo · Bloqueio da conta deixa travar o login de alguém — risco aceito

5 senhas erradas para uma conta, de qualquer IP, bloqueiam essa conta por 15 minutos (ADR 0009). Quem souber o e-mail de alguém pode mantê-lo fora. Aceito na ADR 0009; o super admin pode dar uma senha provisória.

### SEG-A30 · Informativo · Sem HSTS — sem ação até ter domínio

O navegador ignora HSTS para endereço IP (RFC 6797), e a API é acessada por `https://<IP>`. O HTTP já redireciona para HTTPS (Caddy). Com um domínio, ligar HSTS no Caddyfile.

### SEG-A31 · Informativo · Destaques fixos na tela inicial do delivery — resolvido (F-5)

- **Onde:** `apps/web/src/screens/DiscoveryScreen.tsx`, `BANNERS`: "20% off em grelhados · Fogo & Nó" e "Pizzas sem taxa hoje · Forno di Napoli", fixos no código. Aparecem para todo cliente, mesmo que o restaurante não exista (no banco de produção só há o Chapa 27) ou não tenha o módulo Delivery (E-6).
- **Recomendação:** tirar os dois destaques até haver promoções de verdade (cadastradas pelo restaurante), ou mostrar só os de restaurantes que estão na lista.
- **Decisão (02/10/2026) e correção (F-5, `1fedf6f`):** os destaques fixos saíram e, sem nada vindo da API, a seção não aparece. **Teste:** `tests/e2e/csp.spec.ts` — nenhum nome de restaurante do banco no bundle de produção do cardápio (antes, "Fogo & Nó" e "Forno di Napoli").

### SEG-A32 · Informativo · Vínculo do prato com o estoque no cardápio público — sem ação

`serializeMenuItem` manda o `productId` do prato e, nos adicionais, o `productId` e a quantidade do insumo. São ids, sem custo nem estoque; não dão acesso a nada (as rotas de produtos exigem Administrador do restaurante).

### SEG-A33 · Baixo · Logs dos contêineres sem limite de tamanho — corrigido

- **Onde:** `deploy/docker-compose.prod.yml`: nenhum serviço definia `logging`, e o driver padrão do Docker (`json-file`) não tem teto. A Evolution registra cada mensagem do WhatsApp; com meses de uso, o disco da VM enche e a API, o banco da Evolution e os backups param juntos.
- **Correção:** todo serviço com `json-file` de no máximo 5 arquivos de 10 MB (`x-logging` no topo do compose). **Teste:** o teste do compose de produção (`tests/api/seguranca.test.ts`) confere o `logging` de cada serviço.

## 3. Autorização de todas as rotas (E-1)

`tests/api/autorizacao.test.ts` percorre as rotas que o Express registrou (lidas do próprio `app`, montagem incluída: 104 hoje) e exige que cada uma esteja numa lista do teste: **pública** (16: saúde, login, o cardápio e o pedido do cliente), **webhook** (1), **própria** (2: `/api/auth/me` e troca da própria senha), **super admin** (11) ou **equipe**, com papel mínimo e módulo (74). Uma rota nova fora das listas falha o teste (provado com uma rota `GET /api/restaurants/:id/segredo` sem guarda). Para cada rota:

| Verificação | Esperado |
| --- | --- |
| Sem credencial | 401 em toda rota não pública; as públicas respondem sem token (nem 401/403, nem 5xx) |
| Token de staff (Dono) nas rotas do super admin | 401 |
| Token do Dono de outro restaurante (Chapa 27) nas rotas da equipe do fogo | 403 ou 404 — com um pedido e um lançamento reais do fogo onde a rota carrega o registro antes de comparar o restaurante |
| Cada papel abaixo do mínimo | 403; e o papel mínimo passa nas leituras (nem 401/403, nem 5xx) |
| Módulo desligado (todos desligados) | 403 em toda rota de módulo, mesmo para o Dono |
| Chave do super admin com um caractere a menos ou a mais | 401 |

## 4. Dependências (`npm audit --omit=dev`, 01/10/2026)

| Workspace | Resultado |
| --- | --- |
| `apps/api` | 0 vulnerabilidades |
| `packages/shared` | 0 |
| `apps/web` | 2 moderadas, `react-router` ≤ 7.17.0 (SEG-A17) |
| `apps/dashboard` | 2 moderadas, as mesmas (SEG-A17) |

Imagens da pilha de produção, todas com versão fixa (o teste do compose confere): `caddy:2.11.4-alpine`, `node:22.23.3-bookworm-slim` (API), `evoapicloud/evolution-api:v2.3.7`, `postgres:16.15-alpine3.24`, `postgres:17.11-alpine3.24`, `rclone/rclone:1.75.1` (novo, E-4).

## 5. Decisões

### Tomadas em 02/10/2026 e implementadas (rodada F)

| ID | Decisão | Commit | Teste |
| --- | --- | --- | --- |
| SEG-A01 | Cupom só vale se for do restaurante em Promoções e válido pelas regras da tela; desconto do cupom, calculado no servidor e gravado no pedido; código inválido recusa o pedido | `4f2f9ae` (F-1) | `tests/api/cupom.test.ts` |
| SEG-A06 | Troca/reset pelo Dono ou Super Admin encerra todas as sessões da pessoa; quem troca a própria senha segue logado naquele aparelho e os outros caem | `c593198` (F-2) | `tests/api/sessoes.test.ts`, `admin.test.ts` |
| SEG-A07 | Pedido de comanda fechada não muda mais de status (409); a tela não oferece | `63782c8` (F-3) | `tests/api/fechado.test.ts` |
| SEG-A21 | Fechar conta: garçom, Administrador, Dono (cozinha 403); excluir mesa e editar o mapa: Administrador e Dono; a tela esconde | `2707c25` (F-4) | `autorizacao.test.ts`, `desktop.spec.ts`, `mobile.spec.ts` |
| SEG-A31 | Destaques fixos removidos; sem dados, a seção não aparece | `1fedf6f` (F-5) | `tests/e2e/csp.spec.ts` |
| — (E-6) | Delivery desligado por padrão: restaurante novo do Super Admin e a Chapa 27 do seed nascem sem ele; a migração `9i` e os restaurantes existentes não mudam | `0e7f468` (F-6) | `admin.test.ts`, `demo-seed.test.ts` |

### Ainda pendentes, com recomendação

| ID | O que decidir | Exemplo | Recomendação |
| --- | --- | --- | --- |
| SEG-A17 | Subir o React Router para a versão 7 | — | Sim, numa rodada com as telas testadas (não é explorável hoje) |
| SEG-A18 | Senhas com scrypt mais caro | — | Sim, N=2¹⁷ com parâmetros no hash, regravando no próximo login |
| SEG-A19 | Cópia criptografada dos backups fora da VM | A VM é perdida: os backups iam junto | Semanal, `age` + bucket de outro provedor |
| SEG-A20 | Registrar logins recusados e ações do super admin | Alguém tenta 50 senhas no e-mail do Dono: hoje não fica rastro | Uma linha de log por evento, sem senha nem token |
| F-1 (combo) | Como um cupom de combo vale no app | Combo "X-Burger + Batata por R$ 35". O cliente pede 2 X-Burgers, 1 batata e bacon extra num deles: o combo vale uma vez? o bacon entra no preço do combo? Hoje o cupom de combo é recusado no app ("ainda não vale no app") | Uma vez por conjunto completo de itens do combo no carrinho; o preço do combo substitui o preço base desses itens; adicionais cobrados à parte |
| F-1 (uso devolvido) | Pedido recusado devolve o uso do cupom? | Cupom de uso único; o restaurante recusa o pedido: hoje o uso fica gasto e o cliente não consegue usar de novo | Devolver o uso quando o pedido é recusado (ou cancelado antes de sair), na mesma transação |

## 6. `/security-review` (E-3)

Rodado em 02/10/2026 sobre todas as mudanças da rodada (`git diff cccd0cd..HEAD`, 21 commits até `cfe1df7`, sem os `.md`), no formato do comando: uma análise que procura vulnerabilidades novas com confiança de 8/10 ou mais, depois um filtro de falsos positivos por candidato.

**Resultado: nenhuma vulnerabilidade** com confiança ≥ 8. Sem candidatos, o filtro não teve o que avaliar. O que foi conferido:

| Mudança | Conclusão da revisão |
| --- | --- |
| Configurações e aparência para Dono (SEG-A02) | Nenhuma rota perdeu ou baixou guarda no diff; `GET payment-mode` continua com `requireStaff` + `requireOwnRestaurant` |
| Aceitar, recusar, mudar status e fechar conta com `OrderEvent` (E-5) | A checagem de restaurante (403) roda antes das transações; `stage` validado contra `VALID_STAGES`; `paymentMethod` contra `PAYMENT_METHODS` antes de gravar; o `restaurantId` do evento vem do pedido ou de `req.params.id` já protegido por `requireOwnRestaurant`; o SQL do fechamento segue com `Prisma.sql`/`Prisma.join` (só o `RETURNING` mudou) |
| `placeOrder` com o garçom como objeto | Só dois chamadores: o pedido público não passa garçom; o do garçom monta a partir de `req.staff` (lido do banco) |
| Rotas públicas só de restaurante ativo e o filtro do módulo Delivery (SEG-A11, E-6) | Consulta parametrizada; o filtro `contains "\"delivery\""` é constante |
| URL de logo e capa (SEG-A10) | Só restringe; prefixo `STORAGE_PUBLIC_URL + "/"` não troca de host; só o Dono chama |
| Login com e-mail inexistente (SEG-A12) | O hash fictício não autentica ninguém: entrar exige conta, hash e senha certa |
| Erros, cabeçalhos, `env.ts`, `deploy.sh`, `storage-backup`, logs, migrações 9i/9j, `vercel.json`, `brl` | Sem problema: só endurecem ou só mostram texto (sem `dangerouslySetInnerHTML`); 9j liga RLS sem políticas; `https://localhost` no CORS não pesa porque a equipe se autentica por cabeçalho, não por cookie |

**Duas notas abaixo do corte, descartadas e por quê:**

1. *"A URL da foto do prato não passa por `imageUrlAllowed`."* Descartada: nenhuma rota grava uma URL de prato vinda do cliente. `MenuItem.imageUrl` só é escrito pela rota de upload (`menuManagement.ts`, com a URL que o próprio `uploadPublicFile` gerou) e pela duplicação do prato (copia a do original).
2. *"`restaurantId` e `tableCode` do pedido não têm o tipo conferido."* Descartada como vulnerabilidade: um valor que não é texto agora termina num 500 genérico ("internal error"), sem detalhe nenhum (é o que o SEG-A04 garante) e sem gravar nada. É robustez (400 em vez de 500), não exposição.

## 7. O que esta auditoria não cobre

- Teste de invasão de fora (varredura de portas e TLS da VM real): a VM só existe a partir do deploy. O checklist (`checklist-deploy.md`) traz os comandos para conferir lá.
- O projeto Supabase de **produção**: as consultas foram feitas no de testes; o checklist repete as mesmas no de produção.
- Configuração da conta Oracle e da Vercel (MFA, membros, proteção de previews): fora do repositório; estão no checklist.
- Os APKs Android: não foram reconstruídos nesta rodada.
