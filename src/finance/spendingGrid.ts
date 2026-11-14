import { CUSTOMER, TODAY, lastMonths, labelOf, txs, type Tx } from './analytics';
import { CAT_FI } from './categories';

// Category identity, never rank or customer, determines the colour.
export const GRID_COLORS: Record<string, string> = {
  Housing: '#064E3B', Utilities: '#54816D', Groceries: '#009C64',
  Restaurants: '#96C941', Transportation: '#157E83', Entertainment: '#B1D8BA',
  Health: '#476B48', 'Home & Tech': '#668F20', Lifestyle: '#D2D987',
  Travel: '#77BDB5', Subscriptions: '#B8C9C3', Unclassified: '#68767B',
};
export type GridExpense = { date: string; label: string; cents: number };
export type GridGroup = { key: string; label: string; cents: number; cells: number; percentHundredths: number; color: string; expenses: GridExpense[] };
export type SpendingGrid = {
  customerId: string; month: string; referenceDate: string;
} & ({ status: 'ready'; totalCents: number; cellEuros: number; groups: GridGroup[] }
  | { status: 'empty' | 'incomplete'; message: string });

/** Integer largest remainders. Stable tie-breaking, no missing or surplus squares. */
export function apportion(weights: number[], units: number): number[] {
  if (!Number.isSafeInteger(units) || units < 0 || weights.some(w => !Number.isSafeInteger(w) || w < 0)) throw new Error('Virheellinen ruudukon jakauma.');
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(total) || !Number.isSafeInteger(total * units)) throw new Error('Liian suuri summa ruudukkoon.');
  if (!total) return weights.map(() => 0);
  const counts = weights.map(w => Math.floor(w * units / total));
  const order = weights.map((w, index) => ({ index, remainder: w * units % total })).sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  const left = units - counts.reduce((sum, value) => sum + value, 0);
  for (let i = 0; i < left; i++) counts[order[i].index]++;
  return counts;
}

/** Same consumption types as monthStatus/monthlyGame; direction or price alone never classifies a payment. */
export const isConsumptionExpense = (t: Tx) => !t.demo && t.a < 0 && ['purchase', 'utilities_payment', 'housing_payment'].includes(t.ty);
const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;

export function buildSpendingGrid(transactions: Tx[], customerId: string, referenceDate = TODAY, month = lastMonths(2, referenceDate.slice(0, 7))[0]): SpendingGrid {
  const base = { customerId, month, referenceDate };
  const incomplete = (message: string): SpendingGrid => ({ ...base, status: 'incomplete', message });
  if (!validDate(referenceDate) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month >= referenceDate.slice(0, 7)) return incomplete('Valitkaa päättynyt kalenterikuukausi, jolta tilitapahtumia on saatavilla.');
  const start = `${month}-01`;
  const end = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5), 0)).toISOString().slice(0, 10);
  if (!transactions.length || transactions.some(t => !validDate(t.d))) return incomplete('Kuukauden tilitapahtumat tai niiden päivämäärät puuttuvat. Ruudukkoa ei voi vielä muodostaa.');
  const dates = transactions.map(t => t.d).sort();
  // Coverage is conservative: absence of a payment on a day is not itself a missing record.
  // A history spanning the whole month is required; we do not scale a partial month to 100%.
  if (dates[0] > start || dates[dates.length - 1] < end) return incomplete('Saatavilla oleva tapahtumahistoria ei kata koko valittua kuukautta. Valitkaa toinen kuukausi tai täydentäkää tiedot.');
  const list = transactions.filter(t => t.d >= start && t.d <= end);
  if (list.some(t => !Number.isFinite(t.a) || (t.a < 0 && !t.ty))) return incomplete('Kuukauden tapahtumista puuttuu summa tai maksutyyppi. Ruudukkoa ei näytetä puutteellisilla tiedoilla.');
  const grouped = new Map<string, GridExpense[]>();
  for (const t of list.filter(isConsumptionExpense)) {
    const cents = Math.round(-t.a * 100);
    if (!Number.isSafeInteger(cents) || Math.abs(-t.a * 100 - cents) > 0.0001) return incomplete('Tapahtuman euromäärää ei voitu tulkita sentin tarkkuudella.');
    if (!cents) continue;
    const key = Object.hasOwn(GRID_COLORS, t.c) ? t.c : 'Unclassified';
    const expenses = grouped.get(key) ?? [];
    expenses.push({ date: t.d, label: labelOf(t) || 'Luokittelematon meno', cents });
    grouped.set(key, expenses);
  }
  const groups = [...grouped].map(([key, expenses]) => ({ key, label: CAT_FI[key] ?? 'Luokittelemattomat menot', color: GRID_COLORS[key], cents: expenses.reduce((sum, t) => sum + t.cents, 0), expenses: expenses.sort((a, b) => b.date.localeCompare(a.date) || b.cents - a.cents) })).sort((a, b) => b.cents - a.cents || a.key.localeCompare(b.key));
  const totalCents = groups.reduce((sum, g) => sum + g.cents, 0);
  if (!totalCents) return { ...base, status: 'empty', message: 'Tältä kuukaudelta ei löytynyt kulutusmenoja. Tuloista, säästösiirroista tai lainan nostosta ei tehdä kulutusruudukkoa.' };
  if (!Number.isSafeInteger(totalCents * 10000)) return incomplete('Kuukauden kokonaismäärää ei voitu laskea luotettavasti.');
  const cells = apportion(groups.map(g => g.cents), 100);
  const percentages = apportion(groups.map(g => g.cents), 10000);
  return { ...base, status: 'ready', totalCents, cellEuros: totalCents / 10000, groups: groups.map((g, i) => ({ ...g, cells: cells[i], percentHundredths: percentages[i] })) };
}

export const monthlySpendingGrid = (month?: string) => buildSpendingGrid(txs().filter(t => !t.demo), CUSTOMER.id, TODAY, month);
