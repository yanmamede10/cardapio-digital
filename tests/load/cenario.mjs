// Casa cheia (PERF-01 e PERF-03): o cenário de `npm run carga`. Mude os números aqui; pico.mjs, cardapio.mjs e
// painel.spec.ts leem deste arquivo. Os intervalos de polling não estão aqui: são os do código (pico.mjs diz onde).
export default {
  restaurante: "chapa27", // seed de demonstração (apps/api/prisma/seed-demo.ts): 30 mesas, logins dono, gerente, garcom e cozinha

  mesas: 30,
  celularesPorMesa: 4, // "até 4": o pior caso, todas com 4 celulares que abrem o cardápio pelo QR
  tablets: 15, // tablets fixos nas mesas 1 a 15, com o cardápio aberto o tempo todo
  centrais: 10, // funcionários com o painel na Central de Pedidos
  logins: ["cozinha", "garcom", "gerente", "dono"], // os aparelhos da equipe se revezam entre estes logins (3, 3, 2 e 2)

  pedidosPorMinuto: 10,
  picoMin: 10,
  rampaS: 60, // antes do pico, os celulares chegam espalhados neste tempo (os tablets e a equipe já estão lá)

  // Todo o tráfego da casa (celulares, tablets e equipe) sai do IP do Wi-Fi do restaurante. Pelo túnel da Cloudflare ele
  // chega à API em CF-Connecting-IP; sem esse cabeçalho, uma requisição da própria máquina não tem limite nenhum.
  ipDoWifi: "203.0.113.10",

  // O que não é polling, e sim gente: cada celular ou tablet no cardápio abre um prato a cada ~20 s; a cozinha toca em
  // Aceitar 10 s depois que o pedido de mesa livre aparece (abre a mesa) e começa o preparo 30 s depois de Recebido.
  abrePratoS: 20,
  aceiteS: 10,
  preparoS: 30,

  mesaMedida: 30, // a mesa do teste do painel (painel.spec.ts): a carga não pede nela, para ela estar livre a cada execução
  execucoes: 20,
  // cardapioS: a API do cardápio montado, p95; lcpS: o cardápio no Lighthouse em modo celular (decisão de 01/10: 2,5 s);
  // painelS: pedido → Central, p95.
  metas: { cardapioS: 2, lcpS: 2.5, painelS: 5 },
  evolution: "cardapio-evolution-evolution-1" // o contêiner (docker-compose.yml) cujo consumo é medido junto com o da API
};
