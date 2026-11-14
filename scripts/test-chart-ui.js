// Browser integration, mocked AI only: node scripts/test-chart-ui.js [base URL]
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://localhost:8109';
const fixtures = {
  line: { title: 'Ravintolamenojen kehitys', chart: 'line', unit: '€', labels: ['Huhtikuu', 'Toukokuu', 'Kesäkuu', 'Heinäkuu', 'Elokuu', 'Syyskuu'], series: [{ name: 'Omat menot', values: [240, 285, 320, 270, 190, 150] }], note: 'Omat tapahtumat · huhti–syyskuu 2026' },
  bar: { title: 'Menojen muutos', chart: 'bar', unit: '€', labels: ['Ravintolat', 'Ruokakauppa', 'Asuminen'], series: [{ name: 'Muutos', values: [250, -100, 0] }], note: 'Ylös = menot kasvoivat, alas = menot pienenivät.' },
  pie: { title: 'Mihin rahat menivät?', chart: 'pie', unit: '€', labels: ['Asuminen', 'Ruokakauppa', 'Liikkuminen', 'Vapaa-aika'], series: [{ name: 'Menot', values: [900, 420, 180, 240] }], note: 'Näytettyjen menojen yhteissumma 1 740 €.' },
};
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/agent', async route => {
      const body = route.request().postDataJSON();
      const content = body.input?.[0]?.content || '';
      if (content.startsWith('[Sovellus:') || body.input?.[0]?.type === 'function_call_output') return route.fulfill({ json: { output: [{ type: 'message', content: [{ type: 'output_text', text: content ? 'Hei!' : 'Kuvaaja näyttää oman taloutesi luvut. Katso vihreän viivan kehitystä tai vertaa pylväiden korkeutta. Tarkat euromäärät löytyvät kuvaajan alta. Voit palata selitykseen milloin tahansa ja toistaa rakentumisen painikkeesta.' }] }] } });
      await new Promise(resolve => setTimeout(resolve, 500));
      const name = content === 'forecast' ? 'show_forecast' : content === 'compare' ? 'show_category_bars' : content === 'waterfall' ? 'show_cashflow' : 'show_chart';
      const args = fixtures[content] || { until: '2026-12-31' };
      return route.fulfill({ json: { output: [{ type: 'function_call', name, call_id: 'ui', arguments: JSON.stringify(args) }] } });
    });
    await page.goto(base);
    await page.getByRole('tab', { name: /Tuki/ }).locator('svg').click();
    await page.getByText('Hei!', { exact: true }).waitFor({ state: 'attached' });
    const portrait = page.getByTestId('static-tieeri-portrait').first();
    const still = await portrait.innerHTML();
    const send = async text => { await page.getByPlaceholder('Kirjoita viesti').fill(text); await page.getByPlaceholder('Kirjoita viesti').press('Enter'); };
    await send('line');
    assert.equal(await portrait.innerHTML(), still, 'Portrait stays still while typing');
    const line = page.getByTestId('data-chart-line');
    await line.waitFor();
    await line.getByRole('button', { name: 'Toista rakentuminen' }).click();
    const clip = line.locator('clipPath rect');
    await page.waitForTimeout(180);
    const start = +await clip.getAttribute('width');
    await page.waitForTimeout(1000);
    const middle = +await clip.getAttribute('width');
    await page.waitForTimeout(1600);
    const end = +await clip.getAttribute('width');
    assert.ok(start < middle && middle < end, 'Line is revealed left to right');
    assert.ok((await line.boundingBox()).width >= 400, 'Full chat width');
    await page.screenshot({ path: 'design/current/chart-line.png' });
    const expand = page.getByRole('button', { name: 'Lue koko selitys' }).last();
    await expand.click();
    assert.equal(await page.getByRole('button', { name: 'Näytä tiiviisti' }).getAttribute('aria-expanded'), 'true');
    await page.getByRole('button', { name: 'Näytä tiiviisti' }).click();

    await send('bar');
    const bar = page.getByTestId('data-chart-bar');
    await bar.waitFor();
    await bar.getByRole('button', { name: 'Toista rakentuminen' }).click();
    const bars = bar.locator('svg > rect');
    await page.waitForTimeout(900);
    const half = +await bars.first().getAttribute('height');
    await page.waitForTimeout(1800);
    const sizes = await bars.evaluateAll(elements => elements.map(el => ({ h: +el.getAttribute('height'), y: +el.getAttribute('y') })));
    assert.ok(half > 0 && half < sizes[0].h, 'Bars grow');
    assert.ok(Math.abs(sizes[0].h / sizes[1].h - 2.5) < .001, 'True numerical proportions');
    assert.equal(sizes[2].h, 0, 'Zero stays zero');
    assert.equal(sizes[1].y, sizes[2].y, 'Negative bar starts at zero and grows down');
    assert.ok(sizes[0].y < sizes[2].y);
    await page.screenshot({ path: 'design/current/chart-bar.png' });

    await send('pie');
    const pie = page.getByTestId('data-chart-pie');
    await pie.waitFor();
    assert.equal(await pie.locator('circle').count(), 4);
    await page.screenshot({ path: 'design/current/chart-pie.png' });
    await send('forecast');
    const forecast = page.getByTestId('forecast-plot');
    await forecast.waitFor();
    await page.waitForTimeout(2800);
    assert.equal(+await forecast.getAttribute('height'), 320);
    assert.ok(+await forecast.locator('clipPath rect').getAttribute('width') > 300);
    await page.screenshot({ path: 'design/current/chart-forecast.png' });
    await send('compare');
    await page.getByTestId('growing-bar').first().waitFor();
    await page.waitForTimeout(2800);
    assert.ok((await page.getByTestId('growing-bar').first().boundingBox()).width > 0);
    const oldBarCount = await page.getByTestId('growing-bar').count();
    await send('waterfall');
    await page.getByTestId('growing-bar').nth(oldBarCount).waitFor();
    await page.waitForTimeout(2800);
    assert.equal((await page.getByTestId('growing-bar').nth(oldBarCount).boundingBox()).height, 24);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(100);
    assert.equal(await page.getByRole('button', { name: 'Toista rakentuminen' }).count(), 0);
    assert.equal(+await clip.getAttribute('width'), end, 'Reduced motion shows final values');
    assert.equal(await portrait.innerHTML(), still, 'Same portrait throughout all replies');
    await page.setViewportSize({ width: 320, height: 740 });
    await line.scrollIntoViewIfNeeded();
    const bounds = await line.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 320);
    await page.screenshot({ path: 'design/current/chart-mobile320.png' });
    assert.deepEqual(errors, []);
    console.log('PASS: line reveal, signed bar growth/proportions/zero, pie, forecast, comparison, cashflow, large cards, expandable explanation, static portraits, reduced motion, narrow phone');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
