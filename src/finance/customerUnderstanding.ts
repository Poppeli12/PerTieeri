import { CUSTOMER, MORTGAGE, TODAY, lastMonths, txs, type Tx } from './analytics';
import { paymentPatterns } from './paymentPatterns';

export function customerUnderstanding(months = 12, search = '') {
  months = Math.min(24, Math.max(1, Math.floor(months)));
  const from = `${lastMonths(months)[0]}-01`;
  const all = txs().filter(t => !t.demo);
  const window = all.filter(t => t.d >= from && t.d <= TODAY);
  const sum = (predicate: (t: Tx) => boolean) => Math.round(window.filter(predicate).reduce((s, t) => s + t.a, 0) * 100) / 100;
  const accounts = [...new Set(all.map(t => t.account ?? 'tunnus puuttuu'))].map(id => {
    const rows = all.filter(t => (t.account ?? 'tunnus puuttuu') === id);
    const last = rows[rows.length - 1];
    return { id, balance: last?.b ?? null, asOf: last ? `${last.d} ${last.t}` : null, transactions: rows.length };
  });
  const patterns = paymentPatterns(all, from, TODAY, months);
  const matching = patterns.filter(p => !search || JSON.stringify([p.merchant, p.type, p.category, p.mcc]).toLowerCase().includes(search.toLowerCase()));
  return {
    customerId: CUSTOMER.id, age: CUSTOMER.age, postalCode: CUSTOMER.postal,
    source: 'Junction 2026 / S-Pankki, valitun asiakkaan synteettiset lähdetapahtumat',
    sourceUrl: 'https://github.com/hackjunction/Junction-2026-S-pankki',
    period: { from, to: TODAY, months }, observationPeriod: { from: all[0]?.d ?? null, to: all.at(-1)?.d ?? null },
    accounts, balanceTotal: accounts.reduce((s, a) => s + (a.balance ?? 0), 0),
    flows: {
      salary: sum(t => t.ty === 'salary' && t.a > 0), otherIncome: sum(t => t.ty === 'other_income' && t.a > 0),
      consumption: -sum(t => t.a < 0 && ['purchase', 'housing_payment', 'utilities_payment'].includes(t.ty)),
      investmentAndSavingsTransfers: -sum(t => t.a < 0 && ['investment_deposit', 'salary_sweep'].includes(t.ty)),
      investmentWithdrawals: sum(t => t.ty === 'investment_withdrawal' && t.a > 0),
      netAccountFlow: sum(() => true),
    },
    patternCounts: Object.fromEntries(['recurring', 'habit', 'one_off_candidate', 'uncertain'].map(status => [status, patterns.filter(p => p.status === status).length])),
    patterns: matching.slice(0, 40), matchingPatterns: matching.length,
    mortgage: MORTGAGE ? { application: MORTGAGE.final, events: MORTGAGE.events.length, meaning: 'Hakemustietoja; ei nykyinen velkasaldo, korko tai lyhennysohjelma.' } : null,
    missing: ['Kuitin tuoterivit ja ostetut tuotteet', 'Kauppiaan oikea nimi ja sopimus-/tilausvahvistus', 'Nykyiset lainasaldot, korot ja eräpäivät', 'Muut pankit ja varallisuuden kokonaisarvo', 'Kotitalouden koko ja tilin kattavuus ilman asiakkaan vahvistusta'],
    interpretation: 'Toistuva ostos ei ole automaattisesti tilaus; yksittäinen havainto ei todista kertaluonteisuutta. Maksutyyppi ja MCC ohjaavat luokitusta, kauppiastunnus ja aikavälit toistuvuutta. Hinta on vain täydentävä vihje. Summat ovat jakson toteutumia, eivät tulevia sitoumuksia. Ei oletettuja vuokria tai demotilauksia.',
    teaching: 'Valitse yksi henkilökohtainen havainto. Näytä omilla luvuilla mistä ilmiö syntyy, miten se vaikuttaa käyttövaraan ja yksi kokeilu vaikutuksen seuraamiseksi. Älä päättele ostosten syytä tai välttämättömyyttä kauppiasluokasta.',
  };
}
