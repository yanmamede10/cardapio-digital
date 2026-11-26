# k6 — cardápio da mesa com a casa cheia

- Requisições: 8125 (55.0/s) · iterações: 1349 · VUs no pico: 120
- Erros HTTP: 0.00% · checks aprovados: 100.00%

| Medida | Média | Mediana | p90 | p95 | p99 | Máx |
| --- | --- | --- | --- | --- | --- | --- |
| Qualquer requisição | 2.6 ms | 2.4 ms | 3.8 ms | 4.2 ms | 5.9 ms | 55.7 ms |
| GET pratos | 3.4 ms | 3.3 ms | 4.3 ms | 4.8 ms | 6.7 ms | 21.5 ms |
| Abertura do cardápio (4 chamadas) | 4.2 ms | 4.0 ms | 5.0 ms | 6.0 ms | 8.0 ms | 22.0 ms |

| Métrica | Limite | Resultado |
| --- | --- | --- |
| `http_req_failed` | `rate<0.01` | ✅ passou |
| `http_req_duration` | `p(95)<500` | ✅ passou |
| `http_req_duration` | `p(99)<1000` | ✅ passou |
| `checks` | `rate>0.99` | ✅ passou |
| `http_req_duration{tipo:pratos}` | `p(95)<500` | ✅ passou |
| `abertura_do_cardapio` | `p(95)<1500` | ✅ passou |

Execução: https://github.com/yanmamede10/cardapio-digital/actions/runs/45881157465 (job 140120538057), k6 v2.4.0, 26/11/2026.
running (2m27.8s), 000/120 VUs, 1349 complete and 0 interrupted iterations
