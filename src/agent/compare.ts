import { getJson } from '../data/api';
import { addDays, BALANCE_NOW, eur, eur0, labelOf, merchantName, MORTGAGE, safeToSpend, TODAY, txs } from '../finance/analytics';
import { CAT_FI } from '../finance/categories';
import { compareFinland, FINLAND_CATEGORIES } from './finland';
import type { AgentCtx, Card } from './types';
import { buildChart } from './chartChoice';

/**
 * Per Tieerin vertailu- ja hakutyökalut, jotka tarvitsevat palvelinta tai laajempaa laskentaa.
 *
 * KAKSI ERILLISTÄ VERTAILUTASOA – ei koskaan sekoiteta:
 *  1) compare_peers   = muut S-Pankin SYNTEETTISEN aineiston asiakkaat (5 100), sama 12 kk jakso, mediaani + kvartiilit
 *  2) compare_finland = Tilastokeskus (StatFin, PxWeb-rajapinta), Suomen väestö: kulutustutkimus (keskiarvo)
 *                       ja tulonjakotilasto (mediaani). Vain vertailukelpoiset luokat ja oikea vertailuyksikkö.
 */

const CATS = ['Groceries', 'Restaurants', 'Transportation', 'Health', 'Entertainment', 'Home & Tech', 'Lifestyle', 'Travel', 'Housing', 'Utilities'];
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false });

export const ASYNC_TOOL_DEFS = [
  {
    name: 'query_transactions',
    description:
      'Laske asiakkaan omista tapahtumista summa, määrä ja kuukausittainen erittely millä tahansa rajauksella (esim. taksit viimeisen vuoden aikana, kaikki Prisma-ostot, palkat). Käytä aina kun kysytään "paljonko käytin/sain X:ään aikana Y".',
    parameters: obj({
      from: { type: 'string', description: 'alkupäivä YYYY-MM-DD (oletus 12 kk taaksepäin)' },
      to: { type: 'string', description: `loppupäivä YYYY-MM-DD (oletus ${TODAY})` },
      category: { type: 'string', enum: Object.keys(CAT_FI), description: 'pankkiaineiston kategoria' },
      mcc: { type: 'integer', description: 'kauppiasluokka (esim. 4121 = taksit, 5411 = ruokakaupat, 5812 = ravintolat, 5814 = pikaruoka)' },
      search: { type: 'string', description: 'hakusana kauppiaan/kauppiasluokan nimestä (esim. "taksi")' },
      direction: { type: 'string', enum: ['menot', 'tulot', 'kaikki'], description: 'oletus menot' },
    }),
  },
  {
    name: 'monthly_series',
    description:
      'Kuukausittainen aikasarja asiakkaan omista tapahtumista (kehitys, muutokset, "viime kuu vs. edellinen", trendit). metric: spend=kaikki menot, income=tulot, balance=kuun lopun saldo, net=tulot−menot, tai rajaa category/mcc/search. Palauttaa luvut, joista voit tehdä show_chart-kaavion.',
    parameters: obj({
      months: { type: 'integer', description: 'kuinka monta kuukautta taaksepäin (1–24), oletus 6' },
      metric: { type: 'string', enum: ['spend', 'income', 'balance', 'net'], description: 'oletus spend' },
      category: { type: 'string', enum: Object.keys(CAT_FI) },
      mcc: { type: 'integer' },
      search: { type: 'string' },
    }),
  },
  {
    name: 'show_chart',
    description:
      'Näytä suuri kaavio ja tarkat luvut. KÄYTÄ VAIN työkaluilla haettuja/laskettuja lukuja. Asiakkaan pyytämä tyyppi asetetaan chart-kenttään; muuten chart=auto ja intent kertoo käyttötarkoituksen. trend=ajallinen kehitys (viiva), comparison=määrien vertailu (pylväät), composition=saman kokonaisuuden osuudet (ympyrä, enintään 6 osaa automaattivalinnassa). Älä lisää yhteensä-riviä ympyrän osaksi. Selitä kaavion tärkein havainto vastaustekstissä samalla kun kaavio rakentuu.',
    parameters: obj(
      {
        title: { type: 'string' },
        chart: { type: 'string', enum: ['auto', 'bar', 'line', 'pie'], description: 'Oletus auto. Käyttäjän täsmällinen toive ohittaa automaattivalinnan.' },
        intent: { type: 'string', enum: ['trend', 'comparison', 'composition'], description: 'Valitse tarkoitus itse kysymyksestä ja aineistosta.' },
        unit: { type: 'string', description: 'esim. €/kk, €, %' },
        labels: { type: 'array', items: { type: 'string' }, description: 'x-akselin nimet (esim. kuukaudet)' },
        series: { type: 'array', items: obj({ name: { type: 'string' }, values: { type: 'array', items: { type: 'number' } } }, ['name', 'values']) },
        note: { type: 'string', description: 'lähde/selite yhdellä rivillä' },
        icon: { type: 'string' },
      },
      ['title', 'unit', 'labels', 'series'],
    ),
  },
  {
    name: 'show_cashflow',
    description:
      'VISUAALI ja laskelma: miksi koko tilin saldo ei ole käytettävissä – saldo → tulevat pakolliset menot ja varaus yllätyksiin → turvallinen käyttövara palkkapäivään asti. Hyvä opetusväline käyttövarasta ja kassavirrasta.',
    parameters: obj({}),
  },
  {
    name: 'compare_peers',
    description:
      'Vain erikseen pyydetty vertailu S-Pankin SYNTEETTISEN aineiston asiakkaisiin, EI Suomen väestöä. Tavalliseen kysymykseen muista suomalaisista tai samanikäisistä käytä compare_finland. Kaikki samalta 12 kk jaksolta. Palauttaa mediaanin, kvartiilit ja ryhmän koon. Näyttää kaavion.',
    parameters: obj(
      {
        metrics: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['income', 'spend_total', 'saved', 'savings_rate', 'balance_change', 'taxi', ...CATS.map((c) => 'cat:' + c)],
          },
          description: 'income=tulot €/kk, spend_total=kulutus €/kk, saved=säästöön/sijoituksiin €/kk, savings_rate=(tulot−kulutus)/tulot, balance_change=tilin saldon muutos 12 kk, taxi=taksit €/kk, cat:X=kategorian menot €/kk',
        },
        group: { type: 'string', enum: ['age', 'all'], description: 'age = sama ikäryhmä (oletus), all = kaikki asiakkaat' },
      },
      ['metrics'],
    ),
  },
  {
    name: 'compare_finland',
    description:
      'ENSISIJAINEN vertailutyökalu kysymyksiin muihin suomalaisiin tai samanikäisiin verrattuna. Aidot Tilastokeskuksen tilastot ja välimuisti. kind=consumption: categories rajaa kysytyt menot; group=household (oletus), age (viitehenkilön ikä, vain taustatietoa), all (kaikki kotitaloudet, vain taustaa), quintile (valittu tuloviidennes, vain taustaa). kind=income: henkilökohtainen tulomediaani iän mukaan. Tarkistaa vertailukelpoisuuden ja palauttaa tarvittavan lisäkysymyksen. Tekee itse kaavion tai taustatietokortin. Mediaani- ja keskiarvokysymykset Suomesta haetaan AINA ensin täältä. Jos Tilastokeskuksen lukua ei saada (ei_vertailua), vertaa vain S-Pankin GitHub-aineiston asiakkaisiin compare_peers-työkalulla ja kerro lähde selvästi.',
    parameters: obj({
      kind: { type: 'string', enum: ['income', 'consumption'] },
      categories: { type: 'array', items: { type: 'string', enum: FINLAND_CATEGORIES }, description: 'Vain kysytyt kulutusluokat; esim. ruoka = Groceries. Ei rajauksen ulkopuolisia kaavioita.' },
      group: { type: 'string', enum: ['household', 'age', 'all', 'quintile'] },
      quintile: { type: 'integer', minimum: 1, maximum: 5, description: 'Taustatilaston tuloviidennes, ei päätelmä asiakkaan ryhmästä.' },
      age: { type: 'integer', minimum: 18, maximum: 100, description: 'kind=income: ikä, jonka mediaania kysytään (esim. 18 → Tilastokeskuksen ikäryhmä 18–24). Oletus asiakkaan oma ikä. Kerro vastauksessa, mikä ikäryhmä tilastossa oli.' },
    }, ['kind']),
  },
  {
    name: 'get_mortgage',
    description:
      'Asiakkaan asuntolainahakemus (jos hän on hakenut): kohde, hinta, lainasumma, omarahoitus, vakuudet, lainan osuus vakuusarvosta (LTV), vaadittu kuukausitulo, päätös ja mahdollinen hylkäyssyy sekä hakemuksen aikajana. ' +
      'Vertaa samalla asiakkaan todellisiin tuloihin tilitapahtumista ja muiden aineiston hakijoiden (200 kpl) mediaaneihin. Käytä kun puhutaan asuntolainasta, asunnon ostosta, lainan saamisesta tai hylkäyksen syistä.',
    parameters: obj({}),
  },
  {
    name: 'save_profile',
    description:
      'Tallenna asiakkaan ITSE kertomat tiedot muistiin (vain mitä asiakas on sanonut, ei arvauksia). household: yksin / pari / lapsiperhe / yksinhuoltaja / muu.',
    parameters: obj({
      situation: { type: 'string', description: 'esim. opiskelija, töissä, eläkkeellä, työtön' },
      household: { type: 'string', enum: ['yksin', 'pari', 'lapsiperhe', 'yksinhuoltaja', 'muu'] },
      expensesComplete: { type: 'boolean', description: 'Vain asiakkaan vahvistus: tämän tilin tapahtumat kattavat koko kotitalouden kaikki menot.' },
      incomeComplete: { type: 'boolean', description: 'Vain asiakkaan vahvistus: palkka ja muut tulot kattavat kaikki henkilökohtaiset nettotulot, eivät omia tilisiirtoja tai lainanostoja.' },
      partnerAge: { type: 'integer', minimum: 18, maximum: 120, description: 'Asiakkaan kertoma puolison ikä, lapsettoman parin tilastoryhmää varten.' },
      dependentChildrenUnder25: { type: 'boolean', description: 'Asiakas vahvisti, onko taloudessa alle 25-vuotiaita huollettavia lapsia.' },
      allMembers65Plus: { type: 'boolean', description: 'Asiakas vahvisti, ovatko kaikki kotitalouden jäsenet vähintään 65-vuotiaita.' },
      living: { type: 'string', description: 'esim. vuokralla, omistusasunnossa, vanhempien luona' },
      goal: { type: 'string', description: 'säästötavoite tai muu talouden tavoite' },
      protect: { type: 'array', items: { type: 'string', enum: ['Restaurants', 'Taxi', 'Fun', 'Sport', 'Lifestyle', 'Travel', 'HomeTech', 'Groceries', 'Streaming'] }, description: 'Lisää asiakkaan vahvistamat menot, joista ei tingitä. Säilyy seuraaviin keskusteluihin.' },
      unprotect: { type: 'array', items: { type: 'string', enum: ['Restaurants', 'Taxi', 'Fun', 'Sport', 'Lifestyle', 'Travel', 'HomeTech', 'Groceries', 'Streaming'] }, description: 'Poista suojaus vain asiakkaan nimenomaisesta pyynnöstä.' },
      style: { type: 'string', enum: ['short', 'teach'], description: 'Asiakkaan toivoma lyhyt vastaus tai tarkempi opetus.' },
      note: { type: 'string', description: 'muu asiakkaan kertoma asia, joka kannattaa muistaa' },
    }),
  },
].map((t) => ({ type: 'function' as const, strict: false, ...t }));

export const ASYNC_TOOLS = new Set(ASYNC_TOOL_DEFS.map((t) => t.name));

export type AsyncOut = { result: unknown; card?: Card; profile?: Record<string, unknown> };

const NICE: Record<string, string> = {
  income: 'Tulot',
  spend_total: 'Kulutus yhteensä',
  saved: 'Säästöön ja sijoituksiin',
  savings_rate: 'Säästöaste',
  balance_change: 'Tilin saldon muutos 12 kk',
  taxi: 'Taksit',
};
const metricLabel = (m: string) => NICE[m] ?? (m.startsWith('cat:') ? CAT_FI[m.slice(4)] ?? m.slice(4) : m);

export async function runAsyncTool(name: string, a: any, ctx: AgentCtx, customerId: string): Promise<AsyncOut> {
  a = a || {};
  switch (name) {
    case 'query_transactions': {
      const to = /^\d{4}-\d{2}-\d{2}$/.test(a.to || '') ? a.to : TODAY;
      const from = /^\d{4}-\d{2}-\d{2}$/.test(a.from || '') ? a.from : addDays(to, -365);
      const dir = a.direction || 'menot';
      const q = (a.search || '').toLowerCase();
      const list = txs().filter(
        (t) =>
          t.d >= from &&
          t.d <= to &&
          (dir === 'kaikki' || (dir === 'menot' ? t.a < 0 : t.a > 0)) &&
          (!a.category || t.c === a.category) &&
          (!a.mcc || t.mcc === a.mcc) &&
          (!q || `${merchantName(t)} ${labelOf(t)} ${CAT_FI[t.c] ?? t.c}`.toLowerCase().includes(q)),
      );
      const sum = list.reduce((s, t) => s + Math.abs(t.a), 0);
      const byMonth: Record<string, { sum: number; n: number }> = {};
      for (const t of list) {
        const ym = t.d.slice(0, 7);
        byMonth[ym] = byMonth[ym] || { sum: 0, n: 0 };
        byMonth[ym].sum += Math.abs(t.a);
        byMonth[ym].n++;
      }
      const months = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / (30.44 * 86400000)));
      return {
        result: {
          jakso: `${from} – ${to}`,
          tapahtumia: list.length,
          yhteensa: eur(sum),
          keskimaarin_kk: eur(sum / months),
          keskiostos: list.length ? eur(sum / list.length) : null,
          kuukausittain: Object.entries(byMonth).map(([m, v]) => `${m}: ${eur0(v.sum)} (${v.n} kpl)`),
          esimerkit: list.slice(-5).map((t) => `${t.d} ${merchantName(t)} ${eur(t.a)}`),
          huom: list.length === 0 ? 'Rajauksella ei löytynyt tapahtumia.' : undefined,
        },
      };
    }
    case 'monthly_series': {
      const n = Math.min(24, Math.max(1, a.months || 6));
      const months: string[] = [];
      let y = +TODAY.slice(0, 4);
      let mo = +TODAY.slice(5, 7);
      for (let i = 0; i < n; i++) {
        months.unshift(`${y}-${String(mo).padStart(2, '0')}`);
        if (--mo === 0) {
          mo = 12;
          y--;
        }
      }
      const q = (a.search || '').toLowerCase();
      const match = (t: any) =>
        (!a.category || t.c === a.category) && (!a.mcc || t.mcc === a.mcc) && (!q || `${merchantName(t)} ${labelOf(t)} ${CAT_FI[t.c] ?? t.c}`.toLowerCase().includes(q));
      const metric = a.metric || 'spend';
      const all = txs();
      const values = months.map((ym) => {
        const inM = all.filter((t) => t.d.startsWith(ym));
        if (metric === 'balance') return inM.length ? inM[inM.length - 1].b : null;
        const inc = inM.filter((t) => t.a > 0 && (t.ty === 'salary' || t.ty === 'other_income') && match(t)).reduce((x, t) => x + t.a, 0);
        const out = inM.filter((t) => t.a < 0 && t.ty !== 'investment_deposit' && t.ty !== 'salary_sweep' && match(t)).reduce((x, t) => x - t.a, 0);
        return Math.round((metric === 'income' ? inc : metric === 'net' ? inc - out : out) * 100) / 100;
      });
      const partial = TODAY.slice(8) !== '30' && TODAY.slice(8) !== '31';
      return {
        result: {
          kuukaudet: months,
          arvot: values,
          mittari: metric,
          rajaus: { kategoria: a.category, mcc: a.mcc, haku: a.search },
          huom: partial ? 'Viimeinen kuukausi voi olla vajaa.' : undefined,
        },
      };
    }
    case 'show_chart': {
      const output = buildChart(a);
      if (!output.card) return { result: { virhe: output.error } };
      return {
        result: { naytetty: true, kaaviotyyppi: output.card.chart },
        card: output.card,
      };
    }
    case 'show_cashflow': {
      const s = safeToSpend();
      const steps = [
        { label: 'Vuokra ennen palkkaa', value: -s.rentDue, icon: 'vuokra' },
        { label: 'Laskut', value: -s.bills, icon: 'laskut' },
        { label: 'Ruokakauppa', value: -s.groceries, icon: 'ruokakauppa' },
        { label: 'Tilaukset', value: -s.subs, icon: 'toistuva' },
        { label: 'Varaus yllätyksiin', value: -s.buffer, icon: 'saasto' },
      ].filter((x) => Math.round(x.value) !== 0);
      return {
        result: {
          saldo: eur(s.balance),
          palkkapaiva: s.until,
          paivia: s.days,
          varaukset: steps.map((x) => `${x.label}: ${eur0(-x.value)}`),
          turvallinen_kayttovara: eur0(s.free),
          per_viikko: eur0(s.perWeek),
          laskentatapa: 'Varaukset lasketaan asiakkaan omien viimeisten 6 kk keskiarvojen perusteella palkkapäivään asti.',
        },
        card: {
          kind: 'waterfall',
          title: 'Saldosta käyttövaraan',
          start: { label: 'Tilin saldo nyt', value: s.balance },
          steps,
          end: { label: `Turvallisesti käytettävissä ${+s.until.slice(8)}.${+s.until.slice(5, 7)}. asti`, value: s.free },
          note: `${s.days} päivää palkkapäivään · noin ${eur0(s.perWeek)} viikossa`,
        },
      };
    }
    case 'compare_peers': {
      const metrics: string[] = (a.metrics || []).slice(0, 8);
      if (!metrics.length) return { result: { virhe: 'metrics puuttuu' } };
      const p = await getJson(`/api/peers?id=${customerId}&group=${a.group === 'all' ? 'all' : 'age'}&metrics=${metrics.map(encodeURIComponent).join(',')}`);
      const pct = (m: string) => m === 'savings_rate';
      const rows = metrics.map((m) => {
        const x = p.metrics[m];
        const k = pct(m) ? 100 : 1;
        return { key: m.startsWith('cat:') ? m.slice(4) : m, label: metricLabel(m), user: x.user * k, ref: x.median * k, p25: x.p25 * k, p75: x.p75 * k, note: `${x.user_percentile}. persentiili` };
      });
      const allPct = metrics.every(pct);
      return {
        result: {
          lahde: p.source,
          vertailuryhma: p.group,
          ryhman_koko: p.group_size,
          luotettava: p.reliable,
          huom: p.note,
          jakso: `${p.window.from} – ${p.window.to} (12 kk, kaikille sama)`,
          tunnusluvut: Object.fromEntries(metrics.map((m) => [metricLabel(m), { maaritelma: p.metrics[m].definition, asiakas: p.metrics[m].user, mediaani: p.metrics[m].median, alakvartiili: p.metrics[m].p25, ylakvartiili: p.metrics[m].p75, keskiarvo: p.metrics[m].mean, sijoitus_persentiili: p.metrics[m].user_percentile }])),
          ohje: 'Mediaani on tunnusluku, jota verrataan. Persentiili = kuinka monta prosenttia ryhmästä on asiakasta alempana.',
        },
        card: p.reliable
          ? {
              kind: 'compare',
              title: 'Te ja muut S-Pankin asiakkaat',
              origin: 'peers',
              source: 'S-Pankin synteettinen asiakasaineisto (Junction 2026)',
              group: `${p.group}, ${p.group_size} asiakasta`,
              statistic: 'mediaani, vaalea alue = keskimmäinen puolikas (25–75 %)',
              period: '12 kk: 10/2025–9/2026',
              unit: allPct ? '%' : '€/kk',
              rows,
            }
          : undefined,
      };
    }
    case 'compare_finland': return compareFinland(a, ctx);
    case 'get_mortgage': {
      const stats = await getJson('/api/mortgage-stats');
      const fromD = addDays(TODAY, -365);
      const incomeMonth = txs()
        .filter((t) => t.d > fromD && (t.ty === 'salary' || t.ty === 'other_income'))
        .reduce((x, t) => x + t.a, 0) / 12;
      const REASON: Record<string, string> = {
        insufficient_collateral: 'vakuudet eivät riittäneet',
        insufficient_income: 'tulot eivät riittäneet',
        insufficient_equity: 'omarahoitus ei riittänyt',
        existing_debt: 'olemassa oleva velka',
      };
      const general = {
        aineiston_hakemukset: stats.n,
        paatokset: stats.decisions,
        hylkayssyyt: Object.fromEntries(Object.entries(stats.rejection_reasons).map(([k, v]) => [REASON[k] ?? k, v])),
        hyvaksytyt_mediaani: stats.by_decision.approved,
        hylatyt_mediaani: stats.by_decision.rejected,
        kaikki_mediaani: stats.all,
        lahde: stats.source,
      };
      if (!MORTGAGE) {
        // Ei omaa hakemusta: verrataan asiakkaan omia lukuja hyväksyttyjen hakijoiden mediaaneihin (opastus, ei lainapäätös)
        const ap0 = stats.by_decision.approved;
        return {
          result: {
            asiakkaalla_hakemus: false,
            asiakkaan_tulot_tililla_12kk_kk: eur0(incomeMonth),
            tilin_saldo_nyt: eur0(BALANCE_NOW),
            hyvaksyttyjen_vaadittu_kuukausitulo_mediaani: eur0(ap0.required_monthly_income_eur.median),
            hyvaksyttyjen_omarahoitus_mediaani: eur0(ap0.equity_eur.median),
            huom: 'Tällä asiakkaalla ei ole asuntolainahakemusta aineistossa. Kortti vertaa hänen tulojaan ja tilin saldoaan hyväksyttyjen hakijoiden mediaaneihin. Saldo ei ole sama asia kuin omarahoitus, eikä vertailu ole lainapäätös. Kysy tarvittaessa asunnon hinta-arvio ja säästöt.',
            aineisto: general,
          },
          card: {
            kind: 'compare',
            title: 'Te ja hyväksytyt asuntolainan hakijat',
            origin: 'peers',
            source: stats.source,
            group: `hyväksytyt hakemukset (${stats.decisions.approved} kpl)`,
            statistic: 'mediaani, vaalea alue = keskimmäinen puolikas',
            period: 'oma tili: viimeiset 12 kk',
            unit: '€',
            rows: [
              { key: 'palkka', label: 'Kuukausitulo (te) vs. vaadittu tulo', user: Math.round(incomeMonth), ref: Math.round(ap0.required_monthly_income_eur.median), p25: Math.round(ap0.required_monthly_income_eur.p25), p75: Math.round(ap0.required_monthly_income_eur.p75) },
              { key: 'saasto', label: 'Tilin saldo (te) vs. omarahoitus', user: Math.round(BALANCE_NOW), ref: ap0.equity_eur.median, p25: ap0.equity_eur.p25, p75: ap0.equity_eur.p75, note: 'saldo ei ole sama asia kuin omarahoitus' },
            ],
            note: `Hylkäyksistä yleisin syy: vakuudet eivät riittäneet (${stats.rejection_reasons.insufficient_collateral ?? 0}/${stats.decisions.rejected}).`,
          },
        };
      }
      const f = MORTGAGE.final;
      const timeline = MORTGAGE.events.map((e) => {
        const bits = [String(e.ts).slice(0, 10), e.event];
        if (e.property_type) bits.push(e.property_type);
        if (e.property_price_estimate) bits.push(`hinta ${eur0(e.property_price_estimate)}`);
        if (e.loan_amount) bits.push(`laina ${eur0(e.loan_amount)}`);
        if (e.equity_amount) bits.push(`omarahoitus ${eur0(e.equity_amount)}`);
        if (e.collateral_value) bits.push(`vakuus ${e.collateral_type ?? ''} ${eur0(e.collateral_value)} (${e.collateral_status ?? ''})`);
        if (e.expense_type) bits.push(`kulu ${e.expense_type} ${eur0(e.expense_amount ?? 0)}`);
        if (e.decision) bits.push(`päätös ${e.decision}${e.rejection_reason ? ' – ' + (REASON[e.rejection_reason] ?? e.rejection_reason) : ''}`);
        return bits.join(' · ');
      });
      const ltvPct = Math.round(f.loan_to_value * 100);
      const ap = stats.by_decision.approved;
      return {
        result: {
          asiakkaalla_hakemus: true,
          paatos: f.decision === 'approved' ? 'hyväksytty' : 'hylätty',
          hylkayssyy: f.rejection_reason ? REASON[f.rejection_reason] ?? f.rejection_reason : null,
          asunnon_hinta: eur0(f.property_price_eur),
          haettu_laina: eur0(f.requested_loan_eur),
          omarahoitus: eur0(f.equity_eur),
          vakuusarvo: eur0(f.collateral_value_eur),
          laina_vakuusarvoon_LTV: `${ltvPct} %`,
          vaadittu_kuukausitulo: eur0(f.required_monthly_income_eur),
          asiakkaan_tulot_tililla_12kk_kk: eur0(incomeMonth),
          aikajana: timeline,
          aineisto: general,
          huom: 'Synteettinen aineisto. LTV = haettu laina / vakuuksien arvo.',
        },
        card: {
          kind: 'compare',
          title: 'Asuntolainahakemuksenne vs. muut hakijat',
          origin: 'peers',
          source: stats.source,
          group: `hyväksytyt hakemukset (${stats.decisions.approved} kpl)`,
          statistic: 'mediaani, vaalea alue = keskimmäinen puolikas',
          period: `päätös: ${f.decision === 'approved' ? 'hyväksytty' : 'hylätty'}`,
          unit: '€',
          rows: [
            { key: 'saasto', label: 'Omarahoitus', user: f.equity_eur, ref: ap.equity_eur.median, p25: ap.equity_eur.p25, p75: ap.equity_eur.p75 },
            { key: 'palkka', label: 'Vaadittu kuukausitulo', user: Math.round(f.required_monthly_income_eur), ref: Math.round(ap.required_monthly_income_eur.median), note: `tilillenne tulee ${eur0(incomeMonth)}/kk` },
          ],
          note: `Lainan osuus vakuuksista ${ltvPct} % (hyväksytyillä mediaani ${Math.round(ap.loan_to_value.median * 100)} %).`,
        },
      };
    }
    case 'save_profile': {
      const patch: Record<string, unknown> = {};
      if (a.household && a.household !== ctx.profile.household) {
        patch.expensesComplete = undefined;
        patch.partnerAge = undefined;
        patch.dependentChildrenUnder25 = undefined;
        patch.allMembers65Plus = undefined;
      }
      for (const k of ['situation', 'household', 'living', 'goal']) if (a[k]) patch[k] = String(a[k]);
      for (const k of ['expensesComplete', 'incomeComplete', 'dependentChildrenUnder25', 'allMembers65Plus']) if (typeof a[k] === 'boolean') patch[k] = a[k];
      if (Number.isInteger(a.partnerAge) && a.partnerAge >= 18 && a.partnerAge <= 120) patch.partnerAge = a.partnerAge;
      if (a.note) patch.notes = [String(a.note)];
      if (a.style === 'short' || a.style === 'teach') patch.style = a.style;
      if (a.protect || a.unprotect) {
        const allowed = ['Restaurants', 'Taxi', 'Fun', 'Sport', 'Lifestyle', 'Travel', 'HomeTech', 'Groceries', 'Streaming'];
        if (![...(a.protect ?? []), ...(a.unprotect ?? [])].every(k => allowed.includes(k))) throw new Error('Tuntematon menolaji.');
        patch.protect = [...new Set([...ctx.prefs.protected, ...(a.protect ?? [])])].filter(k => !(a.unprotect ?? []).includes(k));
      }
      return { result: { tallennettu: patch }, profile: patch };
    }
    default:
      return { result: { virhe: 'tuntematon työkalu' } };
  }
}
