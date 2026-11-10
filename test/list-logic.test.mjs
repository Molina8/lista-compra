import assert from 'node:assert/strict';
import { normalizeForSearch, listaAfterFinish } from '../lib/list-logic.js';

assert.equal(normalizeForSearch('Yogur'), 'yogur');
assert.equal(normalizeForSearch('José'), 'jose');
assert.equal(normalizeForSearch('LECHE'), 'leche');

const sample = {
  leche: { name: 'Leche', inCart: true },
  pan: { name: 'Pan', inCart: false },
  huevos: { name: 'Huevos', inCart: true },
  arroz: { name: 'Arroz', inCart: false }
};
const after = listaAfterFinish(sample);
assert.deepEqual(Object.keys(after).sort(), ['arroz', 'pan']);
assert.equal(after.pan.inCart, false);
assert.equal(after.arroz.inCart, false);

console.log('list-logic.test.mjs: OK');
