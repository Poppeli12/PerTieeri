// Uses the local server's real AI connection. Run explicitly: node scripts/test-chart-agent.js [base URL]
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://localhost:8109';
const scenarios = [
  { id: 'trend', question: 'Miten ravintolamenoni ovat kehittyneet viimeisen kuuden kuukauden aikana? Havainnollista.', expected: 'line' },
  { id: 'explicit-bar', question: 'Näytä vain ravintolamenoni viimeiseltä kolmelta kuukaudelta nimenomaan pylväskaaviona.', expected: 'bar', count: 3 },
  { id: 'explicit-pie', question: 'Näytä syyskuun 2026 ruoka-, ravintola- ja asumismenojen keskinäinen jakauma ympyräkaaviona. Vain nämä kolme luokkaa.', expected: 'pie', count: 3 },
].filter(scenario => !process.argv[3] || scenario.id === process.argv[3]);
(async () => {
  const browser = await chromium.launch();
  try {
    await Promise.all(scenarios.map(async scenario => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const calls = [];
      const outputs = [];
      await page.route('**/api/agent', async route => {
        const body = route.request().postDataJSON();
        if (body.input?.[0]?.content?.startsWith('[Sovellus:')) return route.fulfill({ json: { output: [{ type: 'message', content: [{ type: 'output_text', text: 'Hei!' }] }] } });
        for (const item of body.input || []) if (item.type === 'function_call_output') outputs.push(JSON.parse(item.output));
        await route.continue();
      });
      page.on('response', async response => {
        if (!response.url().endsWith('/api/agent')) return;
        const data = await response.json().catch(() => ({}));
        for (const item of data.output || []) if (item.type === 'function_call') calls.push({ name: item.name, args: JSON.parse(item.arguments || '{}') });
      });
      await page.goto(base);
      await page.getByRole('tab', { name: /Tuki/ }).locator('svg').click();
      await page.getByText('Hei!', { exact: true }).waitFor({ state: 'attached' });
      await page.getByPlaceholder('Kirjoita viesti').fill(scenario.question);
      await page.getByPlaceholder('Kirjoita viesti').press('Enter');
      try {
        const chart = page.getByTestId(`data-chart-${scenario.expected}`);
        await chart.waitFor({ timeout: 120000 });
        const draw = calls.find(call => call.name === 'show_chart');
        assert.ok(draw, 'show_chart called');
        if (scenario.count) assert.equal(draw.args.labels.length, scenario.count, 'Specific scope respected');
        assert.ok(calls.some(call => ['monthly_series', 'query_transactions', 'get_spending'].includes(call.name)), 'Figures fetched from transactions');
        assert.ok(!outputs.some(output => output.virhe), JSON.stringify(outputs));
        await page.waitForTimeout(2800);
        await page.screenshot({ path: `design/current/agent-chart-${scenario.id}.png` });
        console.log(JSON.stringify({ scenario: scenario.id, passed: true, calls }));
      } catch (error) { console.log(JSON.stringify({ scenario: scenario.id, calls, outputs })); throw error; }
      finally { await page.close(); }
    }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
