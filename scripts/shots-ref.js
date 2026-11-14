// Kuvakaappaukset referenssivertailua varten: node scripts/shots-ref.js [port]
// Tallentaa design/current/*.png (leveys 412 px ≈ referenssipuhelimen dp-leveys)
const { chromium } = require('playwright');
const port = process.argv[2] || '8101';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 2 });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  p.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text().slice(0, 200)));
  await p.goto(`http://localhost:${port}`);
  await p.waitForTimeout(4000);
  const dir = 'design/current';
  const shot = (n) => p.screenshot({ path: `${dir}/${n}.png` });
  const tab = async (t) => {
    await p.getByRole('tab', { name: t }).first().click();
    await p.waitForTimeout(900);
  };
  const scroll = async (dy) => {
    await p.mouse.move(206, 450);
    await p.mouse.wheel(0, dy);
    await p.waitForTimeout(700);
  };

  await shot('koti');
  await scroll(700);
  await shot('koti-ala');
  await scroll(1000);
  await shot('koti-ala2');
  await scroll(1200);
  await shot('koti-ala3');

  await tab('S-Etukortti');
  await shot('etukortti');

  await tab('Pankki');
  await shot('pankki');
  await scroll(900);
  await shot('pankki-ala');
  await p.getByText('Kortit', { exact: true }).click();
  await p.waitForTimeout(900);
  await shot('pankki-kortti');
  await p.getByLabel('Takaisin').click();
  await p.waitForTimeout(600);

  await tab('Minä');
  await shot('mina');
  await scroll(800);
  await shot('mina-ala');

  await p.getByLabel('Maksu', { exact: true }).click();
  await p.waitForTimeout(900);
  await shot('maksu-sheet');
  await p.getByText('Uusi maksu', { exact: true }).click();
  await p.waitForTimeout(900);
  await shot('maksu-saaja');
  await p.getByLabel('Takaisin').click();
  await p.waitForTimeout(600);

  await tab('Tuki – Per Tieeri, talousvalmentaja');
  await p.waitForTimeout(600);
  await shot('tuki');
  await b.close();
})();
