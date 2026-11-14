/**
 * Per Tieerin laskentatyökalut valitun asiakkaan omasta datasta (kaikki asiakkaat, ei oletuksia).
 * Kielimalli valitsee työkalun ja selittää – kaikki luvut lasketaan täällä.
 */
import { addDays, BALANCE_NOW, baskets, daysBetween, incomeMonthly, salaryMonthly, lastMonths, monthlyAvg, onCustomerChange, recurring, rentMonthly, TODAY, txs } from './analytics';
import { basketOf, CAT_FI, LeverKey, LEVER_FI } from './categories';
import { simulate, SimOpts, SimResult } from './forecast';
import { levers, optimize, Prefs, Strategy } from './optimizer';

/* ---------------- asiakaskohtaiset rytmit ---------------- */

function modeDay(pred: (t: ReturnType<typeof txs>[number]) => boolean, fallback: number | null) {
  const from = addDays(TODAY, -190);
  const c: Record<number, number> = {};
  for (const t of txs()) if (t.d >= from && pred(t)) c[+t.d.slice(8)] = (c[+t.d.slice(8)] || 0) + 1;
  const best = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  return best ? +best[0] : fallback;
}
let rhythm: { salary: number | null; rent: number | null } | null = null;
onCustomerChange(() => (rhythm = null));
/** Asiakkaan tyypillinen palkkapäivä ja vuokrapäivä hänen omista tapahtumistaan (null = ei tunnistettavissa) */
export function rhythms() {
  if (!rhythm) rhythm = { salary: modeDay((t) => t.ty === 'salary', null), rent: modeDay((t) => t.ty === 'housing_payment', null) };
  return rhythm;
}

/* ---------------- kuukauden tilanne ---------------- */

const isSpend = (t: { a: number; ty: string }) => t.a < 0 && (t.ty === 'purchase' || t.ty === 'utilities_payment' || t.ty === 'housing_payment');
const isIncome = (t: { a: number; ty: string }) => t.a > 0 && (t.ty === 'salary' || t.ty === 'other_income');

export function monthStatus(ym = TODAY.slice(0, 7)) {
  const list = txs().filter((t) => t.d.startsWith(ym));
  const income = list.filter(isIncome).reduce((s, t) => s + t.a, 0);
  const spend = list.filter(isSpend).reduce((s, t) => s - t.a, 0);
  const saved = list.filter((t) => t.ty === 'investment_deposit' || t.ty === 'salary_sweep').reduce((s, t) => s - t.a, 0);
  const byCat: Record<string, number> = {};
  for (const t of list.filter(isSpend)) byCat[t.c] = (byCat[t.c] || 0) - t.a;
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const lastDay = list.length ? list[list.length - 1].d : `${ym}-01`;
  return { ym, income, spend, saved, net: income - spend, byCat, top, through: lastDay, complete: ym < TODAY.slice(0, 7) || TODAY.endsWith('-30') || TODAY.endsWith('-31') };
}

/** Miksi rahaa jäi vähemmän? Kahden kuukauden ero luokittain (Change Detective). */
export function changeBetween(ymA: string, ymB: string) {
  const a = monthStatus(ymA);
  const b = monthStatus(ymB);
  const cats = new Set([...Object.keys(a.byCat), ...Object.keys(b.byCat)]);
  const diffs = [...cats]
    .map((c) => ({ key: c, label: CAT_FI[c] ?? c, from: a.byCat[c] || 0, to: b.byCat[c] || 0, delta: (b.byCat[c] || 0) - (a.byCat[c] || 0) }))
    .filter((d) => Math.abs(d.delta) >= 1)
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  return { a, b, incomeDelta: b.income - a.income, spendDelta: b.spend - a.spend, netDelta: b.net - a.net, diffs };
}

/* ---------------- selviytymisaika (runway) ---------------- */

/** Kuinka monta päivää nykyinen saldo riittää, jos tuloja ei tulisi (välttämättömät / kaikki menot). */
export function runway() {
  const b = baskets(6);
  const essentialDaily = (b.totals.regular + b.totals.irregular) / 30.4;
  const allDaily = (b.totals.regular + b.totals.irregular + b.totals.slipping) / 30.4;
  return {
    balance: BALANCE_NOW,
    essentialMonthly: b.totals.regular + b.totals.irregular,
    allMonthly: b.totals.regular + b.totals.irregular + b.totals.slipping,
    daysEssential: essentialDaily > 0 ? Math.max(0, Math.floor(BALANCE_NOW / essentialDaily)) : null,
    daysAll: allDaily > 0 ? Math.max(0, Math.floor(BALANCE_NOW / allDaily)) : null,
  };
}

/* ---------------- safe-to-save ---------------- */

/**
 * Turvallinen säästövara: paljonko voisi siirtää säästöön kuukausittain vaarantamatta välttämättömiä menoja.
 * Perustuu asiakkaan omien kuukausien ylijäämiin (tulot − kulutus) viimeiseltä 6 kk:lta: käytetään
 * heikoimman puolen mediaania (varovainen arvio), ja tarkistetaan ennusteella, ettei saldo käy miinuksella.
 */
export function safeToSave(base = { rentDelta: 0, incomeDelta: 0 }) {
  const ms = lastMonths(7).slice(0, 6);
  const nets = ms.map((ym) => monthStatus(ym).net).sort((a, b) => a - b);
  const cautious = nets[Math.floor(nets.length / 4)]; // alakvartiili: tiukimpien kuukausien taso
  const median = nets[Math.floor(nets.length / 2)];
  const ceiling = Math.max(0, Math.floor(((cautious + base.incomeDelta - base.rentDelta) * 0.8) / 10));
  const until = addDays(TODAY, 90);
  // Same seeded paths make risk monotone in the transfer amount. Search €10 steps.
  let lo = 0, hi = ceiling;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const sim = simulate({ until, ...base, monthlySaving: mid * 10 });
    if (sim.min50 >= 0 && sim.probNegative <= 0.1) lo = mid; else hi = mid - 1;
  }
  const suggestion = lo * 10;
  const check = simulate({ until, ...base, monthlySaving: suggestion });
  return {
    months: ms,
    monthlySurplus: ms.map((ym) => ({ ym, net: monthStatus(ym).net })),
    cautiousSurplus: cautious,
    medianSurplus: median,
    suggestion,
    probNegative: check?.probNegative ?? null,
    minBalance: check?.min50 ?? null,
    method: 'Lähtötaso on 80 % kuuden täyden kuukauden alakvartiilin ylijäämästä. Summaa pienennetään 10 euron askelin, kunnes 90 päivän mallinnettu miinusriski on enintään 10 %. Tämä on valittu varovaisuusraja, ei turvallisuustakuu. Puuttuvat menot ja tulot voivat muuttaa arviota.',
  };
}

/* ---------------- skenaariot (monivaiheiset mitä jos -ketjut) ---------------- */

export type Scenario = {
  name: string;
  changes: Partial<Record<LeverKey, number>>; // prosenttimuutos, −30 = vähennä 30 %
  purchases: { date: string; amount: number; label: string }[];
  incomeDelta: number;
  rentDelta: number;
  monthlySaving: number;
};
let scenarios: Record<string, Scenario> = {};
onCustomerChange(() => (scenarios = {}));
export function getScenarios() {
  return scenarios;
}
export function restoreScenarios(value: Record<string, Scenario>) {
  scenarios = JSON.parse(JSON.stringify(value));
}
export function upsertScenario(name: string, patch: Partial<Scenario> & { addPurchase?: Scenario['purchases'][number]; removePurchase?: string; removeChange?: string }) {
  if (!name.trim() || name.length > 120 || ['__proto__', 'constructor', 'prototype'].includes(name)) throw new Error('Anna skenaariolle lyhyt nimi.');
  for (const [key, value] of Object.entries(patch.changes ?? {})) if (!Object.hasOwn(LEVER_FI, key) || !Number.isFinite(value) || value! < -100 || value! > 500) throw new Error('Menomuutos on välillä −100…500 %.');
  for (const value of [patch.incomeDelta, patch.rentDelta, patch.monthlySaving]) if (value != null && !Number.isFinite(value)) throw new Error('Muutoksen pitää olla luku.');
  if (patch.monthlySaving != null && patch.monthlySaving < 0) throw new Error('Säästösiirto ei voi olla negatiivinen.');
  if (patch.addPurchase) {
    const p = patch.addPurchase;
    if (!Number.isFinite(p.amount) || p.amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(p.date) || !Number.isFinite(daysBetween(TODAY, p.date)) || addDays(p.date, 0) !== p.date || p.date < TODAY || daysBetween(TODAY, p.date) > 700) throw new Error('Ostos tarvitsee positiivisen summan ja kelvollisen tulevan päivämäärän (enintään 700 päivää).');
  }
  const s: Scenario = scenarios[name] ? JSON.parse(JSON.stringify(scenarios[name])) : { name, changes: {}, purchases: [], incomeDelta: 0, rentDelta: 0, monthlySaving: 0 };
  if (patch.purchases) s.purchases = JSON.parse(JSON.stringify(patch.purchases));
  if (patch.changes) s.changes = { ...s.changes, ...patch.changes };
  if (patch.removeChange) delete s.changes[patch.removeChange as LeverKey];
  if (patch.addPurchase) s.purchases = [...s.purchases.filter((p) => p.label !== patch.addPurchase!.label), patch.addPurchase];
  if (patch.removePurchase) s.purchases = s.purchases.filter((p) => p.label !== patch.removePurchase);
  if (patch.incomeDelta != null) s.incomeDelta = patch.incomeDelta;
  if (patch.rentDelta != null) s.rentDelta = patch.rentDelta;
  if (patch.monthlySaving != null) s.monthlySaving = patch.monthlySaving;
  scenarios[name] = s;
  return s;
}
export function deleteScenario(name?: string) {
  if (name) delete scenarios[name];
  else scenarios = {};
}

export function simScenario(s: Scenario | null, until: string, base: { rentDelta: number; incomeDelta: number }): SimResult {
  const opts: SimOpts = { until, rentDelta: base.rentDelta, incomeDelta: base.incomeDelta };
  if (s) {
    const mult: Partial<Record<LeverKey, number>> = {};
    for (const [k, v] of Object.entries(s.changes)) mult[k as LeverKey] = Math.max(0, 1 + (v ?? 0) / 100);
    opts.leverMult = mult;
    opts.oneOffs = s.purchases.map((p) => ({ date: p.date, amount: p.amount, label: p.label }));
    opts.incomeDelta = base.incomeDelta + s.incomeDelta;
    opts.rentDelta = base.rentDelta + s.rentDelta;
    opts.monthlySaving = s.monthlySaving;
  }
  return simulate(opts);
}

/** Viikoittaiset pisteet kaavioon (mediaanipolku) */
export function weekly(sim: SimResult) {
  const labels: string[] = [];
  const values: number[] = [];
  sim.dates.forEach((d, i) => {
    if (i % 7 === 6 || i === sim.dates.length - 1) {
      labels.push(`${+d.slice(8)}.${+d.slice(5, 7)}.`);
      values.push(Math.round(sim.p50[i]));
    }
  });
  return { labels, values };
}

/* ---------------- tavoitteet ja optimointi ---------------- */

/** Säästötavoite → kuukausitavoite → jopa kolme erilaista optimoitua suunnitelmaa */
export function goalPlans(amount: number, byDate: string | null, monthly: number | null, prefs: Prefs, base = { rentDelta: 0, incomeDelta: 0 }, kind: 'saving' | 'balance' = 'saving') {
  if (!Number.isFinite(monthly ?? amount) || (monthly ?? amount) <= 0) throw new Error('Tarvitsen tavoitesumman tai kuukausisäästön.');
  if (byDate && (!/^\d{4}-\d{2}-\d{2}$/.test(byDate) || addDays(byDate, 0) !== byDate || daysBetween(TODAY, byDate) < 1 || daysBetween(TODAY, byDate) > 730)) throw new Error('Anna tuleva tavoitepäivä enintään kahden vuoden päähän aineiston nykyhetkestä.');
  if (kind === 'balance' && !byDate) throw new Error('Saldotavoite tarvitsee päivämäärän.');
  const until = byDate ?? addDays(TODAY, 92);
  const current = simulate({ until, ...base });
  const payments = simulate({ until, ...base, monthlySaving: 1 }).saved;
  if (byDate && kind === 'saving' && !payments) throw new Error('Ennen tavoitepäivää ei ole yhtään ennakoitua säästösiirtopäivää. Tutkitaan käyttövaraa tai myöhempää tavoitepäivää.');
  const target = kind === 'balance' ? amount : monthly ?? (byDate ? Math.ceil(amount / payments * 100) / 100 : amount);
  const baseline = salaryMonthly() + base.incomeDelta - monthlyAvg(isSpend) - base.rentDelta;
  const cutNeeded = kind === 'balance' ? Math.max(0, (amount - current.end.p50) / (daysBetween(TODAY, until) / 30.4)) : Math.max(0, target - baseline);
  const labels: Record<Strategy, string> = { gentle: 'Pienet arkimuutokset', few_changes: 'Harvempi muutettava meno', spread: 'Säästö useasta kohteesta' };
  const candidates = (['gentle', 'few_changes', 'spread'] as Strategy[]).map(strategy => ({ plan: optimize(cutNeeded, prefs, [], strategy), label: labels[strategy] }));
  for (const item of candidates[0].plan.items.slice(0, 2)) candidates.push({ plan: optimize(cutNeeded, prefs, [item.key]), label: `Säilytä ${item.label.toLowerCase()} ennallaan` });
  const seen = new Set<string>();
  const evaluate = ({ plan, label }: typeof candidates[number]) => {
    const scenario: Scenario = { name: label, changes: Object.fromEntries(plan.items.map(i => [i.key, -i.pct])), purchases: [], incomeDelta: 0, rentDelta: 0, monthlySaving: kind === 'saving' ? target : 0 };
    const sim = simScenario(scenario, until, base);
    return { ...plan, label, scenario, netMonthly: baseline + plan.total, cashflowAcceptable: plan.feasible && sim.min50 >= 0 && sim.probNegative <= 0.1 && (kind !== 'balance' || sim.end.p50 >= amount), forecast: { min: sim.min50, risk: sim.probNegative, end: sim.end.p50, saved: sim.saved }, explanation: plan.strategy === 'few_changes' ? 'Muutetaan harvempaa menolajia, mutta yksittäinen vähennys voi olla suurempi.' : plan.strategy === 'spread' ? 'Vähennykset jakautuvat useampaan menolajiin.' : 'Haku suosii maltillisia prosenttimuutoksia ja huomioi aiemmat toiveenne.' };
  };
  const evaluated = candidates.map(evaluate);
  // A monthly surplus alone is insufficient: explore additional headroom when
  // expense timing or variability fails the daily cashflow guard.
  const capacity = levers().filter(l => !prefs.protected.includes(l.key)).reduce((sum, l) => sum + l.base * Math.max(...l.levels) / 100, 0);
  if (evaluated.filter(p => p.cashflowAcceptable).length < 3 && capacity > cutNeeded) {
    for (const fraction of [0.25, 0.5, 1]) {
      for (const strategy of ['gentle', 'few_changes', 'spread'] as Strategy[]) {
        const searched = optimize(cutNeeded + (capacity - cutNeeded) * fraction, prefs, [], strategy);
        const candidate = { plan: { ...searched, target: cutNeeded, feasible: searched.total + 1e-8 >= cutNeeded }, label: labels[strategy] };
        candidates.push(candidate); evaluated.push(evaluate(candidate));
      }
    }
  }
  const labelsSeen = new Set<string>();
  const out = evaluated.sort((a, b) => Number(b.cashflowAcceptable) - Number(a.cashflowAcceptable) || Number(b.feasible) - Number(a.feasible) || a.total - b.total).filter(plan => {
    const key = JSON.stringify(plan.items.map(i => [i.key, i.pct]).sort());
    if (seen.has(key) || labelsSeen.has(plan.label)) return false;
    seen.add(key); labelsSeen.add(plan.label); return true;
  }).slice(0, 3);
  return { target, kind, months: byDate ? payments : null, until, baseline, cutNeeded, plans: out, branches: candidates.reduce((s, c) => s + (c.plan.branches ?? 0), 0), method: 'Vaihtoehtohaku asiakkaan kuuden kuukauden menojen rajatuilla vähennystasoilla. Suojattuja menoja ei leikata. Tulo-oletus on havaittu palkka ja asiakkaan vahvistama muutos. Jokainen vaihtoehto tarkistetaan päiväkohtaisella ennusteella. Enintään 10 % mallinnettu miinusriski on varovaisuusraja, ei takuu. Säästösiirrot tehdään arvioituina palkkapäivinä. Kaikkia elämäntilanteen ratkaisuja ei voi mallintaa.' };
}

export const leverLabel = (k: string) => LEVER_FI[k as LeverKey] ?? k;

/* ---------------- kuukausipeli ---------------- */

export type GameQ =
  | { id: string; type: 'choice'; q: string; options: string[]; correct: number; why: string }
  | { id: string; type: 'number'; q: string; answer: number; tolerance: number; unit: string; why: string };

const eurS = (n: number) => `${Math.round(n).toLocaleString('fi-FI').replace(/ /g, ' ')} €`;

/**
 * Kuukauden talouspeli: asiakkaan EDELLISEN täyden kuukauden omista tapahtumista.
 * Aina 3 monivalintaa + 2 omaa arviota (numerovastaus). Jos jokin kysymys ei sovi asiakkaan dataan
 * (esim. liian vähän menoluokkia), käytetään hänen datastaan muodostettua varakysymystä.
 */
export function monthlyGame(ym: string): { ym: string; questions: GameQ[] } {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym) || ym > TODAY.slice(0, 7)) throw new Error('Valitkaa kuukausi, jolta tilitapahtumia on jo saatavilla.');
  const m = monthStatus(ym);
  const prevYm = lastMonths(2, ym)[0];
  const list = txs().filter((t) => t.d.startsWith(ym));
  if (!list.some(isSpend)) throw new Error('Tältä kuukaudelta ei ole riittävästi omia menotapahtumia peliin. Valitkaa toinen kuukausi.');
  const choices: GameQ[] = [];
  const numbers: GameQ[] = [];
  // sekoitetaan vaihtoehtojen järjestys deterministisesti (sama peli samalle kuukaudelle)
  const rotate = <T,>(xs: T[], n: number) => xs.map((_, i) => xs[(i + n) % xs.length]);

  // M1) suurin menoluokka
  const top = m.top.filter(([c]) => c !== 'Housing');
  if (top.length >= 3 && top[0][1] - top[1][1] > 0.005) {
    const opts = [top[0], top[1], top[2]].map(([c]) => CAT_FI[c] ?? c);
    const shown = rotate(opts, 1);
    choices.push({
      id: 'top',
      type: 'choice',
      q: 'Mihin menoluokkaan (asumista lukuun ottamatta) kului eniten rahaa?',
      options: shown,
      correct: shown.indexOf(opts[0]),
      why: `${opts[0]}: ${eurS(top[0][1])}. Toisena ${opts[1]} ${eurS(top[1][1])}. Kuukauden yhteissumma kertoo enemmän kuin yksittäisen ostoksen hinta: pienetkin ostokset kertyvät.`,
    });
  }
  // M2) jäikö plussalle
  choices.push({
    id: 'net',
    type: 'choice',
    q: 'Jäikö kuukausi plussalle vai miinukselle, kun tuloista vähennetään menot?',
    options: ['Yli 100 € plussalle', 'Enintään 100 € plussalle tai miinukselle', 'Yli 100 € miinukselle'],
    correct: m.net > 100 ? 0 : m.net < -100 ? 2 : 1,
    why: `Tulot ${eurS(m.income)} − menot ${eurS(m.spend)} = ${m.net >= 0 ? '+' : '−'}${eurS(Math.abs(m.net))}. Tämä kertoo, kattaako kuukauden tulo kulutuksen. Se ei ole sama kuin tilin saldo: aiemmat rahat ja säästösiirrot vaikuttavat saldoon myös.`,
  });
  // M3) suurin muutos edelliskuuhun
  const ch = changeBetween(prevYm, ym).diffs.filter((d) => d.key !== 'Housing');
  if (ch.length >= 3 && Math.abs(ch[0].delta) - Math.abs(ch[1].delta) > 0.005 && txs().some(t => t.d.startsWith(prevYm) && isSpend(t))) {
    const opts = ch.slice(0, 3).map((d) => d.label);
    const shown = rotate(opts, 2);
    choices.push({
      id: 'change',
      type: 'choice',
      q: 'Minkä menoluokan summa muuttui eniten edelliskuusta (asumista lukuun ottamatta)?',
      options: shown,
      correct: shown.indexOf(opts[0]),
      why: `${ch[0].label}: ${eurS(ch[0].from)} → ${eurS(ch[0].to)} (${ch[0].delta >= 0 ? '+' : '−'}${eurS(Math.abs(ch[0].delta))}). Muutos auttaa huomaamaan, mikä omassa arjessa vaikutti rahojen riittävyyteen. Yksi kuukausi ei vielä kerro pysyvästä tavasta.`,
    });
  }
  // varakysymys: kuukauden suurin yksittäinen ostos – mihin luokkaan se kuului?
  const buys = list.filter((t) => t.a < 0 && t.ty === 'purchase').sort((x, y) => x.a - y.a);
  const cats = [...new Set(list.filter((t) => t.a < 0 && t.ty === 'purchase').map((t) => t.c))];
  if (choices.length < 3 && buys.length && cats.length >= 3 && (!buys[1] || buys[1].a - buys[0].a > 0.005)) {
    const big = buys[0];
    const others = cats.filter((c) => c !== big.c).slice(0, 2);
    const opts = [big.c, ...others].map((c) => CAT_FI[c] ?? c);
    const shown = rotate(opts, 1);
    choices.push({
      id: 'biggest',
      type: 'choice',
      q: 'Kuukauden suurin yksittäinen ostos – mihin menoluokkaan se kuului?',
      options: shown,
      correct: shown.indexOf(opts[0]),
      why: `Suurin ostos oli ${eurS(-big.a)} (${opts[0]}) ${+big.d.slice(8)}.${+big.d.slice(5, 7)}.`,
    });
  }
  // varakysymys: minä viikonpäivänä kului eniten?
  if (choices.length < 3) {
    const DAYS = ['sunnuntaina', 'maanantaina', 'tiistaina', 'keskiviikkona', 'torstaina', 'perjantaina', 'lauantaina'];
    const byDay = new Array(7).fill(0);
    for (const t of list) if (t.a < 0 && t.ty === 'purchase') byDay[new Date(t.d + 'T12:00:00Z').getUTCDay()] -= t.a;
    const order = byDay.map((v, i) => [v, i] as const).sort((x, y) => y[0] - x[0]);
    const opts = [order[0][1], order[3][1], order[6][1]].map((i) => DAYS[i]);
    const shown = rotate(opts, 2);
    if (order[0][0] - order[1][0] > 0.005) choices.push({
      id: 'weekday',
      type: 'choice',
      q: 'Minä viikonpäivänä ostoksiin kului kuukauden aikana eniten rahaa?',
      options: shown,
      correct: shown.indexOf(opts[0]),
      why: `Eniten kului ${opts[0]}: yhteensä ${eurS(order[0][0])}.`,
    });
  }
  // Toimii myös vähäisellä tapahtumamäärällä; tasatulos on oma oikea vaihtoehtonsa.
  if (choices.length < 3) {
    const first = list.filter(t => isSpend(t) && +t.d.slice(8) <= 15).reduce((s, t) => s - t.a, 0);
    const second = m.spend - first;
    choices.push({ id: 'timing', type: 'choice', q: 'Kummalla puolella kuuta menoihin kului enemmän rahaa?', options: ['Päivinä 1–15', 'Päivästä 16 kuun loppuun', 'Molemmilla yhtä paljon'], correct: Math.abs(first - second) < 0.005 ? 2 : first > second ? 0 : 1, why: `Päivinä 1–15 kului ${eurS(first)} ja loppukuussa ${eurS(second)}. Menojen ajoitus ratkaisee, milloin rahaa pitää olla tilillä, vaikka kuukauden yhteissumma olisi sama.` });
  }
  // A1) kokonaismenot (oma arvio)
  if (choices.length < 3) {
    const count = list.filter(isSpend).length;
    choices.push({ id: 'frequency', type: 'choice', q: 'Kuinka monta menotapahtumaa kuukaudessa oli?', options: ['Yksi', '2–5 tapahtumaa', 'Yli 5 tapahtumaa'], correct: count === 1 ? 0 : count <= 5 ? 1 : 2, why: `Menotapahtumia oli ${count}. Ostosten tiheys vaikuttaa kuukauden menoihin yhdessä niiden hinnan kanssa. Pelkkä yhden ostoksen hinta ei kerro koko kuvaa.` });
  }
  numbers.push({ id: 'spend', type: 'number', q: 'Arvioikaa: paljonko menoja (ostot, laskut ja asuminen) kertyi kuukaudessa yhteensä?', answer: Math.round(m.spend), tolerance: 0.15, unit: '€', why: `Menoja kertyi ${eurS(m.spend)}. Säästöön siirretty raha ei ole kulutusta, joten säästösiirrot eivät sisälly tähän. Kuukausisumma auttaa suunnittelemaan, kuinka paljon tulevista tuloista on varattava arkeen.` });
  // A2) arjen lipsuvat menot (oma arvio) – kolmen korin opetus
  let slip = 0;
  for (const t of list) if (isSpend(t) && basketOf(t.c, t.mcc) === 'slipping') slip -= t.a;
  numbers.push({
    id: 'slip',
    type: 'number',
    q: 'Arvioikaa: paljonko kului "arjen lipsuviin" menoihin (ravintolat, viihde, shoppailu, taksit…)?',
    answer: Math.round(slip),
    tolerance: 0.2,
    unit: '€',
    why: `Arjen lipsuviin menoihin kului ${eurS(slip)} – se on ${m.spend > 0 ? Math.round((slip / m.spend) * 100) : 0} % kaikista menoista. Näihin menoihin voi usein itse vaikuttaa. Kaikesta mukavasta ei silti tarvitse luopua: olennaista on valita, mikä on teille tärkeää.`,
  });
  const [c1, c2, c3] = choices;
  const questions = [c1, numbers[0], c2, c3, numbers[1]].filter(Boolean) as GameQ[];
  return { ym, questions };
}

/** Pisteytys: monivalinta oikein 2 p. Oma arvio: toleranssin sisällä 2 p, kaksinkertaisen sisällä 1 p. Max 10. */
export function parseGameAnswer(answer: string): number | null {
  const text = answer.trim().replace(/\s/g, '').replace(/(?:€|eur)$/i, '');
  if (!/^\+?\d+(?:[,.]\d{1,2})?$/.test(text)) return null;
  const value = Number(text.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

export function gamePoints(q: GameQ, answer: number | string): number {
  if (q.type === 'choice') return answer === q.correct ? 2 : 0;
  const v = typeof answer === 'number' ? answer : parseGameAnswer(answer);
  if (v === null || !Number.isFinite(v) || v < 0) return 0;
  const diff = Math.abs(v - q.answer);
  const tol = Math.max(10, Math.abs(q.answer) * q.tolerance);
  return diff <= tol ? 2 : diff <= tol * 2 ? 1 : 0;
}

/** Kuponki pisteiden mukaan (palkitsemiskonsepti – ei oikea S-Bonus-etu) */
export function gameCoupon(points: number, max: number) {
  const share = max > 0 ? points / max : 0;
  if (share >= 0.9) return { level: 'Talousmestari', discount: 15 };
  if (share >= 0.6) return { level: 'Talousosaaja', discount: 10 };
  if (share >= 0.3) return { level: 'Talousoppija', discount: 5 };
  return { level: 'Harjoittelija', discount: 2 };
}

export { incomeMonthly, rentMonthly, recurring };
