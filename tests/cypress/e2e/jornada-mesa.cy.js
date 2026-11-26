// Jornada completa do pedido pela mesa, nas telas reais: a cozinha entra no painel, o cliente pede pelo QR (app do
// cliente, celular) e a cozinha aceita o pedido na Central. As três etapas rodam em ordem, no mesmo banco descartável.
// Equivale ao E2E-01 do plano de testes (tests/e2e/fluxo-critico.spec.ts, no Playwright), aqui reescrito no Cypress.

const R = Cypress.env("RESTAURANTE");
const MESA = 27; // livre no seed de demonstração: o primeiro pedido fica "Aguardando aceite"
const CLIENTE = "6f1c2b9e-27aa-4c3e-9d4b-cafe00000027"; // o id do aparelho do cliente (cardapio.sessionId)

describe("Pedido pela mesa — do QR à cozinha", () => {
  it("1. login: senha errada mostra o erro; a certa abre a Central de Pedidos", () => {
    cy.visit("/");
    cy.get("#login-email").type(`cozinha@${R}.example`);
    cy.get("#login-password").type("senha-errada");
    cy.contains("button", "Entrar").click();
    cy.get("[role=alert]").should("be.visible");
    cy.get("#login-password").clear().type(Cypress.env("SENHA"), { log: false });
    cy.contains("button", "Entrar").click();
    cy.get("#login-email").should("not.exist");
    cy.title().should("contain", "Central de Pedidos"); // a aba diz a tela, o restaurante e a plataforma
    cy.screenshot("01-central-depois-do-login");
  });

  it("2. o cliente lê o QR, monta o lanche com opções e observação e envia o pedido", () => {
    cy.loginApi("dono").then((token) => {
      cy.api("POST", `/api/restaurants/${R}/tables/${MESA}/close`, token); // a mesa começa livre
      cy.api("GET", `/api/restaurants/${R}/tables/${MESA}/qr`, token).its("body.tableCode").as("qr");
    });
    cy.viewport(390, 844); // celular
    cy.get("@qr").then((qr) => {
      cy.visit(`${Cypress.env("WEB")}/t/${qr}`, { onBeforeLoad: (win) => win.localStorage.setItem("cardapio.sessionId", CLIENTE) });
    });
    cy.location("pathname").should("eq", `/r/${R}/menu`);

    cy.contains("Cheddar & Bacon").click();
    cy.contains("Bem passado").click();
    cy.contains("Bacon extra").click();
    cy.get("textarea, input").filter("[placeholder*='tirar cebola']").type("sem cebola, pão bem tostado");
    cy.get("button[aria-label='Aumentar quantidade']").first().click();
    cy.contains("button", "Adicionar ao carrinho").should("contain", "R$ 89,80").click(); // 2 × (38,90 + 6,00)
    cy.get("button[aria-label='Adicionar Refrigerante lata 350 ml ao pedido']").first().click();
    cy.contains("button", "Ver carrinho").click();
    cy.screenshot("02-carrinho-do-cliente");
    cy.contains("button", "Enviar pedido para a cozinha").click();
    cy.contains("button", "Confirmar e enviar para a cozinha").click();
    cy.contains("Aguardando confirmação do restaurante").should("be.visible");
    cy.screenshot("03-cliente-aguardando-confirmacao");
  });

  it("3. a cozinha vê o pedido na Central, aceita e a mesa abre; o cliente passa a ver Recebido", () => {
    cy.loginTela("cozinha");
    cy.contains("article", `Mesa ${MESA}`, { timeout: 10000 }) // a Central consulta a cada 4 s
      .should("contain", "sem cebola, pão bem tostado")
      .and("contain", "Bem passado · Bacon extra")
      .and("contain", "R$ 96,80") // 89,80 + refrigerante 7,00
      .and("contain", "Aguardando aceite")
      .as("cartao");
    cy.screenshot("04-central-pedido-aguardando-aceite");
    cy.get("@cartao").contains("button", "Aceitar").click();
    cy.get(".toast-bubble").should("contain", `Mesa ${MESA} aberta`);
    cy.contains("article", `Mesa ${MESA}`).should("not.contain", "Aguardando aceite");
    cy.screenshot("05-central-pedido-aceito");

    // O que o celular do cliente lê a cada 3 s: o pedido dele, agora Recebido ("pending").
    cy.request({ url: `${Cypress.env("API")}/api/orders`, headers: { "X-Session-Id": CLIENTE } }).then(({ body }) => {
      expect(body).to.have.length(1);
      expect(body[0]).to.include({ mode: "table", tableNumber: MESA, status: "pending", total: 96.8 });
    });
  });
});
