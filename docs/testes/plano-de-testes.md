# Plano de testes — salão, WhatsApp, produtos/estoque, financeiro e Super Admin

Escopo do cliente (hamburgueria): **salão e comandas** (QR da mesa, tablet, mapa do salão), **WhatsApp no Atendimento**, **produtos, estoque e ficha técnica**, **financeiro** (contas a pagar/receber, Visão Geral, DRE). Mais: login, troca obrigatória de senha, permissões, configurações e **Super Admin** (lista, detalhe, módulos, reset de senha, mensalidades).
Fora do escopo: Emissão Fiscal e delivery próprio. Só entram para conferir que o módulo desligado some do menu e a API responde 403.

## 1. Como usar este arquivo

**Automático:** `npm test` roda tudo (API + telas) num Postgres descartável. `npm run carga` roda a casa cheia (cenário em `tests/load/cenario.mjs`) num Postgres descartável e `npm run carga -- supabase`, no banco do `apps/api/.env` (o projeto Supabase de testes); nenhum dos dois entra no `npm test` nem no CI. A coluna **Auto** de cada caso diz onde ele está na suíte:

| Sigla | Arquivo |
| --- | --- |
| `api:salao` | `tests/api/salao.test.ts` |
| `api:cardapio` | `tests/api/cardapio.test.ts` |
| `api:financeiro` | `tests/api/finance-auth.test.ts` |
| `api:sessao` | `tests/api/sessao.test.ts` |
| `api:estoque` | `tests/api/stock.test.ts` |
| `api:perm` | `tests/api/permissions.test.ts`, `tests/api/modules.test.ts` |
| `api:admin` | `tests/api/admin.test.ts` |
| `api:zap` | `tests/api/whatsapp.test.ts` |
| `api:seed` | `tests/api/demo-seed.test.ts` |
| `api:grandes` | `tests/api/listas-grandes.test.ts` |
| `api:robustez` | `tests/api/robustez.test.ts` |
| `api:garcom` | `tests/api/garcom.test.ts` |
| `api:seguranca` | `tests/api/seguranca.test.ts` |
| `api:limites` | `tests/api/limites.test.ts` (rate limiting) |
| `api:icones` | `tests/api/icones.test.ts` (ícones locais, sem CDN) |
| `api:autorizacao` | `tests/api/autorizacao.test.ts` (todas as rotas do Express: sem token, outro restaurante, papel, módulo) |
| `api:eventos` | `tests/api/eventos.test.ts` (histórico do pedido, `OrderEvent`) |
| `api:descoberta` | `tests/api/descoberta.test.ts` (lista do app do cliente e o módulo Delivery) |
| `api:moeda` | `tests/api/moeda.test.ts` (o formatador de dinheiro dos dois apps) |
| `api:cupom` | `tests/api/cupom.test.ts` (cupom do delivery pelas regras de Promoções) |
| `api:sessoes` | `tests/api/sessoes.test.ts` (troca e reset de senha encerram as sessões) |
| `api:fechado` | `tests/api/fechado.test.ts` (pedido de comanda paga não muda de status) |
| `e2e:fluxo` | `tests/e2e/fluxo-critico.spec.ts` |
| `e2e:varredura` | `tests/e2e/varredura.spec.ts` (3 tamanhos × 2 temas) |
| `e2e:desktop` / `e2e:mobile` | `tests/e2e/desktop.spec.ts` / `tests/e2e/mobile.spec.ts` |
| `e2e:dialogos` | `tests/e2e/dialogos.spec.ts` (acessibilidade de diálogos, folhas e formulários; desktop e celular × 2 temas) |
| `e2e:csp` | `tests/e2e/csp.spec.ts` (os dois apps no build de produção com os cabeçalhos do `vercel.json`) |
| `carga` | `tests/load/pico.mjs` (casa cheia), `tests/load/cardapio.mjs` (Lighthouse), `tests/load/painel.spec.ts` (pedido → Central nas telas) |
| **M** | manual (roteiro abaixo) |

**Manual:** rode o seed de demonstração num banco local (`npm run db:seed:demo --workspace apps/api`), suba API, dashboard e cardápio (README), e siga os passos. Logins do Chapa 27, todos com a senha do seed:

| Papel | E-mail |
| --- | --- |
| Dono | `dono@chapa27.example` |
| Administrador | `gerente@chapa27.example` |
| Funcionário · Garçom | `garcom@chapa27.example` |
| Funcionário · Cozinha | `cozinha@chapa27.example` |

Cardápio do cliente pela mesa: no painel, **Mesas → selecione a mesa → QR code** abre a folha da mesa; **Copiar link** dá `…/t/<código da mesa>` (43 caracteres aleatórios, um por mesa). **Mesas → Imprimir QR** mostra as folhas de todas as mesas, prontas para imprimir em A4.

**Coluna Resultado:** última rodada — 27/09/2026; 29/09/2026 para Lançar pedido, categorias, ajuste de estoque e adicionais com estoque; 30/09/2026 para os casos da rodada "Prompt A" (dados, segurança, pedido pelo QR, cards parciais — seção 6); 01/10/2026 para a rodada "Prompt C" (seção 6) e para a rodada "Prompt D", o deploy na VM (seção 7, "Rodada D"); 02/10/2026 para a rodada "Prompt E", segurança, histórico do pedido, lista do delivery e backup do Storage (seções 4.18 a 4.20 e 7, "Rodada E"), e para a rodada "Prompt F", as decisões da auditoria (SEN-07/08, PED-17, MES-18/19, DESC-04/05, CUP-01 a 04; seção 7, "Rodada F"). ✅ passou · ✅ M passou no roteiro manual · ✅ corrigido (B##) falhou e foi corrigido nesta rodada · ❌ P2-## falha cosmética registrada, não corrigida · ⏳ depende de aparelho ou do ambiente hospedado.

**Tamanhos de tela:** desktop 1366×820, tablet em paisagem 1280×800 (toque), celular 390×844 (toque). **Temas:** claro e escuro (botão de tema no menu lateral ou na aba Mais). Em cada tela, o mínimo é: nada vaza para fora da tela (sem rolagem horizontal da página), textos legíveis nos dois temas, sem erro no console e sem chamada da API com erro.

## 2. Matriz de acesso (funcionalidade × papel)

✔ = vê e usa · 👁 = só vê · — = não aparece no menu e a API responde 403 · 🔑 = só com a chave de Super Admin.

| Funcionalidade | Dono | Administrador | Garçom | Cozinha |
| --- | --- | --- | --- | --- |
| Central de Pedidos (aceitar, recusar, avançar) | ✔ | ✔ | ✔ | ✔ |
| Mesas: mapa, comanda, transferir, QR | ✔ | ✔ | ✔ | ✔ |
| Mesas: fechar conta (F-4) | ✔ | ✔ | ✔ | — |
| Mesas: editar ambiente (grade, nova mesa, renumerar, mover, excluir) (F-4) | ✔ | ✔ | — | — |
| Lançar pedido (o garçom faz o pedido pela mesa) | ✔ | ✔ | ✔ | ✔ |
| Cardápio: ver e marcar Esgotado/Disponível | ✔ | ✔ | ✔ | ✔ |
| Cardápio: adicionar, organizar, remover, reordenar, foto; categorias | ✔ | ✔ | 👁 | 👁 |
| Atendimento (tickets, WhatsApp, avaliações) | ✔ | ✔ | ✔ | — |
| Produtos (catálogo, ficha técnica, XML, ajuste manual, movimentações) | ✔ | ✔ | — | — |
| Relatórios | ✔ | ✔ | — | — |
| Visão Geral · Resumo | ✔ | ✔ | — | — |
| Visão Geral · DRE | ✔ | — | — | — |
| Contas a Pagar / a Receber (lançar, quitar, excluir) | ✔ | ✔ | — | — |
| Minha Fatura | ✔ | ✔ | — | — |
| Configurações (menu) | ✔ | — | — | — |
| Configurações → Equipe & Permissões, WhatsApp (conectar) | ✔ | — | — | — |
| Configurações → Salão (pedido pelo QR, serviço 10%) | ✔ | — | — | — |
| Emissão Fiscal (módulo desligado no Chapa 27) | — | — | — | — |
| Super Admin (`/admin`) | 🔑 | 🔑 | 🔑 | 🔑 |

Módulo desligado pelo Super Admin: some do menu de todos os papéis e a API responde 403 já no próximo request.

## 3. Matriz de telas (tela × tamanho × tema)

Todas as células são cobertas pela varredura automática (`e2e:varredura`: abre a tela com cada papel que a enxerga, nos 3 tamanhos e nos 2 temas, e falha se a página rolar na horizontal, se houver erro de JavaScript ou se alguma chamada da API voltar com erro). A conferência visual (contraste, cortes, sobreposição) é **M**.

| Tela | Rota | Papéis | Desktop claro/escuro | Tablet claro/escuro | Celular claro/escuro |
| --- | --- | --- | --- | --- | --- |
| Login | `/` | todos | A+M | A+M | A+M |
| Troca de senha provisória | `/` | todos | A+M | A+M | A+M |
| Central de Pedidos | `/` | todos | A+M | A+M | A+M |
| Mesas (mapa + comanda) | `/mesas`, `/mesas/:n` (celular) | todos | A+M | A+M | A+M |
| Lançar pedido | `/mesas/:n/pedido` | todos | A+M | A+M | A+M |
| Cardápio | `/cardapio` | todos | A+M | A+M | A+M |
| Atendimento | `/atendimento` | Dono, Adm, Garçom | A+M | A+M | A+M |
| Produtos | `/produtos` | Dono, Adm | A+M | A+M | A+M |
| Relatórios | `/relatorios` | Dono, Adm | A+M | A+M | A+M |
| Visão Geral (+DRE) | `/visao-geral` | Dono, Adm | A+M | A+M | A+M |
| Contas a Pagar | `/contas-a-pagar` | Dono, Adm | A+M | A+M | A+M |
| Contas a Receber | `/contas-a-receber` | Dono, Adm | A+M | A+M | A+M |
| Minha Fatura | `/financeiro` | Dono, Adm | A+M | A+M | A+M |
| Configurações (inclui Salão) | `/config` (+ subtelas no celular, `/config/salao`) | Dono | A+M | A+M | A+M |
| Super Admin: lista, detalhe, mensalidades | `/admin…` | chave | A+M | A+M | A+M |
| Cardápio do cliente (QR/tablet) | `apps/web` `/t/:código`, `/r/:id/menu` | cliente | A+M | A+M | A+M |

## 4. Casos de teste

Formato: **ID · caso · papel · passos e dados · esperado · Auto**. "Qualquer" = qualquer papel que vê a tela.

### 4.1 Login e sessão (AUT)

| ID | Caso | Papel | Passos e dados | Esperado | Auto | Resultado |
| --- | --- | --- | --- | --- | --- | --- |
| AUT-01 | Login correto | todos | E-mail e senha do seed | Entra no painel; menu conforme a matriz de acesso | e2e:desktop, api:seed | ✅ |
| AUT-02 | E-mail com maiúsculas e espaços | Dono | ` DONO@Chapa27.example ` | Entra (e-mail normalizado) | api:sessao | ✅ |
| AUT-03 | Senha errada | — | Senha `errada` | Não entra; mensagem em português | api:sessao, M | ❌ P2-01 |
| AUT-04 | Campos vazios | — | Enviar sem preencher | O navegador pede o campo; a API responde 400 se chamada direto | api:sessao | ✅ |
| AUT-05 | Restaurante inativo | Dono | Super Admin desativa; tentar logar | Não entra: "Este restaurante não está ativo" | api:admin | ✅ |
| AUT-06 | Sessão vale 24 h | todos | Token emitido há 23 h funciona; com mais de 24 h, 401 | Token expira em 24 h | api:sessao | ✅ (era 12 h; decisão: 24 h) |
| AUT-07 | Sessão expirada no meio do uso | qualquer | Com o painel aberto, o token vence (ou é revogado) | Volta sozinho para a tela de login; nunca fica com a Central vazia | e2e:desktop | ✅ corrigido (B06) |
| AUT-08 | Token adulterado ou de outro sistema | — | `Authorization: Bearer abc` | 401 | api:sessao | ✅ |
| AUT-09 | Duplo clique em Entrar | qualquer | Clicar duas vezes rápido | Um único login; botão desabilitado enquanto entra | M | ✅ M |
| AUT-10 | API fora do ar no login | — | Parar a API e tentar entrar | "Não foi possível conectar ao servidor" | M | ✅ M |
| AUT-11 | Sair | qualquer | Celular: Mais → Sair; desktop: menu → Sair | Volta ao login; o token some do aparelho | M | ✅ corrigido (B10) |
| AUT-12 | 5 senhas erradas bloqueiam a conta | — | 5 tentativas erradas de um IP; a 6ª de outro IP; depois a senha certa | 401 ×5; 429 "Muitas tentativas… Tente de novo em N min" na 6ª e na certa, venha de onde vier; outra conta entra normalmente | api:limites | ✅ (novo) |
| AUT-13 | Teto de tentativas de login por IP | — | 51 tentativas em 15 min do mesmo IP (contas diferentes) | A 51ª recebe 429 | api:limites | ✅ (novo) |
| AUT-14 | Senha de pelo menos 8 caracteres | Dono, qualquer | Cadastro na Equipe, troca pelo Dono, troca da própria senha com 7 caracteres | 400 e aviso "pelo menos 8 caracteres"; com 8, salva; o reset gera provisória de 12 | api:perm, M | ✅ (novo; era 6) |

### 4.2 Troca obrigatória de senha (SEN)

| ID | Caso | Papel | Passos e dados | Esperado | Auto | Resultado |
| --- | --- | --- | --- | --- | --- | --- |
| SEN-01 | Primeiro login com senha provisória | Dono novo | Super Admin cadastra; ativa; Dono entra com a provisória | Só aparece "Crie sua senha" | api:admin, e2e:desktop | ✅ + M |
| SEN-02 | Provisória errada na troca | Dono novo | Senha provisória diferente | "A senha provisória não confere" | api:admin | ✅ |
| SEN-03 | Nova senha curta ou igual | Dono novo | `123`; ou igual à provisória | Mensagens de 8 caracteres / "precisa ser diferente" | api:admin, api:perm | ✅ |
| SEN-04 | Repetição diferente | Dono novo | Nova ≠ repetida | "As duas senhas novas não são iguais" | M | ✅ M |
| SEN-05 | Até trocar, nada mais funciona | Dono novo | Chamar qualquer rota com o token | 403 "password change required" | api:admin | ✅ |
| SEN-06 | Reset derruba sessão aberta | Garçom | Super Admin reseta a senha com o garçom logado | Próximo request 403 → só a troca | api:admin | ✅ |
| SEN-07 | Troca ou reset de senha por outra pessoa encerra as sessões | Dono, Super Admin | Garçom logado em 2 aparelhos; o Dono troca a senha dele em Equipe (ou o Super Admin reseta) | Os 2 aparelhos recebem 401 na próxima requisição (voltam ao login); a senha nova entra; mudar só nome ou papel não derruba ninguém; depois do reset as sessões antigas não voltam nem com a provisória trocada | api:sessoes, api:admin | ✅ (novo, F-2) |
| SEN-08 | A própria pessoa troca a senha | qualquer | Logado em 2 aparelhos, troca a senha num deles (troca obrigatória, ou o Dono editando a própria senha em Equipe) | Este aparelho segue logado (recebe um token novo); o outro cai | api:sessoes, e2e:desktop | ✅ (novo, F-2) |

### 4.3 Permissões e módulos (PER)

| ID | Caso | Papel | Passos e dados | Esperado | Auto | Resultado |
| --- | --- | --- | --- | --- | --- | --- |
| PER-01 | Menu por papel | todos | Logar com cada papel | Exatamente a matriz da seção 2 | e2e:desktop, e2e:mobile | ✅ |
| PER-02 | Rota direta proibida | Garçom | Abrir `/produtos` pela URL | Mensagem "Você não tem permissão"; a API responde 403 | e2e:varredura, api:perm | ✅ + M |
| PER-03 | Outro restaurante | Dono Chapa 27 | Chamar `/api/restaurants/fogo/...` | 403 | api:perm | ✅ |
| PER-04 | Rebaixar papel vale no próximo request | Dono | Equipe: garçom → cozinha | Atendimento some; API 403 sem novo login | api:perm | ✅ |
| PER-05 | Dono não muda o próprio papel | Dono | Editar a si mesmo | Seletor desabilitado; API 400 | api:perm | ✅ |
| PER-06 | Administrador não gerencia equipe | Adm | POST staff | 403 | api:perm | ✅ |
| PER-07 | Módulo desligado some e dá 403 | Dono | Super Admin desliga Mesas | Some do menu; API 403 no próximo request | api:perm, e2e:desktop | ✅ |
| PER-08 | Emissão Fiscal desligada no Chapa 27 | Dono | Menu Financeiro | Sem "Emissão Fiscal"; `/closed-orders` 403 | api:seed, api:perm | ✅ |
| PER-09 | Cozinha fora do Atendimento | Cozinha | Menu; `/tickets` | Sem Atendimento; 403 | api:perm | ✅ |
| PER-10 | Esgotado por Funcionário | Garçom, Cozinha | Cardápio → chave de um prato | Troca Disponível/Esgotado; os outros botões não aparecem | api:cardapio, e2e:desktop | ✅ (decisão: novo) |
| PER-11 | Funcionário não edita prato | Garçom | PATCH item (descrição, preço) | 403 | api:cardapio | ✅ |

### 4.4 Cardápio do cliente — QR da mesa e tablet (QR)

| ID | Caso | Papel | Passos e dados | Esperado | Auto | Resultado |
| --- | --- | --- | --- | --- | --- | --- |
| QR-01 | QR abre o restaurante certo | cliente | Link da Mesa 12 do Chapa 27 | Cardápio do Chapa 27, modo mesa, Mesa 12 | api:salao, e2e:fluxo | ✅ corrigido (B01) |
| QR-02 | QR de mesa que não existe | cliente | `/t/chapa27.99`, `/t/12`, código cortado ou em minúsculas | "Mesa não encontrada" | api:salao | ✅ |
| QR-03 | QR de restaurante inativo ou inexistente | cliente | Código de uma mesa de restaurante inativo | "Mesa não encontrada" | api:salao | ✅ |
| QR-04 | Carregamento do cardápio | cliente | Abrir pelo QR | Categorias e 30 itens; LCP até 2,5 s no Lighthouse em modo celular (decisão de 01/10) | carga | ✅ corrigido (C-1): LCP 2,21 s local · 2,34 s Supabase (era 3,03 · 3,18 s); a API responde em p95 ≤ 0,31 s (CARGA-03) |
| QR-05 | Item com opções obrigatórias | cliente | Cheddar & Bacon: ponto "Bem passado" + Bacon extra | Preço 38,90 + 6,00 = 44,90 | api:salao, e2e:fluxo | ✅ |
| QR-06 | Observação com acento e emoji | cliente | "sem cebola, pão bem tostado 🍔" | Chega igual na Central | e2e:fluxo | ✅ |
| QR-07 | Observação longa | cliente | 301 caracteres | Campo limita a 300; API 400 acima | api:salao | ✅ |
| QR-08 | Nome do cliente longo | cliente | 121 caracteres | Campo limita a 120; API 400 acima | api:salao | ✅ |
| QR-09 | Preço adulterado | cliente | Enviar opção com `priceDelta` falso | Servidor recalcula; vale o preço do cardápio | api:salao | ✅ |
| QR-10 | Item de outro restaurante ou inexistente | cliente | `itemId` do fogo no pedido do Chapa 27 | 400 | api:salao | ✅ |
| QR-11 | Item esgotado | cliente | Cozinha marca Batata Frita esgotada; cliente pede | Some/fica indisponível em até 12 s; API recusa com "esgotado" | api:salao, M | ✅ M (12 s) |
| QR-12 | Carrinho vazio / sem linhas | cliente | POST sem linhas | 400; botão de envio desabilitado | api:salao | ✅ |
| QR-13 | Quantidade inválida | cliente | quantidade 0, -3, 2,7 | Vira 1, 1 e 2 | api:salao | ✅ |
| QR-14 | Duplo toque em "Confirmar e enviar" | cliente | Tocar duas vezes | Um único pedido | M | ✅ M |
| QR-15 | Chamar garçom | cliente | Na tela do pedido | Chamado aparece na Central (lateral) | api:salao | ✅ |
| QR-16 | Rodadas da mesma mesa | cliente | Dois pedidos seguidos no mesmo aparelho | Rodada 1 e 2; ambos na mesma comanda | api:salao | ✅ |
| QR-17 | Duas pessoas na mesma mesa | clientes | Dois celulares na Mesa 5 pedem juntos | Os dois pedidos na mesma comanda | api:salao | ✅ |
| QR-18 | API fora do ar | cliente | Parar a API e enviar | "Não foi possível conectar ao servidor"; carrinho mantido | M | ✅ corrigido (B19) |
| QR-21 | QR impresso com o pedido pelo QR desligado | cliente | Abrir o QR da Mesa 3 com a opção desligada | "Neste restaurante os pedidos são feitos pelo garçom. É só chamar um atendente." | api:garcom, e2e:desktop | ✅ |
| QR-19 | Tema claro/escuro e cor da marca | cliente | Alternar tema | Legível nos dois; botões na cor da marca | M | ✅ M |
| QR-20 | Erro ao confirmar aparece na revisão | cliente | Item esgota enquanto o cliente revisa; confirmar | Aviso "… está esgotado"; carrinho mantido | e2e:fluxo | ✅ corrigido (B19) |
| QR-22 | Cada mesa tem o próprio código aleatório | Garçom | Mesas → QR code das 30 mesas | 30 códigos diferentes, 43 caracteres base64url, cada um abre a sua mesa | api:salao, e2e:fluxo | ✅ (novo, A-3.1) |
| QR-23 | Pedir pelo número da mesa não vale | — | POST de pedido com `tableNumber` e sem código; código de mesa de outro restaurante | 404 "Mesa não encontrada. Leia o QR da mesa de novo…" | api:salao | ✅ (novo) |
| QR-24 | Mesa livre: o primeiro pedido espera o aceite | cliente + Cozinha | Mesa 23 livre; cliente pede pelo QR | Cliente vê "Aguardando confirmação do restaurante"; a mesa continua Livre; nada na comanda nem nos relatórios; na Central, "Aguardando aceite" com "Mesa 23" grande | api:salao, e2e:fluxo | ✅ (novo, A-3.3) |
| QR-25 | Aceitar abre a mesa | Cozinha | Aceitar o pedido da QR-24 | Mesa Ocupada; o pedido vai para Recebido; o cliente passa a ver "Pedido recebido pela cozinha" em até 3 s | api:salao, e2e:fluxo | ✅ (novo) |
| QR-26 | Recusar o primeiro pedido | Garçom | Mesa 24 livre; cliente pede; Recusar | Cliente vê "Pedido não confirmado. Chame o garçom."; a mesa continua Livre; o pedido não pode ser aceito depois | api:salao, e2e:fluxo | ✅ (novo) |
| QR-27 | Mesa aberta: o pedido entra direto | cliente | Segundo pedido na Mesa 23 depois do aceite | Entra em Recebido, na comanda, sem esperar | api:salao, e2e:fluxo | ✅ (novo) |
| QR-28 | Fim do pedido: Comer aqui ou Para levar | cliente | Revisão do pedido na mesa | Só "Comer aqui (Mesa N)" (marcado) e "Para levar"; nenhuma menção a entrega | e2e:fluxo | ✅ (novo, A-3.4) |
| QR-29 | Para levar entra na conta da mesa | cliente + Cozinha | Pedir "Para levar" | Card com "PARA LEVAR" em destaque; entra na comanda e na base do serviço; segue a regra da mesa livre | api:salao, e2e:fluxo | ✅ (novo) |
| QR-30 | Delivery não aparece na mesa | cliente | Na mesa, abrir `/`, `/history` ou um caminho qualquer | Volta para o cardápio da mesa | e2e:fluxo | ✅ (novo) |
| QR-31 | Sessão do aparelho | — | Listar pedidos sem `X-Session-Id`, com "anonymous" ou com outro aparelho | 400 / 400 / lista vazia; o pedido de um aparelho só é lido e só chama o garçom por ele | api:seguranca, api:salao | ✅ (novo) |

### 4.4b Lançar pedido: o garçom faz o pedido pela mesa (GAR)

| ID | Caso | Papel | Passos e dados | Esperado | Auto | Resultado |
| --- | --- | --- | --- | --- | --- | --- |
| GAR-01 | Lançar pelo celular | Garçom | Mesas → Mesa 8 (livre) → Lançar pedido → 2× Refrigerante lata, Cheddar & Bacon (Bem passado + Bacon extra, "sem cebola") → Revisar e enviar | R$ 58,90; aviso "Pedido da Mesa 08 enviado"; volta para a mesa; o pedido já entra em Preparando (não precisa aceitar) | e2e:mobile, api:garcom | ✅ |
| GAR-02 | Aparece na Central com o nome de quem lançou | Cozinha | Após GAR-01 | Card "Mesa 08" em Preparando com a tag "Lançado no estabelecimento", "Diego Alves", opções e observação; entra na comanda | api:garcom, e2e:mobile | ✅ |
| GAR-03 | Item com opções abre a escolha com o padrão marcado | Garçom | Tocar num lanche | Folha com "Ponto da carne" já em "Ao ponto"; um toque em Adicionar basta | e2e:mobile | ✅ |
| GAR-04 | Item sem opções soma direto | Garçom | Tocar 2× em Refrigerante | Contador 2 no item; total atualizado | e2e:mobile | ✅ |
| GAR-05 | Mesmas regras do pedido pelo QR | Garçom | Item esgotado, carrinho vazio, observação de 301 caracteres, mesa que não existe, sem login | 400/400/400/404/401 | api:garcom | ✅ |
| GAR-06 | Duplo toque em Enviar | Garçom | Dois toques rápidos | Um pedido só | e2e:mobile | ✅ |
| GAR-07 | Rodadas | Garçom | Segundo pedido na mesma mesa | Rodada 2; os dois na comanda | api:garcom | ✅ |
| GAR-08 | Mesas desligado | Garçom | Super Admin desliga Mesas | 403 | api:garcom | ✅ |
| GAR-09 | Tablet e desktop | Garçom | Mesas → selecionar mesa → Lançar pedido | Grade de pratos; barra de total fixa; volta com a mesa selecionada | e2e:varredura, M | ✅ M |
| GAR-11 | Só os garçons pedem (QR desligado) | Dono | Configurações → Salão → desligar "Clientes pedem pelo QR da mesa" | Mesas sem o botão QR code; o garçom lança normalmente; pedido do cliente na mesa → 403; delivery não muda | api:garcom, e2e:desktop | ✅ |
| GAR-10 | Barra de total sempre visível | Garçom | Rolar a lista até o fim (celular) | "Revisar e enviar" continua na tela | e2e:mobile | ✅ |

### 4.5 Central de Pedidos (PED)

| ID | Caso | Papel | Passos e dados | Esperado | Auto | Resultado |
| --- | --- | --- | --- | --- | --- | --- |
| PED-01 | Pedido novo aparece | todos | Cliente pede na Mesa 3 | Card em "Recebido" em até 5 s | e2e:fluxo, carga | ✅ local p95 4,0 s · ❌ Supabase p95 5,5 s (CARGA-02, rodada C; a causa e a correção sugerida na seção 7, C-4) |
| PED-02 | Card mostra opções e observação | Cozinha | Pedido com ponto + adicional + obs | Card mostra "Bem passado · Bacon extra" e "Obs: …" | e2e:fluxo | ✅ corrigido (B07) |
| PED-03 | Aceitar | Cozinha | Aceitar | Vai para "Preparando" | e2e:fluxo | ✅ |
| PED-04 | Recusar | Garçom | Recusar | Sai da Central (não aparece como entregue); some da comanda | api:salao, e2e:desktop | ✅ corrigido (B11) |
| PED-05 | Avançar etapas | Cozinha | Preparar → Marcar pronto → Entregar | Recebido → Preparando → Pronto → Servido | e2e:fluxo | ✅ |
| PED-06 | Arrastar entre colunas | Cozinha | Arrastar card para "Pronto" | Mesmo efeito do botão | M | ✅ M |
| PED-07 | Dois aparelhos aceitam o mesmo pedido | Cozinha + Garçom | Aceitar ao mesmo tempo | Um aceita; o outro recebe "não foi possível" e atualiza | api:salao | ✅ corrigido (B20) |
| PED-08 | Filtros Todos/Mesa | qualquer | Filtrar | Contadores batem com os cards | M | ✅ M |
| PED-09 | Chamado de garçom | Garçom | "atender" | Some da lista | api:salao, M | ✅ M |
| PED-10 | Turno de hoje | Adm | Após fechar comandas | Pedidos fechados e faturamento batem com as comandas | e2e:fluxo | ✅ |
| PED-11 | API fora do ar | Cozinha | Derrubar a rede com a Central aberta | Aviso "Sem conexão"; os cards continuam na tela; volta sozinho | e2e:desktop | ✅ corrigido (B12) |
| PED-12 | Lista grande | Cozinha | 120 pedidos no dia | Central abre e rola sem travar | api:grandes, M | ✅ + M |
| PED-13 | Tablet em paisagem | Cozinha | 1280×800 | 4 colunas utilizáveis; botões com área de toque | e2e:varredura, M | ✅ corrigido (B18) |
| PED-15 | Pedido aguardando aceite | Cozinha | Primeiro pedido de mesa livre na Central (desktop e celular) | Em Recebido, com "Aguardando aceite" e "Mesa N" em destaque; não arrasta para outra coluna; a API recusa mudar a etapa antes do aceite (409) | api:salao, e2e:fluxo | ✅ (novo) |
| PED-16 | Duas etapas no primeiro pedido | Cozinha | Aceitar (abre a mesa) e depois Aceitar de novo (Preparando) | Fluxo do pedido: aguardando → Recebido → Preparando | e2e:fluxo | ✅ (novo; ver A-3.3 na seção 6) |
| PED-14 | Aceitar e recusar o mesmo pedido juntos | Cozinha + Garçom | Um aceita enquanto o outro recusa | Só um vale; o outro recebe "não foi possível"; o pedido está na comanda se e só se não foi recusado | api:salao | ✅ corrigido (B20) |
| PED-17 | Pedido de comanda paga não muda de status | Dono | Fechar a comanda; mover o pedido para cancelado, preparando, pronto, servido; aceitar; recusar | 409 "Comanda já fechada: o status deste pedido não muda mais."; Relatórios e Contas a Receber iguais; na Central o cartão não arrasta | api:fechado | ✅ corrigido (F-3, SEG-A07: antes, "cancelado" era aceito) |

### 4.6 Mesas: mapa, comanda, fechamento e transferência (MES)

| ID | Caso | Papel | Passos e dados | Esperado | Auto | Resultado |
| --- | --- | --- | --- | --- | --- | --- |
| MES-01 | Mapa do salão | qualquer | Abrir Mesas | 30 mesas na grade 11×11; legenda Livre/Ocupada/Aguardando | api:seed, e2e:varredura | ✅ |
| MES-02 | Status da mesa | qualquer | Pedido na Mesa 4; servir tudo | Livre → Ocupada → Aguardando pagamento | api:salao | ✅ |
| MES-03 | Comanda em tempo real | Garçom | Mesa aberta na tela; cliente pede de novo | Comanda atualiza sozinha (até 10 s) | e2e:desktop | ✅ corrigido (B03) M |
| MES-04 | Fechar conta com maquininha | Garçom | Fechar conta → Cartão → Confirmar | Mesa livre; lançamento pago em Contas a Receber com o valor cobrado e a forma | api:salao, e2e:fluxo | ✅ corrigido (B16) |
| MES-05 | Serviço 10% ligado/desligado | Dono | Configurações → Financeiro → Serviço | Ligado: comanda soma 10% e o lançamento sai com ele; desligado: sem a linha de serviço | api:salao, e2e:desktop | ✅ (decisão: novo) |
| MES-06 | Centavos e arredondamento | Garçom | 3× Refrigerante (7,00) + 1× Chope (11,90) + serviço | 32,90 + 3,29 = 36,19 | api:salao | ✅ |
| MES-07 | Duplo clique em Confirmar pagamento | Garçom | Clicar duas vezes | Um fechamento, uma baixa de estoque, um lançamento | api:salao | ✅ |
| MES-08 | Dois garçons fecham a mesma mesa | 2 Garçons | Fechar ao mesmo tempo | Um fecha; o outro não duplica nada | api:salao | ✅ |
| MES-09 | Pedido chega enquanto fecham | Garçom + cliente | Garçom abre o fechamento; cliente pede; garçom confirma | Fecha só o que o garçom viu; o pedido novo fica na mesa, que segue ocupada | api:salao | ✅ corrigido (B03) |
| MES-10 | Transferir para mesa livre | Garçom | Mesa 7 → Mesa 8 | Itens na 8; 7 livre; nada da comanda anterior da Mesa 8 volta | api:salao | ✅ corrigido (B02) |
| MES-11 | Transferir e fechar ao mesmo tempo | 2 Garçons | Um transfere 7→8 enquanto outro fecha a 7 | Nenhum pedido é cobrado duas vezes nem some | api:salao | ✅ corrigido (B02) |
| MES-12 | Divisão por pessoa/item | Garçom | Dividir por 3 | Valores somam o total (centavo no último) | M | ✅ M |
| MES-13 | QR code da mesa | Garçom | Mesa → QR code → Copiar link | Folha da mesa; o link `…/t/<código>` é copiado | e2e:fluxo, e2e:desktop | ✅ |
| MES-18 | Imprimir QR de todas as mesas | Dono | Mesas → Imprimir QR → Imprimir | 30 folhas (restaurante, "Mesa N", QR, "Aponte a câmera para pedir"); no papel, só as folhas, A4 com duas por linha | e2e:desktop | ✅ (novo, A-3.5) |
| MES-19 | Gerar novo QR | Dono, Adm | Mesa → QR code → Gerar novo QR → confirmar | Pede confirmação ("As folhas impressas desta mesa deixarão de funcionar"); o QR na tela muda; o link antigo mostra "Mesa não encontrada"; garçom e cozinha não veem o botão (API 403) | api:salao, e2e:desktop | ✅ (novo, A-3.2) |
| MES-20 | Fechamento grava serviço junto | Garçom | Fechar comanda de 20 pedidos enquanto a Emissão Fiscal é consultada | A fila nunca mostra a comanda fechada sem o serviço | api:financeiro | ✅ corrigido (A-1.1) |
| MES-14 | Editar ambiente | Adm | Grade 13×13, nova mesa, arrastar, renomear, excluir | Posições salvas; mesa aberta não pode ser renomeada/excluída (409) | M | ✅ M |
| MES-15 | Fechar conta no celular | Garçom | Mesa → Fechar conta | Pede a forma de pagamento antes de fechar; lançamento em Contas a Receber | e2e:mobile | ✅ corrigido (B15) |
| MES-16 | Mesa sem pedidos | Garçom | Fechar conta em mesa livre | Botão desabilitado | M | ✅ M |
| MES-17 | Mesas diferentes fecham ao mesmo tempo | 10 Garçons | 10 mesas com Clássico, Cheddar & Bacon, batata e onion rings (ordem alternada) fecham juntas | Todas fecham; estoque e 10 recebíveis certos (sem deadlock) | api:salao | ✅ corrigido (B04); C-3: a baixa virou um comando só, mesmo resultado |
| MES-18 | Fechar conta por papel | Cozinha, Garçom | Mesa com comanda aberta, desktop e celular | Cozinha não vê "Fechar conta" e a API responde 403; garçom, Administrador e Dono fecham | api:autorizacao, e2e:desktop, e2e:mobile | ✅ corrigido (F-4) |
| MES-19 | Editar ambiente por papel | Garçom, Cozinha, Adm | Mesas | Só Administrador e Dono veem "Editar ambiente"; a API recusa criar, renumerar, mover, excluir mesa e mudar a grade para Funcionário (403) | api:autorizacao, e2e:desktop | ✅ corrigido (F-4: antes, garçom e cozinha excluíam mesas) |

### 4.7 Produtos, estoque e ficha técnica (EST)

| ID | Caso | Papel | Passos e dados | Esperado | Auto | Resultado |
| --- | --- | --- | --- | --- | --- | --- |
| EST-01 | Cadastrar insumo | Adm | "Pão de batata", un, custo 2,35 | Aparece no catálogo, "Sem estoque" | api:estoque | ✅ |
| EST-02 | Produto composto (ficha técnica) | Adm | Lanche com 1 pão + 1 blend | Custo = soma; campo travado | api:estoque, e2e:desktop | ✅ |
| EST-03 | Validações da ficha | Adm | Componente composto, inexistente, quantidade 0 | 400 com mensagem | api:estoque | ✅ |
| EST-04 | Nome com acento e longo | Adm | "Pão de açúcar ç" e 81 caracteres | Aceita acento; limita a 80 | api:estoque | ✅ |
| EST-05 | Importar XML de NF-e | Adm | Nota com pão e insumo novo | Estoque sobe; custo médio ponderado; insumo novo criado | api:estoque, e2e:desktop | ✅ |
| EST-06 | XML inválido | Adm | Arquivo quebrado | "Arquivo XML inválido"; nada gravado | api:estoque | ✅ M |
| EST-07 | Baixa pela ficha ao fechar comanda | Garçom | 2× Cheddar & Bacon | Pão −2, blend −2, cheddar −0,12 kg, bacon −0,08 kg (+0,03 kg por Bacon extra) | api:estoque, e2e:fluxo | ✅ |
| EST-08 | Estoque pode ficar negativo | Garçom | Vender mais bacon do que há | Estoque negativo em vermelho; venda não é bloqueada | api:estoque | ✅ |
| EST-09 | Produto simples baixa a si mesmo | Garçom | 3× Refrigerante lata | −3 no próprio produto | api:estoque | ✅ |
| EST-10 | Movimentações | Adm | Aba Movimentações; filtros | Entradas (XML) e saídas (Fechamento de comanda #…) | e2e:desktop | ✅ |
| EST-11 | Editar preço no catálogo | Adm | Clássico 32,90 → 33,90 | Cardápio mostra o preço novo | api:estoque | ✅ |
| EST-13 | Entrada, saída e contagem manual | Adm | Produto → Ajustar estoque: Entrada 10,5; Saída 0,25 (perda); Contagem 9 | Estoque 10,5 → 10,25 → 9; três movimentos com o motivo | api:estoque, e2e:desktop | ✅ |
| EST-14 | Validações do ajuste | Adm, Garçom | Tipo inválido, quantidade 0 ou negativa, produto com ficha técnica, outro restaurante, garçom | 400 / 400 / 400 / 403 / 403 | api:estoque | ✅ |
| EST-15 | Ficha técnica muda com a comanda aberta | Adm | 2 lanches vendidos; receita passa a 0,18 kg de blend, sem pão; +1 lanche; fechar | Pão −2; blend −0,48 (0,15 × 2 + 0,18): cada venda baixa a receita com que foi vendida | api:estoque | ✅ corrigido (B23) |
| EST-16 | Prato excluído do Cardápio com a comanda aberta | Adm | Vender 1, excluir o prato, fechar | A baixa acontece (pão −1, blend −0,15) | api:estoque | ✅ corrigido (B23) |
| EST-17 | Unidade travada depois de movimentar | Adm | Produto em kg com uma entrada; trocar para g | API 409 "A unidade não pode mudar depois que o produto teve movimentação. Cadastre um novo produto."; na tela o campo fica desabilitado com esse texto; sem movimentação, a troca é livre | api:estoque, e2e:desktop | ✅ corrigido (A-01) |
| EST-12 | Lista grande | Adm | 150 produtos | Tela abre e filtra | api:grandes, M | ✅ + M (0,6 s) |

### 4.8 Cardápio no painel (CAR)

| ID | Caso | Papel | Passos e dados | Esperado | Auto | Resultado |
| --- | --- | --- | --- | --- | --- | --- |
| CAR-01 | Vincular prato do catálogo | Adm | Adicionar prato → categoria | Aparece no cardápio | e2e:desktop | ✅ |
| CAR-02 | Duplo clique em Adicionar | Adm | Clicar duas vezes | Um prato só | e2e:desktop | ✅ (mesmo mecanismo do FIN-06) |
| CAR-03 | Organizar prato mantém os grupos | Adm | Mudar a descrição do Clássico | "Ponto da carne" continua; só os adicionais são editados | api:cardapio, e2e:desktop | ✅ corrigido (B08) |
| CAR-04 | Adicionais | Adm | Novo adicional "Cheddar cremoso" 5,00 | Aparece no cliente com +R$ 5,00 | api:cardapio | ✅ |
| CAR-05 | Esgotado/Disponível | todos | Chave | Muda na hora; cliente vê em até 12 s | api:cardapio, e2e:desktop | ✅ (decisão: qualquer papel) |
| CAR-06 | Remover do cardápio | Adm | Remover (confirma) | Some do cardápio; continua no catálogo | e2e:mobile | ✅ |
| CAR-07 | Reordenar | Adm | Arrastar categoria/prato | Ordem salva e igual no cliente | M | ✅ M |
| CAR-09 | Adicional com baixa de estoque | Adm | Organizar prato → Bacon extra → "Baixa: Bacon em fatias (kg)" 0,03 | Vender 2 Clássicos com Bacon extra e fechar baixa 0,06 kg de bacon; vínculo inválido (produto composto, outro restaurante, quantidade 0) → 400 | api:cardapio | ✅ |
| CAR-10 | Criar, renomear e excluir categoria | Adm | Nova categoria "Combos"; renomear; excluir | Aparece vazia ("Nenhum prato nesta categoria"); renomeia; exclui | api:cardapio, e2e:desktop | ✅ |
| CAR-11 | Categoria com pratos não é excluída | Adm | Excluir "Sobremesas" | "Mova ou remova os pratos desta categoria antes" | api:cardapio, e2e:desktop | ✅ |
| CAR-12 | Nome de categoria repetido, vazio ou longo | Adm | "combos da casa" (já existe), "", 41 caracteres | 409 / 400 / 400 | api:cardapio | ✅ |
| CAR-13 | Restaurante novo começa pelas categorias | Dono novo | Cardápio vazio | "Criar primeira categoria" | M | ✅ M |
| CAR-14 | Categoria vazia não aparece para o cliente | cliente | Criar categoria sem pratos | Cardápio do cliente não mostra a categoria | M | ✅ M |
| CAR-08 | Foto do prato | Adm | Enviar foto | Sem Storage configurado: aviso de erro; com Storage: aparece | M (hospedado) | ✅ M sem Storage · ⏳ com Storage |

### 4.9 Contas a pagar e a receber (FIN)

| ID | Caso | Papel | Passos e dados | Esperado | Auto | Resultado |
| --- | --- | --- | --- | --- | --- | --- |
| FIN-01 | Lançar pendente e quitar | Adm | "Aluguel", 6.200,456, vencimento | Guarda 6.200,46; quitar grava data e forma | api:financeiro, e2e:desktop | ✅ |
| FIN-02 | Lançar já pago | Adm | Status Pago | Data de pagamento = hoje | api:financeiro | ✅ |
| FIN-03 | Validações | Adm | Tipo, descrição vazia, valor 0, data inválida, forma inválida | 400 | api:financeiro | ✅ |
| FIN-04 | Valor com vírgula e ponto | Adm | "1.234,56"; "12,9"; "12.90" | 1.234,56; 12,90; 12,90 | M | ❌ P2-02 |
| FIN-05 | Descrição com acento e longa | Adm | "Açougue São João" e 121 caracteres | Aceita acento; limita a 120 | api:financeiro | ✅ |
| FIN-06 | Duplo clique em Salvar | Adm | Clicar duas vezes | Um lançamento só | e2e:desktop | ✅ corrigido (B09) |
| FIN-07 | Excluir lançamento | Adm | Excluir (confirma) | Some de Contas, Visão Geral e DRE | api:financeiro, e2e:desktop | ✅ (decisão: novo) |
| FIN-08 | Excluir exige papel e módulo | Garçom; Pagar desligado | DELETE | 403 | api:financeiro | ✅ |
| FIN-09 | Atrasado | Adm | Pendente vencido | Aparece como Atrasado e soma em "Em atraso" | api:seed, M | ✅ M |
| FIN-10 | Filtros | Adm | Status, categoria, centro de custo, vencimento personalizado | Lista e contagem certas | e2e:desktop | ✅ |
| FIN-11 | Comanda vira recebível | Garçom | Fechar Mesa 9 no Cartão | Contas a Receber: "Mesa 09 · …", Pago, Cartão, Vendas salão | api:salao, e2e:fluxo | ✅ (decisão: novo) |
| FIN-12 | Lista grande | Adm | 150 lançamentos | Tela abre; totais certos | api:grandes | ✅ + M |
| FIN-13 | Celular | Adm | Lançar e quitar pela folha | Mesmo resultado do desktop | e2e:mobile | ✅ |
| FIN-14 | Serviço desligado do começo ao fim | Dono | Salão sem serviço; fechar uma mesa | Emissão Fiscal e Contas a Receber com o valor da comanda, sem os 10% | api:financeiro | ✅ |
| FIN-15 | Mudar o serviço depois do fechamento | Dono | Fechar com serviço e desligar; fechar sem e religar | A nota e o recebível ficam com o que foi cobrado (ex.: 98,89 continua 98,89, não 89,90) | api:financeiro | ✅ corrigido (B22) |

### 4.10 Visão Geral e DRE (VG)

| ID | Caso | Papel | Passos e dados | Esperado | Auto | Resultado |
| --- | --- | --- | --- | --- | --- | --- |
| VG-01 | Resumo | Adm | Abrir | Saldo 30 dias, a pagar/receber 7 dias, atrasadas, maiores despesas | e2e:desktop | ✅ + M |
| VG-02 | Comanda fechada entra nas entradas | Adm | Fechar uma comanda hoje | "Entradas" de hoje somam o valor cobrado | e2e:fluxo | ✅ |
| VG-03 | DRE do mês | Dono | Aba DRE | Entrou/Saiu/Sobrou; demonstrativo contábil | e2e:desktop | ✅ |
| VG-04 | DRE escondido do Administrador | Adm | Abrir Visão Geral | Sem a aba DRE | e2e:desktop | ✅ |
| VG-05 | Mês sem lançamentos | Dono | DRE de um mês vazio | "Nenhum lançamento" | M | ✅ M |

### 4.11 Relatórios (REL)

| ID | Caso | Papel | Passos e dados | Esperado | Auto | Resultado |
| --- | --- | --- | --- | --- | --- | --- |
| REL-01 | Hoje/7 dias/Mês | Adm | Trocar o período | KPIs, gráfico, mais e menos vendidos, mapa de calor | M | ✅ M |
| REL-02 | Números batem com as comandas | Adm | Fluxo crítico | Faturamento de hoje = soma dos pedidos (sem serviço); pedidos recusados não entram | e2e:fluxo, api:salao | ✅ |
| REL-03 | Sem dados | Adm | Restaurante novo | Zeros, sem erro | M | ✅ M |
| REL-04 | Serviço numa linha à parte | Adm | Fechar uma comanda com serviço; depois desligar o serviço | Relatórios e Turno de hoje: "Vendas de produtos", "Serviço das mesas" (o gravado no fechamento, não a configuração de hoje) e total = Contas a Receber do dia | api:financeiro, e2e:fluxo | ✅ (novo, A-4.3) |

### 4.12 Atendimento e WhatsApp (ATD)

| ID | Caso | Papel | Passos e dados | Esperado | Auto | Resultado |
| --- | --- | --- | --- | --- | --- | --- |
| ATD-01 | Aceitar aviso e conectar | Dono | Configurações → WhatsApp | Aceite registrado (quem/quando); QR do provedor | api:zap | ✅ |
| ATD-02 | Só o Dono conecta | Adm | Conectar | 403 | api:zap | ✅ |
| ATD-03 | Mensagem recebida vira ticket | Garçom | Webhook de mensagem | Ticket WhatsApp; reentrega não duplica | api:zap | ✅ |
| ATD-04 | Responder | Garçom | Enviar resposta | Sai pelo provedor; dá "visto" nas pendentes | api:zap | ✅ |
| ATD-05 | Duplo Enter / duplo clique | Garçom | Enviar a mesma resposta duas vezes seguidas | Uma mensagem só | e2e:desktop | ✅ corrigido (B09) |
| ATD-06 | Envio falha | Garçom | Provedor fora | Mensagem não fica como enviada; aviso | api:zap | ✅ |
| ATD-07 | Mídia | Garçom | Foto/áudio | A API baixa da Evolution (até 8 MB) e guarda no bucket privado; URL assinada | api:zap | ✅ |
| ATD-08 | Assumir ticket | Garçom | "Assumir" | Responsável = quem clicou (não um nome fixo) | e2e:desktop | ✅ corrigido (B14) |
| ATD-09 | Desconectado | Garçom | Sessão cai | Faixa vermelha "WhatsApp desconectado" | M | ✅ M |
| ATD-10 | Isolamento | Dono de outro restaurante | Ler/responder ticket alheio | 404/403 | api:zap | ✅ |
| ATD-11 | Números reais | Dono | Ambiente hospedado com Evolution | Receber, responder, foto, áudio | M (hospedado) | ⏳ hospedado |
| ATD-12 | Mídia acima de 8 MB | Garçom | Enviar foto de 8 MB + 1 byte | "Arquivo acima de 8 MB. Envie uma imagem menor ou um áudio mais curto." (antes de subir e, se chegar, 413 da API); 8 MB exatos saem | api:zap | ✅ (novo, A-4.1) |
| ATD-13 | Webhook sem o segredo | — | POST no webhook sem `x-webhook-secret`, anunciando 50 MB | 401 antes de ler o corpo; com o segredo, corpo acima de 2 MB → 413 (o webhook não traz mais a mídia) | api:zap | ✅ (A-2.2; 2 MB desde o C-5) |
| ATD-15 | Mídia recebida acima de 8 MB | Garçom | Cliente manda foto de 12 MB (o tamanho vem na mensagem); outra de 8 MB exatos; uma sem tamanho que chega com 8 MB + 1 byte | 12 MB: não é baixada; na conversa daquele cliente, "[Arquivo de 12 MB não recebido (o limite é 8 MB). Peça para o cliente enviar de outro jeito.]" e a legenda; a conversa de outro cliente não muda. 8 MB: chega normal. 8 MB + 1: o mesmo aviso, "8,1 MB" | api:zap | ✅ (novo, C-5) |
| ATD-14 | Status e responsável do ticket inválidos | — | status "fechado", responsável numérico ou com 121 caracteres | 400; nada muda | api:robustez | ✅ (novo, A-2.9) |

### 4.13 Configurações (CFG)

| ID | Caso | Papel | Passos e dados | Esperado | Auto | Resultado |
| --- | --- | --- | --- | --- | --- | --- |
| CFG-01 | Perfil | Dono | Nome e descrição com acento | Salva; cabeçalho mostra o nome do restaurante | e2e:desktop | ✅ corrigido (B13) M |
| CFG-02 | Horários | Dono | Domingo fechado | Salva | M | ✅ M (seed: segunda fechada) |
| CFG-08 | Horários inválidos | — | Dia 7, dia repetido, texto de 41 caracteres, `isOpen: "sim"`, 8 linhas | 400; nada muda | api:robustez | ✅ (novo, A-2.9) |
| CFG-09 | Logo e fotos só PNG, JPEG ou WebP | Dono | SVG (com o tipo certo ou disfarçado de PNG), HTML com nome .jpg | "Envie uma imagem PNG, JPEG ou WebP."; imagem de verdade passa mesmo com tipo errado informado | api:seguranca | ✅ (novo, A-2.8) |
| CFG-03 | Equipe: adicionar/editar | Dono | Novo garçom, e-mail repetido, senha curta | Salva; 409; aviso | e2e:desktop, api:perm | ✅ |
| CFG-04 | Financeiro: forma de recebimento | Dono | Maquininha própria / PIX via sistema | Salva e muda o fechamento | M | ✅ M |
| CFG-05 | Salão: serviço 10% | Dono | Configurações → Salão (desktop e celular) → ligar/desligar | Comanda e recebível acompanham | api:salao, e2e:desktop | ✅ (decisão: novo) |
| CFG-06 | Fiscal | Dono | Regime inválido | 400 | M | ✅ M |
| CFG-07 | Aparência | Dono | Cor, prévia, publicar | Cliente vê a cor publicada | M | ✅ M |

### 4.14 Super Admin (ADM)

| ID | Caso | Papel | Passos e dados | Esperado | Auto | Resultado |
| --- | --- | --- | --- | --- | --- | --- |
| ADM-01 | Chave | 🔑 | Sem chave, errada, token de staff | 401 | api:admin | ✅ |
| ADM-02 | Cadastrar restaurante | 🔑 | CNPJ formatado, repetido, inválido | Pendente; 409; 400 | api:admin | ✅ |
| ADM-03 | Ativar/desativar | 🔑 | Desativar com Dono logado | Sessão cai na hora | api:admin | ✅ |
| ADM-04 | Lista | 🔑 | Abrir `/admin` | Todos os restaurantes, status | e2e:varredura | ✅ |
| ADM-05 | Detalhe | 🔑 | Abrir o Chapa 27 | Dados, módulos, configurações, equipe, WhatsApp | e2e:desktop | ✅ |
| ADM-06 | Módulos | 🔑 | Desligar/ligar Mesas | Menu e API acompanham | api:perm, e2e:desktop | ✅ |
| ADM-07 | Reset de senha | 🔑 | Resetar o garçom | Provisória uma vez; troca obrigatória | api:admin, e2e:desktop | ✅ |
| ADM-08 | Mensalidades | 🔑 | Valor/dia, gerar mês, atrasar, pagar | Minha Fatura mostra igual; ninguém é desativado | api:admin, e2e:desktop | ✅ |
| ADM-09 | Validações | 🔑 | Valor negativo, dia 29, mês inválido | 400 | api:admin | ✅ |

### 4.15 Fluxo crítico de ponta a ponta (E2E)

| ID | Caso | Passos | Esperado | Auto | Resultado |
| --- | --- | --- | --- | --- | --- |
| E2E-01 | Pedido pelo QR até o financeiro | 1. Cliente abre o QR da Mesa 12 do Chapa 27 e pede 2× Cheddar & Bacon (Bem passado + Bacon extra, obs "sem cebola") e 1× Refrigerante lata. 2. O pedido aparece na Central com opções e observação. 3. A cozinha aceita, marca pronto e entrega. 4. O garçom fecha a conta no Cartão. 5. Estoque baixa pela ficha técnica. 6. Contas a Receber, Visão Geral, Turno de hoje e Relatórios batem. | Itens 2×(38,90+6,00)+7,00 = 96,80; com serviço 10% = 106,48 cobrado e lançado; pão −2, blend −2, cheddar −0,12, bacon −0,08, refrigerante −1; Relatórios: 96,80 a mais em "Hoje" | e2e:fluxo | ✅ |

### 4.16 Casa cheia (CARGA)

`npm run carga` (Postgres local no Docker) e `npm run carga -- supabase` (banco do `apps/api/.env`). Cenário em `tests/load/cenario.mjs`; a medição de 01/10 está na seção 7. Resultados: local · Supabase.

| ID | Caso | Como | Meta | Auto | Resultado |
| --- | --- | --- | --- | --- | --- |
| CARGA-01 | Casa cheia sem erro | 30 mesas × 4 celulares + 15 tablets + 10 Centrais, cada um no polling do app, 10 pedidos/min por 10 min, tudo do mesmo IP | Todos os pedidos gravados; nenhuma resposta 4xx/5xx | carga | ✅ 100/100 e 0 erro · ✅ 100/100 e 0 erro |
| CARGA-02 | Pedido → aparece na Central | Playwright: o celular pede pelo QR da Mesa 30 com a Central da cozinha aberta; 20 execuções, mesa livre ("Aguardando aceite") e mesa aberta (Recebido) | p95 ≤ 5 s | carga | ✅ p95 3,97 s, pior 4,45 s · ❌ mesa livre p95 4,82 s, mesa aberta p95 5,49 s, pior 5,53 s (rodada C; B: p95 5,26 s) |
| CARGA-03 | Rotas públicas do cardápio | p50/p95/p99 de cada rota e do cardápio montado (restaurante + categorias + itens) | p95 ≤ 2 s | carga | ✅ p95 0,01 s · ✅ p95 0,31 s (rodada C) |
| CARGA-04 | Cardápio utilizável | Lighthouse em modo celular (4G lenta simulada, CPU 4×) na rota do QR, com tela de celular e de tablet | LCP ≤ 2,5 s (decisão de 01/10; era LCP e TTI ≤ 2 s) | carga | ✅ celular 2,21 s, tablet 2,20 s · ✅ 2,34 s nos dois (rodada C, ícones sem cdnjs; antes ❌ 3,03–3,04 s · 3,18 s) |
| CARGA-05 | Limites do A com a casa cheia | Tudo do mesmo IP; maior uso de cada limite numa janela | Nenhum 429 | carga | ✅ 0 · ✅ 0 (folga na seção 7; o mesmo na rodada C) |
| CARGA-06 | Consumo no pico | CPU e memória da API e da Evolution | Registrar | carga | Rodada C: API ≤ 21% · ≤ 26% de um núcleo e ≤ 211 MB; Evolution parada em 0%, 125 MB (B: ≤ 20%, ≤ 207 MB, 191 MB) |
| CARGA-07 | Contas fechadas ao mesmo tempo | Fim da noite do script: as mesas com comanda (27–29) fecham juntas | Sem meta | carga | ✅ corrigido (C-3): máx 0,20 s · máx 2,43 s, p50 2,31 s (era 0,59 s · 29,8 s, p50 13,7 s; seção 7) |

### 4.17 Varredura de telas (UI)

| ID | Caso | Como | Esperado | Auto | Resultado |
| --- | --- | --- | --- | --- | --- |
| UI-01 | Todas as telas × papel × tamanho × tema | Seção 3 | Sem rolagem horizontal, sem erro de JS, sem chamada com erro | e2e:varredura | ✅ 3 × 2 (sem erro, sem rolagem) |
| UI-02 | Legibilidade no escuro | Olhar cada tela no tema escuro | Texto legível, nada branco-no-branco | M | ✅ M (amostra) |
| UI-03 | Textos longos | Nome de prato com 80 caracteres, descrição de conta com 120 | Corta com reticências, não quebra o layout | M | ✅ M |
| UI-04 | Central inteira no tablet e no desktop | Central com a cozinha em 1280×800 e com o Dono em 1366×820 | As 4 colunas cabem na tela; chamados e turno viram uma faixa acima | e2e:varredura | ✅ corrigido (B18) |
| UI-05 | Barra de abas sempre na tela (celular) | Rolar Central, Cardápio e Mesas até o fim | Abas continuam visíveis (antes ficavam depois do conteúdo) | e2e:mobile | ✅ corrigido (B21) |
| UX-03 | Acessibilidade de todas as telas | Seção 3, com axe-core e a medida dos alvos | Nenhuma violação WCAG 2.1 A/AA (contraste 4,5:1 e 3:1, nome em botões, links e campos) e nenhum alvo de toque menor que 44 × 44 | e2e:varredura | ✅ corrigido (A-4.2): 639 → 0, detalhes na seção 6 |
| UX-04 | Acessibilidade do que abre com um toque | Todo diálogo, folha, popover e formulário aberto (seção 6, rodada C), desktop e celular, claro e escuro, com o axe e a medida dos alvos enquanto está aberto | Nenhuma violação WCAG 2.1 A/AA e nenhum alvo menor que 44 × 44 | e2e:dialogos | ✅ corrigido (C-7): 40 → 0 (112 → 0 elementos) |
| UX-05 | Ícones sem CDN | Os dois apps sem nada de outra origem; cada classe `fa-*` usada (também as que vêm do seed) tem o seu SVG no `icons.css` do app; comparação lado a lado com o Font Awesome do cdnjs | Iguais (mesma caixa, largura e alinhamento); botão só com ícone tem nome | api:icones, M | ✅ (novo, C-1) |
| UX-06 | Texto sobre a cor de alerta no tema escuro | Celular, tema escuro, com pedido novo pendente: o selo da aba Central (e o de não lidas do Atendimento, o botão de enviar áudio) | Contraste de pelo menos 4,5:1 | e2e:mobile | ✅ corrigido (rodada F: era 3,51:1, branco sobre `#CE6E54`; achado pelo `npm test` antes do push) |
| ROB-01 | Requisição malformada não derruba a API | PATCH de prato com preço "abc" (Administrador) | Erro só nessa requisição; a API segue respondendo | api:robustez | ✅ corrigido (B05) |

### 4.18 Segurança e limites (SEG)

| ID | Caso | Papel | Passos e dados | Esperado | Auto | Resultado |
| --- | --- | --- | --- | --- | --- | --- |
| SEG-01 | RLS em todas as tabelas | — | `pg_tables` do schema public | `rowsecurity = true` em todas (a API, dona das tabelas, segue funcionando) | api:seguranca | ✅ (novo, A-2.1) |
| SEG-02 | Produção sem configuração obrigatória | — | `NODE_ENV=production` sem `JWT_SECRET` de 32+ ou sem `CORS_ORIGINS` | A API não sobe e diz o que falta; com os dois, sobe; fora de produção, como antes | api:seguranca | ✅ (novo, A-2.3) |
| SEG-03 | API e Evolution só na máquina | — | API sem `HOST`; `docker compose config` sem e com `EVOLUTION_API_KEY` | A API escuta em 127.0.0.1: a própria máquina conecta, o IP da rede local não; sem a chave o compose não monta; com ela, a porta 8085 só em 127.0.0.1 | api:seguranca | ✅ (automático desde o C-8; roda no CI) |
| SEG-04 | Casa cheia no mesmo IP | — | 40 mesas × 7 aparelhos × 25 req + 70 pedidos + 10 aparelhos da equipe × 57 req, do mesmo IP | Nenhum 429 | api:limites | ✅ (novo, A-2.11) |
| SEG-05 | Uma mesa acima do limite | — | 901 req/min de uma mesa; 41 pedidos em 5 min de uma mesa | 429 com `Retry-After` e mensagem; outra mesa do mesmo IP segue | api:limites | ✅ (novo) |
| SEG-06 | IP real só do proxy confiável (dev) | — | Sem `TRUSTED_PROXY`: `CF-Connecting-IP` numa conexão local e numa da rede | Local: vale o cabeçalho; da rede: vale o endereço da conexão | api:limites | ✅ (D-4: antes "só pelo túnel") |
| SEG-12 | IP real só do Caddy (VM) | — | Uma segunda API com `TRUSTED_PROXY` = o endereço de rede local desta máquina; 51 logins com IPs forjados diferentes pelo "proxy" e direto no loopback | Pelo proxy: cada IP do cabeçalho conta por si (51 × 401); direto: o cabeçalho é ignorado (50 × 401 + 1 × 429). Na pilha de produção, o Caddy sobrescreve o cabeçalho (seção 7, Rodada D) | api:limites | ✅ (novo, D-4) |
| SEG-13 | Compose de produção fechado | — | `docker compose -f deploy/docker-compose.prod.yml config` | Só o Caddy publica portas (80 e 443); `TRUSTED_PROXY` = o endereço fixo do Caddy; healthcheck na API; tudo `unless-stopped`; imagens e `FROM` com versão fixa | api:seguranca | ✅ (novo, D-1) |
| SEG-14 | Seed de dev recusado em produção | — | `prisma/seed.ts` com `NODE_ENV=production`; `deploy/deploy.sh seed` | Sai com 1 e "Recusado", e o banco fica como estava | api:seed, M | ✅ (novo, D-6) |
| SEG-07 | Chamar garçom por pedido alheio | — | `call-waiter` sem sessão, com outra ou com "anonymous" | 404 e nenhum chamado | api:salao | ✅ (novo, A-2.5) |
| SEG-09 | Limites sem `CF-Connecting-IP` | — | Da própria máquina, sem o cabeçalho: 901 req de uma mesa; 41 pedidos de uma mesa; 601 req de um funcionário (o `npm test` usa 3.001, porque sobe o limite para 3.000); 6 senhas erradas | Sem limite por IP, mas 429 na 901ª da mesa, no 41º pedido, na requisição acima do limite do funcionário e a conta bloqueada (nem a senha certa entra) | api:limites | ✅ corrigido (C-2: antes, nada disso valia sem o cabeçalho) |
| SEG-10 | Buckets do Storage iguais em todo projeto | — | `npm run db:deploy` no Supabase de testes; `storage.buckets`; gravar SVG, MP3 e PNG no `cardapio` pelo S3 | `cardapio` público, 8 MB, só PNG/JPEG/WebP (antes aceitava SVG e áudio); `whatsapp-media` privado, 8 MB, imagens e áudios; SVG e MP3 recusados (415), PNG aceito | M (hospedado) | ✅ M (C-6, 01/10) |
| SEG-11 | Chave da Evolution forte e sem padrão | — | Chave nova de 64 hex no `apps/api/.env`; `up -d` recria o contêiner | A chave antiga recebe 401; a nova, 200; o adaptador da API fala com a Evolution | M | ✅ M (C-9, 01/10) |
| SEG-08 | Pedir pelo QR com a opção desligada | cliente | Pedido anônimo de mesa com Configurações → Salão sem QR | 403 "os pedidos da mesa são feitos pelo garçom"; o garçom lança; delivery não muda | api:garcom | ✅ (A-2.12, já existia) |
| SEG-15 | Todas as rotas, sem token, de outro restaurante, com papel abaixo e com o módulo desligado | — | As 104 rotas lidas do próprio Express; cada uma numa lista (pública, webhook, própria, super admin ou equipe com papel e módulo) | Rota fora das listas falha o teste; sem credencial 401; outro restaurante 403/404; papel abaixo 403 (o mínimo passa nas leituras); módulo desligado 403 até para o Dono; chave do super admin com um caractere a mais ou a menos 401 | api:autorizacao | ✅ (novo, E-1) |
| SEG-16 | Configurações só do Dono, também pela API | Adm | `PATCH` perfil, horários, fiscal, forma de pagamento/serviço 10%/QR e aparência com o login do gerente | 403 (antes, 200); o Dono segue; a forma de pagamento continua lida por todos | api:autorizacao | ✅ corrigido (SEG-A02) |
| SEG-17 | Pedido malformado sem detalhe interno | cliente | `POST /api/orders` com `itemId` 123, `{ "not": "x" }` ou `null` | 400 sem caminho de arquivo, código nem consulta do Prisma (antes vinham os três) | api:seguranca | ✅ corrigido (SEG-A04) |
| SEG-18 | Restaurante inativo some do público | — | Super Admin desativa; cardápio, categorias, prato e aparência; pedido de delivery | 404 em tudo; reativado, volta | api:seguranca | ✅ corrigido (SEG-A11, SEG-A03) |
| SEG-19 | Cabeçalhos de segurança da API | — | `GET /api/health`, uma rota que não existe, o webhook sem segredo, o cardápio | `nosniff`, `X-Frame-Options: DENY`, CSP `default-src 'none'`, `Referrer-Policy: no-referrer`; sem `X-Powered-By` | api:seguranca | ✅ corrigido (SEG-A09) |
| SEG-20 | Logo e capa só do bucket | Dono | `logoUrl`/`coverPhotos`/`coverUrl` com `javascript:`, outro site, `http:`, um número | 400; a URL do bucket público e a que já estava gravada passam | api:seguranca | ✅ corrigido (SEG-A10) |
| SEG-21 | Chave do super admin forte em produção | — | API com `NODE_ENV=production` e `SUPER_ADMIN_KEY` de 8 caracteres | Não sobe e diz o motivo; com 32+ sobe; vazia sobe com o super admin desligado | api:seguranca | ✅ corrigido (SEG-A13) |
| SEG-22 | Login não revela quem tem conta | — | 4 logins com e-mail inexistente × 4 com senha errada de uma conta | Tempos parecidos (antes: 4,2 ms × 66,7 ms) | api:seguranca | ✅ corrigido (SEG-A12) |
| SEG-23 | Upload acima de 8 MB | Dono | Capa e foto do prato com 8 MB + 8 bytes | 413 "file too large — limit is 8 MB" (antes 500) | api:seguranca | ✅ corrigido (SEG-A14) |
| SEG-24 | `deploy/.env` só do dono | — | `deploy/.env` criado com 644; `deploy/deploy.sh seed-demo` sem senha | Sai pedindo a senha e o `.env` fica 600 | api:seguranca (Linux/CI) | ✅ corrigido (SEG-A15) |
| SEG-25 | CSP e cabeçalhos dos fronts | — | Os dois apps no build de produção com os cabeçalhos do `vercel.json`: login, 12 telas do Dono, Super Admin; lista, cardápio, prato e mesa pelo QR; um `<script>` injetado | Nada bloqueado pela CSP; o script injetado não roda | e2e:csp | ✅ corrigido (SEG-A05) |

### 4.19 Histórico do pedido (OBS)

Lido direto do banco de teste (`OrderEvent`): não há tela nem rota para ele.

| ID | Caso | Papel | Passos e dados | Esperado | Auto | Resultado |
| --- | --- | --- | --- | --- | --- | --- |
| OBS-01 | Da mesa livre ao fechamento | cliente, Garçom, Cozinha | QR numa mesa livre → aceitar → preparar → pronto (duas vezes) → servido; o garçom lança outro; o cliente pede de novo, a cozinha aceita; dois garçons fecham a conta no PIX ao mesmo tempo | Cada pedido com a sua sequência (criado pelo QR/garçom, aguardando aceite pelo sistema, aceito, cada status, servido pelo fechamento, comanda fechada no PIX), com quem fez; o clique repetido e o segundo fechamento não gravam nada; totais dos pedidos e o Contas a Receber iguais | api:eventos | ✅ (novo, E-5) |
| OBS-02 | Recusado | cliente, Cozinha | 1º pedido de uma mesa livre recusado; recusar de novo | criado, aguardando aceite, recusado; o segundo 409 não grava | api:eventos | ✅ (novo, E-5) |
| OBS-03 | Delivery | cliente, Dono, Cozinha, Garçom | Pedido de delivery → aceitar → pronto → saiu para entrega → entregue | criado (delivery), aceito, cada status, com quem fez | api:eventos | ✅ (novo, E-5) |
| OBS-04 | Dois aparelhos ao mesmo tempo | Garçom | Aceitar e recusar juntos; aceitar e aceitar juntos | Uma linha por mudança que valeu; a última é o status do pedido | api:eventos | ✅ (novo, E-5) |

### 4.20 Lista do app do cliente e o módulo Delivery (DESC)

| ID | Caso | Papel | Passos e dados | Esperado | Auto | Resultado |
| --- | --- | --- | --- | --- | --- | --- |
| DESC-01 | Só restaurante com Delivery na lista | Super Admin, cliente | Desligar o módulo Delivery do restaurante; abrir a lista e buscar pelo nome; pedir delivery | Some da lista e da busca; o pedido de delivery é recusado ("Este restaurante não recebe pedidos de delivery pelo app."); religado, volta | api:descoberta | ✅ (novo, E-6) |
| DESC-02 | Sem Delivery, a mesa segue | cliente, Garçom | Módulo desligado: cardápio público, QR da mesa (e o tablet), aceite, Lançar pedido | Tudo como antes | api:descoberta | ✅ (novo, E-6) |
| DESC-03 | Dinheiro igual nos dois apps | — | `brl` de -10; 1340,5; -0,001 | "-R$ 10,00", "R$ 1.340,50", "R$ 0,00"; o cardápio e o painel usam o mesmo (`@cardapio/shared`) | api:moeda | ✅ corrigido (E-7: o cardápio mostrava "R$ -10,00" e "R$ 1340,50") |
| DESC-04 | Sem destaques fixos | cliente | Tela inicial do delivery; o bundle de produção do cardápio | Nenhum destaque inventado; nenhum nome de restaurante do banco no código | e2e:csp | ✅ corrigido (F-5: "Fogo & Nó" e "Forno di Napoli" estavam no código) |
| DESC-05 | Delivery desligado por padrão | Super Admin | Cadastrar restaurante e ativar; seed de demonstração | Nasce com todos os módulos menos Delivery e não aparece na lista até o Super Admin ligar; a Chapa 27 do seed sem Delivery; os restaurantes que já existiam não mudam | api:admin, api:seed | ✅ (novo, F-6) |
| CUP-01 | Cupom que não existe | cliente | "abc" no Pagamento; pedido com ele | "Cupom não encontrado neste restaurante."; o pedido não é criado | api:cupom | ✅ corrigido (F-1, SEG-A01: antes, qualquer texto dava 10%) |
| CUP-02 | Cupom cadastrado em Promoções | cliente | 15%, R$ 7,50 e R$ 9.999 de desconto num pedido de delivery | Desconto exatamente o do cupom, sobre o subtotal e nunca maior que ele; gravado no pedido com o código; o uso é contado | api:cupom | ✅ (novo, F-1) |
| CUP-03 | Desconto enviado pelo aparelho | cliente | Pedido com `discount`, `discountPercent`, `total` e `subtotal` forjados | Ignorados: o servidor calcula | api:cupom | ✅ (novo, F-1) |
| CUP-04 | Regras de Promoções | cliente | Cupom pausado, expirado, só para mesa, de combo, esgotado, de outro restaurante; dois pedidos com o último uso | Cada um recusado com o motivo; do último uso, só um pedido leva | api:cupom | ✅ (novo, F-1; combo fica para decisão) |

## 5. Só com aparelho na mão

- Tablet Android pelo Capacitor (`apps/web` e `apps/dashboard`): instalar o APK, girar para paisagem, botão voltar do Android, teclado cobrindo campos, rede Wi-Fi caindo e voltando no meio do serviço.
- Safari no iPhone: cardápio pelo QR (câmera → link), área segura do entalhe, tema escuro do sistema, adicionar à tela inicial.
- Microfone: gravar áudio no Atendimento (permissão do navegador, formato aceito pelo WhatsApp).
- Câmera lendo o QR impresso: tamanho mínimo do QR, luz do salão.
- WhatsApp com números reais pela Evolution hospedada: receber, responder, foto, áudio, "visto", reconexão.
- Maquininha própria real: conferir que a forma escolhida no fechamento bate com o comprovante.
- Impressora: os botões "Imprimir" hoje só mostram um aviso (não há integração).
- Tablet fixo na mesa: sessão do cliente e tela sempre ligada.

## 6. Rodada de 27/09/2026

156 casos: **153 passaram** (25 só depois de corrigidos nesta rodada), **2 falham como P2**, **1 depende do ambiente hospedado**. Suíte automática: 83 testes de API + 65 de tela (desktop, tablet e celular; claro e escuro), verde no CI. Carga (duas rodadas, local): 90/90 pedidos, pedido → cada Central p95 3,4–4,1 s (meta 5 s; a Central consulta a cada 4 s), cardápio p95 0,39–0,53 s (meta 2 s).

Bugs corrigidos (P0 = quebra fluxo da demo, perde dado ou erra dinheiro/estoque; P1 = atrapalha o uso):

| ID | Gravidade | O que acontecia |
| --- | --- | --- |
| B01 | P0 | O QR de qualquer mesa abria o restaurante "fogo" do seed de dev. |
| B02 | P0 | Transferir mesa trazia de volta pedidos já pagos (cobrança em dobro) ou sumia com os transferidos. |
| B03 | P0 | Fechar a conta cobrava também o pedido que chegou enquanto o garçom estava na maquininha; a comanda na tela não atualizava. |
| B04 | P0 | Fechamentos simultâneos de mesas diferentes davam deadlock: a comanda perdedora ficava sem baixa de estoque e sem recebível. |
| B05 | P0 | Qualquer erro numa rota assíncrona (ex.: um pedido malformado) derrubava a API inteira. |
| B06 | P0 | Com a sessão vencida (12 h), a Central ficava vazia em silêncio: pedidos novos paravam de aparecer. |
| B07 | P0 | A Central não mostrava opções ("Bem passado · Bacon extra") nem a observação do cliente. |
| B08 | P0 | "Organizar prato" apagava os grupos de opção (ex.: "Ponto da carne") ao salvar. |
| B09 | P0 | Duplo clique criava lançamento duplicado (e resposta de WhatsApp duplicada). |
| B10 | P1 | Não havia "Sair" no desktop; o do celular só mostrava um aviso. |
| B11 | P1 | Pedido recusado voltava na coluna "Entregue / Servido". |
| B12 | P1 | Sem internet, a Central seguia dizendo "Atualizando em tempo real". |
| B13 | P1 | O cabeçalho dizia "Fogo & Nó" para qualquer restaurante. |
| B14 | P1 | "Atribuir a mim" gravava sempre "Marina Duarte". |
| B15 | P1 | No celular, "Fechar conta" fechava com um toque, sem perguntar a forma de pagamento. |
| B16 | P1 | A forma de pagamento escolhida na maquininha era descartada. |
| B17 | P1 | (parte de B03) A comanda aberta na tela não se atualizava. |
| B18 | P1 | A Central cortava colunas no tablet 1280 e no desktop 1366. |
| B19 | P1 | A revisão do pedido (app do cliente) não mostrava erro nenhum: esgotado ou sem conexão, o botão simplesmente não fazia nada. |
| B20 | P1 | Dois aparelhos aceitando/recusando o mesmo pedido: os dois "venciam" (cozinha preparava pedido cancelado, fora da conta). |

**29/09:** implementadas as quatro decisões em aberto (Lançar pedido para o garçom, categorias, ajuste manual de estoque, adicionais com estoque) e corrigido B21 (P1): no celular, a barra de abas ficava depois do conteúdo — numa lista longa o garçom precisava rolar até o fim para trocar de aba.

**29/09 — valores gravados × cadastro atual:** procurados os lugares onde um valor de dinheiro ou estoque já registrado era refeito com a configuração ou o cadastro de hoje. Dois erravam o número e foram corrigidos, com teste que falha no código antigo:

| ID | Gravidade | O que acontecia |
| --- | --- | --- |
| B22 | P0 | A fila da Emissão Fiscal recalculava o serviço com a chave de hoje: comanda fechada com 10% e serviço desligado depois aparecia sem os 10% (98,89 cobrados → 89,90 na nota), e o contrário. Agora o fechamento grava o serviço cobrado em cada pedido (migração `9d_order_service`, que preenche as comandas antigas com o valor que a fila já mostrava). |
| B23 | P0 | A baixa de estoque no fechamento lia a ficha técnica e o vínculo do Cardápio do momento do fechamento: receita mudada com a comanda aberta baixava a receita nova, e prato excluído do Cardápio não baixava nada. Agora cada linha grava, no pedido, o que uma unidade tira do estoque (migração `9e_line_stock`; linhas antigas seguem como antes). |

Conferidos e certos: preço, nome e adicionais na linha do pedido (gravados no pedido); taxa de entrega e desconto (gravados); comanda aberta (usa a chave de hoje de propósito, é o que vai ser cobrado); valor do recebível (gravado no fechamento); Visão Geral e DRE (somam os lançamentos gravados; o CMV é a categoria "Insumos e bebidas" de Contas a Pagar); Relatórios e turno (somam o total gravado dos pedidos, só itens, sem serviço, por definição); mensalidade (valor gravado ao gerar o mês); ajuste de estoque, contagem e custo médio do XML (usam o saldo e o custo do momento, que é a regra). O custo de um composto no Catálogo é sempre o de hoje, porque é cadastro: nenhuma baixa grava custo, então não há custo antigo refeito.

Achados, não corrigidos (precisam de decisão ou estão fora do escopo):

| ID | O que acontece |
| --- | --- |
| A-01 | Movimentações mostram a quantidade com a unidade atual do produto: trocar kg → g relê o histórico, o saldo e as fichas técnicas na unidade nova (0,15 kg vira "0,15 g"). Decidir: travar a unidade depois do primeiro movimento, ou converter. |
| A-02 | "Pedir de novo" (delivery, app do cliente) põe no carrinho o preço do pedido antigo; o servidor cobra o preço de hoje, então o total mostrado antes de confirmar pode diferir do cobrado. |
| A-03 | A rota `POST /api/orders/:id/repeat` não é usada por nenhum app e cria pedido sem passar pelas regras do pedido: ignora "Clientes pedem pelo QR da mesa" desligado e não abre a mesa. Dá para apagar. |

Mudanças de produto decididas: comanda fechada vira recebível pago; serviço de 10% opcional por restaurante; excluir lançamento; sessão de 24 h; Esgotado para qualquer papel.

P2 (registrados, não corrigidos):

| ID | O que acontece |
| --- | --- |
| P2-01 | Senha errada no login mostra "invalid credentials" (em inglês). |
| P2-02 | "1.500" num campo de valor vira R$ 1,50 (o ponto é lido como decimal quando não há vírgula). |
| P2-03 | O código do pedido tem 4 dígitos aleatórios e se repete ao longo do dia (a descrição do recebível desambigua pela mesa). |
| P2-04 | "Organizar prato" sempre regrava o horário como "Almoço 11:00 – 15:00 · Jantar 18:00 – 23:00". |
| P2-06 | A coluna "Entregue / Servido" acumula todos os pedidos do dia. |
| P2-07 | No cabeçalho, "Aberto" é fixo e a busca não faz nada. |
| P2-08 | O valor da mensalidade no Super Admin aparece como "299.9". |
| P2-09 | Os botões "Imprimir" só mostram um aviso. |
| P2-10 | Duas "Nova mesa" ao mesmo tempo: a segunda falha com erro 500. |
| P2-11 | O cliente não vê os 10% de serviço no resumo do pedido. |
| P2-12 | Estoque em kg/L acumula resíduo de ponto flutuante (exibido com 3 casas). |
| P2-13 | Atendimento recarrega todos os tickets com todas as mensagens a cada 6 s (cresce com o volume de WhatsApp). |
| P2-15 | Chamar garçom duas vezes gera dois chamados. |

As lacunas de produto listadas em 27/09 (categorias, ajuste manual de estoque, garçom lançar pedido, adicionais com estoque) foram implementadas em 29/09 (casos GAR, CAR-09 a CAR-14, EST-13, EST-14). P2-05 deixou de existir: "Abrir comanda" virou "Lançar pedido". Depois, por decisão do Dono do produto: o pedido lançado pelo garçom entra direto em Preparando com a tag "Lançado no estabelecimento", e o pedido pelo QR virou opção em Configurações → Salão (junto com o serviço de 10%, que assim chega também ao celular — P2-14 resolvido).

**30/09 — rodada "Prompt A" (dados, segurança, pedido pelo QR, cards parciais).** Um commit por item (`A-x.y` no início da mensagem). Casos novos: AUT-12 a AUT-14, QR-22 a QR-31, PED-15, PED-16, MES-18 a MES-20, EST-17, REL-04, ATD-12 a ATD-14, CFG-08, CFG-09, UX-03 e a seção 4.18 (SEG).

| Item | O que mudou | Casos |
| --- | --- | --- |
| A-1.1 | Fechar comanda grava `closedAt` e o serviço no mesmo UPDATE | MES-20 |
| A-1.3 | Unidade travada depois da primeira movimentação (resolve A-01) | EST-17 |
| A-1.4 | "Pedir de novo" com o preço e a disponibilidade de hoje (resolve A-02) | e2e:desktop |
| A-1.5 | Rota `POST /api/orders/:id/repeat` apagada (resolve A-03) | api:salao |
| A-2.x | RLS, webhook, produção, rede, sessão, senha 8, imagens, validação, limites | SEG-01 a SEG-08, AUT-12 a AUT-14, ATD-13, ATD-14, CFG-08, CFG-09, QR-31 |
| A-3.x | QR com código aleatório, gerar novo QR, aceite do primeiro pedido, Comer aqui/Para levar, impressão em A4 | QR-22 a QR-30, PED-15, PED-16, MES-18, MES-19 |
| A-4.1 | Mídia do WhatsApp com 8 MB na API, no bucket e no Atendimento | ATD-12 |
| A-4.2 | Acessibilidade (UX-03) na varredura | UX-03 |
| A-4.3 | Serviço numa linha à parte nos Relatórios e no turno | REL-04 |

**UX-03, varredura de acessibilidade (axe-core + alvos de 44 × 44), desktop e celular, temas claro e escuro, todas as telas da varredura (painel com os 4 papéis, Super Admin, login e o app do cliente na mesa e no delivery).** Primeira passada: 639 ocorrências (a mesma falha repetida em telas, tamanhos e temas). Encontrado e corrigido:

- **Alvos menores que 44 × 44:** linhas do menu lateral (204×38), cabeçalho do grupo (239×40), campos (~40 px), botões de ícone do cabeçalho do celular (38×38: voltar, notificações, conta), controles segmentados, chips e abas (30–40 px), botões de texto ("Remover", "Observações", "Pedir de novo"), links do Super Admin (15–21 px), interruptores de 48×28. Correção: regra global nos dois apps (botões, campos, selects, interruptores, abas e links com pelo menos 44 × 44, acima de estilos inline menores); interruptor do celular com área de toque de 52×44.
- **Contraste abaixo de 4,5:1:** texto terciário `--ink3` (2,96:1 no claro, 3,27:1 no escuro), `--warn` como texto (3,31:1), a cor secundária como texto (2,2:1: papel no cabeçalho, "Lançado no estabelecimento", estrelas), no escuro `--alert` (3,81:1) e `--neutral` (2,70:1); no app do cliente, `--good` (3,33:1 e 4,30:1). Correção: tokens ajustados na mesma matiz até 4,6:1 em todas as superfícies, e `--secText` para a cor secundária usada como texto.
- **Sem nome acessível:** botões do cabeçalho do celular, botão de tema na aba Mais, interruptores de horário/disponibilidade/cupom (agora `role="switch"` com rótulo), selects do Mesas (tamanho da grade, transferir), campos do login (rótulos ligados por `for`).
- **Teclado:** regiões com rolagem sem foco (gráficos dos Relatórios, DRE, o `main` do celular, as faixas horizontais do app do cliente) e cards clicáveis sem teclado (destaques e restaurantes do app do cliente, agora `role="link"` com Enter).

- **Só com dados (na suíte completa, depois dos outros testes):** cartões da Central marcados como botão pelo arraste e com botões dentro (agora `role="group"`, com nome); o contador dos filtros da Central com opacidade 0,75; cartões de restaurante fechado no app do cliente com opacidade 0,62 (agora só a capa fica cinza); o selo "Pendente" da Minha Fatura a 4,49:1 sobre o próprio fundo tingido (`--warn` claro passou a #775214).

Segunda passada: 154 (restavam estilos inline com altura menor e a cor secundária); terceira: **0 violações e 0 alvos pequenos** com as telas vazias; os quatro casos acima apareceram com os dados dos outros testes e foram corrigidos na sequência. A varredura roda a checagem só no desktop e no celular (o tablet segue com as checagens de layout). Limite conhecido: a varredura abre as telas (rotas); diálogos e gavetas que só abrem com um clique (cadastro de produto, lançar pedido, fechar conta) passam pelas mesmas regras globais de tamanho e pelos mesmos tokens, mas não pelo axe. Resolvido na rodada C: `tests/e2e/dialogos.spec.ts` (UX-04).

**01/10 — rodada "Prompt C" (cards parciais e pontos abertos de A e B).** Um commit por item (`C-x` no início da mensagem). Casos novos: ATD-15, SEG-09 a SEG-11, UX-04, UX-05; SEG-03 passou a automático; números novos em QR-04, CARGA-02 a CARGA-07 e na seção 7. Suíte no fim da rodada (`npm test`): 129 testes de API, todos passaram; 87 de tela, 86 passaram e 1 foi pulado (a Central em 4 colunas, que não existe no celular).

| Item | O que mudou | Casos |
| --- | --- | --- |
| C-0 | Árvore limpa; as alterações apontadas no A (lighthouse, `pico.mjs`, `cenario.mjs`) estão em a5d7c5d, 4b0bf6f e ce0316f | — |
| C-1 | Ícones do Font Awesome servidos do próprio bundle (SVG em máscara CSS), sem o cdnjs; LCP 3,03–3,18 → 2,20–2,34 s | UX-05, QR-04, CARGA-04 |
| C-2 | Sem `CF-Connecting-IP`, só os limites por IP deixam de valer; mesa, pedidos da mesa, funcionário e bloqueio da conta valem | SEG-09 |
| C-3 | Baixa de estoque num comando SQL; 29 fechamentos juntos: 0,59 → 0,20 s local, 29,8 → 2,43 s no Supabase | CARGA-07, EST-07, MES-17 |
| C-4 | Latência até o banco: pooler em modo transação 102,6 ms × direta 19,0 ms por consulta (seção 7) | — |
| C-5 | WhatsApp: o webhook vem sem a mídia; a API baixa da Evolution até 8 MB; acima disso, o aviso na conversa certa | ATD-15, ATD-13, ATD-07 |
| C-6 | Buckets do Storage versionados (`prisma/buckets.ts` no `db:deploy`); `cardapio` só PNG/JPEG/WebP | SEG-10 |
| C-7 | Varredura de acessibilidade dos diálogos, folhas, popovers e formulários: 40 → 0 | UX-04 |
| C-8 | Testes de `HOST` vazio (127.0.0.1) e do `docker compose config` sem a chave; rodam no CI | SEG-03 |
| C-9 | Chave da Evolution de 64 hex só no `apps/api/.env`; contêiner recriado; a antiga dá 401 | SEG-11 |
| C-10 | README e `.env.example` | — |

**UX-04, diálogos (C-7).** `tests/e2e/dialogos.spec.ts` abre, com o Dono do fogo, desktop e celular, claro e escuro: no desktop, a Central com pedido aguardando aceite, notificações, Fechar conta (maquininha e PIX pelo sistema), o menu da mesa ao editar o salão, Lançar pedido (opções do prato e revisão), Cardápio (Adicionar prato, Organizar prato), Produtos (Novo item com ficha técnica, item com Ajustar estoque, Filtros), Contas a Pagar (Novo lançamento com mais opções, Quitar, Filtros com o calendário do período), Atendimento (Filtros), Promoções (Novo cupom), Aparência (Pré-visualizar) e Super Admin (Novo restaurante); no celular, os comuns mais as folhas de Fechar conta, Transferir e Dividir conta, Minha conta, as opções do prato, Reordenar categorias, Organizar prato, Novo lançamento, uma conversa e Novo cupom. Gerar novo QR é o `confirm` do navegador: o teste confere o texto e cancela. Antes: 40 achados (regra × diálogo × aparelho × tema), 112 elementos. Corrigido: dias de outro mês no calendário com opacidade 0,32 (2,0:1) → tinta secundária; botão principal ao passar o mouse virava `--sec` sob o texto claro (2,6:1) → a marca mais escura; `--brandText` do escuro #C9743F → #D88852 (3,8 → 4,8:1 no selo "Novo"); nomes em botões só com ícone (enviar e respostas rápidas no Atendimento, remover adicional, subir/descer categoria, pessoas −/+), no select de status e nos campos dos adicionais; o seletor de cor da Aparência de 30 para 44 px e o cinza antigo (#87837A) da pré-visualização; `aria-readonly` num `div`. Depois: 0. (Uma primeira passada crua deu 69 / 308: medida no meio da animação de entrada dos painéis e com 4 diálogos que o teste ainda não abria.)

## 7. Desempenho com a casa cheia (01/10/2026, PERF-01 a PERF-03)

**Rodada "Prompt B".** `npm run carga`: a casa cheia (`tests/load/pico.mjs`, só `fetch` do Node) e, com ela rodando, o Lighthouse no cardápio (`tests/load/cardapio.mjs`) e o pedido → Central nas telas de verdade (`tests/load/painel.spec.ts`, 20 execuções). Os dois apps são servidos já construídos (`vite build` + `vite preview`, com gzip), como o celular os recebe.

**Cenário** (`tests/load/cenario.mjs`): 30 mesas com 4 celulares cada (o máximo), 15 tablets fixos (mesas 1 a 15), 10 aparelhos da equipe na Central (logins cozinha, garcom, gerente e dono, 3/3/2/2), 60 s de chegada e 10 pedidos/min por 10 min. Tudo sai do IP do Wi-Fi (`CF-Connecting-IP`, como chega pelo túnel), então os limites do A valem. Polling do código:

| Tela | O que consulta | Intervalo | Onde |
| --- | --- | --- | --- |
| Central de Pedidos | pedidos, chamados, turno | 4 s | `apps/dashboard/src/screens/OrdersScreen.tsx:77` |
| Menu lateral (todas as telas do painel) | pedidos, chamados, tickets (não para a cozinha) | 15 s | `apps/dashboard/src/lib/live.ts:33` |
| Cardápio aberto (celular e tablet) | itens (disponibilidade) | 12 s | `apps/web/src/screens/MenuScreen.tsx:58` |
| Status do pedido | o pedido, enquanto aguarda aceite ou está em Recebido | 3 s | `apps/web/src/screens/OrderStatusScreen.tsx:38` |

Além do polling: um prato aberto a cada ~20 s por aparelho; a cozinha aceita o pedido de mesa livre 10 s depois que ele aparece e começa o preparo 30 s depois. No fim, os garçons fecham as 29 contas juntos.

**Máquina:** AMD Ryzen 7 5700G (8 núcleos, 16 threads), 32 GB, Windows 11 Pro (10.0.26200), Node 22.18.0, Docker Desktop. API, Postgres local, gerador de carga, Chrome (Lighthouse e Playwright) e `vite preview` na mesma máquina. A Evolution (v2.3.7) estava no ar, mas sem conversa nenhuma: o cenário não tem WhatsApp.

| Medida | a) API + Postgres local (Docker) | b) API local + Supabase de testes | Meta |
| --- | --- | --- | --- |
| Requisições (no pico, do IP do Wi-Fi) | 19.795 (1.789/min) | 19.496 (1.764/min) | — |
| Pedidos gravados | 100/100 | 100/100 | todos |
| Lighthouse celular, rota do QR: LCP · TTI · FCP | 3,03 · 3,03 · 1,66 s | 3,18 · 3,18 · 1,66 s | LCP e TTI ≤ 2 s ❌ |
| Lighthouse tablet (1280×800): LCP · TTI · FCP | 3,04 · 3,04 · 1,65 s | 3,18 · 3,18 · 1,66 s | ❌ |
| Cardápio montado na API (restaurante + categorias + itens): p50 · p95 · p99 | 0,01 · 0,01 · 0,01 s | 0,26 · 0,30 · 0,33 s | ≤ 2 s ✅ |
| Pedido → Central, mesa livre (20 execuções): p50 · p95 · pior | 2,40 · 3,95 · 3,96 s | 3,23 · 5,26 · 5,30 s | ≤ 5 s: a ✅ b ❌ |
| Pedido → Central, mesa aberta (20 execuções): p50 · p95 · pior | 1,38 · 3,92 · 3,94 s | 2,31 · 4,90 · 5,34 s | ≤ 5 s: a ✅ b ❌ |
| Pedido → cada uma das 10 Centrais simuladas (100 pedidos): p50 · p95 · máx | 2,07 · 3,96 · 4,05 s | 3,14 · 4,81 · 5,38 s | — |
| Respostas 4xx/5xx · 429 | 0 · 0 | 0 · 0 | nenhum 429 ✅ |
| API no pico: CPU média · máx (de um núcleo) · memória máx | 10% · 20% · 207 MB | 12% · 18% · 200 MB | — |
| Evolution no pico: CPU · memória | 0% · 191 MB | 0% · 191 MB | — |

Rotas públicas do cardápio, p50 · p95 · p99 em ms (a · b): `GET /api/tables/:qr` 3 · 6 · 7 · 144 · 160 · 160; restaurante 3 · 5 · 9 · 103 · 118 · 156; categorias 4 · 7 · 9 · 204 · 228 · 280; itens 6 · 10 · 16 · 251 · 288 · 310; aparência 3 · 5 · 8 · 103 · 114 · 119; prato 3 · 5 · 9 · 143 · 160 · 175; status do pedido 3 · 5 · 9 · 143 · 160 · 170.

**Limites do A (CARGA-05).** Nenhum 429 nos dois ambientes. Maior uso de cada limite numa janela deslizante (≥ a janela fixa da API), a · b: IP 1.880 · 1.879 de 15.000/min; funcionário (garcom, com a fila de fechamento do fim) 221 · 220 de 600/min; mesa 85 · 73 de 900/min; pedidos de uma mesa 5 · 8 de 40 em 5 min; logins do IP 11 · 11 de 50 em 15 min.

### Gargalos (não corrigidos nesta rodada)

**PERF-01: cardápio em 3,0–3,2 s (meta 2 s), no celular e no tablet, nos dois bancos.** O servidor não pesa: documento em 0 ms, API em milissegundos, TBT 0 e 95 ms de script mesmo com a CPU 4× mais lenta (sem limitação, o LCP real é 142 ms). O LCP é o nome do restaurante no topo do cardápio, e 85% do tempo é "atraso de renderização": ele espera a cadeia de rede. Experimentos com o mesmo build:

| Variação | LCP |
| --- | --- |
| Como hoje | 3,03 s |
| API na mesma origem do cardápio (sem preflight `OPTIONS`) | 2,89 s |
| Direto em `/r/chapa27/menu` (sem o passo de resolver a mesa) | 3,03 s |
| Sem o Font Awesome do cdnjs (CSS bloqueado) | 2,28 s |
| Mesma origem e sem Font Awesome | 2,29 s |

O peso está no Font Awesome do cdnjs (`apps/web/index.html`): CSS de outra origem que bloqueia a renderização (100 KB, 19 KB com gzip) mais a fonte `fa-solid-900.woff2` de 153 KB, disputando os 1,6 Mbps com o JS, para os 48 ícones que o app usa. **Correção mínima:** tirar o `<link>` do cdnjs e servir só esses 48 ícones (subconjunto da fonte ou SVG no próprio bundle): ≈ −0,75 s, para ~2,3 s. Abaixo de 2 s ainda falta ~0,3 s, e o resto é a cadeia documento → JS de 70 KB (gzip) → API. Nenhuma mudança de uma linha resolve isso; a próxima a medir é começar a buscar o cardápio no `index.html`, em paralelo com o JS.

**PERF-02 no Supabase: p95 5,26 s e pior 5,34 s (meta 5 s); local, pior 4,05 s.** O tempo até o card é: o `POST /api/orders` gravar + esperar a próxima consulta da Central (0 a 4 s) + a consulta. No Supabase, o `POST` leva 1,06 s (p50; local 22 ms) e a consulta de pedidos 0,30 s. Medido: cada ida e volta ao banco custa ~102 ms (`SELECT 1` pelo pooler 6543, p50 de 30), e um pedido pelo QR faz 16 comandos SQL em sequência (19 com a mesa aberta). A consulta da Central faz 4 + 3 + 3. Logo, 1,06 + 4 + 0,30 ≈ 5,4 s no pior caso, que é o observado. **Correção mínima:** Central a cada 3 s em vez de 4 (`OrdersScreen.tsx:77`): pior ≈ 4,4 s. Efeito colateral: a Central passa de ~57 para ~72 requisições/min por aparelho, e 10 aparelhos com o mesmo login dariam 720/min, acima dos 600 de `STAFF_PER_MINUTE`. Junto, subir esse limite para 800 (`apps/api/src/lib/rateLimit.ts`). Alternativa sem mexer no polling: menos idas ao banco no `POST /api/orders`, uma mudança maior.

**Fora das metas pedidas, para o PERF-03: fechar 29 contas ao mesmo tempo leva até 29,8 s no Supabase (p50 13,7 s; local, máx 0,59 s).** O fechamento baixa o estoque numa transação com um `UPDATE "Product"` + um `INSERT "StockMovement"` por insumo (14 comandos para 2 pedidos). O lock da linha de cada insumo em comum (pão, blend, cheddar…) fica preso até o `COMMIT`, ~1,4 s no Supabase. Os fechamentos entram em fila: o pior caso ≈ 29 × ~1 s, e localmente 29 × 20 ms ≈ 0,59 s, o mesmo padrão. **Correção mínima:** baixar o estoque num comando só (`UPDATE … FROM (VALUES …)` e o `INSERT` das movimentações numa mesma CTE), para o lock durar uma ida ao banco. Vinte e nove fechamentos no mesmo segundo é o estresse do fim do script, não o pico de 10 minutos.

**Limites da medição.** O Lighthouse roda sem o cabeçalho do IP: com ele, o cdnjs bloqueava o CSS do Font Awesome e o cardápio media ~0,75 s mais rápido do que num celular real (até a rodada B; desde o C-1 nada vem do cdnjs). O gerador não faz os preflights `OPTIONS` que o navegador faz: o `cors()` responde a eles antes do limite, então eles não contam nos limites, só custam CPU. Tudo roda numa máquina só, e a API usou no máximo 20% de um núcleo. O cardápio foi servido pelo `vite preview` (gzip), não pela Vercel. A rodada b deixou o Chapa 27 no projeto Supabase de testes, com ~140 pedidos fechados e o estoque consumido.

### Rodada C (01/10/2026): ícones sem CDN (C-1) e baixa de estoque num comando (C-3)

Mesmo cenário, mesma máquina, `npm run carga` e `npm run carga -- supabase` com as duas mudanças. Antes = rodada B (acima).

| Medida | Local antes → depois | Supabase antes → depois | Meta |
| --- | --- | --- | --- |
| Lighthouse celular, rota do QR: LCP (mediana de 3) | 3,03 → **2,21 s** | 3,18 → **2,34 s** (as 3: 2,34 · 2,34 · 2,57) | LCP ≤ 2,5 s ✅ |
| Lighthouse tablet (1280×800): LCP | 3,04 → **2,20 s** | 3,18 → **2,34 s** | ✅ |
| TTI · FCP (celular) | 3,03 → 2,23 · 1,66 → 1,21 s | 3,18 → 2,36 · 1,66 → 1,21 s | — |
| Contas fechadas ao mesmo tempo no fim (`POST /close`) | máx 0,59 → **0,20 s** (p50 agora 0,16 s; 27 mesas) | p50 13,7 → 2,31 s · máx 29,8 → **2,43 s** (28 mesas) | sem meta |
| Pedidos · 4xx/5xx · 429 | 100/100 · 0 · 0 | 100/100 · 0 · 0 | ✅ |
| Pedido → Central nas telas, p95 (mesa livre · aberta) | 3,97 · 3,96 s | 4,82 · **5,49 s** ❌ | ≤ 5 s |

**C-1:** sem o CSS e a fonte do cdnjs (render-blocking de outra origem + 153 KB), o LCP caiu 0,8 s nos dois bancos e o FCP, 0,45 s. Os ícones vêm do próprio bundle (`src/styles/icons.css`, 8,3 KB com gzip no app do cliente).

**C-3:** a baixa de estoque passou de um `UPDATE` + um `INSERT` por insumo (cada um uma ida ao banco, com o lock da linha preso até o `COMMIT`) para um comando só, que trava os insumos em ordem de id e baixa tudo de uma vez. No Supabase, as 28 contas deixaram de entrar em fila: cada fechamento leva ~2,3 s (as ~20 idas ao banco do fechamento, a ~100 ms cada pelo pooler) e todos terminam juntos. Os testes de ficha técnica e de baixa passaram sem alteração.

**Ainda fora da meta (não é item da rodada C):** pedido → Central no Supabase, p95 5,49 s. O `POST /api/orders` leva 1,16 s (p50) com 16–19 comandos a ~100 ms; a seção abaixo (C-4) mostra que ~80 ms de cada ida vêm do `pgbouncer=true`.

### Latência até o banco (C-4, 01/10/2026, só medição)

Do processo da API (Node 22.18 + o Prisma Client da API, nesta máquina) até o projeto Supabase de testes (`sa-east-1`): 50 × `SELECT 1` em sequência por modo, depois de abrir a conexão. Nenhuma configuração foi mudada.

| Conexão | Host:porta | p50 | p95 | Segunda rodada p50 · p95 |
| --- | --- | --- | --- | --- |
| a) `DATABASE_URL` de hoje: **pooler (Supavisor) em modo transação**, com `pgbouncer=true` | `aws-0-sa-east-1.pooler.supabase.com:6543` | 102,6 ms | 104,1 ms | 113,8 · 115,0 ms |
| b) **conexão direta** ao Postgres (só IPv6; esta máquina tem) | `db.<ref>.supabase.co:5432` | 19,0 ms | 19,4 ms | 19,0 · 19,5 ms |
| (`DIRECT_URL` de hoje: pooler em modo sessão) | `aws-0-sa-east-1.pooler.supabase.com:5432` | 23,1 ms | 24,1 ms | 21,5 · 21,8 ms |

De onde vem a diferença: não é o pooler, é o `pgbouncer=true` do Prisma (sem cache de *prepared statements*, cada consulta vira várias idas e voltas). O modo sessão **com** `pgbouncer=true` mede 109,5 ms; o modo transação **sem** ele, 21,6 ms. Mas atrás de um pooler em modo transação o Prisma pede essa opção (comandos preparados não sobrevivem à troca de conexão), então lá o custo é esse.

**Recomendação:** a API roda como um processo só, sempre ligado, no PC do restaurante (ADR 0009) — não é serverless, então não precisa do modo transação. Use em `DATABASE_URL` a **conexão direta** (19 ms) se a rede do restaurante tiver IPv6, ou o **pooler em modo sessão, porta 5432** (21–23 ms, funciona em IPv4) — é a recomendação do próprio Supabase para servidores persistentes. Os dois sem `pgbouncer=true` e com `connection_limit` explícito (ex.: `&connection_limit=10`): o padrão do Prisma nesta máquina seria 2 × 16 threads + 1 = 33 conexões, o que pode passar do tamanho do pool do modo sessão (Database → Settings no Supabase). Efeito esperado: cada ida ao banco cai de ~100 ms para ~20 ms; o `POST /api/orders` no Supabase (1,06 s com 16–19 comandos, PERF-02) cairia para ~0,3–0,4 s (estimativa: 16–19 × 20 ms). Não foi aplicado: a troca é de configuração do ambiente e precisa ser medida de novo com `npm run carga -- supabase`.

### Rodada D (01/10/2026): a pilha de produção nesta máquina (D-8) e a restauração do backup (D-7)

**Como:** um clone deste repositório num diretório de rascunho fez o papel da VM: `deploy/.env` com `CADDY_TLS=internal`, `PUBLIC_IP=127.0.0.1` e, no lugar do Supabase, um Postgres 17.11 descartável. Tudo pelo `deploy/deploy.sh` e pelo `deploy/docker-compose.prod.yml` commitados; Docker Desktop 29.7.2 (Windows 11). No fim, `down -v`: nenhum contêiner, volume ou rede do projeto `cardapio` ficou, e nada escuta na 80 e na 443.

| Verificação | Resultado |
| --- | --- |
| `docker compose config`: quem publica portas | só `caddy`: 80→80/tcp e 443→443/tcp; `api`, `evolution`, `evolution-db` e `backup`: nenhuma (também no teste automático, SEG-13) |
| Primeiro `deploy/deploy.sh` (banco vazio) | 18 migrações aplicadas num contêiner avulso, API `healthy`, "No ar: ba554ff …". A primeira tentativa achou um erro: o contêiner da API pegou o `172.30.0.2` do Caddy (corrigido no commit "D-1: fix", `ip_range` na metade de cima da subnet) |
| API pelo Caddy em HTTPS | `https://127.0.0.1/api/health` → `{"ok":true}` (200), certificado conferido contra a raiz interna do Caddy (`verify=0`); servido sem SNI, SAN `IP Address:127.0.0.1` |
| HTTP → HTTPS | `http://127.0.0.1/api/health` → 308, `Location: https://127.0.0.1/api/health` |
| Webhook da Evolution pela rede interna (de dentro do contêiner da Evolution para `http://api:4100/api/whatsapp/webhook`) | com o segredo: 200 `{"ok":true}`; sem: 401; segredo errado: 401 |
| Evolution sem acesso de fora | nenhuma porta publicada (`docker port` vazio); o endereço dela na rede do Compose (`172.30.0.131:8080`) não responde do host (timeout); de dentro da rede responde ("Welcome to the Evolution API … 2.3.7"); `/`, `/manager` e `/instance/fetchInstances` pelo Caddy caem na API (404 "no route"). Nesta máquina a 8080 do host já é de outro projeto (`delivery-menu-1`, um nginx), então "a 8080 não responde" não se aplica aqui; na VM ela fica fechada |
| `CF-Connecting-IP` forjado | 51 logins, cada um com um IP forjado diferente: pelo Caddy, 50 × 401 + 1 × 429 (o Caddy sobrescreveu, todos contaram para o mesmo IP); direto na API, do contêiner da Evolution (não confiável), 50 × 401 + 1 × 429 |
| Volumes depois de `docker compose up -d --build --force-recreate` (os 5 contêineres recriados) | mesmo certificado (SHA-256 `2E:15:26:02:DA:4E:F3:23…`, emitido 21:06:14 UTC), a instância `prova-persistencia` da Evolution (no `evolution_db`, tabela `Instance`; a sessão do WhatsApp fica na tabela `Session` do mesmo banco), o arquivo de marcação em `evolution_instances` e o backup do dia |
| Volumes depois de reiniciar o Docker (`docker desktop restart`, no lugar de reiniciar a VM) | os 5 contêineres voltaram sozinhos (`unless-stopped`, nenhum comando de compose), API `healthy`, os mesmos certificado, instância, marcação e backup |
| Rollback | numa cópia "origin" de rascunho, uma versão nova simulada (`/api/health` com `"versao":"simulada"`): `deploy.sh` → `{"ok":true,"versao":"simulada"}`; `deploy.sh ba554ff` → `{"ok":true}`, sem `db:deploy`, HEAD destacado; `deploy.sh` de novo → a versão nova, na `master` |
| Seeds | `deploy.sh seed-demo` sem senha: recusa; com `SEED_DEMO_PASSWORD`: Chapa 27 criado (30 itens, 31 insumos, 30 mesas), login do dono com essa senha pelo Caddy; de novo: "já existe — nada foi alterado"; `deploy.sh seed`: "Recusado"; `npm run db:seed` dentro do contêiner de produção: "Recusado" (exit 1) |
| Serviço `backup` | ao subir (depois das 04:00), gravou `cardapio-2026-10-01.dump` (56 KB) do banco local; recriado, não gravou de novo |
| Imagem de produção no Supabase de testes, pelo pooler em modo **sessão** com `connection_limit=10` (o `DATABASE_URL` do `deploy/.env.example`) | só leitura: 30 itens do Chapa 27; `SELECT 1` de dentro do contêiner p50 20,9 ms, p95 21,5 ms (o C-4 mediu 21–23 ms) |
| Imagem `linux/arm64` (`docker buildx build --platform linux/arm64`, 2 min 31 s, emulada) | engine `linux-arm64-openssl-3.0.x`; aplicou as 18 migrações num Postgres 17 e consultou com `process.arch = arm64` |

**Restauração do backup (D-7).** `pg_dump` 17.11 do projeto Supabase de testes com as opções do serviço `backup` (`--format=custom --schema=public --no-owner --no-privileges`): 128 KB em 2,7 s. Restaurado num Postgres 17.11 descartável, uma vez com `pg_restore` direto e outra com o comando do README (`docker compose … run --rm backup pg_restore --schema=public --no-owner --no-privileges --exit-on-error …`): exit 0 nas duas, RLS ligado em 21 de 21 tabelas. Sem `--schema=public`, o `pg_restore` para em `CREATE SCHEMA public` ("already exists"), por isso a opção.

| Tabela | Supabase antes do dump | Supabase depois | Restaurado |
| --- | --- | --- | --- |
| `Order` | 428 | 428 | 428 |
| `OrderLine` | 717 | 717 | 717 |
| `StockMovement` | 942 | 942 | 942 |
| `Product` | 133 | 133 | 133 |
| `FinanceEntry` | 107 | 107 | 107 |
| `MenuItem` | 102 | 102 | 102 |
| `ProductComponent` | 77 | 77 | 77 |
| `RestaurantTable` | 40 | 40 | 40 |
| `MenuCategory` | 34 | 34 | 34 |
| `_prisma_migrations` | 18 | 18 | 18 |
| `OperatingHour` | 14 | 14 | 14 |
| `StaffMember` | 8 | 8 | 8 |
| `Restaurant` | 7 | 7 | 7 |
| as outras 8 (`Address` 2, `BillingCharge` 3, `Coupon` 4, `PaymentMethod` 4, `Review` 5, `SupportMessage` 6, `SupportTicket` 3, `WaiterCall` 1) | iguais | iguais | iguais |

**O que esta máquina não prova:** o certificado do Let's Encrypt para o IP (precisa de um IP público com as portas 80 e 443 abertas: só na VM; a configuração passa no `caddy validate` e o `caddy adapt` mostra o emissor `acme` com o perfil `shortlived`); o IP real do visitante chegando ao Caddy (no Docker Desktop toda conexão do host chega pelo gateway; num Linux com Docker, a publicação de porta preserva o IP de origem em IPv4); a reinicialização de uma VM de verdade (aqui, o Docker reiniciou; na VM é o `systemctl enable docker` que traz tudo de volta).

### Rodada E (02/10/2026): segurança, histórico do pedido, lista do delivery e backup do Storage

Casos novos nas seções 4.18 (SEG-15 a SEG-25), 4.19 (OBS) e 4.20 (DESC); os achados da auditoria estão em `docs/seguranca/auditoria-2026-10.md`.

**Backup do Storage (E-4, BKP-01), contra o projeto Supabase de testes.** Como na Rodada D: um diretório de rascunho com o `deploy/docker-compose.prod.yml` commitado e um `deploy/.env` com as chaves S3 do `apps/api/.env` (projeto de testes). A pasta `/backups` do serviço num volume Docker (Linux), para as permissões valerem — o NTFS desta máquina não guarda modo de arquivo. Os dois buckets estavam vazios; os arquivos da prova foram enviados num prefixo próprio (`prova-bkp-01/`) e apagados no fim, com o contêiner, o volume e a rede: os buckets voltaram a 0 objeto.

| Passo | No Supabase (`rclone size` e `storage.objects`) | Na cópia local |
| --- | --- | --- |
| Envio da prova | `cardapio` 5 (3 PNG, 2 JPEG); `whatsapp-media` 3 (2 OGG, 1 JPEG) | — |
| Serviço `storage-backup` sobe (depois das 04:00, sem `.ultima-copia`) | — | log: "cardapio, 5 arquivos" e "whatsapp-media, 3 arquivos"; `.ultima-copia` com o dia |
| Permissões | — | pastas `700 root`, arquivos `600 root` (umask 077, como o dump) |
| +1 PNG no `cardapio` e segunda cópia | `cardapio` 6 | só `prova-bkp-01/foto-4.png: Copied (new)`; `whatsapp-media`: "There was nothing to transfer"; `cardapio` 6 arquivos, os 5 antigos não baixados de novo |
| Terceira cópia | 6 e 3 | "Transferred: 0 B / 0 B", "Checks: 6 / 6" e "3 / 3" |
| Perda simulada: `rclone delete` do prefixo nos dois buckets | 0 e 0 | 6 e 3 (a cópia nunca apaga) |
| Restauração (o comando do README, com o tipo pela extensão) | `cardapio` 6 e `whatsapp-media` 3, com `image/png`, `image/jpeg` e `audio/ogg` e os mesmos tamanhos (10–14 B) | — |

**Pilha de produção de novo (mexemos em `deploy/`):** o teste do compose de produção (SEG-13, agora também com o `storage-backup` e o log com teto de cada serviço) passa; a imagem da API construída para `linux/arm64` (`docker buildx build --platform linux/arm64 --no-cache`), engine `linux-arm64-openssl-3.0.x`, build sem cache em 2 min 13 s (emulado); com a própria imagem, `prisma migrate deploy` num Postgres 17.11 descartável aplicou as 20 migrações (`9i` e `9j` incluídas), e o Prisma da imagem leu `OrderEvent` (0 linhas, RLS ligado) com `process.arch = arm64`.

**`npm test` antes de cada push** (API e telas no Postgres descartável, nesta máquina) **e o CI** depois:

| Push | Commits | API (passaram / falharam / pulados) | Telas (passaram / falharam / pulados) | CI |
| --- | --- | --- | --- | --- |
| Base (antes da rodada) | `cccd0cd` | 132 / 0 / 0 | 86 / 0 / 1 | — |
| 1º | `a99cf86`…`ea0fb19` (12) | 147 / 0 / 0 | 86 / 0 / 1 | ✅ run 36957900059 (15 min 44 s) |
| 2º | `c2d1f7b`…`27f3d60` (9) | 154 / 0 / 1 | 89 / 0 / 1 | ✅ run 36960082396 (19 min 16 s) |
| 3º | `cfe1df7` e a documentação | 154 / 0 / 1 | 89 / 0 / 1 | ver o relatório da rodada |

O teste pulado da API é o do `deploy.sh` (SEG-24), que só roda em Linux (o CI); o das telas é o de sempre (a Central no celular, coberta no desktop e no tablet). **Supabase de testes:** as migrações `9i` e `9j` aplicadas com `npm run db:deploy` (02/10): 22 tabelas com RLS, `OrderEvent` incluída; os 7 restaurantes com o módulo Delivery; o advisor de segurança só com "RLS Enabled No Policy" (INFO).

### Rodada F (02/10/2026): as decisões da auditoria

As decisões pendentes da auditoria (`docs/seguranca/auditoria-2026-10.md`, seção 5) tomadas em 02/10 e implementadas, cada uma com um teste que falhava no código anterior:

| Item | Decisão | Casos | Antes → depois |
| --- | --- | --- | --- |
| F-1 (SEG-A01) | Cupom só do restaurante, válido pelas regras de Promoções; desconto calculado no servidor e gravado no pedido | CUP-01 a CUP-04 | `cupom.test.ts`: 4 de 5 falhavam ("abc" dava 10%) → 5 de 5 |
| F-2 (SEG-A06) | Troca/reset de senha encerra as sessões; quem troca a própria senha segue no aparelho | SEN-07, SEN-08 | `sessoes.test.ts`: 4 de 5 falhavam (os tokens seguiam valendo) → 5 de 5 |
| F-3 (SEG-A07) | Pedido de comanda fechada não muda de status | PED-17 | `fechado.test.ts`: "cancelado" respondia 200 → 409 |
| F-4 (SEG-A21) | Fechar conta: garçom e acima; editar o mapa: Administrador e Dono | MES-18, MES-19 | autorização: garçom e cozinha criavam/moviam/excluíam mesas → 403; telas por papel: os botões apareciam para todos → escondidos |
| F-5 (SEG-A31) | Sem destaques fixos no app do cliente | DESC-04 | bundle com "Fogo & Nó" e "Forno di Napoli" → nenhum nome de restaurante |
| F-6 | Delivery desligado por padrão (Super Admin e Chapa 27 do seed) | DESC-05 | restaurante novo e Chapa 27 com Delivery → sem |
| F-7 | Tempo máximo do CI: 25 → 40 min | — | (a execução do CI é a prova) |
| Achado no `npm test` | Texto sobre a cor de alerta legível no tema escuro (token `--alertInk`) | UX-06 | o selo da Central no celular, tema escuro: 3,51:1 → 5,5:1 |

**`npm test` antes do push** (nesta máquina): API 166 passaram, 0 falharam, 1 pulado (o do `deploy.sh`, só Linux); telas 93 passaram, 0 falharam, 1 pulado (o de sempre). A primeira execução achou o UX-06 (1 falha no celular, tema escuro); corrigido e rodado de novo. CI: ver a execução do último commit da rodada.

