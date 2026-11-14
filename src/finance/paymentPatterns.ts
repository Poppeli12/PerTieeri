import type { Tx } from './analytics';

export type PaymentPattern = {
  key: string; status: 'recurring' | 'habit' | 'one_off_candidate' | 'uncertain';
  kind: 'housing' | 'bills' | 'subscription' | 'income' | 'transfer' | 'purchase';
  confidence: 'high' | 'medium' | 'low'; evidence: string[];
  account: string | null; merchant: string | null; category: string; mcc: number | null; type: string;
  count: number; months: number; first: string; last: string; cadence: string | null;
  monthlyAmount: number; lastAmount: number; typicalDay: number | null; active: boolean;
  priceChange?: { from: number; to: number; month: string };
};
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return (s[Math.floor((s.length - 1) / 2)] + s[Math.floor(s.length / 2)]) / 2; };
const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86400000;
const round = (n: number) => Math.round(n * 100) / 100;
const kindOf = (t: Tx): PaymentPattern['kind'] => {
  if (['investment_deposit', 'salary_sweep', 'investment_withdrawal'].includes(t.ty)) return 'transfer';
  if (['salary', 'other_income'].includes(t.ty)) return 'income';
  if (t.ty === 'housing_payment') return 'housing';
  if (t.ty === 'utilities_payment') return 'bills';
  if (t.c === 'Subscriptions' || t.mcc === 4899 || t.mcc === 7997) return 'subscription';
  return 'purchase';
};
export function paymentKey(t: Tx) {
  // No price-based identity. Missing counterparties never merge unrelated purchases.
  const identity = t.m ?? (['housing', 'bills', 'income', 'transfer'].includes(kindOf(t)) ? 'type-group' : `${t.d}:${t.t}`);
  return JSON.stringify([t.account ?? null, t.ty, t.c, t.mcc, identity, t.a < 0]);
}

export function paymentPatterns(transactions: Tx[], from: string, to: string, windowMonths: number): PaymentPattern[] {
  const groups = new Map<string, Tx[]>();
  for (const t of transactions) {
    if (t.demo || t.d < from || t.d > to || !t.a) continue;
    const key = paymentKey(t);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  return [...groups].map(([key, unsorted]) => {
    const list = unsorted.sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t));
    const first = list[0], last = list[list.length - 1], kind = kindOf(first);
    const monthCount = new Set(list.map(t => t.d.slice(0, 7))).size;
    const gaps = list.slice(1).map((t, i) => days(list[i].d, t.d));
    const amount = list.map(t => Math.abs(t.a));
    const rhythm = [
      { name: 'viikoittainen', min: 5, max: 9, minCount: 5, maxAge: 18 },
      { name: 'kuukausittainen', min: 25, max: 35, minCount: 3, maxAge: 65 },
      { name: 'neljännesvuosittainen', min: 80, max: 100, minCount: 3, maxAge: 190 },
      { name: 'vuosittainen', min: 350, max: 380, minCount: 2, maxAge: 400 },
    ].find(r => list.length >= r.minCount && gaps.filter(g => g >= r.min && g <= r.max).length / gaps.length >= .8);
    const typed = ['housing', 'bills', 'income', 'transfer'].includes(kind);
    const repeatingType = ['housing', 'bills', 'transfer'].includes(kind) && monthCount >= 3;
    const status: PaymentPattern['status'] = rhythm || repeatingType ? 'recurring' : list.length >= 3 && first.m ? 'habit' : list.length === 1 && first.m && days(from, to) >= 90 ? 'one_off_candidate' : 'uncertain';
    const evidence = [`Maksutyyppi: ${first.ty}`, `Luokka: ${first.c}`, `MCC: ${first.mcc ?? 'puuttuu'}`, first.m ? `Sama kauppiastunnus: ${first.m}` : 'Saajan tunnus puuttuu; maksutyyppiryhmä ei todista yhtä sopimusta.', `${list.length} tapahtumaa, ${monthCount} eri kuukautta (${first.d}–${last.d}).`];
    if (rhythm) evidence.push(`Ajallinen rytmi: ${rhythm.name}; vähintään 80 % väleistä sopii rytmiin.`);
    if (status === 'one_off_candidate') evidence.push('Vain yksi havainto tällä jaksolla; kertaluonteisuus ei ole varma.');
    if (kind === 'purchase') evidence.push('Tavallinen ostos: toistuminen ei todista tilausta eikä automaattiveloitusta.');
    if (kind === 'subscription') evidence.push('Toimiala tai luokka viittaa palveluun; sopimuksen olemassaolo pitää vahvistaa.');
    // A price change needs two established price levels; variable bills are not price rises.
    const stablePair = (a: number, b: number) => Math.abs(a - b) <= .02;
    const changed = kind === 'subscription' && rhythm && amount.length >= 4 && stablePair(amount[0], amount[1]) && stablePair(amount.at(-1)!, amount.at(-2)!) && Math.abs(amount[0] - amount.at(-1)!) > .02;
    return {
      key, status, kind, confidence: (typed && status === 'recurring' ? 'high' : rhythm || status === 'habit' ? 'medium' : 'low') as PaymentPattern['confidence'], evidence,
      account: first.account ?? null, merchant: first.m, category: first.c, mcc: first.mcc, type: first.ty,
      count: list.length, months: monthCount, first: first.d, last: last.d, cadence: rhythm?.name ?? null,
      monthlyAmount: round(amount.reduce((s, n) => s + n, 0) / windowMonths), lastAmount: Math.abs(last.a),
      typicalDay: rhythm?.name === 'kuukausittainen' ? Math.round(median(list.map(t => +t.d.slice(8)))) : null,
      active: days(last.d, to) <= (rhythm?.maxAge ?? 65),
      priceChange: changed ? { from: amount[0], to: amount.at(-1)!, month: list.find(t => Math.abs(Math.abs(t.a) - amount.at(-1)!) <= .02)!.d.slice(0, 7) } : undefined,
    };
  }).sort((a, b) => b.monthlyAmount - a.monthlyAmount);
}
