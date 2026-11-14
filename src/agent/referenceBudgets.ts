import { CUSTOMER, TODAY, eur0, lastMonths, monthlyAvg } from '../finance/analytics';
import type { AgentCtx, Card } from './types';

// Food rows transcribed from the linked 2025 PDFs, checked 2026-11-14.
// The calculator JS uses different age labels: use the PDF's actual example groups.
export const REFERENCE_BUDGETS = [
  ['single_man_under45', 'Yksin asuva alle 45-vuotias työssä käyvä mies', 312, 'Takuusaatio_kohtuukulutus_yksin_asuva_alle_45_mies'],
  ['single_woman_under45', 'Yksin asuva alle 45-vuotias työssä käyvä nainen', 256, 'Takuusaatio_kohtuukulutus_yksin_asuva_alle_45_nainen'],
  ['single_man_over65', 'Yksin asuva yli 65-vuotias eläkkeellä oleva mies', 278, 'Takuusaatio_kohtuukulutus_yksin_asuva_yli_65_mies'],
  ['single_woman_over65', 'Yksin asuva yli 65-vuotias eläkkeellä oleva nainen', 224, 'Takuusaatio_kohtuukulutus_yksin_asuva_yli_65_nainen'],
  ['couple_over50', 'Yli 50-vuotias työssä käyvä pari', 567, 'Takuusaatio_kohtuukulutus_pari_yli_50'],
  ['couple_work_retired', 'Pari: toinen työssä, toinen eläkkeellä', 534, 'Takuusaatio_kohtuukulutus_pari_toissa_ja_elakkeella'],
  ['couple_retired', 'Yli 65-vuotias eläkkeellä oleva pari', 502, 'Takuusaatio_kohtuukulutus_pari_elakkeella'],
  ['single_parent_preschool', 'Yksinhuoltaja ja alle kouluikäinen lapsi', 349, 'Kohtuukulutus_yksinhuoltaja_pikkulapsi'],
  ['single_parent_teen', 'Yksinhuoltaja ja teini-ikäinen lapsi', 459, 'Kohtuukulutus_yksinhuoltaja_teini'],
  ['single_parent_two', 'Yksinhuoltaja, alakouluikäinen lapsi ja teini', 635, 'Kohtuukulutus_yksinhuoltaja_kaksi_lasta'],
  ['parents_two_preschool', 'Vanhemmat ja kaksi alle kouluikäistä lasta', 807, 'Kohtuukulutus_vanhemmat_kaksi_alle_kouluikaista_lasta'],
  ['parents_preschool_school', 'Vanhemmat, alle kouluikäinen ja alakouluikäinen lapsi', 844, 'Kohtuukulutus_vanhemmat_pikkulapsi_ja_alakouluikainen'],
  ['parents_two_teens', 'Vanhemmat ja kaksi teiniä', 1020, 'Kohtuukulutus_vanhemmat_kaksi_teinia'],
  ['parents_three', 'Vanhemmat, alakouluikäinen lapsi ja kaksi teiniä', 1210, 'Kohtuukulutus_vanhemmat_ja_kolme_lasta'],
] as const;

export function referenceBudget(a: { group?: string; confirmedExample?: boolean }, ctx: AgentCtx): { result: unknown; card?: Card } {
  const selected = REFERENCE_BUDGETS.find(row => row[0] === a.group);
  if (!selected) return { result: {
    source: 'Takuusäätiö / Martat / Helsingin yliopiston Kuluttajatutkimuskeskus', year: 2025,
    meaning: 'Kohtuullisen minimin esimerkkibudjetti, ei toteutuneen kulutuksen keskiarvo, mediaani tai henkilökohtainen tavoite.',
    groups: REFERENCE_BUDGETS.map(([id, name]) => ({ id, name })),
    question: 'Mitä esimerkkitaloutta haluaisitte tarkastella? Ryhmää ei päätellä iästä, postinumerosta tai ostoksista.',
    scope: 'Tässä työkalussa ruoan kuukausibudjetti. Muut menot alkuperäisen lähteen laskelmassa.',
  } };
  const [id, group, food, file] = selected;
  const url = `https://www.takuusaatio.fi/wp-content/uploads/2025/11/${file}.pdf`;
  const ageFits = id.endsWith('under45') ? CUSTOMER.age < 45 : id.endsWith('over65') ? CUSTOMER.age > 65 : false;
  const comparable = a.confirmedExample === true && id.startsWith('single_') && !id.startsWith('single_parent') && ageFits && ctx.profile.household === 'yksin' && ctx.profile.expensesComplete === true;
  const own = comparable ? monthlyAvg(t => t.c === 'Groceries', 12) : undefined;
  const note = 'Vuoden 2025 kohtuullisen minimin esimerkkibudjetti, ei väestön keskiarvo eikä säästötavoite. Ruokakaupan ostokset voivat sisältää muitakin tuotteita; rinnastus on vain suuntaa antava. Ylitys ei itsessään ole ongelma.';
  return {
    result: { source: 'Takuusäätiö / Martat / Kuluttajatutkimuskeskus', url, year: 2025, checkedAt: '2026-11-14', group, foodPerMonth: food,
      ownGroceryPerMonth: own, ownPeriod: comparable ? `${lastMonths(12)[0]}-01–${TODAY}` : undefined,
      backgroundOnly: !comparable, note,
      question: comparable ? undefined : 'Henkilökohtainen rinnastus vaatii sopivan yksinasujan esimerkkiryhmän vahvistamisen ja tiedon tilin menokattavuudesta. Perheille tässä vain esimerkkibudjetti.' },
    card: { kind: 'list', title: 'Ruoan viitebudjetti 2025', items: [
      { label: group, value: `${eur0(food)}/kk`, sub: note },
      ...(own === undefined ? [] : [{ label: 'Omat ruokakauppaostot, 12 kk keskiarvo', value: `${eur0(own)}/kk` }]),
      { label: 'Lähde: Takuusäätiö / Martat / Kuluttajatutkimuskeskus', value: '2025', sub: url },
    ] },
  };
}
