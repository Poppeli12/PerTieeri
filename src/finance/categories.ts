export type Basket = 'regular' | 'irregular' | 'slipping';

export const BASKET_FI: Record<Basket, string> = {
  regular: 'Pakolliset säännölliset',
  irregular: 'Pakolliset epäsäännölliset',
  slipping: 'Arjen lipsuvat menot',
};

export const BASKET_SHORT: Record<Basket, string> = {
  regular: 'Säännölliset',
  irregular: 'Yllätykset',
  slipping: 'Lipsuvat',
};

export const BASKET_EXPLAIN: Record<Basket, string> = {
  regular:
    'Menot, jotka tulevat joka kuukausi ja joista ei helposti pääse eroon: vuokra, sähkö, netti, ruokakauppa ja työmatkat. Nämä kannattaa varata heti palkkapäivänä.',
  irregular:
    'Pakollisia, mutta ne eivät tule joka kuu: lääkäri, apteekki, rikkinäinen puhelin, kodin korjaukset. Koska niitä ei näe etukäteen, niihin kannattaa säästää pieni summa joka kuu.',
  slipping:
    'Vapaavalintaiset arjen menot, jotka valuvat huomaamatta sormien läpi: ravintolat, taksit, viihde, shoppailu. Täällä on yleensä suurin säästöpotentiaali.',
};

export const CAT_FI: Record<string, string> = {
  Groceries: 'Ruokakauppa',
  Restaurants: 'Ravintolat ja kahvilat',
  Transportation: 'Liikkuminen',
  Utilities: 'Asumisen laskut',
  Housing: 'Asumismaksut',
  Entertainment: 'Viihde ja vapaa-aika',
  Health: 'Terveys',
  'Home & Tech': 'Koti ja tekniikka',
  Lifestyle: 'Shoppailu',
  Travel: 'Matkailu',
  Salary: 'Palkka',
  'Other Income': 'Muu tulo',
  'Invest Deposit': 'Sijoitukset',
  'Invest Withdraw': 'Sijoitusten nosto',
  'Salary Sweep': 'Säästösiirto',
  Subscriptions: 'Tilaukset',
};

export const MCC_FI: Record<number, string> = {
  5411: 'Ruokakauppa',
  5422: 'Lihakauppa',
  5451: 'Leipomo ja maitotuotteet',
  5499: 'Kioskit ja erikoisruoka',
  5812: 'Ravintolat',
  5813: 'Baarit',
  5814: 'Pikaruoka ja kahvilat',
  4111: 'Julkinen liikenne',
  4121: 'Taksit',
  5541: 'Polttoaine',
  5542: 'Polttoaine (automaatti)',
  7523: 'Pysäköinti',
  7832: 'Elokuvat',
  7922: 'Tapahtumat ja liput',
  7991: 'Nähtävyydet',
  7996: 'Huvipuistot',
  7999: 'Liikunta ja vapaa-aika',
  5912: 'Apteekki',
  8011: 'Lääkäri',
  8021: 'Hammaslääkäri',
  8099: 'Terveyspalvelut',
  5200: 'Rautakauppa',
  5251: 'Työkalut',
  5712: 'Huonekalut',
  5732: 'Elektroniikka',
  5734: 'Ohjelmistot',
  5651: 'Vaatteet',
  5691: 'Vaatteet',
  5941: 'Urheiluvälineet',
  5942: 'Kirjat',
  5945: 'Pelit ja harrastukset',
  5999: 'Muut ostokset',
  4511: 'Lennot',
  4722: 'Matkatoimistot',
  7011: 'Hotellit',
  7512: 'Autonvuokraus',
};

export function basketOf(cat: string, mcc: number | null): Basket | null {
  switch (cat) {
    case 'Housing':
    case 'Utilities':
    case 'Groceries':
      return 'regular';
    case 'Transportation':
      return mcc === 4121 ? 'slipping' : 'regular';
    case 'Health':
      return 'irregular';
    case 'Home & Tech':
      return mcc === 5200 || mcc === 5251 || mcc === 5732 ? 'irregular' : 'slipping';
    case 'Restaurants':
    case 'Entertainment':
    case 'Lifestyle':
    case 'Travel':
    case 'Subscriptions':
      return 'slipping';
    default:
      return null; // tulot, sijoitukset, siirrot
  }
}

// Optimoinnin "vivut": asiat joista voi tinkiä
export type LeverKey =
  | 'Restaurants'
  | 'Taxi'
  | 'Fun'
  | 'Sport'
  | 'Lifestyle'
  | 'Travel'
  | 'HomeTech'
  | 'Groceries'
  | 'Streaming';

export const LEVER_FI: Record<LeverKey, string> = {
  Restaurants: 'Ravintolat ja kahvilat',
  Taxi: 'Taksit',
  Fun: 'Viihde ja tapahtumat',
  Sport: 'Liikunta ja kuntosali',
  Lifestyle: 'Shoppailu ja vaatteet',
  Travel: 'Matkailu',
  HomeTech: 'Kodin tavarat ja huonekalut',
  Groceries: 'Ruokakauppa',
  Streaming: 'Suoratoistotilaukset',
};

export const LEVER_LEVELS: Record<LeverKey, number[]> = {
  Restaurants: [0, 10, 20, 30, 40, 50],
  Taxi: [0, 25, 50, 75, 100],
  Fun: [0, 10, 20, 30, 40, 50],
  Sport: [0, 10, 20, 30],
  Lifestyle: [0, 10, 20, 30, 40, 50],
  Travel: [0, 25, 50],
  HomeTech: [0, 25, 50],
  Groceries: [0, 5, 10, 15],
  Streaming: [0, 50, 100],
};

export const LEVER_TIP: Record<LeverKey, string> = {
  Restaurants: 'Ota eväät kahtena päivänä viikossa ja keitä kahvit kotona.',
  Taxi: 'Korvaa myöhäiset taksit yöbussilla tai kaupunkipyörällä.',
  Fun: 'Valitse kuukauden tapahtumat etukäteen ja jätä spontaanit liput väliin.',
  Sport: 'Tarkista, käytätkö kaikkia lajeja, joista maksat.',
  Lifestyle: 'Kokeile 48 tunnin sääntöä: laita tuote ostoskoriin ja päätä vasta kahden päivän päästä.',
  Travel: 'Varaa matkat aikaisin ja joustavilla päivillä.',
  HomeTech: 'Katso kirpputorit ja käytetyt ennen uuden ostamista.',
  Groceries: 'Tee viikon ruokalista ja ostoslista, ja hyödynnä S-Etukortin edut.',
  Streaming: 'Pidä yksi palvelu kerrallaan ja vaihda kuukausittain.',
};

export function leverOf(cat: string, mcc: number | null, name?: string): LeverKey | null {
  if (cat === 'Subscriptions') {
    if (name && /kuntosali/i.test(name)) return 'Sport';
    if (name && /suoratoisto/i.test(name)) return 'Streaming';
    return null;
  }
  if (cat === 'Restaurants') return 'Restaurants';
  if (cat === 'Transportation' && mcc === 4121) return 'Taxi';
  if (cat === 'Entertainment') return mcc === 7999 ? 'Sport' : 'Fun';
  if (cat === 'Lifestyle') return mcc === 5941 ? 'Sport' : 'Lifestyle';
  if (cat === 'Travel') return 'Travel';
  if (cat === 'Home & Tech' && basketOf(cat, mcc) === 'slipping') return 'HomeTech';
  if (cat === 'Groceries') return 'Groceries';
  return null;
}

// Onboardingin "en tingi" -valinnat -> vivut
export const PROTECT_OPTIONS: { label: string; levers: LeverKey[] }[] = [
  { label: 'Liikunta ja harrastukset', levers: ['Sport'] },
  { label: 'Ravintolat ja kahvilat', levers: ['Restaurants'] },
  { label: 'Matkailu', levers: ['Travel'] },
  { label: 'Viihde ja tapahtumat', levers: ['Fun'] },
  { label: 'Vaatteet ja shoppailu', levers: ['Lifestyle'] },
];
