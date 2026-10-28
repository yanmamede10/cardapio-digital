import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const job = process.env.QAOPS_JOB;
const steps = JSON.parse(process.env.QAOPS_STEPS || '{}');
const gates = {
  qualidade: { dependencias: '1 — Dependências', lint: '2 — Lint', typecheck: '3 — Typecheck', cobertura: '4 — Unitários e cobertura', build: '5 — Build' },
  'testes-api': { api: '6 — Testes de API' },
  'testes-e2e': { e2e: '7 — Testes E2E' }
};
if (!gates[job]) throw new Error(`Job QAOps desconhecido: ${job}`);
let summary = `## QAOps — ${job}\n\n| Gate | Resultado |\n| --- | --- |\n`;
for (const [id, label] of Object.entries(gates[job])) {
  const status = steps[id]?.outcome || 'skipped';
  const icon = status === 'success' ? '✅' : status === 'skipped' ? '⏭️' : '❌';
  summary += `| ${label} | ${icon} ${status} |\n`;
}
if (job === 'qualidade') {
  if (existsSync('reports/coverage.lcov')) {
    const totals = { LF: 0, LH: 0, BRF: 0, BRH: 0 };
    for (const line of readFileSync('reports/coverage.lcov', 'utf8').split(/\r?\n/)) {
      const [key, value] = line.split(':');
      if (Object.hasOwn(totals, key)) totals[key] += Number(value);
    }
    const pct = (hit, found) => found ? `${(100 * hit / found).toFixed(2)}%` : 'não medida';
    summary += `\nCobertura dos módulos selecionados: **${pct(totals.LH, totals.LF)} linhas**, **${pct(totals.BRH, totals.BRF)} branches**. Limites: 80% / 70%.\n`;
  } else {
    summary += '\nCobertura não gerada: consulte os gates anteriores e o log do job.\n';
  }
}
summary += '\nGates pulados não contam como aprovação. Evidências disponíveis no artefato deste job por 30 dias.\n';
mkdirSync('reports', { recursive: true });
writeFileSync('reports/summary.md', summary);
writeFileSync('reports/gates.json', JSON.stringify({ job, steps }, null, 2) + '\n');
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(summary);
