// Browser integration. AI alone is mocked; the customer's bank data and saved memory use the configured backend.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const analytics = require('../src/finance/analytics.ts');
const { monthlyGame } = require('../src/finance/insights.ts');
const base = process.argv[2] || 'http://127.0.0.1:8113';
const live = process.argv.includes('--live');

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  let bank, sent, gameCalls = 0, cloudMessages = 0, cloudGameSaved = false;
  try {
    const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', async r => {
      if (r.url().endsWith('/rpc/pt_save_memory') && r.ok()) {
        const state = r.request().postDataJSON()?.p_state;
        if (Object.keys(state?.quiz || {}).some(key => key.endsWith(':page') && state.quiz[key] === 5)) cloudGameSaved = true;
      }
      if (r.url().includes('/api/customer?')) bank = await r.json();
      if (live && r.url().endsWith('/api/agent') && r.request().method() === 'POST') {
        const j = await r.json();
        assert.equal(r.status(), 200, 'Live cloud AI request succeeds');
        const calls = j.output?.filter(x => x.type === 'function_call') || [];
        gameCalls += calls.filter(x => x.name === 'monthly_game').length;
        const texts = j.output?.filter(x => x.type === 'message').flatMap(x => x.content || []).filter(x => x.type === 'output_text').map(x => x.text) || [];
        cloudMessages += texts.length;
        console.log('CLOUD', { status: r.status(), model: j.model, response: j.id, tools: calls.map(x => x.name), text: texts.join(' ').slice(0, 1800) });
      }
    });
    if (!live) await page.route('**/api/agent', async route => {
      const b = route.request().postDataJSON();
      if (b.input?.some(x => x.type === 'function_call_output')) return route.fulfill({ json: { output: [{ type: 'message', content: [{ type: 'output_text', text: 'Pelin kysymykset tulevat omista tilitapahtumistanne. Lopuksi saatte pisteet ja demokupongin, joka ei ole oikea etu.' }] }] } });
      sent = b.input?.find(x => x.role === 'user')?.content;
      return route.fulfill({ json: { output: [{ type: 'function_call', name: 'monthly_game', call_id: 'game-ui', arguments: '{"month":"2026-08"}' }] } });
    });
    await page.goto(base);
    await page.getByRole('tab', { name: /Tuki/ }).locator('svg').click({ timeout: 60000 });
    const scene = page.getByRole('img', { name: /Per Tieeri lajittelee kuitteja/ });
    await scene.waitFor();
    const illustration = scene.locator('img');
    await illustration.waitFor();
    assert.match(await illustration.getAttribute('src'), /lajittelu-[123]/, 'Original receipt-sorting illustration');
    const paper = scene.locator('svg').locator('..');
    const start = await paper.getAttribute('style');
    await page.waitForTimeout(600);
    assert.notEqual(await paper.getAttribute('style'), start, 'Receipt animation moves');
    await page.screenshot({ path: 'design/current/game-welcome.png' });

    const pager = page.getByTestId('suggestion-pager');
    const left = pager.getByRole('button', { name: 'Edelliset ehdotukset' });
    const right = pager.getByRole('button', { name: 'Seuraavat ehdotukset' });
    assert.equal(await left.isDisabled(), true);
    await right.click();
    await page.waitForTimeout(160);
    assert.notEqual(await page.getByTestId('suggestion-page').evaluate(e => e.style.transform), 'translateX(0px)', 'Suggestions slide sideways');
    await page.waitForTimeout(250);
    assert.equal(await left.isDisabled(), false);
    await left.click();
    await page.waitForTimeout(360);
    assert.equal(await left.isDisabled(), true);
    if (!live) {
      for (let i = 0; i < 7; i++) { await right.click(); await page.waitForTimeout(360); }
      assert.equal(await right.isDisabled(), true, 'Last page does not wrap around');
      for (let i = 0; i < 7; i++) { await left.click(); await page.waitForTimeout(360); }
    }
    if (process.argv.includes('--paraphrase')) {
      await page.getByPlaceholder('Kirjoita viesti').fill('Testaisitko pienellä tietovisalla, kuinka hyvin tunnen omat menoni?');
      await page.getByPlaceholder('Kirjoita viesti').press('Enter');
    } else await pager.getByRole('button', { name: 'Aloita peli', exact: true }).click();
    const game = page.getByTestId('finance-game').last();
    await game.waitFor({ timeout: 150000 });
    if (live) {
      await page.waitForFunction(() => [...document.querySelectorAll('input')].some(x => x.placeholder === 'Kirjoita viesti') && !document.body.innerText.includes('kirjoittaa…'), null, { timeout: 120000 });
      // Wait for the final response, not only the tool card.
      for (let n = 0; n < 120 && cloudMessages === 0; n++) await page.waitForTimeout(500);
      assert.ok(gameCalls >= 1 && cloudMessages >= 1, 'LLM chose the game and completed its reply in the real cloud');
    } else assert.equal(sent, 'Haluan kokeilla peliä', 'Button sends natural language to the LLM');
    assert.ok(bank?.transactions?.length, 'Bank data was loaded from the selected customer');
    analytics.setCustomerData(bank);
    const questions = monthlyGame('2026-08').questions;
    assert.match(await game.innerText(), /demokupongin/);
    let expectedScore = 0;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await game.getByText(`Kysymys ${i + 1}/5`, { exact: false }).waitFor();
      if (i === 0) assert.equal(await game.getByRole('button', { name: 'Edellinen kysymys' }).isDisabled(), true);
      if (q.type === 'choice') {
        const choice = i === 2 ? (q.correct + 1) % q.options.length : q.correct;
        await game.getByRole('button', { name: q.options[choice], exact: true }).click();
        expectedScore += i === 2 ? 0 : 2;
      } else {
        const input = game.getByRole('textbox', { name: 'Oma arvio euroina' });
        assert.equal(await game.getByRole('button', { name: 'Vastaa', exact: true }).isDisabled(), true);
        await input.fill('abc100');
        assert.equal(await game.getByRole('button', { name: 'Vastaa', exact: true }).isDisabled(), true);
        const value = i === 4 ? q.answer + Math.max(10, q.answer * q.tolerance) * 1.5 : q.answer;
        await input.fill(value.toFixed(2).replace('.', ','));
        await game.getByRole('button', { name: 'Vastaa', exact: true }).click();
        expectedScore += i === 4 ? 1 : 2;
      }
      if (i === 1) {
        await game.getByRole('button', { name: 'Edellinen kysymys' }).click();
        await page.waitForTimeout(400);
        assert.equal(await game.getByRole('button', { name: /Oma vastaus/ }).isDisabled(), true, 'Cannot answer twice after going back');
        await game.getByRole('button', { name: 'Seuraava kysymys' }).click();
        await page.waitForTimeout(400);
        assert.equal(await game.getByRole('textbox', { name: 'Oma arvio euroina' }).inputValue(), String(q.answer));
      }
      if (i === 0) await game.screenshot({ path: 'design/current/game-question.png' });
      await game.getByRole('button', { name: i === 4 ? 'Katso tulos' : 'Seuraava kysymys', exact: true }).click();
      await page.waitForTimeout(400);
    }
    assert.match(await game.innerText(), new RegExp(`${expectedScore}/10 pistettä`));
    assert.match(await game.getByTestId('game-coupon').innerText(), /10 %/);
    await game.getByTestId('game-coupon').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'design/current/game-result.png' });
    await page.waitForTimeout(1500);
    for (let n = 0; n < 20 && !cloudGameSaved; n++) await page.waitForTimeout(500);
    assert.ok(cloudGameSaved, 'Completed game was saved successfully to Supabase');
    await page.reload();
    await page.getByTestId('game-reward').last().waitFor({ timeout: 60000 });
    assert.match(await page.getByTestId('game-reward').last().innerText(), new RegExp(`${expectedScore}/10 pistettä`), 'Result survives reload');
    await page.setViewportSize({ width: 360, height: 800 });
    await page.getByTestId('game-coupon').last().scrollIntoViewIfNeeded();
    const box = await page.getByTestId('finance-game').last().boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 361, 'Fits a narrow phone');
    await page.screenshot({ path: 'design/current/game-narrow.png' });
    assert.deepEqual(errors, []);
    console.log(`PASS ${live ? 'LIVE CLOUD' : 'mocked AI'}: original receipt animation, suggestion arrows/slides, game, valid input, backtracking, ${expectedScore}/10 points, coupon, reload and narrow phone`);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
