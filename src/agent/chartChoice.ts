import type { Card } from './types';

type Chart = Extract<Card, { kind: 'chart' }>;
export function buildChart(a: { title?: string; chart?: string; intent?: string; unit?: string; labels?: unknown; series?: unknown; note?: string; icon?: string }): { card?: Chart; error?: string } {
  if (!Array.isArray(a.labels) || !a.labels.length || a.labels.length > 24 || !Array.isArray(a.series) || !a.series.length || a.series.length > 3) {
    return { error: 'Tarvitaan 1–24 nimeä ja 1–3 sarjaa. Rajaa kysyttyyn aiheeseen; älä katkaise tai keksi lukuja.' };
  }
  const labels = a.labels.map(String);
  const valid = a.series.every(s => Array.isArray(s?.values) && s.values.length === labels.length && s.values.every((v: unknown) => typeof v === 'number' && Number.isFinite(v)));
  if (!valid) return { error: 'Jokaiselle nimelle tarvitaan todellinen, äärellinen numero jokaisessa sarjassa. Puuttuvaa lukua ei saa korvata nollalla.' };
  const series: Chart['series'] = a.series.map(s => ({ name: String(s.name || ''), values: s.values }));
  const sum = series[0].values.reduce((total, value) => total + value, 0);
  const pieOK = series.length === 1 && series[0].values.every(v => v >= 0) && sum > 0 && (!a.unit?.includes('%') || Math.abs(sum - 100) <= .5);
  const requested = a.chart && a.chart !== 'auto' ? a.chart : null;
  if (requested && !['bar', 'line', 'pie'].includes(requested)) return { error: 'Tuntematon kaaviotyyppi.' };
  if (requested === 'pie' && !pieOK) return { error: 'Ympyrä tarvitsee yhden sarjan saman kokonaisuuden ei-negatiivisia osia ja positiivisen summan; prosenttiosuuksien summan on oltava 100 % (pyöristys sallitaan). Selitä rajoitus; älä muuta lukuja tai vaihda asiakkaan pyytämää tyyppiä hiljaa.' };
  const chart = (requested ?? (a.intent === 'trend' && labels.length > 1 ? 'line' : a.intent === 'composition' && pieOK && labels.length >= 2 && labels.length <= 6 ? 'pie' : 'bar')) as Chart['chart'];
  return { card: { kind: 'chart', title: String(a.title || ''), chart, unit: String(a.unit || '€'), labels, series, note: a.note, icon: a.icon } };
}
