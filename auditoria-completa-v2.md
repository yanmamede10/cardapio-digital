# Re-auditoria de código — Ecossistema para Restaurantes

Repositório: `cardapio-digital` (monorepo). SaaS de gestão para restaurantes com três frentes: cardápio digital + comandas presenciais (QR na mesa, tablet fixo), delivery próprio, e um painel super admin pra a equipe da plataforma.

Esta é uma re-auditoria completa dos 68 requisitos abaixo, sucedendo uma primeira auditoria de 16–17/09. Desde então, várias coisas foram implementadas (algumas por você mesmo, autoavaliadas) e a arquitetura mudou em alguns pontos — os itens abaixo já refletem os requisitos **atualizados**, não os originais.

## Metodologia (siga à risca)

- Para cada item, **leia o código real** — não confie em nome de função, comentário, ou no fato de uma tela existir visualmente. Um botão que não tem handler, ou um estado que nunca é persistido, não atende.
- Vereditos: **✅ atende** / **⚠️ parcial** (existe algo, mas incompleto ou não é real) / **❌ não atende**.
- Toda vereditos precisa de **evidência**: arquivo + trecho ou comportamento observado. Sem evidência, o veredito não vale.
- Itens marcados **[AUTOAVAL]** foram auto-avaliados como concluídos por uma sessão anterior do Claude Code, sem revisão independente — trate com ceticismo extra, mesmo que pareçam corretos à primeira vista.
- Itens marcados **[PROMPT ENTREGUE]** tiveram um prompt de implementação escrito e entregue, mas não há confirmação de que rodou ou funcionou como esperado — verifique do zero, como qualquer outro item.
- Para itens que dependem de outro (ex: RF-COM-05 depende de estoque existir), o veredito do item dependente nunca pode ser melhor que o veredito do item do qual ele depende.

## Contexto que mudou desde a auditoria anterior

- **PIX**: arquitetura é subconta Asaas por restaurante, com split de pagamento — delivery sempre aplica split (taxa da plataforma), presencial não aplica (100% pro restaurante).
- **Recebimento presencial agora é configurável por restaurante** (ver RF-FIN-01 abaixo): o restaurante escolhe entre "PIX via sistema" (usa a arquitetura acima) ou "maquininha própria" (eles já têm um dispositivo que faz cartão + PIX direto na conta deles; nesse caso, o sistema só registra a forma de pagamento e confirma manualmente, sem QR nem webhook).
- **Storage de imagens**: Cloudflare R2 (S3-compatible), pra logo e fotos do restaurante.
- **Personalização de página** (templates, cor, upload, preview) foi implementada de ponta a ponta nessa fase — é o bloco com mais itens [AUTOAVAL] abaixo.

---

## 2.1 Cardápio digital (RF-CARD)
- **RF-CARD-01** [P0] — Cliente acessa o cardápio via QR code na mesa sem precisar criar conta ou logar.
- **RF-CARD-02** [P0] — O tablet fixo na mesa mostra o mesmo cardápio, mesma rota/motor do QR.
- **RF-CARD-03** [P0] — Mesa, tablet e delivery leem os mesmos dados de cardápio, uma fonte única.
- **RF-CARD-04** [P0] — Itens organizados por categoria, navegável.
- **RF-CARD-05** [P0] — Cliente adiciona observação em texto livre por item do pedido.
- **RF-CARD-06** [P0] [PROMPT ENTREGUE] — Quando o restaurante marca um item indisponível no dashboard, isso reflete pro cliente via polling (não só no próximo load da página).

## 2.2 Personalização da página do restaurante (RF-PERS)
- **RF-PERS-01** [P0] [AUTOAVAL] — Restaurante escolhe entre 4 a 6 templates de layout fixos (sem editor livre); a escolha persiste e aparece de verdade no cardápio do cliente (QR/tablet/delivery).
- **RF-PERS-02** [P0] [AUTOAVAL] — Restaurante define cor de marca, aplicada de verdade nos elementos principais do cardápio do cliente.
- **RF-PERS-03** [P0] [AUTOAVAL] — Upload real de logo (Cloudflare R2), aparece no cardápio do cliente.
- **RF-PERS-04** [P0] [AUTOAVAL] — Upload real de fotos de capa (múltiplas), mesmo padrão do logo.
- **RF-PERS-05** [P0] [AUTOAVAL] — Existe distinção real entre rascunho (o que o restaurante edita) e publicado (o que o cliente vê); editar não muda o cardápio público até "Publicar".
- **RF-PERS-06** [P1] [AUTOAVAL] — A tela de descoberta (listagem de restaurantes) mantém a identidade visual da plataforma, não herda o template/cor de cada restaurante.

## 2.3 Comandas / Central de Pedidos (RF-COM)
- **RF-COM-01** [P0] — Primeiro pedido de uma mesa abre a comanda automaticamente; pedidos seguintes somam.
- **RF-COM-02** [P0] — Painel único mostra pedidos de mesa e delivery juntos, com filtro/ícone por canal.
- **RF-COM-03** [P0] — Kanban de status, operador arrasta pedido entre estágios.
- **RF-COM-04** [P0] — Fechar comanda calcula total corretamente e marca pedidos como servidos.
- **RF-COM-05** [P0] — Fechar comanda decrementa estoque dos itens vendidos (não pode atender se EST-01/02 não existirem).
- **RF-COM-06** [P1] — Cliente chama o garçom pelo app; vira chamado pro operador resolver.

## 2.4 App de delivery (RF-DELIV)
- **RF-DELIV-01** [P0] — Cliente se cadastra/loga de verdade (dado persistido, não é UUID anônimo em localStorage).
- **RF-DELIV-02** [P0] [PROMPT ENTREGUE — depende do PIX] — Checkout processa pagamento real via PIX (Asaas), não é rótulo estático.
- **RF-DELIV-03** [P0] — Cliente acompanha status do pedido em tempo real até a entrega.
- **RF-DELIV-04** [P1] — Cliente vê histórico de pedidos anteriores.
- **RF-DELIV-05** [P1] — Cliente repete um pedido antigo (reconstrói o carrinho).

## 2.5 Descoberta (RF-DESC)
- **RF-DESC-01** [P0] — Listagem de restaurantes mostra dados reais do banco.
- **RF-DESC-02** [P1] — Busca e filtro funcionam, feito no servidor.
- **RF-DESC-03** [P0] — Só aparecem restaurantes com módulo de delivery ativo.

## 2.6 Atendimento (RF-ATEND)
- **RF-ATEND-01** [P1] — Chat vinculado a um pedido específico (não é botão de suporte genérico).
- **RF-ATEND-02** [P1] — Cliente avalia o pedido depois de recebido.
- **RF-ATEND-03** [P2] — SLA de resposta monitorado com evento real de backend (não cálculo client-side com threshold fixo).

## 2.7 Painel Super Admin (RF-ADMIN)
- **RF-ADMIN-01** [P0] — Cadastro e ativação/desativação de restaurantes via endpoint + UI real (não seed de dev).
- **RF-ADMIN-02** [P0] — Visão consolidada de volume de pedidos/receita entre restaurantes (não só por restaurante).
- **RF-ADMIN-03** [P1] — Admin habilita/desabilita módulos contratados por restaurante (não é só leitura).
- **RF-ADMIN-04** (novo) [P1] — Visão de faturamento da plataforma: mensalidade + taxa sobre delivery por restaurante, teto de R$1000, status de pagamento.

*(O design dessas 4 telas já foi feito no Claude Design — não há confirmação de implementação em código, verifique do zero.)*

## 2.8 Pagamentos — PIX (RF-PIX / RF-FIN)
- **RF-PIX-SUB** (novo) [P0] — Fluxo de onboarding de subconta Asaas por restaurante (CNPJ, razão social, documento), com status pendente/aprovado/rejeitado.
- **RF-PIX-01** [P0] — Sistema gera QR PIX dinâmico real (via Asaas) — sempre no delivery; no presencial, só se `paymentMode === "sistema"` (ver RF-FIN-01).
- **RF-PIX-02** [P0] — Webhook recebe confirmação da Asaas e baixa o pedido/comanda automaticamente.
- **RF-PIX-03** [P0] — QR gerado expira depois de um tempo definido.
- **RF-PIX-04** [P1] — Conciliação do que foi recebido via split (quanto ficou pro restaurante, quanto foi taxa).
- **RF-FIN-01** (novo) [P0] [PROMPT ENTREGUE] — Restaurante tem campo `paymentMode` (`sistema` | `maquininha_propria`) configurável; determina se o fechamento de comanda mostra QR PIX ou seletor de forma de pagamento + confirmação manual.

## 2.9 Estoque (RF-EST)
- **RF-EST-01** [P0] — Sistema importa XML de NFe de fornecedor.
- **RF-EST-02** [P0] — Produtos do XML mapeados pro catálogo de insumos do restaurante.
- **RF-EST-03** [P0] — Fechar pedido decrementa automaticamente o estoque dos insumos usados.
- **RF-EST-04** [P1] — Alerta de estoque baixo.

## 2.10 Mapa do salão (RF-SALAO, novo)
- **RF-SALAO-01** (novo) [P1] [PROMPT ENTREGUE] — Admin posiciona cada mesa numa grade configurável (6x6 até 14x14) via drag-and-drop, persistindo `gridRow`/`gridCol`. Soltar sobre mesa ocupada troca as duas de posição (swap). Mesas sem posição aparecem numa lista à parte, sem reflow automático das demais.

## 3.1 Performance (RNF-PERF)
- **RNF-PERF-01** [P0] — Cardápio carrega em até 2s.
- **RNF-PERF-02** [P0] — Pedido novo aparece no painel do operador em até 5s.
- **RNF-PERF-03** [P1] — Sistema aguenta picos de almoço/jantar sem degradar.

## 3.2 Segurança (RNF-SEG)
- **RNF-SEG-01** [P0] [AUTOAVAL] — Autenticação por papel (hash de senha + JWT), middleware de autorização por rota.
- **RNF-SEG-02** [P0] [AUTOAVAL] — Isolamento multi-tenant real — teste ativamente tentar acessar dado de outro restaurante manipulando IDs, não só leia o código.
- **RNF-SEG-03** [P0] [PROMPT ENTREGUE] — Campos de texto livre (observação, chat) com limite de tamanho validado no client E no servidor.
- **RNF-SEG-04** [P0] — Nenhuma credencial hardcoded; segredos vêm de env vars.
- **RNF-SEG-05** [P0] — Rota de webhook do PSP valida autenticidade da requisição (assinatura/token).
- **RNF-SEG-06** [P1] — Rate limiting nos endpoints públicos.

## 3.3 Disponibilidade (RNF-DISP)
- **RNF-DISP-01** [P0] — Documente o acoplamento atual entre Central de Pedidos e delivery (mesma API/DB) — é risco aceito pro piloto de 1 restaurante, não precisa corrigir, só confirmar que segue documentado.
- **RNF-DISP-02** [P1] — Tratamento de falha do PSP (retry ou estado de erro claro).

## 3.4 Escalabilidade (RNF-ESC)
- **RNF-ESC-01** [P1] — Adicionar restaurante novo não exige novo build/deploy do dashboard (tenant resolvido em runtime via login).

## 3.5 Compliance (RNF-COMP)
- **RNF-COMP-01** [P0] — Dado de pagamento sensível nunca é armazenado diretamente — fica sempre no PSP.
- **RNF-COMP-02** [P1] — Cliente do delivery consegue solicitar exclusão dos seus dados (LGPD).

## 3.6 UX (RNF-UX)
- **RNF-UX-01** [P0] — Interface responsiva em mobile e tablet.
- **RNF-UX-02** [P0] — Modo escuro real, com persistência, nos apps principais.
- **RNF-UX-03** [P1] [PROMPT ENTREGUE] — Botões de ícone com pelo menos 44x44px de toque e `aria-label` onde não há texto visível.

## 3.7 Observabilidade (RNF-OBS)
- **RNF-OBS-01** [P1] — Evento real quando pedido é criado/pago/concluído (não só relatório agregado sob demanda).
- **RNF-OBS-02** [P1] — Captura de falhas de pagamento como evento.
- **RNF-OBS-03** [P2] — Rastreamento de funil de conversão do delivery.

## Fora de escopo (só confirme que segue não implementado por decisão, não é pra auditar a fundo)
- Módulo fiscal (NFC-e)
- Integração TEF
- Frota própria de entregadores
- Gestão com relatórios avançados

---

## Formato de saída

Pra cada um dos 68 itens acima, gere uma linha/bloco com: ID, veredito (✅/⚠️/❌), e a evidência (arquivo + trecho ou comportamento observado) que sustenta o veredito. Salve como um novo arquivo markdown (ex: `auditoria-<data>.md`) na raiz do repo, sem sobrescrever a auditoria anterior — quero poder comparar as duas.
