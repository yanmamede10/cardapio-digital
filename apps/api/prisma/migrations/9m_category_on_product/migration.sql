-- J-1 (UX-07): the category moves from the dish (MenuItem) to the catalog item (Product), insumos included. One list of
-- categories (MenuCategory, same sortOrder) for the Cardápio and the Catálogo; a dish shows its product's category.

ALTER TABLE "Product" ADD COLUMN "categoryId" TEXT;

-- A dish from before the catalog (productId empty) gets the Produto the phone form makes today: its name and price, type
-- "produto", unit "un". The id comes from the dish's, so the dish can point at it right after.
INSERT INTO "Product" ("id", "restaurantId", "name", "type", "unit", "price")
SELECT 'prato-' || "id", "restaurantId", "name", 'produto', 'un', "price" FROM "MenuItem" WHERE "productId" IS NULL;
UPDATE "MenuItem" SET "productId" = 'prato-' || "id" WHERE "productId" IS NULL;

-- Each product takes its dish's category. A product on two dishes (Duplicar) takes the first one's, in menu order.
UPDATE "Product" p SET "categoryId" = d."categoryId"
FROM (
  SELECT DISTINCT ON ("productId") "productId", "restaurantId", "categoryId"
  FROM "MenuItem" ORDER BY "productId", "sortOrder", "id"
) d
WHERE p."id" = d."productId" AND p."restaurantId" = d."restaurantId";

-- Now the category lives in one place.
ALTER TABLE "MenuItem" DROP CONSTRAINT "MenuItem_categoryId_fkey";
ALTER TABLE "MenuItem" DROP COLUMN "categoryId";

-- Only an empty category can be deleted (the API answers 409 before this is reached).
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MenuCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
