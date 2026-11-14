/**
 * Per Tieeri -agentin vastausmoottori.
 *
 * Toimii täysin laitteella: tunnistaa kysymyksen aikeen (intent), laskee vastauksen
 * käyttäjän omasta datasta (finance/*) ja palauttaa tekstin + visualisointikortit.
 * Rajapinta `respond(text, ctx)` on tehty niin, että myöhemmin LLM voi korvata
 * tai täydentää aikeen tunnistuksen ja tekstin muotoilun, mutta luvut tulevat
 * aina deterministisestä laskennasta (ei hallusinoituja summia).
 */
import {
  addDays, anomalies, baskets, BALANCE_NOW, cap, daysBetween, eur, eur0, fmtDate, fmtDay, habits,
  incomeMonthly, lastMonths, lastSalary, monthName, monthlyAvg, nextSalaryDate, PEER, PEER_GROUP, PEER_N,
  recurring, rentMonthly, safeToSpend, spenderType, spendQuery, sumOut, isOut, TODAY, topSinks, txs, labelOf, merchantName,
} from '../finance/analytics';
import { BASKET_FI, LEVER_FI, LeverKey, leverOf, MCC_FI, PROTECT_OPTIONS } from '../finance/categories';
import { simulate } from '../finance/forecast';
import { optimize, plans, Prefs } from '../finance/optimizer';
import { CONCEPT_CHIPS, teach } from './concepts';
import { matchCat, norm, parseAmount, parsePercent, parsePeriod, parsePurchaseDate, parseTargetDate, parseWhatIf } from './nlp';
import type { AgentCtx, AgentReply, BotMsg, Card, Profile } from './types';

let qid = 0;
const nid = () => `${Date.now().toString(36)}${(qid++).toString(36)}`;

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

const OPENERS = [
  'No niin, katsotaanpa.',
  'Hetkinen, kaivan tilikirjat esiin… ai niin, nehän ovat nykyään pilvessä.',
  'Ennen tähän olisi mennyt kolme lomaketta ja leimasin. No, mutkattomasti sitten.',
  'Selvä. Laskin sen puolestasi.',
];

const END_DATE = '2026-12-31';

function teachy(ctx: AgentCtx, text: string) {
  return ctx.profile.style === 'teach' ? text : '';
}

function student(ctx: AgentCtx) {
  return /opisk/i.test(ctx.profile.situation);
}

function baseSim(ctx: AgentCtx, until = END_DATE, extra: Parameters<typeof simulate>[0] = { until }) {
  return simulate({ rentDelta: ctx.profile.rentDelta, incomeDelta: ctx.profile.incomeDelta, ...extra, until });
}

/* ================= aloitus: oma-aloitteinen katsaus ================= */

export function greeting(ctx: AgentCtx): BotMsg[] {
  const out: BotMsg[] = [];
  const st = spenderType();
  const sim = baseSim(ctx);
  const s = safeToSpend();
  const lastDec = sumOut((t) => t.c === 'Groceries' || t.c === 'Lifestyle' || t.c === 'Home & Tech', '2025-12-01', '2025-12-31');
  const goal = ctx.profile.goal;
  out.push({
    text: `Hyvää päivää! Per Tieeri palveluksessanne. Kävin läpi **${txs().length} tapahtumaasi** kahden vuoden ajalta. Ennen tämä olisi vaatinut viikon ja kolme virkailijaa, nyt siihen meni sekunti. Harmillisen mutkatonta.\n\nTässä tärkeimmät havaintoni${goal ? ` tavoitteesi ”${goal.toLowerCase()}” kannalta` : ''}:`,
    cards: [
      { kind: 'stat', label: 'Turvallinen käyttövara palkkapäivään asti', value: `${eur0(s.perWeek)} / vko`, sub: `Saldo ${eur0(s.balance)}, josta ${eur0(Math.max(0, s.free))} on oikeasti vapaata ${fmtDay(s.until)} asti`, tone: s.free > 0 ? 'good' : 'bad' },
      { kind: 'stat', label: 'Millainen rahankäyttäjä olet', value: st.type, sub: st.desc },
    ],
  });
  // varhaisvaroitus
  const warn: string[] = [];
  if (sim.probNegative > 0.15)
    warn.push(`Nykyisellä tahdilla on **${Math.round(sim.probNegative * 100)} %:n riski**, että tili käy miinuksella ennen vuoden loppua. Tiukin kohta on noin **${fmtDay(sim.minDate)}**`);
  const decCats = (t: { c: string }) => t.c === 'Groceries' || t.c === 'Lifestyle' || t.c === 'Home & Tech';
  const normalMonth = monthlyAvg(decCats, 12);
  const decExtra = lastDec - normalMonth;
  if (decExtra > 300)
    warn.push(`Viime joulukuussa ruokaan, lahjoihin ja tavaroihin meni **${eur0(lastDec)}**, eli **${eur0(decExtra)} tavallista enemmän**. Jos joulu toistuu samanlaisena, varaa siihen jo nyt **${eur0(decExtra / 3)}/kk** lokakuusta alkaen. Silloin joulukuu ei tule yllätyksenä.`);
  const sus = recurring().find((r) => r.suspicious);
  if (sus) warn.push(`Tililtäsi lähtee joka kuu **${eur(sus.amount)}** saajalle **${sus.label}**, jota en tunnista. Katsotaan se yhdessä.`);
  if (warn.length)
    out.push({ text: `**Ennakkovaroitus** – ennen kuin mitään ehtii tapahtua:\n\n${warn.map((w) => '• ' + w).join('\n\n')}`, cards: [{ kind: 'forecast', title: 'Saldoennuste vuoden loppuun', sim }] });
  // epäselvät
  const q = anomalies(ctx.answers).filter((a) => a.severity === 'question');
  if (q.length) {
    const a = q[0];
    out.push({
      text: `Yksi asia jäi minulle epäselväksi. Kysyn mieluummin kuin arvaan, koska se vaikuttaa laskelmiin.`,
      cards: [{ kind: 'question', id: a.id, title: a.title, detail: a.detail, question: a.question!, options: a.options! }],
    });
  }
  out.push({
    text: 'Mitä tutkitaan ensin?',
    chips: ['Miksi 1 500 € tilillä ei tarkoita että voin käyttää 1 500 €?', 'Mihin rahani menevät?', 'Mistä palveluista maksan kuukausittain?', 'Haluan säästää 2 000 € ensi kesään mennessä', 'Voinko ostaa 700 € tietokoneen ensi viikolla?'],
  });
  return out;
}

/* ================= vastaukset epäselviin ================= */

function answer(id: string, value: string, ctx: AgentCtx): AgentReply {
  const answers = { ...ctx.answers, [id]: value };
  const msgs: BotMsg[] = [];
  if (id.startsWith('rent-')) {
    if (/toiselta/.test(value))
      msgs.push({
        text: `Kiitos, merkitsin. Tällöin laskelmani olettavat, että vuokra maksetaan joka kuu.\n\n**Vinkki:** PSD2-tilitietopalvelun avulla voit tuoda myös toisen pankin tilit S-mobiiliin, jolloin näen koko taloutesi enkä joudu arvailemaan.`,
      });
    else if (/maksamatta/.test(value))
      msgs.push({
        text: `Kiitos rehellisyydestä, se on tärkeää. Maksamaton vuokra voi johtaa perintään ja maksuhäiriömerkintään, joka näkyy luottotiedoissa vuosia.\n\nToimi näin: **1)** ota heti yhteyttä vuokranantajaan ja sovi maksusuunnitelma, **2)** varaa se seuraavasta palkasta ennen muita menoja. Teen sinulle säästösuunnitelman, joka vapauttaa ${eur0(rentMonthly() / 4)} kuukaudessa:`,
        cards: [{ kind: 'plan', title: 'Vuokrarästin kuittaussuunnitelma', plan: optimize(rentMonthly() / 4, ctx.prefs) }],
      });
    else msgs.push({ text: 'Selvä, merkitsin tiedon. Lasken vuokran silti pakolliseksi joka kuulle, koska varovainen arvio on turvallisempi.' });
  } else if (id.startsWith('inc-')) {
    const recurringInc = /toistuva/i.test(value);
    msgs.push({
      text: recurringInc
        ? 'Hienoa, toistuva lisätulo! Lasken sen jatkossa mukaan tuloihin. Kerro, jos summa tai tahti muuttuu.'
        : `Kiitos! Merkitsin sen kertaluonteiseksi (${value.toLowerCase()}). En laske sitä säännölliseksi tuloksi, koska se vääristäisi käyttövaraasi.${teachy(ctx, '\n\n**Talousoppi:** Kertaluonteiset tulot kannattaa käyttää kertaluonteisesti, esimerkiksi hätärahastoon, eikä niiden varaan kannata nostaa arjen kulutustasoa.')}`,
    });
  } else if (id.startsWith('sus-')) {
    const r = recurring().find((x) => `sus-${x.key}` === id);
    if (/en tunnista/i.test(value))
      msgs.push({
        text: `Tämä kannattaa hoitaa **heti**. Toimi näin:\n\n**1.** Sulje kortti väliaikaisesti: *Pankki → Kortit → Kortin sulkeminen*.\n**2.** Tee veloituksesta reklamaatio pankille. Tuntemattomat korttiveloitukset voi kiistää.\n**3.** Tilaa uusi kortti ja vaihda se luotettuihin palveluihin.\n\nTähän mennessä veloitusta on kertynyt noin **${eur((r?.amount ?? 0) * (r?.months ?? 0))}**. Vahdin jatkossa uusia tuntemattomia toistuvia veloituksia puolestasi.`,
        chips: ['Mistä palveluista maksan kuukausittain?', 'Miten huijauksen tunnistaa?'],
      });
    else if (/kyllä/i.test(value))
      msgs.push({
        text: `Selvä, merkitsin sen tunnetuksi palveluksi. Se maksaa vuodessa **${eur((r?.amount ?? 0) * 12)}**. Jos et ole käyttänyt sitä viime kuussa, sen voisi laittaa tauolle.`,
      });
    else msgs.push({ text: 'Ei hätää. Tarkista tiliotteelta saajan tarkka nimi ja hae se netistä. Jos et vieläkään tunnista sitä, kiistä veloitus. Muistutan sinua tästä viikon päästä.' });
  } else if (id.startsWith('quiet-')) {
    msgs.push({ text: `Kiitos! Merkitsin kuukauden poikkeukseksi (${value.toLowerCase()}), joten se ei vääristä keskiarvojasi.` });
  } else if (id.startsWith('quiz-')) {
    return { msgs: [] };
  }
  const next = anomalies(answers).filter((a) => a.severity === 'question')[0];
  if (next)
    msgs.push({
      text: 'Vielä yksi asia, jos sopii:',
      cards: [{ kind: 'question', id: next.id, title: next.title, detail: next.detail, question: next.question!, options: next.options! }],
    });
  else msgs.push({ text: 'Nyt tilikirjat ovat kunnossa. Mitä seuraavaksi?', chips: ['Tee minulle budjetti', 'Mitä jos vähennän ravintoloita 30 %?', 'Viikkokatsaus'] });
  return { msgs, answers };
}

/* ================= pääreititin ================= */

export function respond(raw: string, ctx: AgentCtx): AgentReply {
  const t = norm(raw);

  // vastaus kysymyskorttiin: §ans|id|arvo
  if (raw.startsWith('§ans|')) {
    const [, id, value] = raw.split('|');
    return answer(id, value, ctx);
  }
  // suunnitelman hyväksyntä / torjunta: §plan|accept|Restaurants,Taxi  tai §plan|reject|Sport
  if (raw.startsWith('§plan|')) return planFeedback(raw, ctx);

  if (/älä (enää )?ehdota|en halua (luopua|tinkiä)|en tingi|ei .*(tingitä|kosketa)|jätä .* rauhaan/.test(t)) return preference(t, ctx);
  if (/^siirrä .*säästöön/.test(t)) {
    const a = parseAmount(raw) ?? 0;
    return {
      msgs: [{ text: `Tehty! Siirsin **${eur0(a)}** säästötavoitteesi laskennalliseen varaukseen. Käyttövarasi laski saman verran, joten raha ei enää houkuttele. (Demossa siirto on laskennallinen.)\n\nPieniä siirtoja usein, niin säästäminen muuttuu tavaksi.`, chips: ['Paljonko voin käyttää tällä viikolla?'] }],
    };
  }
  if (/^hyväksyn polun/.test(t)) return planFeedback('§plan|accept|', ctx);
  if (/asumistu/.test(t))
    return {
      msgs: [{ text: 'Asumistuki on Kelan tuki asumismenoihin pienituloisille. Sen määrä riippuu tuloista, vuokrasta ja kotikunnasta. Tarkista oma tilanteesi Kelan laskurista. Jos saat tukea, lasken sen mielelläni ennusteisiisi. Kerro vain summa, esimerkiksi ”tuloni nousevat 150 €”.' }],
    };
  if (/tunnistanko|kaikki veloitukset/.test(t)) return scam(ctx);
  if (/^(moi|hei|terve|päivää|huomenta|iltaa|moro|hello|hi)\b/.test(t) && t.length < 25) return { msgs: greeting(ctx) };
  if (/huijau|scam|epäilyttäv|outo veloitus|tuntematon veloitus|tunnistaa huijauk/.test(t)) return scam(ctx);
  if (/selitä|mikä on|mitä tarkoittaa|opeta|mitä on/.test(t)) {
    const l = teach(t, nid());
    if (l) return { msgs: [l] };
  }
  if (/kori|1 ?500 €? tilillä|tilillä .* (voin|ei tarkoita)|pakollis.*menot|lipsuv/.test(t)) return threeBaskets(ctx);
  if (/voinko ostaa|voinko hankkia|haluan ostaa|ostaisin|kannattaako ostaa|onko varaa/.test(t)) return purchase(raw, ctx);
  if (/budjet/.test(t)) return budget(raw, ctx);
  if (/luopumatta|ilman että|optimoi|pienimmillä|helpoin tapa säästää/.test(t) || (/säästettyä|säästää/.test(t) && /\/ ?kk|kuussa|kuukaudessa/.test(t) && !/mennessä/.test(t)))
    return optimizeGoal(raw, ctx);
  if (/säästää|säästän|säästöön|säästötavoit|kerätä/.test(t) && /mennessä|kesä|joulu|vuode|kuukaude|kk|kevää|reissu|matka/.test(t)) return goal(raw, ctx);
  if (/mitä (tapahtuu|jos)|jos vähennän|jos lopetan|what if|jos jätän/.test(t) || Object.keys(parseWhatIf(t)).length > 1) return whatIf(raw, ctx);
  if (/muutan|muuttaisin|muuttaa yksin|vuokra(ni)? nouse|yksin asumaan|omaan asuntoon|tulo(t|ni) (laske|putoa|nouse|kasva)|uusi työ|uuden työn|palkankorotus|irtisan|lomaut|työttö|opiskelemaan/.test(t)) return lifeSim(raw, ctx);
  if (/ennust|jäljellä|kuun lopussa|joulukuun lopussa|vuoden lopussa|riittääkö|riittävätkö|varoita/.test(t)) return forecast(raw, ctx);
  if (/turvallis|paljonko voin käyttää|käyttövar|voin käyttää tällä/.test(t)) return safe(ctx);
  if (/tilau|kuukausittain|toistuv|suoratoist|piilokul|mistä .* maksan|jatkuvat maksut/.test(t)) return subscriptions(ctx);
  if (/millainen .*(kuluttaja|käyttäjä|rahankäyttäjä|säästäjä)|kuluttajatyyp/.test(t)) return spenderTypeReply(ctx);
  if (/miksi käytän|kuun alussa|kuun lopussa|palkkapäiv|tottumu|tapojani|pahat tavat|huonot tavat|poikkeam|kaava/.test(t)) return habitsReply(ctx);
  if (/eniten|top|pahin|suurin|mihin .*(meni|menee|kului|kuluu|menevät)|1000|tuhat/.test(t)) return whereMoneyGoes(ctx);
  if (/puskur|hätära|yllättäv|yllätyks|huolto|varaudu|varautu/.test(t)) return buffer(ctx);
  if (/katsaus|yhteenveto|viikko|tämä kuu|kuukausi/.test(t)) return review(t, ctx);
  if (/laina|velka|asuntolai|korko/.test(t)) return loan(ctx);
  if (/paljonko|kuinka paljon|montako euroa|kulutin|käytin/.test(t)) return categorySpend(raw, ctx);
  if (/tulo|palkka|ansai/.test(t)) return income(ctx);
  const c = matchCat(t);
  if (c) return categorySpend(raw, ctx);
  const l = teach(t, nid());
  if (l) return { msgs: [l] };
  return {
    msgs: [
      {
        text: 'Pyydän anteeksi, en aivan ymmärtänyt. Vanha pankkimies tarvitsee välillä selkokieltä. Voit kysyä esimerkiksi näin:',
        chips: ['Paljonko käytin takseihin viime kuussa?', 'Mitä jos vähennän ravintoloita 30 % ja takseja 50 %?', 'Miten saan säästettyä 150 €/kk luopumatta kuntosalista?', ...CONCEPT_CHIPS.slice(0, 1)],
      },
    ],
  };
}

/* ================= toiminnot ================= */

function threeBaskets(ctx: AgentCtx): AgentReply {
  const b = baskets();
  const s = safeToSpend();
  const must = b.totals.regular + b.totals.irregular;
  return {
    msgs: [
      {
        text: `Tämä on talouden tärkein oivallus, joten kerron sen kunnolla. Jokainen menosi kuuluu yhteen **kolmesta korista**:\n\n**1. ${BASKET_FI.regular}**: vuokra, laskut ja ruoka. Sinulla noin **${eur0(b.totals.regular)}/kk**.\n**2. ${BASKET_FI.irregular}**: lääkäri, rikkoutuneet tavarat. Keskimäärin **${eur0(b.totals.irregular)}/kk**, vaikka ne tulevat harvoin.\n**3. ${BASKET_FI.slipping}**: ravintolat, taksit, viihde. **${eur0(b.totals.slipping)}/kk**.`,
        cards: [{ kind: 'baskets' }],
      },
      {
        text: `**Miksi saldo ei ole käyttövara?** Tililläsi on ${eur0(s.balance)}, mutta siitä on jo ”luvattu” ennen ${fmtDay(s.until)} palkkaa:\n• vuokra ${eur0(s.rentDue)}\n• laskut ${eur0(s.bills)}\n• ruoka ${eur0(s.groceries)}\n• tilaukset ${eur0(s.subs)}\n• yllätysvara ${eur0(s.buffer)}\n\nOikeasti vapaata on **${eur0(Math.max(0, s.free))}**. Kaksi ensimmäistä koria tulevat joka tapauksessa (${eur0(must)}/kk), joten vain kolmas kori on oikeasti sinun päätettävissäsi.`,
        cards: [{ kind: 'quiz', id: `quiz-${nid()}`, q: `Mihin koriin kuuluu rikkinäisen puhelimen näytön vaihto?`, options: ['Pakolliset säännölliset', 'Pakolliset epäsäännölliset', 'Arjen lipsuvat'], correct: 1, why: 'Se on pakollinen, mutta ei tule joka kuu. Siksi siihen kannattaa säästää pieni summa kuukausittain.' }],
        chips: ['Mihin rahani menevät?', 'Tee minulle budjetti', 'Miten varaudun yllättäviin laskuihin?'],
      },
    ],
  };
}

function safe(ctx: AgentCtx): AgentReply {
  const s = safeToSpend();
  return {
    msgs: [
      {
        text: `${pick(OPENERS)} Palkkaan (${fmtDay(s.until)}) on **${s.days} päivää**.`,
        cards: [
          { kind: 'stat', label: 'Turvallisesti käytettävissä', value: `${eur0(s.perWeek)} / viikko`, sub: `eli ${eur0(s.perDay)} päivässä`, tone: s.free > 0 ? 'good' : 'bad' },
          {
            kind: 'list',
            title: 'Näin se laskettiin',
            items: [
              { label: 'Saldo nyt', value: eur(s.balance) },
              { label: 'Vuokra 8. pv', value: '− ' + eur(s.rentDue) },
              { label: 'Asumisen laskut', value: '− ' + eur(s.bills) },
              { label: 'Ruokakauppa', value: '− ' + eur(s.groceries) },
              { label: 'Tilaukset', value: '− ' + eur(s.subs) },
              { label: 'Yllätysvara', value: '− ' + eur(s.buffer), sub: 'keskimääräiset epäsäännölliset menot' },
              { label: 'Vapaasti käytettävissä', value: eur(Math.max(0, s.free)), tone: s.free > 0 ? 'good' : 'bad' },
            ],
          },
        ],
        chips: ['Miksi 1 500 € tilillä ei tarkoita että voin käyttää 1 500 €?', 'Viikkokatsaus'],
      },
    ],
  };
}

function forecast(raw: string, ctx: AgentCtx): AgentReply {
  const until = /joulu|vuoden lop/.test(norm(raw)) ? END_DATE : /kuun lopussa|kuun loppuun/.test(norm(raw)) ? '2026-10-31' : END_DATE;
  const sim = baseSim(ctx, until);
  const tight = sim.min50 < rentMonthly() * 0.3;
  return {
    msgs: [
      {
        text: `Simuloin talouttasi **${daysBetween(TODAY, until)} päivää** eteenpäin 200 kertaa. Jokainen simulaatio arvotaan omista menoistasi viime puolen vuoden ajalta, ja palkka, vuokra ja laskut tulevat niiden tavallisina päivinä.\n\n**${fmtDate(until)}** tililläsi on todennäköisimmin noin **${eur0(sim.end.p50)}**. Vaihteluväli on ${eur0(sim.end.p10)}–${eur0(sim.end.p90)}.`,
        cards: [{ kind: 'forecast', title: `Saldoennuste ${fmtDay(until)} asti`, sim }],
      },
      {
        text: tight
          ? `**Varoitus:** tiukimmillaan saldo on noin ${fmtDay(sim.minDate)}, jolloin sitä on vain noin **${eur0(sim.min50)}**. Miinukselle menon riski on ${Math.round(sim.probNegative * 100)} %. Pieni muutos nyt estää ongelman. Kokeillaan:`
          : `Hyvältä näyttää. Tiukin kohta on ${fmtDay(sim.minDate)} (noin ${eur0(sim.min50)}). ${teachy(ctx, '\n\n**Talousoppi:** Ennuste ei ole lupaus. Haarukka kertoo, kuinka paljon tavallinen vaihtelu voi heiluttaa lopputulosta.')}`,
        cards: tight ? [{ kind: 'whatif' }] : undefined,
        chips: ['Mitä jos vähennän ravintoloita 30 % ja takseja 50 %?', 'Voinko ostaa 700 € tietokoneen ensi viikolla?'],
      },
    ],
  };
}

function purchase(raw: string, ctx: AgentCtx): AgentReply {
  const amount = parseAmount(raw);
  if (!amount)
    return { msgs: [{ text: 'Mielelläni arvioin! Kerro vielä hinta, esimerkiksi ”Voinko ostaa 700 € tietokoneen ensi viikolla?”' }] };
  const date = parsePurchaseDate(raw);
  const what = (raw.match(/ostaa\s+(?:\d[\d\s]*\s*(?:€|e|euron|euroa)?\s*)?([a-zåäö]+)/i)?.[1] ?? 'hankinnan').toLowerCase();
  const until = addDays(nextSalaryDate(date), 20);
  const base = baseSim(ctx, until);
  const withBuy = baseSim(ctx, until, { until, oneOffs: [{ date, amount }] });
  const afterSalary = nextSalaryDate(date);
  const withWait = baseSim(ctx, until, { until, oneOffs: [{ date: addDays(afterSalary, 1), amount }] });
  const s = safeToSpend();
  let verdict: string;
  let tone: 'good' | 'warn' | 'bad';
  // arvioidaan tiukinta kohtaa (mediaanipolun minimi), ei pelkkää todennäköisyyttä
  if (amount <= s.free * 0.6 && withBuy.min50 > 150) {
    verdict = 'Kyllä, onnistuu';
    tone = 'good';
  } else if (withWait.min50 > 100 && amount <= s.free + incomeMonthly() * 0.15) {
    verdict = `Odota ${fmtDay(addDays(afterSalary, 1))} asti`;
    tone = 'warn';
  } else {
    verdict = 'Ei vielä, säästetään ensin';
    tone = 'bad';
  }
  const baseTight = base.min50 < 100;
  const fv10 = amount * Math.pow(1.05, 10);
  const weeksPlan = optimize(Math.min(400, amount / 3), ctx.prefs);
  const perMonth = Math.max(50, weeksPlan.total);
  const monthsNeeded = Math.ceil(amount / perMonth);
  const msgs: BotMsg[] = [
    {
      text: `Simuloin kaksi tulevaisuutta: ostat ${eur0(amount)}:n ${what} **${fmtDay(date)}** ja et osta sitä.`,
      cards: [
        {
          kind: 'stat',
          label: 'Arvioni',
          value: verdict,
          sub: `Tiukimmillaan saldo: ilman ostosta ${eur0(base.min50)}, ostoksen kanssa ${eur0(withBuy.min50)}, palkan jälkeen ostettuna ${eur0(withWait.min50)}. Vapaata käyttövaraa nyt ${eur0(Math.max(0, s.free))}.`,
          tone,
        },
        { kind: 'forecast', title: 'Saldo ostoksen kanssa ja ilman', sim: base, compare: withBuy, baseLabel: 'Ilman ostoa', compareLabel: 'Ostoksen kanssa' },
      ],
    },
  ];
  const tips: string[] = [];
  if (baseTight)
    tips.push(`**Rehellisesti:** jo ilman ostosta nykyinen kulutustahtisi vie saldon tiukimmillaan **${eur0(base.min50)}**:iin ennen palkkaa. Ostos syventäisi kuoppaa **${eur0(base.min50 - withBuy.min50)}**. Ensin kannattaa saada arki plussalle, sitten ostos.`);
  if (tone !== 'good')
    tips.push(`**Parempi tapa:** jos ostat ${fmtDay(addDays(afterSalary, 1))} eli palkan jälkeen, tiukin kohta on ${eur0(withWait.min50)} eikä ${eur0(withBuy.min50)}. Turvallisinta on säästää ostos: noin **${eur0(perMonth)}/kk** riittää ${monthsNeeded} kuukaudessa.`);
  tips.push(`**Hinta per käyttökerta:** jos käytät sitä 3 vuotta lähes päivittäin, se maksaa **${eur(amount / (3 * 300))}/päivä**. Se on hyvä mittari, onko hankinta sen arvoinen.`);
  tips.push(`**Vaihtoehtoiskustannus:** sama ${eur0(amount)} 5 %:n vuosituotolla olisi 10 vuodessa noin **${eur0(fv10)}**.`);
  if (ctx.profile.style === 'teach') tips.push('**Kysy itseltäsi:** onko tämä tarve vai halu? Jos halu, toimiiko 48 tunnin sääntö: odota kaksi päivää ja katso, haluatko sitä vielä?');
  msgs.push({ text: tips.join('\n\n'), cards: tone !== 'good' ? [{ kind: 'plan', title: `Säästöpolku: ${eur0(perMonth)}/kk`, plan: weeksPlan }] : undefined, chips: ['Paljonko voin käyttää tällä viikolla?', 'Mitä jos vähennän ravintoloita 30 %?'] });
  return { msgs };
}

function budget(raw: string, ctx: AgentCtx): AgentReply {
  const target = parseAmount(raw) ?? 200;
  const b = baskets();
  const income = incomeMonthly() + ctx.profile.incomeDelta;
  const regular = b.totals.regular + ctx.profile.rentDelta;
  const irregular = b.totals.irregular;
  const slipAllowance = income - regular - irregular - target;
  const needCut = Math.max(0, b.totals.slipping - slipAllowance);
  const plan = optimize(needCut, ctx.prefs);
  const items = [
    { label: 'Tulot (keskim.)', value: eur0(income), tone: 'good' as const },
    { label: BASKET_FI.regular, value: '− ' + eur0(regular), sub: 'vuokra, laskut, ruoka, työmatkat' },
    { label: 'Yllätysvara (oma tili)', value: '− ' + eur0(irregular), sub: 'siirto palkkapäivänä' },
    { label: 'Säästö', value: '− ' + eur0(target), sub: 'automaattinen siirto 15. päivä', tone: 'good' as const },
    { label: BASKET_FI.slipping, value: eur0(Math.max(0, slipAllowance)), sub: `nyt ${eur0(b.totals.slipping)} → ${eur0(Math.max(0, slipAllowance))}`, tone: needCut > 0 ? ('warn' as const) : ('good' as const) },
  ];
  return {
    msgs: [
      {
        text: `Tässä budjettisi, kun säästät **${eur0(target)} kuukaudessa**. Rakensin sen kolmen korin pohjalta. Pakolliset varataan ensin ja säästö lähtee heti palkkapäivänä (”maksa ensin itsellesi”).`,
        cards: [{ kind: 'list', title: `Kuukausibudjetti – säästö ${eur0(target)}/kk`, items }],
      },
      needCut > 0
        ? {
            text: `Jotta tämä onnistuu, lipsuvista menoista pitää löytää **${eur0(needCut)}/kk**.${b.left < 0 ? ` Siitä **${eur0(-b.left)}** on nykyisen vajeen paikkaamista: menosi ovat viime kuukausina ylittäneet tulot.` : ''} Etsin yhdistelmän, joka vaatii mahdollisimman pienet muutokset${ctx.prefs.protected.length ? ` eikä koske asioihin, joista et halua tinkiä (${ctx.prefs.protected.map((k) => LEVER_FI[k].toLowerCase()).join(', ')})` : ''}:`,
            cards: [{ kind: 'plan', title: 'Pienimmän muutoksen suunnitelma', plan }],
            chips: ['Tee budjetti 100 € säästöllä', 'Selitä 50/30/20-budjetti'],
          }
        : { text: 'Hyviä uutisia: nykyinen kulutuksesi mahtuu jo tähän budjettiin! Automatisoi siirto palkkapäivälle, niin se tapahtuu itsestään.', chips: ['Tee budjetti 300 € säästöllä'] },
    ],
  };
}

function optimizeGoal(raw: string, ctx: AgentCtx): AgentReply {
  const target = parseAmount(raw) ?? 150;
  // tilapäinen suojaus kysymyksestä: "luopumatta kuntosalista"
  const tmpProtect: LeverKey[] = [];
  const t = norm(raw);
  const m = t.match(/(luopumatta|ilman että luovun|paitsi|en halua luopua)\s+(.+)/);
  if (m) {
    const c = matchCat(m[2]);
    if (c?.lever) tmpProtect.push(c.lever);
  }
  const prefs: Prefs = { ...ctx.prefs, protected: [...new Set([...ctx.prefs.protected, ...tmpProtect])] };
  const { a, b } = plans(target, prefs);
  const msgs: BotMsg[] = [
    {
      text: `Laskin tämän optimointiongelmana. Kävin läpi kaikki leikkausyhdistelmät ${a.items.length ? 'ja etsin sen, joka saavuttaa tavoitteen **pienimmällä muutoksella arkeesi**' : ''}. Isot leikkaukset tuntuvat moninkertaisesti pahemmilta kuin pienet, joten useampi pieni muutos voittaa yleensä yhden ison.${tmpProtect.length ? ` **${LEVER_FI[tmpProtect[0]]}** on rajattu kokonaan pois.` : ''}`,
      cards: [{ kind: 'plan', title: `Vaihtoehto A – ${eur0(a.total)}/kk`, plan: a }],
    },
  ];
  if (b)
    msgs.push({
      text: `Toinen tapa päästä samaan, jos ${a.items[0]?.label.toLowerCase()} on sinulle tärkeä:`,
      cards: [{ kind: 'plan', title: `Vaihtoehto B – ${eur0(b.total)}/kk`, plan: b }],
    });
  if (!a.feasible)
    msgs.push({ text: `Rehellisesti: pelkillä leikkauksilla saadaan enintään ${eur0(a.total)}/kk. Loput ${eur0(target - a.total)} kannattaa hakea tuloista, esimerkiksi yhdellä lisävuorolla kuussa tai myymällä tarpeettomia tavaroita.` });
  msgs.push({ text: 'Hyväksy suunnitelma tai kerro, mistä et halua tinkiä. Opin valinnoistasi ja ehdotan jatkossa paremmin.', chips: ['Älä ehdota ravintoloista säästämistä', 'Mitä jos vähennän ravintoloita 30 % ja takseja 50 %?'] });
  return { msgs };
}

function goal(raw: string, ctx: AgentCtx): AgentReply {
  const amount = parseAmount(raw) ?? 2000;
  const { date, label } = parseTargetDate(raw);
  const months = Math.max(1, Math.round(daysBetween(TODAY, date) / 30.4));
  const perMonth = amount / months;
  const b = baskets();
  const surplus = b.left + ctx.profile.incomeDelta - ctx.profile.rentDelta;
  // jos menot ylittävät tulot, vaje pitää paikata ensin ja vasta sitten säästää
  const need = Math.max(0, perMonth - surplus);
  const { a, b: alt } = plans(need, ctx.prefs);
  const sim = baseSim(ctx, date, { until: date, monthlySaving: perMonth, leverMult: Object.fromEntries(a.items.map((i) => [i.key, 1 - i.pct / 100])) });
  const achievable = a.total + surplus; // €/kk mitä oikeasti voi säästää
  const realisticMonths = achievable > 0 ? Math.ceil(amount / achievable) : null;
  const msgs: BotMsg[] = [
    {
      text: `Tavoite: **${eur0(amount)} ${label}** (${fmtDate(date)}). Siihen on noin **${months} kuukautta**, joten säästettävää on **${eur0(perMonth)}/kk** eli ${eur0(perMonth / 4.3)}/vko.\n\nViime puolen vuoden aikana sinulle on jäänyt käteen keskimäärin **${eur0(surplus)}/kk**${surplus < 0 ? `, eli menot ovat ylittäneet tulot. **Ensin paikataan vuoto (${eur0(-surplus)}/kk), sitten säästetään.** Tavoitteeseen` : '. Siksi tavoitteeseen'} ${need > 0 ? `tarvitaan menoista yhteensä **${eur0(need)}/kk**.` : 'riittää jo nykyinen tahti, kunhan siirrät summan heti palkkapäivänä!'}`,
      cards: need > 0 ? [{ kind: 'plan', title: `Polku 1: pienimmät muutokset (${eur0(a.total)}/kk)`, plan: a }] : undefined,
    },
  ];
  if (need > 0 && !a.feasible)
    msgs.push({
      text: `**Rehellinen arvio:** pelkillä leikkauksilla tavoite ei toteudu ${label}. ${realisticMonths ? `Realistisella tahdilla (${eur0(achievable)}/kk) ${eur0(amount)} kertyy noin **${realisticMonths} kuukaudessa**.` : 'Ensin pitää saada tulot ja menot tasapainoon.'} Vaihtoehdot ovat pidempi aikataulu, pienempi tavoite tai lisätulot.`,
    });
  if (alt && need > 0) msgs.push({ text: 'Polku 2 on eri yhdistelmä samaan tavoitteeseen:', cards: [{ kind: 'plan', title: `Polku 2 (${eur0(alt.total)}/kk)`, plan: alt }] });
  msgs.push({
    text: `**Polku 3: lisätulot.** Jos teet yhden ylimääräisen vuoron kuukaudessa (noin 100–150 €), tarvittavat leikkaukset puolittuvat.${student(ctx) ? ' Opiskelijana tarkista myös, onko opintotukesi ja tulorajasi kunnossa.' : ''}\n\nSimuloin polun 1 kanssa saldon kehityksen. Säästöt siirtyvät palkkapäivänä erilliselle tilille:`,
    cards: [{ kind: 'forecast', title: `Käyttötilin saldo, kun ${eur0(perMonth)}/kk menee säästöön`, sim }],
    chips: ['Hyväksyn polun 1', 'Älä ehdota ravintoloista säästämistä'],
  });
  return { msgs };
}

function whatIf(raw: string, ctx: AgentCtx): AgentReply {
  const preset = parseWhatIf(raw);
  if (!Object.keys(preset).length)
    return { msgs: [{ text: 'Kokeillaan! Liikuta liukusäätimiä, niin näet vaikutuksen heti:', cards: [{ kind: 'whatif' }] }] };
  const mult = Object.fromEntries(Object.entries(preset).map(([k, v]) => [k, 1 - (v as number) / 100]));
  const base = baseSim(ctx);
  const alt = baseSim(ctx, END_DATE, { until: END_DATE, leverMult: mult });
  const rows = Object.entries(preset).map(([k, v]) => {
    const monthly = monthlyAvg((t) => leverOf(t.c, t.mcc, t.name) === k);
    return { key: k as LeverKey, pct: v as number, monthly, saving: (monthly * (v as number)) / 100 };
  });
  const total = rows.reduce((s, r) => s + r.saving, 0);
  return {
    msgs: [
      {
        text: `Laskin muutokset yhdessä:\n\n${rows.map((r) => `• **${LEVER_FI[r.key]} −${r.pct} %**: nyt ${eur0(r.monthly)}/kk, säästö **${eur0(r.saving)}/kk**`).join('\n')}\n\nYhteensä **${eur0(total)} kuukaudessa** eli **${eur0(total * 12)} vuodessa**. Vuoden lopussa saldo olisi noin **${eur0(alt.end.p50)}** (nyt ennuste ${eur0(base.end.p50)}).`,
        cards: [{ kind: 'forecast', title: 'Saldo vuoden loppuun: nyt ja muutoksen jälkeen', sim: base, compare: alt, baseLabel: 'Nykyinen tahti', compareLabel: 'Muutosten jälkeen' }],
      },
      {
        text: `**Vaihtoehtoiskustannus:** ${eur0(total)}/kk sijoitettuna 5 %:n vuosituotolla olisi 10 vuodessa noin **${eur0(total * ((Math.pow(1 + 0.05 / 12, 120) - 1) / (0.05 / 12)))}**. Hienosäädä alla olevilla säätimillä:`,
        cards: [{ kind: 'whatif', preset }],
      },
    ],
  };
}

function lifeSim(raw: string, ctx: AgentCtx): AgentReply {
  const t = norm(raw);
  let rentDelta = 0;
  let incomeDelta = 0;
  let what = '';
  const amt = parseAmount(raw);
  const pct = parsePercent(raw);
  if (/vuokra|muutan|yksin|asunto|muuttaa/.test(t)) {
    rentDelta = amt ?? 250;
    if (/halvemp|laske/.test(t)) rentDelta = -rentDelta;
    what = `vuokra ${rentDelta > 0 ? 'nousee' : 'laskee'} ${eur0(Math.abs(rentDelta))}`;
  }
  if (/tulo|palk|työ|lomaut|irtisan|opiskelemaan/.test(t)) {
    const inc = incomeMonthly();
    if (pct != null) incomeDelta = (inc * pct) / 100;
    else if (amt != null && !rentDelta) incomeDelta = amt;
    else if (/työttö|irtisan/.test(t)) incomeDelta = -inc * 0.4;
    else if (/lomaut/.test(t)) incomeDelta = -inc * 0.4;
    else if (/opiskelemaan/.test(t)) incomeDelta = -inc * 0.6;
    else incomeDelta = inc * 0.1;
    if (/laske|putoa|vähen|työttö|irtisan|lomaut|opiskelemaan/.test(t)) incomeDelta = -Math.abs(incomeDelta);
    what += (what ? ' ja ' : '') + `tulot ${incomeDelta > 0 ? 'nousevat' : 'laskevat'} ${eur0(Math.abs(incomeDelta))}/kk`;
  }
  const base = baseSim(ctx);
  const alt = simulate({ until: END_DATE, rentDelta: ctx.profile.rentDelta + rentDelta, incomeDelta: ctx.profile.incomeDelta + incomeDelta });
  const b = baskets();
  const newLeft = b.left - rentDelta + incomeDelta;
  const ok = newLeft >= 0 && alt.probNegative < 0.2;
  const rentShare = (rentMonthly() + rentDelta) / (incomeMonthly() + incomeDelta);
  return {
    msgs: [
      {
        text: `Simuloin elämänmuutoksen: **${what}**.\n\nKuukauden lopussa sinulle jäisi keskimäärin **${eur0(newLeft)}** (nyt ${eur0(b.left)}). ${ok ? 'Rahat riittävät, mutta puskuri ohenee.' : '**Rahat eivät riitä nykyisellä kulutuksella.** Jotain pitää muuttaa ennen muutosta.'}\n\nVuokra veisi **${Math.round(rentShare * 100)} %** tuloistasi. ${rentShare > 0.4 ? 'Yleinen suositus on enintään noin kolmannes, joten tämä on raskas.' : 'Se on vielä kohtuullinen osuus.'}`,
        cards: [{ kind: 'forecast', title: 'Saldo vuoden loppuun', sim: base, compare: alt, baseLabel: 'Nykytilanne', compareLabel: 'Muutoksen jälkeen' }],
      },
      {
        text: `${!ok ? `Jotta muutos onnistuisi, tarvitaan **${eur0(Math.max(0, -newLeft) + 50)}/kk** lisää tilaa. ` : ''}Muista myös kertakulut: vuokravakuus (yleensä 1–3 kk vuokra), muuttokulut ja kotivakuutus.${/yksin|muutan/.test(t) ? ' Selvitä myös, oletko oikeutettu asumistukeen.' : ''}\n\nHaluatko, että tallennan muutoksen? Silloin kaikki ennusteeni huomioivat sen.`,
        cards: !ok ? [{ kind: 'plan', title: 'Näin muutos saadaan mahtumaan', plan: optimize(Math.max(0, -newLeft) + 50, ctx.prefs) }] : undefined,
        chips: [`§save|${rentDelta}|${Math.round(incomeDelta)}|${what}`, 'Kerro lisää asumistuesta'],
      },
    ],
  };
}

export function saveLifeChange(raw: string, ctx: AgentCtx): AgentReply {
  const [, r, i, ...w] = raw.split('|');
  const what = w.join('|');
  const profile: Partial<Profile> = {
    rentDelta: ctx.profile.rentDelta + +r,
    incomeDelta: ctx.profile.incomeDelta + +i,
    changes: [...ctx.profile.changes, { date: TODAY, text: what }],
  };
  return {
    msgs: [{ text: `Tallennettu: **${what}**. Kaikki ennusteet, budjetit ja käyttövara-arviot huomioivat nyt tämän. Voit perua sen Minä-sivulta.`, chips: ['Tee minulle budjetti', 'Paljonko minulla on rahaa joulukuun lopussa?'] }],
    profile,
  };
}

function subscriptions(ctx: AgentCtx): AgentReply {
  const r = recurring();
  const subs = r.filter((x) => x.kind === 'subscription');
  const fixed = r.filter((x) => x.kind === 'rent' || x.kind === 'bills');
  const habitsR = r.filter((x) => x.kind === 'habit').slice(0, 3);
  const subTotal = subs.reduce((s, x) => s + x.amount, 0);
  const items = [
    ...fixed.map((x) => ({ label: x.label, value: eur(x.amount) + '/kk', sub: x.kind === 'rent' ? `noin ${x.day}. päivä` : 'useita laskuja kuussa' })),
    ...subs.map((x) => ({
      label: x.label + (x.demo ? ' (demo)' : ''),
      value: eur(x.amount) + '/kk',
      sub: x.suspicious
        ? `⚠ tuntematon saaja, veloitettu ${x.months} kk`
        : x.priceChange
          ? `Hinta nousi ${eur(x.priceChange.from)} → ${eur(x.priceChange.to)} (${monthName(x.priceChange.month)})`
          : `${x.day}. päivä joka kuu`,
      tone: x.suspicious ? ('bad' as const) : x.priceChange ? ('warn' as const) : undefined,
    })),
  ];
  const msgs: BotMsg[] = [
    {
      text: `Kävin läpi kaikki toistuvat veloitukset. Kiinteitä maksuja on **${fixed.length + subs.length}**, ja tilauksiin menee yhteensä **${eur(subTotal)}/kk** eli **${eur0(subTotal * 12)} vuodessa**.`,
      cards: [{ kind: 'list', title: 'Toistuvat maksut', items }],
    },
  ];
  const warnings: string[] = [];
  for (const x of subs) {
    if (x.priceChange) warnings.push(`**${x.label}** nosti hintaansa ${monthName(x.priceChange.month, true)} ${Math.round(((x.priceChange.to - x.priceChange.from) / x.priceChange.from) * 100)} %. Hinnankorotukset menevät usein ohi huomaamatta.`);
    if (x.suspicious) warnings.push(`**${x.label}** on tuntematon saaja. Veloitus tulee yöllä, sillä ei ole kauppiasluokkaa ja se alkoi vasta ${x.months} kk sitten. **Tarkista tämä.**`);
  }
  if (habitsR.length)
    warnings.push(`Lisäksi asioit usein samoissa paikoissa, vaikka ne eivät ole tilauksia: ${habitsR.map((h) => `${h.label} (${eur0(h.amount)}/kk)`).join(', ')}. Nekin ovat käytännössä ”tilauksia”.`);
  if (warnings.length) msgs.push({ text: warnings.join('\n\n'), chips: ['Tunnistanko kaikki veloitukset?', 'Miten saan säästettyä 50 €/kk?'] });
  if (!subs.length) msgs.push({ text: 'Datastasi ei löytynyt varsinaisia tilauksia. Hienoa! Moni maksaa huomaamattaan 3–5 suoratoistopalvelusta.' });
  return { msgs };
}

function scam(ctx: AgentCtx): AgentReply {
  const sus = recurring().filter((r) => r.suspicious);
  const q = anomalies(ctx.answers).filter((a) => a.id.startsWith('sus-'));
  return {
    msgs: [
      {
        text: `Tarkistan tilisi jatkuvasti näiden **huijauksen merkkien** varalta:\n• toistuva pieni veloitus tuntemattomalta saajalta\n• veloitus öiseen aikaan ilman kauppiasluokkaa\n• ilmainen kokeilujakso, joka muuttui maksulliseksi\n• hinta, joka nousee hiljaa\n\n${sus.length ? `Löysin **${sus.length} epäilyttävän** veloituksen:` : 'Tällä hetkellä en löydä mitään epäilyttävää. Hyvä!'}`,
        cards: q.length ? [{ kind: 'question', id: q[0].id, title: q[0].title, detail: q[0].detail, question: q[0].question!, options: q[0].options! }] : undefined,
      },
      {
        text: '**Muista:** pankki ei koskaan kysy tunnuksiasi tekstiviestillä tai puhelimessa. Jos joku kiirehtii sinua maksamaan tai vahvistamaan jotain, se on aina varoitusmerkki.',
      },
    ],
  };
}

function spenderTypeReply(ctx: AgentCtx): AgentReply {
  const st = spenderType();
  const b = baskets();
  const cats: [string, string][] = [['Restaurants', 'Ravintolat'], ['Groceries', 'Ruokakauppa'], ['Entertainment', 'Viihde'], ['Lifestyle', 'Shoppailu'], ['Transportation', 'Liikkuminen']];
  const rows = cats.map(([k, l]) => ({ label: l, value: monthlyAvg((t) => t.c === k), peer: PEER[k] }));
  return {
    msgs: [
      {
        text: `Olet **${st.type}**. ${st.desc}`,
        cards: [
          { kind: 'bars', title: 'Sinä vs. samanikäiset asiakkaat (€/kk)', rows, note: `Viiva = ${PEER_GROUP} (${PEER_N} asiakasta), mediaani. Lähde: S-Pankin synteettinen aineisto.` },
        ],
      },
      {
        text: `Lipsuvien menojen osuus on **${Math.round(st.slipShare * 100)} %** kaikista menoistasi${st.saveRate < 0 ? ', ja viime puolella vuodella menot ovat ylittäneet tulot' : ''}. ${teachy(ctx, 'Tyyppi ei ole tuomio vaan peili. Sen tunnistaminen on ensimmäinen askel.')}`,
        chips: ['Miksi käytän kuun alussa enemmän rahaa?', 'Mihin rahani menevät?'],
      },
    ],
  };
}

function habitsReply(ctx: AgentCtx): AgentReply {
  const h = habits();
  const top = topSinks(3, 3);
  const anomalyList = anomalies(ctx.answers).filter((a) => a.severity === 'warn');
  const ratioEarlyLate = h.earlyPerDay / h.latePerDay;
  return {
    msgs: [
      {
        text: `Tutkin tottumuksiasi viimeisen puolen vuoden ajalta. Löysin nämä kaavat:\n\n**Palkkapäiväefekti.** Palkkasi tulee 15. päivä. Sitä seuraavana viikkona käytät **${eur0(h.payPerDay)}/päivä**, muuten **${eur0(h.otherPerDay)}/päivä** (${h.payRatio.toFixed(1).replace('.', ',')}-kertainen). ${Math.abs(ratioEarlyLate - 1) > 0.15 ? `Kuun alussa (1.–10.) käytät ${ratioEarlyLate > 1 ? 'enemmän' : 'vähemmän'} kuin lopussa (${eur0(h.earlyPerDay)} vs ${eur0(h.latePerDay)}/pv).` : ''}${h.smallCountPerMonth >= 4 ? `\n\n**Pienet ostokset.** Teet kuussa noin **${Math.round(h.smallCountPerMonth)} alle 15 €:n ostosta**, yhteensä ${eur0(h.smallPerMonth)}/kk eli **${eur0(h.smallPerMonth * 12)} vuodessa**.` : ''}\n\n**Myöhäiset ostokset.** Klo 22 jälkeen kuluu ${eur0(h.nightPerMonth)}/kk (${Math.round(h.nightCountPerMonth)} ostosta).\n\n**Viikonpäivä.** Eniten käytät **${h.topWeekday}na** (${Math.round(h.topWeekdayShare * 100)} %), ja viikonloppujen osuus on ${Math.round(h.weekendShare * 100)} %.`,
        cards: [
          { kind: 'list', title: 'Top 3 – mihin lipsuvat rahat menevät', items: top.map((x, i) => ({ label: `${i + 1}. ${x.label}`, value: eur0(x.monthly) + '/kk', sub: `${Math.round(x.perMonthCount)} kertaa kuussa, keskim. ${eur(x.avgTicket)} • vuodessa ${eur0(x.yearly)}`, tone: i === 0 ? ('warn' as const) : undefined })) },
        ],
      },
      {
        text: `${anomalyList.length ? `**Poikkeamat:** ${anomalyList.map((a) => a.detail).join(' ')}\n\n` : ''}**Mitä tehdä?** Palkkapäiväefektiin auttaa parhaiten automaattinen säästösiirto 15. päivälle. Raha, jota ei näe, ei myöskään kulu.`,
        chips: ['Mikä on palkkapäiväefekti?', 'Miten saan säästettyä 100 €/kk?'],
      },
    ],
  };
}

function whereMoneyGoes(ctx: AgentCtx): AgentReply {
  const top = topSinks(3, 3);
  return {
    msgs: [
      {
        text: `Kuvittele, että viimeiset **1 000 euroa** arjen ostoksiin olisivat 100 kolikkoa, kukin 10 €. Näin ne jakautuivat:`,
        cards: [{ kind: 'blocks' }],
      },
      {
        text: `Suurimmat lipsuvat kohteet viimeisen 3 kuukauden ajalta:\n\n${top.map((x, i) => `**${i + 1}. ${x.label}**: ${eur0(x.monthly)}/kk eli **${eur0(x.yearly)} vuodessa** (${Math.round(x.perMonthCount)} kertaa kuussa)`).join('\n')}\n\n${teachy(ctx, `**Talousoppi:** ${top[0]?.label} vie vuodessa ${eur0(top[0]?.yearly ?? 0)}. Jos vähennät sitä 20 %, säästät ${eur0((top[0]?.yearly ?? 0) * 0.2)} vuodessa ilman, että luovut siitä.`)}`,
        cards: [{ kind: 'baskets' }],
        chips: ['Mitä jos vähennän ravintoloita 20 %?', 'Miksi käytän kuun alussa enemmän rahaa?'],
      },
    ],
  };
}

function buffer(ctx: AgentCtx): AgentReply {
  const ms = lastMonths(12);
  const irregular = sumOut((t) => t.c === 'Health' || (t.c === 'Home & Tech' && (t.mcc === 5200 || t.mcc === 5251 || t.mcc === 5732)), `${ms[0]}-01`, TODAY);
  const biggest = txs()
    .filter((t) => t.d >= `${ms[0]}-01` && (t.c === 'Health' || t.c === 'Home & Tech') && t.a < -100)
    .sort((a, b) => a.a - b.a)
    .slice(0, 3);
  const b = baskets();
  const must = b.totals.regular + b.totals.irregular;
  const perMonth = irregular / 12;
  return {
    msgs: [
      {
        text: `Viime 12 kuukauden aikana pakollisia mutta epäsäännöllisiä menoja (terveys, korjaukset, rikkoutuneet laitteet) oli yhteensä **${eur0(irregular)}**. Se tekee keskimäärin **${eur0(perMonth)}/kk**, vaikka ne tulivat ryöpsähdyksinä.\n\nSuosittelen kahta erillistä varausta:\n\n**1. Yllätysvara:** siirrä **${eur0(Math.ceil(perMonth / 10) * 10)}/kk** omalle tilille. Kun lasku tulee, raha on jo olemassa.\n\n**2. Hätärahasto:** tavoitteena 3 kk pakolliset menot eli **${eur0(must * 3)}**. Pienempi välitavoite on ${eur0(must)}.`,
        cards: [
          { kind: 'list', title: 'Suurimmat yllätykset viime vuonna', items: biggest.map((t) => ({ label: t.mcc ? MCC_FI[t.mcc] : t.c, value: eur0(-t.a), sub: fmtDate(t.d) })) },
          { kind: 'lesson', title: 'Miksi yllätyksiin säästetään etukäteen?', body: 'Jos auton huolto maksaa 600 € kerran vuodessa, se on oikeasti 50 € kuukaudessa. Kun ajattelet sen kuukausimaksuna, yllätys lakkaa olemasta yllätys.' },
        ],
        chips: ['Selitä hätärahasto', 'Haluan säästää 1 000 € hätärahastoon vuodessa'],
      },
    ],
  };
}

function review(t: string, ctx: AgentCtx): AgentReply {
  const monthly = /kuu/.test(t);
  if (monthly) {
    const [cur] = lastMonths(1);
    const ms = lastMonths(7).slice(0, 6);
    const curS = sumOut(isOut, `${cur}-01`, `${cur}-31`);
    const avg = ms.reduce((s, m) => s + sumOut(isOut, `${m}-01`, `${m}-31`), 0) / ms.length;
    const top = topSinks(1, 3);
    return {
      msgs: [
        {
          text: `**Kuukausikatsaus – ${monthName(cur)}**\n\nMenoja oli **${eur0(curS)}**, kun keskiarvo on ${eur0(avg)} (${curS < avg ? 'säästit **' + eur0(avg - curS) + '**' : 'ylitys **' + eur0(curS - avg) + '**'}). Palkka oli ${eur0(lastSalary().a)}.\n\nTämän kuun suurimmat lipsuvat: ${top.map((x) => `${x.label} ${eur0(x.monthly)}`).join(', ')}.`,
          cards: [{ kind: 'baskets' }],
          chips: curS < avg ? [`Siirrä ${eur0(avg - curS)} säästöön`, 'Tee minulle budjetti'] : ['Mitä jos vähennän ravintoloita 30 %?', 'Tee minulle budjetti'],
        },
      ],
    };
  }
  const from = addDays(TODAY, -6);
  const week = sumOut((t) => isOut(t) && t.c !== 'Housing' && t.c !== 'Utilities', from, TODAY);
  const avgWeek = (monthlyAvg((t) => isOut(t) && t.c !== 'Housing' && t.c !== 'Utilities') * 12) / 52;
  const diff = avgWeek - week;
  const wk = spendQuery((t) => isOut(t) && t.c !== 'Housing' && t.c !== 'Utilities', from, TODAY);
  const byLabel: Record<string, number> = {};
  wk.list.forEach((x) => (byLabel[labelOf(x)] = (byLabel[labelOf(x)] || 0) - x.a));
  const topL = Object.entries(byLabel).sort((a, b) => b[1] - a[1])[0];
  return {
    msgs: [
      {
        text: `**Viikkokatsaus ${fmtDay(from)}–${fmtDay(TODAY)}**\n\nKäytit arkeen **${eur0(week)}**, kun tavallinen viikko on ${eur0(avgWeek)}. ${diff > 0 ? `Säästit **${eur0(diff)}** tavalliseen verrattuna. Hienoa! Ennen vanhaan tästä olisi saanut kiiltokuvan.` : `Käytit **${eur0(-diff)}** tavallista enemmän.`}${topL ? `\n\nSuurin yksittäinen ryhmä oli **${topL[0]}** (${eur0(topL[1])}).` : ''}\n\n**Viikon yksi teko:** ${diff > 0 ? `siirrä ${eur0(diff)} säästötavoitteeseesi, niin säästö ei ”vuoda” takaisin kulutukseen.` : `pidä ensi viikolla ${topL ? topL[0].toLowerCase() : 'lipsuvat'} enintään ${eur0((topL?.[1] ?? 50) * 0.6)}:ssa.`}`,
        chips: diff > 0 ? [`Siirrä ${eur0(diff)} säästöön`, 'Kuukausikatsaus'] : ['Kuukausikatsaus', 'Paljonko voin käyttää tällä viikolla?'],
      },
    ],
  };
}

function loan(ctx: AgentCtx): AgentReply {
  const inc = incomeMonthly();
  const b = baskets();
  return {
    msgs: [
      {
        text: `Lainasta kolme tärkeää asiaa omilla luvuillasi:\n\n**1. Lainan hinta on enemmän kuin korko.** Siihen kuuluvat myös avausmaksu ja kuukausimaksut. 2 000 €:n kulutusluotto 15 %:n korolla kahdessa vuodessa maksaa koroiksi noin 330 €.\n\n**2. Maksuvara.** Sinulle jää kuussa keskimäärin **${eur0(b.left)}**. Uusi lainanlyhennys pitäisi mahtua tähän niin, että puskuria jää vielä.\n\n**3. Asuntolaina.** Tyypillisesti tarvitset omaa säästöä ensiasuntoon (usein noin 5–10 % hinnasta). Tuloillasi (${eur0(inc)}/kk) säännöllinen asuntosäästäminen kannattaa aloittaa jo nyt. Voin tehdä sinulle säästöpolun.`,
        chips: ['Haluan säästää 5 000 € vuodessa', 'Selitä korkoa korolle'],
      },
    ],
  };
}

function income(ctx: AgentCtx): AgentReply {
  const sal = txs().filter((t) => t.ty === 'salary').slice(-12);
  const amounts = sal.map((t) => t.a);
  const other = txs().filter((t) => t.ty === 'other_income');
  return {
    msgs: [
      {
        text: `Palkkasi tulee **15. päivä**. Viimeisen vuoden aikana se on ollut keskimäärin **${eur0(amounts.reduce((s, x) => s + x, 0) / amounts.length)}**, pienimmillään ${eur0(Math.min(...amounts))} ja suurimmillaan ${eur0(Math.max(...amounts))}.${other.length ? `\n\nLisäksi muita tuloja: ${other.map((t) => `${eur0(t.a)} (${fmtDate(t.d)})`).join(', ')}.` : ''}\n\n${teachy(ctx, '**Talousoppi:** Kun tulot vaihtelevat, budjetti kannattaa tehdä pienimmän tavallisen palkan mukaan. Hyvinä kuukausina ylijäämä menee suoraan puskuriin.')}`,
        cards: [{ kind: 'bars', title: 'Palkat viimeisen 12 kk ajalta', rows: sal.map((t) => ({ label: monthName(t.d.slice(0, 7)).slice(0, 3), value: t.a })) }],
      },
    ],
  };
}

function categorySpend(raw: string, ctx: AgentCtx): AgentReply {
  const c = matchCat(raw);
  const p = parsePeriod(raw);
  const pred = c ? c.pred : isOut;
  const q = spendQuery(pred, p.from, p.to);
  const avg = monthlyAvg(pred);
  const label = c?.label ?? '';
  const peerKey = c ? ({ ravintolat: 'Restaurants', ruokakauppa: 'Groceries', shoppailu: 'Lifestyle', matkailu: 'Travel', 'viihde ja tapahtumat': 'Entertainment' } as Record<string, string>)[c.label] : undefined;
  const peer = peerKey ? PEER[peerKey] : undefined;
  const biggest = [...q.list].sort((a, b) => a.a - b.a).slice(0, 3);
  return {
    msgs: [
      {
        text: `${cap(p.label)} ${label ? `käytit kohteeseen **${label}**` : 'menosi olivat'} yhteensä **${eur(q.sum)}** (${q.count} ${q.count === 1 ? 'tapahtuma' : 'tapahtumaa'}). Puolen vuoden keskiarvo on ${eur0(avg)}/kk${peer ? `, ja samanikäisillä keskimäärin ${eur0(peer)}/kk` : ''}.${avg > 0 ? ` Vuodessa se on noin **${eur0(avg * 12)}**.` : ''}`,
        cards: biggest.length ? [{ kind: 'list', title: 'Suurimmat tapahtumat', items: biggest.map((t) => ({ label: merchantName(t), value: eur(-t.a), sub: `${fmtDate(t.d)} klo ${t.t.slice(0, 5)}` })) }] : undefined,
        chips: c?.lever ? [`Mitä jos vähennän ${c.label}a 30 %?`.replace('aa ', 'a '), 'Mihin rahani menevät?'] : ['Mihin rahani menevät?'],
      },
    ],
  };
}

function preference(t: string, ctx: AgentCtx): AgentReply {
  const c = matchCat(t);
  let lever = c?.lever;
  if (!lever) for (const o of PROTECT_OPTIONS) if (o.label.toLowerCase().split(' ').some((w) => w.length > 4 && t.includes(w.slice(0, 5)))) lever = o.levers[0];
  if (!lever) return { msgs: [{ text: 'Selvä! Mistä asiasta en ehdota säästämistä? Esimerkiksi ”Älä ehdota liikunnasta säästämistä”.' }] };
  const prefs: Prefs = { ...ctx.prefs, protected: [...new Set([...ctx.prefs.protected, lever])] };
  return {
    msgs: [
      {
        text: `Ymmärrän täysin. **${LEVER_FI[lever]}** on sinulle tärkeää, enkä enää ehdota siitä säästämistä. Kaikki suunnitelmat lasketaan jatkossa muiden asioiden kautta.\n\nNäet ja voit muuttaa oppimani asiat Minä-sivulla. Jos tilanteesi joskus muuttuu, voit pyytää minua tarkastelemaan sitäkin. En kuitenkaan tyrkytä sitä.`,
        chips: ['Miten saan säästettyä 150 €/kk?'],
      },
    ],
    prefs,
  };
}

function planFeedback(raw: string, ctx: AgentCtx): AgentReply {
  const [, action, keysStr] = raw.split('|');
  const keys = keysStr.split(',').filter(Boolean) as LeverKey[];
  if (action === 'accept') {
    const accepted = { ...ctx.prefs.accepted };
    keys.forEach((k) => (accepted[k] = (accepted[k] ?? 0) + 1));
    return {
      msgs: [{ text: `Erinomaista! Seuraan suunnitelmaa ja kerron viikkokatsauksessa, miten se sujuu. **Vinkki:** laita säästösumma automaattiseksi siirroksi palkkapäivälle (15.), niin suunnitelma toteutuu itsestään.`, chips: ['Viikkokatsaus', 'Paljonko voin käyttää tällä viikolla?'] }],
      prefs: { ...ctx.prefs, accepted },
    };
  }
  const rejections = { ...ctx.prefs.rejections };
  keys.forEach((k) => (rejections[k] = (rejections[k] ?? 0) + 1));
  const prefs = { ...ctx.prefs, rejections };
  const k = keys[0];
  const target = 100;
  return {
    msgs: [
      {
        text: `Selvä, kevennän ${LEVER_FI[k].toLowerCase()}-ehdotuksia. Painotan jatkossa muita keinoja, mutta en sulje vaihtoehtoa kokonaan pois. Jos haluat, että en koske siihen lainkaan, sano ”Älä ehdota ${LEVER_FI[k].toLowerCase()}”. Tässä uusi yhdistelmä:`,
        cards: [{ kind: 'plan', title: 'Päivitetty suunnitelma', plan: optimize(target, prefs) }],
      },
    ],
    prefs,
  };
}

export type { Card };
