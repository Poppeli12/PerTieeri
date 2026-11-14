const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  if (name === 'react-native') return { Platform: { OS: 'web' } };
  if (name === 'expo-constants') return { expoConfig: {} };
  if (name === '../icons/registry') return { ICON_NAMES: [] };
  return originalLoad.call(this, name, ...args);
};
const a = require('../src/finance/analytics.ts');
const { paymentPatterns } = require('../src/finance/paymentPatterns.ts');
const { customerUnderstanding } = require('../src/finance/customerUnderstanding.ts');
const { referenceBudget, REFERENCE_BUDGETS } = require('../src/agent/referenceBudgets.ts');
const { runTool } = require('../src/agent/tools.ts');
const { askLLM, resetConversation } = require('../src/agent/llm.ts');
const ctx = { profile: { age: 30, situation: 'ei tiedossa', living: '', goal: '', changes: [], notes: [] }, prefs: { protected: [] }, answers: {} };
const tx = (d, extra = {}) => ({ d, t: '12:00:00', c: 'Groceries', ty: 'purchase', a: -20, b: 100, account: 'A', m: 'SHOP', mcc: 5411, ...extra });
const pattern = list => paymentPatterns(list, '2025-10-01', '2026-09-30', 12);
const monthly = extra => ['2026-06-05', '2026-07-05', '2026-08-05', '2026-09-05'].map(d => tx(d, extra));

const groceries = pattern(monthly({}))[0];
assert.equal(groceries.status, 'recurring'); assert.equal(groceries.kind, 'purchase');
assert.equal(pattern(monthly({ m: null })).every(p => p.status === 'uncertain'), true);
assert.equal(pattern(monthly({}).map((t, i) => ({ ...t, m: 'SHOP' + i }))).length, 4);
const bills = pattern(monthly({ ty: 'utilities_payment', c: 'Utilities', m: null, mcc: null }).map((t, i) => ({ ...t, a: -20 - i * 17 })))[0];
assert.equal(bills.status, 'recurring'); assert.equal(bills.kind, 'bills'); assert.equal(bills.priceChange, undefined);
const irregular = pattern(['2026-01-01', '2026-01-03', '2026-07-10', '2026-09-27'].map(d => tx(d)))[0];
assert.equal(irregular.status, 'habit'); assert.equal(irregular.cadence, null);
assert.equal(pattern([tx('2026-05-02')])[0].status, 'one_off_candidate');
assert.equal(pattern([...monthly({ account: 'A' }), ...monthly({ account: 'B' })]).length, 2);
const subscription = pattern(monthly({ mcc: 4899 }).map((t, i) => ({ ...t, a: i < 2 ? -12 : -14 })))[0];
assert.equal(subscription.kind, 'subscription'); assert.deepEqual(subscription.priceChange, { from: 12, to: 14, month: '2026-08' });
assert.equal(pattern(monthly({ ty: 'investment_deposit' }))[0].kind, 'transfer');
assert.equal(pattern(monthly({ ty: 'other_income', a: 100 }).map((t, i) => ({ ...t, d: ['2026-01-02', '2026-03-18', '2026-08-04', '2026-09-29'][i] })))[0].status, 'habit');
console.log('PASS metadata: price coincidences, missing merchants, variable bills, habits, one-offs, accounts, price change, transfers, irregular income');

const testData = { customer: { id: 'TEST', age: 30 }, transactions: [
  tx('2026-04-28', { ty: 'salary', c: 'Salary', a: 2000 }),
  tx('2026-05-02', { c: 'Restaurants', a: -60, mcc: 5812 }),
  tx('2026-09-02', { ty: 'other_income', c: 'Other Income', a: 600 }),
  tx('2026-09-03', { ty: 'housing_payment', c: 'Housing', a: -500 }),
  tx('2026-09-04', { ty: 'investment_deposit', c: 'Invest Deposit', a: -100 }),
] };
a.setCustomerData(testData);
assert.equal(a.incomeMonthly(6), 2600 / 6); assert.equal(a.salaryMonthly(6), 2000 / 6);
assert.ok(Math.abs(a.baskets(6).totals.regular - 500 / 6) < 1e-8, 'No invented rent');
assert.ok(a.habits().payPerDay > 0, 'Salary week crosses month boundary');
const snapshot = customerUnderstanding(6); assert.equal(snapshot.flows.consumption, 560); assert.equal(snapshot.flows.investmentAndSavingsTransfers, 100);
assert.equal(snapshot.accounts[0].id, 'A'); assert.equal(snapshot.mortgage, null);
assert.equal(runTool('get_transactions', { days: 365 }, ctx).result[0].maksutyyppi, 'investment_deposit');
assert.equal(REFERENCE_BUDGETS.length, 14);
let budget = referenceBudget({ group: 'single_man_under45', confirmedExample: true }, ctx).result;
assert.equal(budget.foodPerMonth, 312); assert.equal(budget.backgroundOnly, true);
const complete = { ...ctx, profile: { ...ctx.profile, household: 'yksin', expensesComplete: true } };
assert.equal(referenceBudget({ group: 'single_man_under45', confirmedExample: true }, complete).result.backgroundOnly, false);
assert.equal(referenceBudget({ group: 'single_man_under45' }, complete).result.backgroundOnly, true);
assert.equal(referenceBudget({ group: 'parents_two_teens', confirmedExample: true }, complete).result.backgroundOnly, true);
console.log('PASS totals: income vs salary, no imputed housing, payroll week, metadata tools, reference-budget comparability');

for (const id of ['CUST00001', 'CUST00171', 'CUST05100']) {
  const data = JSON.parse(fs.readFileSync(`data/customers/${id}.json`, 'utf8'));
  a.setCustomerData(data);
  const result = customerUnderstanding();
  assert.equal(result.customerId, id); assert.equal(result.accounts.length, 1);
  assert.ok(data.transactions.every(t => t.account));
  assert.equal(result.accounts[0].balance, data.transactions.at(-1).b);
  assert.equal(a.recurring().filter(r => r.kind === 'subscription').length, 0, 'Source has no confirmed subscription metadata');
  const sum = data.transactions.filter(t => t.d >= '2025-10-01' && t.a < 0 && ['purchase', 'housing_payment', 'utilities_payment'].includes(t.ty)).reduce((s, t) => s - t.a, 0);
  assert.ok(Math.abs(result.flows.consumption - sum) < .01);
}
console.log('PASS real customers: distinct accounts, exact balances and totals, no fabricated subscriptions');

(async () => {
  a.setCustomerData(testData); resetConversation();
  let resolve;
  global.fetch = () => new Promise(r => { resolve = r; });
  const response = askLLM('Check my transactions', ctx, 'TEST');
  a.setCustomerData({ customer: { id: 'OTHER', age: 50 }, transactions: [] }); resetConversation();
  resolve({ ok: true, text: async () => JSON.stringify({ id: 'old-response', output: [{ type: 'function_call', name: 'get_transactions', call_id: 'old', arguments: '{}' }] }) });
  await assert.rejects(response, /Asiakas vaihtui/);
  console.log('PASS customer isolation: stale model response cannot execute tools for new customer');
})().catch(e => { console.error(e); process.exitCode = 1; });
