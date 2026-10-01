# 9. Pedido pelo QR: identidade da mesa, aceite do primeiro pedido e limites de requisição

Aceita · 30/09/2026 · revista em 01/10/2026 (D-4: na VM, o proxy confiável é o Caddy)

## Contexto
O QR da mesa levava `<restaurante>.<número>` e a API aceitava o número da mesa vindo do celular do cliente: qualquer pessoa, de qualquer lugar, podia pedir para qualquer mesa digitando números, e o primeiro pedido já abria a mesa e entrava na conta. Não havia nenhum limite de requisições. Para a demonstração, a API roda num PC comum atrás de um túnel da Cloudflare: toda requisição chega do próprio PC, com o IP do visitante no cabeçalho `CF-Connecting-IP`. No restaurante, clientes e garçons saem pelo mesmo IP do Wi-Fi; nos dados móveis, as operadoras compartilham IPs (CGNAT). O IP, sozinho, não identifica ninguém.

## Decisão

### 1. A mesa é identificada pelo código do QR
- Cada mesa tem um código próprio (`RestaurantTable.qrCode`): 244 bits aleatórios gerados pelo Postgres (dois `gen_random_uuid()`, que usam `pg_strong_random`), em base64url, 43 caracteres. É o default da coluna: mesas novas, seeds e as mesas existentes (na migração `9g_table_qr_code`) ganham o seu sem código nosso.
- O pedido do cliente leva `tableCode`; a API tira dele o restaurante e o número da mesa. Número de mesa vindo do cliente é ignorado. O pedido do garçom continua vindo da rota autenticada da mesa.
- **Gerar novo QR** (Dono e Administrador) volta o código ao default: o antigo para de abrir o cardápio e de pedir na mesma hora, inclusive nas folhas já impressas. A tela pede confirmação antes.
- A impressão fica em **Mesas → Imprimir QR** (todas as mesas) e em **Mesas → mesa → QR code** (uma): A4, duas por linha, com o nome do restaurante, "Mesa N" e "Aponte a câmera para pedir".

### 2. Aceite do primeiro pedido, pela situação da mesa
Sem configuração, só pela situação da mesa:

| Situação | Pedido do QR ou do tablet | Pedido do garçom |
| --- | --- | --- |
| Mesa livre (sem comanda aberta) | Entra na Central como **Aguardando aceite**, com o número da mesa em destaque. Não abre a mesa, não entra na comanda, não baixa estoque e não conta em relatório nenhum. | Entra em **Preparando** e abre a mesa. |
| Mesa aberta | Entra direto, como hoje (Recebido). | Entra em **Preparando**. |

- **Aceitar** abre a mesa e leva o pedido para o status inicial de um pedido do QR (Recebido), de onde segue o fluxo normal.
- **Recusar** marca o pedido como recusado; a mesa continua livre.
- Quem já muda o status de um pedido na Central aceita ou recusa.
- O cliente vê "Aguardando confirmação do restaurante" enquanto espera e, se recusado, "Pedido não confirmado. Chame o garçom."
- No fim do pedido pelo QR ou pelo tablet, as opções são só "Comer aqui (Mesa N)" e "Para levar". "Para levar" continua ligado à mesa, entra na comanda como qualquer item (inclusive na base do serviço), segue esta mesma regra e aparece em destaque para a Central e a cozinha. Delivery não aparece nesses canais.

### 3. Limites de requisição por quem está pedindo, não por IP
Todos os números ficam em `apps/api/src/lib/rateLimit.ts`, em janelas fixas, na memória do processo (a API roda numa instância só):

| Quem | Chave | Limite |
| --- | --- | --- |
| Funcionário logado | o usuário do token | 600 por minuto |
| Cliente na mesa (QR ou tablet) | a mesa (código do QR) | 900 por minuto; 40 pedidos a cada 5 minutos |
| Login e troca de senha | a conta | 5 senhas erradas em 15 minutos bloqueiam a conta até a janela acabar, venha de onde vier |
| Login | o IP | 50 tentativas a cada 15 minutos |
| Qualquer requisição | o IP | 15.000 por minuto, só contra inundação |

As contas partem do polling que existe no código:

- **Painel**: a Central de Pedidos consulta pedidos, chamados e turno a cada 4 s (45/min), e o menu lateral consulta pedidos, chamados e tickets a cada 15 s (12/min). São cerca de 57 por minuto por aparelho, a tela mais pesada. O limite de 600 comporta uns 10 aparelhos na Central com o mesmo login.
- **Cliente**: o status do pedido é consultado a cada 3 s enquanto espera (20/min) e a disponibilidade do cardápio a cada 12 s (5/min), mais os pratos abertos. São cerca de 30 por minuto por celular no pico. O limite de 900 por mesa comporta um grupo de 30 celulares. Os 40 pedidos em 5 minutos comportam um grupo de 20 pedindo junto, duas vezes.
- **Casa cheia num Wi-Fi só**: 40 mesas × 7 aparelhos × 25/min + 10 aparelhos da equipe × 57/min ≈ 7.600 por minuto. O teto de 15.000 por IP comporta isso duas vezes.

O IP real vem de `CF-Connecting-IP`, e esse cabeçalho só é aceito numa conexão vinda de um proxy confiável. De qualquer outro endereço vale o endereço da conexão, e o cabeçalho é ignorado.

- **Na VM** ([ADR 0010](0010-vm-com-docker-compose.md)): o proxy confiável é o Caddy, com endereço fixo na rede interna do Compose (`TRUSTED_PROXY=172.30.0.2`, em `deploy/docker-compose.prod.yml`). O Caddy **sobrescreve** o `CF-Connecting-IP` com o IP de quem conectou nele (`header_up CF-Connecting-IP {remote_host}`, em `deploy/Caddyfile`): o valor que o visitante mandar é descartado. Só o Caddy publica portas; a API não é alcançável de fora sem passar por ele, e uma conexão direta de qualquer outro endereço (inclusive a própria máquina) tem o cabeçalho ignorado.
- **Em dev e nos testes** (`TRUSTED_PROXY` vazia): o proxy confiável é a própria máquina (loopback), como era com o túnel da Cloudflare. A API escuta em `127.0.0.1` por padrão.
- **Webhook da Evolution**: a rota `/api/whatsapp/webhook` é montada antes do limitador e responde ali mesmo, autenticada pelo segredo (`x-webhook-secret`); ela não tem IP de cliente nem limite por IP, na VM e em dev.

Uma conexão de proxy confiável sem o cabeçalho é a própria máquina (em dev: alguém no PC, os testes): sem IP, o teto por IP e o de logins por IP não se aplicam a ela; o limite do funcionário, o da mesa, o dos pedidos da mesa e o bloqueio da conta valem do mesmo jeito (C-2). O `npm test` sobe o limite do funcionário para 3.000 por minuto (`STAFF_PER_MINUTE`), porque as suítes chamam a API com poucos logins, muito mais rápido que gente. Acima do limite, a resposta é 429 com `Retry-After` e a mensagem "Muitas tentativas em pouco tempo. Tente de novo em N s."

### 4. Risco aceito: o token do painel fica no `localStorage` por 24 h
O token de sessão do painel continua no `localStorage`, válido por 24 h, para durar um turno inteiro num tablet. Um XSS no painel poderia lê-lo. Aceitamos o risco nesta fase porque:
- a sessão é revogada a cada requisição: a API relê o papel, o status do restaurante e a senha provisória no banco. Desativar o restaurante, trocar o papel ou resetar a senha derruba a sessão no request seguinte;
- os vetores de XSS conhecidos foram fechados nesta rodada: logo, capa e fotos só aceitam PNG, JPEG ou WebP, reconhecidos pelos primeiros bytes (antes o logo aceitava SVG no bucket público); status e responsável do ticket e horários são validados; o React escapa o texto por padrão e o código não usa `dangerouslySetInnerHTML`.

Revisitar quando houver cookie `HttpOnly` com o painel e a API no mesmo domínio.

## Consequências
- Um QR impresso só vale para a mesa dele. Um QR vazado se corrige com "Gerar novo QR", ao custo de reimprimir aquela folha.
- Quem lê o QR de fora do restaurante não abre mesa nem gera conta: o pedido para em "Aguardando aceite" até alguém da equipe decidir.
- O primeiro pedido de uma mesa livre passa por dois toques na Central: **Aceitar** (abre a mesa) e depois o Aceitar de sempre (vai para Preparando). A regra seguiu o pedido de levar o aceito ao status inicial de um pedido do QR. Juntar os dois toques é uma mudança de uma linha, se for preferível.
- Os limites valem para uma instância. Se a API rodar em mais de um processo, os contadores precisam ir para o banco ou para um Redis.
- A API roda numa VM, atrás do Caddy ([ADR 0010](0010-vm-com-docker-compose.md)). Se um dia houver outro proxy na frente (CDN, balanceador), ele precisa entrar em `TRUSTED_PROXY` e o Caddy precisa passar adiante o IP que esse proxy informa; do contrário, todos os visitantes aparecem com o IP do proxy e dividem o mesmo teto.
