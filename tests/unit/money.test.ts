import assert from 'node:assert/strict';
import { test } from 'node:test';
import { brl, couponDiscount } from '../../packages/shared/src/money.ts';

test('BRL: milhares, sinal, zero e arredondamento de centavos', () => {
  for (const [value, expected] of [[1340.5, 'R$ 1.340,50'], [-1340.5, '-R$ 1.340,50'], [0, 'R$ 0,00'], [-0, 'R$ 0,00'], [-0.001, 'R$ 0,00'], [1.235, 'R$ 1,24']] as const) {
    assert.equal(brl(value), expected);
  }
});

test('cupons percentuais e fixos respeitam subtotal, zero e centavos', () => {
  assert.equal(couponDiscount({ kind: 'percent', value: 10 }, 19.99), 2);
  assert.equal(couponDiscount({ kind: 'fixed', value: 3.456 }, 10), 3.46);
  for (const kind of ['percent', 'fixed']) {
    assert.equal(couponDiscount({ kind, value: 200 }, 10), 10);
    assert.equal(couponDiscount({ kind, value: -10 }, 10), 0);
    assert.equal(couponDiscount({ kind, value: 0 }, 10), 0);
    assert.equal(couponDiscount({ kind, value: 10 }, 0), 0);
  }
  assert.equal(couponDiscount({ kind: 'invalid', value: 10 }, 100), 0);
});
