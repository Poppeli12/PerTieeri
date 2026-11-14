// Actual customer data, real card rendering; only AI mocked unless --live is explicitly supplied.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { buildSpendingGrid } = require('../src/finance/spendingGrid.ts');
const { eur } = require('../src/finance/analytics.ts');
const base = process.argv[2] || 'http://127.0.0.1:8113';
const live = process.argv.includes('--live');
const prompt = 'Katso kulujani ruudukkonäkymällä';
(async () => {
  const browser = await chromium.launch();
  try {
    for (const [index, id] of (live ? ['CUST00171'] : ['CUST00001', 'CUST00171', 'CUST02000']).entries()) {
      const context = await browser.newContext({ viewport: { width: index === 1 ? 320 : 390, height: 844 } });
      const page = await context.newPage();
      const errors = [];
      let liveTools = 0, liveMessages = 0, saved = false, reported;
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', async r => {
        if (r.url().endsWith('/rpc/pt_save_memory') && r.ok()) {
          saved ||= !!r.request().postDataJSON()?.p_state?.messages?.some(m => m.cards?.some(c => c.kind === 'spendingGrid'));
        }
        if (live && r.url().endsWith('/api/agent') && r.request().method() === 'POST') {
          assert.equal(r.status(), 200);
          const j = await r.json();
          const calls = j.output?.filter(x => x.type === 'function_call') || [];
          liveTools += calls.filter(x => x.name === 'show_monthly_spending_grid').length;
          const text = j.output?.filter(x => x.type === 'message').flatMap(x => x.content || []).filter(x => x.type === 'output_text').map(x => x.text) || [];
          liveMessages += text.length;
          console.log('CLOUD', { status: r.status(), model: j.model, tools: calls.map(x => x.name), text: text.join('\n').slice(0, 2200) });
        }
      });
      if (!live) await page.route('**/api/agent', async route => {
        const body = route.request().postDataJSON();
        const outputs = body.input?.filter(x => x.type === 'function_call_output');
        if (outputs?.length) {
          reported = JSON.parse(outputs[0].output);
          return route.fulfill({ json: { output: [{ type: 'message', content: [{ type: 'output_text', text: 'Sata ruutua näyttää kuukaudenne kulutusmenot. Suurinta osuutta tarkastelemalla huomaatte, mihin rahaa varataan eniten. Kaikkia isoja menoja ei voi vähentää.' }] }] } });
        }
        const text = body.input?.at(-1)?.content;
        return route.fulfill({ json: { output: text === 'Hei vaan!' ? [{ type: 'message', content: [{ type: 'output_text', text: 'Hyvää päivää!' }] }] : [{ type: 'function_call', name: 'show_monthly_spending_grid', call_id: 'grid', arguments: '{}' }] } });
      });
      await page.goto(base);
      if (id !== 'CUST00171') {
        await page.getByRole('tab', { name: /Minä/ }).locator('svg').click({ timeout: 60000 });
        await page.getByRole('button', { name: 'Vaihda asiakasta', exact: true }).click();
        await page.getByPlaceholder('Hae asiakastunnuksella tai postinumerolla').fill(id);
        await page.getByText(id, { exact: true }).click();
        await page.getByPlaceholder('Hae asiakastunnuksella tai postinumerolla').waitFor({ state: 'hidden', timeout: 60000 });
      }
      await page.getByRole('tab', { name: /Tuki/ }).locator('svg').click({ timeout: 60000 });
      await page.getByRole('button', { name: prompt, exact: true }).first().waitFor();
      if (live || index === 1) {
        await page.getByPlaceholder('Kirjoita viesti').fill('Näytä mihin rahani menivät sadalla ruudulla');
        await page.getByPlaceholder('Kirjoita viesti').press('Enter');
      } else await page.getByRole('button', { name: prompt, exact: true }).first().click();
      const card = page.getByTestId('monthly-spending-card').last();
      await card.waitFor({ timeout: 150000 });
      const bank = JSON.parse(fs.readFileSync(`data/customers/${id}.json`, 'utf8'));
      const expected = buildSpendingGrid(bank.transactions, id);
      assert.equal(await card.getByTestId('spending-total').innerText(), eur(expected.totalCents / 100));
      assert.match(await card.innerText(), new RegExp(id));
      assert.match(await card.innerText(), /08 \/ 2026/);
      const grid = card.getByTestId('monthly-spending-grid');
      assert.equal(await grid.getByTestId('spending-grid-row').count(), 10);
      assert.equal(await grid.locator('[data-testid^="spending-cell-"]').count(), 100);
      for (const row of await grid.getByTestId('spending-grid-row').all()) assert.equal(await row.locator('[data-testid^="spending-cell-"]').count(), 10);
      const rect = await grid.boundingBox();
      assert.ok(rect.width > 220 && rect.x >= 0 && rect.x + rect.width <= page.viewportSize().width);
      assert.ok(Math.abs(rect.width - rect.height) < 2, 'A square grid at narrow phone widths');
      await grid.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `design/current/grid-${id}.png` });
      const group = expected.groups[0];
      await card.getByTestId(`spending-category-${group.key}`).click();
      const opacities = await grid.locator('[data-testid^="spending-cell-"]').evaluateAll(xs => xs.map(x => +getComputedStyle(x).opacity));
      assert.equal(opacities.filter(v => v === 1).length, group.cells);
      assert.equal(opacities.filter(v => v === 0.15).length, 100 - group.cells);
      const detail = card.getByTestId('spending-details');
      assert.match(await detail.innerText(), new RegExp(group.label));
      assert.ok((await detail.innerText()).includes(eur(group.expenses[0].cents / 100)));
      if (group.expenses.length > 5) {
        await detail.getByRole('button', { name: `Näytä kaikki ${group.expenses.length} tapahtumaa` }).click();
        assert.equal(await detail.getByText(group.expenses.at(-1).label, { exact: true }).count() > 0, true);
      }
      await card.getByRole('button', { name: 'Näytä kaikki ruudut' }).click();
      assert.equal(await card.getByTestId('spending-details').count(), 0);
      assert.ok((await grid.locator('[data-testid^="spending-cell-"]').evaluateAll(xs => xs.map(x => +getComputedStyle(x).opacity))).every(v => v === 1));
      if (live) assert.ok(liveTools > 0 && liveMessages > 0, 'Real LLM selected the new tool and explained the result');
      else assert.equal(reported.menot_euroa, expected.totalCents / 100);
      for (let n = 0; n < 25 && !saved; n++) await page.waitForTimeout(400);
      assert.ok(saved, 'Existing Supabase memory accepts the new card');
      await page.reload();
      await page.getByTestId('monthly-spending-card').last().waitFor({ timeout: 60000 });
      assert.equal(await page.getByTestId('spending-total').last().innerText(), eur(expected.totalCents / 100));
      assert.deepEqual(errors, []);
      console.log(`PASS ${id}: actual total, 10x10 layout, responsive square grid, highlighting, details, deselection, cloud memory and reload${live ? ', LIVE AI paraphrase' : ''}`);
      if (!live && index === 0) {
        await page.getByPlaceholder('Kirjoita viesti').fill('Hei vaan!');
        await page.getByPlaceholder('Kirjoita viesti').press('Enter');
        await page.waitForTimeout(1500);
        const pager = page.getByTestId('suggestion-pager');
        const right = pager.getByRole('button', { name: 'Seuraavat ehdotukset' });
        for (let i = 0; i < 10; i++) {
          assert.equal(await pager.getByRole('button', { name: prompt, exact: true }).count(), 0, 'No automatic grid suggestion after unrelated small talk');
          if (await right.isDisabled()) break;
          await right.click(); await page.waitForTimeout(400);
        }
      }
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
