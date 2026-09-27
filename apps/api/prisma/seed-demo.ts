// Demonstration restaurant: a fictional hamburgueria ("Chapa 27"), for the hosted demo and for production.
// Runs alone on an empty (migrated) database and never deletes anything: if the restaurant already exists it stops.
//   npm run db:seed:demo --workspace apps/api
// Staff password: SEED_DEMO_PASSWORD, or a random one printed once at the end. No photos (nothing without a commercial licence).
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PLAN_MODULES } from "@cardapio/shared";
import { hashPassword } from "../src/lib/auth.js";

const prisma = new PrismaClient();
const R = "chapa27";

// [name, unit, cost, stock] — a few close to running out (pão australiano, cheddar, bacon, água com gás).
const INSUMOS: [string, string, number, number][] = [
  ["Pão brioche", "un", 1.85, 180],
  ["Pão australiano", "un", 2.1, 6],
  ["Blend bovino 150 g", "un", 6.9, 140],
  ["Blend de costela 150 g", "un", 7.8, 60],
  ["Picanha 180 g", "un", 13.5, 25],
  ["Frango empanado", "un", 4.2, 50],
  ["Hambúrguer de grão-de-bico", "un", 5.1, 20],
  ["Queijo cheddar fatiado", "kg", 54.9, 0.6],
  ["Bacon em fatias", "kg", 42, 0.4],
  ["Alface americana", "kg", 12, 2.5],
  ["Tomate", "kg", 7.5, 4],
  ["Cebola roxa", "kg", 5.9, 3],
  ["Picles", "kg", 28, 1.5],
  ["Molho da casa", "L", 18, 3],
  ["Molho barbecue", "L", 22, 2],
  ["Ovo", "un", 0.75, 60],
  ["Batata palito congelada", "kg", 16.9, 25],
  ["Anéis de cebola congelados", "kg", 24, 4],
  ["Nuggets de frango", "kg", 32, 3],
  ["Mandioca congelada", "kg", 11, 8],
  ["Polenta congelada", "kg", 9, 6],
  ["Sorvete de creme", "L", 19.9, 5],
  ["Brownie", "un", 4.5, 18],
  ["Petit gâteau congelado", "un", 6.2, 12],
  ["Calda de chocolate", "kg", 26, 1.2],
  ["Doce de leite", "kg", 21, 1.5],
  ["Leite", "L", 5.2, 12],
  ["Leite condensado", "kg", 14, 2],
  ["Limão", "kg", 6.5, 3],
  ["Laranja", "kg", 4.2, 10],
  ["Chope pilsen (barril)", "L", 12, 50]
];

const BEEF = { id: "ponto", label: "Ponto da carne", type: "single", hint: "escolha 1", options: ["Ao ponto", "Bem passado", "Mal passado"].map((label, i) => ({ id: `ponto-${i}`, label, priceDelta: 0 })) };
// id "extra": the group the dashboard's "Organizar prato" edits.
const EXTRAS = { id: "extra", label: "Adicionais", type: "multi", hint: "opcional", options: [["Bacon extra", 6], ["Cheddar extra", 4], ["Ovo", 3], ["Cebola caramelizada", 4]].map(([label, priceDelta], i) => ({ id: `extra-${i}`, label, priceDelta })) };

type Dish = { name: string; price: number; desc: string; recipe?: [string, number][]; own?: { cost: number; stock: number }; groups?: object[]; tag?: [string, string] };
const MENU: Record<string, Dish[]> = {
  "Hambúrgueres": [
    { name: "Clássico", price: 32.9, desc: "Blend 150 g, cheddar, alface, tomate e molho da casa no brioche.", recipe: [["Pão brioche", 1], ["Blend bovino 150 g", 1], ["Queijo cheddar fatiado", 0.04], ["Alface americana", 0.015], ["Tomate", 0.03], ["Molho da casa", 0.02]], groups: [BEEF, EXTRAS] },
    { name: "Cheddar & Bacon", price: 38.9, desc: "Blend 150 g, cheddar em dobro e bacon crocante.", recipe: [["Pão brioche", 1], ["Blend bovino 150 g", 1], ["Queijo cheddar fatiado", 0.06], ["Bacon em fatias", 0.04], ["Molho da casa", 0.02]], groups: [BEEF, EXTRAS], tag: ["Mais pedido", "fa-solid fa-fire"] },
    { name: "Duplo Smash", price: 36.9, desc: "Dois smash de 150 g, cheddar, cebola roxa e picles.", recipe: [["Pão brioche", 1], ["Blend bovino 150 g", 2], ["Queijo cheddar fatiado", 0.04], ["Cebola roxa", 0.02], ["Picles", 0.01]], groups: [BEEF, EXTRAS] },
    { name: "Salada", price: 33.9, desc: "Blend 150 g, alface, tomate, cebola roxa e molho da casa.", recipe: [["Pão brioche", 1], ["Blend bovino 150 g", 1], ["Alface americana", 0.03], ["Tomate", 0.04], ["Cebola roxa", 0.02], ["Molho da casa", 0.02]], groups: [BEEF, EXTRAS] },
    { name: "Costela BBQ", price: 42.9, desc: "Blend de costela 150 g, cheddar, cebola roxa e barbecue no australiano.", recipe: [["Pão australiano", 1], ["Blend de costela 150 g", 1], ["Queijo cheddar fatiado", 0.04], ["Molho barbecue", 0.03], ["Cebola roxa", 0.02]], groups: [BEEF, EXTRAS] },
    { name: "Frango Crispy", price: 34.9, desc: "Frango empanado, alface, tomate e molho da casa.", recipe: [["Pão brioche", 1], ["Frango empanado", 1], ["Alface americana", 0.02], ["Tomate", 0.03], ["Molho da casa", 0.02]], groups: [EXTRAS] },
    { name: "Veggie de Grão-de-Bico", price: 35.9, desc: "Hambúrguer de grão-de-bico, alface, tomate e molho da casa no australiano.", recipe: [["Pão australiano", 1], ["Hambúrguer de grão-de-bico", 1], ["Alface americana", 0.02], ["Tomate", 0.03], ["Molho da casa", 0.02]], groups: [EXTRAS], tag: ["Vegetariano", "fa-solid fa-leaf"] },
    { name: "Picanha", price: 46.9, desc: "Picanha 180 g, cheddar e cebola roxa.", recipe: [["Pão brioche", 1], ["Picanha 180 g", 1], ["Queijo cheddar fatiado", 0.04], ["Cebola roxa", 0.03], ["Molho da casa", 0.02]], groups: [BEEF, EXTRAS] },
    { name: "Kids", price: 24.9, desc: "Blend 150 g e cheddar, sem salada.", recipe: [["Pão brioche", 1], ["Blend bovino 150 g", 1], ["Queijo cheddar fatiado", 0.02]], groups: [BEEF] },
    { name: "Brutal Triplo", price: 54.9, desc: "Três blends de 150 g, cheddar, bacon e ovo.", recipe: [["Pão brioche", 1], ["Blend bovino 150 g", 3], ["Queijo cheddar fatiado", 0.09], ["Bacon em fatias", 0.06], ["Ovo", 1], ["Molho da casa", 0.03]], groups: [BEEF, EXTRAS] }
  ],
  "Porções": [
    { name: "Batata Frita", price: 22.9, desc: "Batata palito sequinha, 350 g.", recipe: [["Batata palito congelada", 0.35]] },
    { name: "Batata com Cheddar e Bacon", price: 32.9, desc: "Batata palito com cheddar cremoso e bacon.", recipe: [["Batata palito congelada", 0.35], ["Queijo cheddar fatiado", 0.06], ["Bacon em fatias", 0.05]] },
    { name: "Onion Rings", price: 27.9, desc: "Anéis de cebola empanados, 300 g.", recipe: [["Anéis de cebola congelados", 0.3]] },
    { name: "Nuggets (10 un)", price: 26.9, desc: "Nuggets de frango com molho barbecue.", recipe: [["Nuggets de frango", 0.25], ["Molho barbecue", 0.03]] },
    { name: "Mandioca Frita", price: 24.9, desc: "Mandioca frita, 400 g.", recipe: [["Mandioca congelada", 0.4]] },
    { name: "Polenta Frita", price: 22.9, desc: "Polenta frita, 400 g.", recipe: [["Polenta congelada", 0.4]] },
    { name: "Porção Mista", price: 49.9, desc: "Batata, onion rings e nuggets para dividir.", recipe: [["Batata palito congelada", 0.25], ["Anéis de cebola congelados", 0.15], ["Nuggets de frango", 0.15]] }
  ],
  "Bebidas": [
    { name: "Refrigerante lata 350 ml", price: 7, desc: "Cola, guaraná ou laranja.", own: { cost: 3.2, stock: 96 } },
    { name: "Refrigerante zero lata 350 ml", price: 7, desc: "Cola ou guaraná zero.", own: { cost: 3.2, stock: 48 } },
    { name: "Água mineral 500 ml", price: 5, desc: "Sem gás.", own: { cost: 1.1, stock: 60 } },
    { name: "Água com gás 500 ml", price: 5.5, desc: "Com gás.", own: { cost: 1.4, stock: 4 } },
    { name: "Cerveja long neck", price: 13.9, desc: "Pilsen, 355 ml.", own: { cost: 5.9, stock: 36 } },
    { name: "Chope Pilsen 300 ml", price: 11.9, desc: "Tirado na hora.", recipe: [["Chope pilsen (barril)", 0.3]] },
    { name: "Suco de Laranja 400 ml", price: 12.9, desc: "Espremido na hora.", recipe: [["Laranja", 0.6]] },
    { name: "Limonada Suíça 400 ml", price: 13.9, desc: "Limão batido com leite condensado e gelo.", recipe: [["Limão", 0.15], ["Leite condensado", 0.05]] },
    { name: "Milkshake de Chocolate", price: 21.9, desc: "Sorvete de creme, leite e calda de chocolate.", recipe: [["Sorvete de creme", 0.3], ["Leite", 0.1], ["Calda de chocolate", 0.03]] }
  ],
  "Sobremesas": [
    { name: "Brownie com Sorvete", price: 22.9, desc: "Brownie morno com sorvete de creme e calda.", recipe: [["Brownie", 1], ["Sorvete de creme", 0.1], ["Calda de chocolate", 0.02]] },
    { name: "Petit Gâteau", price: 24.9, desc: "Bolo quente de chocolate com sorvete de creme.", recipe: [["Petit gâteau congelado", 1], ["Sorvete de creme", 0.1]] },
    { name: "Cheesecake de Frutas Vermelhas", price: 19.9, desc: "Fatia com calda de frutas vermelhas.", own: { cost: 7.5, stock: 8 } },
    { name: "Sundae de Doce de Leite", price: 16.9, desc: "Sorvete de creme com doce de leite.", recipe: [["Sorvete de creme", 0.2], ["Doce de leite", 0.04]] }
  ]
};

async function main() {
  if (await prisma.restaurant.findUnique({ where: { id: R } })) {
    console.log(`Restaurante "${R}" já existe — nada foi alterado.`);
    return;
  }
  const password = process.env.SEED_DEMO_PASSWORD || randomBytes(9).toString("base64url");
  const passwordHash = hashPassword(password);
  const now = new Date();
  const ym = now.toLocaleDateString("sv-SE").slice(0, 7);
  const day = (d: number) => `${ym}-${String(d).padStart(2, "0")}`;
  const today = now.toLocaleDateString("sv-SE");

  await prisma.restaurant.create({
    data: {
      id: R,
      name: "Chapa 27 Burgers",
      initials: "C2",
      cuisine: "Hambúrguer · Porções",
      cuisineTagsJson: JSON.stringify(["Hambúrguer"]),
      rating: 0,
      reviewCount: 0,
      etaMinMinutes: 25,
      etaMaxMinutes: 40,
      deliveryFee: 0,
      isOpen: true,
      coverLabel: "Chapa 27 Burgers",
      description: "Hamburgueria artesanal de demonstração: blends de 150 g, porções e chope.",
      cnpj: "98.765.432/0001-00", // fictional (invalid check digits on purpose)
      legalName: "Chapa 27 Hamburgueria Ltda. (demonstração)",
      taxRegime: "simples_nacional",
      fiscalAddress: "Endereço fictício de demonstração",
      planPrice: 299.9,
      planDueDay: 10,
      planModulesJson: JSON.stringify(PLAN_MODULES.filter((m) => m !== "fiscal")), // no Emissão Fiscal
      paymentMode: "maquininha_propria",
      template: "classico",
      brandColor: "#B4411B",
      draftBrandColor: "#B4411B",
      appearancePublishedAt: now,
      gridSize: 11,
      status: "ativo"
    }
  });

  const insumo = new Map<string, string>();
  for (const [name, unit, cost, stock] of INSUMOS) {
    insumo.set(name, (await prisma.product.create({ data: { restaurantId: R, name, type: "insumo", unit, cost, stock } })).id);
  }

  let sort = 0;
  for (const [ci, [category, dishes]] of Object.entries(MENU).entries()) {
    const categoryId = `${R}-cat-${ci}`;
    await prisma.menuCategory.create({ data: { id: categoryId, restaurantId: R, name: category, sortOrder: ci } });
    for (const d of dishes) {
      const product = await prisma.product.create({
        data: {
          restaurantId: R,
          name: d.name,
          type: "produto",
          unit: "un",
          price: d.price,
          cost: d.own?.cost ?? 0,
          stock: d.own?.stock ?? 0,
          composed: !!d.recipe,
          components: d.recipe ? { create: d.recipe.map(([name, quantity]) => ({ componentId: insumo.get(name)!, quantity })) } : undefined
        }
      });
      await prisma.menuItem.create({
        data: {
          id: `${R}-${sort}`,
          restaurantId: R,
          categoryId,
          productId: product.id,
          name: d.name,
          shortDescription: d.desc,
          longDescription: d.desc,
          price: d.price,
          photoLabel: `foto · ${d.name.toLowerCase()}`,
          tag: d.tag?.[0] ?? null,
          tagIcon: d.tag?.[1] ?? null,
          optionGroupsJson: JSON.stringify(d.groups ?? []),
          scheduleLabel: "Almoço 11:30 – 15:00 · Jantar 18:00 – 23:30",
          sortOrder: sort++
        }
      });
    }
  }

  // Salão: 30 tables on an 11×11 map, 6 per row on every other row/column.
  await prisma.restaurantTable.createMany({
    data: Array.from({ length: 30 }, (_, i) => ({ restaurantId: R, number: i + 1, seats: [2, 4, 4, 6][i % 4], gridRow: Math.floor(i / 6) * 2, gridCol: (i % 6) * 2 }))
  });

  // This month's bills: the start of the month already paid, the rest pending (whatever is past due shows as Atrasado).
  const paid = (d: number, method: string) => (day(d) <= today ? { status: "paid", paidOn: day(d), paymentMethod: method } : { status: "pending" });
  const payable = (description: string, amount: number, d: number, category: string, costCenter: string, method?: string) => ({
    restaurantId: R, kind: "payable", description, amount, dueDate: day(d), category, costCenter, ...(method ? paid(d, method) : { status: "pending" })
  });
  await prisma.financeEntry.createMany({
    data: [
      payable("Aluguel do salão", 8500, 5, "Aluguel", "Administrativo", "Transferência"),
      payable("Folha de pagamento", 24800, 5, "Folha e encargos", "Administrativo", "Transferência"),
      payable("Hortifrúti da semana", 874.9, 8, "Insumos e bebidas", "Cozinha"),
      payable("Fornecedor de carnes (blends e costela)", 6742.3, 10, "Insumos e bebidas", "Cozinha"),
      payable("Distribuidora de bebidas", 3180.45, 12, "Insumos e bebidas", "Salão"),
      payable("Energia elétrica", 2315.67, 15, "Energia e gás", "Administrativo"),
      payable("Gás GLP", 689, 18, "Energia e gás", "Cozinha"),
      payable("DAS — Simples Nacional", 4120, 20, "Impostos (DAS)", "Administrativo"),
      payable("Embalagens para viagem", 512.8, 25, "Outras despesas", "Salão"),
      { restaurantId: R, kind: "receivable", description: "Evento corporativo — sinal de 50%", amount: 2400, dueDate: day(15), category: "Vendas salão", costCenter: "Salão", status: "pending" },
      { restaurantId: R, kind: "receivable", description: "Vale-presente vendido no balcão", amount: 150, dueDate: day(1), category: "Vendas salão", costCenter: "Salão", status: "paid", paidOn: day(1), paymentMethod: "PIX" }
    ]
  });

  await prisma.operatingHour.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ restaurantId: R, weekday, lunch: weekday === 0 ? "" : "11:30 – 15:00", dinner: "18:00 – 23:30", isOpen: weekday !== 0 }))
  });

  const staff = [
    ["Rafael Moura", "dono@chapa27.example", "owner"],
    ["Juliana Prates", "gerente@chapa27.example", "manager"],
    ["Diego Alves", "garcom@chapa27.example", "waiter"],
    ["Carla Nunes", "cozinha@chapa27.example", "kitchen"]
  ];
  await prisma.staffMember.createMany({ data: staff.map(([name, email, role]) => ({ restaurantId: R, name, email, role, passwordHash })) });

  console.log(`Chapa 27 Burgers criado: ${Object.values(MENU).flat().length} itens no cardápio, ${INSUMOS.length} insumos, 30 mesas.`);
  console.log(`Logins (${process.env.SEED_DEMO_PASSWORD ? "senha de SEED_DEMO_PASSWORD" : `senha: ${password} — anote, não aparece de novo`}):`);
  for (const [name, email, role] of staff) console.log(`  ${email}  ${role}  (${name})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
