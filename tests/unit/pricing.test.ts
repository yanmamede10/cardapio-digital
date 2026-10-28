import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MenuItem } from '@prisma/client';
import type { MenuItemOptionGroup } from '@cardapio/shared';
import { priceLine, PricingError, round2 } from '../../apps/api/src/lib/pricing.ts';

const groups: MenuItemOptionGroup[] = [
  { id: 'size', label: 'Tamanho', type: 'single', hint: '', options: [
    { id: 'large', label: 'Grande', priceDelta: 5 },
    { id: 'small', label: 'Pequeno', priceDelta: -2 }
  ] },
  { id: 'extras', label: 'Adicionais', type: 'multi', hint: '', options: [
    { id: 'bacon', label: 'Bacon', priceDelta: 2.5, productId: 'stock-bacon', quantity: 0.03 },
    { id: 'cheese', label: 'Queijo', priceDelta: 1.25 }
  ] }
];
// Só os dois campos consumidos pelo cálculo; sem cliente Prisma ou acesso a banco.
const item = (price = 10, options = groups) => ({ price, optionGroupsJson: JSON.stringify(options) }) as MenuItem;

test('preço base e opções são recalculados a partir do catálogo', () => {
  assert.deepEqual(priceLine(item(0, []), []), { unitPrice: 0, selectedOptions: [] });
  assert.deepEqual(priceLine(item(), []), { unitPrice: 10, selectedOptions: [] });
  const result = priceLine(item(), [
    { groupId: 'extras', optionId: 'bacon' },
    { groupId: 'size', optionId: 'large' },
    { groupId: 'extras', optionId: 'cheese' }
  ]);
  assert.deepEqual(result, { unitPrice: 18.75, selectedOptions: [
    { groupId: 'size', groupLabel: 'Tamanho', optionId: 'large', label: 'Grande', priceDelta: 5 },
    { groupId: 'extras', groupLabel: 'Adicionais', optionId: 'bacon', label: 'Bacon', priceDelta: 2.5, productId: 'stock-bacon', quantity: 0.03 },
    { groupId: 'extras', groupLabel: 'Adicionais', optionId: 'cheese', label: 'Queijo', priceDelta: 1.25 }
  ] });
  assert.equal(priceLine(item(), [{ groupId: 'size', optionId: 'small' }]).unitPrice, 8);
  assert.equal(priceLine(item(10.236, []), []).unitPrice, 10.24);
});

test('opção desconhecida ou mais de uma escolha single é recusada', () => {
  assert.throws(() => priceLine(item(), [{ groupId: 'size', optionId: 'missing' }]), { name: 'Error', message: 'Unknown option missing for group size' });
  assert.throws(() => priceLine(item(), [
    { groupId: 'size', optionId: 'large' }, { groupId: 'size', optionId: 'small' }
  ]), PricingError);
  assert.throws(() => priceLine(item(), [
    { groupId: 'size', optionId: 'large' }, { groupId: 'size', optionId: 'large' }
  ]), /accepts only one selection/);
});

test('grupo desconhecido é ignorado e JSON inválido falha (contrato atual)', () => {
  assert.deepEqual(priceLine(item(), [{ groupId: 'missing', optionId: 'large' }]), { unitPrice: 10, selectedOptions: [] });
  assert.throws(() => priceLine({ ...item(), optionGroupsJson: '{' }, []), SyntaxError);
});

test('arredondamento: zero, negativos e precisão binária', () => {
  assert.equal(round2(0), 0);
  assert.equal(round2(1.236), 1.24);
  assert.equal(round2(-1.236), -1.24);
  assert.equal(round2(0.1 + 0.2), 0.3);
});
