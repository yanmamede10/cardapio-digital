# 8. Emissão fiscal: NF-e e NFC-e no padrão nacional

Aceita · 25/09/2026

## Contexto
A tela Emissão Fiscal já lista os pedidos e comandas fechados que precisam de nota. Falta integrar a emissão. Alguns estados tinham equipamentos próprios: SAT CF-e em SP e PAF-ECF em SC. Os dois estão extintos desde 01/01/2026 e substituídos pela NFC-e.

## Decisão
Emitir somente **NF-e (modelo 55)** e **NFC-e (modelo 65)** no layout nacional. **Não** dar suporte a SAT nem a PAF-ECF.

## Consequências
- Um único fluxo de emissão para todos os estados, sem hardware fiscal.
- Cada restaurante vai precisar de certificado digital A1 e, para NFC-e, do CSC (código de segurança do contribuinte) do seu estado. Isso entra no onboarding fiscal.
- Um restaurante que ainda dependa de SAT ou ECF está fora do padrão legal e não é atendido.
- **Estado atual:** a tela existe (`FiscalScreen`), mas ainda não há provedor de NFC-e integrado.
