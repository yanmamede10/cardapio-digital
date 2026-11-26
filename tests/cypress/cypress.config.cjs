// Cypress (atividade "Ferramentas de QA"). Rodar com `npm run test:cypress`: tests/run.mjs sobe o Postgres de teste, as
// seeds, a API (:4200), o app do cliente (:5273) e o painel (:5274) e chama
// `npx cypress run --project tests/cypress` (os caminhos abaixo são relativos a esta pasta).
// Sem `require("cypress")`: o Cypress não é dependência do projeto, entra só neste job (npx), e o objeto puro basta.
module.exports = {
  e2e: {
    specPattern: "e2e/**/*.cy.js",
    supportFile: "support/e2e.js",
    baseUrl: "http://localhost:5274", // o painel; o app do cliente é visitado pelo endereço completo
    viewportWidth: 1280,
    viewportHeight: 800,
    defaultCommandTimeout: 8000
  },
  // Cypress 16: valores públicos de configuração ficam em `expose` (lidos com Cypress.expose); `env` é só para segredos
  // (cy.env). A senha é a do seed de teste (SEED_DEMO_PASSWORD de tests/run.mjs), não um segredo real.
  expose: { API: "http://localhost:4200", WEB: "http://localhost:5273", RESTAURANTE: "chapa27", SENHA: "senha123" },
  video: true,
  screenshotOnRunFailure: true,
  videosFolder: "../../reports/cypress/videos",
  screenshotsFolder: "../../reports/cypress/screenshots",
  reporter: "junit",
  reporterOptions: { mochaFile: "../../reports/cypress-junit.xml", toConsole: true },
  retries: { runMode: 1, openMode: 0 }
};
