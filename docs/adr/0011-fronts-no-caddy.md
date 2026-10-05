# 11. Fronts servidos pelo Caddy da VM, num endereço só (sem domínio por enquanto)

Aceita · 05/10/2026

## Contexto
Até aqui o cardápio (`apps/web`) e o painel (`apps/dashboard`) iam para a Vercel e chamavam a API na VM, em `https://<IP>` ([ADR 10](0010-vm-com-docker-compose.md)): três endereços, dois serviços para manter e uma lista de origens no CORS. A VM já tem o Caddy na frente da API, com HTTPS pelo IP (certificado `shortlived` do Let's Encrypt).

Não há domínio ainda. O endereço público é o IP reservado da VM, e ele fica gravado nos QR codes impressos das mesas. Quando o domínio entrar, a troca tem de ser: editar uma variável, rodar o deploy, gerar um APK novo e reimprimir os QR.

## Decisão (05/10/2026)
- **A Vercel sai.** O Caddy da VM serve tudo num endereço só, `PUBLIC_URL`:

  | Caminho | O quê |
  | --- | --- |
  | `/` | cardápio do cliente (`apps/web`) — inclui `/t/<código>`, o link dos QR |
  | `/painel/` | painel (`apps/dashboard`) |
  | `/api/` | API |

  Esse mapeamento vai gravado nos QR codes: não muda sem outra decisão.
- **Os fronts são construídos no deploy, na própria VM.** `deploy/caddy.Dockerfile`: uma etapa Node 22.23.3 faz `npm ci` e `vite build` dos dois apps, e a imagem final é o `caddy:2.11.4-alpine` com os arquivos em `/srv/web` e `/srv/painel`. O `deploy/deploy.sh` constrói as duas imagens (API e Caddy) com `compose build`. Como a da API, sai ARM64 ou x86-64 conforme a máquina, sem registro de imagens.
- **Uma variável: `PUBLIC_URL` no `deploy/.env`** (`https://<IP>`, depois `https://<domínio>`, sem barra no fim). Dela saem:
  - no Caddy, o endereço do site e o certificado (o `default_sni` usa o host, `PUBLIC_HOST`, tirado dela quando o contêiner sobe);
  - na API, o CORS: `PUBLIC_URL` e `https://localhost` (a origem do painel dentro do APK), fixado no Compose;
  - no build do painel, o endereço dos QR codes (`VITE_PUBLIC_URL`): `${PUBLIC_URL}/t/<código>`, nunca a origem da página (no APK ela é `https://localhost`).
- **No navegador, os dois apps chamam `/api` na própria origem**: o bundle do cardápio não tem endereço nenhum, e o do painel só tem o `PUBLIC_URL` no link do QR. O APK do painel (origem `https://localhost`) chama `${PUBLIC_URL}/api` e é construído com a mesma URL (`VITE_PUBLIC_URL`, README "APK do painel").
- **O painel em `/painel/` só no build web:** `base` do Vite e `basename` do router. O build do APK (`--mode android`) e o servidor de dev continuam em `/`.
- **Rota interna recarregada:** cada app tem o seu fallback (`try_files {path} /index.html`): `/painel/mesas` devolve o `index.html` do painel; `/t/<código>`, o do cardápio. `/painel` sem barra redireciona para `/painel/`.
- **Cabeçalhos:** a CSP, `X-Content-Type-Options`, `Referrer-Policy` e `X-Frame-Options` que estavam nos `vercel.json` (removidos) passam para o Caddyfile, com os mesmos valores e só nos fronts (a API manda os seus). Arquivo de `assets/` (nome com hash): `Cache-Control: public, max-age=31536000, immutable`; o resto, `index.html` antes de tudo: `no-cache` (revalida a cada visita, 304 se não mudou), então um deploy aparece no próximo carregamento. Os fronts saem comprimidos (zstd/gzip), como a Vercel fazia.

## Consequências
- Um deploy, uma origem, um certificado. No navegador não há chamada entre origens, então o CORS só importa para o APK.
- A VM passa a ser o único ponto também dos fronts: se ela cair, cardápio e painel caem com a API (com a Vercel, as telas abriam, mas sem API davam no mesmo).
- Cada deploy também constrói os fronts (`npm ci` e `vite build`): 1 min 32 s em ARM64 emulado nesta máquina (`npm ci` 39 s, `vite build` 51 s); no A1 de verdade ainda não foi medido. O build é cacheado por camada: mudar só o código da API não reconstrói os fronts, e vice-versa.
- Cardápio e painel dividem a origem, logo o `localStorage`: as chaves de hoje não se cruzam (`cardapio.*` no cardápio; `cardapio.dashboard.session` e `mesapronta.*` no painel). Uma chave nova precisa continuar com o prefixo do seu app.
- **Rollback para antes desta decisão tira os fronts do ar.** `deploy/deploy.sh <commit>` com um commit anterior a 05/10/2026 volta um Caddy que não serve os fronts, e o Compose daquele commit ainda exige `PUBLIC_IP` e `CORS_ORIGINS` no `deploy/.env`. Rollback só entre commits desta fase em diante.
- **Migração do `deploy/.env` da VM:** trocar `PUBLIC_IP=<IP>` por `PUBLIC_URL=https://<IP>` e apagar `CORS_ORIGINS` (o Compose define). Sem `PUBLIC_URL`, o Compose para e diz o que falta.
- Teste: `tests/e2e/caddy.spec.ts` (no `npm test` e no CI) sobe a pilha (Caddy com os fronts + API) com `CADDY_TLS=internal` e `PUBLIC_URL=https://127.0.0.1` a partir de uma cópia do repositório, como a VM, e confere rotas, fallback, cabeçalhos, cache, CORS, o IP do cliente, o link do QR (também no build do APK) e a CSP com o navegador. Ele precisa das portas 80 e 443 livres.

## Trocar o IP por um domínio
1. **DNS:** um registro `A` do domínio (ou subdomínio) para o IP público da VM. Espere `dig +short <domínio>` devolver o IP.
2. **Antes de trocar, saiba o que para:** os QR impressos com o IP e o APK construído com o IP **param de funcionar no momento da troca** — o Caddy deixa de responder pelo IP (o certificado passa a ser só do domínio). Escolha um horário sem serviço e tenha a impressora pronta.
3. **Na VM, no `deploy/.env`:** `PUBLIC_URL=https://<domínio>`. Só essa linha.
4. **`deploy/deploy.sh`.** O painel é reconstruído com o link novo dos QR, o CORS segue o `PUBLIC_URL` e o Caddy pede o certificado do domínio ao Let's Encrypt (continua no perfil `shortlived`, renovado sozinho; tirar o `profile shortlived` do Caddyfile volta aos 90 dias, e é opcional).
5. **Confira de fora:** `curl -sI https://<domínio>/` (200, com `content-security-policy`), `curl -s https://<domínio>/api/health` (`{"ok":true}`), `https://<domínio>/painel/` no navegador.
6. **APK novo:** `VITE_PUBLIC_URL=https://<domínio> npm run build:android --workspace apps/dashboard` e o `gradlew assembleDebug` (README "APK do painel"). Instale nos aparelhos do restaurante.
7. **Reimprima todos os QR:** no painel, Mesas → QR das mesas → Imprimir. Os códigos das mesas não mudam, só o endereço; os impressos com o IP vão para o lixo.
8. Com domínio, vale ligar `Strict-Transport-Security` no Caddyfile (em IP o navegador ignora). Não está ligado hoje.

Se o IP mudar sem domínio (instância recriada sem IP reservado), são os mesmos passos 2 a 7 com o IP novo.
