import { lastMonths, merchantName, txs } from '../../finance/analytics';
import { Basket, basketOf } from '../../finance/categories';

export const BUCKET_ORDER: Basket[] = ['regular', 'irregular', 'slipping'];
export const BUCKET_LABELS: Record<Basket, string[]> = {
  regular: ['Pakolliset ja', 'säännölliset', 'menot'],
  irregular: ['Pakolliset ja', 'epäsäännölliset', 'menot'],
  slipping: ['Arjen', 'lipsuvat', 'menot'],
};

export type SortingReceipt = { key: string; label: string; amount: number; basket: Basket };

/** A small, repeating illustration of real expenses; never a second accounting entry. */
export function sortingReceipts(months = 6): SortingReceipt[] {
  const period = new Set(lastMonths(months));
  const by: Record<Basket, SortingReceipt[]> = { regular: [], irregular: [], slipping: [] };
  const seen = new Set<string>();
  for (const { t, index } of txs().map((t, index) => ({ t, index })).reverse()) {
    if (t.a >= 0 || !period.has(t.d.slice(0, 7))) continue;
    const basket = basketOf(t.c, t.mcc);
    if (!basket || by[basket].length >= 3) continue;
    const label = merchantName(t).replace(/ #\d+$/, '');
    const merchant = `${basket}:${label}`;
    if (seen.has(merchant)) continue;
    seen.add(merchant);
    by[basket].push({ key: `${t.d}-${index}`, label, amount: -t.a, basket });
  }
  return Array.from({ length: 3 }, (_, i) => BUCKET_ORDER.flatMap((b) => by[b][i] ? [by[b][i]] : [])).flat();
}
