# 4. Priorização ERP-first: gestão antes do delivery

Aceita · 25/09/2026

## Contexto
O piloto é um restaurante operando no balcão e no salão (P0 = "não pode faltar para o piloto no balcão"). O que ele usa todo dia é a gestão: pedidos, mesas, cardápio, estoque, contas e nota. O delivery próprio depende do PIX real (ADR 1) e compete com marketplaces já estabelecidos.

## Decisão
Priorizar o **dashboard de gestão** (produtos e estoque, contas a pagar e receber, emissão fiscal, visão geral e DRE, permissões) antes de fechar o delivery (checkout com PIX real, split).

## Consequências
- O restaurante piloto ganha valor diário mais cedo, e é isso que o segura na plataforma.
- O delivery continua funcional para teste, mas com pagamento de mentira até o ADR 1 sair do papel.
- A arquitetura não pode travar o delivery depois. Ele segue na mesma API e no mesmo banco (ADR 7).
