import { addDays, baskets, eur, eur0, habits, lastMonths, monthName, recurring, safeToSpend, TODAY, topSinks } from '../finance/analytics';
import { CAT_FI, LEVER_FI, LeverKey } from '../finance/categories';
import { levers } from '../finance/optimizer';
import {
  changeBetween,
  deleteScenario,
  getScenarios,
  goalPlans,
  leverLabel,
  monthlyGame,
  monthStatus,
  rhythms,
  runway,
  safeToSave,
  simScenario,
  upsertScenario,
  weekly,
} from '../finance/insights';
import type { AgentCtx, Card } from './types';

/**
 * Per Tieerin valmennustyökalut: kassanhallinta, ennakointi, simulointi, optimointi ja kuukausipeli.
 * Kaikki luvut lasketaan valitun asiakkaan omasta datasta (src/finance/insights.ts).
 */
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false });
const LEVERS = Object.keys(LEVER_FI) as LeverKey[];
const changesSchema = {
  type: 'object',
  description: `Prosenttimuutokset vivuittain (negatiivinen = vähennys), esim. {"Restaurants": -20, "Taxi": -50}. Vivut: ${LEVERS.map((k) => `${k}=${LEVER_FI[k]}`).join(', ')}`,
  properties: Object.fromEntries(LEVERS.map((k) => [k, { type: 'number' }])),
  additionalProperties: false,
};
const ymRe = /^\d{4}-\d{2}$/;
const prevYm = (ym: string) => lastMonths(2, ym)[0];
const fiYm = (ym: string) => `${monthName(ym)} ${ym.slice(0, 4)}`;

export const COACH_TOOL_DEFS = [
  {
    name: 'month_status',
    description: 'Tämän (tai valitun) kuukauden tilanne: tulot ja menot tähän mennessä, plussalla vai miinuksella, suurimmat menoluokat. Näyttää selkeän kortin.',
    parameters: obj({ month: { type: 'string', description: 'YYYY-MM, oletus kuluva kuukausi' } }),
  },
  {
    name: 'explain_change',
    description: 'Muutosten selittäjä: miksi rahaa jäi vähemmän/enemmän kuin edellisenä kuukautena? Laskee erot tuloissa ja menoluokissa ja näyttää muutoskaavion.',
    parameters: obj({ month: { type: 'string', description: 'tarkasteltava kuukausi YYYY-MM (oletus viimeisin)' }, compare_to: { type: 'string', description: 'verrattava kuukausi (oletus edellinen)' } }),
  },
  {
    name: 'runway',
    description: 'Taloudellinen selviytymisaika: kuinka monta päivää nykyinen saldo riittäisi ilman uusia tuloja (välttämättömillä menoilla ja kaikilla menoilla).',
    parameters: obj({}),
  },
  {
    name: 'safe_to_save',
    description: 'Turvallinen säästövara: paljonko asiakas voisi siirtää säästöön kuukausittain vaarantamatta välttämättömiä menoja (perustuu hänen omien kuukausiensa ylijäämiin ja tarkistetaan ennusteella). Näyttää kaavion.',
    parameters: obj({}),
  },
  {
    name: 'scenario',
    description:
      'Monivaiheiset mitä jos -skenaariot, jotka säilyvät keskustelun ajan. action=set: luo tai päivitä nimetty skenaario (muutokset, ostos päivämäärineen, tulo- tai vuokramuutos, kuukausisäästö) – uudet muutokset lisätään aiempiin. ' +
      'action=remove_change / remove_purchase: poista osa. action=delete: poista skenaario (tai kaikki). action=compare: vertaa skenaarioita nykytahtiin ennustekäyränä (viikoittain) ja loppusaldoina. Käytä tätä, kun käyttäjä jatkaa "entä jos lisäksi…", "entä jos vasta ensi kuussa…", "vertaa kaikkia".',
    parameters: obj(
      {
        action: { type: 'string', enum: ['get', 'set', 'remove_change', 'remove_purchase', 'delete', 'compare'] },
        name: { type: 'string', description: 'skenaarion lyhyt nimi, esim. "Ravintolat −20 %" tai "Kone ensi kuussa"' },
        copy_from: { type: 'string', description: 'Luo uusi vaihtoehto kopioimalla olemassa oleva nimetty skenaario ennen muutoksia.' },
        changes: changesSchema,
        euro_changes: { type: 'array', description: 'Euromääräiset menomuutokset; negatiivinen vähentää. Muunnetaan asiakkaan omasta lähtötasosta, ei arvata prosenttia.', items: obj({ lever: { type: 'string', enum: LEVERS }, amount: { type: 'number' }, period: { type: 'string', enum: ['month', 'week'] } }, ['lever', 'amount', 'period']) },
        purchase: obj({ label: { type: 'string' }, amount: { type: 'number' }, date: { type: 'string', description: 'YYYY-MM-DD' } }, ['label', 'amount', 'date']),
        remove: { type: 'string', description: 'poistettavan vivun avain tai ostoksen nimi' },
        income_delta: { type: 'number', description: '€/kk' },
        rent_delta: { type: 'number', description: '€/kk' },
        monthly_saving: { type: 'number', description: '€/kk säästöön palkkapäivänä' },
        until: { type: 'string', description: 'ennusteen loppupäivä (oletus 3 kk eteenpäin)' },
      },
      ['action'],
    ),
  },
  {
    name: 'plan_goal',
    description:
      'Käänteinen suunnittelija: asiakkaan tavoite (summa ja päivämäärä tai €/kk) → kuukausitavoite → jopa kolme erilaista optimoitua suunnitelmaa hänen omista joustavista menoistaan, huomioiden suojatut kohteet (esim. "en luovu kuntosalista" → protect). Kertoo myös, jos tavoite ei ole realistinen. Näyttää suunnitelmien vertailun.',
    parameters: obj(
      {
        amount: { type: 'number', description: 'säästötavoite euroina' },
        by_date: { type: 'string', description: 'YYYY-MM-DD' },
        monthly: { type: 'number', description: 'tai suoraan €/kk' },
        protect: { type: 'array', items: { type: 'string', enum: LEVERS }, description: 'kohteet, joista ei tingitä' },
        kind: { type: 'string', enum: ['saving', 'balance'], description: 'saving = uutta säästöä; balance = haluttu käyttötilin loppusaldo määräpäivänä. Älä sekoita näitä.' },
      },
      [],
    ),
  },
  {
    name: 'purchase_timing',
    description: 'Ostoksen paras ajankohta: simuloi saman ostoksen eri päivinä (esim. nyt, palkkapäivän jälkeen, ensi kuussa) ja vertaa alinta saldoa, miinusriskiä ja loppusaldoa. Näyttää ennustekäyrät.',
    parameters: obj({ label: { type: 'string' }, amount: { type: 'number' }, dates: { type: 'array', items: { type: 'string' }, description: 'vaihtoehtoiset ostopäivät YYYY-MM-DD (oletus: tänään, palkkapäivän jälkeen, kuukauden päästä)' } }, ['amount']),
  },
  {
    name: 'explain_term',
    description:
      'Termien selittäjä: hakee asiakkaan OMAT luvut, joilla talouskäsite (esim. hätärahasto/puskuri, käyttövara, kassavirta, budjetti, säästöaste, vaihtoehtoiskustannus, korkoa korolle, palkkapäiväefekti, kolme rahakoria, laina ja korko) selitetään juuri hänen tilanteessaan. Selitä sitten lyhyesti, konkreettisesti ja tarvittaessa kuvalla.',
    parameters: obj({ term: { type: 'string', description: 'käsite asiakkaan sanoin' } }, ['term']),
  },
  {
    name: 'plan_budget',
    description:
      'Automaattinen budjettisuunnittelija: tekee asiakkaan omasta kulutuksesta kuukausibudjetin, jolla haluttu summa jää säästöön (pakolliset menot, varaus epäsäännöllisiin, arjen menojen katot luokittain, säästö). Huomioi suojatut kohteet. Näyttää budjettirenkaan.',
    parameters: obj({ save_monthly: { type: 'number', description: 'tavoiteltu säästö €/kk' }, protect: { type: 'array', items: { type: 'string', enum: LEVERS } } }, ['save_monthly']),
  },
  {
    name: 'early_warning',
    description:
      'Talouden varhaisvaroitus: tutkii seuraavat ~5 viikkoa ennen kuin ongelmia syntyy – riittääkö raha vuokraan/laskuihin ennen palkkaa, kassavajeen riski ja ajankohta, kasvaneet menoluokat, kallistuneet tai uudet toistuvat maksut. Kerro vain oikeat havainnot rauhallisesti ja ehdota yksi ennaltaehkäisevä teko.',
    parameters: obj({}),
  },
  {
    name: 'monthly_game',
    description:
      'Kuukauden talouskoetus: 5 kysymystä (3 monivalintaa + 2 numeroarviota) asiakkaan edellisen täyden kuukauden OMISTA tapahtumista. Näyttää pelikortin; asiakas vastaa siihen suoraan. Tarjoa kuun vaihteessa tai pyydettäessä – aina vapaaehtoinen.',
    parameters: obj({ month: { type: 'string', description: 'YYYY-MM (oletus edellinen täysi kuukausi)' } }),
  },
].map((t) => ({ type: 'function' as const, strict: false, ...t }));

export const COACH_TOOLS = new Set(COACH_TOOL_DEFS.map((t) => t.name));

export function runCoachTool(name: string, a: any, ctx: AgentCtx): { result: unknown; card?: Card; profile?: Record<string, unknown> } {
  a = a || {};
  const base = { rentDelta: ctx.profile.rentDelta, incomeDelta: ctx.profile.incomeDelta };
  switch (name) {
    case 'month_status': {
      const ym = ymRe.test(a.month || '') ? a.month : TODAY.slice(0, 7);
      const m = monthStatus(ym);
      return {
        result: {
          kuukausi: fiYm(ym),
          tiedot_asti: m.through,
          tulot: eur(m.income),
          menot: eur(m.spend),
          saastoon_siirretty: eur(m.saved),
          tulos: `${m.net >= 0 ? '+' : '−'}${eur(Math.abs(m.net))}`,
          suurimmat: m.top.slice(0, 5).map(([c, v]) => `${CAT_FI[c] ?? c}: ${eur0(v)}`),
        },
        card: {
          kind: 'chart',
          title: `${fiYm(ym)[0].toUpperCase()}${fiYm(ym).slice(1)}: tulot ja menot`,
          chart: 'bar',
          unit: '€',
          labels: ['Tulot', 'Menot', m.net >= 0 ? 'Jäi yli' : 'Vajaus'],
          series: [{ name: fiYm(ym), values: [Math.round(m.income), Math.round(m.spend), Math.round(m.net)] }],
          note: `Tilanne ${+m.through.slice(8)}.${+m.through.slice(5, 7)}. asti. Menot = ostot, laskut ja asuminen.`,
          icon: 'kolikot',
        },
      };
    }
    case 'explain_change': {
      const ym = ymRe.test(a.month || '') ? a.month : TODAY.slice(0, 7);
      const ref = ymRe.test(a.compare_to || '') ? a.compare_to : prevYm(ym);
      const c = changeBetween(ref, ym);
      const top = c.diffs.slice(0, 6);
      return {
        result: {
          verrattu: `${fiYm(ref)} → ${fiYm(ym)}`,
          tulojen_muutos: eur0(c.incomeDelta),
          menojen_muutos: eur0(c.spendDelta),
          jaannoksen_muutos: eur0(c.netDelta),
          suurimmat_muutokset: top.map((d) => `${d.label}: ${eur0(d.from)} → ${eur0(d.to)} (${d.delta >= 0 ? '+' : '−'}${eur0(Math.abs(d.delta))})`),
          huom: c.b.complete ? undefined : 'Tarkasteltava kuukausi voi olla vielä kesken.',
        },
        card: {
          kind: 'chart',
          title: `Mikä muuttui: ${monthName(ref)} → ${monthName(ym)}`,
          chart: 'bar',
          unit: '€',
          labels: top.map((d) => d.label.split(' ')[0]),
          series: [{ name: 'muutos', values: top.map((d) => Math.round(d.delta)) }],
          note: `Pylväs ylös = menot kasvoivat, alas = pienenivät. Jäännös muuttui ${c.netDelta >= 0 ? '+' : '−'}${eur0(Math.abs(c.netDelta))}.`,
          icon: 'ennuste',
          art: 'muutosetsiva',
        },
      };
    }
    case 'runway': {
      const r = runway();
      return {
        result: {
          saldo: eur(r.balance),
          valttamattomat_menot_kk: eur0(r.essentialMonthly),
          kaikki_menot_kk: eur0(r.allMonthly),
          riittaa_paivaa_valttamattomilla: r.daysEssential,
          riittaa_paivaa_nykytahdilla: r.daysAll,
          laskentatapa: 'Saldo jaettuna päivittäisillä menoilla (6 kk keskiarvo). Välttämättömät = pakolliset säännölliset + epäsäännölliset.',
        },
        card: {
          kind: 'stat',
          label: 'Rahat riittäisivät ilman uusia tuloja',
          value: r.daysEssential != null ? `${r.daysEssential} päivää` : '–',
          sub: `välttämättömillä menoilla · nykytahdilla ${r.daysAll ?? '–'} päivää`,
          icon: 'palkkapaiva',
          art: 'selviytymisaika',
        },
      };
    }
    case 'safe_to_save': {
      const s = safeToSave(base);
      return {
        result: {
          ehdotus_kk: eur0(s.suggestion),
          kuukausien_ylijaamat: s.monthlySurplus.map((m) => `${monthName(m.ym)}: ${m.net >= 0 ? '+' : '−'}${eur0(Math.abs(m.net))}`),
          varovainen_taso: eur0(s.cautiousSurplus),
          mediaani: eur0(s.medianSurplus),
          miinusriski_90pv: s.probNegative != null ? `${Math.round(s.probNegative * 100)} %` : null,
          laskentatapa: s.method,
          huom: s.suggestion === 0 ? 'Ylijäämää ei ole riittävästi turvalliseen säästöön – ensin kannattaa vakauttaa kassavirta.' : undefined,
        },
        card: {
          kind: 'chart',
          title: 'Kuukausien ylijäämä (tulot − menot)',
          chart: 'bar',
          unit: '€',
          labels: s.monthlySurplus.map((m) => monthName(m.ym).slice(0, 4)),
          series: [{ name: 'ylijäämä', values: s.monthlySurplus.map((m) => Math.round(m.net)) }],
          note: s.suggestion > 0 ? `Arvio säästövarasta ${eur0(s.suggestion)}/kk. Ennusteen miinusriski ${Math.round((s.probNegative ?? 0) * 100)} %. Puuttuvat tiedot voivat muuttaa arviota.` : 'Malli ei löydä varovaista säästövaraa – tarkistetaan ensin kassavirta ja tietojen kattavuus.',
          icon: 'saasto',
        },
      };
    }
    case 'scenario': {
      if (a.action === 'get') return { result: a.name ? getScenarios()[a.name] ?? { virhe: 'Skenaariota ei löydy.' } : getScenarios() };
      if (!['set', 'remove_change', 'remove_purchase', 'delete', 'compare'].includes(a.action)) throw new Error('Tuntematon skenaariotoiminto.');
      const list = a.name && a.action === 'compare' ? [getScenarios()[a.name]].filter(Boolean) : Object.values(getScenarios()).slice(-3);
      const lastPurchase = list.flatMap(s => s.purchases.map(p => p.date)).sort().at(-1);
      const until = a.until ?? (lastPurchase && lastPurchase > addDays(TODAY, 62) ? addDays(lastPurchase, 30) : addDays(TODAY, 92));
      if (a.action === 'delete') {
        deleteScenario(a.name);
        return { result: { poistettu: a.name ?? 'kaikki', jaljella: Object.keys(getScenarios()) } };
      }
      if (a.action !== 'compare') {
        if (!a.name) return { result: { virhe: 'name puuttuu' } };
        let copied: Partial<import('../finance/insights').Scenario> = {};
        if (a.copy_from) {
          const source = getScenarios()[a.copy_from];
          if (!source) throw new Error('Kopioitavaa skenaariota ei löydy.');
          if (getScenarios()[a.name]) throw new Error('Uuden vaihtoehdon nimi on jo käytössä.');
          copied = JSON.parse(JSON.stringify(source));
        }
        const changes = { ...(a.changes ?? {}) };
        for (const change of a.euro_changes ?? []) {
          const lever = levers().find(l => l.key === change.lever);
          if (!lever || !Number.isFinite(change.amount) || !['week', 'month'].includes(change.period)) throw new Error('Euromuutokselle ei löydy omaa menotietoa tai yksikkö puuttuu.');
          const delta = change.amount * (change.period === 'week' ? 52 / 12 : 1);
          if (delta < -lever.base) throw new Error(`Vähennys ylittää havaitut ${lever.label.toLowerCase()}-menot (${eur0(lever.base)}/kk).`);
          changes[lever.key] = delta / lever.base * 100;
        }
        const s = upsertScenario(a.name, {
          ...copied,
          changes: a.action === 'set' ? { ...((copied as { changes?: object }).changes ?? {}), ...changes } : undefined,
          addPurchase: a.action === 'set' && a.purchase ? { label: String(a.purchase.label), amount: Number(a.purchase.amount), date: String(a.purchase.date) } : undefined,
          removeChange: a.action === 'remove_change' ? a.remove : undefined,
          removePurchase: a.action === 'remove_purchase' ? a.remove : undefined,
          incomeDelta: a.income_delta ?? copied.incomeDelta,
          rentDelta: a.rent_delta ?? copied.rentDelta,
          monthlySaving: a.monthly_saving ?? copied.monthlySaving,
        });
        return { result: { skenaario: s, kaikki_skenaariot: Object.keys(getScenarios()), ohje: 'Kutsu action=compare näyttääksesi vaikutuksen.' } };
      }
      const now = simScenario(null, until, base);
      if (!list.length) throw new Error('Tallennettuja skenaarioita ei löydy.');
      const sims = list.map((s) => ({ s, sim: simScenario(s, until, base) }));
      const w = weekly(now);
      const describe = (s: (typeof list)[number]) =>
        [
          ...Object.entries(s.changes).map(([k, v]) => `${leverLabel(k)} ${v! > 0 ? '+' : ''}${v} %`),
          ...s.purchases.map((p) => `${p.label} ${eur0(p.amount)} ${+p.date.slice(8)}.${+p.date.slice(5, 7)}.`),
          s.incomeDelta ? `tulot ${s.incomeDelta > 0 ? '+' : ''}${eur0(s.incomeDelta)}/kk` : '',
          s.rentDelta ? `vuokra ${s.rentDelta > 0 ? '+' : ''}${eur0(s.rentDelta)}/kk` : '',
          s.monthlySaving ? `säästö ${eur0(s.monthlySaving)}/kk` : '',
        ]
          .filter(Boolean)
          .join(', ');
      return {
        result: {
          jakso: `${TODAY} – ${until}`,
          nykytahti: { loppusaldo: eur0(now.end.p50), alin: eur0(now.min50), miinusriski: `${Math.round(now.probNegative * 100)} %` },
          skenaariot: sims.map(({ s, sim }) => ({
            nimi: s.name,
            muutokset: describe(s),
            loppusaldo: eur0(sim.end.p50),
            ero_nykytahtiin: eur0(sim.end.p50 - now.end.p50),
            alin_saldo: `${eur0(sim.min50)} (${sim.minDate})`,
            miinusriski: `${Math.round(sim.probNegative * 100)} %`,
          })),
          huom: 'Ennuste (mediaanipolku, Monte Carlo omista menoista). Skenaariot ovat laskennallisia, eivät muuta oikeita tapahtumia.',
          oletukset: now.assumptions,
        },
        card: {
          kind: 'chart',
          title: 'Saldoennuste: nykytahti vs. skenaariot',
          chart: 'line',
          unit: '€',
          labels: w.labels,
          series: [{ name: 'Nykytahti', values: w.values }, ...sims.map(({ s, sim }) => ({ name: s.name, values: weekly(sim).values }))],
          note: 'Ennuste, todennäköisin kehitys viikoittain.',
          icon: 'ennuste',
          art: 'mitajos',
        },
      };
    }
    case 'plan_goal': {
      const prefs = { ...ctx.prefs, protected: [...new Set([...(ctx.prefs.protected ?? []), ...((a.protect ?? []) as LeverKey[])])] };
      if (prefs.protected.some(k => !LEVERS.includes(k))) throw new Error('Tuntematon suojattava menolaji.');
      const amount = Number(a.amount) || 0;
      const g = goalPlans(amount, a.by_date ?? null, a.monthly ?? null, prefs, base, a.kind ?? 'saving');
      const plans = g.plans;
      const best = plans[0];
      return {
        profile: a.protect?.length ? { protect: prefs.protected } : undefined,
        result: {
          tavoitteen_laji: g.kind,
          tavoite_kk: eur0(g.target),
          kuukausia: g.months,
          nykyinen_kuukausiylijaama: eur0(g.baseline),
          tarvittava_menovahennys: eur0(g.cutNeeded),
          tutkittuja_haarautumia: g.branches,
          laskentatapa: g.method,
          suojatut: prefs.protected.map(leverLabel),
          suunnitelmat: plans.map((p, i) => ({
            vaihtoehto: i + 1,
            nimi: p.label,
            menovahennys_riittaa: p.feasible,
            kassavirta_lapaisee_varovaisuusrajan: p.cashflowAcceptable,
            menot_vahenevat_kk: eur0(p.total),
            arvioitu_ylijaama_kk: eur0(p.netMonthly),
            ennuste: p.forecast,
            ero: p.explanation,
            toimet: p.items.map((it) => `${it.label} −${it.pct} % (nyt ${eur0(it.base)}/kk → säästö ${eur0(it.saving)}/kk)`),
          })),
          huom: !best?.cashflowAcceptable ? 'Tavoite ei läpäise kassavirtatarkistusta näillä oletuksilla. Älä lupaa onnistumista. Tutki pienempää summaa, myöhempää ajankohtaa tai asiakkaan vahvistamaa tulomuutosta.' : 'Laskennallinen vaihtoehto, ei lupaus. Vahvista menojen ja tulojen kattavuus ennen vahvaa henkilökohtaista suositusta.',
        },
        card: { kind: 'goalPlans', goal: g },
      };
    }
    case 'purchase_timing': {
      const amount = Number(a.amount) || 0;
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Ostoksen hinnan pitää olla positiivinen.');
      const label = String(a.label || 'Ostos');
      const s2s = safeToSpend();
      const dates: string[] = (a.dates && a.dates.length ? a.dates : [addDays(TODAY, 1), addDays(s2s.until, 1), addDays(TODAY, 31)]).slice(0, 3);
      const until = addDays([...dates].sort().at(-1)!, 30);
      const now = simScenario(null, until, base);
      const sims = dates.map((d) => ({ d, sim: simScenario({ name: d, changes: {}, purchases: [{ date: d, amount, label }], incomeDelta: 0, rentDelta: 0, monthlySaving: 0 }, until, base) }));
      const w = weekly(now);
      return {
        result: {
          ostos: `${label} ${eur0(amount)}`,
          kayttovara_nyt: `${eur0(s2s.free)} palkkapäivään ${s2s.until} asti`,
          vaihtoehdot: sims.map(({ d, sim }) => ({ ostopaiva: d, alin_saldo: eur0(sim.min50), miinusriski: `${Math.round(sim.probNegative * 100)} %`, loppusaldo: eur0(sim.end.p50) })),
          ilman_ostosta: { alin_saldo: eur0(now.min50), miinusriski: `${Math.round(now.probNegative * 100)} %` },
          huom: 'Ennuste. Valitse ajankohta, jolla alin saldo pysyy turvallisesti plussalla.',
        },
        card: {
          kind: 'chart',
          title: `Milloin ${label.toLowerCase()} (${eur0(amount)})?`,
          chart: 'line',
          unit: '€',
          labels: w.labels,
          series: sims.map(({ d, sim }) => ({ name: `Osto ${+d.slice(8)}.${+d.slice(5, 7)}.`, values: weekly(sim).values })),
          note: 'Ennuste, todennäköisin saldo viikoittain eri ostopäivillä.',
          icon: 'kortti',
          art: 'mitajos',
        },
      };
    }
    case 'explain_term': {
      const s2s = safeToSpend();
      const r = runway();
      const b = baskets(6);
      const h = habits();
      const sts = safeToSave();
      const top = topSinks(3, 1)[0];
      const fv = (m: number, years: number, rate = 0.05) => m * ((Math.pow(1 + rate / 12, years * 12) - 1) / (rate / 12));
      const essential = b.totals.regular + b.totals.irregular;
      return {
        result: {
          kasite: a.term,
          asiakkaan_luvut: {
            saldo: eur(s2s.balance),
            turvallinen_kayttovara_palkkapaivaan: `${eur0(s2s.free)} (${s2s.days} pv, palkka ${s2s.until})`,
            varaukset: { vuokra: eur0(s2s.rentDue), laskut: eur0(s2s.bills), ruoka: eur0(s2s.groceries), tilaukset: eur0(s2s.subs), yllatysvara: eur0(s2s.buffer) },
            tulot_kk: eur0(b.income),
            kolme_koria_kk: { pakolliset_saannolliset: eur0(b.totals.regular), pakolliset_epasaannolliset: eur0(b.totals.irregular), lipsuvat: eur0(b.totals.slipping), jaa_kateen: eur0(b.left) },
            saastoaste: b.income > 0 ? `${Math.round((b.left / b.income) * 100)} %` : null,
            hatarahasto_suositus_3kk_valttamattomat: eur0(essential * 3),
            rahat_riittavat_ilman_tuloja_pv: r.daysEssential,
            palkkapaivaefekti_kerroin: Math.round(h.payRatio * 10) / 10,
            suurin_lipsuva_kohde: top ? `${top.label} ${eur0(top.monthly)}/kk = ${eur0(top.yearly)}/v` : null,
            vaihtoehtoiskustannus_10v_5pct: top ? eur0(fv(top.monthly, 10)) : null,
            korkoa_korolle_turvallinen_saasto_10v_5pct: sts.suggestion > 0 ? `${eur0(sts.suggestion)}/kk → ${eur0(fv(sts.suggestion, 10))}` : null,
          },
          ohje: 'Valitse käsitteeseen liittyvät luvut, selitä yksinkertaisesti asiakkaan omalla esimerkillä ja tarvittaessa kuvalla (esim. show_cashflow, show_baskets, show_chart). Tuottolaskelmat ovat esimerkkejä, eivät sijoitusneuvoja.',
        },
      };
    }
    case 'plan_budget': {
      const prefs = { ...ctx.prefs, protected: [...new Set([...(ctx.prefs.protected ?? []), ...((a.protect ?? []) as LeverKey[])])] };
      const target = Math.max(0, Number(a.save_monthly) || 0);
      const b = baskets(6);
      const plan = goalPlans(target, null, target, prefs).plans[0];
      const cut = plan?.total ?? 0;
      const free = b.income - b.totals.regular - b.totals.irregular - (b.totals.slipping - cut);
      const savingPossible = Math.max(0, Math.min(target, free));
      const daily = Math.max(0, b.totals.slipping - cut);
      return {
        result: {
          tulot_kk: eur0(b.income),
          budjetti_kk: {
            pakolliset_saannolliset: eur0(b.totals.regular),
            varaus_epasaannollisiin: eur0(b.totals.irregular),
            arjen_menot_katto: eur0(daily),
            saasto: eur0(savingPossible),
          },
          muutokset_arkeen: plan?.items.map((it) => `${it.label}: ${eur0(it.base)} → ${eur0(it.base - it.saving)}/kk (−${it.pct} %)`) ?? [],
          viikkoraha_arjen_menoihin: eur0((daily * 12) / 52),
          tavoite_toteutuu: savingPossible >= target - 1,
          huom: savingPossible < target - 1 ? `Nykyisillä tuloilla ja pakollisilla menoilla säästöön jää enintään ${eur0(savingPossible)}/kk – kerro tämä rehellisesti.` : undefined,
        },
        card: {
          kind: 'chart',
          title: `Kuukausibudjetti: ${eur0(savingPossible)} säästöön`,
          chart: 'pie',
          unit: '€',
          labels: ['Pakolliset säännölliset', 'Varaus epäsäännöllisiin', 'Arjen menot', 'Säästö'],
          series: [{ name: 'budjetti', values: [Math.round(b.totals.regular), Math.round(b.totals.irregular), Math.round(daily), Math.round(savingPossible)] }],
          note: `Arjen menoihin noin ${eur0((daily * 12) / 52)} viikossa. Perustuu omaan 6 kk kulutukseenne.`,
          icon: 'tavoite',
          art: 'budjetti',
        },
      };
    }
    case 'early_warning': {
      const until = addDays(TODAY, 35);
      const sim = simScenario(null, until, base);
      const s2s = safeToSpend();
      const rh = rhythms();
      const warnings: string[] = [];
      if (sim.probNegative >= 0.2) warnings.push(`Saldo voi käydä miinuksella (${Math.round(sim.probNegative * 100)} % todennäköisyys), alimmillaan noin ${eur0(sim.min50)} ${sim.minDate}.`);
      if (rh.rent && s2s.rentDue > 0 && s2s.free < 0) warnings.push(`Ennen palkkaa varattavat menot (vuokra ${eur0(s2s.rentDue)} ym.) ylittävät vapaan rahan ${eur0(-s2s.free)} eurolla.`);
      const cur = monthStatus(lastMonths(2)[0]);
      const avg: Record<string, number> = {};
      for (const ym of lastMonths(4).slice(0, 3)) {
        const m = monthStatus(ym);
        for (const [c, v] of Object.entries(m.byCat)) avg[c] = (avg[c] || 0) + v / 3;
      }
      const rising = Object.entries(cur.byCat)
        .filter(([c, v]) => c !== 'Housing' && avg[c] > 20 && v > avg[c] * 1.3 && v - avg[c] > 30)
        .map(([c, v]) => `${CAT_FI[c] ?? c}: ${eur0(v)} (tavallisesti ${eur0(avg[c])})`);
      const rec = recurring();
      const priced = rec.filter((x) => x.priceChange).map((x) => `${x.label}: ${eur(x.priceChange!.from)} → ${eur(x.priceChange!.to)}`);
      const suspicious = rec.filter((x) => x.suspicious).map((x) => `${x.label} ${eur(x.amount)}/kk`);
      return {
        result: {
          tarkastelujakso: `${TODAY} – ${until}`,
          varoitukset: warnings,
          kasvaneet_menot_viime_kk: rising,
          kallistuneet_maksut: priced,
          epailyttavat_toistuvat: suspicious,
          kayttovara: `${eur0(s2s.free)} palkkapäivään ${s2s.until}`,
          ei_huolia: !warnings.length && !rising.length && !priced.length && !suspicious.length,
          ohje: 'Kerro vain nämä oikeat havainnot rauhallisesti; jos ei huolia, sano se. Ehdota yksi ennaltaehkäisevä teko.',
        },
        card: warnings.length
          ? { kind: 'chart', title: 'Saldoennuste seuraavat viikot', chart: 'line', unit: '€', labels: weekly(sim).labels, series: [{ name: 'Ennuste', values: weekly(sim).values }], note: 'Ennuste omista tapahtumista (todennäköisin kehitys).', icon: 'varoitus' }
          : undefined,
      };
    }
    case 'monthly_game': {
      const ym = ymRe.test(a.month || '') ? a.month : prevYm(TODAY.slice(0, 7));
      const g = monthlyGame(ym);
      return {
        result: { kuukausi: fiYm(ym), kysymyksia: g.questions.length, ohje: 'Peli näkyy kortissa – älä paljasta vastauksia tekstissä. Kannusta lyhyesti ja kerro, että sen voi ohittaa.' },
        card: { kind: 'game', title: `Tunnetteko ${monthName(ym, true).replace(/ssa$/, 'n')} talouden?`, ym, questions: g.questions },
      };
    }
    default:
      return { result: { virhe: 'tuntematon työkalu' } };
  }
}
