# 2. Recebimento presencial configurável (FIN-01)

Aceita · 25/09/2026

## Contexto
Muitos restaurantes já têm maquininha própria que faz cartão e PIX direto na conta deles. Obrigar o PIX do sistema no salão criaria atrito sem ganho para eles, porque o presencial não tem taxa da plataforma (ADR 1).

## Decisão
Campo `Restaurant.paymentMode` com dois valores, escolhidos pelo próprio restaurante em Configurações:
- `sistema`: o fechamento da comanda mostra o QR PIX da subconta Asaas (ADR 1), com baixa automática pelo webhook.
- `maquininha_propria` (padrão): o sistema só registra a forma de pagamento e o staff confirma manualmente. Não há QR nem webhook.

## Consequências
- O padrão `maquininha_propria` permite começar o piloto sem onboarding no Asaas.
- São dois fluxos de fechamento para manter e testar.
- Com maquininha própria, a confirmação é manual e a conciliação do presencial fica com o restaurante.
- Implementado: coluna (migração `2_payment_mode`), `GET/PATCH /:id/payment-mode` e o seletor na aba Financeiro de Configurações.
