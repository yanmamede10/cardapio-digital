// Seed content ported 1:1 from the approved CardapioApp.dc.html design prototype
// (the `places` and `menu` arrays inside Component), so the real app launches with
// the exact copy/pricing the design was approved with instead of placeholder text.
import { PrismaClient } from "@prisma/client";
import { PLAN_MODULES } from "@cardapio/shared";
import { hashPassword } from "../src/lib/auth.js";

// Wipes the whole database and creates logins with senha123: never in production (the VM's API image has NODE_ENV=production;
// its seed is seed-demo.ts, via deploy/deploy.sh seed-demo).
if (process.env.NODE_ENV === "production") {
  console.error("Recusado: o seed de dev (prisma/seed.ts) apaga o banco e cria logins com senha123. Em produção, use o seed de demonstração: deploy/deploy.sh seed-demo.");
  process.exit(1);
}

const prisma = new PrismaClient();
// Dev-only default password for seeded staff logins — never used outside local seeding.
const DEV_STAFF_PASSWORD_HASH = hashPassword("senha123");

type RawOption = { label: string; price: number };
type RawGroup = { id: string; label: string; type: "radio" | "check"; hint: string; options: RawOption[] };
type RawItem = {
  id: string;
  name: string;
  cat: string;
  price: number;
  tag?: string;
  tagIcon?: string;
  soldOut?: boolean;
  desc: string;
  long: string;
  photo: string;
  groups: RawGroup[];
};

// The design's single flat `menu` array — used verbatim for every seeded
// restaurant below (restaurant-prefixed ids) because the source design never
// authored distinct per-restaurant catalogs; only the Fogo & Nó identity header
// (name/rating/cuisine) changes between restaurants in the prototype. Real
// per-restaurant catalogs are a job for the future restaurant dashboard module.
const menu: RawItem[] = [
  {
    id: "picanha", name: "Picanha na Brasa", cat: "Pratos Principais", price: 89.9,
    tag: "Mais pedido", tagIcon: "fa-solid fa-fire",
    desc: "Corte nobre na brasa, farofa de bacon e vinagrete da casa.",
    long: "Picanha maturada grelhada na brasa de quebracho, servida com farofa de bacon, vinagrete de tomate e limão, e pão de alho. Serve 1 pessoa com bom apetite.",
    photo: "foto · picanha na brasa",
    groups: [
      { id: "ponto", label: "Ponto da carne", type: "radio", hint: "escolha 1", options: [{ label: "Mal passada", price: 0 }, { label: "Ao ponto", price: 0 }, { label: "Bem passada", price: 0 }] },
      { id: "acomp", label: "Acompanhamento", type: "radio", hint: "escolha 1", options: [{ label: "Arroz branco", price: 0 }, { label: "Arroz biro-biro", price: 6 }, { label: "Purê de baroa", price: 9 }] },
      { id: "extra", label: "Adicionais", type: "check", hint: "opcional", options: [{ label: "Farofa extra", price: 5 }, { label: "Molho chimichurri", price: 4 }, { label: "Queijo coalho grelhado", price: 7 }] }
    ]
  },
  {
    id: "risoto", name: "Risoto de Cogumelos", cat: "Pratos Principais", price: 62,
    tag: "Vegetariano", tagIcon: "fa-solid fa-leaf",
    desc: "Arbóreo cremoso com shiitake, shimeji e parmesão.",
    long: "Arroz arbóreo cozido lentamente com caldo de legumes, mix de cogumelos frescos salteados na manteiga e parmesão de 12 meses. Finalizado com azeite trufado.",
    photo: "foto · risoto de cogumelos",
    groups: [{ id: "extra", label: "Adicionais", type: "check", hint: "opcional", options: [{ label: "Parmesão extra", price: 6 }, { label: "Azeite trufado", price: 8 }] }]
  },
  {
    id: "moqueca", name: "Moqueca de Peixe", cat: "Pratos Principais", price: 78, soldOut: true,
    desc: "Badejo, leite de coco, dendê e pirão. Serve 2.",
    long: "Badejo fresco cozido no leite de coco com pimentões, coentro e dendê. Acompanha arroz, pirão e farofa. Serve 2 pessoas.",
    photo: "foto · moqueca de peixe", groups: []
  },
  {
    id: "burger", name: "Burger da Casa", cat: "Lanches", price: 42,
    desc: "Blend 180g, cheddar inglês, cebola caramelizada.",
    long: "Blend de 180g de acém e costela, cheddar inglês, cebola caramelizada no shoyu, maionese defumada da casa e pão brioche tostado na manteiga. Acompanha fritas rústicas.",
    photo: "foto · burger da casa",
    groups: [
      { id: "ponto", label: "Ponto da carne", type: "radio", hint: "escolha 1", options: [{ label: "Ao ponto", price: 0 }, { label: "Bem passada", price: 0 }] },
      { id: "pao", label: "Pão", type: "radio", hint: "escolha 1", options: [{ label: "Brioche", price: 0 }, { label: "Australiano", price: 3 }] },
      { id: "extra", label: "Adicionais", type: "check", hint: "opcional", options: [{ label: "Bacon", price: 6 }, { label: "Cheddar extra", price: 4 }, { label: "Ovo", price: 3 }] }
    ]
  },
  {
    id: "pernil", name: "Sanduíche de Pernil", cat: "Lanches", price: 34,
    desc: "Pernil desfiado, vinagrete e queijo meia cura.",
    long: "Pernil assado por 8 horas, desfiado e selado na chapa, com queijo meia cura derretido e vinagrete de tomate no pão baguete.",
    photo: "foto · sanduíche de pernil",
    groups: [{ id: "extra", label: "Adicionais", type: "check", hint: "opcional", options: [{ label: "Queijo extra", price: 4 }, { label: "Pimenta biquinho", price: 3 }] }]
  },
  {
    id: "margherita", name: "Pizza Margherita", cat: "Pizzas", price: 54,
    desc: "Molho de tomate San Marzano, mozzarella fior di latte.",
    long: "Massa de fermentação natural de 48h, molho de tomate San Marzano, mozzarella fior di latte e basílico fresco. Assada em forno a lenha.",
    photo: "foto · pizza margherita",
    groups: [
      { id: "tam", label: "Tamanho", type: "radio", hint: "escolha 1", options: [{ label: "Broto · 4 fatias", price: 0 }, { label: "Média · 6 fatias", price: 12 }, { label: "Grande · 8 fatias", price: 22 }] },
      { id: "borda", label: "Borda recheada", type: "check", hint: "opcional", options: [{ label: "Catupiry", price: 8 }, { label: "Cheddar", price: 8 }] }
    ]
  },
  {
    id: "calabresa", name: "Pizza Calabresa Artesanal", cat: "Pizzas", price: 58,
    desc: "Calabresa artesanal, cebola roxa e orégano fresco.",
    long: "Calabresa artesanal defumada fatiada na hora, cebola roxa, mozzarella e orégano fresco sobre massa de fermentação natural.",
    photo: "foto · pizza calabresa",
    groups: [{ id: "tam", label: "Tamanho", type: "radio", hint: "escolha 1", options: [{ label: "Broto · 4 fatias", price: 0 }, { label: "Média · 6 fatias", price: 12 }, { label: "Grande · 8 fatias", price: 22 }] }]
  },
  {
    id: "pudim", name: "Pudim de Leite", cat: "Sobremesas", price: 18,
    desc: "Receita da casa, calda de caramelo queimado.",
    long: "Pudim de leite condensado assado em banho-maria, textura densa e calda de caramelo queimado na hora.",
    photo: "foto · pudim de leite", groups: []
  },
  {
    id: "gateau", name: "Petit Gâteau", cat: "Sobremesas", price: 26,
    desc: "Bolo quente de chocolate 70% com sorvete.",
    long: "Bolo quente de chocolate 70% com centro cremoso, servido com uma bola de sorvete à sua escolha.",
    photo: "foto · petit gâteau",
    groups: [{ id: "sorvete", label: "Sorvete", type: "radio", hint: "escolha 1", options: [{ label: "Baunilha", price: 0 }, { label: "Creme", price: 0 }, { label: "Pistache", price: 4 }] }]
  },
  {
    id: "limonada", name: "Limonada Suíça", cat: "Bebidas", price: 14,
    desc: "Limão batido com leite condensado e gelo.",
    long: "Limão tahiti batido com gelo e leite condensado, coado na hora. 500ml.",
    photo: "foto · limonada suíça",
    groups: [{ id: "tam", label: "Tamanho", type: "radio", hint: "escolha 1", options: [{ label: "Copo 300ml", price: 0 }, { label: "Jarra 1L", price: 12 }] }]
  },
  {
    id: "chopp", name: "Chopp Artesanal IPA", cat: "Bebidas", price: 19,
    desc: "IPA local, 500ml, notas cítricas e amargor médio.",
    long: "IPA de cervejaria local, 500ml, lúpulos americanos, notas cítricas e amargor médio.",
    photo: "foto · chopp artesanal", groups: []
  },
  {
    id: "agua", name: "Água com Gás", cat: "Bebidas", price: 7,
    desc: "Garrafa 500ml, servida gelada.",
    long: "Água mineral com gás, garrafa de 500ml, servida gelada com limão a pedido.",
    photo: "foto · água com gás", groups: []
  }
];

const categoryOrder = ["Pratos Principais", "Lanches", "Pizzas", "Sobremesas", "Bebidas"];

const places = [
  { id: "fogo", name: "Fogo & Nó", initials: "FN", cuisine: "Brasileira · Grelhados", tags: ["Brasileira"], rating: 4.8, reviews: 312, time: "30–40 min", fee: 8.9, open: true, promo: "20% off", cover: "foto · capa fogo & nó" },
  { id: "napoli", name: "Forno di Napoli", initials: "FD", cuisine: "Pizza · Italiana", tags: ["Pizza"], rating: 4.7, reviews: 1204, time: "40–50 min", fee: 0, open: true, promo: "Frete grátis", cover: "foto · capa forno di napoli" },
  { id: "brasa", name: "Brasa Burger Co.", initials: "BB", cuisine: "Hambúrguer · Lanches", tags: ["Hambúrguer"], rating: 4.6, reviews: 876, time: "25–35 min", fee: 6.9, open: true, promo: "", cover: "foto · capa brasa burger" },
  { id: "kome", name: "Kome Sushi", initials: "KS", cuisine: "Japonesa · Sushi", tags: ["Japonesa"], rating: 4.9, reviews: 542, time: "45–60 min", fee: 12.9, open: false, reopen: "Abre às 18:00", cover: "foto · capa kome sushi" },
  { id: "doce", name: "Doce Hora", initials: "DH", cuisine: "Doces · Confeitaria", tags: ["Doces"], rating: 4.8, reviews: 233, time: "20–30 min", fee: 0, open: true, promo: "2 por 1", cover: "foto · capa doce hora" },
  { id: "tempero", name: "Tempero da Vó", initials: "TV", cuisine: "Brasileira · Caseira", tags: ["Brasileira"], rating: 4.5, reviews: 148, time: "35–45 min", fee: 5.9, open: false, reopen: "Abre amanhã, 11:00", cover: "foto · capa tempero da vó" }
];

const addresses = [
  { id: "addr-casa", label: "Casa", detail: "Rua Aurora, 214 · apto 52 — Vila Madalena", icon: "fa-solid fa-house", isDefault: true },
  { id: "addr-trabalho", label: "Trabalho", detail: "Av. Faria Lima, 3900 · 8º andar — Itaim", icon: "fa-solid fa-briefcase", isDefault: false }
];

const paymentMethods = [
  { id: "pix", label: "Pix", note: "aprovação na hora", icon: "fa-solid fa-qrcode" },
  { id: "cartao", label: "Cartão de crédito", note: "•••• 4412", icon: "fa-solid fa-credit-card" },
  { id: "novo", label: "Novo cartão", note: "", icon: "fa-solid fa-circle-plus" },
  { id: "entrega", label: "Pagar na entrega", note: "maquininha", icon: "fa-solid fa-money-bill-wave" }
];

function parseEta(range: string): [number, number] {
  const [min, max] = range.replace(" min", "").split("–").map((n) => parseInt(n, 10));
  return [min, max];
}

async function main() {
  await prisma.supportMessage.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.review.deleteMany();
  await prisma.staffMember.deleteMany();
  await prisma.operatingHour.deleteMany();
  await prisma.billingCharge.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.waiterCall.deleteMany();
  await prisma.restaurantTable.deleteMany();
  await prisma.orderLine.deleteMany();
  await prisma.order.deleteMany();
  await prisma.financeEntry.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.productComponent.deleteMany();
  await prisma.product.deleteMany();
  await prisma.menuCategory.deleteMany();
  await prisma.address.deleteMany();
  await prisma.paymentMethod.deleteMany();
  await prisma.restaurant.deleteMany();

  for (const [i, p] of places.entries()) {
    const [etaMin, etaMax] = parseEta(p.time);
    await prisma.restaurant.create({
      data: {
        id: p.id,
        name: p.name,
        initials: p.initials,
        cuisine: p.cuisine,
        cuisineTagsJson: JSON.stringify(p.tags),
        rating: p.rating,
        reviewCount: p.reviews,
        etaMinMinutes: etaMin,
        etaMaxMinutes: etaMax,
        deliveryFee: p.fee,
        isOpen: p.open,
        reopensAt: p.reopen ?? null,
        promoLabel: p.promo ? p.promo : null,
        coverLabel: p.cover,
        sortOrder: i,
        // The dev seed's delivery restaurants: every module, Delivery included (the column's default no longer has it, F-6).
        planModulesJson: JSON.stringify(PLAN_MODULES)
      }
    });

    const categoryIds: Record<string, string> = {};
    for (const [ci, catName] of categoryOrder.entries()) {
      const categoryId = `${p.id}-cat-${ci}`;
      categoryIds[catName] = categoryId;
      await prisma.menuCategory.create({
        data: { id: categoryId, restaurantId: p.id, name: catName, sortOrder: ci }
      });
    }

    for (const [ii, item] of menu.entries()) {
      const product = await prisma.product.create({
        data: { id: `p-${p.id}-${item.id}`, restaurantId: p.id, name: item.name, type: "produto", unit: "un", price: item.price, categoryId: categoryIds[item.cat] }
      });
      await prisma.menuItem.create({
        data: {
          id: `${p.id}-${item.id}`,
          restaurantId: p.id,
          productId: product.id,
          name: item.name,
          shortDescription: item.desc,
          longDescription: item.long,
          price: item.price,
          photoLabel: item.photo,
          tag: item.tag ?? null,
          tagIcon: item.tagIcon ?? null,
          soldOut: !!item.soldOut,
          optionGroupsJson: JSON.stringify(
            item.groups.map((g) => ({
              id: g.id,
              label: g.label,
              type: g.type === "radio" ? "single" : "multi",
              hint: g.hint,
              options: g.options.map((o, oi) => ({
                id: `${g.id}-${oi}`,
                label: o.label,
                priceDelta: o.price
              }))
            }))
          ),
          sortOrder: ii
        }
      });
    }
  }

  for (const a of addresses) {
    await prisma.address.create({ data: a });
  }
  for (const pm of paymentMethods) {
    await prisma.paymentMethod.create({ data: pm });
  }

  // Dev-convenience demo history: a fresh guest session has a genuinely empty
  // order history (that's correct real-app behavior — history is only what a
  // guest has actually ordered). To let anyone poke at the Histórico screen
  // without placing real orders first, seed 3 delivered demo orders under a
  // reserved "demo-guest" session id; pass `X-Session-Id: demo-guest` to see them.
  const demoOrders = [
    { code: "#8842", daysAgo: 8, lines: [{ item: "fogo-picanha", qty: 1 }, { item: "fogo-limonada", qty: 2 }] },
    { code: "#8611", daysAgo: 17, lines: [{ item: "fogo-burger", qty: 1 }, { item: "fogo-chopp", qty: 1 }] },
    { code: "#8390", daysAgo: 28, lines: [{ item: "fogo-margherita", qty: 1 }, { item: "fogo-pudim", qty: 1 }] }
  ];
  for (const demo of demoOrders) {
    const lineRows = [];
    let subtotal = 0;
    for (const l of demo.lines) {
      const item = menu.find((m) => `fogo-${m.id}` === l.item)!;
      const unitPrice = item.price;
      subtotal += unitPrice * l.qty;
      lineRows.push({
        itemId: l.item,
        name: item.name,
        unitPrice,
        quantity: l.qty,
        notes: "",
        selectedOptionsJson: "[]"
      });
    }
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - demo.daysAgo);
    await prisma.order.create({
      data: {
        code: demo.code,
        mode: "delivery",
        restaurantId: "fogo",
        restaurantName: "Fogo & Nó",
        guestSessionId: "demo-guest",
        addressId: "addr-casa",
        paymentMethodId: "pix",
        subtotal: Math.round(subtotal * 100) / 100,
        deliveryFee: 8.9,
        discount: 0,
        total: Math.round((subtotal + 8.9) * 100) / 100,
        status: "delivered",
        round: 1,
        createdAt,
        lines: { create: lineRows }
      }
    });
  }

  // ---------------------------------------------------------------------
  // Restaurant management dashboard — all scoped to "fogo", the only
  // restaurant the dashboard's VITE_RESTAURANT_ID points at.
  // ---------------------------------------------------------------------

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const menuById = (id: string) => menu.find((m) => m.id === id)!;

  function linesFor(picks: { item: string; qty: number }[]) {
    const lineRows = picks.map((p) => {
      const item = menuById(p.item);
      return { itemId: `fogo-${p.item}`, name: item.name, unitPrice: item.price, quantity: p.qty, notes: "", selectedOptionsJson: "[]" };
    });
    const subtotal = round2(lineRows.reduce((t, l) => t + l.unitPrice * l.quantity, 0));
    return { lineRows, subtotal };
  }

  function minutesAgo(m: number): Date {
    return new Date(Date.now() - m * 60000);
  }

  await prisma.restaurant.update({
    where: { id: "fogo" },
    data: {
      description: "Grelhados na brasa e clássicos brasileiros num salão descontraído, com cardápio de mesa e delivery pelo mesmo cardápio digital.",
      cnpj: "12.345.678/0001-90",
      legalName: "Fogo & Nó Gastronomia Ltda.",
      stateRegistration: "149.284.762.118",
      taxRegime: "simples_nacional",
      fiscalAddress: "Rua Aurora, 214 — Vila Madalena, São Paulo/SP",
      deliveryFeeCap: 400,
      planPrice: 189.9,
      planDueDay: 10,
      // The demo restaurant: everything but Emissão Fiscal (no NFC-e provider yet).
      planModulesJson: JSON.stringify(PLAN_MODULES.filter((m) => m !== "fiscal"))
    }
  });

  // Tables — 1-10, a few opened with an active comanda so the Mesas screen
  // has something to show on a fresh seed.
  const tableSeats = [2, 2, 4, 4, 4, 6, 4, 2, 6, 4];
  for (const [i, seats] of tableSeats.entries()) {
    const number = i + 1;
    let openedAt: Date | null = null;
    if (number === 2) openedAt = minutesAgo(74); // awaiting_payment: its order below is already "served"
    if (number === 3) openedAt = minutesAgo(6); // pending
    if (number === 5) openedAt = minutesAgo(16); // preparing
    if (number === 7) openedAt = minutesAgo(27); // ready
    await prisma.restaurantTable.create({ data: { restaurantId: "fogo", number, seats, openedAt } });
  }

  // Today's live order queue — spans every kanban bucket the dashboard renders.
  const todayOrders: {
    mode: "table" | "delivery";
    tableNumber?: number;
    guestName?: string;
    addressId?: string;
    paymentMethodId?: string;
    status: string;
    createdAgo: number;
    prepMinutes?: number;
    picks: { item: string; qty: number }[];
  }[] = [
    { mode: "table", tableNumber: 3, guestName: "Rafael", status: "pending", createdAgo: 6, picks: [{ item: "burger", qty: 2 }, { item: "chopp", qty: 2 }] },
    { mode: "delivery", addressId: "addr-casa", paymentMethodId: "pix", status: "pending", createdAgo: 4, picks: [{ item: "margherita", qty: 1 }, { item: "limonada", qty: 1 }] },
    { mode: "table", tableNumber: 5, guestName: "Camila", status: "preparing", createdAgo: 16, picks: [{ item: "picanha", qty: 1 }, { item: "risoto", qty: 1 }, { item: "agua", qty: 2 }] },
    { mode: "delivery", addressId: "addr-trabalho", paymentMethodId: "cartao", status: "preparing", createdAgo: 14, picks: [{ item: "calabresa", qty: 1 }] },
    { mode: "table", tableNumber: 7, guestName: "Diego", status: "ready", createdAgo: 27, picks: [{ item: "pernil", qty: 2 }, { item: "chopp", qty: 2 }] },
    { mode: "delivery", addressId: "addr-casa", paymentMethodId: "pix", status: "ready", createdAgo: 24, picks: [{ item: "gateau", qty: 2 }] },
    { mode: "table", tableNumber: 2, guestName: "Bianca", status: "served", createdAgo: 74, prepMinutes: 22, picks: [{ item: "moqueca", qty: 1 }, { item: "limonada", qty: 2 }] },
    { mode: "delivery", addressId: "addr-casa", paymentMethodId: "entrega", status: "delivered", createdAgo: 96, prepMinutes: 31, picks: [{ item: "picanha", qty: 1 }, { item: "pudim", qty: 1 }] },
    { mode: "delivery", addressId: "addr-trabalho", paymentMethodId: "pix", status: "delivered", createdAgo: 150, prepMinutes: 27, picks: [{ item: "burger", qty: 2 }] },
    { mode: "table", tableNumber: 9, guestName: "Otávio", status: "cancelled", createdAgo: 40, picks: [{ item: "moqueca", qty: 1 }] }
  ];

  let orderSeq = 9000;
  for (const o of todayOrders) {
    const { lineRows, subtotal } = linesFor(o.picks);
    const deliveryFee = o.mode === "delivery" ? 8.9 : 0;
    const total = round2(subtotal + deliveryFee);
    const createdAt = minutesAgo(o.createdAgo);
    const updatedAt = o.prepMinutes ? new Date(createdAt.getTime() + o.prepMinutes * 60000) : createdAt;
    await prisma.order.create({
      data: {
        code: `#${orderSeq++}`,
        mode: o.mode,
        restaurantId: "fogo",
        restaurantName: "Fogo & Nó",
        tableNumber: o.tableNumber ?? null,
        guestName: o.guestName ?? null,
        guestSessionId: `seed-${o.mode}-${orderSeq}`,
        addressId: o.mode === "delivery" ? o.addressId ?? null : null,
        paymentMethodId: o.mode === "delivery" ? o.paymentMethodId ?? null : null,
        subtotal,
        deliveryFee,
        discount: 0,
        total,
        status: o.status,
        round: 1,
        createdAt,
        updatedAt,
        lines: { create: lineRows }
      }
    });
  }

  // Historical orders (last 14 days, excluding today) so Relatórios has a
  // real trend line, top/bottom sellers and a non-empty heatmap.
  const historyPool: { item: string; qty: number }[][] = [
    [{ item: "picanha", qty: 1 }, { item: "limonada", qty: 1 }],
    [{ item: "burger", qty: 2 }, { item: "chopp", qty: 1 }],
    [{ item: "margherita", qty: 1 }],
    [{ item: "risoto", qty: 1 }, { item: "agua", qty: 1 }],
    [{ item: "calabresa", qty: 1 }, { item: "gateau", qty: 1 }],
    [{ item: "pernil", qty: 1 }],
    [{ item: "picanha", qty: 2 }, { item: "chopp", qty: 2 }],
    [{ item: "pudim", qty: 2 }]
  ];
  const historyHours = [11, 12, 13, 18, 19, 20, 21, 22];
  for (let daysAgo = 1; daysAgo <= 45; daysAgo++) {
    const ordersThatDay = 2 + (daysAgo % 3);
    for (let n = 0; n < ordersThatDay; n++) {
      const picks = historyPool[(daysAgo + n) % historyPool.length];
      const { lineRows, subtotal } = linesFor(picks);
      const mode: "table" | "delivery" = (daysAgo + n) % 2 === 0 ? "table" : "delivery";
      const deliveryFee = mode === "delivery" ? 8.9 : 0;
      const cancelled = (daysAgo + n) % 11 === 0;
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - daysAgo);
      createdAt.setHours(historyHours[(daysAgo + n) % historyHours.length], (n * 17) % 60, 0, 0);
      const prepMinutes = 18 + ((daysAgo + n) % 20);
      await prisma.order.create({
        data: {
          code: `#${orderSeq++}`,
          mode,
          restaurantId: "fogo",
          restaurantName: "Fogo & Nó",
          tableNumber: mode === "table" ? 1 + ((daysAgo + n) % 10) : null,
          guestName: mode === "table" ? "Cliente" : null,
          guestSessionId: `seed-hist-${daysAgo}-${n}`,
          addressId: mode === "delivery" ? "addr-casa" : null,
          paymentMethodId: mode === "delivery" ? "pix" : null,
          subtotal,
          deliveryFee,
          discount: 0,
          total: round2(subtotal + deliveryFee),
          status: cancelled ? "cancelled" : mode === "delivery" ? "delivered" : "served",
          round: 1,
          createdAt,
          updatedAt: cancelled ? createdAt : new Date(createdAt.getTime() + prepMinutes * 60000),
          closedAt: mode === "table" ? new Date(createdAt.getTime() + prepMinutes * 60000) : null, // past comandas were paid
          lines: { create: lineRows }
        }
      });
    }
  }

  await prisma.waiterCall.create({
    data: { restaurantId: "fogo", tableNumber: 5, reason: "Precisa de talheres", createdAt: minutesAgo(5) }
  });

  await prisma.coupon.createMany({
    data: [
      {
        restaurantId: "fogo", code: "BEMVINDO10", kind: "percent", value: 10, channel: "both",
        validUntil: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1), usageLimit: 500, usedCount: 128, active: true
      },
      {
        restaurantId: "fogo", code: "FRETEGRATIS", kind: "fixed", value: 8.9, channel: "delivery",
        validUntil: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 15), usageLimit: 200, usedCount: 54, active: true
      },
      {
        restaurantId: "fogo", code: "MESACOMBO", kind: "combo", value: 0, channel: "table",
        validUntil: new Date(new Date().getFullYear(), new Date().getMonth() + 2, 1), usageLimit: 100, usedCount: 12, active: true,
        comboItemIdsJson: JSON.stringify(["fogo-picanha", "fogo-limonada"]), comboPrice: 79.9
      },
      {
        restaurantId: "fogo", code: "VERAO23", kind: "percent", value: 15, channel: "both",
        validUntil: new Date(new Date().getFullYear() - 1, 2, 1), usageLimit: 300, usedCount: 300, active: false
      }
    ]
  });

  await prisma.supportTicket.create({
    data: {
      restaurantId: "fogo", channel: "delivery", customerName: "Juliana Prado", refLabel: "Pedido #9002",
      status: "new", assignee: null, unreadCount: 2, lastActivityAt: minutesAgo(12),
      messages: {
        create: [
          { from: "customer", authorName: "Juliana Prado", text: "Meu pedido veio sem a limonada, pode me ajudar?", createdAt: minutesAgo(18) },
          { from: "customer", authorName: "Juliana Prado", text: "Ainda estou esperando um retorno", createdAt: minutesAgo(12) }
        ]
      }
    }
  });
  await prisma.supportTicket.create({
    data: {
      restaurantId: "fogo", channel: "table", customerName: "Diego Ramos", refLabel: "Mesa 07",
      status: "in_progress", assignee: "Marina Duarte", unreadCount: 0, lastActivityAt: minutesAgo(30),
      messages: {
        create: [
          { from: "customer", authorName: "Diego Ramos", text: "Dá pra trazer mais uma rodada de chopp?", createdAt: minutesAgo(40) },
          { from: "staff", authorName: "Marina Duarte", text: "Já estou levando até a mesa!", createdAt: minutesAgo(30) }
        ]
      }
    }
  });
  await prisma.supportTicket.create({
    data: {
      restaurantId: "fogo", channel: "delivery", customerName: "Otávio Lima", refLabel: "Pedido #9040",
      status: "resolved", assignee: "Marina Duarte", unreadCount: 0, lastActivityAt: minutesAgo(400),
      messages: {
        create: [
          { from: "customer", authorName: "Otávio Lima", text: "Pedido demorou além do previsto, o que houve?", createdAt: minutesAgo(420) },
          { from: "staff", authorName: "Marina Duarte", text: "Peço desculpas, tivemos um pico de pedidos. Já aplicamos um cupom de desconto na sua próxima compra.", createdAt: minutesAgo(400) }
        ]
      }
    }
  });

  await prisma.review.createMany({
    data: [
      { restaurantId: "fogo", channel: "delivery", customerName: "Marcos Villela", rating: 5, text: "Picanha excelente e chegou quentinha!", createdAt: minutesAgo(60 * 26), reply: "Obrigado, Marcos! Volte sempre.", repliedAt: minutesAgo(60 * 25) },
      { restaurantId: "fogo", channel: "table", customerName: "Fernanda Alves", rating: 4, text: "Atendimento ótimo, só demorou um pouco para a sobremesa.", createdAt: minutesAgo(60 * 50), reply: null, repliedAt: null },
      { restaurantId: "fogo", channel: "delivery", customerName: "Otávio Lima", rating: 3, text: "Pedido demorou mais do que o informado.", createdAt: minutesAgo(60 * 70), reply: null, repliedAt: null },
      { restaurantId: "fogo", channel: "table", customerName: "Camila Nogueira", rating: 5, text: "Risoto de cogumelos é sensacional, virei cliente fiel.", createdAt: minutesAgo(60 * 120), reply: "Que alegria, Camila! Até a próxima.", repliedAt: minutesAgo(60 * 118) },
      { restaurantId: "fogo", channel: "delivery", customerName: "Rafael Souza", rating: 5, text: "Melhor burger da região, sem dúvidas.", createdAt: minutesAgo(60 * 200), reply: null, repliedAt: null }
    ]
  });

  await prisma.staffMember.createMany({
    data: [
      { restaurantId: "fogo", name: "Marina Duarte", email: "marina@fogoeno.com.br", role: "owner", passwordHash: DEV_STAFF_PASSWORD_HASH, invitedAt: minutesAgo(60 * 24 * 200) },
      { restaurantId: "fogo", name: "Bruno Castro", email: "bruno@fogoeno.com.br", role: "manager", passwordHash: DEV_STAFF_PASSWORD_HASH, invitedAt: minutesAgo(60 * 24 * 90) },
      { restaurantId: "fogo", name: "Paula Nunes", email: "paula@fogoeno.com.br", role: "waiter", passwordHash: DEV_STAFF_PASSWORD_HASH, invitedAt: minutesAgo(60 * 24 * 40) },
      { restaurantId: "fogo", name: "Igor Matos", email: "igor@fogoeno.com.br", role: "kitchen", passwordHash: DEV_STAFF_PASSWORD_HASH, invitedAt: minutesAgo(60 * 24 * 15) }
    ]
  });

  await prisma.operatingHour.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      restaurantId: "fogo",
      weekday,
      lunch: weekday === 0 ? "" : "11:30 – 15:00",
      dinner: "18:30 – 23:30",
      isOpen: weekday !== 0
    }))
  });

  // Mensalidades of the demo restaurant: last month's and this month's, both paid (a demo shouldn't open on "Atrasado").
  const dueOn = (monthsAgo: number) => new Date(new Date().getFullYear(), new Date().getMonth() - monthsAgo, 10);
  const ymd = (d: Date) => d.toLocaleDateString("sv-SE");
  const mensalidade = (monthsAgo: number) => {
    const date = dueOn(monthsAgo);
    return { restaurantId: "fogo", date, description: `Mensalidade ${ymd(date).slice(5, 7)}/${ymd(date).slice(0, 4)}`, value: 189.9, status: "paid", month: ymd(date).slice(0, 7), paidOn: ymd(new Date(date.getTime() - 2 * 86400000)), paymentMethod: "PIX" };
  };
  await prisma.billingCharge.createMany({
    data: [
      mensalidade(1),
      { restaurantId: "fogo", date: dueOn(1), description: "Taxa de entrega excedente", value: 42.5, status: "paid" },
      mensalidade(0)
    ]
  });

  console.log(`Seeded ${places.length} restaurants × ${menu.length} items, ${addresses.length} addresses, ${paymentMethods.length} payment methods, ${demoOrders.length} demo history orders, plus management data (tables, coupons, tickets, reviews, staff, hours, billing) for fogo.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
