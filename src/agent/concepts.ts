import { baskets, eur0, habits, incomeMonthly, rentMonthly, safeToSpend } from '../finance/analytics';
import type { BotMsg } from './types';

type Concept = {
  keys: RegExp;
  title: string;
  body: () => string;
  quiz: { q: () => string; options: () => string[]; correct: number; why: () => string };
};

const fv = (monthly: number, years: number, r = 0.05) => {
  const i = r / 12;
  const n = years * 12;
  return monthly * ((Math.pow(1 + i, n) - 1) / i);
};

export const CONCEPTS: Concept[] = [
  {
    keys: /hätära|puskur|hätävar/,
    title: 'Hätärahasto',
    body: () => {
      const b = baskets();
      const must = b.totals.regular + b.totals.irregular;
      return `Hätärahasto on erillinen säästö yllätyksiä varten, esimerkiksi rikkinäistä puhelinta, hammaslääkäriä tai työttömyyttä varten. Yleinen nyrkkisääntö on 3 kuukauden pakolliset menot.\n\nSinun pakolliset menosi ovat noin **${eur0(must)}/kk**, joten tavoite olisi **${eur0(must * 3)}**. Aloita pienemmästä: jo **${eur0(must)}** eli yhden kuukauden menot muuttaa paljon.`;
    },
    quiz: {
      q: () => 'Mihin hätärahastoa kannattaa käyttää?',
      options: () => ['Alennusmyynnin takkiin', 'Rikkinäisen puhelimen korjaukseen', 'Lomamatkaan'],
      correct: 1,
      why: () => 'Hätärahasto on pakollisille yllätyksille. Alennusmyynnit ja lomat kuuluvat omaan säästötavoitteeseensa.',
    },
  },
  {
    keys: /vaihtoehtoiskust|opportunity/,
    title: 'Vaihtoehtoiskustannus',
    body: () => {
      const h = habits();
      const m = h.smallPerMonth;
      return `Vaihtoehtoiskustannus on se, mistä luovut, kun valitset jotain muuta. Kun käytät 10 € kahviin, luovut kaikesta muusta, mitä samalla rahalla olisi voinut tehdä.\n\nSinulla pieniin alle 15 €:n ostoksiin menee noin **${eur0(m)}/kk**. Jos puolet siitä menisi 5 %:n vuosituotolla säästöön, **10 vuodessa** kertyisi noin **${eur0(fv(m / 2, 10))}**.`;
    },
    quiz: {
      q: () => 'Mikä on 15 €:n elokuvalipun vaihtoehtoiskustannus?',
      options: () => ['15 €', 'Paras asia, jonka olisit muuten tehnyt samalla rahalla ja ajalla', 'Ei mitään, jos lippu oli tarjouksessa'],
      correct: 1,
      why: () => 'Vaihtoehtoiskustannus ei ole hinta vaan se paras vaihtoehto, josta luovuit.',
    },
  },
  {
    keys: /korkoa korolle|korko korolle|compound|kasvaa sijoitu|sijoittami/,
    title: 'Korkoa korolle',
    body: () =>
      `Korkoa korolle tarkoittaa, että tuotto alkaa tuottaa itsekin. 50 €/kk 5 %:n vuosituotolla:\n• 5 vuodessa ≈ **${eur0(fv(50, 5))}** (sijoitit 3 000 €)\n• 10 vuodessa ≈ **${eur0(fv(50, 10))}** (sijoitit 6 000 €)\n• 30 vuodessa ≈ **${eur0(fv(50, 30))}** (sijoitit 18 000 €)\n\nAika on tärkein tekijä, ja juuri siksi 21-vuotiaana aloittaminen on niin arvokasta. Tuotto ei ole koskaan taattu, ja arvo voi myös laskea.`,
    quiz: {
      q: () => 'Kumpi kerryttää todennäköisesti enemmän: 50 €/kk 30 vuotta vai 100 €/kk 15 vuotta (5 %/v)?',
      options: () => ['50 €/kk 30 vuotta', '100 €/kk 15 vuotta', 'Sama asia'],
      correct: 0,
      why: () => `Pidempi aika voittaa: noin ${eur0(fv(50, 30))} vs ${eur0(fv(100, 15))}, vaikka sijoitettu summa on sama.`,
    },
  },
  {
    keys: /inflaat|hinnat nous|ostovoim/,
    title: 'Inflaatio',
    body: () =>
      'Inflaatio tarkoittaa, että hinnat nousevat ja sama euro ostaa vähitellen vähemmän. Jos inflaatio on 3 %, 1 000 € ostaa vuoden päästä vain noin 970 euron verran tavaraa.\n\nSiksi pitkän ajan säästöt kannattaa pitää paikassa, jonka tuotto voi ylittää inflaation. Hätärahasto taas pidetään turvassa ja käytettävissä.',
    quiz: {
      q: () => 'Inflaatio on 3 % ja tilisi korko 0 %. Mitä säästöillesi tapahtuu vuodessa?',
      options: () => ['Ne pysyvät samoina', 'Niiden ostovoima laskee noin 3 %', 'Ne kasvavat 3 %'],
      correct: 1,
      why: () => 'Eurojen määrä pysyy samana, mutta niillä saa vähemmän.',
    },
  },
  {
    keys: /budjet|50\/30\/20/,
    title: 'Budjetti ja 50/30/20-sääntö',
    body: () => {
      const inc = incomeMonthly();
      return `Budjetti on etukäteen tehty suunnitelma rahan käytöstä. Helppo aloitus on 50/30/20-sääntö:\n• **50 %** pakollisiin (${eur0(inc * 0.5)})\n• **30 %** omiin haluihin (${eur0(inc * 0.3)})\n• **20 %** säästöön (${eur0(inc * 0.2)})\n\nPelkkä vuokrasi vie jo ${Math.round((rentMonthly() / inc) * 100)} % tuloistasi, joten sinulle sopii paremmin oma versio. Pyydä: ”Tee minulle budjetti”.`;
    },
    quiz: {
      q: () => 'Missä järjestyksessä palkka kannattaa ”jakaa” palkkapäivänä?',
      options: () => ['Kivat ensin, laskut lopuksi', 'Pakolliset ja säästö ensin, loput vapaaseen käyttöön', 'Kaikki samalle tilille ja katsotaan'],
      correct: 1,
      why: () => '”Maksa ensin itsellesi”: kun säästö ja laskut lähtevät heti, loput voi käyttää huoletta.',
    },
  },
  {
    keys: /käyttövar|turvallin|safe to spend|1 ?500/,
    title: 'Turvallinen käyttövara',
    body: () => {
      const s = safeToSpend();
      return `Tilin saldo ei ole sama kuin käyttövara. Saldosta pitää ensin varata kaikki, mikä on jo ”luvattu” ennen seuraavaa palkkaa.\n\nSinulla on nyt **${eur0(s.balance)}**, mutta ennen ${s.until.slice(8)}.${+s.until.slice(5, 7)}. palkkaa menee vielä vuokra ${eur0(s.rentDue)}, laskut ${eur0(s.bills)}, ruoka ${eur0(s.groceries)}, tilaukset ${eur0(s.subs)} ja yllätysvara ${eur0(s.buffer)}.\n\nTurvallisesti käytettävissä on noin **${eur0(Math.max(0, s.free))}**, eli **${eur0(s.perWeek)} viikossa**.`;
    },
    quiz: {
      q: () => 'Tilillä on 1 500 €, vuokra 950 € erääntyy ensi viikolla ja ruokaan menee 200 €. Paljonko on oikeasti vapaata?',
      options: () => ['1 500 €', '550 €', 'Noin 350 € tai vähemmän'],
      correct: 2,
      why: () => '1 500 − 950 − 200 = 350 €, ja siitäkin kannattaa jättää pieni yllätysvara.',
    },
  },
  {
    keys: /palkkapäiv|mentaali|mental account/,
    title: 'Palkkapäiväefekti',
    body: () => {
      const h = habits();
      return `Palkkapäiväefekti tarkoittaa, että raha tuntuu runsaalta heti, kun se tulee tilille, ja kulutus kasvaa huomaamatta.\n\nSinulla palkkaviikon päiväkulutus on **${h.payRatio.toFixed(1).replace('.', ',')}-kertainen** muuhun kuukauteen verrattuna (${eur0(h.payPerDay)} vs ${eur0(h.otherPerDay)} päivässä). Lääke tähän on automaattinen säästösiirto palkkapäivälle, jolloin rahaa ei ehdi edes nähdä.`;
    },
    quiz: {
      q: () => 'Mikä auttaa parhaiten palkkapäiväefektiin?',
      options: () => ['Kova tahdonvoima', 'Automaattinen siirto säästöön palkkapäivänä', 'Saldon katsominen harvemmin'],
      correct: 1,
      why: () => 'Automaatio voittaa tahdonvoiman: raha, jota ei näe, ei myöskään kulu.',
    },
  },
  {
    keys: /säästöast|säästöprosent/,
    title: 'Säästöaste',
    body: () => {
      const b = baskets();
      const r = b.left / b.income;
      return `Säästöaste kertoo, kuinka suuri osa tuloista jää käteen. Sen saa jakamalla tulojen ja menojen erotuksen tuloilla.\n\nSinulla se on viime puolen vuoden ajalta **${Math.round(r * 100)} %**${r < 0 ? ', eli menot ovat olleet tuloja suuremmat ja erotus on otettu tilin saldosta' : ''}. Jo 5–10 %:n säästöaste rakentaa vuodessa hyvän puskurin.`;
    },
    quiz: {
      q: () => 'Tulot 2 000 €, menot 1 800 €. Mikä on säästöaste?',
      options: () => ['10 %', '20 %', '90 %'],
      correct: 0,
      why: () => '(2 000 − 1 800) / 2 000 = 10 %.',
    },
  },
];

export function teach(text: string, id: string): BotMsg | null {
  const c = CONCEPTS.find((k) => k.keys.test(text));
  if (!c) return null;
  return {
    text: `Mainio kysymys. Ennen tämä opetettiin pankkikirjan kanssa, nyt teemme sen sinun omilla luvuillasi.`,
    cards: [
      { kind: 'lesson', title: c.title, body: c.body() },
      { kind: 'quiz', id: `quiz-${id}`, q: c.quiz.q(), options: c.quiz.options(), correct: c.quiz.correct, why: c.quiz.why() },
    ],
  };
}

export const CONCEPT_CHIPS = ['Selitä hätärahasto', 'Mikä on vaihtoehtoiskustannus?', 'Selitä korkoa korolle', 'Mikä on palkkapäiväefekti?'];
