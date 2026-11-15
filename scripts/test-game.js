// Own-customer arithmetic, sparse data, ties and grading. No AI calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const a = require('../src/finance/analytics.ts');
const { monthlyGame, gamePoints, gameCoupon, parseGameAnswer } = require('../src/finance/insights.ts');
let checked = 0;
const verify = bank => {
  a.setCustomerData(bank);
  const game = monthlyGame('2026-08');
  assert.equal(game.questions.filter(q => q.type === 'choice').length, 3);
  assert.equal(game.questions.filter(q => q.type === 'number').length, 2);
  const expenses = bank.transactions.filter(t => t.d.startsWith('2026-08') && t.a < 0 && ['purchase', 'utilities_payment', 'housing_payment'].includes(t.ty));
  assert.equal(game.questions.find(q => q.id === 'spend').answer, Math.round(expenses.reduce((s, t) => s - t.a, 0)));
  for (const q of game.questions) {
    assert.equal(gamePoints(q, q.type === 'choice' ? q.correct : q.answer), 2);
    if (q.type === 'choice') {
      assert.equal(new Set(q.options).size, q.options.length);
      assert.equal(gamePoints(q, (q.correct + 1) % q.options.length), 0);
    } else {
      // liukuva pisteytys: 25 % pielessä = 1 p, 50 % tai enemmän = 0 p
      const base = Math.max(10, q.answer);
      assert.equal(gamePoints(q, q.answer + base * 0.25), 1);
      assert.equal(gamePoints(q, q.answer + base * 0.6), 0);
      assert.equal(gamePoints(q, 'noin sata'), 0);
      assert.equal(gamePoints(q, -1), 0);
    }
  }
  checked++;
  return game;
};
const customers = fs.readdirSync('data/customers').filter(f => /^CUST.*\.json$/.test(f)).filter((_, i) => i % 100 === 0);
for (const file of customers) verify(JSON.parse(fs.readFileSync(`data/customers/${file}`, 'utf8')));
const tx = (day, amount, category = 'Groceries') => ({ d: `2026-08-${day}`, t: '12:00', a: -amount, b: 100, c: category, ty: 'purchase', m: null, mcc: 5411 });
verify({ customer: { id: 'sparse', age: 30 }, transactions: [tx('03', 20)] });
verify({ customer: { id: 'ties', age: 30 }, transactions: [tx('03', 20), tx('10', 20, 'Restaurants'), tx('17', 20, 'Transport')] });
a.setCustomerData({ customer: { id: 'empty', age: 30 }, transactions: [] });
assert.throws(() => monthlyGame('2026-08'), /riittävästi/);
assert.throws(() => monthlyGame('2027-01'));
assert.throws(() => monthlyGame('2026-00'));
for (const text of ['', 'abc100', '100abc', '12.3.4', '-1', 'Infinity', '1,2,3']) assert.equal(parseGameAnswer(text), null);
assert.equal(parseGameAnswer('1 234,50 €'), 1234.5);
assert.equal(parseGameAnswer('0'), 0);
assert.deepEqual([0, 2, 3, 5, 6, 8, 9, 10].map(p => gameCoupon(p, 10).discount), [2, 2, 5, 5, 10, 10, 15, 15]);
console.log(`PASS ${checked} customer datasets, 3+2 questions, own totals, sparse data, ties, missing data, Finnish input and all coupon tiers`);
