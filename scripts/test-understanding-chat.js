const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const scenarios = [
  { id: 'metadata', question: 'Tutki jatkuvat maksuni. Älä päättele tilausta vain samasta hinnasta: käytä kauppiastunnusta, maksutyyppiä, MCC:tä ja aikavälejä. Mitä voidaan oikeasti tietää ja mitä ei?', tool: /get_customer_understanding|get_recurring/ },
  { id: 'phenomenon', question: 'Opeta minulle omista tapahtumistani yksi ilmiö, joka auttaa hallitsemaan rahankäyttöä. Miksi se tapahtuu ja mitä voisin kokeilla? En kaipaa pelkkää termin määritelmää.', tool: /get_customer_understanding|get_habits|get_top_sinks|get_spending|query_transactions/ },
  { id: 'budget', question: 'Näytä Takuusäätiön vuoden 2025 ruoan viitebudjetti yksin asuvalle alle 45-vuotiaalle työssä käyvälle miehelle. Haluan vain esimerkin, en väitä kuuluvani ryhmään. Onko se suomalaisten keskikulutus?', tool: 'get_reference_budget' },
];
(async () => {
 const browser = await chromium.launch();
 try {
  const results = await Promise.allSettled(scenarios.filter(s => !process.argv[3] || process.argv[3].includes(s.id)).map(async scenario => {
   const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
   const calls = [], outputs = [], errors = [];
   let finish;
   const done = new Promise(resolve => { finish = resolve; });
   page.on('pageerror', e => errors.push(e.message));
   await page.route('**/api/agent', async route => {
    const body = route.request().postDataJSON();
    if (body.input?.[0]?.content?.startsWith('[Sovellus:')) return route.fulfill({ json: { output: [{ type: 'message', content: [{ type: 'output_text', text: 'Hei!' }] }] } });
    for (const item of body.input || []) if (item.type === 'function_call_output') outputs.push(JSON.parse(item.output));
    const response = await route.fetch({ timeout: 95000 });
    const json = await response.json();
    for (const item of json.output || []) if (item.type === 'function_call') calls.push({ name: item.name, args: JSON.parse(item.arguments || '{}') });
    await route.fulfill({ response });
    if ((json.output || []).some(item => item.type === 'message') && !(json.output || []).some(item => item.type === 'function_call')) finish(json.output.filter(item => item.type === 'message').flatMap(item => item.content || []).map(c => c.text || '').join('\n'));
   });
   try {
    await page.goto(process.argv[2] || 'http://localhost:8109');
    await page.getByRole('tab', { name: /Tuki/ }).locator('svg').click();
    await page.getByText('Hei!', { exact: true }).waitFor();
    await page.getByPlaceholder('Kirjoita viesti').fill(scenario.question);
    await page.getByPlaceholder('Kirjoita viesti').press('Enter');
    let timer;
    const reply = await Promise.race([done, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Agent timeout')), 115000); })]).finally(() => clearTimeout(timer));
    fs.writeFileSync(`design/current/understanding-${scenario.id}.json`, JSON.stringify({ question: scenario.question, calls, outputs, reply }, null, 2));
    assert(calls.some(c => typeof scenario.tool === 'string' ? c.name === scenario.tool : scenario.tool.test(c.name)), 'Required evidence tool');
    assert(!outputs.some(o => o.virhe), 'No tool error');
    assert.deepEqual(errors, []);
    if (scenario.id === 'budget') { assert(outputs.some(o => o.foodPerMonth === 312 && o.backgroundOnly === true)); assert.match(reply, /2025/); }
    console.log(JSON.stringify({ scenario: scenario.id, calls: calls.map(c => c.name), reply }));
   } finally { await page.unrouteAll({ behavior: 'ignoreErrors' }); await page.close(); }
  }));
  for (const result of results) if (result.status === 'rejected') throw result.reason;
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
