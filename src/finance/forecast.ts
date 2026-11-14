import { addDays, BALANCE_NOW, onCustomerChange, daysBetween, salaryMonthly, lastMonths, recurring, rentMonthly, TODAY, txs } from './analytics';
import { basketOf, LeverKey, leverOf } from './categories';

export type SimOpts = {
  until: string;
  leverMult?: Partial<Record<LeverKey, number>>; // 0.7 = −30 %
  oneOffs?: { date: string; amount: number; label?: string }[]; // amount > 0 = meno
  incomeDelta?: number; // €/kk
  rentDelta?: number; // €/kk
  monthlySaving?: number; // siirto säästöön palkkapäivänä
  runs?: number;
  seed?: number;
};

export type SimResult = {
  dates: string[];
  p10: number[];
  p50: number[];
  p90: number[];
  end: { p10: number; p50: number; p90: number };
  min50: number;
  minDate: string;
  probNegative: number; // todennäköisyys että saldo käy miinuksella
  saved: number;
  assumptions?: string[];
};

type Day = Partial<Record<LeverKey | 'other', number>>;

let histCache: Day[] | null = null;
/** Viimeisen 180 päivän muuttuvat menot päivittäin vivuittain (bootstrap-otos) */
function history(): Day[] {
  if (histCache) return histCache;
  const from = addDays(TODAY, -179);
  const days: Day[] = Array.from({ length: 180 }, () => ({}));
  for (const t of txs()) {
    if (t.d < from || t.d > TODAY || t.a >= 0) continue;
    if (t.c === 'Housing' || t.c === 'Utilities' || t.c === 'Subscriptions') continue;
    if (!basketOf(t.c, t.mcc)) continue;
    const i = daysBetween(from, t.d);
    const k = (leverOf(t.c, t.mcc) ?? 'other') as LeverKey | 'other';
    days[i][k] = (days[i][k] || 0) - t.a;
  }
  histCache = days;
  return days;
}
/** asiakkaan tyypillinen tapahtumapäivä (moodi viim. ~6 kk) */
function dayOf(type: string, fallback: number) {
  const from = addDays(TODAY, -190);
  const c: Record<number, number> = {};
  for (const t of txs()) if (t.d >= from && t.ty === type) c[+t.d.slice(8)] = (c[+t.d.slice(8)] || 0) + 1;
  const best = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  return best ? +best[0] : fallback;
}

export function resetForecastCache() {
  histCache = null;
}
onCustomerChange(resetForecastCache);

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function simulate(o: SimOpts): SimResult {
  for (const value of [o.incomeDelta, o.rentDelta, o.monthlySaving, ...Object.values(o.leverMult ?? {})]) if (value != null && !Number.isFinite(value)) throw new Error('Ennusteen muutosten pitää olla kelvollisia lukuja.');
  if ((o.monthlySaving ?? 0) < 0 || Object.values(o.leverMult ?? {}).some(v => v! < 0)) throw new Error('Säästösiirto tai kulutuskerroin ei voi olla negatiivinen.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.until) || !Number.isFinite(daysBetween(TODAY, o.until)) || daysBetween(TODAY, o.until) < 1 || daysBetween(TODAY, o.until) > 730) throw new Error('Ennusteen loppupäivän tulee olla 1–730 päivää aineiston viimeisen päivän jälkeen.');
  for (const p of o.oneOffs ?? []) {
    if (!Number.isFinite(p.amount) || p.amount < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(p.date) || !Number.isFinite(daysBetween(TODAY, p.date)) || p.date < TODAY || p.date > o.until || addDays(p.date, 0) !== p.date) throw new Error('Ostoksen summa tai päivämäärä ei kuulu ennustejaksoon.');
  }
  if (addDays(o.until, 0) !== o.until) throw new Error('Ennusteen päivämäärä on virheellinen.');
  const runs = o.runs ?? 200;
  if (!Number.isInteger(runs) || runs < 1 || runs > 1000) throw new Error('Ennusteen otoskoko on 1–1000.');
  const rand = rng(o.seed ?? 42);
  const hist = history();
  const n = Math.max(1, daysBetween(TODAY, o.until));
  const salary = salaryMonthly() + (o.incomeDelta ?? 0);
  const rent = rentMonthly() + (o.rentDelta ?? 0);
  const months = lastMonths(6);
  const bills: Record<number, number> = {};
  for (const t of txs()) if (t.a < 0 && t.c === 'Utilities' && months.includes(t.d.slice(0, 7))) {
    const day = +t.d.slice(8);
    bills[day] = (bills[day] ?? 0) - t.a / months.length;
  }
  const subs = recurring().filter((r) => r.kind === 'subscription' && r.active);
  const mult = o.leverMult ?? {};
  const salaryDay = dayOf('salary', 15);
  const rentDay = dayOf('housing_payment', 1);
  const dates: string[] = [];
  for (let d = 1; d <= n; d++) dates.push(addDays(TODAY, d));

  // päivän kiinteät tapahtumat (sama kaikille ajoille)
  const fixed = dates.map((ds) => {
    const day = +ds.slice(8);
    const lastDay = new Date(Date.UTC(+ds.slice(0, 4), +ds.slice(5, 7), 0)).getUTCDate();
    const occurs = (d: number) => day === Math.min(d, lastDay);
    let v = 0;
    // asiakkaan omat rytmit (palkka- ja vuokrapäivä tunnistetaan hänen tapahtumistaan)
    if (occurs(salaryDay)) v += salary - (o.monthlySaving ?? 0);
    if (occurs(rentDay)) v -= rent;
    for (const [d, amount] of Object.entries(bills)) if (occurs(+d)) v -= amount;
    for (const s of subs) {
      if (!occurs(s.day)) continue;
      const lv = s.label.match(/kuntosali/i) ? 'Sport' : s.label.match(/suoratoisto/i) ? 'Streaming' : null;
      const m = lv ? (mult[lv as LeverKey] ?? 1) : 1;
      v -= s.amount * m;
    }
    for (const oo of o.oneOffs ?? []) if (oo.date === ds) v -= oo.amount;
    return v;
  });

  const paths: Float64Array[] = Array.from({ length: n }, () => new Float64Array(runs));
  let negRuns = 0;
  for (let r = 0; r < runs; r++) {
    let bal = BALANCE_NOW - (o.oneOffs ?? []).filter(p => p.date === TODAY).reduce((sum, p) => sum + p.amount, 0);
    let neg = bal < 0;
    for (let d = 0; d < n; d++) {
      const h = hist[Math.floor(rand() * hist.length)];
      let spend = 0;
      for (const k in h) spend += (h as any)[k] * ((mult as any)[k] ?? 1);
      bal += fixed[d] - spend;
      if (bal < 0) neg = true;
      paths[d][r] = bal;
    }
    if (neg) negRuns++;
  }
  const q = (arr: Float64Array, p: number) => {
    const s = Array.from(arr).sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(p * s.length))];
  };
  const p10: number[] = [];
  const p50: number[] = [];
  const p90: number[] = [];
  for (let d = 0; d < n; d++) {
    p10.push(q(paths[d], 0.1));
    p50.push(q(paths[d], 0.5));
    p90.push(q(paths[d], 0.9));
  }
  let min50 = BALANCE_NOW - (o.oneOffs ?? []).filter(p => p.date === TODAY).reduce((sum, p) => sum + p.amount, 0);
  let minDate = TODAY;
  p50.forEach((v, i) => {
    if (v < min50) {
      min50 = v;
      minDate = dates[i];
    }
  });
  const salaryDays = dates.filter((d) => +d.slice(8) === Math.min(salaryDay, new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7), 0)).getUTCDate())).length;
  return {
    dates,
    p10,
    p50,
    p90,
    end: { p10: p10[n - 1], p50: p50[n - 1], p90: p90[n - 1] },
    min50,
    minDate,
    probNegative: negRuns / runs,
    saved: (o.monthlySaving ?? 0) * salaryDays,
    assumptions: ['Ennuste käyttää asiakkaan historiallisia palkka-, asumis- ja laskurytmejä; tulevia eräpäiviä ei ole vahvistettu.', 'Muuttuvat menot poimitaan 180 päivän historiasta. Toistumattomia muita tuloja ei jatketa tulevaisuuteen.', 'Prosenttimuutos on laskennallinen oletus. Tilaushinnan muuttuminen edellyttää sopimusmuutosta.'],
  };
}
