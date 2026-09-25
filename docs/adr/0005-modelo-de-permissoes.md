# 5. Modelo de permissões: hierarquia de 3 papéis fixos

Aceita · 25/09/2026

## Contexto
O restaurante precisa esconder financeiro e configurações de garçom e cozinha. As alternativas eram grupos configuráveis, uma matriz tela × ação e exceções por pessoa. Todas custam UI, testes e suporte ("por que fulano não vê X?").

## Decisão
- Três níveis ordinais fixos: **Funcionário (1) < Administrador (2) < Dono (3)**. Os papéis gravados mapeiam assim: `owner` → Dono, `manager` → Administrador, `waiter`/`kitchen` → Funcionário. Qualquer valor desconhecido conta como Funcionário.
- A API checa com `requireMinRole(nível)`. O papel é lido do banco a cada request, então a mudança vale na hora.
- A navegação usa os mesmos níveis (`MODULES[].level`). Funcionário vê Operação. Administrador vê também Produtos, Relatórios e Financeiro. Dono vê tudo, inclusive Configurações (Equipe & Permissões) e a DRE.
- **Única divisão dentro de um nível:** Atendimento vai por papel (`SUPPORT_ROLES` = owner, manager, waiter), porque o garçom fala com o cliente e a cozinha não. A API usa `requireRole(...SUPPORT_ROLES)` e a navegação usa `MODULES[].roles`, com a mesma lista.
- **Sem grupos, sem matriz e sem exceção por pessoa.** Uma exceção só entra quando o mesmo pedido se repetir em mais de um restaurante, nunca como reação a um pedido único.

## Consequências
- É simples de explicar ("quem está acima vê o que está abaixo"), de testar e de dar suporte.
- Algum restaurante vai querer, por exemplo, cozinha vendo Promoções. A resposta é não até o pedido se repetir.
- Promoções fica em Operação, mas exige Administrador, porque é o que a API já exigia.
- A gestão da equipe é só do Dono. Um Administrador que gerenciasse a equipe poderia se promover a Dono.
