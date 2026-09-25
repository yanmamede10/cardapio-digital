# 6. Composição de custo simplificada

Aceita · 25/09/2026

## Contexto
O restaurante precisa do custo do prato para precificar e acompanhar o CMV. O custeio industrial completo (MOD, CIF, rateio por centro de custo) exige apontamento de horas e bases de rateio que restaurante pequeno não tem nem vai manter.

## Decisão
- **Custo do insumo:** custo médio ponderado, atualizado a cada entrada de nota (importação de XML da NF-e).
- **Custo do produto composto:** soma de quantidade × custo atual de cada componente da ficha técnica.
- **Overhead opcional:** um acréscimo sobre o custo para cobrir despesas indiretas, ligado só por quem quiser.
- **Sem** MOD, CIF nem rateio.

## Consequências
- O custo sai automático do que o restaurante já faz, que é cadastrar ficha técnica e lançar notas.
- O custo real fica subestimado sem o overhead (mão de obra, energia etc.). É uma aproximação consciente, não contabilidade de custos.
- **Estado atual:** o custo médio e a soma da ficha técnica estão implementados (`apps/api/src/routes/products.ts`). O overhead ainda não.
