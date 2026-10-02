# Checklist de segurança do deploy (VM Oracle + Supabase + Vercel)

Para o primeiro deploy na VM e para revisar depois de qualquer mudança na pilha. Cada item diz como conferir. O passo a passo do deploy está no README ("Deploy"); as razões, na [ADR 0010](../adr/0010-vm-com-docker-compose.md); os achados, em [auditoria-2026-10.md](auditoria-2026-10.md).

## 1. Conta e rede (Oracle Cloud)

- [ ] **Conta Pay As You Go com orçamento e alerta** (ADR 0010): Billing & Cost Management → Budgets, alerta por e-mail a qualquer gasto.
- [ ] **MFA** no login da Oracle e só as pessoas que precisam na tenancy.
- [ ] **IP público reservado** para a instância (um IP efêmero muda se ela for recriada, e os fronts e o APK apontam para ele).
- [ ] **Security List / NSG:** entrada só TCP 80 e 443 de `0.0.0.0/0` e TCP 22 **só do IP de quem administra** (não de `0.0.0.0/0`). Nenhuma outra porta.
- [ ] **SSH só com chave:** `sudo sshd -T | grep -E "passwordauthentication|permitrootlogin"` → `passwordauthentication no`, `permitrootlogin no` (o padrão das imagens da Oracle).
- [ ] **Firewall do sistema** igual à Security List: `sudo iptables -L INPUT -n` (Ubuntu da Oracle) ou `sudo firewall-cmd --list-all` (Oracle Linux) — 22, 80 e 443.
- [ ] **Atualizações automáticas de segurança do sistema:** `unattended-upgrades` (Ubuntu) ou `dnf-automatic` (Oracle Linux) ligados.
- [ ] **Docker sobe com a VM:** `systemctl is-enabled docker` → `enabled`. O usuário do deploy está no grupo `docker` (o grupo equivale a root na VM: só quem administra).

## 2. `deploy/.env`

- [ ] Copiado de `deploy/.env.example`, fora do git (`git status` não o mostra; o `.gitignore` cobre).
- [ ] **Permissão 600:** `stat -c '%a %U' deploy/.env` → `600 <usuário do deploy>`. O `deploy/deploy.sh` aplica a cada execução (SEG-A15).
- [ ] `NODE_ENV=production` (a API se recusa a subir em produção sem `JWT_SECRET` de 32+ e sem `CORS_ORIGINS`, e com `SUPER_ADMIN_KEY` curta).
- [ ] Segredos gerados na hora, nunca reaproveitados do dev: `JWT_SECRET` (`openssl rand -base64 48`), `SUPER_ADMIN_KEY` (`openssl rand -base64 32`), `EVOLUTION_API_KEY` e `WHATSAPP_WEBHOOK_SECRET` (`openssl rand -hex 32`).
- [ ] `CORS_ORIGINS` = as duas URLs exatas da Vercel (sem barra no fim) e `https://localhost` só se o APK do painel for usado.
- [ ] `DATABASE_URL` e `DIRECT_URL` = pooler do Supabase em modo **sessão** (porta 5432), usuário `postgres.<ref>`; a senha do banco é a do projeto de produção.
- [ ] `STORAGE_S3_*` = um par de chaves S3 criado em Storage → S3 Connection (não a `service_role`), e os buckets `cardapio` e `whatsapp-media`.

## 3. Supabase (projeto de produção)

No SQL Editor do projeto de produção, depois do primeiro `deploy/deploy.sh` (que aplica as migrações e cria os buckets):

- [ ] **RLS em todas as tabelas, nenhuma política:**
  ```sql
  select c.relname, c.relrowsecurity, (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as politicas
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' order by 1;
  ```
  Todas com `relrowsecurity = true` e `politicas = 0` (22 tabelas, `OrderEvent` incluída).
- [ ] **Nenhuma função no `public`:** `select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public';` → vazio.
- [ ] **Buckets:** `select id, public, file_size_limit, allowed_mime_types from storage.buckets;` → `cardapio` público, 8 MB, `image/png`, `image/jpeg`, `image/webp`; `whatsapp-media` **privado**, 8 MB, imagens e áudios.
- [ ] **Sem políticas em `storage.objects`:** `select policyname from pg_policies where schemaname = 'storage';` → vazio (sem a chave S3, ninguém lista nem grava).
- [ ] **Advisors → Security:** só "RLS Enabled No Policy" (INFO), que é o desejado.
- [ ] **Authentication:** o app não usa o Supabase Auth — desligar novos cadastros (Authentication → Sign In / Providers → "Allow new users to sign up" desligado). Mesmo um usuário criado lá não leria nada (RLS sem políticas), mas não há motivo para existirem.
- [ ] **MFA** na conta do Supabase e só as pessoas que precisam na organização.
- [ ] **Backups do Supabase** (plano): sabido o que o plano guarda; o backup da VM (seção 6) é o nosso.

## 4. Fronts na Vercel

- [ ] `VITE_API_URL=https://<IP da VM>` nos dois projetos, redeploy feito.
- [ ] **Cabeçalhos de segurança no ar** (SEG-A05): `curl -sI https://<painel>.vercel.app | grep -iE "content-security-policy|x-content-type-options|referrer-policy|x-frame-options"` → os quatro; o mesmo no cardápio.
- [ ] Abrir o painel e o cardápio no navegador com o console aberto: nenhuma mensagem "Refused to … Content Security Policy" (o `npm test` prova com o build local; isto confere o da Vercel).
- [ ] **MFA** na conta da Vercel; proteção dos previews (Deployment Protection) ligada, para os previews não ficarem abertos.

## 5. Depois do `deploy/deploy.sh`

- [ ] `curl -s https://<IP>/api/health` → `{"ok":true}`; `curl -sI http://<IP>/api/health` → `308` para `https://`.
- [ ] **Cabeçalhos da API** (SEG-A09): `curl -sI https://<IP>/api/health` mostra `x-content-type-options: nosniff`, `x-frame-options: DENY`, `content-security-policy: default-src 'none'; frame-ancestors 'none'`, `referrer-policy: no-referrer`, e **não** mostra `x-powered-by`.
- [ ] **Certificado do Let's Encrypt para o IP:** `echo | openssl s_client -connect <IP>:443 2>/dev/null | openssl x509 -noout -issuer -dates -ext subjectAltName` → emissor Let's Encrypt, SAN `IP Address:<IP>`.
- [ ] **Só o Caddy publica portas:** `docker compose -f deploy/docker-compose.prod.yml ps --format '{{.Service}} {{.Ports}}'` → só `caddy` com `80` e `443`. Na VM, `sudo ss -tlnp` → 22, 80 e 443 (e nada da Evolution, 8080, nem da API, 4100).
- [ ] **A Evolution não responde de fora:** `curl -s -m 5 http://<IP>:8080` → sem resposta; `curl -s https://<IP>/manager` → 404 da API.
- [ ] **Super admin:** a chave funciona em `/admin` do painel; uma chave errada → "invalid admin key".
- [ ] **Seed de demonstração** com a senha digitada uma vez (`SEED_DEMO_PASSWORD='…' deploy/deploy.sh seed-demo`), senha guardada num cofre; o seed de dev é recusado (`deploy/deploy.sh seed` → "Recusado").

## 6. Backups

- [ ] **Banco**, no dia seguinte ao deploy (depois das 04:00): `docker compose -f deploy/docker-compose.prod.yml logs backup | tail -3` → `backup: /backups/cardapio-AAAA-MM-DD.dump (…)`.
- [ ] **Storage** (E-4): `docker compose -f deploy/docker-compose.prod.yml logs storage-backup | tail -3` → `storage-backup: cardapio, N arquivos` e `whatsapp-media, N arquivos`.
- [ ] **Permissões:** `sudo stat -c '%a %U %n' deploy/backups/*.dump deploy/backups/storage/*` → arquivos `600 root`, pastas `700 root`.
- [ ] **Cópia fora da VM**, de vez em quando: `ssh <vm> "sudo tar -C cardapio-digital/deploy -czf - backups" > backups-$(date +%F).tgz` — guardar num lugar com acesso restrito (os dumps têm nomes e telefones de clientes; as fotos e áudios do WhatsApp também). Criptografar a cópia é a recomendação do SEG-A19.
- [ ] **Restauração ensaiada** uma vez (README, "Backup e restauração"): o dump num Postgres descartável e o Storage num bucket de teste.

## 7. Depois, de tempos em tempos

- [ ] `npm audit --omit=dev` nos workspaces; atualizar a versão fixa das imagens (Caddy, Node, Evolution, Postgres, rclone) com o teste do compose e o build arm64.
- [ ] Logs da API sem erros 500 repetidos: `docker compose -f deploy/docker-compose.prod.yml logs --since 24h api | grep -c "internal error\|Error"`.
- [ ] Trocar `JWT_SECRET` derruba todas as sessões (todo mundo entra de novo): fazer se houver suspeita de vazamento do `deploy/.env`, junto com as outras chaves.
- [ ] Uma pessoa saiu da equipe: enquanto o SEG-A06 estiver pendente, trocar a senha dela em Equipe & Permissões não fecha os aparelhos já logados (valem até 24 h). Para cortar na hora, o super admin reseta a senha dela: as sessões abertas param até a senha provisória ser trocada, e só o super admin a conhece.
