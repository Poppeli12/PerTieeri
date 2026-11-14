import React from 'react';
import * as A from './app';
import * as B from './base';

/**
 * Ikonirekisteri: kaikki sovelluksen ikonit nimellä. Per Tieeri (LLM) valitsee näistä sopivan
 * vastauksiinsa (show_list / show_stat), ja kulutusluokat saavat ikonin automaattisesti.
 * UUSI IKONI: piirrä se app.tsx:ään samaan tyyliin ja lisää tähän.
 */
type IconC = (p: { size?: number; color?: string }) => React.ReactElement;

export const ICONS: Record<string, IconC> = {
  // raha ja suunnittelu
  saldo: B.WalletIcon,
  kolikot: A.CoinsIcon,
  saasto: A.PiggyIcon,
  saastaja: B.TrophyIcon,
  ennuste: A.TrendIcon,
  palkkapaiva: A.CalendarIcon,
  palkka: B.SalaryIcon,
  tavoite: A.TargetIcon,
  korit: A.JarsIcon,
  toistuva: A.RepeatIcon,
  lasku: B.InvoiceEuroIcon,
  laina: B.LoanIcon,
  sijoitus: B.BriefcaseIcon,
  kortti: B.CardIcon,
  kuitti: B.ReceiptIcon,
  vinkki: A.BulbIcon,
  varoitus: A.AlertIcon,
  onnistui: A.HandsUpIcon,
  sopimus: A.HandshakeIcon,
  // turvallisuus
  turva: B.ShieldCheckIcon,
  tunnusluku: A.LockPinIcon,
  vahvistus: A.PhoneCheckIcon,
  avain: B.KeyIcon,
  // kulutusluokat
  ravintola: A.CutleryIcon,
  ruokakauppa: A.CartIcon,
  liikkuminen: A.BusIcon,
  taksi: A.CarIcon,
  vuokra: A.HouseIcon,
  laskut: A.BoltIcon,
  terveys: A.HealthIcon,
  matkailu: A.PlaneIcon,
  viihde: A.TicketIcon,
  liikunta: A.DumbbellIcon,
  suoratoisto: A.StreamIcon,
  shoppailu: A.ShoppingIcon,
  tekniikka: A.LaptopIcon,
  viesti: B.MailIcon,
  lahella: B.PinIcon,
};

export const ICON_NAMES = Object.keys(ICONS);

/** Kategoria (CAT_FI-avain), vipu (LeverKey) tai suomenkielinen nimi → ikonin nimi */
const BY_KEY: Record<string, string> = {
  Restaurants: 'ravintola',
  Groceries: 'ruokakauppa',
  Transportation: 'liikkuminen',
  Taxi: 'taksi',
  Utilities: 'laskut',
  Housing: 'vuokra',
  Entertainment: 'viihde',
  Fun: 'viihde',
  Health: 'terveys',
  'Home & Tech': 'tekniikka',
  HomeTech: 'tekniikka',
  Lifestyle: 'shoppailu',
  Travel: 'matkailu',
  Subscriptions: 'suoratoisto',
  Streaming: 'suoratoisto',
  Sport: 'liikunta',
  Salary: 'palkka',
  income: 'palkka',
  spend_total: 'kolikot',
  saved: 'saasto',
  savings_rate: 'saasto',
  balance_change: 'saldo',
  taxi: 'taksi',
};
const BY_WORD: [RegExp, string][] = [
  [/ravintol|kahvil|pikaruoka|ruokail|lounas/i, 'ravintola'],
  [/ruokakaup|market|prisma|alepa|sale\b|lidl|k-/i, 'ruokakauppa'],
  [/taksi|uber|bolt/i, 'taksi'],
  [/liikku|bussi|hsl|juna|vr\b|matkakortti/i, 'liikkuminen'],
  [/vuokra|asum/i, 'vuokra'],
  [/sähkö|netti|lasku|vakuutus/i, 'laskut'],
  [/suoratoisto|netflix|spotify|tilaus|stream/i, 'suoratoisto'],
  [/kuntosali|liikun|urheil/i, 'liikunta'],
  [/viihde|tapahtum|lippu|elokuv|konsert|nähtävyy/i, 'viihde'],
  [/terve|apteek|lääkä/i, 'terveys'],
  [/matk|lento|hotel/i, 'matkailu'],
  [/shoppail|vaate|kauneus/i, 'shoppailu'],
  [/elektro|tekniik|huonekal|koti/i, 'tekniikka'],
  [/palkka/i, 'palkka'],
  [/säästö|puskuri/i, 'saasto'],
];

export function iconNameFor(keyOrLabel?: string): string | undefined {
  if (!keyOrLabel) return undefined;
  if (ICONS[keyOrLabel]) return keyOrLabel;
  if (BY_KEY[keyOrLabel]) return BY_KEY[keyOrLabel];
  for (const [re, n] of BY_WORD) if (re.test(keyOrLabel)) return n;
  return undefined;
}

/** Piirrä ikoni nimen/kategorian perusteella (tai ei mitään, jos sopivaa ei löydy) */
export function AppIcon({ name, size = 26, color }: { name?: string; size?: number; color?: string }) {
  const n = iconNameFor(name);
  if (!n) return null;
  const C = ICONS[n];
  return <C size={size} color={color} />;
}
