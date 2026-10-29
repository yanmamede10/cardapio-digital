import assert from 'node:assert/strict';
import { test } from 'node:test';
import { onColor, relativeLuminance } from '../../packages/shared/src/color.ts';

test('luminância: extremos, canais RGB e ramo linear das cores escuras', () => {
  assert.equal(relativeLuminance('#000000'), 0);
  assert.equal(relativeLuminance('#ffffff'), 1);
  assert.equal(relativeLuminance('FF0000'), 0.2126);
  assert.equal(relativeLuminance('#00ff00'), 0.7152);
  assert.equal(relativeLuminance('#0000ff'), 0.0722);
  assert.ok(Math.abs(relativeLuminance('#0a0a0a') - 0.003035269835488375) < 1e-12);
  assert.ok(Math.abs(relativeLuminance('#808080') - 0.21586050011389923) < 1e-12);
});

test('cor de texto: fundos claros, escuros e entrada fora do formato', () => {
  assert.equal(onColor('#ffffff'), '#1B1915');
  assert.equal(onColor('#000000'), '#FCF7D3');
  assert.equal(relativeLuminance('#fff'), 0);
  assert.equal(relativeLuminance(''), 0);
  // Caracteriza o contrato atual: seis caracteres não hexadecimais produzem NaN.
  assert.ok(Number.isNaN(relativeLuminance('#zzzzzz')));
  assert.equal(onColor('#zzzzzz'), '#FCF7D3');
});
