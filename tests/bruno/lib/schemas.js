// Schemas JSON das respostas da API, espelhando packages/shared/src/types.ts (ApiRestaurant, ApiMenuItem, ApiOrder...).
// Os testes da coleção validam cada resposta com Ajv: um campo que some, muda de tipo ou ganha null sem aviso reprova.
const Ajv = require("ajv");

const ajv = new Ajv({ allErrors: true });

const str = { type: "string" };
const num = { type: "number" };
const bool = { type: "boolean" };
const nullable = (t) => ({ type: [t, "null"] });
const obj = (properties, extra = {}) => ({ type: "object", required: Object.keys(properties), properties, ...extra });
const list = (items, minItems = 0) => ({ type: "array", items, minItems });

const erro = obj({ error: str });

const opcao = obj({ id: str, label: str, priceDelta: num });
const grupoDeOpcoes = obj({ id: str, label: str, type: { enum: ["single", "multi"] }, hint: str, options: list(opcao, 1) });

const staff = obj({ id: str, restaurantId: str, name: str, email: str, role: str });

const restaurante = obj({
  id: str, name: str, initials: str, cuisine: str, cuisineTags: list(str), rating: num, reviewCount: { type: "integer" },
  etaMinMinutes: { type: "integer" }, etaMaxMinutes: { type: "integer" }, deliveryFee: num, isOpen: bool,
  delivery: bool, hours: list({ type: "object" })
});

const categoria = obj({ id: str, restaurantId: str, name: str, sortOrder: { type: "integer" } });

const prato = obj({
  id: str, restaurantId: str, categoryId: nullable("string"), categoryName: str, name: str, shortDescription: str,
  longDescription: str, price: { type: "number", minimum: 0 }, imageUrl: nullable("string"), soldOut: bool,
  sortOrder: { type: "integer" }, optionGroups: list(grupoDeOpcoes)
});

const linhaDoPedido = obj({
  id: str, itemId: str, name: str, unitPrice: num, quantity: { type: "integer", minimum: 1 }, notes: str,
  selectedOptions: list(obj({ groupId: str, optionId: str, label: str, priceDelta: num }))
});

const pedido = obj({
  id: str, code: str, mode: { enum: ["table", "delivery"] }, restaurantId: str, restaurantName: str,
  tableNumber: nullable("integer"), lines: list(linhaDoPedido, 1), subtotal: num, deliveryFee: num, discount: num,
  total: num, status: str, round: { type: "integer" }, createdAt: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}T" },
  closedAt: nullable("string")
});

const schemas = {
  erro,
  saude: obj({ ok: { const: true } }),
  login: obj({ token: { type: "string", minLength: 20 }, staff, mustChangePassword: bool }),
  sessao: obj({ staff, modules: list(str, 1), mustChangePassword: bool }),
  restaurante,
  categorias: list(categoria, 1),
  prato,
  pratos: list(prato, 1),
  formasDePagamento: list(obj({ id: str, label: str, note: str, icon: str }), 1),
  mesaCriada: obj({ number: { type: "integer", minimum: 1 } }),
  qr: obj({ tableCode: { type: "string", minLength: 8 } }),
  mesaDoQr: obj({ restaurantId: str, tableNumber: { type: "integer" } }),
  pedido,
  pedidos: list(pedido)
};

/** Valida `body` contra o schema `nome`; devolve a lista de erros do Ajv em texto (vazia quando passa). */
function validar(nome, body) {
  const validate = ajv.compile(schemas[nome]);
  return validate(body) ? "" : ajv.errorsText(validate.errors, { dataVar: "resposta" });
}

module.exports = { validar };
