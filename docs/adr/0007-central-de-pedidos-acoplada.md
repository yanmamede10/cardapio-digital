# 7. Central de Pedidos acoplada ao delivery (DISP-01)

Aceita · 25/09/2026 · risco aceito

## Contexto
O RNF-DISP-01 pede que a Central de Pedidos (mesa, QR e tablet) continue funcionando se o delivery cair. Hoje os fronts são SPAs separadas (`apps/web` e `apps/dashboard`), mas os dois canais usam **a mesma API Express (`apps/api`) e o mesmo Postgres**.

## Decisão
Manter o acoplamento no piloto com 1 restaurante. Não separamos serviços agora.

## Consequências
- Se a API ou o banco caírem, mesa e delivery caem juntos. Um bug ou pico de carga no caminho do delivery pode afetar o salão.
- Em troca, temos um deploy e um banco só, zero sincronização entre serviços e o custo mínimo para o piloto.
- **Revisitar** quando houver mais de um restaurante ou tráfego real de delivery. O caminho natural é um deploy separado para receber os pedidos do delivery, ou uma fila entre o delivery e a Central.
