import { addDays, lastMonths, TODAY, Tx } from '../finance/analytics';
import { LeverKey, leverOf } from '../finance/categories';

export const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Löytää ensimmäisen euromäärän: "700 €", "2 000 euroa", "2k", "150e" */
export function parseAmount(s: string): number | null {
  const m = s.match(/(\d{1,3}(?:[  ]\d{3})+|\d+)(?:[,.](\d{1,2}))?\s*(k\b|€|e\b|eur|euro)/i);
  if (m) {
    let v = parseFloat(m[1].replace(/[  ]/g, '') + (m[2] ? '.' + m[2] : ''));
    if (m[3].toLowerCase() === 'k') v *= 1000;
    return v;
  }
  const n = s.match(/(\d{2,5})/);
  return n ? +n[1] : null;
}

export function parsePercent(s: string): number | null {
  const m = s.match(/(\d{1,3})\s*(%|prosent)/);
  return m ? +m[1] : null;
}

const MONTHS = ['tammi', 'helmi', 'maalis', 'huhti', 'touko', 'kesä', 'heinä', 'elo', 'syys', 'loka', 'marras', 'joulu'];

/** Kyselyn ajanjakso. Oletus: viimeiset 30 päivää */
export function parsePeriod(s: string): { from: string; to: string; label: string } {
  const t = norm(s);
  const [cur] = lastMonths(1);
  const [prev] = lastMonths(2);
  if (/viime kuu|edellis(enä|en) kuu/.test(t)) return { from: `${prev}-01`, to: `${prev}-31`, label: 'viime kuussa' };
  if (/tässä kuussa|tämän kuun|tässä kuun/.test(t)) return { from: `${cur}-01`, to: `${cur}-31`, label: 'tässä kuussa' };
  if (/viime viiko|edellisellä viiko/.test(t)) return { from: addDays(TODAY, -13), to: addDays(TODAY, -7), label: 'viime viikolla' };
  if (/tällä viiko|tämän viiko/.test(t)) return { from: addDays(TODAY, -6), to: TODAY, label: 'tällä viikolla' };
  if (/viime vuo/.test(t)) return { from: '2025-01-01', to: '2025-12-31', label: 'vuonna 2025' };
  if (/tänä vuo|tämän vuo/.test(t)) return { from: '2026-01-01', to: TODAY, label: 'tänä vuonna' };
  for (let i = 0; i < 12; i++) {
    if (t.includes(MONTHS[i] + 'kuu')) {
      const mm = String(i + 1).padStart(2, '0');
      const y = `2026-${mm}` <= cur ? 2026 : 2025;
      return { from: `${y}-${mm}-01`, to: `${y}-${mm}-31`, label: `${MONTHS[i]}kuussa ${y}` };
    }
  }
  return { from: addDays(TODAY, -29), to: TODAY, label: 'viimeisen 30 päivän aikana' };
}

/** Tavoitepäivä: "ensi kesään", "jouluun", "6 kuukaudessa" */
export function parseTargetDate(s: string): { date: string; label: string } {
  const t = norm(s);
  const km = t.match(/(\d{1,2})\s*(kk|kuukau)/);
  if (km) return { date: addMonths(+km[1]), label: `${km[1]} kuukaudessa` };
  if (/kesä/.test(t)) return { date: '2027-06-01', label: 'ensi kesään' };
  if (/joulu/.test(t)) return { date: '2026-12-20', label: 'jouluun' };
  if (/vuoden loppuun|uuteen vuoteen/.test(t)) return { date: '2026-12-31', label: 'vuoden loppuun' };
  if (/vuode|vuoteen|ensi vuo/.test(t)) return { date: addMonths(12), label: 'vuodessa' };
  if (/kevää/.test(t)) return { date: '2027-04-01', label: 'kevääseen' };
  for (let i = 0; i < 12; i++)
    if (t.includes(MONTHS[i] + 'kuuhun')) {
      const y = i + 1 > 9 ? 2026 : 2027;
      return { date: `${y}-${String(i + 1).padStart(2, '0')}-01`, label: `${MONTHS[i]}kuuhun` };
    }
  return { date: addMonths(6), label: 'puolessa vuodessa' };
}

export function addMonths(n: number) {
  const d = new Date(TODAY + 'T12:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

export function parsePurchaseDate(s: string): string {
  const t = norm(s);
  if (/tänään|nyt|heti/.test(t)) return addDays(TODAY, 1);
  if (/ensi viiko|ensi viikko/.test(t)) return addDays(TODAY, 7);
  if (/ensi kuu/.test(t)) return addDays(TODAY, 30);
  if (/joulu/.test(t)) return '2026-12-18';
  return addDays(TODAY, 7);
}

/* ---------- kategoriasanat ---------- */

type CatMatch = { label: string; pred: (t: Tx) => boolean; lever?: LeverKey };

export const CAT_WORDS: [RegExp, CatMatch][] = [
  [/taks|taxi|uber|bolt/, { label: 'taksit', pred: (t) => t.mcc === 4121, lever: 'Taxi' }],
  [/pikaruo|kahvi|kahvila|hampurilai|pizza/, { label: 'pikaruoka ja kahvilat', pred: (t) => t.mcc === 5814, lever: 'Restaurants' }],
  [/baar|bisse|olu|drink|kalja|yöelä/, { label: 'baarit', pred: (t) => t.mcc === 5813, lever: 'Restaurants' }],
  [/ravintol|ulkona syö|syödä ulkona|syömi|lounas/, { label: 'ravintolat', pred: (t) => t.c === 'Restaurants', lever: 'Restaurants' }],
  [/ruokakaup|kaupassa|ruokaostok|ruokaan|ruoka|kauppa/, { label: 'ruokakauppa', pred: (t) => t.c === 'Groceries', lever: 'Groceries' }],
  [/sali|kunto|liikun|urheil|treeni/, { label: 'liikunta', pred: (t) => leverOf(t.c, t.mcc, t.name) === 'Sport', lever: 'Sport' }],
  [/elokuv|leffa/, { label: 'elokuvat', pred: (t) => t.mcc === 7832, lever: 'Fun' }],
  [/viihde|tapahtum|keikka|konsert|lippu/, { label: 'viihde ja tapahtumat', pred: (t) => leverOf(t.c, t.mcc) === 'Fun', lever: 'Fun' }],
  [/vaatte|shoppail|shopping|ostoks/, { label: 'shoppailu', pred: (t) => t.c === 'Lifestyle', lever: 'Lifestyle' }],
  [/matka|lento|hotell|reissu/, { label: 'matkailu', pred: (t) => t.c === 'Travel', lever: 'Travel' }],
  [/bussi|hsl|metro|ratikka|juna|julkinen|joukkoliik/, { label: 'julkinen liikenne', pred: (t) => t.mcc === 4111 }],
  [/bensa|polttoaine|tankka|diesel/, { label: 'polttoaine', pred: (t) => t.mcc === 5541 || t.mcc === 5542 }],
  [/pysäk|parkki/, { label: 'pysäköinti', pred: (t) => t.mcc === 7523 }],
  [/liikku|liikenne|autoon|kulkemi/, { label: 'liikkuminen', pred: (t) => t.c === 'Transportation' }],
  [/lääkär|apteek|terve|hammas/, { label: 'terveys', pred: (t) => t.c === 'Health' }],
  [/vuokra|asumi/, { label: 'vuokra', pred: (t) => t.c === 'Housing' }],
  [/sähkö|lasku|netti|vesi/, { label: 'asumisen laskut', pred: (t) => t.c === 'Utilities' }],
  [/suoratoist|striimi|netflix|spotify|tilau/, { label: 'tilaukset', pred: (t) => t.c === 'Subscriptions', lever: 'Streaming' }],
  [/elektroni|tekniik|puhelin|tietokone|koti/, { label: 'koti ja tekniikka', pred: (t) => t.c === 'Home & Tech', lever: 'HomeTech' }],
];

export function matchCat(s: string): CatMatch | null {
  const t = norm(s);
  for (const [re, c] of CAT_WORDS) if (re.test(t)) return c;
  return null;
}

/** "ravintoloita 30 % ja takseja 50 %" -> { Restaurants: 30, Taxi: 50 } */
export function parseWhatIf(s: string): Partial<Record<LeverKey, number>> {
  const out: Partial<Record<LeverKey, number>> = {};
  const parts = norm(s).split(/,| ja | sekä |;/);
  for (const p of parts) {
    const c = matchCat(p);
    if (!c?.lever) continue;
    const pct = parsePercent(p);
    if (pct != null) out[c.lever] = Math.min(100, pct);
    else if (/lopet|luovu|kokonaan|pois/.test(p)) out[c.lever] = 100;
    else if (/puolit/.test(p)) out[c.lever] = 50;
  }
  return out;
}
