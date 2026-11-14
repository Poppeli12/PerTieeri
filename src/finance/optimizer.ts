import { lastMonths, monthlyAvg, PEER, txs } from './analytics';
import { LEVER_FI, LEVER_LEVELS, LEVER_TIP, LeverKey, leverOf } from './categories';

export type Lever = {
  key: LeverKey;
  label: string;
  base: number; // €/kk nykyään
  peer?: number; // ikäryhmän keskiarvo €/kk
  levels: number[];
  weight: number; // kuinka "kipeä" leikkaus on
};

const PEER_CAT: Partial<Record<LeverKey, string>> = {
  Restaurants: 'Restaurants',
  Lifestyle: 'Lifestyle',
  Travel: 'Travel',
  Groceries: 'Groceries',
};

export function levers(): Lever[] {
  const out: Lever[] = [];
  const keys = Object.keys(LEVER_FI) as LeverKey[];
  for (const key of keys) {
    const base = monthlyAvg((t) => leverOf(t.c, t.mcc, t.name) === key);
    if (base < 5) continue;
    const peer = PEER_CAT[key] ? PEER[PEER_CAT[key]!] : undefined;
    out.push({ key, label: LEVER_FI[key], base, peer, levels: LEVER_LEVELS[key], weight: 1 });
  }
  return out.sort((a, b) => b.base - a.base);
}

export type PlanItem = { key: LeverKey; label: string; base: number; pct: number; saving: number; tip: string; overPeer: boolean };
export type Plan = { items: PlanItem[]; total: number; target: number; feasible: boolean; pain: number; excluded: LeverKey[]; strategy?: Strategy; branches?: number; resolution?: number };
export type Strategy = 'gentle' | 'few_changes' | 'spread';

export type Prefs = {
  protected: LeverKey[];
  rejections: Partial<Record<LeverKey, number>>; // monestiko käyttäjä torjunut ehdotuksen
  accepted: Partial<Record<LeverKey, number>>;
};

/**
 * Monivalintainen reppuongelma (multiple-choice knapsack):
 * valitse jokaiselle vivulle leikkaustaso niin, että säästö >= tavoite
 * ja kokonais"kipu" on pienin. Kipu kasvaa neliöllisesti leikkauksen koon mukaan,
 * jokainen muutettava asia maksaa lisäksi pienen kiinteän hinnan (vähemmän muutoksia),
 * käyttäjän aiemmin torjumat vivut kallistuvat. Suojatut vivut jätetään pois.
 * Vertailuaineisto ei määrää, mistä tämän asiakkaan pitäisi tinkiä.
 * Rajattu tilamäärä pitää haun kevyenä myös epärealistisen suurilla tavoitteilla.
 */
export function optimize(target: number, prefs: Prefs, exclude: LeverKey[] = [], strategy: Strategy = 'gentle'): Plan {
  if (!Number.isFinite(target) || target < 0) throw new Error('Tavoitteen pitää olla vähintään nolla euroa.');
  const ls = levers().filter((l) => !prefs.protected.includes(l.key) && !exclude.includes(l.key));
  const maximum = ls.reduce((sum, l) => sum + l.base * Math.max(...l.levels) / 100, 0);
  const resolution = Math.max(0.01, Math.ceil(maximum / 20000 * 100) / 100);
  const T = Math.max(0, Math.ceil(Math.min(target, maximum) / resolution - 1e-9));
  let branches = 0;
  const INF = 1e12;
  let dp = new Float64Array(T + 1).fill(INF);
  dp[0] = 0;
  const choice: Int16Array[] = []; // valittu taso per tila
  const prevS: Int32Array[] = []; // edellinen säästötila per tila
  const pains = ls.map((l) => {
    let w = l.weight;
    w *= 1 + 0.8 * (prefs.rejections[l.key] ?? 0);
    w *= 1 / (1 + 0.15 * (prefs.accepted[l.key] ?? 0));
    if (l.key === 'Groceries') w *= 1.6; // perustarve
    return l.levels.map((p) => p === 0 ? 0 : strategy === 'few_changes'
      ? 1e6 + w * (p / 100) ** 2
      : strategy === 'spread' ? w * (p / 100) ** 2 * 100
      : w * l.base * (p / 100) ** 2 * 0.6 + 6);
  });
  ls.forEach((l, li) => {
    const nd = new Float64Array(T + 1).fill(INF);
    const ch = new Int16Array(T + 1).fill(-1);
    const pv = new Int32Array(T + 1).fill(0);
    for (let s = 0; s <= T; s++) {
      if (dp[s] >= INF) continue;
      l.levels.forEach((p, pi) => {
        branches++;
        // Round down search savings: never claim a target from rounding up.
        const sav = Math.floor((l.base * p) / 100 / resolution + 1e-9);
        const ns = Math.min(T, s + sav);
        const v = dp[s] + pains[li][pi];
        if (v < nd[ns]) {
          nd[ns] = v;
          ch[ns] = pi;
          pv[ns] = s;
        }
      });
    }
    choice.push(ch);
    prevS.push(pv);
    dp = nd;
  });
  const reached = dp[T] < INF;
  let s = T;
  if (!reached) {
    // ei riitä: otetaan maksimisäästö
    s = 0;
    for (let i = T; i >= 0; i--)
      if (dp[i] < INF) {
        s = i;
        break;
      }
  }
  const pain = dp[s];
  const items: PlanItem[] = [];
  for (let li = ls.length - 1; li >= 0; li--) {
    const pi = Math.max(0, choice[li][s]);
    const prev = prevS[li][s];
    const l = ls[li];
    const pct = l.levels[pi] ?? 0;
    if (pct > 0)
      items.unshift({
        key: l.key,
        label: l.label,
        base: l.base,
        pct,
        saving: (l.base * pct) / 100,
        tip: LEVER_TIP[l.key],
        overPeer: false,
      });
    s = prev ?? 0;
  }
  const total = items.reduce((a, b) => a + b.saving, 0);
  return { items: items.sort((a, b) => b.saving - a.saving), total, target, feasible: total + 1e-8 >= target, pain, excluded: [...new Set([...prefs.protected, ...exclude])], strategy, branches, resolution };
}

/** Kaksi erilaista vaihtoehtoa: paras ja paras ilman suurinta vipua */
export function plans(target: number, prefs: Prefs) {
  const a = optimize(target, prefs);
  const biggest = a.items[0]?.key;
  const b = biggest ? optimize(target, prefs, [biggest]) : null;
  return { a, b: b && b.feasible ? b : null };
}

export function monthsCovered() {
  return lastMonths(6);
}

export { txs };
