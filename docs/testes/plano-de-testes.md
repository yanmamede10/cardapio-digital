# Plano de testes — salão, WhatsApp, produtos/estoque, financeiro e Super Admin

Escopo do cliente (hamburgueria): **salão e comandas** (QR da mesa, tablet, mapa do salão), **WhatsApp no Atendimento**, **produtos, estoque e ficha técnica**, **financeiro** (contas a pagar/receber, Visão Geral, DRE). Mais: login, troca obrigatória de senha, permissões, configurações e **Super Admin** (lista, detalhe, módulos, reset de senha, mensalidades).
Fora do escopo: Emissão Fiscal e delivery próprio. Só entram para conferir que o módulo desligado some do menu e a API responde 403.

## 1. Como usar este arquivo

**Automático:** `npm test` roda tudo (API + telas) num Postgres descartável. `npm run test:carga` roda o teste de horário de pico. A coluna **Auto** de cada caso diz onde ele está na suíte:

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
| `e2e:fluxo` | `tests/e2e/fluxo-critico.spec.ts` |
| `e2e:varredura` | `tests/e2e/varredura.spec.ts` (3 tamanhos × 2 temas) |
| `e2e:desktop` / `e2e:mobile` | `tests/e2e/desktop.spec.ts` / `tests/e2e/mobile.spec.ts` |
| `carga` | `tests/load/pico.mjs` |
| **M** | manual (roteiro abaixo) |

**Manual:** rode o seed de demonstração num banco local (`npm run db:seed:demo --workspace apps/api`), suba API, dashboard e cardápio (README), e siga os passos. Logins do Chapa 27, todos com a senha do seed:

| Papel | E-mail |
| --- | --- |
| Dono | `dono@chapa27.example` |
| Administrador | `gerente@chapa27.example` |
| Funcionário · Garçom | `garcom@chapa27.example` |
| Funcionário · Cozinha | `cozinha@chapa27.example` |

Cardápio do cliente pela mesa: no painel, **Mesas → selecione a mesa → QR code** copia o link `…/t/chapa27.<número>`.

**Coluna 27/09:** resultado da rodada de 27/09/2026 (seção 6). ✅ passou · ✅ M passou no roteiro manual · ✅ corrigido (B##) falhou e foi corrigido nesta rodada · ❌ P2-## falha cosmética registrada, não corrigida · ⏳ depende de aparelho ou do ambiente hospedado.

**Tamanhos de tela:** desktop 1366×820, tablet em paisagem 1280×800 (toque), celular 390×844 (toque). **Temas:** claro e escuro (botão de tema no menu lateral ou na aba Mais). Em cada tela, o mínimo é: nada vaza para fora da tela (sem rolagem horizontal da página), textos legíveis nos dois temas, sem erro no console e sem chamada da API com erro.

## 2. Matriz de acesso (funcionalidade × papel)

✔ = vê e usa · 👁 = só vê · — = não aparece no menu e a API responde 403 · 🔑 = só com a chave de Super Admin.

| Funcionalidade | Dono | Administrador | Garçom | Cozinha |
| --- | --- | --- | --- | --- |
| Central de Pedidos (aceitar, recusar, avançar) | ✔ | ✔ | ✔ | ✔ |
| Mesas: mapa, comanda, fechar conta, transferir, QR | ✔ | ✔ | ✔ | ✔ |
| Mesas: editar ambiente (grade, nova mesa, renomear, excluir) | ✔ | ✔ | ✔ | ✔ |
| Cardápio: ver e marcar Esgotado/Disponível | ✔ | ✔ | ✔ | ✔ |
| Cardápio: adicionar, organizar, remover, reordenar, foto | ✔ | ✔ | 👁 | 👁 |
| Atendimento (tickets, WhatsApp, avaliações) | ✔ | ✔ | ✔ | — |
| Produtos (catálogo, ficha técnica, XML, movimentações) | ✔ | ✔ | — | — |
| Relatórios | ✔ | ✔ | — | — |
| Visão Geral · Resumo | ✔ | ✔ | — | — |
| Visão Geral · DRE | ✔ | — | — | — |
| Contas a Pagar / a Receber (lançar, quitar, excluir) | ✔ | ✔ | — | — |
| Minha Fatura | ✔ | ✔ | — | — |
| Configurações (menu) | ✔ | — | — | — |
| Configurações → Equipe & Permissões, WhatsApp (conectar) | ✔ | — | — | — |
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
| Cardápio | `/cardapio` | todos | A+M | A+M | A+M |
| Atendimento | `/atendimento` | Dono, Adm, Garçom | A+M | A+M | A+M |
| Produtos | `/produtos` | Dono, Adm | A+M | A+M | A+M |
| Relatórios | `/relatorios` | Dono, Adm | A+M | A+M | A+M |
| Visão Geral (+DRE) | `/visao-geral` | Dono, Adm | A+M | A+M | A+M |
| Contas a Pagar | `/contas-a-pagar` | Dono, Adm | A+M | A+M | A+M |
| Contas a Receber | `/contas-a-receber` | Dono, Adm | A+M | A+M | A+M |
| Minha Fatura | `/financeiro` | Dono, Adm | A+M | A+M | A+M |
| Configurações | `/config` (+ subtelas no celular) | Dono | A+M | A+M | A+M |
| Super Admin: lista, detalhe, mensalidades | `/admin…` | chave | A+M | A+M | A+M |
| Cardápio do cliente (QR/tablet) | `apps/web` `/t/:código`, `/r/:id/menu` | cliente | A+M | A+M | A+M |

## 4. Casos de teste

Formato: **ID · caso · papel · passos e dados · esperado · Auto**. "Qualquer" = qualquer papel que vê a tela.

### 4.1 Login e sessão (AUT)

| ID | Caso | Papel | Passos e dados | Esperado | Auto | 27/09 |
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

### 4.2 Troca obrigatória de senha (SEN)

| ID | Caso | Papel | Passos e dados | Esperado | Auto | 27/09 |
| --- | --- | --- | --- | --- | --- | --- |
| SEN-01 | Primeiro login com senha provisória | Dono novo | Super Admin cadastra; ativa; Dono entra com a provisória | Só aparece "Crie sua senha" | api:admin, e2e:desktop | ✅ + M |
| SEN-02 | Provisória errada na troca | Dono novo | Senha provisória diferente | "A senha provisória não confere" | api:admin | ✅ |
| SEN-03 | Nova senha curta ou igual | Dono novo | `123`; ou igual à provisória | Mensagens de 6 caracteres / "precisa ser diferente" | api:admin | ✅ |
| SEN-04 | Repetição diferente | Dono novo | Nova ≠ repetida | "As duas senhas novas não são iguais" | M | ✅ M |
| SEN-05 | Até trocar, nada mais funciona | Dono novo | Chamar qualquer rota com o token | 403 "password change required" | api:admin | ✅ |
| SEN-06 | Reset derruba sessão aberta | Garçom | Super Admin reseta a senha com o garçom logado | Próximo request 403 → só a troca | api:admin | ✅ |

### 4.3 Permissões e módulos (PER)

| ID | Caso | Papel | Passos e dados | Esperado | Auto | 27/09 |
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

| ID | Caso | Papel | Passos e dados | Esperado | Auto | 27/09 |
| --- | --- | --- | --- | --- | --- | --- |
| QR-01 | QR abre o restaurante certo | cliente | Link da Mesa 12 do Chapa 27 | Cardápio do Chapa 27, modo mesa, Mesa 12 | api:salao, e2e:fluxo | ✅ corrigido (B01) |
| QR-02 | QR de mesa que não existe | cliente | `/t/chapa27.99` | "Mesa não encontrada" | api:salao | ✅ |
| QR-03 | QR de restaurante inativo ou inexistente | cliente | `/t/naoexiste.1` | "Mesa não encontrada" | api:salao | ✅ |
| QR-04 | Carregamento do cardápio | cliente | Abrir pelo QR | Categorias e 30 itens em até 2 s | carga | ✅ p95 0,39–0,53 s |
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
| QR-19 | Tema claro/escuro e cor da marca | cliente | Alternar tema | Legível nos dois; botões na cor da marca | M | ✅ M |
| QR-20 | Erro ao confirmar aparece na revisão | cliente | Item esgota enquanto o cliente revisa; confirmar | Aviso "… está esgotado"; carrinho mantido | e2e:fluxo | ✅ corrigido (B19) |

### 4.5 Central de Pedidos (PED)

| ID | Caso | Papel | Passos e dados | Esperado | Auto | 27/09 |
| --- | --- | --- | --- | --- | --- | --- |
| PED-01 | Pedido novo aparece | todos | Cliente pede na Mesa 3 | Card em "Recebido" em até 5 s | e2e:fluxo, carga | ✅ p95 3,4–4,1 s |
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
| PED-14 | Aceitar e recusar o mesmo pedido juntos | Cozinha + Garçom | Um aceita enquanto o outro recusa | Só um vale; o outro recebe "não foi possível"; o pedido está na comanda se e só se não foi recusado | api:salao | ✅ corrigido (B20) |

### 4.6 Mesas: mapa, comanda, fechamento e transferência (MES)

| ID | Caso | Papel | Passos e dados | Esperado | Auto | 27/09 |
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
| MES-13 | QR code da mesa | Garçom | QR code | Copia o link `…/t/chapa27.<n>` | e2e:fluxo | ✅ |
| MES-14 | Editar ambiente | Adm | Grade 13×13, nova mesa, arrastar, renomear, excluir | Posições salvas; mesa aberta não pode ser renomeada/excluída (409) | M | ✅ M |
| MES-15 | Fechar conta no celular | Garçom | Mesa → Fechar conta | Pede a forma de pagamento antes de fechar; lançamento em Contas a Receber | e2e:mobile | ✅ corrigido (B15) |
| MES-16 | Mesa sem pedidos | Garçom | Fechar conta em mesa livre | Botão desabilitado | M | ✅ M |
| MES-17 | Mesas diferentes fecham ao mesmo tempo | 10 Garçons | 10 mesas com Clássico, Cheddar & Bacon, batata e onion rings (ordem alternada) fecham juntas | Todas fecham; estoque e 10 recebíveis certos (sem deadlock) | api:salao | ✅ corrigido (B04) |

### 4.7 Produtos, estoque e ficha técnica (EST)

| ID | Caso | Papel | Passos e dados | Esperado | Auto | 27/09 |
| --- | --- | --- | --- | --- | --- | --- |
| EST-01 | Cadastrar insumo | Adm | "Pão de batata", un, custo 2,35 | Aparece no catálogo, "Sem estoque" | api:estoque | ✅ |
| EST-02 | Produto composto (ficha técnica) | Adm | Lanche com 1 pão + 1 blend | Custo = soma; campo travado | api:estoque, e2e:desktop | ✅ |
| EST-03 | Validações da ficha | Adm | Componente composto, inexistente, quantidade 0 | 400 com mensagem | api:estoque | ✅ |
| EST-04 | Nome com acento e longo | Adm | "Pão de açúcar ç" e 81 caracteres | Aceita acento; limita a 80 | api:estoque | ✅ |
| EST-05 | Importar XML de NF-e | Adm | Nota com pão e insumo novo | Estoque sobe; custo médio ponderado; insumo novo criado | api:estoque, e2e:desktop | ✅ |
| EST-06 | XML inválido | Adm | Arquivo quebrado | "Arquivo XML inválido"; nada gravado | api:estoque | ✅ M |
| EST-07 | Baixa pela ficha ao fechar comanda | Garçom | 2× Cheddar & Bacon | Pão −2, blend −2, cheddar −0,12 kg, bacon −0,08 kg | api:estoque, e2e:fluxo | ✅ |
| EST-08 | Estoque pode ficar negativo | Garçom | Vender mais bacon do que há | Estoque negativo em vermelho; venda não é bloqueada | api:estoque | ✅ |
| EST-09 | Produto simples baixa a si mesmo | Garçom | 3× Refrigerante lata | −3 no próprio produto | api:estoque | ✅ |
| EST-10 | Movimentações | Adm | Aba Movimentações; filtros | Entradas (XML) e saídas (Fechamento de comanda #…) | e2e:desktop | ✅ |
| EST-11 | Editar preço no catálogo | Adm | Clássico 32,90 → 33,90 | Cardápio mostra o preço novo | api:estoque | ✅ |
| EST-12 | Lista grande | Adm | 150 produtos | Tela abre e filtra | api:grandes, M | ✅ + M (0,6 s) |

### 4.8 Cardápio no painel (CAR)

| ID | Caso | Papel | Passos e dados | Esperado | Auto | 27/09 |
| --- | --- | --- | --- | --- | --- | --- |
| CAR-01 | Vincular prato do catálogo | Adm | Adicionar prato → categoria | Aparece no cardápio | e2e:desktop | ✅ |
| CAR-02 | Duplo clique em Adicionar | Adm | Clicar duas vezes | Um prato só | e2e:desktop | ✅ (mesmo mecanismo do FIN-06) |
| CAR-03 | Organizar prato mantém os grupos | Adm | Mudar a descrição do Clássico | "Ponto da carne" continua; só os adicionais são editados | api:cardapio, e2e:desktop | ✅ corrigido (B08) |
| CAR-04 | Adicionais | Adm | Novo adicional "Cheddar cremoso" 5,00 | Aparece no cliente com +R$ 5,00 | api:cardapio | ✅ |
| CAR-05 | Esgotado/Disponível | todos | Chave | Muda na hora; cliente vê em até 12 s | api:cardapio, e2e:desktop | ✅ (decisão: qualquer papel) |
| CAR-06 | Remover do cardápio | Adm | Remover (confirma) | Some do cardápio; continua no catálogo | e2e:mobile | ✅ |
| CAR-07 | Reordenar | Adm | Arrastar categoria/prato | Ordem salva e igual no cliente | M | ✅ M |
| CAR-08 | Foto do prato | Adm | Enviar foto | Sem Storage configurado: aviso de erro; com Storage: aparece | M (hospedado) | ✅ M sem Storage · ⏳ com Storage |

### 4.9 Contas a pagar e a receber (FIN)

| ID | Caso | Papel | Passos e dados | Esperado | Auto | 27/09 |
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

### 4.10 Visão Geral e DRE (VG)

| ID | Caso | Papel | Passos e dados | Esperado | Auto | 27/09 |
| --- | --- | --- | --- | --- | --- | --- |
| VG-01 | Resumo | Adm | Abrir | Saldo 30 dias, a pagar/receber 7 dias, atrasadas, maiores despesas | e2e:desktop | ✅ + M |
| VG-02 | Comanda fechada entra nas entradas | Adm | Fechar uma comanda hoje | "Entradas" de hoje somam o valor cobrado | e2e:fluxo | ✅ |
| VG-03 | DRE do mês | Dono | Aba DRE | Entrou/Saiu/Sobrou; demonstrativo contábil | e2e:desktop | ✅ |
| VG-04 | DRE escondido do Administrador | Adm | Abrir Visão Geral | Sem a aba DRE | e2e:desktop | ✅ |
| VG-05 | Mês sem lançamentos | Dono | DRE de um mês vazio | "Nenhum lançamento" | M | ✅ M |

### 4.11 Relatórios (REL)

| ID | Caso | Papel | Passos e dados | Esperado | Auto | 27/09 |
| --- | --- | --- | --- | --- | --- | --- |
| REL-01 | Hoje/7 dias/Mês | Adm | Trocar o período | KPIs, gráfico, mais e menos vendidos, mapa de calor | M | ✅ M |
| REL-02 | Números batem com as comandas | Adm | Fluxo crítico | Faturamento de hoje = soma dos pedidos (sem serviço); pedidos recusados não entram | e2e:fluxo, api:salao | ✅ |
| REL-03 | Sem dados | Adm | Restaurante novo | Zeros, sem erro | M | ✅ M |

### 4.12 Atendimento e WhatsApp (ATD)

| ID | Caso | Papel | Passos e dados | Esperado | Auto | 27/09 |
| --- | --- | --- | --- | --- | --- | --- |
| ATD-01 | Aceitar aviso e conectar | Dono | Configurações → WhatsApp | Aceite registrado (quem/quando); QR do provedor | api:zap | ✅ |
| ATD-02 | Só o Dono conecta | Adm | Conectar | 403 | api:zap | ✅ |
| ATD-03 | Mensagem recebida vira ticket | Garçom | Webhook de mensagem | Ticket WhatsApp; reentrega não duplica | api:zap | ✅ |
| ATD-04 | Responder | Garçom | Enviar resposta | Sai pelo provedor; dá "visto" nas pendentes | api:zap | ✅ |
| ATD-05 | Duplo Enter / duplo clique | Garçom | Enviar a mesma resposta duas vezes seguidas | Uma mensagem só | e2e:desktop | ✅ corrigido (B09) |
| ATD-06 | Envio falha | Garçom | Provedor fora | Mensagem não fica como enviada; aviso | api:zap | ✅ |
| ATD-07 | Mídia | Garçom | Foto/áudio | Bucket privado; URL assinada | api:zap | ✅ |
| ATD-08 | Assumir ticket | Garçom | "Assumir" | Responsável = quem clicou (não um nome fixo) | e2e:desktop | ✅ corrigido (B14) |
| ATD-09 | Desconectado | Garçom | Sessão cai | Faixa vermelha "WhatsApp desconectado" | M | ✅ M |
| ATD-10 | Isolamento | Dono de outro restaurante | Ler/responder ticket alheio | 404/403 | api:zap | ✅ |
| ATD-11 | Números reais | Dono | Ambiente hospedado com Evolution | Receber, responder, foto, áudio | M (hospedado) | ⏳ hospedado |

### 4.13 Configurações (CFG)

| ID | Caso | Papel | Passos e dados | Esperado | Auto | 27/09 |
| --- | --- | --- | --- | --- | --- | --- |
| CFG-01 | Perfil | Dono | Nome e descrição com acento | Salva; cabeçalho mostra o nome do restaurante | e2e:desktop | ✅ corrigido (B13) M |
| CFG-02 | Horários | Dono | Domingo fechado | Salva | M | ✅ M (seed: segunda fechada) |
| CFG-03 | Equipe: adicionar/editar | Dono | Novo garçom, e-mail repetido, senha curta | Salva; 409; aviso | e2e:desktop, api:perm | ✅ |
| CFG-04 | Financeiro: forma de recebimento | Dono | Maquininha própria / PIX via sistema | Salva e muda o fechamento | M | ✅ M |
| CFG-05 | Financeiro: serviço 10% | Dono | Ligar/desligar | Comanda e recebível acompanham | api:salao, e2e:desktop | ✅ (decisão: novo) |
| CFG-06 | Fiscal | Dono | Regime inválido | 400 | M | ✅ M |
| CFG-07 | Aparência | Dono | Cor, prévia, publicar | Cliente vê a cor publicada | M | ✅ M |

### 4.14 Super Admin (ADM)

| ID | Caso | Papel | Passos e dados | Esperado | Auto | 27/09 |
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

| ID | Caso | Passos | Esperado | Auto | 27/09 |
| --- | --- | --- | --- | --- | --- |
| E2E-01 | Pedido pelo QR até o financeiro | 1. Cliente abre o QR da Mesa 12 do Chapa 27 e pede 2× Cheddar & Bacon (Bem passado + Bacon extra, obs "sem cebola") e 1× Refrigerante lata. 2. O pedido aparece na Central com opções e observação. 3. A cozinha aceita, marca pronto e entrega. 4. O garçom fecha a conta no Cartão. 5. Estoque baixa pela ficha técnica. 6. Contas a Receber, Visão Geral, Turno de hoje e Relatórios batem. | Itens 2×(38,90+6,00)+7,00 = 96,80; com serviço 10% = 106,48 cobrado e lançado; pão −2, blend −2, cheddar −0,12, bacon −0,08, refrigerante −1; Relatórios: 96,80 a mais em "Hoje" | e2e:fluxo | ✅ |

### 4.16 Carga de horário de pico (CARGA)

| ID | Caso | Como | Meta | Auto | 27/09 |
| --- | --- | --- | --- | --- | --- |
| CARGA-01 | 30 mesas pedindo ao mesmo tempo | 30 clientes carregam o cardápio e enviam pedidos juntos, em 3 rodadas | Todos os pedidos gravados, sem erro | carga | ✅ 90/90 |
| CARGA-02 | Pedido até aparecer no painel | 4 painéis (Central, como na tela, a cada 4 s) + 6 tablets (Mesas a cada 10 s) consultando em paralelo | p95 ≤ 5 s | carga | ✅ p95 3,4–4,1 s |
| CARGA-03 | Carregamento do cardápio | Restaurante + categorias + itens + aparência, 30 clientes simultâneos | p95 ≤ 2 s | carga | ✅ p95 0,39–0,53 s |

### 4.17 Varredura de telas (UI)

| ID | Caso | Como | Esperado | Auto | 27/09 |
| --- | --- | --- | --- | --- | --- |
| UI-01 | Todas as telas × papel × tamanho × tema | Seção 3 | Sem rolagem horizontal, sem erro de JS, sem chamada com erro | e2e:varredura | ✅ 3 × 2 (sem erro, sem rolagem) |
| UI-02 | Legibilidade no escuro | Olhar cada tela no tema escuro | Texto legível, nada branco-no-branco | M | ✅ M (amostra) |
| UI-03 | Textos longos | Nome de prato com 80 caracteres, descrição de conta com 120 | Corta com reticências, não quebra o layout | M | ✅ M |
| UI-04 | Central inteira no tablet e no desktop | Central com a cozinha em 1280×800 e com o Dono em 1366×820 | As 4 colunas cabem na tela; chamados e turno viram uma faixa acima | e2e:varredura | ✅ corrigido (B18) |
| ROB-01 | Requisição malformada não derruba a API | PATCH de prato com preço "abc" (Administrador) | Erro só nessa requisição; a API segue respondendo | api:robustez | ✅ corrigido (B05) |

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

Mudanças de produto decididas: comanda fechada vira recebível pago; serviço de 10% opcional por restaurante; excluir lançamento; sessão de 24 h; Esgotado para qualquer papel.

P2 (registrados, não corrigidos):

| ID | O que acontece |
| --- | --- |
| P2-01 | Senha errada no login mostra "invalid credentials" (em inglês). |
| P2-02 | "1.500" num campo de valor vira R$ 1,50 (o ponto é lido como decimal quando não há vírgula). |
| P2-03 | O código do pedido tem 4 dígitos aleatórios e se repete ao longo do dia (a descrição do recebível desambigua pela mesa). |
| P2-04 | "Organizar prato" sempre regrava o horário como "Almoço 11:00 – 15:00 · Jantar 18:00 – 23:00". |
| P2-05 | "Abrir comanda" na mesa livre (celular) só mostra um aviso; o texto fala em lançar pedido manualmente, o que não existe. |
| P2-06 | A coluna "Entregue / Servido" acumula todos os pedidos do dia. |
| P2-07 | No cabeçalho, "Aberto" é fixo e a busca não faz nada. |
| P2-08 | O valor da mensalidade no Super Admin aparece como "299.9". |
| P2-09 | Os botões "Imprimir" só mostram um aviso. |
| P2-10 | Duas "Nova mesa" ao mesmo tempo: a segunda falha com erro 500. |
| P2-11 | O cliente não vê os 10% de serviço no resumo do pedido. |
| P2-12 | Estoque em kg/L acumula resíduo de ponto flutuante (exibido com 3 casas). |
| P2-13 | Atendimento recarrega todos os tickets com todas as mensagens a cada 6 s (cresce com o volume de WhatsApp). |
| P2-14 | A chave do serviço de 10% só existe no desktop (Configurações do celular não tem Financeiro). |
| P2-15 | Chamar garçom duas vezes gera dois chamados. |

Decisões em aberto (lacunas de produto, não bugs): criar/renomear/excluir categorias do cardápio (um restaurante cadastrado pelo Super Admin não consegue montar o cardápio); ajuste manual de estoque (estoque inicial, contagem); garçom lançar pedido sem QR; adicionais com ficha técnica (o "Bacon extra" não baixa bacon).
