import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDays, brDate, brl, dayMonth, fmtDate, fmtDateTime, fmtMinutes, initialsOf, localIso, minutesSince, shortDate, slaFg, stars, todayIso } from '../../apps/dashboard/src/lib/format.ts';

test('iniciais e moeda: nomes vazios, espaços e sinais', () => {
  assert.equal(initialsOf('  Maria  da Silva '), 'MD');
  assert.equal(initialsOf('ana'), 'A');
  assert.equal(initialsOf('  '), '');
  assert.equal(brl(-12.5), '-R$ 12,50');
});

test('tempo e SLA nos limites de 30 e 60 minutos', () => {
  assert.equal(fmtMinutes(0), '0 min');
  assert.equal(fmtMinutes(59), '59 min');
  assert.equal(fmtMinutes(60), '1h 0min');
  assert.equal(fmtMinutes(125), '2h 5min');
  assert.equal(slaFg(-1), 'var(--ok)');
  assert.equal(slaFg(29), 'var(--ok)');
  assert.equal(slaFg(30), 'var(--warn)');
  assert.equal(slaFg(59), 'var(--warn)');
  assert.equal(slaFg(60), 'var(--alert)');
});

test('avaliações arredondam e ficam entre zero e cinco estrelas', () => {
  assert.equal(stars(-2), '☆☆☆☆☆');
  assert.equal(stars(0), '☆☆☆☆☆');
  assert.equal(stars(2.49), '★★☆☆☆');
  assert.equal(stars(2.5), '★★★☆☆');
  assert.equal(stars(6), '★★★★★');
});

test('datas: viradas de mês/ano, ano bissexto e dias negativos', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addDays('2024-02-29', 1), '2024-03-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(addDays('2026-10-28', 0), '2026-10-28');
  assert.equal(localIso(new Date(2026, 0, 2, 23, 59)), '2026-01-02');
  assert.equal(shortDate('2026-09-23'), '23 set');
  assert.equal(brDate('2026-09-23'), '23/09/2026');
  assert.equal(dayMonth('2026-09-23'), '23/09');
  // String sem offset usa o fuso local tanto em Windows quanto no runner Linux.
  assert.equal(fmtDate('2026-09-23T12:34:00'), '23/09/2026');
  assert.match(fmtDateTime('2026-09-23T12:34:00'), /^quarta-feira, 23 de set\.?[,]? 2026, 12:34$|^quarta-feira, 23 de set\.?, 12:34$/);
});

test('helpers de relógio: minutos inteiros, futuro limitado a zero e hoje local', (t) => {
  const now = new Date(2026, 9, 28, 12, 0);
  t.mock.timers.enable({ apis: ['Date'], now });
  assert.equal(todayIso(), '2026-10-28');
  assert.equal(minutesSince(new Date(now.getTime() - 119_999).toISOString()), 1);
  assert.equal(minutesSince(now.toISOString()), 0);
  assert.equal(minutesSince(new Date(now.getTime() + 60_000).toISOString()), 0);
  assert.ok(Number.isNaN(minutesSince('inválida')));
});
