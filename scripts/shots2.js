const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 400, height: 860 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('http://localhost:8099'); await p.waitForTimeout(1200);
  await p.getByText('Per Tieeri', { exact: true }).last().click(); await p.waitForTimeout(600);
  for (const t of ['Aloitetaan','Kyllä, 21','Käyn töissä','Yksin vuokralla','Oppia taloutta','Ei mistään erityisesti','Jatka','Opettaen ja perustellen']) { await p.getByText(t,{exact:true}).click(); await p.waitForTimeout(350); }
  await p.waitForTimeout(3000);
  await p.getByText('Oma talous').click(); await p.waitForTimeout(2500);
  await p.mouse.move(200, 500);
  for (let i = 1; i <= 4; i++) { await p.mouse.wheel(0, 650); await p.waitForTimeout(1800); await p.screenshot({ path: `scripts/v${i}.png` }); }
  await b.close();
})();
