// Integraatiotesti oikealla agentilla: node scripts/test-comparison-chat.js [http://localhost:8108]
// Käyttää käynnissä olevan kehityspalvelimen AI-yhteyttä ja synteettisiä asiakkaita.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.argv[2] || 'http://localhost:8108';
const customers = require('../data/index.json').customers;
const cases = [
  { name: 'unknown', age: 22, profile: {}, question: 'Kulutanko ruokaan enemmän kuin muut suomalaiset?', tool: 'compare_finland', card: undefined },
  { name: 'single', age: 22, profile: { household: 'yksin', expensesComplete: true }, question: 'Kulutanko ruokaan enemmän kuin muut suomalaiset?', tool: 'compare_finland', card: 'compare' },
  { name: 'age65', age: 65, profile: { household: 'yksin', expensesComplete: true }, question: 'Miten kulutukseni vertautuu muihin ikäisiini Suomessa?', tool: 'compare_finland', card: 'list' },
  { name: 'synthetic', age: 34, profile: {}, question: 'Vertaa ruokakauppamenojani nimenomaan S-Pankin synteettisen demoaineiston samanikäisiin asiakkaisiin.', tool: 'compare_peers', card: 'compare' },
].filter(s => !process.argv[3] || s.name === process.argv[3]);

(async () => {
  const browser = await chromium.launch();
  try {
    for (const scenario of cases) {
      const customer = customers.find(c => c.age === scenario.age);
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
      const key = `pertieeri:v2:${customer.id}`;
      await page.addInitScript(({ id, key, profile }) => {
        localStorage.setItem('pertieeri:asiakas', id);
        localStorage.setItem(key, JSON.stringify({ profile, prefs: { protected: [], rejections: {}, accepted: {} }, answers: {}, demo: false, quiz: {}, messages: [{ id: 'seed', from: 'bot', text: 'Mistä haluaisitte aloittaa?', ts: Date.now() }] }));
      }, { id: customer.id, key, profile: { age: scenario.age, household: 'ei tiedossa', situation: 'ei tiedossa', living: 'ei tiedossa', goal: '', protect: [], style: 'teach', rentDelta: 0, incomeDelta: 0, changes: [], ...scenario.profile } });
      const toolCalls = [];
      const toolResults = [];
      let reply;
      await page.route('**/api/agent', async route => {
        const body = route.request().postDataJSON();
        if (body.input?.[0]?.content?.startsWith('[Sovellus:')) {
          return route.fulfill({ json: { output: [{ type: 'message', content: [{ type: 'output_text', text: 'Mistä haluaisitte aloittaa?' }] }] } });
        }
        for (const item of body.input || []) if (item.type === 'function_call_output') toolResults.push(JSON.parse(item.output));
        await route.continue();
      });
      page.on('response', async response => {
        if (response.url().endsWith('/api/agent')) {
          try {
            const data = await response.json();
            for (const o of data.output || []) if (o.type === 'function_call') toolCalls.push({ name: o.name, args: JSON.parse(o.arguments) });
            if (data.error) reply = { error: data.error };
            else if (toolCalls.length && !data.output?.some(o => o.type === 'function_call')) reply = { text: (data.output || []).flatMap(o => o.content || []).map(c => c.text || '').join('\n') };
          } catch { /* Virhe näkyy sovelluksen vastauksessa. */ }
        }
      });
      await page.goto(base);
      await page.getByRole('tab', { name: 'Tuki – Per Tieeri, talousvalmentaja', exact: true }).locator('svg').click();
      await page.getByText('Henkilökohtainen talousvalmentajasi', { exact: true }).waitFor();
      await page.getByPlaceholder('Kirjoita viesti').fill(scenario.question);
      await page.getByLabel('Lähetä', { exact: true }).click();
      for (let i = 0; i < 400 && !reply; i++) await page.waitForTimeout(250);
      assert.ok(reply, 'Agentti ei vastannut');
      console.log(JSON.stringify({ scenario: scenario.name, customer: customer.id, toolCalls, reply }));
      assert.ok(!reply.error, JSON.stringify(reply.error));
      assert.ok(toolCalls.some(t => t.name === scenario.tool), `${scenario.name}: odotettu työkalu ${scenario.tool}`);
      if (scenario.tool === 'compare_finland') assert.ok(!toolCalls.some(t => ['compare_peers', 'show_category_bars'].includes(t.name)), 'Väestövertailu ei saa vaihtua synteettiseen');
      await page.waitForTimeout(300);
      if (scenario.card === 'list') assert.ok(toolResults.some(r => r.vertailukelpoisuus === 'vain tilastotausta'));
      if (!scenario.card) assert.ok(toolResults.some(r => r.ei_vertailua));
      if (scenario.name === 'single') {
        const comparison = toolResults.find(r => r.vertailukelpoisuus === 'suuntaa antava');
        assert.ok(comparison);
        assert.deepEqual(comparison.luokittain.map(r => r.luokka), ['Ruokakauppa']);
        await page.getByText('Kulutus: suuntaa antava väestövertailu', { exact: true }).waitFor();
      }
      fs.mkdirSync('design/current', { recursive: true });
      await page.waitForTimeout(1000);
      if (scenario.name === 'single') await page.getByText('Kulutus: suuntaa antava väestövertailu', { exact: true }).scrollIntoViewIfNeeded();
      if (scenario.name === 'age65') await page.getByText('Tilastokeskus · kulutus 2022 (taustatieto)', { exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `design/current/comparison-${scenario.name}.png` });
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
