// Save the audit even when vulnerabilities make npm audit return 1. The following
// audit:deps command enforces the critical threshold; transport errors still fail.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

mkdirSync('reports', { recursive: true });
const result = spawnSync('npm audit --omit=dev --json', {
  shell: true, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024
});
writeFileSync('reports/npm-audit.json', result.stdout || JSON.stringify({ error: result.error?.message || result.stderr }));
try {
  const audit = JSON.parse(result.stdout);
  if (audit.error || !audit.metadata?.vulnerabilities || result.error || result.signal || result.status === null) {
    throw new Error('Auditoria indisponível; veja reports/npm-audit.json.');
  }
  console.log('Auditoria de produção salva:', audit.metadata.vulnerabilities);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
