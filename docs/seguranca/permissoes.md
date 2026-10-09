# Permissões por rota

Gerado por `npx tsx scripts/gerar-permissoes.ts` a partir de `tests/api/rotas.mjs` (a lista de rotas do teste de autorização) e de
`SCREENS` (`packages/shared`: quem vê cada tela do painel). Não edite à mão: `tests/api/autorizacao.test.ts` falha se este arquivo
não for o gerado. `scripts/conferir-permissoes.mjs` confere as rotas GET numa pilha no ar (ver README, "Conferir permissões").

**Esperado:** 200 = acessa; 401 = sem login ou credencial que não vale aqui (o token da equipe nas rotas do Super Admin, a chave do
Super Admin nas rotas da equipe); 403 = papel abaixo do mínimo. Com o módulo desligado, toda rota do módulo responde 403, até para o
Dono. Token de outro restaurante: 403 ou 404 em toda rota da equipe. Cozinha e Garçom são o nível Funcionário; o Garçom passa onde a
Cozinha não (Atendimento, Fechar conta).

**⚠** = o papel acessa pela API algo que a tela dele não mostra (o menu e os botões que ele vê nunca chamam a rota).

| Método | Caminho | Para que serve | Módulo | Onde aparece | Sem login | Cozinha | Garçom | Administrador | Dono | Super Admin |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/health` | Saúde da API (monitoramento, deploy) | — | nenhuma | 200 | 200 | 200 | 200 | 200 | 200 |
| POST | `/api/auth/login` | Entrar (equipe) | — | login | 200 | 200 | 200 | 200 | 200 | 200 |
| GET | `/api/restaurants/` | Restaurantes do app do cliente (só os com Delivery) | — | app do cliente | 200 | 200 | 200 | 200 | 200 | 200 |
| GET | `/api/restaurants/:id` | Dados públicos do restaurante: nome, horários, aberto agora | — | app do cliente, todas (cabeçalho, sessão) | 200 | 200 | 200 | 200 | 200 | 200 |
| GET | `/api/restaurants/:id/categories` | Categorias com prato, na ordem do cardápio | — | app do cliente, Mesas | 200 | 200 | 200 | 200 | 200 | 200 |
| GET | `/api/restaurants/:id/items` | Pratos do cardápio | — | app do cliente, Cardápio, Mesas, Promoções e Cupons | 200 | 200 | 200 | 200 | 200 | 200 |
| GET | `/api/restaurants/:id/items/:itemId` | Um prato, com as opções | — | app do cliente | 200 | 200 | 200 | 200 | 200 | 200 |
| GET | `/api/restaurants/:id/appearance` | Aparência publicada do cardápio | — | app do cliente | 200 | 200 | 200 | 200 | 200 | 200 |
| GET | `/api/tables/:tableCode` | A mesa do QR (restaurante e número) | — | app do cliente | 200 | 200 | 200 | 200 | 200 | 200 |
| GET | `/api/payment-methods/` | Formas de pagamento do checkout | — | app do cliente | 200 | 200 | 200 | 200 | 200 | 200 |
| POST | `/api/coupons/apply` | Aplicar cupom no checkout | — | app do cliente | 200 | 200 | 200 | 200 | 200 | 200 |
| POST | `/api/orders/` | Fazer pedido (mesa pelo QR ou delivery) | — | app do cliente | 200 | 200 | 200 | 200 | 200 | 200 |
| GET | `/api/orders/` | Pedidos deste aparelho (X-Session-Id) | — | app do cliente | 200 | 200 | 200 | 200 | 200 | 200 |
| GET | `/api/orders/:id` | Acompanhar um pedido deste aparelho | — | app do cliente | 200 | 200 | 200 | 200 | 200 | 200 |
| POST | `/api/orders/:id/call-waiter` | Chamar o garçom pela mesa | — | app do cliente | 200 | 200 | 200 | 200 | 200 | 200 |
| POST | `/api/whatsapp/webhook/` | Mensagens recebidas do WhatsApp (Evolution, cabeçalho secreto) | — | nenhuma | 401 | 401 | 401 | 401 | 401 | 401 |
| GET | `/api/auth/me` | A própria sessão: papel e módulos | — | todas (cabeçalho, sessão) | 401 | 200 | 200 | 200 | 200 | 401 |
| POST | `/api/auth/password` | Trocar a própria senha | — | todas (cabeçalho, sessão) | 401 | 200 | 200 | 200 | 200 | 401 |
| GET | `/api/addresses/` | Endereços de entrega dos pedidos do próprio restaurante | — | nenhuma | 401 | 200 ⚠ | 200 ⚠ | 200 ⚠ | 200 ⚠ | 401 |
| GET | `/api/admin/restaurants` | Lista de restaurantes | — | Super Admin | 401 | 401 | 401 | 401 | 401 | 200 |
| POST | `/api/admin/restaurants` | Cadastrar restaurante e o Dono | — | Super Admin | 401 | 401 | 401 | 401 | 401 | 200 |
| GET | `/api/admin/restaurants/:id` | Detalhe do restaurante, equipe e WhatsApp | — | Super Admin | 401 | 401 | 401 | 401 | 401 | 200 |
| PATCH | `/api/admin/restaurants/:id` | Dados cadastrais | — | Super Admin | 401 | 401 | 401 | 401 | 401 | 200 |
| PATCH | `/api/admin/restaurants/:id/status` | Ativar ou desativar | — | Super Admin | 401 | 401 | 401 | 401 | 401 | 200 |
| PATCH | `/api/admin/restaurants/:id/modules` | Módulos contratados | — | Super Admin | 401 | 401 | 401 | 401 | 401 | 200 |
| POST | `/api/admin/restaurants/:id/staff/:staffId/reset-password` | Senha provisória de alguém da equipe | — | Super Admin | 401 | 401 | 401 | 401 | 401 | 200 |
| PATCH | `/api/admin/restaurants/:id/plan` | Valor e vencimento da mensalidade | — | Super Admin | 401 | 401 | 401 | 401 | 401 | 200 |
| GET | `/api/admin/billing` | Mensalidades | — | Super Admin | 401 | 401 | 401 | 401 | 401 | 200 |
| POST | `/api/admin/billing` | Gerar cobranças do mês | — | Super Admin | 401 | 401 | 401 | 401 | 401 | 200 |
| POST | `/api/admin/billing/:chargeId/pay` | Marcar mensalidade como paga | — | Super Admin | 401 | 401 | 401 | 401 | 401 | 200 |
| GET | `/api/restaurants/:id/orders` | Pedidos da Central | Central de Pedidos | Central de Pedidos | 401 | 200 | 200 | 200 | 200 | 401 |
| GET | `/api/restaurants/:id/shift-stats` | Números do turno na Central | Central de Pedidos | Central de Pedidos | 401 | 200 | 200 | 200 | 200 | 401 |
| POST | `/api/orders/:id/accept` | Aceitar pedido | Central de Pedidos | Central de Pedidos | 401 | 200 | 200 | 200 | 200 | 401 |
| POST | `/api/orders/:id/reject` | Recusar pedido | Central de Pedidos | Central de Pedidos | 401 | 200 | 200 | 200 | 200 | 401 |
| PATCH | `/api/orders/:id/stage` | Mudar a etapa do pedido | Central de Pedidos | Central de Pedidos | 401 | 200 | 200 | 200 | 200 | 401 |
| GET | `/api/restaurants/:id/tables` | Mesas e o estado de cada uma | Mesas | Mesas | 401 | 200 | 200 | 200 | 200 | 401 |
| POST | `/api/restaurants/:id/tables` | Criar mesa (Editar ambiente) | Mesas | Mesas (só administrador+) | 401 | 403 | 403 | 200 | 200 | 401 |
| GET | `/api/restaurants/:id/salon-grid` | Mapa do salão | Mesas | Mesas | 401 | 200 | 200 | 200 | 200 | 401 |
| PATCH | `/api/restaurants/:id/salon-grid` | Tamanho do mapa (Editar ambiente) | Mesas | Mesas (só administrador+) | 401 | 403 | 403 | 200 | 200 | 401 |
| PATCH | `/api/restaurants/:id/tables/:number/position` | Posição da mesa no mapa | Mesas | Mesas (só administrador+) | 401 | 403 | 403 | 200 | 200 | 401 |
| PATCH | `/api/restaurants/:id/tables/:number` | Renomear mesa | Mesas | Mesas (só administrador+) | 401 | 403 | 403 | 200 | 200 | 401 |
| DELETE | `/api/restaurants/:id/tables/:number` | Excluir mesa | Mesas | Mesas (só administrador+) | 401 | 403 | 403 | 200 | 200 | 401 |
| GET | `/api/restaurants/:id/tables/:number/comanda` | Comanda aberta da mesa | Mesas | Mesas | 401 | 200 | 200 | 200 | 200 | 401 |
| POST | `/api/restaurants/:id/tables/:number/orders` | Lançar pedido pela mesa | Mesas | Mesas | 401 | 200 | 200 | 200 | 200 | 401 |
| POST | `/api/restaurants/:id/tables/:number/close` | Fechar conta | Mesas | Mesas (só garcom+) | 401 | 403 | 200 | 200 | 200 | 401 |
| POST | `/api/restaurants/:id/tables/:number/transfer` | Transferir comanda | Mesas | Mesas | 401 | 200 | 200 | 200 | 200 | 401 |
| GET | `/api/restaurants/:id/tables/:number/qr` | QR da mesa (Imprimir QR) | Mesas | Mesas | 401 | 200 | 200 | 200 | 200 | 401 |
| POST | `/api/restaurants/:id/tables/:number/qr` | Gerar novo QR (o impresso deixa de valer) | Mesas | Mesas (só administrador+) | 401 | 403 | 403 | 200 | 200 | 401 |
| GET | `/api/restaurants/:id/waiter-calls` | Chamados de garçom (Central) | Mesas | Central de Pedidos | 401 | 200 | 200 | 200 | 200 | 401 |
| POST | `/api/restaurants/:id/waiter-calls/:callId/resolve` | Atender chamado de garçom | Mesas | Central de Pedidos | 401 | 200 | 200 | 200 | 200 | 401 |
| PATCH | `/api/restaurants/:id/items/:itemId/sold-out` | Esgotado / Disponível | Cardápio | Cardápio | 401 | 200 | 200 | 200 | 200 | 401 |
| POST | `/api/restaurants/:id/items` | Adicionar prato ao cardápio | Cardápio | Cardápio (só administrador+) | 401 | 403 | 403 | 200 | 200 | 401 |
| PATCH | `/api/restaurants/:id/items/:itemId` | Organizar prato | Cardápio | Cardápio (só administrador+) | 401 | 403 | 403 | 200 | 200 | 401 |
| POST | `/api/restaurants/:id/items/:itemId/image` | Foto do prato | Cardápio | Cardápio (só administrador+) | 401 | 403 | 403 | 200 | 200 | 401 |
| DELETE | `/api/restaurants/:id/items/:itemId` | Remover do cardápio | Cardápio | Cardápio (só administrador+) | 401 | 403 | 403 | 200 | 200 | 401 |
| POST | `/api/restaurants/:id/items/:itemId/duplicate` | Duplicar prato | Cardápio | nenhuma | 401 | 403 | 403 | 200 ⚠ | 200 ⚠ | 401 |
| POST | `/api/restaurants/:id/items/:itemId/move` | Reordenar prato | Cardápio | Cardápio (só administrador+) | 401 | 403 | 403 | 200 | 200 | 401 |
| GET | `/api/restaurants/:id/categories/all` | Todas as categorias, com quantos itens | Cardápio ou Produtos | Cardápio, Produtos | 401 | 200 | 200 | 200 | 200 | 401 |
| POST | `/api/restaurants/:id/categories/:categoryId/move` | Reordenar categoria | Cardápio ou Produtos | Cardápio (só administrador+), Produtos | 401 | 403 | 403 | 200 | 200 | 401 |
| POST | `/api/restaurants/:id/categories` | Nova categoria | Cardápio ou Produtos | Cardápio (só administrador+), Produtos | 401 | 403 | 403 | 200 | 200 | 401 |
| PATCH | `/api/restaurants/:id/categories/:categoryId` | Renomear categoria | Cardápio ou Produtos | Cardápio (só administrador+), Produtos | 401 | 403 | 403 | 200 | 200 | 401 |
| DELETE | `/api/restaurants/:id/categories/:categoryId` | Excluir categoria (ou mover os itens e excluir) | Cardápio ou Produtos | Cardápio (só administrador+), Produtos | 401 | 403 | 403 | 200 | 200 | 401 |
| GET | `/api/restaurants/:id/coupons` | Cupons | Promoções e Cupons | Promoções e Cupons | 401 | 403 | 403 | 200 | 200 | 401 |
| POST | `/api/restaurants/:id/coupons` | Novo cupom | Promoções e Cupons | Promoções e Cupons | 401 | 403 | 403 | 200 | 200 | 401 |
| PATCH | `/api/restaurants/:id/coupons/:couponId` | Ativar ou pausar cupom | Promoções e Cupons | Promoções e Cupons | 401 | 403 | 403 | 200 | 200 | 401 |
| DELETE | `/api/restaurants/:id/coupons/:couponId` | Excluir cupom | Promoções e Cupons | Promoções e Cupons | 401 | 403 | 403 | 200 | 200 | 401 |
| POST | `/api/restaurants/:id/coupons/:couponId/duplicate` | Duplicar cupom | Promoções e Cupons | Promoções e Cupons | 401 | 403 | 403 | 200 | 200 | 401 |
| GET | `/api/restaurants/:id/tickets` | Conversas do Atendimento | Atendimento | Atendimento | 401 | 403 | 200 | 200 | 200 | 401 |
| PATCH | `/api/restaurants/:id/tickets/:ticketId` | Status da conversa | Atendimento | Atendimento | 401 | 403 | 200 | 200 | 200 | 401 |
| POST | `/api/restaurants/:id/tickets/:ticketId/messages` | Responder (WhatsApp) | Atendimento | Atendimento | 401 | 403 | 200 | 200 | 200 | 401 |
| POST | `/api/restaurants/:id/tickets/:ticketId/media` | Enviar foto ou áudio | Atendimento | Atendimento | 401 | 403 | 200 | 200 | 200 | 401 |
| GET | `/api/restaurants/:id/reviews` | Avaliações | Atendimento | Atendimento, Relatórios | 401 | 403 | 200 | 200 | 200 | 401 |
| POST | `/api/restaurants/:id/reviews/:reviewId/reply` | Responder avaliação | Atendimento | Atendimento | 401 | 403 | 200 | 200 | 200 | 401 |
| GET | `/api/restaurants/:id/whatsapp` | Estado da conexão do WhatsApp | Atendimento | Atendimento, Configurações | 401 | 403 | 200 | 200 | 200 | 401 |
| POST | `/api/restaurants/:id/whatsapp/terms` | Aceitar o aviso de risco do WhatsApp | Atendimento | Configurações | 401 | 403 | 403 | 403 | 200 | 401 |
| POST | `/api/restaurants/:id/whatsapp/connect` | Conectar o WhatsApp (QR) | Atendimento | Configurações | 401 | 403 | 403 | 403 | 200 | 401 |
| POST | `/api/restaurants/:id/whatsapp/disconnect` | Desconectar o WhatsApp | Atendimento | Configurações | 401 | 403 | 403 | 403 | 200 | 401 |
| GET | `/api/restaurants/:id/products` | Catálogo (produtos e insumos) | Produtos | Produtos, Cardápio (só administrador+) | 401 | 403 | 403 | 200 | 200 | 401 |
| POST | `/api/restaurants/:id/products` | Novo produto ou insumo | Produtos | Produtos | 401 | 403 | 403 | 200 | 200 | 401 |
| PATCH | `/api/restaurants/:id/products/:productId` | Editar produto ou insumo | Produtos | Produtos | 401 | 403 | 403 | 200 | 200 | 401 |
| GET | `/api/restaurants/:id/stock-movements` | Movimentações de estoque | Produtos | Produtos | 401 | 403 | 403 | 200 | 200 | 401 |
| POST | `/api/restaurants/:id/stock-movements/adjust` | Ajustar estoque (entrada, saída, contagem, custo) | Produtos | Produtos | 401 | 403 | 403 | 200 | 200 | 401 |
| POST | `/api/restaurants/:id/stock-movements/xml` | Importar XML de nota | Produtos | Produtos | 401 | 403 | 403 | 200 | 200 | 401 |
| GET | `/api/restaurants/:id/analytics` | Relatórios | Relatórios | Relatórios | 401 | 403 | 403 | 200 | 200 | 401 |
| GET | `/api/restaurants/:id/finance-entries` | Contas a pagar e a receber (sem tipo: Visão Geral) | Visão Geral | Visão Geral, Contas a Pagar, Contas a Receber | 401 | 403 | 403 | 200 | 200 | 401 |
| POST | `/api/restaurants/:id/finance-entries` | Novo lançamento | Contas a Pagar | Contas a Pagar, Contas a Receber | 401 | 403 | 403 | 200 | 200 | 401 |
| POST | `/api/restaurants/:id/finance-entries/:entryId/pay` | Quitar conta | Contas a Pagar | Contas a Pagar, Contas a Receber | 401 | 403 | 403 | 200 | 200 | 401 |
| DELETE | `/api/restaurants/:id/finance-entries/:entryId` | Excluir lançamento | Contas a Pagar | Contas a Pagar, Contas a Receber | 401 | 403 | 403 | 200 | 200 | 401 |
| GET | `/api/restaurants/:id/closed-orders` | Pedidos fechados para emitir nota | Emissão Fiscal | Emissão Fiscal | 401 | 403 | 403 | 200 | 200 | 401 |
| GET | `/api/restaurants/:id/finance` | Minha Fatura | — | Minha Fatura | 401 | 403 | 403 | 200 | 200 | 401 |
| GET | `/api/restaurants/:id/payment-mode` | Como o restaurante cobra (maquininha ou PIX) e se aceita pedido pelo QR | — | Mesas, Configurações | 401 | 200 | 200 | 200 | 200 | 401 |
| GET | `/api/restaurants/:id/profile` | Perfil do restaurante | — | Configurações | 401 | 403 | 403 | 403 | 200 | 401 |
| PATCH | `/api/restaurants/:id/profile` | Editar perfil | — | Configurações | 401 | 403 | 403 | 403 | 200 | 401 |
| GET | `/api/restaurants/:id/hours` | Horários | — | Configurações | 401 | 403 | 403 | 403 | 200 | 401 |
| PATCH | `/api/restaurants/:id/hours` | Editar horários | — | Configurações | 401 | 403 | 403 | 403 | 200 | 401 |
| GET | `/api/restaurants/:id/fiscal` | Dados fiscais | — | Configurações | 401 | 403 | 403 | 403 | 200 | 401 |
| PATCH | `/api/restaurants/:id/fiscal` | Editar dados fiscais | — | Configurações | 401 | 403 | 403 | 403 | 200 | 401 |
| PATCH | `/api/restaurants/:id/payment-mode` | Forma de cobrança, pedido pelo QR e serviço de 10% | — | Configurações | 401 | 403 | 403 | 403 | 200 | 401 |
| GET | `/api/restaurants/:id/appearance/draft` | Rascunho da aparência | — | Configurações | 401 | 403 | 403 | 403 | 200 | 401 |
| PATCH | `/api/restaurants/:id/appearance/draft` | Editar o rascunho da aparência | — | Configurações | 401 | 403 | 403 | 403 | 200 | 401 |
| POST | `/api/restaurants/:id/appearance/publish` | Publicar a aparência | — | Configurações | 401 | 403 | 403 | 403 | 200 | 401 |
| POST | `/api/restaurants/:id/appearance/upload` | Enviar logo ou capa | — | Configurações | 401 | 403 | 403 | 403 | 200 | 401 |
| GET | `/api/restaurants/:id/staff` | Equipe | — | Configurações | 401 | 403 | 403 | 403 | 200 | 401 |
| POST | `/api/restaurants/:id/staff` | Convidar alguém para a equipe | — | Configurações | 401 | 403 | 403 | 403 | 200 | 401 |
| PATCH | `/api/restaurants/:id/staff/:staffId` | Papel, ativo e senha de alguém da equipe | — | Configurações | 401 | 403 | 403 | 403 | 200 | 401 |

## Destaques: o papel acessa algo que a tela dele não mostra

- `GET /api/addresses/` (Endereços de entrega dos pedidos do próprio restaurante) — Cozinha, Garçom, Administrador, Dono: nenhuma tela do painel chama esta rota.
- `POST /api/restaurants/:id/items/:itemId/duplicate` (Duplicar prato) — Administrador, Dono: nenhuma tela do painel chama esta rota.
