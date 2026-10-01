# cardapio-digital (MesaPronta)

SaaS de gestão para restaurantes: cardápio digital com comanda na mesa (QR/tablet), delivery próprio, painel de gestão do restaurante e um painel de plataforma (super admin).

## Estrutura

```
apps/
  api/        API REST — Express + Prisma + Postgres (Supabase em produção). Porta 4100.
  dashboard/  Painel de gestão do restaurante (React + Vite, desktop e mobile/Android via Capacitor). Porta 5174.
              Também serve /admin — o painel de plataforma (ver docs/adr e "Super admin" abaixo).
  web/        App do cliente: cardápio da mesa e delivery (React + Vite, Android via Capacitor). Porta 5173.
packages/
  shared/     Tipos e constantes usados pelos três apps (importado direto do src .ts, sem build).
tests/
  api/        Testes da API (node:test) contra um Postgres descartável.
  e2e/        Testes de tela do painel e do cardápio do cliente (Playwright, desktop, tablet e celular).
  load/       Casa cheia (npm run carga): cenário, carga, Lighthouse e pedido → Central nas telas.
  run.mjs     Orquestra tudo: sobe o Postgres em Docker, migra, faz seed, sobe a API, roda os testes, derruba.
docs/adr/     Decisões de arquitetura (uma por arquivo).
docs/testes/  Plano de testes (o que é automático, o que é manual, resultados e medições).
docker-compose.yml  Evolution API local (WhatsApp no Atendimento), na mesma máquina da API.
```

## Pré-requisitos

- Node 22 e npm
- Docker (Postgres local e `npm test`)
- Google Chrome instalado (o Playwright usa o canal `chrome`, não baixa navegador próprio)

```sh
npm install
```

## Rodando cada app

### API (`apps/api`)

```sh
docker run -d --name pg -e POSTGRES_PASSWORD=pw -e POSTGRES_DB=cardapio -p 5432:5432 postgres:16-alpine
cp apps/api/.env.example apps/api/.env      # já aponta para esse Postgres
npm run db:generate --workspace apps/api    # Prisma Client
npm run db:deploy   --workspace apps/api    # aplica as migrações e alinha os buckets do Storage, se configurados
npm run db:seed     --workspace apps/api    # dados de exemplo (restaurante "fogo" com equipe) — APAGA o banco antes
npm run dev:api                             # http://localhost:4100 (só nesta máquina: escuta em 127.0.0.1)
```

A API escuta em `127.0.0.1` por padrão (`HOST` vazio): só a própria máquina chega nela (em produção, o túnel da Cloudflare roda nela). Para abrir no celular pela rede local em dev, rode com `HOST=0.0.0.0`.

Limites de requisição ([ADR 0009](docs/adr/0009-pedido-pelo-qr-e-limites.md)): por funcionário (600/min, somando os aparelhos do mesmo login), por mesa (900/min), pedidos por mesa (40 em 5 min), bloqueio da conta depois de 5 senhas erradas e, para o IP real que o túnel manda em `CF-Connecting-IP`, um teto por IP e um de logins por IP. Uma requisição da própria máquina sem esse cabeçalho não tem IP: escapa só dos dois limites por IP; os outros valem.

Não há `dotenv` no código: o `apps/api/.env` é carregado pelo próprio Prisma Client quando ele é importado, e isso vale para todas as variáveis do arquivo.

### Dashboard (`apps/dashboard`)

```sh
npm run dev:dashboard                       # http://localhost:5174
```

Logins do seed (senha `senha123`), um por papel:

| E-mail | Papel |
| --- | --- |
| marina@fogoeno.com.br | Dono |
| bruno@fogoeno.com.br | Administrador |
| paula@fogoeno.com.br | Funcionário (garçom) |
| igor@fogoeno.com.br | Funcionário (cozinha) |

**Garçom:** em **Mesas → mesa → Lançar pedido** (celular, tablet ou desktop) o garçom faz o pedido pela mesa, sem o cliente usar o QR: toca nos pratos, confirma as opções, revisa e envia. O pedido entra direto em **Preparando** na Central (ninguém precisa aceitar), com a tag "Lançado no estabelecimento" e o nome de quem lançou, e soma na mesma comanda de um pedido pelo QR. Em **Configurações → Salão** o Dono escolhe se os clientes também pedem pelo QR da mesa (desligado: só os garçons lançam, o Mesas não mostra o QR e um QR antigo manda chamar o atendente) e se a comanda soma 10% de serviço.

**Cardápio e estoque:** categorias são criadas, renomeadas e excluídas (só vazias) no próprio Cardápio; em **Produtos → item → Ajustar estoque** entram estoque inicial, entradas sem nota, perdas e a contagem; em **Organizar prato**, cada adicional pode baixar um insumo (ex.: Bacon extra → 0,03 kg de bacon).

**Super admin:** abra `http://localhost:5174/admin` e entre com o valor de `SUPER_ADMIN_KEY` da API. Sem essa variável, o `/api/admin` responde 503. Na lista, o nome do restaurante abre o detalhe: dados cadastrais, módulos contratados (desligado some do menu e a API responde 403), configurações atuais, equipe e WhatsApp. Senha provisória — a do Dono no cadastro ou a de "Resetar senha" na equipe — aparece uma vez e obriga a troca no primeiro login; até lá a API só aceita a troca. Em **Mensalidades**: o valor e o dia de vencimento ficam no detalhe de cada restaurante; "Gerar cobranças do mês" cria a mensalidade dos ativos com valor (de novo, só acrescenta quem falta); atrasado é calculado (pendente depois do vencimento) e destacado; "Marcar como pago" registra data e forma. É a mesma tabela que o restaurante vê em Minha Fatura. Inadimplência não desativa ninguém sozinha.

### Hamburgueria de demonstração (produção)

`npm run db:seed:demo --workspace apps/api` cria o **Chapa 27 Burgers** (id `chapa27`): 4 categorias, 30 itens, insumos com custo e ficha técnica, estoque inicial (bacon, cheddar, pão australiano e água com gás quase no fim), 30 mesas no mapa 11×11, contas a pagar/receber do mês, horários, Emissão Fiscal desligada e mensalidade de R$ 299,90 (dia 10). Sem fotos. Roda num banco vazio já migrado e **nunca apaga nada**: se o restaurante já existe, sai sem alterar. Logins `dono@`, `gerente@`, `garcom@` e `cozinha@chapa27.example`; a senha vem de `SEED_DEMO_PASSWORD` ou é gerada e impressa uma única vez.

### Cardápio do cliente (`apps/web`)

```sh
npm run dev:web                             # http://localhost:5173
```

### WhatsApp no Atendimento

Conexão **não oficial** via [Evolution API](https://github.com/evolution-foundation/evolution-api) (Baileys), rodando no Docker da mesma máquina da API. Não vai para a Vercel — a troca pela Cloud API oficial da Meta é uma segunda implementação de `WhatsAppProvider` (`apps/api/src/lib/whatsapp.ts`), sem mexer em tickets, rotas ou telas.

```sh
# em apps/api/.env: as 4 variáveis de WhatsApp do .env.example; EVOLUTION_API_KEY e WHATSAPP_WEBHOOK_SECRET geradas com openssl rand -hex 32
docker compose --env-file apps/api/.env up -d   # Evolution v2.3.7 em http://localhost:8085, só nesta máquina (+ o Postgres interno dela)
npm run dev:api
```

A chave da Evolution vem do próprio `apps/api/.env` (por isso o `--env-file`) e **não tem valor padrão**: sem `EVOLUTION_API_KEY`, o compose não sobe e diz o que falta. Trocou a chave? Rode o mesmo `up -d` (o contêiner é recriado com a nova; as sessões do WhatsApp ficam no volume). A porta 8085 é publicada só em `127.0.0.1`: nada da rede local ou do túnel chega na Evolution.

Depois, no dashboard, entre como Dono → **Configurações → WhatsApp**: aceite o aviso de risco (fica registrado quem e quando), escaneie o QR com o celular do restaurante e as conversas passam a chegar em **Atendimento**, canal WhatsApp. Um ticket por contato; o que o celular do restaurante envia (resposta manual ou a saudação automática do WhatsApp Business) também aparece na conversa. O sistema só envia o que alguém digita no Atendimento — nunca mensagem automática. Uma resposta enviada pelo Atendimento marca como lidas ("visto") as mensagens pendentes daquele contato; receber ou só abrir a conversa não marca. Mídia recebida e enviada vai para um bucket **privado** do Supabase Storage (`STORAGE_S3_WHATSAPP_BUCKET`, criado pelo `db:deploy`), separado do bucket público das fotos do cardápio: a API guarda só a chave do arquivo e, a cada leitura de ticket (só para quem acessa o Atendimento daquele restaurante), entrega uma URL assinada que vale de 30 a 60 min. Sem Storage, texto funciona e a mídia recebida vira um aviso "veja no celular".

O webhook da Evolution chega sem a mídia (`base64: false`, só o tamanho que a mensagem informa): foto ou áudio de até 8 MB a API baixa da Evolution e guarda; acima disso não baixa, e a conversa mostra "[Arquivo de 12 MB não recebido (o limite é 8 MB). Peça para o cliente enviar de outro jeito.]". O corpo do webhook fica limitado a 2 MB. Um número conectado antes dessa versão (instância criada com `base64: true`) precisa de **Desconectar** e conectar de novo em Configurações → WhatsApp, para a Evolution pegar a configuração nova (o mesmo vale ao trocar `WHATSAPP_WEBHOOK_URL` ou `WHATSAPP_WEBHOOK_SECRET`).

`docker compose --env-file apps/api/.env down` para; `down -v` apaga também as sessões do WhatsApp.

### Android

`npm run build:android --workspace apps/dashboard` (ou `apps/web`) gera o build com `.env.android`, que aponta a API para `10.0.2.2:4100` (o localhost da máquina visto de dentro do emulador, que alcança a API mesmo presa em `127.0.0.1`), e sincroniza com o projeto Capacitor. Num aparelho físico pela rede local, suba a API com `HOST=0.0.0.0`. `npm run android:open` abre no Android Studio.

**APK de demonstração do painel (API na VM).** A URL da API entra no build (`VITE_API_URL`, embutida pelo Vite) e, definida no ambiente, vence o `.env.android`. O `capacitor.config.ts` lê a mesma variável no `cap sync`: com uma API `https://`, o app roda no esquema `https` e o Android continua bloqueando HTTP em texto puro (o manifesto final não tem `usesCleartextTraffic`); sem ela, o build de dev segue em `http` com texto puro liberado, como antes.

```sh
VITE_API_URL=https://<IP-da-VM> VITE_CUSTOMER_APP_URL=https://<cardapio>.vercel.app \
  npm run build:android --workspace apps/dashboard      # vite build + cap sync (esquema https, sem texto puro)
cd apps/dashboard/android && ./gradlew assembleDebug    # app/build/outputs/apk/debug/app-debug.apk (assinado com a chave de debug)
```

(O `gradlew` precisa de `JAVA_HOME`; o JDK do Android Studio serve. Ou, depois do primeiro comando, `npm run android:open` e Build → Build APK(s).)

`VITE_CUSTOMER_APP_URL` é o cardápio da Vercel, para os QR codes impressos pelo APK. A API da VM precisa de `https://localhost` em `CORS_ORIGINS` (é a origem do app dentro do APK; ver `deploy/.env.example`). O certificado do IP é do Let's Encrypt (raiz ISRG Root X1): Android 7.1.1 ou mais novo. Depois, `npm run build:android` sem as variáveis volta o projeto Android para o modo de dev.

## Testes

```sh
npm test                    # API + telas
npm run test:api            # só a API
npm run test:e2e            # só o Playwright
npm run carga               # casa cheia no Chapa 27, num Postgres descartável (fora do npm test e do CI)
npm run carga -- supabase   # a mesma casa cheia no banco do apps/api/.env (o projeto Supabase de testes)
```

O `tests/run.mjs` sobe um Postgres descartável em Docker (porta 54329), aplica as migrações, roda o seed de demonstração no banco vazio (prova que ele funciona sozinho), depois o seed de dev e o de demonstração de novo, sobe a API na 4200 e, para o e2e, o dashboard na 5274 e o cardápio do cliente na 5273. No fim, derruba tudo. O banco real nunca é tocado. Os testes de WhatsApp não precisam da Evolution: `tests/api/whatsapp.test.ts` serve uma Evolution falsa na 4299 (webhooks simulados e o download da mídia) que também faz o papel do S3 do bucket privado do WhatsApp, com credenciais falsas, e o bucket público fica desligado nos testes. As suítes chamam a API com poucos logins, muito mais rápido que gente, então o `npm test` sobe o limite por funcionário para 3.000/min (`STAFF_PER_MINUTE`); o teste de limites usa esse mesmo número. Um teste roda `docker compose config` (precisa do Docker CLI, que o CI tem). Rode `npm run db:generate --workspace apps/api` uma vez antes, porque o CI faz o mesmo. O CI (`.github/workflows/test.yml`) roda o typecheck e o `npm test` em cada PR e em cada push na `master`.

O Playwright roda em três tamanhos de tela (projetos `desktop` 1366, `tablet` 1280×800 em paisagem com toque, `mobile` 390). `tests/e2e/fluxo-critico.spec.ts` faz o caminho inteiro do Chapa 27: QR da mesa → pedido com opções no app do cliente → Central → cozinha → fechamento na maquininha → estoque, Contas a Receber, turno e Relatórios. `tests/e2e/varredura.spec.ts` abre todas as telas do escopo com cada papel, nos três tamanhos e nos dois temas, e falha se a página rolar na horizontal, der erro de JavaScript ou alguma chamada da API voltar com erro; com `VARREDURA_FOTOS=1` ela salva uma captura de cada tela em `test-results/varredura` para a conferência visual. No desktop e no celular, cada tela também passa pelo axe-core (WCAG 2.1 A/AA) e pela medida dos alvos de toque (44 × 44, `tests/e2e/a11y.ts`); `tests/e2e/dialogos.spec.ts` faz o mesmo com cada diálogo, folha, popover e formulário que só abre com um toque.

`npm run carga` sobe o Postgres descartável e a API como o `npm test`, constrói o cardápio e o painel (`vite build` + `vite preview` na 5273 e na 5274, como o celular recebe) e roda a casa cheia de `tests/load/cenario.mjs` (30 mesas × 4 celulares, 15 tablets, 10 Centrais, 10 pedidos/min por 10 min, tudo do IP do Wi-Fi, cada aparelho no polling real das telas) em `tests/load/pico.mjs`. Com a casa cheia, `tests/load/cardapio.mjs` mede o cardápio no Lighthouse (modo celular: 4G lenta simulada e CPU 4× mais lenta) na rota do QR e na do tablet, e `tests/load/painel.spec.ts` mede pedido → Central nas telas de verdade. No fim, os garçons fecham as 29 contas juntos. Falha se o LCP do cardápio passar de 2,5 s, se um pedido levar mais de 5 s (p95) para aparecer na Central, se a API do cardápio passar de 2 s (p95) ou se houver algum 429. `npm run carga -- supabase` roda o mesmo contra o banco do `apps/api/.env` (o projeto Supabase de testes): sem Docker e sem migração, só o seed de demonstração, que não apaga nada. Relatórios do Lighthouse em `test-results/`. O plano completo, com o que é automático e o que é manual, os resultados e as medições, está em [docs/testes/plano-de-testes.md](docs/testes/plano-de-testes.md).

## Variáveis de ambiente

Cada app tem um `.env.example`. Copie para `.env` no mesmo diretório.

### `apps/api`

| Variável | Obrigatória | Para quê |
| --- | --- | --- |
| `DATABASE_URL` | sim | Postgres usado em runtime. Hoje, o pooler do Supabase em modo transação (porta 6543, `pgbouncer=true`); a medição de latência e a recomendação estão no plano de testes, seção 7. |
| `DIRECT_URL` | sim | Usado por migrações e seed (hoje, o pooler do Supabase em modo sessão, porta 5432). |
| `PORT` | não | Porta da API (padrão 4000; o exemplo usa 4100, que é o que os fronts esperam). |
| `HOST` | não | Interface em que a API escuta. Vazia = `127.0.0.1`: só a máquina e o túnel chegam nela (há teste disso). `0.0.0.0` só para testar pelo celular na rede local, em dev. |
| `NODE_ENV` | em produção | `production` no servidor de verdade: a API só sobe com `JWT_SECRET` (32+ caracteres) e `CORS_ORIGINS` definidas, e diz qual falta. |
| `JWT_SECRET` | em produção | Assina os tokens de staff. Em produção, pelo menos 32 caracteres (`openssl rand -base64 48`). Em dev, vazia usa um valor inseguro de fallback. |
| `SUPER_ADMIN_KEY` | para usar /admin | Chave única do painel de plataforma. |
| `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` | para WhatsApp | Onde está a Evolution e a chave dela, sem valor padrão (`openssl rand -hex 32`). O `docker-compose.yml` lê a mesma `EVOLUTION_API_KEY` (`--env-file apps/api/.env`) e não sobe sem ela. |
| `WHATSAPP_WEBHOOK_URL` | para WhatsApp (dev) | URL que a Evolution chama ao receber mensagem — a API vista de dentro do Docker (`http://host.docker.internal:4100/api/whatsapp/webhook`). |
| `WHATSAPP_WEBHOOK_SECRET` | para WhatsApp (dev) | Segredo que a Evolution manda no cabeçalho `x-webhook-secret`; webhook sem ele recebe 401. Faltando qualquer uma das quatro, conectar e enviar respondem 503. |
| `CORS_ORIGINS` | em produção | Origens liberadas (URLs do painel e do cardápio), separadas por vírgula. Sem ela, em dev qualquer origem é aceita (dev/Android); em produção a API não sobe. |
| `APP_TZ` | não | Fuso usado para "hoje"/"mês" (padrão `America/Sao_Paulo`). |
| `STORAGE_S3_ENDPOINT`, `STORAGE_S3_REGION`, `STORAGE_S3_ACCESS_KEY_ID`, `STORAGE_S3_SECRET_ACCESS_KEY`, `STORAGE_S3_BUCKET`, `STORAGE_PUBLIC_URL` | para upload | Supabase Storage via API S3 (logo, capa, fotos). Sem elas, os uploads respondem 503. `STORAGE_S3_BUCKET` é o bucket público (`cardapio`). |
| `STORAGE_S3_WHATSAPP_BUCKET` | para mídia do WhatsApp | Bucket privado (mesmas credenciais S3 acima); lido só por URL assinada. |
| `STAFF_PER_MINUTE` | não | Só para testes: troca o limite de 600 requisições/min por funcionário (o `npm test` usa 3.000). Em produção, deixe vazia. |

**Buckets do Storage, versionados:** `apps/api/prisma/buckets.ts`, que o `npm run db:deploy` roda depois das migrações, cria ou alinha os dois buckets com as mesmas constantes que a API usa (`apps/api/src/lib/storage.ts`): `STORAGE_S3_BUCKET` público, até 8 MB, só PNG, JPEG e WebP; `STORAGE_S3_WHATSAPP_BUCKET` privado, até 8 MB, as imagens e os áudios do WhatsApp. Um projeto novo (produção incluída) nasce igual; bucket sem a variável é pulado.

### `apps/dashboard`

| Variável | Para quê |
| --- | --- |
| `VITE_API_URL` | URL da API. Fallback: `http://localhost:4100`. Entra no build (defina na Vercel antes do primeiro deploy). |
| `VITE_CUSTOMER_APP_URL` | URL pública do `apps/web`, usada nos QR codes das mesas. Fallback: `http://localhost:5173`. |

### `apps/web`

| Variável | Para quê |
| --- | --- |
| `VITE_API_URL` | URL da API. Fallback: `http://localhost:4100`. |

## Deploy

Os dois fronts vão para a Vercel como SPA (`vercel.json` de cada um; `VITE_API_URL` aponta para a API). A API roda no PC do restaurante, atrás do túnel da Cloudflare (o `cloudflared` na mesma máquina), com a Evolution no Docker ao lado: é o cenário suportado ([ADR 0009](docs/adr/0009-pedido-pelo-qr-e-limites.md)). O `apps/api/vercel.json` ainda existe, mas numa função serverless o WhatsApp responde 503 e os limites por IP não funcionam (o IP seria o do proxy da Vercel e os contadores não seriam compartilhados).

Na API de produção são obrigatórias: `DATABASE_URL`, `DIRECT_URL`, `NODE_ENV=production`, `JWT_SECRET` com pelo menos 32 caracteres e `CORS_ORIGINS` com as URLs do painel e do cardápio — sem uma das duas últimas a API não sobe e diz qual falta. `HOST` fica vazia (127.0.0.1). Para o WhatsApp, as quatro variáveis da Evolution; para fotos, as do Storage. Migrações e buckets: `npm run db:deploy --workspace apps/api` com `DIRECT_URL` apontando para o Supabase.
