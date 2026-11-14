import raw from '../data/customer.json';
import { paymentPatterns } from './paymentPatterns';
import { Basket, basketOf, CAT_FI, MCC_FI } from './categories';

export type Tx = {
  account?: string; // alkuperäinen bank_account_id
  d: string; // YYYY-MM-DD
  t: string; // HH:MM:SS
  c: string; // kategoria
  a: number; // summa, negatiivinen = meno
  b: number; // saldo tapahtuman jälkeen
  ty: string;
  m: string | null;
  mcc: number | null;
  demo?: boolean;
  name?: string;
};

// Aineiston viimeinen päivä toimii "tänään"-päivänä (kaikkien asiakkaiden data päättyy 2026-09-30 tienoille)
export const TODAY = '2026-09-30';

/**
 * VALITTU ASIAKAS. Kaikki laskenta tässä moduulissa (ja forecast/optimizer) lukee näitä,
 * joten asiakkaan vaihtaminen setCustomerData():lla vaihtaa koko talouden.
 * Data tulee palvelimelta (/api/customer?id=…, Junction 2026 S-Pankki -aineisto, 5 100 asiakasta).
 */
export type CustomerInfo = { id: string; age: number; postal?: string };
export let CUSTOMER: CustomerInfo = raw.customer as CustomerInfo;
let BASE = raw.transactions as Tx[];
export let BALANCE_NOW = BASE[BASE.length - 1].b;
/** Asiakkaan asuntolainahakemus (vain ~200 asiakkaalla aineistossa), muuten null */
export type Mortgage = { final: Record<string, any>; events: Record<string, any>[] };
export let MORTGAGE: Mortgage | null = null;
let version = 0;
const listeners: (() => void)[] = [];

export function setCustomerData(data: { customer: CustomerInfo; transactions: Tx[]; mortgage?: Mortgage }) {
  CUSTOMER = data.customer;
  MORTGAGE = data.mortgage ?? null;
  BASE = [...data.transactions].sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t));
  BALANCE_NOW = BASE.length ? BASE[BASE.length - 1].b : 0;
  cache = null;
  version++;
  PEER = {};
  PEER_N = 0;
  PEER_GROUP = '';
  listeners.forEach((f) => f());
}
/**
 * Asiakkaiden välinen vertailu (synteettinen aineisto): saman ikäryhmän MEDIAANI kategorioittain €/kk,
 * laskettu palvelimella samalta 12 kk jaksolta (/api/peers). Täytetään asiakkaan vaihtuessa.
 * HUOM: tämä EI ole Suomen väestö – Tilastokeskuksen luvut ovat erikseen (statfin-työkalut).
 */
export let PEER: Record<string, number> = {};
export let PEER_N = 0;
export let PEER_GROUP = '';
export function setPeerMedians(medians: Record<string, number>, n: number, group: string) {
  PEER = medians;
  PEER_N = n;
  PEER_GROUP = group;
}

/** kasvaa jokaisella asiakkaan vaihdolla (välimuistien mitätöintiin) */
export function dataVersion() {
  return version;
}
export function onCustomerChange(f: () => void) {
  listeners.push(f);
}

/* ---------------- päivämäärät ja muotoilu ---------------- */

export const MONTH_FI = [
  'tammikuu', 'helmikuu', 'maaliskuu', 'huhtikuu', 'toukokuu', 'kesäkuu',
  'heinäkuu', 'elokuu', 'syyskuu', 'lokakuu', 'marraskuu', 'joulukuu',
];
export const MONTH_FI_SSA = [
  'tammikuussa', 'helmikuussa', 'maaliskuussa', 'huhtikuussa', 'toukokuussa', 'kesäkuussa',
  'heinäkuussa', 'elokuussa', 'syyskuussa', 'lokakuussa', 'marraskuussa', 'joulukuussa',
];
export const WEEKDAY_FI = ['sunnuntai', 'maanantai', 'tiistai', 'keskiviikko', 'torstai', 'perjantai', 'lauantai'];

export function toDate(iso: string) {
  return new Date(iso + 'T12:00:00Z');
}
export function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}
export function addDays(s: string, n: number) {
  const d = toDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}
export function daysBetween(a: string, b: string) {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86400000);
}
export function monthName(ym: string, ssa = false) {
  const m = +ym.slice(5, 7) - 1;
  return (ssa ? MONTH_FI_SSA : MONTH_FI)[m];
}
export function fmtDate(s: string) {
  return `${+s.slice(8, 10)}.${+s.slice(5, 7)}.${s.slice(0, 4)}`;
}
export function fmtDay(s: string) {
  return `${+s.slice(8, 10)}.${+s.slice(5, 7)}.`;
}
/** 1 753,90 € */
export function eur(n: number, decimals = 2) {
  const neg = n < 0;
  const v = Math.abs(n).toFixed(decimals);
  const [i, f] = v.split('.');
  const ii = i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (neg ? '−' : '') + ii + (f ? ',' + f : '') + ' €';
}
export const eur0 = (n: number) => eur(n, 0);

/** viimeiset n kuukautta muodossa YYYY-MM, uusin viimeisenä */
export function lastMonths(n: number, end = TODAY.slice(0, 7)) {
  const out: string[] = [];
  let y = +end.slice(0, 4);
  let m = +end.slice(5, 7);
  for (let i = 0; i < n; i++) {
    out.unshift(`${y}-${String(m).padStart(2, '0')}`);
    m--;
    if (m === 0) {
      m = 12;
      y--;
    }
  }
  return out;
}

/* ---------------- demotapahtumat (merkitty selkeästi) ---------------- */

function demoTxs(): Tx[] {
  const out: Tx[] = [];
  const months = lastMonths(8);
  months.forEach((ym, i) => {
    out.push({ d: `${ym}-05`, t: '03:12:00', c: 'Subscriptions', a: -12.99, b: 0, ty: 'purchase', m: 'DEMO-STREAM-A', mcc: 4899, demo: true, name: 'Suoratoisto A' });
    if (i >= 2)
      out.push({ d: `${ym}-19`, t: '04:40:00', c: 'Subscriptions', a: ym >= '2026-07' ? -11.99 : -8.99, b: 0, ty: 'purchase', m: 'DEMO-STREAM-B', mcc: 4899, demo: true, name: 'Suoratoisto B' });
    out.push({ d: `${ym}-01`, t: '06:00:00', c: 'Subscriptions', a: -34.9, b: 0, ty: 'purchase', m: 'DEMO-GYM', mcc: 7997, demo: true, name: 'Kuntosali' });
    if (ym >= '2026-05')
      out.push({ d: `${ym}-02`, t: '02:17:00', c: 'Subscriptions', a: -14.9, b: 0, ty: 'purchase', m: 'DEMO-UNK', mcc: null, demo: true, name: 'PAYSRV*7731 LTD' });
  });
  return out;
}

// Demotapahtumat ovat keksittyjä → oletuksena POIS. Kaikki näytettävät summat tulevat asiakkaan omasta datasta.
let demoOn = false;
let cache: Tx[] | null = null;
export function setDemo(v: boolean) {
  demoOn = v;
  cache = null;
}
export function isDemo() {
  return demoOn;
}
export function txs(): Tx[] {
  if (!cache) {
    cache = [...BASE, ...(demoOn ? demoTxs() : [])].sort((x, y) => (x.d + x.t).localeCompare(y.d + y.t));
  }
  return cache;
}

export function labelOf(tx: Tx) {
  if (tx.name) return tx.name;
  if (tx.mcc && MCC_FI[tx.mcc]) return MCC_FI[tx.mcc];
  return CAT_FI[tx.c] ?? tx.c;
}
export function merchantName(tx: Tx) {
  if (tx.name) return tx.name;
  if (!tx.m) return CAT_FI[tx.c] ?? tx.c;
  return `${labelOf(tx)} · ${tx.m}`;
}

/* ---------------- perussummat ---------------- */

export const isOut = (t: Tx) => t.a < 0 && basketOf(t.c, t.mcc) !== null;

export function sumOut(pred: (t: Tx) => boolean, from: string, to: string) {
  let s = 0;
  for (const t of txs()) if (t.d >= from && t.d <= to && t.a < 0 && pred(t)) s -= t.a;
  return s;
}

export function monthRange(ym: string): [string, string] {
  return [`${ym}-01`, `${ym}-31`];
}

export function monthlyAvg(pred: (t: Tx) => boolean, n = 6) {
  const ms = lastMonths(n);
  const [from] = monthRange(ms[0]);
  const [, to] = monthRange(ms[ms.length - 1]);
  return sumOut(pred, from, to) / n;
}

export function salaryMonthly(n = 6) {
  const ms = lastMonths(n);
  let s = 0;
  for (const t of txs()) if (t.ty === 'salary' && t.d >= `${ms[0]}-01` && t.d <= `${ms[n - 1]}-31`) s += t.a;
  return s / n;
}

/** Toteutuneet tulot: palkka ja muut tulot; siirrot/sijoitusnostot eivät ole tuloa. */
export function incomeMonthly(n = 6) {
  const from = `${lastMonths(n)[0]}-01`;
  return txs().filter(t => t.d >= from && t.d <= TODAY && t.a > 0 && ['salary', 'other_income'].includes(t.ty)).reduce((sum, t) => sum + t.a, 0) / n;
}

export function lastSalary() {
  const s = txs().filter((t) => t.ty === 'salary');
  return s[s.length - 1];
}

export function rentMonthly() {
  const r = txs().filter((t) => t.c === 'Housing').slice(-6);
  return r.reduce((s, t) => s - t.a, 0) / Math.max(1, r.length);
}

/* ---------------- kolme rahakoria ---------------- */

export type BasketItem = { label: string; amount: number };
export type Baskets = {
  months: number;
  income: number;
  totals: Record<Basket, number>;
  items: Record<Basket, BasketItem[]>;
  left: number;
};

export function baskets(n = 6): Baskets {
  const ms = lastMonths(n);
  const from = `${ms[0]}-01`;
  const to = `${ms[n - 1]}-31`;
  const totals: Record<Basket, number> = { regular: 0, irregular: 0, slipping: 0 };
  const items: Record<Basket, Record<string, number>> = { regular: {}, irregular: {}, slipping: {} };
  for (const t of txs()) {
    if (t.d < from || t.d > to || t.a >= 0) continue;
    const b = basketOf(t.c, t.mcc);
    if (!b) continue;
    totals[b] += -t.a / n;
    const lbl = t.c === 'Subscriptions' ? labelOf(t) : t.c === 'Housing' || t.c === 'Utilities' ? CAT_FI[t.c] : labelOf(t);
    items[b][lbl] = (items[b][lbl] || 0) + -t.a / n;
  }
  const income = incomeMonthly(n);
  const sorted = (o: Record<string, number>) =>
    Object.entries(o)
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.amount - a.amount);
  return {
    months: n,
    income,
    totals,
    items: { regular: sorted(items.regular), irregular: sorted(items.irregular), slipping: sorted(items.slipping) },
    left: income - totals.regular - totals.irregular - totals.slipping,
  };
}

/* ---------------- top-kulutuskohteet ---------------- */

export function topSinks(nMonths = 3, k = 3) {
  const ms = lastMonths(nMonths);
  const from = `${ms[0]}-01`;
  const g: Record<string, { sum: number; count: number }> = {};
  for (const t of txs()) {
    if (t.d < from || t.a >= 0) continue;
    if (basketOf(t.c, t.mcc) !== 'slipping') continue;
    const l = labelOf(t);
    g[l] = g[l] || { sum: 0, count: 0 };
    g[l].sum -= t.a;
    g[l].count++;
  }
  return Object.entries(g)
    .map(([label, v]) => ({
      label,
      monthly: v.sum / nMonths,
      perMonthCount: v.count / nMonths,
      avgTicket: v.sum / v.count,
      yearly: (v.sum / nMonths) * 12,
    }))
    .sort((a, b) => b.monthly - a.monthly)
    .slice(0, k);
}

/* ---------------- toistuvat maksut ja tilaukset ---------------- */

export type Recurring = {
  key: string;
  label: string;
  amount: number;
  day: number;
  months: number;
  priceChange?: { from: number; to: number; month: string };
  suspicious: boolean;
  demo: boolean;
  kind: 'rent' | 'bills' | 'subscription' | 'habit';
  evidence: string[];
  confidence: string;
  cadence: string | null;
  active: boolean;
};

export function recurring(): Recurring[] {
  return paymentPatterns(txs(), `${lastMonths(6)[0]}-01`, TODAY, 6)
    .filter(p => ['recurring', 'habit'].includes(p.status) && !['income', 'transfer'].includes(p.kind))
    .map(p => ({
      key: p.key,
      label: p.kind === 'housing' ? 'Asumismaksut' : p.kind === 'bills' ? 'Asumisen laskut (saajat puuttuvat)' : `${MCC_FI[p.mcc ?? 0] ?? CAT_FI[p.category] ?? p.category}${p.merchant ? ` · ${p.merchant}` : ''}`,
      amount: p.monthlyAmount, day: p.typicalDay ?? 0, months: p.months,
      suspicious: false, demo: false,
      kind: (p.kind === 'housing' ? 'rent' : p.kind === 'bills' ? 'bills' : p.kind === 'subscription' && p.status === 'recurring' ? 'subscription' : 'habit') as Recurring['kind'],
      evidence: p.evidence, confidence: p.confidence, cadence: p.cadence, active: p.active,
      priceChange: p.priceChange,
    }));
}

/* ---------------- poikkeamat ja epäselvät tapahtumat ---------------- */

export type Anomaly = {
  id: string;
  severity: 'info' | 'warn' | 'question';
  title: string;
  detail: string;
  question?: string;
  options?: string[];
};

export function anomalies(answered: Record<string, string> = {}): Anomaly[] {
  const out: Anomaly[] = [];
  const ms12 = lastMonths(12);
  const all = txs();
  // 1) vuokra puuttuu
  for (const ym of lastMonths(6)) {
    const hasRent = all.some((t) => t.c === 'Housing' && t.d.startsWith(ym));
    const active = all.some((t) => t.d.startsWith(ym) && t.ty === 'salary');
    if (!hasRent && active && all.filter(t => t.ty === 'housing_payment').length >= 3)
      out.push({
        id: `rent-${ym}`,
        severity: 'question',
        title: `${cap(monthName(ym))}n vuokra puuttuu`,
        detail: `Vuokra (noin ${eur0(rentMonthly())}) on tullut lähes joka kuu, mutta ${monthName(ym, true)} sitä ei näy tililläsi.`,
        question: `Miten ${monthName(ym, true)} vuokran kanssa kävi?`,
        options: ['Maksoin toiselta tililtä', 'Asuin muualla', 'Jäi maksamatta', 'En muista'],
      });
  }
  // 2) epäselvä tulo
  for (const t of all) {
    if (t.ty === 'other_income' && t.d >= `${ms12[0]}-01`)
      out.push({
        id: `inc-${t.d}`,
        severity: 'question',
        title: `Tuntematon tulo ${eur0(t.a)}`,
        detail: `Tilillesi tuli ${fmtDate(t.d)} ${eur(t.a)} muuna tulona. En halua laskea sitä säännölliseksi tuloksi, jos se oli kertaluontoinen.`,
        question: `Mikä oli ${fmtDay(t.d)} tullut ${eur0(t.a)}?`,
        options: ['Lahja tai perintö', 'Veronpalautus', 'Myin jotain', 'Palkkio tai bonus', 'Toistuva tulo'],
      });
  }
  // 3) hiljainen kuukausi
  const monthTotals = ms12.map((ym) => ({ ym, s: sumOut(isOut, `${ym}-01`, `${ym}-31`) }));
  const sortedS = [...monthTotals].map((x) => x.s).sort((a, b) => a - b);
  const median = sortedS[Math.floor(sortedS.length / 2)];
  for (const { ym, s } of monthTotals)
    if (s < median * 0.2)
      out.push({
        id: `quiet-${ym}`,
        severity: 'question',
        title: `Hiljainen ${monthName(ym)}`,
        detail: `${cap(monthName(ym, true))} kortillasi oli vain ${eur0(s)} menoja, kun tavallisesti niitä on noin ${eur0(median)}.`,
        question: `Mitä ${monthName(ym, true)} tapahtui?`,
        options: ['Olin matkoilla', 'Käytin toista korttia', 'Säästökuukausi', 'En muista'],
      });
  // 4) piikkikuukaudet
  const mean = monthTotals.reduce((s, x) => s + x.s, 0) / monthTotals.length;
  const sd = Math.sqrt(monthTotals.reduce((s, x) => s + (x.s - mean) ** 2, 0) / monthTotals.length);
  for (const { ym, s } of monthTotals)
    if (s > mean + 1.2 * sd)
      out.push({
        id: `spike-${ym}`,
        severity: 'warn',
        title: `Kallis ${monthName(ym)}`,
        detail: `${cap(monthName(ym, true))} menoja oli ${eur0(s)}, mikä on ${Math.round(((s - mean) / mean) * 100)} % enemmän kuin keskimäärin.`,
      });
  // 5) epäilyttävä toistuva veloitus
  for (const r of recurring())
    if (r.suspicious)
      out.push({
        id: `sus-${r.key}`,
        severity: 'question',
        title: `Tunnistatko veloituksen ${r.label}?`,
        detail: `Joka kuun ${r.day}. päivä tililtäsi lähtee ${eur(r.amount)} saajalle, jolla ei ole kauppiasluokkaa. Veloitus on tullut ${r.months} kuukautena, yleensä yöllä. Tällainen kuvio on tyypillinen unohtuneelle kokeilujaksolle tai huijaukselle.${r.demo ? ' (demotieto)' : ''}`,
        question: `Onko ${r.label} sinun tilaamasi palvelu?`,
        options: ['Kyllä, tunnistan', 'En tunnista', 'En ole varma'],
      });
  return out.filter((a) => !answered[a.id]);
}

/* ---------------- tottumukset ---------------- */

export function habits() {
  const ms = lastMonths(6);
  const from = `${ms[0]}-01`;
  const list = txs().filter((t) => t.d >= from && t.a < 0 && basketOf(t.c, t.mcc) === 'slipping' && t.c !== 'Subscriptions');
  const days = daysBetween(from, TODAY) + 1;
  // palkkapäiväefekti: asiakkaan oma palkkapäivä + 6 pv vs muut päivät
  const salaryDates = txs().filter(t => t.ty === 'salary' && t.a > 0).map(t => t.d);
  const isPayWeek = (date: string) => salaryDates.some(pay => { const gap = daysBetween(pay, date); return gap >= 0 && gap <= 6; });
  let afterPay = 0;
  let other = 0;
  let early = 0;
  let late = 0;
  let small = 0;
  let smallCount = 0;
  let night = 0;
  let nightCount = 0;
  const wd = [0, 0, 0, 0, 0, 0, 0];
  for (const t of list) {
    const day = +t.d.slice(8);
    const v = -t.a;
    if (isPayWeek(t.d)) afterPay += v;
    else other += v;
    if (day <= 10) early += v;
    if (day >= 21) late += v;
    if (v < 15) {
      small += v;
      smallCount++;
    }
    const h = +t.t.slice(0, 2);
    if (h >= 22 || h < 4) {
      night += v;
      nightCount++;
    }
    wd[toDate(t.d).getUTCDay()] += v;
  }
  const n = ms.length;
  let payDays = 0;
  for (let i = 0; i < days; i++) if (isPayWeek(addDays(from, i))) payDays++;
  const otherDays = days - payDays;
  const wdTotal = wd.reduce((s, x) => s + x, 0);
  const topWd = wd.indexOf(Math.max(...wd));
  return {
    payPerDay: payDays ? afterPay / payDays : 0,
    otherPerDay: otherDays ? other / otherDays : 0,
    payRatio: payDays && otherDays && other ? afterPay / payDays / (other / otherDays) : 0,
    earlyPerDay: early / (10 * n),
    latePerDay: late / (10.5 * n),
    smallPerMonth: small / n,
    smallCountPerMonth: smallCount / n,
    nightPerMonth: night / n,
    nightCountPerMonth: nightCount / n,
    topWeekday: WEEKDAY_FI[topWd],
    topWeekdayShare: wdTotal ? wd[topWd] / wdTotal : 0,
    weekendShare: wdTotal ? (wd[0] + wd[5] + wd[6]) / wdTotal : 0,
  };
}

export function spenderType() {
  const b = baskets();
  const h = habits();
  const spend = b.totals.regular + b.totals.irregular + b.totals.slipping;
  const slipShare = b.totals.slipping / spend;
  const saveRate = b.left / b.income;
  let type = 'Tasapainoilija';
  let desc = 'Käytät rahaa melko tasaisesti eikä mikään ryhmä hallitse.';
  if (h.payRatio > 1.4) {
    type = 'Palkkapäivän juhlija';
    desc = `Palkkapäivää seuraavalla viikolla kulutus on päivää kohti ${h.payRatio.toFixed(1).replace('.', ',')}-kertainen muihin päiviin verrattuna. Ajoitus ei yksin kerro ostosten syytä.`;
  } else if (slipShare > 0.35) {
    type = 'Elämysten metsästäjä';
    desc = `${Math.round(slipShare * 100)} % menoista kuuluu alustavasti joustaviin luokkiin. Vain Te tiedätte, mitkä niistä ovat arjessanne välttämättömiä.`;
  } else if (saveRate > 0.15) {
    type = 'Suunnitelmallinen säästäjä';
    desc = `Tulojen ja näkyvän kulutuksen erotus on noin ${Math.round(saveRate * 100)} % tuloista. Erotus ei yksin todista säästöjen tai varallisuuden kasvua.`;
  }
  return { type, desc, slipShare, saveRate, payRatio: h.payRatio };
}

/* ---------------- turvallinen käyttövara ---------------- */

/** Seuraava palkkapäivä asiakkaan OMAN palkkarytmin mukaan (tyypillinen päivä viim. ~6 kk) */
export function nextSalaryDate(from = TODAY) {
  const since = addDays(from, -190);
  const c: Record<number, number> = {};
  for (const t of txs()) if (t.d >= since && t.ty === 'salary') c[+t.d.slice(8)] = (c[+t.d.slice(8)] || 0) + 1;
  const best = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  const day = best ? +best[0] : 15;
  const d = toDate(from);
  let y = d.getUTCFullYear();
  let m = d.getUTCMonth() + 1;
  if (d.getUTCDate() >= day) {
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(Math.min(day, 28)).padStart(2, '0')}`;
}

export function safeToSpend() {
  const until = nextSalaryDate();
  const days = daysBetween(TODAY, until);
  const b = baskets();
  const rentDue = +TODAY.slice(8) < 8 || until.slice(0, 7) !== TODAY.slice(0, 7) ? rentMonthly() : 0;
  const bills = (monthlyAvg((t) => t.c === 'Utilities') * days) / 30;
  const groceries = (monthlyAvg((t) => t.c === 'Groceries') * days) / 30;
  const subs = recurring()
    .filter((r) => r.kind === 'subscription' && r.active)
    .reduce((s, r) => s + r.amount, 0);
  const buffer = b.totals.irregular * (days / 30);
  const free = BALANCE_NOW - rentDue - bills - groceries - subs - buffer;
  return {
    balance: BALANCE_NOW,
    until,
    days,
    rentDue,
    bills,
    groceries,
    subs,
    buffer,
    free,
    perWeek: Math.max(0, (free / days) * 7),
    perDay: Math.max(0, free / days),
  };
}

/* ---------------- kategoriakysely ---------------- */

export function spendQuery(pred: (t: Tx) => boolean, from: string, to: string) {
  const list = txs().filter((t) => t.d >= from && t.d <= to && t.a < 0 && pred(t));
  const sum = list.reduce((s, t) => s - t.a, 0);
  return { sum, count: list.length, list };
}

export function lastOutflows(limitEur: number, pred: (t: Tx) => boolean) {
  const out: Tx[] = [];
  let s = 0;
  const all = txs();
  for (let i = all.length - 1; i >= 0 && s < limitEur; i--) {
    const t = all[i];
    if (t.a < 0 && pred(t)) {
      out.push(t);
      s -= t.a;
    }
  }
  return out;
}

export function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
