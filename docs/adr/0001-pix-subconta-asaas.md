# 1. PIX: subconta Asaas por restaurante, split configurável por canal

Aceita · 25/09/2026

## Contexto
O restaurante precisa receber PIX no delivery e, se quiser, no presencial. A plataforma cobra taxa sobre o delivery. Não queremos ficar com o dinheiro de terceiros nem guardar dado de pagamento (RNF-COMP-01).

## Decisão
- Cada restaurante tem uma **subconta Asaas** própria, aberta num onboarding com CNPJ, razão social e documento, com status pendente, aprovado ou rejeitado (RF-PIX-SUB).
- O QR PIX é dinâmico e gerado na subconta do restaurante. A confirmação chega por webhook do Asaas (RF-PIX-01/02).
- **Split por canal, configurável:** no delivery, o split manda a taxa da plataforma para a conta dela. No presencial, não há split e 100% fica com o restaurante. O percentual de cada canal é configuração, não constante no código.

## Consequências
- O dinheiro vai direto para o restaurante. A plataforma não faz custódia e não precisa operar como instituição de pagamento.
- Nenhum restaurante recebe PIX antes de ter a subconta aprovada, então o onboarding vira pré-requisito.
- Ficamos dependentes do Asaas (tarifas, disponibilidade, API). A conciliação de quanto foi para o restaurante e quanto foi taxa (RF-PIX-04) sai do Asaas.
- **Estado atual:** ainda não implementado. `PixPaymentModal` mostra um QR falso e `SettingsFinanceTab` é mock.
