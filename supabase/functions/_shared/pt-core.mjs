// Per Tieerin tietopalvelun YHTEINEN logiikka (ympäristöstä riippumaton).
// Käyttäjät: server/api.js (paikallinen kehityspalvelin, tiedostot levyltä) ja
// supabase/functions/api (pilvi: tiedostot Supabase Storagesta). io-olio hoitaa luku/välimuistin.
//
// io = {
//   readJson(name)        → index.json / metrics.json / mortgage.json sisältö (objekti)
//   readCustomer(id)      → asiakkaan JSON-merkkijono tai null
//   cacheGet(key)         → aiempi Tilastokeskus-vastaus tai null
//   cacheSet(key, value)  → tallenna (pilvessä muistiin, paikallisesti tiedostoon)
//   sha1(text)            → heksamerkkijono
// }
const PX = 'https://pxdata.stat.fi/PxWeb/api/v1/fi/StatFin/';
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;
const FETCH_TIMEOUT_MS = 8000;

export function createPtApi(io) {
let INDEX = null;
let METRICS = null;
async function load() {
  if (!INDEX) INDEX = await io.readJson('index.json');
  if (!METRICS) METRICS = await io.readJson('metrics.json');
}

/* ---------------- tilastolliset apurit ---------------- */

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);

/** Ikäryhmät samoina kuin Tilastokeskuksen tulonjakotilastossa → vertailut ovat samoilla rajoilla */
const AGE_BANDS = [
  [18, 24],
  [25, 34],
  [35, 49],
  [50, 64],
  [65, 74],
  [75, 200],
];
function band(age) {
  const b = AGE_BANDS.find(([a, z]) => age >= a && age <= z);
  return b ? (b[1] >= 200 ? `${b[0]}-` : `${b[0]}-${b[1]}`) : null;
}
const MIN_GROUP = 30;

async function peers(id, metricNames, group) {
  await load();
  const me = INDEX.customers.find((c) => c.id === id);
  if (!me) return { error: 'tuntematon asiakas' };
  const myBand = band(me.age);
  const members = INDEX.customers.filter((c) => c.id !== id && (group === 'all' || band(c.age) === myBand));
  const out = {
    source: 'Muut S-Pankin asiakkaat, sama 12 kk jakso (ei koko Suomen väestö)',
    window: METRICS.meta.window,
    group: group === 'all' ? 'kaikki S-Pankin asiakkaat' : `${myBand}-vuotiaat S-Pankin asiakkaat`,
    group_size: members.length,
    reliable: members.length >= MIN_GROUP,
    note:
      members.length >= MIN_GROUP
        ? 'Kaikkien asiakkaiden luvut on laskettu samalta 12 kuukauden jaksolta.'
        : `Vertailuryhmässä on vain ${members.length} asiakasta – liian vähän luotettavaan vertailuun.`,
    metrics: {},
  };
  for (const m of metricNames) {
    const def = METRICS.meta.definitions[m] || METRICS.meta.definitions[m.startsWith('cat:') ? 'cat:*' : m];
    const vals = members.map((c) => METRICS.metrics[c.id][m]).filter((v) => typeof v === 'number').sort((a, b) => a - b);
    const mine = METRICS.metrics[id][m];
    const below = vals.filter((v) => v < mine).length;
    out.metrics[m] = {
      definition: def,
      user: r2(mine),
      median: r2(quantile(vals, 0.5)),
      p25: r2(quantile(vals, 0.25)),
      p75: r2(quantile(vals, 0.75)),
      mean: r2(vals.reduce((s, v) => s + v, 0) / (vals.length || 1)),
      n: vals.length,
      user_percentile: vals.length ? Math.round((below / vals.length) * 100) : null,
    };
  }
  return out;
}

/* ---------------- Tilastokeskus (PxWeb) ---------------- */

async function px(table, query) {
  const key = table.replace(/[^\w]/g, '_') + '_' + (await io.sha1(JSON.stringify(query))).slice(0, 16);
  let cached = await io.cacheGet(key);
  if (cached && (!Number.isFinite(cached.fetchedAt) || !cached.data?.dimension)) cached = null;
  if (cached && Date.now() - cached.fetchedAt < MAX_AGE_MS) return { ...cached, from_cache: true };
  try {
    const r = await fetch(PX + table, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, response: { format: 'json-stat2' } }), signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    if (!data.dimension || !Array.isArray(data.id) || !Array.isArray(data.size) || !data.value) throw new Error('Virheellinen StatFin-vastaus');
    const rec = { fetchedAt: Date.now(), url: PX + table, data };
    await io.cacheSet(key, rec);
    return { ...rec, from_cache: false };
  } catch (e) {
    if (cached) return { ...cached, from_cache: true, stale: true, error: String(e.message || e) };
    throw e;
  }
}

/** Taulukon uusin vuosi metatiedoista (PxWebin "top"-suodatin ei ole luotettava järjestyksen suhteen) */
const META = {};
async function latestYears(table, n = 1) {
  if (!META[table] || Date.now() - META[table].checkedAt >= MAX_AGE_MS) {
    const key = table.replace(/[^\w]/g, '_') + '_meta';
    const cached = await io.cacheGet(key);
    const fresh = cached?.variables && Number.isFinite(cached.savedAt) && Date.now() - cached.savedAt < MAX_AGE_MS;
    try {
      if (fresh) META[table] = { data: cached, checkedAt: Date.now() };
      else {
        const r = await fetch(PX + table, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const data = await r.json();
        if (!Array.isArray(data.variables)) throw new Error('Virheelliset StatFin-metatiedot');
        META[table] = { data, checkedAt: Date.now() };
        await io.cacheSet(key, { ...data, savedAt: Date.now() });
      }
    } catch (e) {
      if (cached?.variables) META[table] = { data: cached, checkedAt: Date.now(), stale: true };
      else throw e;
    }
  }
  const v = META[table].data.variables.find((x) => x.code === 'timeperiod_y');
  if (!v?.values?.length) throw new Error('Tilastovuosi puuttuu');
  return [...v.values].sort((a, b) => +a - +b).slice(-n);
}

/** json-stat2 → rivit {dimKoodi: arvokoodi, ..., value} */
function rows(d) {
  const ids = d.id;
  const cats = ids.map((k) => {
    const idx = d.dimension[k].category.index;
    return Array.isArray(idx) ? idx : Object.keys(idx).sort((a, b) => idx[a] - idx[b]);
  });
  const out = [];
  const n = d.size.reduce((a, b) => a * b, 1);
  for (let i = 0; i < n; i++) {
    let rem = i;
    const row = {};
    for (let j = ids.length - 1; j >= 0; j--) {
      const size = d.size[j];
      row[ids[j]] = cats[j][rem % size];
      rem = Math.floor(rem / size);
    }
    row.value = Number.isFinite(d.value[i]) ? d.value[i] : null;
    out.push(row);
  }
  return out;
}
const label = (d, dim, code) => d.dimension[dim].category.label[code];

/**
 * Pankkiaineiston kategoriat ↔ kulutustutkimuksen COICOP 2018 -luokat.
 * quality: 'hyvä' = sama asia; 'likimääräinen' = suunnilleen sama, ero kerrotaan; 'ei' = ei vertailukelpoinen.
 */
const MAP = {
  Groceries: { codes: ['01'], quality: 'likimääräinen', why: 'Ruokakaupan ostoissa voi olla myös muita kuin elintarvikkeita; tilastossa vain elintarvikkeet ja alkoholittomat juomat.' },
  Restaurants: { codes: ['111'], quality: 'likimääräinen', why: 'Ravintolat, kahvilat ja pikaruoka vastaavat pääosin ravitsemispalveluja. Kauppiasluokitus ei kerro ostoksen tarkkaa sisältöä.' },
  Transportation: { codes: ['072', '073'], quality: 'likimääräinen', why: 'Verrataan ajoneuvojen käyttöön ja kuljetuspalveluihin (ei auton ostoa). Pankkiaineiston luokka voi rajautua eri tavalla.' },
  Health: { codes: ['06'], quality: 'likimääräinen', why: 'Lääkkeet ja terveyspalvelut; pankkiaineiston luokan tarkka sisältö ei ole tiedossa.' },
  Entertainment: { codes: ['091', '092', '094', '096'], quality: 'ei', why: 'Viihteen kauppiasluokka ja tilastojen tavara- ja palveluryhmät eivät kata samoja ostoja; tilaukset ovat pankkidatassa erillään.' },
  'Home & Tech': { codes: ['05', '081'], quality: 'ei', why: 'Pankkiluokassa on myös rautakauppaa ja ohjelmistoja. Kalusteet ja viestintälaitteet eivät kata samaa kokonaisuutta.' },
  Lifestyle: { codes: ['03'], quality: 'ei', why: 'Shoppailu sisältää vaatteiden lisäksi kirjoja, pelejä ja urheiluvälineitä. Sitä ei verrata pelkkiin vaate- ja jalkinemenoihin.' },
  Travel: { codes: ['112', '098'], quality: 'ei', why: 'Pankkiluokka sisältää myös lentoja ja autonvuokrausta. Majoitus ja valmismatkat eivät kata samaa kokonaisuutta.' },
  Housing: { codes: [], quality: 'ei', why: 'Tilaston vuokrakeskiarvo sisältää myös omistusasujat (vuokra 0 €), eikä yhden henkilön pankkitililtä näe asumismuotoa – ei vertailukelpoinen.' },
  Utilities: { codes: [], quality: 'ei', why: 'Pankkiaineiston laskujen sisältö (sähkö, vesi, netti, vakuutukset…) ei ole tiedossa – ei vertailukelpoinen yksittäiseen tilastoluokkaan.' },
};
const HH_TYPES = { 1: 'Yhden hengen talous, alle 65 v', 2: 'Lapseton pari, alle 65 v', 3: 'Yhden huoltajan taloudet', 4: 'Kahden huoltajan lapsiperhe', 5: 'Yli 64-vuotiaiden kotitaloudet', 6: 'Muut kotitaloudet', SSS: 'Kaikki kotitaloudet' };

const CONSUMPTION_AGES = ['17-24', '25-34', '35-44', '45-54', '55-64', '65-74', '75-84', '85-'];
async function consumption(type, group = 'household') {
  const config = {
    household: { table: '14ph', dimension: 'elinvaihe_13_20160101', values: Object.keys(HH_TYPES) },
    age: { table: '14q4', dimension: 'ikaryhma_10_20180101', values: CONSUMPTION_AGES },
    quintile: { table: '14pg', dimension: 'tuloviidennes_2_20140501', values: ['1', '2', '3', '4', '5'] },
  }[group];
  if (!config || !config.values.includes(String(type))) throw new Error('Tuntematon kulutuksen vertailuryhmä');
  const table = `ktutk/${config.table}.px`;
  const codes = ['0', ...new Set(Object.values(MAP).flatMap((m) => m.codes))];
  const res = await px(table, [
    { code: 'timeperiod_y', selection: { filter: 'item', values: await latestYears(table) } },
    { code: 'coicop_46_20231201', selection: { filter: 'item', values: codes } },
    { code: config.dimension, selection: { filter: 'item', values: [String(type)] } },
    { code: 'contentscode', selection: { filter: 'item', values: ['kulukk_kt_hk_1_1', 'kulukk_kt_hk_2_1'] } },
  ]);
  const d = res.data;
  const rs = rows(d);
  const year = rs[0].timeperiod_y;
  const v = (code, cc) => rs.find((r) => r.coicop_46_20231201 === code && r.contentscode === cc)?.value ?? null;
  const categories = {};
  for (const [cat, m] of Object.entries(MAP)) {
    if (!m.codes.length) {
      categories[cat] = { quality: 'ei', why: m.why };
      continue;
    }
    const per = (cc) => {
      const xs = m.codes.map((c) => v(c, cc));
      return xs.some((x) => x == null) ? null : xs.reduce((s, x) => s + x, 0);
    };
    categories[cat] = {
      quality: m.quality,
      why: m.why,
      coicop: m.codes.map((c) => label(d, 'coicop_46_20231201', c)),
      household_month: per('kulukk_kt_hk_1_1'),
      per_consumption_unit_month: per('kulukk_kt_hk_2_1'),
    };
  }
  return {
    source: d.source || 'Tilastokeskus, kotitalouksien kulutus',
    table: `StatFin / ktutk / ${config.table}`,
    url: res.url,
    source_url: `https://pxdata.stat.fi/PxWeb/pxweb/fi/StatFin/StatFin__ktutk/${config.table}.px/`,
    year: Number(year),
    statistic: 'keskiarvo (kotitaloutta tai kulutusyksikköä kohden), euroa kuukaudessa, käyvin hinnoin',
    unit_note: 'Kotitalouden kulutusmenot. Yhden hengen taloudessa kotitalous = henkilö. Kulutusyksikkö: OECD:n muunnettu asteikko.',
    group,
    household_type: group === 'age'
      ? `Kotitaloudet, joiden viitehenkilö on ${label(d, config.dimension, String(type))} v`
      : group === 'quintile' ? `Kotitaloudet, tuloviidennes ${label(d, config.dimension, String(type))}`
      : label(d, config.dimension, String(type)),
    total_household_month: v('0', 'kulukk_kt_hk_1_1'),
    categories,
    updated: d.updated,
    fetched_at: new Date(res.fetchedAt).toISOString(),
    from_cache: res.from_cache,
    stale: !!res.stale || !!META[table]?.stale,
  };
}

const INCOME_BANDS = ['18-24', '25-34', '35-49', '50-64', '65-74', '75-'];
async function income(ageBand) {
  if (![...INCOME_BANDS, '18-'].includes(ageBand)) throw new Error('Tuntematon tulotilaston ikäryhmä');
  const bandCode = ageBand;
  const res = await px('tjt/11py.px', [
    { code: 'ikaryhma_22_20191201', selection: { filter: 'item', values: [bandCode] } },
    { code: 'contentscode', selection: { filter: 'item', values: ['hkturaha_med', 'hkturaha_mean'] } },
    { code: 'timeperiod_y', selection: { filter: 'item', values: await latestYears('tjt/11py.px') } },
    { code: 'sukupuoli_9_20180101', selection: { filter: 'item', values: ['SSS'] } },
  ]);
  const d = res.data;
  const rs = rows(d);
  const get = (c) => rs.find((r) => r.contentscode === c)?.value ?? null;
  const med = get('hkturaha_med');
  const mean = get('hkturaha_mean');
  return {
    source: d.source || 'Tilastokeskus, tulonjakotilasto',
    table: 'StatFin / tjt / 11py – Käytettävissä olevat rahatulot henkilön iän mukaan',
    url: res.url,
    year: Number(rs[0].timeperiod_y),
    age_group: bandCode,
    statistic: 'henkilökohtainen käytettävissä oleva rahatulo (kotitalouskohtaisia tuloeriä ei jaettu henkilöille)',
    median_year: med,
    mean_year: mean,
    median_month: med == null ? null : Math.round(med / 12),
    mean_month: mean == null ? null : Math.round(mean / 12),
    fetched_at: new Date(res.fetchedAt).toISOString(),
    from_cache: res.from_cache,
    stale: !!res.stale || !!META['tjt/11py.px']?.stale,
  };
}

async function cpi() {
  const res = await px('khi/11xt.px', [
    { code: 'indeksisarja_1_20160101', selection: { filter: 'item', values: ['0_2015'] } },
    { code: 'timeperiod_y', selection: { filter: 'item', values: await latestYears('khi/11xt.px', 5) } },
  ]);
  const d = res.data;
  const rs = rows(d).filter((r) => typeof r.value === 'number');
  const by = Object.fromEntries(rs.map((r) => [r.timeperiod_y, r.value]));
  return { source: d.source || 'Tilastokeskus, kuluttajahintaindeksi', table: 'StatFin / khi / 11xt (KHI 2015=100)', url: res.url, index: by, fetched_at: new Date(res.fetchedAt).toISOString(), from_cache: res.from_cache };
}

/* ---------------- reititys ---------------- */
/** Palauttaa { status, json } tai { status, raw } (asiakkaan valmis JSON-merkkijono). */
async function route(pathname, q) {
  try {
    switch (pathname) {
      case '/api/customers': {
        await load();
        let list = INDEX.customers;
        if (q.q) list = list.filter((c) => c.id.toLowerCase().includes(q.q.toLowerCase()) || c.postal.startsWith(q.q));
        if (q.age) list = list.filter((c) => band(c.age) === q.age);
        const off = +q.offset || 0;
        const lim = Math.min(200, +q.limit || 50);
        return { status: 200, json: { total: list.length, customers: list.slice(off, off + lim), bands: INCOME_BANDS } };
      }
      case '/api/customer': {
        if (!/^CUST\d{5}$/.test(q.id || '')) return { status: 400, json: { error: 'id' } };
        const raw = await io.readCustomer(q.id);
        if (raw == null) return { status: 404, json: { error: 'ei löydy' } };
        return { status: 200, raw };
      }
      case '/api/mortgage-stats':
        return { status: 200, json: await io.readJson('mortgage.json') };
      case '/api/peers':
        return { status: 200, json: await peers(q.id, (q.metrics || 'spend_total').split(','), q.group === 'all' ? 'all' : 'age') };
      case '/api/statfin/consumption':
        return { status: 200, json: await consumption(q.type || 'SSS', q.group || 'household') };
      case '/api/statfin/income':
        return { status: 200, json: await income(q.age || band(+q.years || 0) || '18-') };
      case '/api/statfin/cpi':
        return { status: 200, json: await cpi() };
      default:
        return { status: 404, json: { error: 'tuntematon' } };
    }
  } catch (e) {
    return { status: 502, json: { error: String((e && e.message) || e) } };
  }
}

return { route, band, consumption, income, cpi, peers, rows, CONSUMPTION_AGES };
}
