import assert from 'node:assert/strict';
import { buildDailyCsvZip } from '../packages/tokens/wallet-export.js';

const rows = [
  { when: '2026-10-19T10:00:00Z', amount: 100 },
  { when: '2026-10-19T12:00:00Z', amount: 200 },
  { when: '2026-10-20T10:00:00Z', amount: 300 },
];
const bytes = buildDailyCsvZip('vendor-transactions', rows, [
  { key: 'amount', header: 'Amount', value: (row) => row.amount },
], (row) => row.when);
const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const decoder = new TextDecoder();
const files = [];
let offset = 0;
while (view.getUint32(offset, true) === 0x04034b50) {
  assert.equal(view.getUint16(offset + 8, true), 0);
  const length = view.getUint32(offset + 18, true);
  const nameLength = view.getUint16(offset + 26, true);
  const name = decoder.decode(bytes.subarray(offset + 30, offset + 30 + nameLength));
  const start = offset + 30 + nameLength;
  files.push({ name, csv: decoder.decode(bytes.subarray(start, start + length)) });
  offset = start + length;
}
assert.equal(view.getUint32(offset, true), 0x02014b50);
assert.equal(files.length, 2);
assert.match(files[0].name, /2026-10-19\.csv$/);
assert.match(files[0].csv, /100\r\n200/);
assert.match(files[1].name, /2026-10-20\.csv$/);
assert.match(files[1].csv, /300/);
assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50);
assert.equal(view.getUint16(bytes.length - 12, true), 2);
assert.throws(() => buildDailyCsvZip('vendor-transactions', [{ when: null, amount: 100 }], [
  { key: 'amount', header: 'Amount', value: (row) => row.amount },
], (row) => row.when), /valid date for every record/);
console.log('daily CSV archive passed');
