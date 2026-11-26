// Comandos da jornada. cy.loginApi: token de alguém da equipe do seed (para preparar dados pela API, nunca pela tela).
Cypress.Commands.add("loginApi", (usuario) =>
  cy
    .request("POST", `${Cypress.env("API")}/api/auth/login`, { email: `${usuario}@${Cypress.env("RESTAURANTE")}.example`, password: Cypress.env("SENHA") })
    .its("body.token")
);

// cy.loginTela: entra no painel pela tela de login, como a pessoa faria.
Cypress.Commands.add("loginTela", (usuario) => {
  cy.visit("/");
  cy.get("#login-email").type(`${usuario}@${Cypress.env("RESTAURANTE")}.example`);
  cy.get("#login-password").type(Cypress.env("SENHA"), { log: false });
  cy.contains("button", "Entrar").click();
});

// cy.api: chamada autenticada à API, sem falhar no 4xx (o teste confere o status).
Cypress.Commands.add("api", (metodo, caminho, token, body) =>
  cy.request({ method: metodo, url: `${Cypress.env("API")}${caminho}`, headers: { Authorization: `Bearer ${token}` }, body, failOnStatusCode: false })
);
