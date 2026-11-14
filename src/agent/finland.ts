import { getJson } from '../data/api';
import { CUSTOMER, lastMonths, monthlyAvg, TODAY, txs } from '../finance/analytics';
import { CAT_FI } from '../finance/categories';
import type { AgentCtx, Card } from './types';

export const FINLAND_CATEGORIES = ['Groceries', 'Restaurants', 'Transportation', 'Health', 'Entertainment', 'Home & Tech', 'Lifestyle', 'Travel', 'Housing', 'Utilities'];
type Category = { quality: string; why: string; coicop?: string[]; household_month?: number | null };
type Consumption = {
  source: string; table: string; url: string; source_url: string; year: number; household_type: string;
  statistic: string; fetched_at: string; from_cache: boolean; stale: boolean; categories: Record<string, Category>;
};
type Income = {
  source: string; table: string; url: string; year: number; age_group: string; statistic: string;
  median_month: number | null; mean_month: number | null; fetched_at: string; from_cache: boolean; stale: boolean;
};
type Args = { kind: 'consumption' | 'income'; categories?: string[]; group?: 'household' | 'age' | 'quintile' | 'all'; quintile?: number; age?: number };
const round = (n: number) => Math.round(n * 100) / 100;
const amount = (n: number) => `${n.toLocaleString('fi-FI', { maximumFractionDigits: 2 })} €/kk`;
const ageCode = (age: number) => age < 25 ? '17-24' : age < 35 ? '25-34' : age < 45 ? '35-44' : age < 55 ? '45-54' : age < 65 ? '55-64' : age < 75 ? '65-74' : age < 85 ? '75-84' : '85-';

/** Viralliset luvut näytetään erillään tililuvuista, kun vertailuyksikköä ei voida vahvistaa. */
export async function compareFinland(a: Args, ctx: AgentCtx): Promise<{ result: unknown; card?: Card }> {
  // Asiakas voi vaihtua verkkopyynnön aikana: pidä koko tulos saman asiakkaan tiedoissa.
  const customer = { ...CUSTOMER };
  const profile = { ...ctx.profile };
  const transactions = txs();
  const ownMonthly = Object.fromEntries(FINLAND_CATEGORIES.map(cat => [cat, round(monthlyAvg(t => t.c === cat, 12))]));
  const months = lastMonths(12);
  const from = `${months[0]}-01`;
  const period = `${from}–${TODAY}`;
  const blocked = (reason: string, question?: string) => ({ result: {
    lahde: 'Tilastokeskus / StatFin', ei_vertailua: true, syy: reason, tarkentava_kysymys: question,
    ohje: 'Tilastokeskuksen lukua ei saatu. Älä keksi väestölukua. Jos asiakas haluaa silti vertailun, käytä compare_peers (S-Pankin synteettinen Junction 2026 -aineisto GitHubista, 5 100 asiakasta) ja sano selvästi, että vertailu on vain aineiston asiakkaisiin, ei Suomen väestöön.',
  } });

  try {
    if (a.kind === 'income') {
      // kysytty ikä (esim. "18-vuotiaiden mediaani") tai asiakkaan oma ikä
      const askedAge = Number.isFinite(Number(a.age)) && Number(a.age) >= 18 ? Math.round(Number(a.age)) : customer.age;
      const s = await getJson<Income>(`/api/statfin/income?years=${askedAge}`);
      if (!Number.isFinite(s.median_month)) return blocked('Tulotilaston mediaani puuttuu; puuttuva luku ei ole nolla.');
      const note = 'Tilasto: henkilökohtainen rahatulo, kotitalouskohtaisia tuloeriä ei jaettu henkilöille. Pankkiaineisto: palkka ja muut tulot tälle tilille. Eri ajanjaksot; ei palkkavertailu.';
      const own = round(transactions.filter(t => t.d >= from && t.d <= TODAY && t.a > 0 && (t.ty === 'salary' || t.ty === 'other_income')).reduce((sum, t) => sum + t.a, 0) / 12);
      const comparable = profile.incomeComplete === true;
      const result = {
        lahde: s.source, taulukko: s.table, rajapinta: s.url, tilastovuosi: s.year,
        vertailuryhma: `Asuntoväestö, ${s.age_group}-vuotiaat`, yksikko: '€/kk, vuositulo jaettuna 12:lla',
        tunnusluku: s.statistic, mediaani_kk: s.median_month, keskiarvo_kk: s.mean_month,
        oma_jakso: period, asiakkaan_tulot_kk: comparable ? own : undefined,
        vertailukelpoisuus: comparable ? 'suuntaa antava' : 'vain tilastotausta', selitys: note,
        tarkentava_kysymys: comparable ? undefined : 'Kattavatko tämän tilin palkka- ja muut tulot kaikki henkilökohtaiset nettotulonne ilman omia tilisiirtoja tai lainanostoja?',
        haettu: s.fetched_at, valimuistista: s.from_cache, vanhentunut_valimuisti: s.stale,
        ohje: 'Taustatilastoa ei saa muuttaa käyttäjään vertaavaksi kaavioksi ilman vahvistusta. Suurempi luku ei tarkoita parempaa taloudenhoitoa.',
      };
      const cacheNote = s.stale ? ' Viimeisin tallennettu haku; päivitys ei onnistunut.' : '';
      const card: Card = comparable ? {
        kind: 'compare', title: 'Tulot: suuntaa antava väestövertailu', origin: 'statfin',
        source: `${s.source}, ${s.table}`, group: result.vertailuryhma, statistic: 'mediaani',
        period: `tilasto ${s.year} · oma ${period}`, unit: '€/kk',
        rows: [{ key: 'palkka', label: 'Tilille tulleet tulot', user: own, ref: s.median_month }],
        note: `${note} Haettu ${s.fetched_at.slice(0, 10)}.${cacheNote}`,
      } : {
        kind: 'list', title: `Tilastokeskus · tulot ${s.year} (taustatieto)`, items: [
          { label: result.vertailuryhma, value: amount(s.median_month!), sub: `Mediaani. ${note}` },
          { label: 'Lähde: Tilastokeskus', value: '11py', sub: `${s.table} · ${s.url} · haettu ${s.fetched_at.slice(0, 10)}.${cacheNote}` },
        ],
      };
      return { result, card };
    }
    if (a.kind !== 'consumption') return blocked('Tuntematon vertailulaji.');
    const cats = a.categories === undefined ? FINLAND_CATEGORIES : a.categories;
    if (!Array.isArray(cats) || !cats.length || cats.some(c => !FINLAND_CATEGORIES.includes(c))) return blocked('Tuntematon tai tyhjä menoluokkavalinta.');
    const group = a.group ?? 'household';
    const hh = profile.household;
    let type: string;
    let apiGroup = group;
    let comparable = false;
    let reason: string;
    if (group === 'household') {
      const types: Record<string, string> = { yksin: '1', pari: '2', yksinhuoltaja: '3', lapsiperhe: '4', muu: '6' };
      if (!hh || !types[hh]) return blocked('Kotitaloustyyppi puuttuu. Tilasto kuvaa kotitaloutta, ei yksittäistä tiliä.', 'Asutteko yksin vai jaatteko talouden muiden kanssa?');
      // Yli 64-vuotiaiden ryhmä sisältää erikokoisia talouksia, joten sitä ei rinnasteta yksin asuvaan.
      // 14ph:n alaviite: parilla molemmat <65; vanhustaloudessa KAIKKI >=65.
      // Perheryhmien lapset ovat alle 25-vuotiaita huollettavia. Viitehenkilön ikä ei ratkaise näitä.
      if (hh === 'yksin') type = customer.age >= 65 ? '5' : '1';
      else if (hh === 'pari') {
        if (profile.partnerAge === undefined) return blocked('Parien tilastoryhmä edellyttää molempien ikien tuntemista.', 'Minkä ikäinen puolisonne on? Voimme myös katsoa kaikkien kotitalouksien tilastotaustaa.');
        type = customer.age < 65 && profile.partnerAge < 65 ? '2' : customer.age >= 65 && profile.partnerAge >= 65 ? '5' : '6';
      } else if (hh === 'lapsiperhe' || hh === 'yksinhuoltaja') {
        if (profile.dependentChildrenUnder25 !== true) return blocked('Perhetilaston lapset ovat alle 25-vuotiaita huollettavia; tätä ei tiedetä.', 'Onko taloudessanne alle 25-vuotiaita huollettavia lapsia?');
        type = types[hh];
      } else {
        if (customer.age >= 65 && profile.allMembers65Plus === undefined) return blocked('Vanhempien kotitalouksien ryhmä edellyttää kaikkien jäsenten ikärajan tuntemista.', 'Ovatko kaikki kotitaloutenne jäsenet täyttäneet 65 vuotta?');
        type = customer.age >= 65 && profile.allMembers65Plus === true ? '5' : '6';
      }
      comparable = hh === 'yksin' && customer.age < 65 && profile.expensesComplete === true;
      reason = hh !== 'yksin' ? 'Yhden henkilön maksut eivät ole koko kotitalouden kulutus. Luvut näytetään vain tilastotaustana.'
        : customer.age >= 65 ? 'Yli 64-vuotiaiden tilastoryhmässä on erikokoisia kotitalouksia. Se ei ole yksin asuvien ryhmä.'
        : 'Kotitalous on yhden hengen talous. Tilin kattavuus on vahvistettava ennen rinnakkaista vertailua.';
    } else if (group === 'age') {
      type = ageCode(customer.age);
      reason = 'Ikä tarkoittaa kotitalouden viitehenkilön ikää. Ryhmässä on erikokoisia kotitalouksia: ei yksilöiden tai yksin asuvien kulutusvertailua.';
    } else if (group === 'quintile') {
      if (!Number.isInteger(a.quintile) || a.quintile! < 1 || a.quintile! > 5) return blocked('Valitse taustatiedon tuloviidennes 1–5. Asiakkaan tuloviidennestä ei päätellä tilille tulleista tuloista.');
      type = String(a.quintile);
      reason = 'Tuloviidennes on kotitalouden kulutusyksikkökohtaisen käytettävissä olevan tulon ryhmä. Asiakkaan kuulumista tähän ryhmään ei ole päätelty.';
    } else if (group === 'all') {
      type = 'SSS'; apiGroup = 'household';
      reason = 'Kaikkien kotitalouksien keskiarvo ei vastaa yhden henkilön pankkitilin menoja.';
    } else return blocked('Tuntematon vertailuryhmä.');

    const s = await getJson<Consumption>(`/api/statfin/consumption?type=${type}&group=${apiGroup}`);
    const entries = [...new Set(cats)].map(cat => ({ cat, stat: s.categories[cat] }));
    const eligible = entries.filter(({ stat }) => stat && stat.quality !== 'ei' && Number.isFinite(stat.household_month));
    const excluded = entries.filter(e => !eligible.includes(e)).map(({ cat, stat }) => ({ luokka: CAT_FI[cat], syy: stat?.quality === 'ei' ? stat.why : 'Tilastoluku puuttuu; puuttuva tieto ei ole nolla.' }));
    if (!eligible.length) return { result: { ...blocked('Valituille menoluokille ei ole riittävän vastaavaa tilastomittaria.').result, pois_jatetyt: excluded } };
    const note = `Suuntaa antavat menoluokat. Tilasto on vuoden ${s.year} käyvin hinnoin, ei nykyhinnoin; lukuja ei ole inflaatiokorjattu. Tilastokeskiarvo ei ole kulutustavoite.`;
    const cacheNote = s.stale ? ' Päivitys ei onnistunut; käytössä viimeisin tallennettu haku.' : '';
    const result = {
      lahde: s.source, taulukko: s.table, lahdelinkki: s.source_url, rajapinta: s.url,
      tilastovuosi: s.year, vertailuryhma: s.household_type, tunnusluku: 'keskiarvo', yksikko: '€/kotitalous/kk',
      oma_jakso: period, vertailukelpoisuus: comparable ? 'suuntaa antava' : 'vain tilastotausta',
      selitys: comparable ? 'Asiakas vahvisti yksin asumisen ja tilin kattavan kotitalouden kaikki menot. Luokittelu ja ajanjakso eroavat silti.' : reason,
      tarkentava_kysymys: group === 'household' && hh === 'yksin' && customer.age < 65 && profile.expensesComplete !== true
        ? 'Näkyvätkö tällä tilillä kaikki kotitaloutenne menot, myös muiden korttien ja tilien kautta maksetut?' : undefined,
      luokittain: eligible.map(({ cat, stat }) => ({ luokka: CAT_FI[cat], tilasto_kk: stat.household_month, asiakas_kk: comparable ? ownMonthly[cat] : undefined, coicop: stat.coicop, rajaus: stat.why })),
      pois_jatetyt: excluded, hintataso: note, haettu: s.fetched_at, valimuistista: s.from_cache, vanhentunut_valimuisti: s.stale,
      ohje: comparable ? 'Selitä rajaukset. Suurempi kulutus ei itsessään tarkoita huonoa rahankäyttöä. Tarjoa oman kulutuksen erittelyä tai kuukausikehitystä.' : 'Älä laske eroa tai piirrä omaa tiliä näiden lukujen rinnalle show_chart-työkalulla. Älä korvaa vertailua synteettisillä asiakkailla.',
    };
    const card: Card = comparable ? {
      kind: 'compare', title: 'Kulutus: suuntaa antava väestövertailu', origin: 'statfin',
      source: `${s.source}, ${s.table}`, group: s.household_type, statistic: 'keskiarvo (€/kotitalous/kk)',
      period: `tilasto ${s.year} · oma ${period}`, unit: '€/kk',
      rows: eligible.map(({ cat, stat }) => ({ key: cat, label: CAT_FI[cat], user: ownMonthly[cat], ref: stat.household_month!, note: stat.why })),
      note: `${note} Haettu ${s.fetched_at.slice(0, 10)}.${cacheNote}`,
    } : {
      kind: 'list', title: `Tilastokeskus · kulutus ${s.year} (taustatieto)`,
      items: [
        ...eligible.map(({ cat, stat }) => ({ label: CAT_FI[cat], value: amount(stat.household_month!), sub: `${s.household_type} · keskiarvo/kotitalous. ${stat.why}` })),
        { label: 'Vertailun rajaus', value: 'Ei suoraa vertailua', sub: `${reason} ${note}` },
        { label: 'Lähde: Tilastokeskus', value: s.table.split(' / ').at(-1)!, sub: `${s.source_url} · haettu ${s.fetched_at.slice(0, 10)}.${cacheNote}` },
      ],
    };
    return { result, card };
  } catch {
    return blocked('Tilastokeskuksen tietoja ei saatu rajapinnasta eikä käyttökelpoisesta välimuistista. Vertailulukuja ei näytetä. Yritä myöhemmin uudelleen.');
  }
}
