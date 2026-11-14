import {
  anomalies,
  BALANCE_NOW,
  baskets,
  eur,
  eur0,
  habits,
  incomeMonthly,
  labelOf,
  lastMonths,
  merchantName,
  monthlyAvg,
  nextSalaryDate,
  PEER,
  PEER_GROUP,
  PEER_N,
  recurring,
  safeToSpend,
  spenderType,
  TODAY,
  topSinks,
  txs,
  addDays,
} from '../finance/analytics';
import { BASKET_FI, basketOf, CAT_FI, LEVER_FI, LeverKey } from '../finance/categories';
import { simulate } from '../finance/forecast';
import { optimize } from '../finance/optimizer';
import { getScenarios, upsertScenario } from '../finance/insights';
import { ICON_NAMES } from '../icons/registry';
import type { AgentCtx, Card } from './types';
import { customerUnderstanding } from '../finance/customerUnderstanding';
import { referenceBudget, REFERENCE_BUDGETS } from './referenceBudgets';

/**
 * Per Tieerin työkalut mallille (OpenAI Responses API, function tools).
 * Kaikki luvut lasketaan laitteella sovelluksen omilla talousfunktioilla → malli ei keksi lukuja.
 * show_* -työkalut lisäävät vastaukseen React-visualisoinnin (Card), suggest_followups ehdotuspillerit.
 */

const LEVERS = Object.keys(LEVER_FI) as LeverKey[];
const CATS = Object.keys(CAT_FI);
const END = '2026-12-31';

const iconProp = { type: 'string', enum: ICON_NAMES, description: 'S-mobiilin ikoni, joka sopii asiaan (esim. ravintola, suoratoisto, varoitus, saasto, palkkapaiva, tavoite, onnistui)' };
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false });
const changesSchema = {
  type: 'object',
  description: `Kulutusmuutokset prosentteina per vipu, negatiivinen = vähennys (esim. {"Restaurants": -30}). Vivut: ${LEVERS.map((k) => `${k} (${LEVER_FI[k]})`).join(', ')}`,
  properties: Object.fromEntries(LEVERS.map((k) => [k, { type: 'number' }])),
  additionalProperties: false,
};

export const TOOL_DEFS = [
  { name: 'calculate', description: 'Laske työkalujen palauttamista luvuista tai asiakkaan antamista oletuksista summa, erotus, tulo tai osamäärä. Ei hae dataa eikä keksi lähtöarvoja.', parameters: obj({ operation: { type: 'string', enum: ['sum', 'subtract', 'multiply', 'divide'] }, values: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 100 }, explanation: { type: 'string', description: 'Mistä luvut tulivat ja mitä tulos tarkoittaa?' } }, ['operation', 'values', 'explanation']) },
  { name: 'get_reference_budget', description: 'Takuusäätiön, Marttojen ja Kuluttajatutkimuskeskuksen vuoden 2025 ruoan viitebudjetit 14 esimerkkitaloudelle. Kohtuullinen minimi, EI väestökeskiarvo. Ilman group-arvoa listaa vaihtoehdot. Vain vahvistetulle sopivalle yksinasujalle suuntaa antava rinnastus omiin ruokakauppaostoihin; muille taustaluku ja lähdelinkki.', parameters: obj({ group: { type: 'string', enum: REFERENCE_BUDGETS.map(r => r[0]) }, confirmedExample: { type: 'boolean', description: 'true vain, jos asiakas itse vahvisti esimerkkiryhmän sopivuuden (myös elämäntilanne). Älä päättele sukupuolta, työtä tai kotitaloutta.' } }) },
  { name: 'get_customer_understanding', description: 'Valitun asiakkaan kokonaiskuva: lähde ja havaintojakso, tilit ja saldot, palkka ja muut tulot erikseen, kulutus, säästösiirrot, lainahakemus, puuttuvat tiedot. Maksujen metadataan ja aikarytmiin perustuvat toistuvat/kertaluonteiset/epävarmat maksukuviot perusteluineen. Aloita tästä kokonaisarvio, jatkuvien maksujen selvitys tai henkilökohtaisen ilmiön opetus.', parameters: obj({ months: { type: 'integer', minimum: 1, maximum: 24 }, search: { type: 'string', description: 'Kauppiastunnus, alkuperäinen kategoria, maksutyyppi tai MCC-koodi' } }) },
  { name: 'get_overview', description: 'Tilin saldo, keskimääräiset kuukausitulot, seuraava palkkapäivä, turvallinen käyttövara palkkapäivään asti ja rahankäyttäjätyyppi.', parameters: obj({}) },
  {
    name: 'get_baskets',
    description: 'Kolme rahakoria (pakolliset säännölliset, pakolliset epäsäännölliset, arjen lipsuvat): €/kk, osuus tuloista, suurimmat erät ja paljonko jää käteen.',
    parameters: obj({ months: { type: 'integer', description: 'tarkastelujakso kuukausina, oletus 6' } }),
  },
  {
    name: 'get_spending',
    description: 'Asiakkaan OMAT menot kategorioittain €/kk (keskiarvo). Ei väestövertailua: muihin suomalaisiin vertailu tehdään compare_finland-työkalulla. Jos category annetaan, myös suurimmat kauppiaat ja ostokertojen määrä.',
    parameters: obj({ months: { type: 'integer', description: 'oletus 3' }, category: { type: 'string', enum: CATS, description: 'valinnainen kategoria' } }),
  },
  { name: 'get_top_sinks', description: 'Suurimmat "lipsuvat" kulutuskohteet: €/kk, €/vuosi, kertaa kuussa, keskiostos.', parameters: obj({ months: { type: 'integer', description: 'oletus 3' } }) },
  { name: 'get_recurring', description: 'Toistuvat maksut: vuokra, laskut, tilaukset (suoratoisto ym.), tavat; hinnanmuutokset ja epäilyttävät veloitukset.', parameters: obj({}) },
  { name: 'get_anomalies', description: 'Poikkeamat ja epäselvyydet: puuttuva vuokra, tuntemattomat tulot, kalliit/hiljaiset kuukaudet, epäilyttävät veloitukset.', parameters: obj({}) },
  { name: 'get_habits', description: 'Rahankäyttötavat: palkkapäiväefekti, pienostokset, yöostokset, viikonpäivät, rahankäyttäjätyyppi.', parameters: obj({}) },
  {
    name: 'get_transactions',
    description: 'Yksittäiset tilitapahtumat (uusimmat ensin).',
    parameters: obj({
      days: { type: 'integer', description: 'kuinka monta päivää taaksepäin, oletus 30' },
      category: { type: 'string', enum: CATS },
      search: { type: 'string', description: 'hakusana kauppiaan/kategorian nimestä' },
      limit: { type: 'integer', description: 'oletus 20, max 60' },
    }),
  },
  {
    name: 'forecast_balance',
    description: 'Saldoennuste (Monte Carlo omista tapahtumista): mediaani ja vaihteluväli, alin kohta, miinuksen todennäköisyys. Tukee mitä jos -muutoksia, kuukausisäästöä ja kertaostosta.',
    parameters: obj({
      until: { type: 'string', description: `päivämäärä YYYY-MM-DD, oletus ${END}` },
      changes: changesSchema,
      monthly_saving: { type: 'number', description: '€/kk säästöön palkkapäivänä' },
      one_off: obj({ date: { type: 'string' }, amount: { type: 'number', description: 'meno euroina (positiivinen)' }, label: { type: 'string' } }, ['date', 'amount']),
    }),
  },
  {
    name: 'plan_savings',
    description: 'Optimoi säästösuunnitelman kuukausitavoitteelle: mistä kannattaa tinkiä ja kuinka paljon (huomioi käyttäjän suojatut kohteet).',
    parameters: obj({ monthly_target: { type: 'number', description: '€/kk' } }, ['monthly_target']),
  },
  // ---- visualisoinnit ----
  {
    name: 'show_baskets',
    description: 'VISUAALI: Per Tieeri lajittelee asiakkaan oikeat tapahtumat kolmeen rahakoriin (animaatio) ja korit täyttyvät. months=1 = viimeisin kuukausi, 6 = kuuden kuukauden keskiarvo (oletus).',
    parameters: obj({ months: { type: 'integer', description: 'jakson pituus kuukausina 1–12' } }),
  },
  { name: 'show_money_blocks', description: 'VISUAALI: "mihin viimeiset 1 000 € menivät" – 100 kolikon ruudukko kategorioittain.', parameters: obj({}) },
  {
    name: 'show_forecast',
    description: 'VISUAALI: saldoennusteen käyrä vaihteluvälillä. Jos changes/monthly_saving/one_off annetaan, näytetään vertailu nykytahtiin.',
    parameters: obj({ title: { type: 'string' }, until: { type: 'string' }, changes: changesSchema, monthly_saving: { type: 'number' }, one_off: obj({ date: { type: 'string' }, amount: { type: 'number' }, label: { type: 'string' } }, ['date', 'amount']) }),
  },
  { name: 'show_whatif', description: 'VISUAALI: pysyvän nimetyn mitä jos -skenaarion liukusäätimet. Säilyttää aiemmat muutokset ja ostokset. Negatiivinen prosentti vähentää menoja.', parameters: obj({ name: { type: 'string', description: 'Aiemman skenaarion nimi tai uuden kokeilun nimi.' }, changes: changesSchema }) },
  {
    name: 'show_category_bars',
    description: 'VISUAALI: käyttäjän menot ja SYNTEETTISEN S-Pankin aineiston mediaanit. Vain kun käyttäjä pyytää tätä demoaineistoa. Muut suomalaiset tai samanikäiset yleisesti: compare_finland.',
    parameters: obj({ months: { type: 'integer' }, title: { type: 'string' } }),
  },
  {
    name: 'show_list',
    description: 'VISUAALI: siisti lista (esim. tilaukset, suurimmat kohteet). Käytä vain työkaluilla haettuja lukuja.',
    parameters: obj(
      {
        title: { type: 'string' },
        icon: iconProp,
        items: {
          type: 'array',
          items: obj({ label: { type: 'string' }, value: { type: 'string' }, sub: { type: 'string' }, tone: { type: 'string', enum: ['good', 'warn', 'bad'] }, icon: iconProp }, ['label', 'value']),
        },
      },
      ['title', 'items'],
    ),
  },
  {
    name: 'show_stat',
    description: 'VISUAALI: yksi iso avainluku (esim. turvallinen käyttövara tällä viikolla).',
    parameters: obj({ label: { type: 'string' }, value: { type: 'string' }, sub: { type: 'string' }, tone: { type: 'string', enum: ['good', 'warn', 'bad'] }, icon: iconProp }, ['label', 'value']),
  },
  {
    name: 'react',
    description:
      'Per Tieerin hahmon tunnereaktio (hahmo näyttää asennon animoituna). EI herkästi: älä kutsu tavallisissa vastauksissa. Kutsu vain, kun viestillä on selvä tunnesävy (tervehdys, hieno uutinen, hauska asia, huolestuttava luku, ikävä uutinen, yllättävä havainto). ' +
      'tervetuloa=kohtelias tervehdys · vilkuttaa=hei/heippa · vilkuttaa-iloisesti=iloinen tervehdys · nauraa=hauska, iloinen · innostunut=hieno uutinen, tavoite saavutettu · ' +
      'esittelee="katsokaa tätä", tulosten esittely · osoittaa=vinkki, "tässä kohtaa kannattaa" · huomio=tärkeä huomio, varoitus lempeästi · kuiskaa=pieni salaisuus, nokkela niksi · ' +
      'mietteliaas=pohdinta · hammentynyt=epäselvä kysymys, ei ymmärrä · yllattynyt=yllättävä havainto · liikuttunut=kiitos, lämmin hetki · huolestunut=huolestuttava luku · ' +
      'surullinen=ikävä uutinen · narkastynyt=kuiva paheksunta (esim. digipankin liiallinen helppous) · vihainen=VAIN leikillinen närkästys, ei koskaan asiakasta kohtaan · nolo=Per Tieeri erehtyi tai on vaatimaton · perus=neutraali',
    parameters: obj(
      { emotion: { type: 'string', enum: ['perus', 'tervetuloa', 'vilkuttaa', 'vilkuttaa-iloisesti', 'nauraa', 'innostunut', 'esittelee', 'osoittaa', 'huomio', 'kuiskaa', 'mietteliaas', 'hammentynyt', 'yllattynyt', 'liikuttunut', 'huolestunut', 'surullinen', 'narkastynyt', 'vihainen', 'nolo', 'sivuilla'] } },
      ['emotion'],
    ),
  },
  {
    name: 'suggest_followups',
    description: 'Ehdota 2–4 lyhyttä jatkokysymystä käyttäjän suulla (näytetään painikkeina). Kutsu aina vastauksen lopuksi.',
    parameters: obj({ questions: { type: 'array', items: { type: 'string' } } }, ['questions']),
  },
].map((t) => ({ type: 'function' as const, strict: false, ...t }));

export type ToolOutput = { result: unknown; card?: Card; chips?: string[]; mood?: string };

const pct = (x: number) => `${Math.round(x * 100)} %`;
const leverMult = (changes?: Record<string, number>) => {
  if (!changes) return undefined;
  const out: Partial<Record<LeverKey, number>> = {};
  for (const [k, v] of Object.entries(changes)) if (LEVERS.includes(k as LeverKey)) out[k as LeverKey] = Math.max(0, 1 + v / 100);
  return out;
};

function sim(ctx: AgentCtx, a: any) {
  return simulate({
    until: a.until && /^\d{4}-\d{2}-\d{2}$/.test(a.until) && a.until > TODAY ? a.until : END,
    rentDelta: ctx.profile.rentDelta,
    incomeDelta: ctx.profile.incomeDelta,
    leverMult: leverMult(a.changes),
    monthlySaving: a.monthly_saving,
    oneOffs: a.one_off ? [{ date: a.one_off.date, amount: a.one_off.amount, label: a.one_off.label }] : undefined,
  });
}
const simSummary = (s: ReturnType<typeof simulate>) => {
  const end = s.dates[s.dates.length - 1] ?? TODAY;
  const days = Math.round((Date.parse(end) - Date.parse(TODAY)) / 86400000);
  const spread = s.end.p90 - s.end.p10;
  // epävarmuuden suuruus päätellään vaihteluvälistä ja ennustejakson pituudesta (ei kiinteää vastausta)
  const level = days > 60 || spread > 1500 ? 'suuri' : days > 21 || spread > 500 ? 'kohtalainen' : 'pieni';
  return {
    ennustejakso: `${TODAY} – ${end} (${days} päivää eteenpäin)`,
    jos_jatkuu_samalla_tavalla_noin: eur0(s.end.p50),
    todennakoinen_vaihteluvali: `${eur0(s.end.p10)} – ${eur0(s.end.p90)}`,
    epavarmuus: level,
    alin_saldo_noin: eur0(s.min50),
    alin_paiva: s.minDate,
    miinuksen_todennakoisyys: pct(s.probNegative),
    saastoon_siirretty: eur0(s.saved),
    mihin_perustuu: s.assumptions,
    mita_ennuste_ei_tieda: [
      'tulevat kertaostokset ja yllätysmenot (esim. lahjat, matkat, korjaukset)',
      'tulojen muutokset (palkankorotus, työn loppuminen, lomarahat)',
      'asiakkaan omat suunnitelmat, joita ei näy tilitapahtumissa',
    ],
    tulkintaohje: 'Tämä on arvio "jos jatkatte kuten ennenkin", ei tieto tulevasta. Mitä pidemmälle ja mitä leveämpi vaihteluväli, sitä varovaisemmin. Kerro epävarmuus selkokielellä, anna arvio vaihteluvälinä ja kysy tarvittaessa asiakkaalta tiedossa olevat tulevat menot tai tulot. Älä käytä sanaa mediaani, ellei asiakas kysy sitä.',
  };
};

export function runTool(name: string, a: any, ctx: AgentCtx): ToolOutput {
  a = a || {};
  switch (name) {
    case 'calculate': {
      const values: number[] = a.values;
      if (!Array.isArray(values) || values.length < 2 || values.length > 100 || !values.every(Number.isFinite)) throw new Error('Laskenta tarvitsee 2–100 kelvollista lukua.');
      let value: number;
      if (a.operation === 'sum') value = values.reduce((x, y) => x + y);
      else if (a.operation === 'subtract') value = values.reduce((x, y) => x - y);
      else if (a.operation === 'multiply') value = values.reduce((x, y) => x * y);
      else if (a.operation === 'divide' && values.slice(1).every(v => v !== 0)) value = values.reduce((x, y) => x / y);
      else throw new Error('Tuntematon laskutoimitus tai jakaja on nolla.');
      if (!Number.isFinite(value)) throw new Error('Tulos ylittää laskimen rajat.');
      return { result: { value, operation: a.operation, values, explanation: a.explanation } };
    }
    case 'get_reference_budget':
      return referenceBudget(a, ctx);
    case 'get_customer_understanding':
      return { result: customerUnderstanding(a.months || 12, a.search || '') };
    case 'get_overview': {
      const s = safeToSpend();
      const st = spenderType();
      return {
        result: {
          paiva_tanaan: TODAY,
          huom: 'Saldo on aineiston viimeinen havainto. Palkkapäivä ja käyttövara ovat historiasta laskettuja arvioita, eivät varmistettuja tulevia maksuja. Kokonaiskattavuus ei ole tiedossa ilman asiakkaan vahvistusta.',
          saldo: eur(BALANCE_NOW),
          tulot_kk_keskiarvo_viim_6kk: eur0(incomeMonthly(6)),
          tulot_kk_keskiarvo_viim_12kk: eur0(incomeMonthly(12)),
          seuraava_palkka: nextSalaryDate(),
          turvallinen_kayttovara: {
            palkkapaivaan_paivia: s.days,
            vapaata_yhteensa: eur0(s.free),
            per_viikko: eur0(s.perWeek),
            per_paiva: eur0(s.perDay),
            varattu: { vuokra: eur0(s.rentDue), laskut: eur0(s.bills), ruoka: eur0(s.groceries), tilaukset: eur0(s.subs), puskuri_yllatyksiin: eur0(s.buffer) },
          },
          rahankayttajatyyppi: st.type,
          kuvaus: st.desc,
        },
      };
    }
    case 'get_baskets': {
      const b = baskets(a.months || 6);
      const k = (key: 'regular' | 'irregular' | 'slipping') => ({
        nimi: BASKET_FI[key],
        eur_kk: eur0(b.totals[key]),
        osuus_tuloista: pct(b.totals[key] / b.income),
        suurimmat: b.items[key].slice(0, 6).map((i) => `${i.label} ${eur0(i.amount)}/kk`),
      });
      return { result: { jakso_kk: b.months, tulot_kk: eur0(b.income), saannolliset: k('regular'), epasaannolliset: k('irregular'), lipsuvat: k('slipping'), jaa_kateen_kk: eur0(b.left) } };
    }
    case 'get_spending': {
      const n = Math.min(12, Math.max(1, a.months || 3));
      if (a.category) {
        const ms = lastMonths(n);
        const from = `${ms[0]}-01`;
        const list = txs().filter((t) => t.d >= from && t.a < 0 && t.c === a.category);
        const g: Record<string, { s: number; c: number }> = {};
        for (const t of list) {
          const l = labelOf(t);
          g[l] = g[l] || { s: 0, c: 0 };
          g[l].s -= t.a;
          g[l].c++;
        }
        return {
          result: {
            kategoria: CAT_FI[a.category] ?? a.category,
            eur_kk: eur0(monthlyAvg((t) => t.c === a.category, n)),
            ostoja_kk: Math.round((list.length / n) * 10) / 10,
            suurimmat: Object.entries(g)
              .sort((x, y) => y[1].s - x[1].s)
              .slice(0, 6)
              .map(([l, v]) => `${l}: ${eur0(v.s / n)}/kk (${v.c} kpl)`),
          },
        };
      }
      const rows = CATS.filter((c) => basketOf(c, null) !== null || c === 'Housing')
        .map((c) => ({ kategoria: CAT_FI[c], eur_kk: monthlyAvg((t) => t.c === c, n) }))
        .filter((r) => r.eur_kk > 1)
        .sort((x, y) => y.eur_kk - x.eur_kk)
        .map((r) => ({ kategoria: r.kategoria, eur_kk: eur0(r.eur_kk) }));
      return { result: { jakso_kk: n, kategoriat: rows, huom: 'Vertailu muihin: compare_peers (aineiston asiakkaat) tai compare_finland (Tilastokeskus).' } };
    }
    case 'get_top_sinks':
      return {
        result: topSinks(a.months || 3, 5).map((t) => ({
          kohde: t.label,
          eur_kk: eur0(t.monthly),
          eur_vuosi: eur0(t.yearly),
          kertaa_kk: Math.round(t.perMonthCount * 10) / 10,
          keskiostos: eur(t.avgTicket),
        })),
      };
    case 'get_recurring':
      return {
        result: recurring().map((r) => ({
          nimi: r.label,
          tyyppi: { rent: 'asumismaksu', bills: 'laskuryhmä', subscription: 'tilausehdokas', habit: 'toistuva asiointi' }[r.kind],
          eur_kk: eur(r.amount),
          paiva: r.day || undefined,
          hinnanmuutos: r.priceChange ? `${eur(r.priceChange.from)} → ${eur(r.priceChange.to)} (${r.priceChange.month})` : undefined,
          epailyttava: r.suspicious || undefined,
          demotieto: r.demo || undefined,
          perusteet: r.evidence,
          varmuus: r.confidence,
          rytmi: r.cadence,
          viime_aikoina_havaittu: r.active,
          huom: 'Havaittu kuukausikeskiarvo, ei vahvistettu tuleva lasku. Toistuminen ei yksin tarkoita tilausta.',
        })),
      };
    case 'get_anomalies':
      return { result: anomalies(ctx.answers).map((x) => ({ vakavuus: x.severity, otsikko: x.title, tiedot: x.detail, kysymys: x.question })) };
    case 'get_habits': {
      const h = habits();
      const st = spenderType();
      return {
        result: {
          jakso: `${lastMonths(6)[0]}-01–${TODAY}`,
          rajaus: 'Vain alustavasti joustaviin rahakoreihin luokitellut ostokset; ei kaikki kulutus. Palkkaviikko on toteutunutta palkkatuloa seuraavat 0–6 päivää. Kerro yhteys, älä oleta ostosten syytä.',
          tyyppi: st.type,
          kuvaus: st.desc,
          palkkaviikko_vs_muu_kerroin: Math.round(h.payRatio * 10) / 10,
          pienostokset_alle_15e_kk: `${eur0(h.smallPerMonth)} (${Math.round(h.smallCountPerMonth)} kpl)`,
          yoostokset_kk: `${eur0(h.nightPerMonth)} (${Math.round(h.nightCountPerMonth)} kpl)`,
          kallein_viikonpaiva: `${h.topWeekday} (${pct(h.topWeekdayShare)})`,
          viikonlopun_osuus: pct(h.weekendShare),
        },
      };
    }
    case 'get_transactions': {
      const from = addDays(TODAY, -Math.min(365, a.days || 30));
      const q = (a.search || '').toLowerCase();
      const list = txs()
        .filter((t) => t.d >= from && (!a.category || t.c === a.category) && (!q || `${merchantName(t)} ${CAT_FI[t.c] ?? t.c}`.toLowerCase().includes(q)))
        .reverse()
        .slice(0, Math.min(60, a.limit || 20));
      return { result: list.map((t) => ({ pvm: t.d, aika: t.t, kohde: merchantName(t), kauppiastunnus: t.m, mcc: t.mcc, maksutyyppi: t.ty, tili: t.account ?? null, saldo_jalkeen: t.b, kategoria: CAT_FI[t.c] ?? t.c, summa: eur(t.a), huom: 'Kohteen nimi on luokan kuvaus, ei tunnistettu yritys tai tuotetieto.' })) };
    }
    case 'forecast_balance': {
      const s = sim(ctx, a);
      const hasChange = a.changes || a.monthly_saving || a.one_off;
      return { result: hasChange ? { muutoksen_jalkeen: simSummary(s), nykytahdilla: simSummary(sim(ctx, { until: a.until })) } : simSummary(s) };
    }
    case 'plan_savings': {
      const p = optimize(Math.max(1, a.monthly_target || 100), ctx.prefs);
      return {
        result: {
          tavoite_kk: eur0(p.target),
          saavutettavissa: p.feasible,
          saasto_kk: eur0(p.total),
          toimet: p.items.map((i) => `${i.label}: −${i.pct} % (nyt ${eur0(i.base)}/kk) → säästö ${eur0(i.saving)}/kk. Vinkki: ${i.tip}`),
          suojatut_kohteet: p.excluded.map((k) => LEVER_FI[k]),
        },
      };
    }
    // ---- visualisoinnit ----
    case 'show_baskets': {
      const months = Math.min(12, Math.max(1, a.months || 6));
      const b = baskets(months);
      return {
        result: { naytetty: true, jakso_kk: months, saannolliset_kk: eur0(b.totals.regular), epasaannolliset_kk: eur0(b.totals.irregular), lipsuvat_kk: eur0(b.totals.slipping), tulot_kk: eur0(b.income), jaa_kateen_kk: eur0(b.left) },
        card: { kind: 'baskets', months },
      };
    }
    case 'show_money_blocks':
      return { result: { naytetty: true }, card: { kind: 'blocks' } };
    case 'show_forecast': {
      const hasChange = a.changes || a.monthly_saving || a.one_off;
      const base = sim(ctx, { until: a.until });
      const s = hasChange ? sim(ctx, a) : base;
      return {
        result: { naytetty: true, ...(hasChange ? { muutoksen_jalkeen: simSummary(s), nykytahdilla: simSummary(base) } : simSummary(base)) },
        card: hasChange
          ? { kind: 'forecast', title: a.title || 'Saldoennuste: nyt ja muutoksen jälkeen', sim: base, compare: s, baseLabel: 'Nykyinen tahti', compareLabel: 'Muutoksen jälkeen' }
          : { kind: 'forecast', title: a.title || 'Saldoennuste', sim: base },
      };
    }
    case 'show_whatif': {
      const name = a.name ?? Object.keys(getScenarios()).at(-1) ?? 'Oma kokeilu';
      const scenario = upsertScenario(name, { changes: a.changes });
      return { result: { naytetty: true, skenaario: scenario }, card: { kind: 'whatif', scenarioName: name } };
    }
    case 'show_category_bars': {
      // vertailu saman ikäryhmän MEDIAANIIN samalta 12 kk jaksolta (synteettinen aineisto)
      const cats = ['Restaurants', 'Groceries', 'Transportation', 'Entertainment', 'Lifestyle', 'Home & Tech', 'Health', 'Travel'];
      const rows = cats.map((c) => ({ key: c, label: CAT_FI[c].split(' ')[0], value: Math.round(monthlyAvg((t) => t.c === c, 12)), peer: PEER[c] })).filter((r) => r.value > 0 || r.peer);
      return {
        result: { naytetty: true, vertailuryhma: PEER_GROUP || 'ei saatavilla', tunnusluku: 'mediaani', jakso: 'viimeiset 12 kk', rivit: rows.map((r) => `${r.label}: ${r.value} €/kk (mediaani ${r.peer ?? '–'} €)`) },
        card: { kind: 'bars', title: a.title || 'Sinä vs. samanikäiset asiakkaat (€/kk)', rows, note: PEER_N ? `Viiva = ${PEER_GROUP} (${PEER_N} asiakasta), mediaani, 12 kk. Lähde: muut S-Pankin asiakkaat.` : 'Vertailuryhmä ei saatavilla.' },
      };
    }
    case 'show_list':
      return { result: { naytetty: true }, card: { kind: 'list', title: String(a.title || ''), icon: a.icon, items: (a.items || []).slice(0, 12) } };
    case 'show_stat':
      return { result: { naytetty: true }, card: { kind: 'stat', label: String(a.label || ''), value: String(a.value || ''), sub: a.sub, tone: a.tone, icon: a.icon } };
    case 'react':
      return { result: { ok: true }, mood: String(a.emotion || 'perus') };
    case 'suggest_followups':
      return { result: { ok: true }, chips: (a.questions || []).map((q: unknown) => String(q)).filter(Boolean).slice(0, 4) };
    default:
      return { result: { virhe: `tuntematon työkalu ${name}` } };
  }
}

