// No API calls: independently check cents, exclusions and apportionment on real demo customers.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { buildSpendingGrid, apportion, GRID_COLORS } = require('../src/finance/spendingGrid.ts');
const { setCustomerData } = require('../src/finance/analytics.ts');
// The native icon renderer is outside this arithmetic test; financial tools are real.
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function(name, ...args) { return name === '../icons/registry' ? { ICON_NAMES: [] } : originalLoad.call(this, name, ...args); };
const { runTool } = require('../src/agent/tools.ts');
Module._load = originalLoad;
const totals = [];
for (const id of ['CUST00001', 'CUST00171', 'CUST02000']) {
  const bank = JSON.parse(fs.readFileSync(`data/customers/${id}.json`, 'utf8'));
  const actual = bank.transactions.filter(t => t.d.startsWith('2026-08') && t.a < 0 && ['purchase', 'utilities_payment', 'housing_payment'].includes(t.ty));
  const sum = actual.reduce((n, t) => n + Math.round(-t.a * 100), 0);
  setCustomerData(bank);
  const { card, result } = runTool('show_monthly_spending_grid', {}, {});
  assert.equal(card.kind, 'spendingGrid');
  const grid = card.data;
  assert.equal(grid.status, 'ready');
  assert.equal(grid.month, '2026-08');
  assert.equal(grid.customerId, id);
  assert.equal(grid.totalCents, sum);
  assert.equal(result.menot_euroa, sum / 100);
  assert.equal(grid.cellEuros * 10000, sum);
  assert.equal(grid.groups.reduce((n, g) => n + g.cents, 0), sum);
  assert.equal(grid.groups.reduce((n, g) => n + g.cells, 0), 100);
  assert.equal(grid.groups.reduce((n, g) => n + g.percentHundredths, 0), 10000);
  for (const g of grid.groups) {
    assert.equal(g.cents, g.expenses.reduce((n, t) => n + t.cents, 0));
    assert.equal(g.cents, actual.filter(t => t.c === g.key).reduce((n, t) => n + Math.round(-t.a * 100), 0));
    assert.equal(g.color, GRID_COLORS[g.key]);
    assert.ok(Math.abs(g.cells - g.cents * 100 / sum) < 1);
    assert.ok(Math.abs(g.percentHundredths - g.cents * 10000 / sum) < 1);
  }
  assert.equal(runTool('show_money_blocks', {}, {}).card.kind, 'blocks', 'Existing 1000 euro view remains available');
  totals.push(sum);
  console.log(`PASS ${id} (age ${bank.customer.age}): ${sum / 100} EUR, ${grid.groups.length} categories, 100 squares, 100.00%`);
}
assert.equal(new Set(totals).size, 3, 'Three genuinely different customer distributions');
const tx = (d, a, ty = 'purchase', c = 'Groceries') => ({ d, a, ty, c, t: '12:00:00', b: 100, m: null, mcc: null });
const cover = [tx('2026-07-01', 1, 'salary', 'Salary'), tx('2026-09-30', 1, 'salary', 'Salary')];
const make = list => buildSpendingGrid([...cover, ...list], 'test');
const tiny = make([tx('2026-08-01', -0.01), tx('2026-08-01', -0.01, 'purchase', 'Housing'), tx('2026-08-01', -0.01, 'purchase', 'Health')]);
assert.equal(tiny.status, 'ready');
assert.deepEqual(tiny.groups.map(g => g.cells), [34, 33, 33]);
assert.equal(tiny.cellEuros, 0.0003);
assert.equal(make([tx('2026-08-01', -100), tx('2026-08-02', -999, 'own_account_transfer'), tx('2026-08-03', 2000, 'loan_disbursement'), tx('2026-08-04', -300, 'investment_deposit'), tx('2026-08-05', -50, 'salary_sweep'), tx('2026-08-06', 500, 'salary')]).totalCents, 10000);
assert.equal(make([]).status, 'empty');
assert.equal(make([{ ...tx('2026-08-01', -200), demo: true }]).status, 'empty');
assert.equal(make([tx('2026-08-01', -100, '')]).status, 'incomplete');
assert.equal(make([tx('2026-08-01', NaN)]).status, 'incomplete');
assert.equal(make([tx('2026-08-01', -1.001)]).status, 'incomplete');
assert.equal(make([tx('2026-08-99', -1)]).status, 'incomplete');
assert.equal(buildSpendingGrid([tx('2026-08-20', -20)], 'partial').status, 'incomplete');
assert.equal(buildSpendingGrid(cover, 'future', '2026-09-30', '2026-10').status, 'incomplete');
assert.equal(buildSpendingGrid(cover, 'invalid', '2026-09-30', '2026-13').status, 'incomplete');
assert.equal(make([tx('2026-08-01', -10, 'purchase', 'unknown')]).groups[0].key, 'Unclassified');
const rounding = make([tx('2026-08-01', -1000), tx('2026-08-01', -0.01, 'purchase', 'Health')]);
assert.equal(rounding.groups[1].cells, 0);
assert.equal(rounding.groups[1].cents, 1, 'Tiny groups are retained even if rounded to zero cells');
assert.equal(buildSpendingGrid([tx('2025-11-01', 1), tx('2026-01-02', 1), tx('2025-12-20', -10)], 'year', '2026-01-03').month, '2025-12');
for (let n = 1; n <= 160; n++) {
  const weights = Array.from({ length: n }, (_, i) => (i * 137 + n * 11) % 991 + 1);
  for (const units of [100, 10000]) {
    const shares = apportion(weights, units);
    assert.equal(shares.reduce((a, b) => a + b, 0), units);
    assert.ok(shares.every(v => Number.isInteger(v) && v >= 0));
  }
}
console.log('PASS coverage, empty data, metadata exclusions, missing values, cents, ties, tiny categories, year boundary and 320 allocation cases');
