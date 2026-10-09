import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { before, test } from "node:test";
import { call, product, uid } from "./helpers.ts";

// J-1 (UX-07): the category lives on the Product (insumos too); a dish shows its product's. One list for the Cardápio and
// the Catálogo; the customer's menu lists only categories with a dish.
const D = "chapa27";
const P = `/api/restaurants/${D}`;
const tokens: Record<string, string> = {};

before(async () => {
  for (const u of ["dono", "gerente", "garcom"]) tokens[u] = (await call("POST", "/api/auth/login", { body: { email: `${u}@chapa27.example`, password: "senha123" } })).body.token;
});

// GET /categories + /items of the Chapa 27 before J-1 (recorded on the code of 1f6fbef/ab66391): the same menu after it.
const ANTES: [string, [string, number][]][] = [
  ["Hambúrgueres", [["Clássico", 32.9], ["Cheddar & Bacon", 38.9], ["Duplo Smash", 36.9], ["Salada", 33.9], ["Costela BBQ", 42.9], ["Frango Crispy", 34.9], ["Veggie de Grão-de-Bico", 35.9], ["Picanha", 46.9], ["Kids", 24.9], ["Brutal Triplo", 54.9]]],
  ["Porções", [["Batata Frita", 22.9], ["Batata com Cheddar e Bacon", 32.9], ["Onion Rings", 27.9], ["Nuggets (10 un)", 26.9], ["Mandioca Frita", 24.9], ["Polenta Frita", 22.9], ["Porção Mista", 49.9]]],
  ["Bebidas", [["Refrigerante lata 350 ml", 7], ["Refrigerante zero lata 350 ml", 7], ["Água mineral 500 ml", 5], ["Água com gás 500 ml", 5.5], ["Cerveja long neck", 13.9], ["Chope Pilsen 300 ml", 11.9], ["Suco de Laranja 400 ml", 12.9], ["Limonada Suíça 400 ml", 13.9], ["Milkshake de Chocolate", 21.9]]],
  ["Sobremesas", [["Brownie com Sorvete", 22.9], ["Petit Gâteau", 24.9], ["Cheesecake de Frutas Vermelhas", 19.9], ["Sundae de Doce de Leite", 16.9]]]
];
type Cat = { id: string; name: string };
type Item = { id: string; name: string; price: number; categoryId: string | null; categoryName: string; productId: string };
const publicMenu = async () => {
  const cats = (await call("GET", `${P}/categories`)).body as Cat[];
  const items = (await call("GET", `${P}/items`)).body as Item[];
  return { cats, items, view: cats.map((c) => [c.name, items.filter((i) => i.categoryId === c.id).map((i) => [i.name, i.price])]) };
};

test("cardápio público da Chapa 27 igual ao de antes: mesmas categorias, na mesma ordem, com os mesmos pratos", async () => {
  const { cats, items, view } = await publicMenu();
  assert.deepEqual(view, ANTES);
  assert.deepEqual(cats.map((c) => c.id), ["chapa27-cat-0", "chapa27-cat-1", "chapa27-cat-2", "chapa27-cat-3"]);
  assert.deepEqual(items.map((i) => i.id), Array.from({ length: 30 }, (_, i) => `chapa27-${i}`));
  assert.ok(items.every((i) => i.categoryName === cats.find((c) => c.id === i.categoryId)?.name), "categoryName de cada prato");
  // The filter by category reads the product's too.
  assert.deepEqual(((await call("GET", `${P}/items?categoryId=chapa27-cat-3`)).body as Item[]).map((i) => i.name), ANTES[3][1].map(([n]) => n));
});

test("categoria só com insumo não aparece no cardápio público; o painel vê todas; com item não exclui (409 com quantos)", async () => {
  const gerente = { token: tokens.gerente };
  const name = `Molhos ${uid()}`;
  const created = (await call("POST", `${P}/categories`, { ...gerente, body: { name } })).body as Cat[];
  const molhos = created.find((c) => c.name === name)!;
  const insumo = await call("POST", `${P}/products`, { ...gerente, body: product({ name: `Maionese ${uid()}`, unit: "kg", cost: 18, categoryId: molhos.id }) });
  assert.equal(insumo.status, 201);
  assert.equal(insumo.body.categoryId, molhos.id);

  assert.equal((await publicMenu()).cats.some((c) => c.id === molhos.id), false, "só insumo: fora do cardápio do cliente");
  const all = await call("GET", `${P}/categories/all`, { token: tokens.garcom });
  assert.equal(all.status, 200);
  assert.ok((all.body as Cat[]).some((c) => c.id === molhos.id), "o painel (até o garçom) vê a lista inteira");

  const refused = await call("DELETE", `${P}/categories/${molhos.id}`, gerente);
  assert.deepEqual([refused.status, refused.body.error, refused.body.items], [409, `A categoria ${name} tem 1 item. Mova para outra categoria antes de excluir.`, 1]);
  const sobremesas = await call("DELETE", `${P}/categories/chapa27-cat-3`, gerente);
  assert.deepEqual([sobremesas.status, sobremesas.body.error], [409, "A categoria Sobremesas tem 4 itens. Mova para outra categoria antes de excluir."]);

  // Out of the category (Sem categoria), the category is empty and goes.
  const moved = await call("PATCH", `${P}/products/${insumo.body.id}`, { ...gerente, body: { ...product({ name: insumo.body.name, unit: "kg", cost: 18 }), categoryId: null } });
  assert.equal(moved.body.categoryId, null);
  assert.equal((await call("DELETE", `${P}/categories/${molhos.id}`, gerente)).status, 200);
});

test("categoria de outro restaurante (ou de tipo errado) é recusada no produto; editar sem categoryId mantém a dele", async () => {
  const gerente = { token: tokens.gerente };
  for (const categoryId of ["fogo-cat-0", "nao-existe", 5]) {
    const res = await call("POST", `${P}/products`, { ...gerente, body: product({ name: `Item ${uid()}`, cost: 1, categoryId }) });
    assert.equal(res.status, 400, JSON.stringify(categoryId));
  }
  const created = (await call("POST", `${P}/products`, { ...gerente, body: product({ name: `Picles ${uid()}`, cost: 3, categoryId: "chapa27-cat-0" }) })).body;
  assert.equal((await call("PATCH", `${P}/products/${created.id}`, { ...gerente, body: product({ name: created.name, cost: 3, categoryId: "fogo-cat-0" }) })).status, 400);
  const kept = await call("PATCH", `${P}/products/${created.id}`, { ...gerente, body: product({ name: created.name, cost: 3 }) });
  assert.deepEqual([kept.status, kept.body.categoryId], [200, "chapa27-cat-0"]);
});

test("o prato mostra a categoria do produto: mudar no Catálogo muda no cardápio, e no Organizar prato muda o produto", async () => {
  const dono = { token: tokens.dono };
  const products = (await call("GET", `${P}/products`, dono)).body as (ReturnType<typeof product> & { id: string; name: string; categoryId: string | null })[];
  const kids = products.find((p) => p.name === "Kids")!;
  assert.equal(kids.categoryId, "chapa27-cat-0");
  const dish = () => call("GET", `${P}/items/chapa27-8`).then((r) => r.body as Item);
  try {
    await call("PATCH", `${P}/products/${kids.id}`, { ...dono, body: { ...kids, categoryId: "chapa27-cat-3" } });
    assert.deepEqual([(await dish()).categoryId, (await dish()).categoryName], ["chapa27-cat-3", "Sobremesas"]);
    await call("PATCH", `${P}/items/chapa27-8`, { ...dono, body: { categoryId: "chapa27-cat-1" } });
    assert.equal(((await call("GET", `${P}/products`, dono)).body as { id: string; categoryId: string }[]).find((p) => p.id === kids.id)!.categoryId, "chapa27-cat-1");
    await call("PATCH", `${P}/products/${kids.id}`, { ...dono, body: { ...kids, categoryId: null } });
    assert.deepEqual([(await dish()).categoryId, (await dish()).categoryName], [null, "Sem categoria"]);
  } finally {
    await call("PATCH", `${P}/products/${kids.id}`, { ...dono, body: { ...kids, categoryId: "chapa27-cat-0" } });
  }
  assert.equal((await dish()).categoryName, "Hambúrgueres");
});

// Item 2 (pendência do J, UX-07 · 2d): "Mover e excluir" — with a destination of the same restaurant, its items move there
// and the category goes, in one transaction; without one, still 409; another restaurant's destination, 404 and nothing moves.
test("Item 2 · mover e excluir: os itens vão para a categoria escolhida e a categoria sai; destino de outro restaurante ou o mesmo é recusado", async () => {
  const gerente = { token: tokens.gerente };
  const fogo = (await call("GET", "/api/restaurants/fogo/categories")).body as Cat[];
  const mk = async (name: string) => ((await call("POST", `${P}/categories`, { ...gerente, body: { name } })).body as Cat[]).find((c) => c.name === name)!;
  const [velha, nova] = [await mk(`Velha ${uid()}`), await mk(`Nova ${uid()}`)];
  const ids = [] as string[];
  for (const name of [`Ketchup ${uid()}`, `Mostarda ${uid()}`]) ids.push((await call("POST", `${P}/products`, { ...gerente, body: product({ name, cost: 3, categoryId: velha.id }) })).body.id);
  const where = async () => ((await call("GET", `${P}/products`, gerente)).body as { id: string; categoryId: string }[]).filter((p) => ids.includes(p.id)).map((p) => p.categoryId);

  const listed = (await call("GET", `${P}/categories/all`, gerente)).body as (Cat & { items: number })[];
  assert.equal(listed.find((c) => c.id === velha.id)!.items, 2, "a lista da equipe diz quantos itens cada categoria tem");
  assert.equal((await call("DELETE", `${P}/categories/${velha.id}`, gerente)).status, 409, "sem destino: continua 409");
  assert.equal((await call("DELETE", `${P}/categories/${velha.id}`, { ...gerente, body: { moveTo: fogo[0].id } })).status, 404, "destino de outro restaurante");
  assert.equal((await call("DELETE", `${P}/categories/${velha.id}`, { ...gerente, body: { moveTo: velha.id } })).status, 400, "a própria categoria");
  assert.equal((await call("DELETE", `${P}/categories/${velha.id}`, { ...gerente, body: { moveTo: 7 } })).status, 400);
  assert.deepEqual(await where(), [velha.id, velha.id], "nada mudou nas recusas");

  const done = await call("DELETE", `${P}/categories/${velha.id}`, { ...gerente, body: { moveTo: nova.id } });
  assert.equal(done.status, 200);
  assert.equal((done.body as Cat[]).some((c) => c.id === velha.id), false, "a categoria saiu");
  assert.deepEqual(await where(), [nova.id, nova.id], "os itens foram para a escolhida");
  assert.equal(((await call("GET", "/api/restaurants/fogo/categories")).body as Cat[]).length, fogo.length, "o outro restaurante não mudou");
  assert.equal((await call("DELETE", `${P}/categories/${nova.id}`, { token: tokens.garcom, body: { moveTo: velha.id } })).status, 403, "garçom não exclui");
});

// Last in the file: its psql calls block this process for seconds, and a keep-alive connection the API closed meanwhile
// (5 s) would be reused by the next request here (ECONNRESET).
test("migração 9m: o produto ganha a categoria do prato, o prato sem produto ganha um, e a categoria sai do prato", () => {
  // A database at the migration before 9m, with rows written then, and 9m run on it — as on the Supabase.
  const container = process.env.TEST_DB_CONTAINER ?? "cardapio-test-db";
  const psql = (sql: string, db = "cardapio_mig") => {
    const r = spawnSync("docker", ["exec", "-i", "-e", "PGCLIENTENCODING=UTF8", container, "psql", "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1", "-qAt", "-F", "|"], { input: sql, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim().split("\n").filter(Boolean);
  };
  const dir = "apps/api/prisma/migrations";
  const migrations = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  const at = migrations.indexOf("9m_category_on_product");
  assert.ok(at > 0, "migração 9m não encontrada");
  psql("DROP DATABASE IF EXISTS cardapio_mig; CREATE DATABASE cardapio_mig;", "postgres");
  psql('CREATE TABLE "_prisma_migrations" ("id" TEXT);'); // 9f turns RLS on in it; Prisma isn't running these
  for (const m of migrations.slice(0, at)) psql(readFileSync(`${dir}/${m}/migration.sql`, "utf8"));
  psql(`
    INSERT INTO "Restaurant" ("id","name","initials","cuisine","cuisineTagsJson","rating","reviewCount","etaMinMinutes","etaMaxMinutes","deliveryFee","isOpen","coverLabel")
      VALUES ('mig','Mig','MG','Lanches','[]',5,0,10,20,0,true,'capa');
    INSERT INTO "MenuCategory" ("id","restaurantId","name","sortOrder") VALUES ('mig-lanches','mig','Lanches',0), ('mig-bebidas','mig','Bebidas',1);
    INSERT INTO "Product" ("id","restaurantId","name","type","price") VALUES ('mig-burger','mig','X-Burger','produto',30), ('mig-pao','mig','Pão','insumo',0), ('mig-combo','mig','Combo','produto',40);
    INSERT INTO "MenuItem" ("id","restaurantId","categoryId","productId","name","shortDescription","longDescription","price","photoLabel","optionGroupsJson","sortOrder") VALUES
      ('mig-1','mig','mig-lanches','mig-burger','X-Burger','','',30,'foto','[]',0),
      ('mig-2','mig','mig-bebidas',NULL,'Suco de laranja','','',9.5,'foto','[]',1),
      ('mig-3','mig','mig-bebidas','mig-combo','Combo','','',40,'foto','[]',2),
      ('mig-4','mig','mig-lanches','mig-combo','Combo (cópia)','','',40,'foto','[]',3);
  `);
  psql(readFileSync(`${dir}/9m_category_on_product/migration.sql`, "utf8"));

  assert.deepEqual(psql(`SELECT "id","categoryId","name","type","unit","price" FROM "Product" ORDER BY "id"`), [
    "mig-burger|mig-lanches|X-Burger|produto|un|30",
    "mig-combo|mig-bebidas|Combo|produto|un|40", // on two dishes (Duplicar): the first one's, in menu order
    "mig-pao||Pão|insumo|un|0", // an insumo had no category
    "prato-mig-2|mig-bebidas|Suco de laranja|produto|un|9.5" // the dish without a product got one, as the phone form makes it
  ]);
  assert.deepEqual(psql(`SELECT "id","productId" FROM "MenuItem" ORDER BY "id"`), ["mig-1|mig-burger", "mig-2|prato-mig-2", "mig-3|mig-combo", "mig-4|mig-combo"]);
  assert.deepEqual(psql(`SELECT column_name FROM information_schema.columns WHERE table_name = 'MenuItem' AND column_name = 'categoryId'`), [], "a categoria mora num lugar só");
  // Restrict: a category with an item can't go, not even straight in the database.
  assert.equal(spawnSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", "cardapio_mig", "-v", "ON_ERROR_STOP=1"], { input: `DELETE FROM "MenuCategory" WHERE "id" = 'mig-lanches';` }).status, 3);
  psql("DROP DATABASE cardapio_mig;", "postgres");
});
