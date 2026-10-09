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
docker-compose.yml  Evolution API local (WhatsApp no Atendimento), na mesma máquina da API (dev).
deploy/             Produção na VM: Compose (Caddy com os dois fronts, API, Evolution, backup), Caddyfile, deploy.sh, .env.example. Ver "Deploy".
```

## Pré-requisitos

- Node 22 e npm
- Docker (Postgres local e `npm test`, que também sobe a pilha de produção nas portas 80 e 443 desta máquina)
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

A API escuta em `127.0.0.1` por padrão (`HOST` vazio): só a própria máquina chega nela. Para abrir no celular pela rede local em dev, rode com `HOST=0.0.0.0`. Na VM, o contêiner escuta em `0.0.0.0` e só o Caddy, na rede interna do Compose, chega nela.

Limites de requisição ([ADR 0009](docs/adr/0009-pedido-pelo-qr-e-limites.md)): por funcionário (600/min, somando os aparelhos do mesmo login), por mesa (900/min), pedidos por mesa (40 em 5 min), bloqueio da conta depois de 5 senhas erradas e, para o IP real, um teto por IP e um de logins por IP. O IP vem de `CF-Connecting-IP` só quando a conexão vem do proxy confiável (`TRUSTED_PROXY`: o Caddy na VM, que sobrescreve esse cabeçalho; a própria máquina em dev); de qualquer outro endereço vale o da conexão. Uma requisição da própria máquina sem esse cabeçalho, em dev, não tem IP: escapa só dos dois limites por IP; os outros valem.

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

**Cardápio e estoque:** as categorias são uma lista só para o Cardápio e o Catálogo — a categoria mora no produto (insumos também) e o prato mostra a do seu produto ([ADR 0012](docs/adr/0012-categoria-mora-no-produto.md)); são criadas, renomeadas, reordenadas e excluídas no Cardápio ou em **Produtos → Catálogo** (com itens, a caixa diz quantos e pede para qual categoria movê-los: "Mover e excluir"), que agrupa produtos e insumos por categoria, com busca, tipo e "Sem categoria" no fim; o cardápio do cliente só mostra categoria com prato. Em **Produtos → item → Ajustar estoque** entram estoque inicial, entradas sem nota, perdas e a contagem; depois da primeira movimentação a unidade e o custo do item ficam travados no cadastro, e um custo errado se corrige ali, no campo "Custo" (opcional), que fica registrado na movimentação; em **Organizar prato**, cada adicional pode baixar um insumo (ex.: Bacon extra → 0,03 kg de bacon).

**Super admin:** abra `http://localhost:5174/admin` (em produção, `<PUBLIC_URL>/painel/admin`) e entre com o valor de `SUPER_ADMIN_KEY` da API. Sem essa variável, o `/api/admin` responde 503. Na lista, o nome do restaurante abre o detalhe: dados cadastrais, módulos contratados (desligado some do menu e a API responde 403; restaurante novo nasce com todos menos Delivery, então só entra na lista do app do cliente quando ele for ligado), configurações atuais, equipe e WhatsApp. Senha provisória — a do Dono no cadastro ou a de "Resetar senha" na equipe — aparece uma vez e obriga a troca no primeiro login; até lá a API só aceita a troca. Resetar a senha — ou o Dono trocar a de alguém em Equipe — encerra todas as sessões abertas daquela pessoa na próxima requisição; quem troca a própria senha segue logado no aparelho em que está. Em **Mensalidades**: o valor e o dia de vencimento ficam no detalhe de cada restaurante; "Gerar cobranças do mês" cria a mensalidade dos ativos com valor (de novo, só acrescenta quem falta); atrasado é calculado (pendente depois do vencimento) e destacado; "Marcar como pago" registra data e forma. É a mesma tabela que o restaurante vê em Minha Fatura. Inadimplência não desativa ninguém sozinha.

### Hamburgueria de demonstração (produção)

`npm run db:seed:demo --workspace apps/api` cria o **Chapa 27 Burgers** (id `chapa27`): 4 categorias no cardápio, 30 itens, 33 insumos com custo, ficha técnica e categoria (Carnes, Pães, Hortifrúti, Laticínios, Bebidas, Embalagens, Molhos, Sobremesas), estoque inicial (bacon, cheddar, pão australiano e água com gás quase no fim), 30 mesas no mapa 11×11, contas a pagar/receber do mês, horários, Emissão Fiscal desligada e mensalidade de R$ 299,90 (dia 10). Sem fotos. Roda num banco vazio já migrado e **nunca apaga nada**: se o restaurante já existe, sai sem alterar. Logins `dono@`, `gerente@`, `garcom@` e `cozinha@chapa27.example`; a senha vem de `SEED_DEMO_PASSWORD` ou é gerada e impressa uma única vez.

### Cardápio do cliente (`apps/web`)

```sh
npm run dev:web                             # http://localhost:5173
```

### WhatsApp no Atendimento

Conexão **não oficial** via [Evolution API](https://github.com/evolution-foundation/evolution-api) (Baileys), rodando no Docker da mesma máquina da API (na VM, no mesmo Compose: ver "Deploy"). A troca pela Cloud API oficial da Meta é uma segunda implementação de `WhatsAppProvider` (`apps/api/src/lib/whatsapp.ts`), sem mexer em tickets, rotas ou telas.

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

**APK do painel (servidor na VM).** O APK roda o painel na origem `https://localhost`, na raiz (sem o `/painel/` do build web), e fala com o servidor pelo endereço público: o mesmo `PUBLIC_URL` do `deploy/.env`, passado como `VITE_PUBLIC_URL` (no ambiente, vence o `.env.android`). Dele saem a API (`${PUBLIC_URL}/api`) e o link dos QR codes impressos pelo APK (`${PUBLIC_URL}/t/<código>`, nunca `https://localhost`). O `capacitor.config.ts` lê a mesma variável no `cap sync`: com `https://`, o app roda no esquema `https` e o Android continua bloqueando HTTP em texto puro (o manifesto final não tem `usesCleartextTraffic`); sem ela, o build de dev segue em `http` com texto puro liberado, como antes.

```sh
VITE_PUBLIC_URL=https://<IP-da-VM> \
  npm run build:android --workspace apps/dashboard      # vite build --mode android + cap sync (esquema https, sem texto puro)
cd apps/dashboard/android && ./gradlew assembleDebug    # app/build/outputs/apk/debug/app-debug.apk (assinado com a chave de debug)
```

(O `gradlew` precisa de `JAVA_HOME`; o JDK do Android Studio serve. Ou, depois do primeiro comando, `npm run android:open` e Build → Build APK(s).)

O CORS da API na VM já libera `https://localhost` (fixado no Compose). O certificado do IP é do Let's Encrypt (raiz ISRG Root X1): Android 7.1.1 ou mais novo. Trocou o `PUBLIC_URL` (IP novo, domínio)? Gere o APK de novo com o valor novo ([ADR 0011](docs/adr/0011-fronts-no-caddy.md)). Depois, `npm run build:android` sem a variável volta o projeto Android para o modo de dev.

## Testes

```sh
npm test                    # API + telas
npm run test:api            # só a API
npm run test:e2e            # só o Playwright
npm run carga               # casa cheia no Chapa 27, num Postgres descartável (fora do npm test e do CI)
npm run carga -- supabase   # a mesma casa cheia no banco do apps/api/.env (o projeto Supabase de testes)
```

O `tests/run.mjs` sobe um Postgres descartável em Docker (porta 54329), aplica as migrações, roda o seed de demonstração no banco vazio (prova que ele funciona sozinho), depois o seed de dev e o de demonstração de novo, sobe a API na 4200 e, para o e2e, o dashboard na 5274 e o cardápio do cliente na 5273. No fim, derruba tudo. O banco real nunca é tocado. Os testes de WhatsApp não precisam da Evolution: `tests/api/whatsapp.test.ts` serve uma Evolution falsa na 4299 (webhooks simulados e o download da mídia) que também faz o papel do S3 do bucket privado do WhatsApp, com credenciais falsas, e o bucket público fica desligado nos testes. As suítes chamam a API com poucos logins, muito mais rápido que gente, então o `npm test` sobe o limite por funcionário para 3.000/min (`STAFF_PER_MINUTE`); o teste de limites usa esse mesmo número. Um teste roda `docker compose config` (precisa do Docker CLI, que o CI tem). Rode `npm run db:generate --workspace apps/api` uma vez antes, porque o CI faz o mesmo. O CI (`.github/workflows/test.yml`) roda o typecheck e o `npm test` em cada PR e em cada push na `master`.

O Playwright roda em três tamanhos de tela (projetos `desktop` 1366, `tablet` 1280×800 em paisagem com toque, `mobile` 390). `tests/e2e/fluxo-critico.spec.ts` faz o caminho inteiro do Chapa 27: QR da mesa → pedido com opções no app do cliente → Central → cozinha → fechamento na maquininha → estoque, Contas a Receber, turno e Relatórios. `tests/e2e/varredura.spec.ts` abre todas as telas do escopo com cada papel, nos três tamanhos e nos dois temas, e falha se a página rolar na horizontal, der erro de JavaScript ou alguma chamada da API voltar com erro; com `VARREDURA_FOTOS=1` ela salva uma captura de cada tela em `test-results/varredura` para a conferência visual. No desktop e no celular, cada tela também passa pelo axe-core (WCAG 2.1 A/AA) e pela medida dos alvos de toque (44 × 44, `tests/e2e/a11y.ts`); `tests/e2e/dialogos.spec.ts` faz o mesmo com cada diálogo, folha, popover e formulário que só abre com um toque. `tests/e2e/caddy.spec.ts` sobe a pilha de produção nesta máquina — o `caddy` (com os dois fronts construídos na imagem) e a `api` do `deploy/docker-compose.prod.yml`, com `CADDY_TLS=internal` e `PUBLIC_URL=https://127.0.0.1`, a partir de uma cópia do repositório e com um `deploy/.env` próprio, como a VM — e confere as rotas (`/`, `/painel/`, `/api/`), as rotas internas recarregadas, os cabeçalhos e o cache, o CORS, o IP do cliente pelo Caddy, a CSP no navegador e o link do QR (também no build do APK); precisa das portas 80 e 443 livres e sai com `docker compose down -v`.

`npm run carga` sobe o Postgres descartável e a API como o `npm test`, constrói o cardápio e o painel (`vite build` + `vite preview` na 5273 e na 5274, como o celular recebe) e roda a casa cheia de `tests/load/cenario.mjs` (30 mesas × 4 celulares, 15 tablets, 10 Centrais, 10 pedidos/min por 10 min, tudo do IP do Wi-Fi, cada aparelho no polling real das telas) em `tests/load/pico.mjs`. Com a casa cheia, `tests/load/cardapio.mjs` mede o cardápio no Lighthouse (modo celular: 4G lenta simulada e CPU 4× mais lenta) na rota do QR e na do tablet, e `tests/load/painel.spec.ts` mede pedido → Central nas telas de verdade. No fim, os garçons fecham as 29 contas juntos. Falha se o LCP do cardápio passar de 2,5 s, se um pedido levar mais de 5 s (p95) para aparecer na Central, se a API do cardápio passar de 2 s (p95) ou se houver algum 429. `npm run carga -- supabase` roda o mesmo contra o banco do `apps/api/.env` (o projeto Supabase de testes): sem Docker e sem migração, só o seed de demonstração, que não apaga nada. Relatórios do Lighthouse em `test-results/`. O plano completo, com o que é automático e o que é manual, os resultados e as medições, está em [docs/testes/plano-de-testes.md](docs/testes/plano-de-testes.md).

## Variáveis de ambiente

A API tem um `.env.example`: copie para `apps/api/.env`. Os fronts não precisam de `.env` em dev (o `.env.development` de cada um, versionado, aponta para a API e o cardápio desta máquina); em produção, o único endereço é o `PUBLIC_URL` do `deploy/.env` (ver "Deploy").

### `apps/api`

| Variável | Obrigatória | Para quê |
| --- | --- | --- |
| `DATABASE_URL` | sim | Postgres usado em runtime. Na VM: o pooler do Supabase em modo **sessão** (porta 5432), sem `pgbouncer=true` e com `connection_limit=10` (a conta está em `deploy/.env.example`; a medição de latência, no plano de testes, seção 7). |
| `DIRECT_URL` | sim | Usado por migrações, seeds e pelo backup (`pg_dump`): o pooler do Supabase em modo sessão, porta 5432, sem opções do Prisma. |
| `PORT` | não | Porta da API (padrão 4000; o exemplo usa 4100, que é o que os fronts esperam). |
| `HOST` | não | Interface em que a API escuta. Vazia = `127.0.0.1`: só a própria máquina chega nela (há teste disso). `0.0.0.0` para testar pelo celular na rede local, em dev; no contêiner da VM, fixada em `0.0.0.0` pelo Compose. |
| `TRUSTED_PROXY` | não | Endereço(s), separados por vírgula, de quem a API aceita o IP do cliente em `CF-Connecting-IP`. Vazia = a própria máquina (dev e testes). Na VM, fixada no Compose: o Caddy (`172.30.0.2`). |
| `NODE_ENV` | em produção | `production` no servidor de verdade: a API só sobe com `JWT_SECRET` (32+ caracteres) e `CORS_ORIGINS` definidas, e diz qual falta. |
| `JWT_SECRET` | em produção | Assina os tokens de staff. Em produção, pelo menos 32 caracteres (`openssl rand -base64 48`). Em dev, vazia usa um valor inseguro de fallback. |
| `SUPER_ADMIN_KEY` | para usar /admin | Chave única do painel de plataforma. |
| `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` | para WhatsApp | Onde está a Evolution e a chave dela, sem valor padrão (`openssl rand -hex 32`). O `docker-compose.yml` lê a mesma `EVOLUTION_API_KEY` (`--env-file apps/api/.env`) e não sobe sem ela. |
| `WHATSAPP_WEBHOOK_URL` | para WhatsApp (dev) | URL que a Evolution chama ao receber mensagem — a API vista de dentro do Docker (`http://host.docker.internal:4100/api/whatsapp/webhook`). |
| `WHATSAPP_WEBHOOK_SECRET` | para WhatsApp (dev) | Segredo que a Evolution manda no cabeçalho `x-webhook-secret`; webhook sem ele recebe 401. Faltando qualquer uma das quatro, conectar e enviar respondem 503. |
| `CORS_ORIGINS` | em produção | Origens liberadas, separadas por vírgula. Sem ela, em dev qualquer origem é aceita (dev/Android); em produção a API não sobe. Na VM, fixada no Compose: `PUBLIC_URL` (os fronts, na mesma origem da API) e `https://localhost` (o painel dentro do APK). |
| `APP_TZ` | não | Fuso usado para "hoje"/"mês" (padrão `America/Sao_Paulo`). |
| `STORAGE_S3_ENDPOINT`, `STORAGE_S3_REGION`, `STORAGE_S3_ACCESS_KEY_ID`, `STORAGE_S3_SECRET_ACCESS_KEY`, `STORAGE_S3_BUCKET`, `STORAGE_PUBLIC_URL` | para upload | Supabase Storage via API S3 (logo, capa, fotos). Sem elas, os uploads respondem 503. `STORAGE_S3_BUCKET` é o bucket público (`cardapio`). |
| `STORAGE_S3_WHATSAPP_BUCKET` | para mídia do WhatsApp | Bucket privado (mesmas credenciais S3 acima); lido só por URL assinada. |
| `STAFF_PER_MINUTE` | não | Só para testes: troca o limite de 600 requisições/min por funcionário (o `npm test` usa 3.000). Em produção, deixe vazia. |

**Buckets do Storage, versionados:** `apps/api/prisma/buckets.ts`, que o `npm run db:deploy` roda depois das migrações, cria ou alinha os dois buckets com as mesmas constantes que a API usa (`apps/api/src/lib/storage.ts`): `STORAGE_S3_BUCKET` público, até 8 MB, só PNG, JPEG e WebP; `STORAGE_S3_WHATSAPP_BUCKET` privado, até 8 MB, as imagens e os áudios do WhatsApp. Um projeto novo (produção incluída) nasce igual; bucket sem a variável é pulado.

### `apps/dashboard`

| Variável | Para quê |
| --- | --- |
| `VITE_PUBLIC_URL` | O endereço público (`PUBLIC_URL`): os QR codes das mesas apontam para `${VITE_PUBLIC_URL}/t/<código>`, e o APK (`--mode android`) chama a API em `${VITE_PUBLIC_URL}/api`. No deploy, o build do Caddy passa o `PUBLIC_URL` do `deploy/.env`; no APK, o comando de "APK do painel"; em dev, `http://localhost:5173` (`.env.development`). |
| `VITE_API_URL` | Só dev e testes: a API desta máquina (`.env.development`: `http://localhost:4100`). Sem ela, o build web chama `/api` na própria origem, sem endereço no bundle; o APK a ignora. |

### `apps/web`

| Variável | Para quê |
| --- | --- |
| `VITE_API_URL` | Só dev, testes e o build Android de dev: a API desta máquina (`.env.development`, `.env.android`). Sem ela, o build web chama `/api` na própria origem, sem endereço no bundle. |

## Deploy

Tudo roda numa VM da Oracle Cloud (Ampere A1, ARM64, 2 OCPUs, 12 GB, São Paulo) com Docker Compose, num endereço só, o `PUBLIC_URL` do `deploy/.env` (hoje `https://<IP-da-VM>`; sem domínio por enquanto). O Caddy serve:

| Caminho | O quê |
| --- | --- |
| `/` | cardápio do cliente (`apps/web`); o QR da mesa abre `/t/<código>` |
| `/painel/` | painel (`apps/dashboard`); o Super Admin em `/painel/admin` |
| `/api/` | API |

Esse mapeamento está gravado nos QR codes impressos: não mude. Banco e Storage ficam num projeto Supabase de produção (sa-east-1). Por que assim, os riscos e o plano de saída: [ADR 0010](docs/adr/0010-vm-com-docker-compose.md) (a VM) e [ADR 0011](docs/adr/0011-fronts-no-caddy.md) (os fronts no Caddy, e o passo a passo para trocar o IP por um domínio).

```
deploy/docker-compose.prod.yml  Caddy (único com portas: 80 e 443) com os fronts → API; Evolution 2.3.7 + o Postgres dela; backup diário do banco e do Storage
deploy/Caddyfile                HTTPS no PUBLIC_URL (Let's Encrypt), os dois fronts (cabeçalhos de segurança, cache, rotas internas) e /api/ → API
deploy/caddy.Dockerfile         imagem do Caddy com o cardápio e o painel construídos dentro (npm ci + vite build), na própria VM
deploy/deploy.sh                deploy, rollback e o seed de demonstração
deploy/.env.example             todas as variáveis de produção, comentadas → deploy/.env no servidor (fora do git)
apps/api/Dockerfile             imagem da API, construída na própria VM (ARM64)
```

No navegador, o cardápio e o painel chamam `/api` na própria origem (nenhum endereço no bundle). O `PUBLIC_URL` vai para o Caddy (endereço e certificado), para o CORS da API (ele e `https://localhost`, o APK) e para o build do painel (o link dos QR codes). Cabeçalhos dos fronts, no Caddyfile: CSP, `X-Content-Type-Options`, `Referrer-Policy` e `X-Frame-Options`; `assets/` (nome com hash) com cache de um ano (`immutable`), o `index.html` com `no-cache`.

A VM só recebe código: clona a `master` e roda o `deploy/deploy.sh`. Nada é editado nela além do `deploy/.env`. Antes e depois do primeiro deploy, siga o [checklist de segurança](docs/seguranca/checklist-deploy.md) (a auditoria de outubro de 2026 está em [docs/seguranca/auditoria-2026-10.md](docs/seguranca/auditoria-2026-10.md)).

### Primeira vez

Funciona igual em Ubuntu 24.04 e Oracle Linux 9: do sistema, só Docker e git.

1. **Oracle Cloud:** reserve o IP público da instância (um IP efêmero muda se a instância for recriada). Na Security List (ou NSG) da subnet, libere entrada TCP 80 e 443 de `0.0.0.0/0`: o Let's Encrypt valida o IP pela porta 80 ou 443, e o HTTP só redireciona para HTTPS.
2. **Docker:** instale o Docker Engine com o plugin compose ([docs.docker.com/engine/install](https://docs.docker.com/engine/install/)) e o git; `sudo systemctl enable --now docker` (é o que traz os contêineres de volta quando a VM reinicia) e `sudo usermod -aG docker $USER` (saia e entre de novo).
3. **Código e variáveis:**
   ```sh
   git clone https://github.com/yanmamede10/cardapio-digital.git && cd cardapio-digital
   cp deploy/.env.example deploy/.env && chmod 600 deploy/.env   # preencha seguindo os comentários
   ```
4. **Deploy:** `deploy/deploy.sh`. Na primeira vez, o build das imagens (API, e o Caddy com os dois fronts) leva alguns minutos; o Caddy pede o certificado assim que sobe.
5. **Demonstração (uma vez):** `SEED_DEMO_PASSWORD='…' deploy/deploy.sh seed-demo` cria o Chapa 27 no banco vazio (ver "Hamburgueria de demonstração").
6. **APK do painel**, se for usado: "APK do painel", acima, com o mesmo `PUBLIC_URL`.
7. **Confira** de fora da VM: `curl -sI https://<IP-da-VM>/` → `200` com `content-security-policy` (o cardápio); `https://<IP-da-VM>/painel/` no navegador (o painel); `curl https://<IP-da-VM>/api/health` → `{"ok":true}`; `curl -I http://<IP-da-VM>/api/health` → `308` para `https://`. Se não responder com a Security List aberta, confira o firewall do sistema (iptables nas imagens Ubuntu da Oracle, firewalld no Oracle Linux).

**VM já no ar antes dos fronts no Caddy (05/10/2026):** no `deploy/.env`, troque `PUBLIC_IP=<IP>` por `PUBLIC_URL=https://<IP>` e apague a linha `CORS_ORIGINS` (o Compose define); depois, `deploy/deploy.sh`. Um rollback para um commit anterior a isso volta o Caddy sem os fronts.

### Deploy, rollback e seed

| Comando | O que faz |
| --- | --- |
| `deploy/deploy.sh` | `git pull --ff-only` na `master` → build da API e do Caddy com os fronts → `db:deploy` (migrações e buckets) num contêiner avulso → `up -d` → espera o healthcheck → imprime `No ar: <commit> <assunto> (<data>)`. Se a API não ficar saudável, mostra o log e sai com erro. |
| `deploy/deploy.sh <commit>` | Rollback: o mesmo com um commit anterior (`git log --oneline`), **sem** migrações — o banco fica como está, então o código anterior roda sobre o schema novo (as migrações daqui só acrescentam). O próximo `deploy/deploy.sh` volta para a `master`. |
| `SEED_DEMO_PASSWORD='…' deploy/deploy.sh seed-demo` | Uma vez: o Chapa 27. Se ele já existe, não altera nada. |
| `deploy/deploy.sh seed` | Recusado. O seed de dev (`prisma/seed.ts`) apaga o banco e cria logins com `senha123`; em produção ele também se recusa sozinho (`NODE_ENV=production`, o padrão da imagem). |

Logs: `docker compose -f deploy/docker-compose.prod.yml logs -f api` (ou `caddy`, `evolution`, `backup`).

### HTTPS pelo IP

O Let's Encrypt emite certificado para endereço IP só no perfil `shortlived`, válido por ~160 h (6,7 dias). O Caddy 2.11.4 pede esse perfil para o `PUBLIC_URL` (`issuer acme { profile shortlived }` no `deploy/Caddyfile`) e renova sozinho, sem cron: confere os certificados a cada 10 minutos e renova quando falta cerca de um terço da validade (ou na janela que o Let's Encrypt indicar), uns 2 dias antes de vencer. O Caddy aceita certificado de IP do Let's Encrypt desde a 2.10.x (issue [caddyserver/caddy#7399](https://github.com/caddyserver/caddy/issues/7399)); a 2.11 trouxe as correções do desafio TLS-ALPN e de IPv6 para IPs. O `default_sni` responde com esse certificado aos navegadores que abrem `https://<IP>` (eles não mandam SNI).

- O HTTP redireciona para HTTPS (redirecionamento automático do Caddy).
- O Caddy serve os dois fronts e encaminha só `/api/` para a API (`reverse_proxy api:4100`, o caminho como veio). A Evolution não tem rota nem porta publicada.
- O Caddy **sobrescreve** `CF-Connecting-IP` com o IP de quem conectou; a API só aceita esse cabeçalho vindo do Caddy (`TRUSTED_PROXY`, [ADR 0009](docs/adr/0009-pedido-pelo-qr-e-limites.md)).
- Conferir na VM: `docker compose -f deploy/docker-compose.prod.yml logs caddy | grep -i "certificate obtained"` e `echo | openssl s_client -connect <IP>:443 2>/dev/null | openssl x509 -noout -issuer -dates -ext subjectAltName`.
- Testar a pilha fora da VM: `CADDY_TLS=internal` e `PUBLIC_URL=https://127.0.0.1` no `deploy/.env` (CA local do Caddy; a raiz fica em `/data/caddy/pki/authorities/local/root.crt` no contêiner). O `npm test` faz isso sozinho (`tests/e2e/caddy.spec.ts`).

### Dados que ficam na VM

| Onde | O que guarda |
| --- | --- |
| volume `caddy_data` | certificados, chaves e a conta ACME |
| volume `caddy_config` | configuração ativa do Caddy |
| volume `evolution_db` | o banco interno da Evolution: instâncias, as sessões do WhatsApp (tabela `Session`; sem ele, é preciso escanear o QR de novo) e mensagens |
| volume `evolution_instances` | arquivos por instância da Evolution |
| pasta `deploy/backups/` do clone | os backups diários do banco e, em `storage/`, a cópia dos arquivos do Storage |

Os volumes ficam em `/var/lib/docker/volumes/cardapio_<nome>/_data`. Sobrevivem a `deploy/deploy.sh` (`up -d --build`) e à reinicialização da VM; só `docker compose … down -v` os apaga. A prova está no plano de testes ("Rodada D").

### Backup e restauração

O serviço `backup` (`postgres:17.11`, o mesmo major do Supabase) roda `pg_dump --format=custom --schema=public` uma vez por dia, depois das 04:00 de São Paulo, em `deploy/backups/cardapio-AAAA-MM-DD.dump` (compactado), e guarda os 7 mais novos. Ele confere de hora em hora, então reiniciar não pula um dia. O dump tem o schema e os dados do app (inclusive o histórico de migrações), não os arquivos do Storage: esses têm o seu próprio backup (abaixo, "Arquivos do Storage"). Copie os backups para fora da VM de vez em quando; os arquivos são de root e só ele lê (600), então pela SSH com `sudo`: `ssh <vm> "sudo tar -C cardapio-digital/deploy -czf - backups" > backups-$(date +%F).tgz` (o banco e o Storage juntos).

Restaurar num banco **vazio** (um projeto Supabase novo, ou um Postgres descartável para conferir um backup), antes de qualquer migração:

```sh
docker compose -f deploy/docker-compose.prod.yml run --rm backup \
  pg_restore --schema=public --no-owner --no-privileges --exit-on-error \
  --dbname='postgresql://…' /backups/cardapio-AAAA-MM-DD.dump
```

`--schema=public` restaura o que está dentro do schema, não o `CREATE SCHEMA public` (todo banco novo já tem um, e o `pg_restore` pararia nele). Depois, com o `deploy/.env` apontando para o banco restaurado, `deploy/deploy.sh` (as migrações já estão lá; os buckets são recriados). Prova feita com o projeto Supabase de testes; as contagens estão no plano de testes ("Rodada D").

#### Arquivos do Storage

O serviço `storage-backup` (`rclone/rclone:1.75.1`) copia os dois buckets — `cardapio` (logo, capas e fotos dos pratos) e o privado do WhatsApp (fotos e áudios dos clientes) — para `deploy/backups/storage/<bucket>/`, uma vez por dia, depois das 04:00, com as chaves S3 que a API já usa (`STORAGE_S3_*` do `deploy/.env`). A cópia é incremental: só baixa o que é novo ou mudou (mesmo tamanho e data = pulado) e nunca apaga aqui o que foi apagado lá. Mesmas permissões do dump (pastas 700, arquivos 600, de root); `deploy/backups/storage/.ultima-copia` diz o dia da última cópia completa, e o log (`… logs storage-backup`) a quantidade de arquivos por bucket.

Copiar agora, sem esperar o dia seguinte: `docker compose -f deploy/docker-compose.prod.yml exec storage-backup rm /backups/.ultima-copia && docker compose -f deploy/docker-compose.prod.yml restart storage-backup`.

Restaurar nos buckets do `deploy/.env` (num projeto novo, depois do `deploy/deploy.sh`, que cria os buckets vazios). O tipo de cada arquivo vai explícito, pela extensão: os buckets só aceitam os tipos da lista deles, e o rclone da imagem não sabe o tipo de `.ogg`, `.m4a` e afins:

```sh
docker compose -f deploy/docker-compose.prod.yml run --rm --entrypoint sh storage-backup -c '
for t in png:image/png jpg:image/jpeg webp:image/webp ogg:audio/ogg mp3:audio/mpeg m4a:audio/mp4 aac:audio/aac webm:audio/webm; do
  for b in $BUCKETS; do rclone copy "/backups/$b" "supabase:$b" --include "*.${t%%:*}" --header-upload "Content-Type: ${t#*:}"; done
done'
```

Os nomes dos arquivos são os mesmos, então as URLs gravadas no banco (fotos) e as chaves das mensagens (WhatsApp) voltam a valer se o `STORAGE_PUBLIC_URL` for o mesmo; num projeto novo, o endereço muda, e as fotos precisam ser trocadas no banco ou enviadas de novo pelo painel. Prova (cópia, segunda cópia incremental e restauração) com o projeto Supabase de testes: plano de testes, "Rodada E".
