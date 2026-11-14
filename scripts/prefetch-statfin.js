// Lataa kaikki Per Tieerin käyttämät Tilastokeskuksen tiedot välimuistiin (data/statfin/),
// jotta vertailut toimivat myös ilman verkkoyhteyttä. Ajo: node scripts/prefetch-statfin.js
const api = require('../server/api');
(async () => {
  for (const t of ['1', '2', '3', '4', '5', '6', 'SSS']) {
    const c = await api.consumption(t);
    console.log('kulutus', c.household_type, c.year, c.total_household_month, '€/kk', c.from_cache ? '(välimuisti)' : '(rajapinta)');
  }
  for (const b of ['18-24', '25-34', '35-49', '50-64', '65-74', '75-']) {
    const i = await api.income(b);
    console.log('tulot', b, i.year, 'mediaani', i.median_month, '€/kk');
  }
  for (const group of ['age', 'quintile']) {
    for (const code of group === 'age' ? api.CONSUMPTION_AGES : ['1', '2', '3', '4', '5']) {
      const c = await api.consumption(code, group);
      console.log('kulutus, taustatieto', group, c.household_type, c.year, c.from_cache ? '(välimuisti)' : '(rajapinta)');
    }
  }
  const k = await api.cpi();
  console.log('KHI', JSON.stringify(k.index));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
