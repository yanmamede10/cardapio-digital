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
  e2e/        Testes de tela do dashboard (Playwright, desktop e mobile).
  run.mjs     Orquestra tudo: sobe o Postgres em Docker, migra, faz seed, sobe a API, roda os testes, derruba.
docs/adr/     Decisões de arquitetura (uma por arquivo).
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
npm run db:deploy   --workspace apps/api    # aplica as migrações
npm run db:seed     --workspace apps/api    # dados de exemplo (restaurante "fogo" com equipe)
npm run dev:api                             # http://localhost:4100
```

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

**Super admin:** abra `http://localhost:5174/admin` e entre com o valor de `SUPER_ADMIN_KEY` da API. Sem essa variável, o `/api/admin` responde 503.

### Cardápio do cliente (`apps/web`)

```sh
npm run dev:web                             # http://localhost:5173
```

### Android

`npm run build:android --workspace apps/dashboard` (ou `apps/web`) gera o build com `.env.android`, que aponta a API para `10.0.2.2:4100` (o localhost da máquina visto de dentro do emulador), e sincroniza com o projeto Capacitor. `npm run android:open` abre no Android Studio.

## Testes

```sh
npm test            # API + telas
npm run test:api    # só a API
npm run test:e2e    # só o Playwright
```

O `tests/run.mjs` sobe um Postgres descartável em Docker (porta 54329), aplica as migrações e o seed, sobe a API na 4200 e, para o e2e, o dashboard na 5274. No fim, derruba tudo. O banco real nunca é tocado. Rode `npm run db:generate --workspace apps/api` uma vez antes, porque o CI faz o mesmo. O CI (`.github/workflows/test.yml`) roda o typecheck e o `npm test` em cada PR e em cada push na `master`.

## Variáveis de ambiente

Cada app tem um `.env.example`. Copie para `.env` no mesmo diretório.

### `apps/api`

| Variável | Obrigatória | Para quê |
| --- | --- | --- |
| `DATABASE_URL` | sim | Postgres usado em runtime (em produção, a string *pooled*/PgBouncer do Supabase). |
| `DIRECT_URL` | sim | Postgres direto, usado por migrações e seed. |
| `PORT` | não | Porta da API (padrão 4000; o exemplo usa 4100, que é o que os fronts esperam). |
| `JWT_SECRET` | em produção | Assina os tokens de staff. Sem ela em produção, a API não sobe. Em dev há um valor inseguro de fallback. |
| `SUPER_ADMIN_KEY` | para usar /admin | Chave única do painel de plataforma. |
| `CORS_ORIGINS` | não | Origens liberadas, separadas por vírgula. Sem ela, qualquer origem é aceita (dev/Android). |
| `APP_TZ` | não | Fuso usado para "hoje"/"mês" (padrão `America/Sao_Paulo`). |
| `STORAGE_S3_ENDPOINT`, `STORAGE_S3_REGION`, `STORAGE_S3_ACCESS_KEY_ID`, `STORAGE_S3_SECRET_ACCESS_KEY`, `STORAGE_S3_BUCKET`, `STORAGE_PUBLIC_URL` | para upload | Supabase Storage via API S3 (logo, capa, fotos). Sem elas, os uploads respondem 503. |

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

Cada app tem seu `vercel.json`: a API roda como função serverless na região `gru1` e os dois fronts como SPA. Migrações em produção: `npm run db:deploy --workspace apps/api` com `DIRECT_URL` apontando para o Supabase.
