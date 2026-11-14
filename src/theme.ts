// S-mobiilin värit – mitattu pikseleistä kuvakaappauksista (design/reference/, ks. design/REFERENCE.md)
export const C = {
  green: '#00AE42', // aktiivinen alapalkin kuvake (täytetty talo/lompakko)
  greenDark: '#007842', // bonustalo, (+)-nappi, Tuki-nappi
  greenDeep: '#005A2D', // tummat taustat
  greenText: '#126645', // otsikot, summat, linkit ("Tilit ja kortit", "157,80 €", "Avaa")
  icon: '#00A945', // ääriviivakuvakkeet (S-Pankin kuvitusikonit, design/reference/ikonit)
  iconAccent: '#0B5E36', // ikonien tummanvihreä korostus (ruksi, huutomerkki)
  mint: '#EBF7ED', // sivujen taustan vaalea minttu
  mint2: '#D3ECDC',
  mint3: '#BFE3CB',
  avatar: '#CDEFD6', // Minä-sivun profiilipallo
  white: '#FFFFFF',
  text: '#161616',
  sub: '#5E5E5E',
  tabInactive: '#5F5F5F',
  divider: '#E7E7E7',
  line: '#E4E9E6',
  input: '#F3F4F3',
  gray: '#8B908D',
  amber: '#F0A92E',
  coral: '#E5674F',
  danger: '#C8382A',
  teal: '#1F5E63', // Per Tieerin univormu
  gold: '#C9A23A',
};

export const BASKET_COLORS = {
  regular: '#007A3E',
  irregular: '#F0A92E',
  slipping: '#E5674F',
} as const;

export const CAT_COLORS = [
  '#007A3E', '#00AA4F', '#7BCB95', '#F0A92E', '#E5674F', '#1F5E63', '#9B6FB8', '#3B8FD9', '#C9A23A', '#A3ADA8',
];

export const radius = { card: 14, pill: 999 };

export const shadow = {
  shadowColor: '#0B3D22',
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 1,
};
