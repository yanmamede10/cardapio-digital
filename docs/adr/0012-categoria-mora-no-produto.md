# 12. A categoria mora no produto

Aceita · 06/10/2026

## Contexto
A categoria ficava no prato (`MenuItem.categoryId`) e o Catálogo de Produtos não tinha nenhuma: produtos e insumos eram uma lista corrida, e o mesmo X-Burger podia estar em "Hambúrgueres" no Cardápio sem que o Catálogo soubesse. O redesenho de Produtos (UX-07) agrupa o Catálogo por categoria, com a mesma lista do Cardápio.

## Decisão
- **Uma lista só de categorias:** a tabela `MenuCategory` que já existia, com o mesmo `sortOrder`. Criar, renomear, reordenar e excluir valem para o Cardápio e para o Catálogo; qualquer um dos dois módulos (Cardápio ou Produtos) dá acesso.
- **A categoria mora no produto** (`Product.categoryId`, opcional, insumos também). O prato mostra a categoria do produto ligado a ele (`MenuItem.productId`); `MenuItem.categoryId` saiu. Escolher a categoria em "Adicionar prato" ou em "Organizar prato" muda a do produto.
- **Sem categoria:** o produto sem categoria aparece em "Sem categoria", sempre no fim, que não se arrasta, renomeia nem exclui.
- **Cardápio do cliente:** só lista categorias com pelo menos um prato. Categoria só com insumos não aparece.
- **Excluir só vazia:** com produto, insumo ou prato, a API responde 409 "A categoria X tem N itens. Mova para outra categoria antes de excluir." e a tela mostra quantos são. O banco garante o mesmo (`ON DELETE RESTRICT`).
- **Migração `9m_category_on_product`:** cada produto recebe a categoria do seu prato (produto em dois pratos, pelo Duplicar: a do primeiro na ordem do cardápio). Prato antigo sem produto ganha um, como o formulário do celular cria hoje (nome, preço, tipo produto, unidade un). Depois a coluna sai do prato.

## Consequências
- O cardápio do cliente da Chapa 27 é o mesmo de antes (teste em `tests/api/categoria.test.ts`).
- Mudar a categoria de um prato no Cardápio muda o produto no Catálogo, e vice-versa: não há como o mesmo produto estar em categorias diferentes nos dois lugares.
- O painel lê a lista inteira em `GET /api/restaurants/:id/categories/all` (equipe); a rota pública `GET /api/restaurants/:id/categories` continua para o cardápio do cliente e o Lançar pedido.
- No Supabase de testes, em 06/10/2026, não havia prato sem produto (0 de 102): a migração não criou nenhum produto.
- **Fora desta decisão:** "Mover e excluir" (desenho 2d) não foi feito; para excluir, mova os itens antes.
