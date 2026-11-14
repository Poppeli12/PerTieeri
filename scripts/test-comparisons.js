// Ajo: node scripts/test-comparisons.js. Oikeat välimuistiluvut, ei verkkopyyntöjä.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const api = require('../server/api');
const root = path.resolve(__dirname, '..');

// Suoritetaan sovelluksen varsinaiset TS-työkalut Node-ympäristössä ilman mobiiliruntimea.
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  if (name === 'react-native') return { Platform: { OS: 'web' } };
  if (name === 'expo-constants') return { expoConfig: {} };
  if (name === '../icons/registry') return { ICON_NAMES: ['ruoka', 'ravintola', 'palkka'] };
  return originalLoad.call(this, name, ...args);
};
const originalFetch = global.fetch;
global.fetch = async () => { throw Error('Testissä verkko pois käytöstä'); };
let transform = value => value;
let requests = [];
const getJson = async url => {
  requests.push(url);
  const u = new URL(url, 'http://test');
  let result;
  if (u.pathname === '/api/statfin/consumption') result = await api.consumption(u.searchParams.get('type'), u.searchParams.get('group') || 'household');
  else if (u.pathname === '/api/statfin/income') result = await api.income(api.band(+u.searchParams.get('years')));
  else throw Error('Odottamaton pyyntö ' + url);
  return transform(result);
};
const apiPath = path.join(root, 'src/data/api.ts');
require.cache[apiPath] = { id: apiPath, filename: apiPath, loaded: true, exports: { getJson, apiUrl: path => path } };
const analytics = require('../src/finance/analytics.ts');
const { compareFinland } = require('../src/agent/finland.ts');
const { runAsyncTool } = require('../src/agent/compare.ts');
const index = require('../data/index.json').customers;
const ctx = patch => ({ profile: { age: analytics.CUSTOMER.age, household: 'ei tiedossa', situation: 'ei tiedossa', living: 'ei tiedossa', goal: '', protect: [], style: 'teach', rentDelta: 0, incomeDelta: 0, changes: [], ...patch }, prefs: { protected: [], rejections: {}, accepted: {} }, answers: {} });
function customer(age) {
  const row = index.find(c => c.age === age);
  assert.ok(row, 'Asiakas iälle ' + age);
  const data = JSON.parse(fs.readFileSync(path.join(root, 'data/customers', row.id + '.json')));
  analytics.setCustomerData(data);
  return data;
}

(async () => {
  const counts = [];
  const young = customer(22);
  let out = await compareFinland({ kind: 'consumption', categories: ['Groceries'] }, ctx());
  assert.equal(out.result.ei_vertailua, true);
  assert.equal(out.card, undefined);
  assert.equal(requests.length, 0);
  counts.push('Puuttuva kotitalous kysytään, ei synteettistä korviketta');

  for (const coverage of [undefined, false]) {
    out = await compareFinland({ kind: 'consumption', categories: ['Groceries'] }, ctx({ household: 'yksin', expensesComplete: coverage }));
    assert.equal(out.card.kind, 'list');
    assert.equal(out.result.luokittain[0].asiakas_kk, undefined);
  }
  const single = ctx({ household: 'yksin', expensesComplete: true });
  out = await compareFinland({ kind: 'consumption', categories: ['Groceries'] }, single);
  assert.equal(out.card.kind, 'compare');
  assert.equal(out.card.origin, 'statfin');
  assert.equal(out.card.rows.length, 1);
  const independent = young.transactions.filter(t => t.d >= '2025-10-01' && t.d <= '2026-09-30' && t.a < 0 && t.c === 'Groceries').reduce((s, t) => s - t.a, 0) / 12;
  assert.equal(out.card.rows[0].user, Math.round(independent * 100) / 100);
  const firstAmount = out.card.rows[0].user;
  const official = await api.consumption('1');
  assert.equal(out.card.rows[0].ref, official.categories.Groceries.household_month);
  assert.equal(official.year, 2022);
  counts.push('Vahvistettu kattavuus, yhden kategorian rajaus, oikea 12 kk summa ja virallinen kuukausiluku');

  for (const age of [34, 64, 65, 90]) {
    const data = customer(age);
    out = await compareFinland({ kind: 'consumption', categories: ['Groceries'] }, ctx({ household: 'yksin', expensesComplete: true }));
    console.log('asiakas', data.customer.id, 'ikä', age, out.card.kind, out.result.vertailuryhma);
    assert.equal(out.card.kind, age >= 65 ? 'list' : 'compare');
    assert.match(out.result.vertailuryhma, age >= 65 ? /Yli 64/ : /alle 65/);
    if (age === 34) assert.notEqual(out.card.rows[0].user, firstAmount);
  }
  counts.push('Asiakasvaihdot 22/34/64/65/90 v; ikäraja 65 ei käytä nuorten ryhmää');

  customer(22);
  out = await compareFinland({ kind: 'consumption' }, ctx({ household: 'pari' }));
  assert.equal(out.result.ei_vertailua, true);
  out = await compareFinland({ kind: 'consumption' }, ctx({ household: 'pari', partnerAge: 40, expensesComplete: true }));
  assert.equal(out.card.kind, 'list');
  assert.ok(out.result.luokittain.every(r => r.asiakas_kk === undefined));
  out = await compareFinland({ kind: 'consumption', categories: ['Housing', 'Utilities', 'Lifestyle'] }, single);
  assert.equal(out.card, undefined);
  assert.equal(out.result.pois_jatetyt.length, 3);
  counts.push('Jaettu talous ja yhteensopimattomat menoluokat eivät tuota rinnakkaista kaaviota');

  customer(65);
  out = await compareFinland({ kind: 'consumption', categories: ['Groceries'] }, ctx({ household: 'pari', partnerAge: 64 }));
  assert.equal(out.result.vertailuryhma, 'Muut kotitaloudet');
  out = await compareFinland({ kind: 'consumption', categories: ['Groceries'] }, ctx({ household: 'pari', partnerAge: 65 }));
  assert.equal(out.result.vertailuryhma, 'Yli 64-vuotiaiden kotitaloudet');
  out = await compareFinland({ kind: 'consumption', categories: ['Groceries'] }, ctx({ household: 'lapsiperhe' }));
  assert.equal(out.result.ei_vertailua, true);
  out = await compareFinland({ kind: 'consumption', categories: ['Groceries'] }, ctx({ household: 'lapsiperhe', dependentChildrenUnder25: true }));
  assert.equal(out.result.vertailuryhma, 'Kahden huoltajan lapsiperhe');
  counts.push('Kotitaloustyypin alaviitteet: parin molempien ikä ja lasten huollettavuus');
  customer(22);

  for (const group of ['age', 'all', 'quintile']) {
    out = await compareFinland({ kind: 'consumption', group, quintile: 2, categories: ['Restaurants'] }, single);
    assert.equal(out.card.kind, 'list');
    assert.equal(out.result.vertailukelpoisuus, 'vain tilastotausta');
  }
  out = await compareFinland({ kind: 'consumption', group: 'quintile' }, single);
  assert.equal(out.result.ei_vertailua, true);
  counts.push('Ikä, kaikki taloudet ja tuloviidennes ovat erillistä tilastotaustaa');

  out = await compareFinland({ kind: 'income' }, single);
  assert.equal(out.card.kind, 'list');
  out = await compareFinland({ kind: 'income' }, ctx({ incomeComplete: true }));
  assert.equal(out.card.kind, 'compare');
  assert.equal(out.card.rows[0].ref, (await api.income('18-24')).median_month);
  assert.match(out.card.note, /kotitalouskohtaisia tuloeriä ei jaettu/);
  counts.push('Tulot: mediaani, vuosimuunnos ja kattavuusehto');

  transform = s => ({ ...s, stale: true, categories: { ...s.categories, Groceries: { ...s.categories.Groceries, household_month: null } } });
  out = await compareFinland({ kind: 'consumption', categories: ['Groceries'] }, single);
  assert.equal(out.card, undefined);
  transform = s => ({ ...s, stale: true });
  out = await compareFinland({ kind: 'consumption', categories: ['Groceries'] }, single);
  assert.match(out.card.note, /Päivitys ei onnistunut/);
  transform = () => { throw Error('Verkko ja välimuisti puuttuvat'); };
  out = await compareFinland({ kind: 'consumption' }, single);
  assert.equal(out.result.ei_vertailua, true);
  assert.equal(out.card, undefined);
  transform = s => s;
  counts.push('Puuttuva solu, vanha välimuisti ja palveluvirhe eivät muutu keksityiksi luvuiksi');

  const readFile = fs.readFileSync;
  try {
    // Vanhennetaan luettu vastaus muistissa; alkuperäinen tiedosto säilyy ennallaan.
    fs.readFileSync = (file, ...args) => {
      const raw = readFile(file, ...args);
      if (String(file).includes('ktutk_14ph_px_') && !String(file).includes('_meta')) {
        const record = JSON.parse(raw);
        record.fetchedAt = 0;
        return JSON.stringify(record);
      }
      return raw;
    };
    const stale = await api.consumption('1');
    assert.equal(stale.stale, true);
    assert.equal(stale.categories.Groceries.household_month, official.categories.Groceries.household_month);
  } finally { fs.readFileSync = readFile; }
  counts.push('Palvelimen oikea välimuistipalautus toimii verkon epäonnistuessa');

  let release;
  transform = value => new Promise(resolve => { release = () => resolve(value); });
  const pending = compareFinland({ kind: 'consumption', categories: ['Groceries'] }, single);
  while (!release) await new Promise(resolve => setTimeout(resolve, 0));
  customer(34);
  release();
  out = await pending;
  assert.equal(out.card.rows[0].user, firstAmount);
  transform = s => s;
  customer(22);
  counts.push('Kesken haun vaihtuva asiakas ei sekoita vertailun omia lukuja');

  assert.deepEqual(api.rows({ id: ['x'], size: [3], dimension: { x: { category: { index: { a: 0, b: 1, c: 2 } } } }, value: { 0: 12, 2: 0 } }).map(r => r.value), [12, null, 0]);
  const patch = await runAsyncTool('save_profile', { expensesComplete: false, incomeComplete: true, partnerAge: 67 }, single, analytics.CUSTOMER.id);
  assert.equal(patch.profile.expensesComplete, false);
  assert.equal(patch.profile.incomeComplete, true);
  counts.push('Harva JSON-stat, nolla vs puuttuva, kielteisen profiilivastauksen tallennus');

  // Sama mallikierros: save_profile vaikuttaa sitä seuraavaan compare_finland-kutsuun.
  const { askLLM, resetConversation } = require('../src/agent/llm.ts');
  resetConversation();
  let round = 0;
  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    if (round++ === 0) return new Response(JSON.stringify({ id: 'test1', output: [
      { type: 'function_call', name: 'save_profile', call_id: 'save', arguments: JSON.stringify({ household: 'yksin', expensesComplete: true }) },
      { type: 'function_call', name: 'compare_finland', call_id: 'compare', arguments: JSON.stringify({ kind: 'consumption', categories: ['Groceries'] }) },
    ] }));
    assert.match(body.instructions, /tili kattaa kotitalouden kaikki menot: asiakas vahvisti/);
    assert.equal(JSON.parse(body.input[1].output).vertailukelpoisuus, 'suuntaa antava');
    return new Response(JSON.stringify({ id: 'test2', output: [{ type: 'message', content: [{ type: 'output_text', text: 'Valmis.' }] }] }));
  };
  out = await askLLM('Asun yksin ja kaikki menoni näkyvät tilillä.', ctx(), analytics.CUSTOMER.id);
  assert.equal(out.msgs[0].cards[0].origin, 'statfin');
  counts.push('Profiilin tallennus ja vertailu samalla mallikierroksella käyttävät päivitettyä tietoa');

  console.log(counts.map(c => 'OK ' + c).join('\n'));
  console.log(`${counts.length} testikokonaisuutta läpäisi; tilastot luettu oikeasta välimuistista ilman verkkoa.`);
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => { global.fetch = originalFetch; Module._load = originalLoad; });
