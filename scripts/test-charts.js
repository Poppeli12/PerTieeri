// Offline chart selection/data validation. Run: node scripts/test-charts.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const { buildChart } = require('../src/agent/chartChoice.ts');
const base = { title: 'Menot', unit: '€', labels: ['A', 'B', 'C'], series: [{ name: 'Omat', values: [100, 250, 50] }] };
assert.equal(buildChart({ ...base, intent: 'trend' }).card.chart, 'line');
assert.equal(buildChart({ ...base, intent: 'comparison' }).card.chart, 'bar');
assert.equal(buildChart({ ...base, intent: 'composition' }).card.chart, 'pie');
for (const chart of ['bar', 'line', 'pie']) {
  const out = buildChart({ ...base, intent: 'trend', chart });
  assert.equal(out.card.chart, chart, 'Explicit choice overrides inference');
  assert.deepEqual(out.card.series, base.series, 'Values are unchanged');
  assert.deepEqual(out.card.labels, base.labels, 'Scope is unchanged');
}
const many = { ...base, labels: Array.from({ length: 7 }, (_, i) => `Luokka ${i}`), series: [{ name: 'Omat', values: [1, 2, 3, 4, 5, 6, 7] }] };
assert.equal(buildChart({ ...many, intent: 'composition' }).card.chart, 'bar');
assert.equal(buildChart({ ...many, chart: 'pie' }).card.chart, 'pie', 'Explicit pie preserves all categories');
for (const values of [[-1, 2, 3], [0, 0, 0]]) {
  assert.equal(buildChart({ ...base, chart: 'pie', series: [{ name: 'Omat', values }] }).card, undefined);
  assert.equal(buildChart({ ...base, intent: 'composition', series: [{ name: 'Omat', values }] }).card.chart, 'bar');
}
for (const values of [[1, 2], [1, null, 3], [1, '2', 3], [1, Infinity, 3], [1, NaN, 3]]) {
  assert.ok(buildChart({ ...base, series: [{ name: 'Omat', values }] }).error, 'Missing/invalid values never become zero');
}
assert.ok(buildChart({ ...base, chart: 'pie', series: [...base.series, ...base.series] }).error);
assert.ok(buildChart({ ...base, unit: '%', chart: 'pie' }).error, 'Percentages must describe one whole');
assert.equal(buildChart({ ...base, unit: '%', chart: 'pie', series: [{ name: 'Osuudet', values: [20, 30, 50] }] }).card.chart, 'pie');
assert.ok(buildChart({ ...base, labels: Array(25).fill('A'), series: [{ name: 'Omat', values: Array(25).fill(1) }] }).error, 'Do not silently truncate');
assert.equal(buildChart({ ...base, chart: 'bar', series: [{ name: 'Muutos', values: [-100, 0, 50] }] }).card.series[0].values[0], -100);
console.log('PASS: automatic selection, explicit requests, exact scope/values, signed/zero values, invalid/missing data and oversized data');
