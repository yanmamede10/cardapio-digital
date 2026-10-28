import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { OperatingHoursRow } from '@cardapio/shared';
import { openingNow } from '../../apps/web/src/lib/hours.ts';

const row = (weekday: number, lunch = '', dinner = '', isOpen = true): OperatingHoursRow => ({ weekday, lunch, dinner, isOpen });
const at = (time: string, day = '2026-10-26') => new Date(`${day}T${time}:00-03:00`); // segunda-feira

test('sem cadastro, dia desativado ou ausente', () => {
  assert.equal(openingNow([], at('12:00')), null);
  assert.deepEqual(openingNow([row(0, '11h - 15h', '', false)], at('12:00')), { open: false, today: 'Fechado hoje' });
  assert.deepEqual(openingNow([row(2, '11h - 15h')], at('12:00')), { open: false, today: 'Fechado hoje' });
  assert.deepEqual(openingNow([row(0, ' ', '')], at('12:00')), { open: false, today: 'Fechado hoje' });
});

test('almoço e jantar: início inclusivo, fim exclusivo e intervalo fechado', () => {
  const rows = [row(0, ' 11:30 - 15:00 ', '18h - 23h')];
  for (const [time, open] of [['11:29', false], ['11:30', true], ['14:59', true], ['15:00', false], ['17:59', false], ['18:00', true], ['23:00', false]] as const) {
    assert.deepEqual(openingNow(rows, at(time)), { open, today: 'Hoje 11:30 - 15:00 · 18h - 23h' });
  }
});

test('virada da meia-noite e domingo para segunda em São Paulo', () => {
  const rows = [row(6, '', '18h - 2h')];
  assert.equal(openingNow(rows, at('23:59', '2026-10-25'))?.open, true);
  assert.deepEqual(openingNow(rows, new Date('2026-10-26T04:59:00Z')), { open: true, today: 'Fechado hoje' });
  assert.equal(openingNow(rows, at('02:00'))?.open, false);
  assert.equal(openingNow([row(6, '11h - 15h')], at('01:00'))?.open, false);
});

test('horários iguais significam turno de 24 horas; texto inválido não abre', () => {
  assert.equal(openingNow([row(0, '8h - 8h')], at('23:00'))?.open, true);
  assert.equal(openingNow([row(6, '8h - 8h')], at('07:59'))?.open, true);
  assert.equal(openingNow([row(6, '8h - 8h')], at('08:00'))?.open, false);
  for (const text of ['sem horário', '11h', '11h 12h 13h']) {
    assert.equal(openingNow([row(0, text), row(6, text)], at('12:00'))?.open, false);
  }
});

test('parâmetro de data opcional usa o relógio (controlado no teste)', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: at('12:00') });
  assert.equal(openingNow([row(0, '11h - 15h')])?.open, true);
});
