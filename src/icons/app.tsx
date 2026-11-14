import React from 'react';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

/**
 * S-Pankin / S-mobiilin kuvitusikonit (design/reference/ikonit/*.png).
 * Tyyli: kirkkaanvihreä ääriviiva #00A945, tasapaksu viiva (1,7 / 24), pyöristetyt päät ja kulmat,
 * tummanvihreä korostus #0B5E36 pienissä yksityiskohdissa (ruksi, huutomerkki, tähdet, €).
 * Kaikki 24 × 24 -ruudussa, joten ne skaalautuvat samassa suhteessa kuin muut sovelluksen ikonit.
 */

export const ICON_GREEN = '#00A945';
export const ICON_ACCENT = '#0B5E36';

export type IconProps = { size?: number; color?: string; accent?: string };

const S = ({ size = 26, children }: { size?: number; children: React.ReactNode }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {children}
  </Svg>
);
const ln = (color: string, w = 1.7) => ({ stroke: color, strokeWidth: w, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' });

/* ---------- raha ---------- */

/** Kolikot: kolikkopino + €-kolikko */
export const CoinsIcon = ({ size, color = ICON_GREEN, accent = ICON_ACCENT }: IconProps) => (
  <S size={size}>
    <Ellipse cx={8.5} cy={6.4} rx={5.6} ry={2.4} {...ln(color)} />
    <Path d="M2.9 6.4v4c0 1.3 2.5 2.4 5.6 2.4M2.9 10.4v4c0 1.3 2.5 2.4 5.6 2.4M14.1 6.4v2.2" {...ln(color)} />
    <Circle cx={15.6} cy={15.4} r={5.6} {...ln(color)} />
    <Path d="M17.4 13.2a2.4 2.4 0 1 0 0 4.4M13.3 14.7h3M13.3 16.1h3" {...ln(accent, 1.4)} />
  </S>
);

/** Säästöpossu */
export const PiggyIcon = ({ size, color = ICON_GREEN, accent = ICON_ACCENT }: IconProps) => (
  <S size={size}>
    <Path d="M5.2 10.2c.6-3 3.4-4.8 6.8-4.8 1.3 0 2.5.2 3.5.7L18.6 5l-.5 3a6 6 0 0 1 1.5 2.4h1.6v3.8h-1.8a6.5 6.5 0 0 1-2 2.2V19h-2.6v-1.6h-4.4V19H7.8v-2.4A5.6 5.6 0 0 1 5.2 12z" {...ln(color)} />
    <Path d="M5.2 10.6c-1.4-.1-2.4-.9-2.4-2.2" {...ln(color)} />
    <Path d="M10 8h3.6" {...ln(accent, 1.5)} />
    <Circle cx={16.3} cy={10.3} r={0.85} fill={accent} />
  </S>
);

/** Saldoennuste: koordinaatisto ja nouseva käyrä */
export const TrendIcon = ({ size, color = ICON_GREEN, accent = ICON_ACCENT }: IconProps) => (
  <S size={size}>
    <Path d="M3.4 3.4v17.2h17.2" {...ln(color)} />
    <Path d="M6.6 16l4-4.4 3.2 2.6 5.6-6.6" {...ln(color)} />
    <Path d="M16.2 7.4h3.4v3.4" {...ln(accent, 1.6)} />
  </S>
);

/** Palkkapäivä: kalenteri, jossa € */
export const CalendarIcon = ({ size, color = ICON_GREEN, accent = ICON_ACCENT }: IconProps) => (
  <S size={size}>
    <Rect x={3.2} y={4.8} width={17.6} height={15.8} rx={1.6} {...ln(color)} />
    <Path d="M3.2 9.4h17.6M8 3v3.4M16 3v3.4" {...ln(color)} />
    <Path d="M14.1 12.6a2.5 2.5 0 1 0 0 4.4M9.8 14.2h3.2M9.8 15.6h3.2" {...ln(accent, 1.4)} />
  </S>
);

/** Varoitus: kolmio ja huutomerkki */
export const AlertIcon = ({ size, color = ICON_GREEN, accent = ICON_ACCENT }: IconProps) => (
  <S size={size}>
    <Path d="M12 3.4 21.2 19.6H2.8z" {...ln(color)} />
    <Path d="M12 9.4v5" {...ln(accent, 1.9)} />
    <Circle cx={12} cy={17.1} r={1.05} fill={accent} />
  </S>
);

/** Talousoppi / vinkki: hehkulamppu */
export const BulbIcon = ({ size, color = ICON_GREEN, accent = ICON_ACCENT }: IconProps) => (
  <S size={size}>
    <Path d="M8.6 16.2c0-1.8-2.6-3.2-2.6-6.6a6 6 0 0 1 12 0c0 3.4-2.6 4.8-2.6 6.6z" {...ln(color)} />
    <Path d="M9 18.8h6M10.2 21.2h3.6" {...ln(color)} />
    <Path d="M12 7.2v4.4M10.4 10l1.6 1.6 1.6-1.6" {...ln(accent, 1.4)} />
  </S>
);

/** Tavoite: maalitaulu ja nuoli */
export const TargetIcon = ({ size, color = ICON_GREEN, accent = ICON_ACCENT }: IconProps) => (
  <S size={size}>
    <Circle cx={11} cy={13} r={8} {...ln(color)} />
    <Circle cx={11} cy={13} r={4.2} {...ln(color)} />
    <Path d="M11 13l8.6-8.6M16.6 4.4h3v3" {...ln(accent, 1.6)} />
  </S>
);

/** Toistuva maksu: kiertävät nuolet + € */
export const RepeatIcon = ({ size, color = ICON_GREEN, accent = ICON_ACCENT }: IconProps) => (
  <S size={size}>
    <Path d="M19.4 9.4A7.8 7.8 0 0 0 5.4 7.6M4.6 14.6a7.8 7.8 0 0 0 14 1.8" {...ln(color)} />
    <Path d="M5 3.8v3.8h3.8M19 20.2v-3.8h-3.8" {...ln(color)} />
    <Path d="M13.6 10.1a2.3 2.3 0 1 0 0 3.8M9.6 11.5h3M9.6 12.8h3" {...ln(accent, 1.4)} />
  </S>
);

/** Tasapaino / kolme koria: kolme purkkia */
export const JarsIcon = ({ size, color = ICON_GREEN, accent = ICON_ACCENT }: IconProps) => (
  <S size={size}>
    <Path d="M2.8 8.6h5.2v11a1.4 1.4 0 0 1-1.4 1.4H4.2a1.4 1.4 0 0 1-1.4-1.4zM9.4 8.6h5.2v11a1.4 1.4 0 0 1-1.4 1.4h-2.4a1.4 1.4 0 0 1-1.4-1.4zM16 8.6h5.2v11a1.4 1.4 0 0 1-1.4 1.4h-2.4a1.4 1.4 0 0 1-1.4-1.4z" {...ln(color)} />
    <Path d="M3.6 6.4h3.6M10.2 6.4h3.6M16.8 6.4h3.6" {...ln(color)} />
    <Path d="M4 14.4h2.8M10.6 17h2.8M17.2 12h2.8" {...ln(accent, 1.6)} />
  </S>
);

/* ---------- kulutusluokat ---------- */

/** Ravintolat ja kahvilat: haarukka ja veitsi */
export const CutleryIcon = ({ size, color = ICON_GREEN }: IconProps) => (
  <S size={size}>
    <Path d="M7.4 3v6.4a2.4 2.4 0 0 1-4.8 0V3M5 3v18M16.8 21V3c-2.4 1-3.6 3.6-3.6 7.2v3.4h3.6" {...ln(color)} />
  </S>
);

/** Ruokakauppa: ostoskärry */
export const CartIcon = ({ size, color = ICON_GREEN }: IconProps) => (
  <S size={size}>
    <Path d="M2.6 3.6h2.6l2.4 11.6h10.2l2.2-8H6.2" {...ln(color)} />
    <Circle cx={9} cy={19.4} r={1.5} {...ln(color)} />
    <Circle cx={16.6} cy={19.4} r={1.5} {...ln(color)} />
  </S>
);

/** Liikkuminen: bussi edestä */
export const BusIcon = ({ size, color = ICON_GREEN }: IconProps) => (
  <S size={size}>
    <Rect x={4.4} y={2.8} width={15.2} height={15.4} rx={2.2} {...ln(color)} />
    <Path d="M4.4 11.2h15.2M7.4 21v-2.8M16.6 21v-2.8M8.6 6h6.8" {...ln(color)} />
    <Circle cx={8} cy={14.8} r={0.9} fill={color} />
    <Circle cx={16} cy={14.8} r={0.9} fill={color} />
  </S>
);

/** Taksi: auto sivulta */
export const CarIcon = ({ size, color = ICON_GREEN }: IconProps) => (
  <S size={size}>
    <Path d="M3 15.6v-3.4l2-4.4a1.6 1.6 0 0 1 1.5-1h9.6a1.6 1.6 0 0 1 1.4.8l2.4 4.2 1.1.5v3.3h-2.2M7.6 15.6h8.6M3 15.6h1.6" {...ln(color)} />
    <Circle cx={6.2} cy={16} r={1.9} {...ln(color)} />
    <Circle cx={17.6} cy={16} r={1.9} {...ln(color)} />
    <Path d="M5.6 11.6h13" {...ln(color)} />
  </S>
);

/** Asuminen / vuokra: talo ovella */
export const HouseIcon = ({ size, color = ICON_GREEN }: IconProps) => (
  <S size={size}>
    <Path d="M3.2 10.6 12 3.4l8.8 7.2M5.4 9v11.6h13.2V9M10 20.6v-5.8h4v5.8" {...ln(color)} />
  </S>
);

/** Asumisen laskut: salama */
export const BoltIcon = ({ size, color = ICON_GREEN }: IconProps) => (
  <S size={size}>
    <Path d="M13.4 2.8 5.2 13.4h6l-1.2 7.8 8.2-10.6h-6z" {...ln(color)} />
  </S>
);

/** Terveys: risti pyöristetyssä ruudussa */
export const HealthIcon = ({ size, color = ICON_GREEN }: IconProps) => (
  <S size={size}>
    <Rect x={3.2} y={3.2} width={17.6} height={17.6} rx={3.4} {...ln(color)} />
    <Path d="M9.8 7.2h4.4v2.6h2.6v4.4h-2.6v2.6H9.8v-2.6H7.2V9.8h2.6z" {...ln(color)} />
  </S>
);

/** Matkailu: lentokone */
export const PlaneIcon = ({ size, color = ICON_GREEN }: IconProps) => (
  <S size={size}>
    <Path d="M10.4 13.6 3 11.4l1.4-1.8 7.6.6 4.6-5.2c.9-1 2.8-1.6 3.6-.8.8.8.2 2.7-.8 3.6l-5.2 4.6.6 7.6-1.8 1.4-2.2-7.4-3.4 3 .2 2.6-1.4 1.2-1.4-3.6-3.6-1.4 1.2-1.4 2.6.2z" {...ln(color, 1.5)} />
  </S>
);

/** Viihde: lippu */
export const TicketIcon = ({ size, color = ICON_GREEN }: IconProps) => (
  <S size={size}>
    <Path d="M3 7.4V5.6h18v4a2.4 2.4 0 0 0 0 4.8v4H3v-4a2.4 2.4 0 0 0 0-4.8z" {...ln(color)} />
    <Path d="M14.6 6v1.6M14.6 10.8v2.4M14.6 16.4V18" {...ln(color)} />
  </S>
);

/** Liikunta: käsipaino */
export const DumbbellIcon = ({ size, color = ICON_GREEN }: IconProps) => (
  <S size={size}>
    <Path d="M8.4 12h7.2M2.6 10.4v3.2M21.4 10.4v3.2" {...ln(color)} />
    <Rect x={4.6} y={7.2} width={3.8} height={9.6} rx={1} {...ln(color)} />
    <Rect x={15.6} y={7.2} width={3.8} height={9.6} rx={1} {...ln(color)} />
  </S>
);

/** Suoratoisto: näyttö ja toistopainike */
export const StreamIcon = ({ size, color = ICON_GREEN, accent = ICON_ACCENT }: IconProps) => (
  <S size={size}>
    <Rect x={2.8} y={4.2} width={18.4} height={12.6} rx={1.6} {...ln(color)} />
    <Path d="M8.4 20.4h7.2" {...ln(color)} />
    <Path d="M10.4 7.8v5.4l4.4-2.7z" {...ln(accent, 1.5)} fill={accent} />
  </S>
);

/** Shoppailu: kassi */
export const ShoppingIcon = ({ size, color = ICON_GREEN }: IconProps) => (
  <S size={size}>
    <Path d="M4.6 7.6h14.8l-1.1 13.2H5.7z" {...ln(color)} />
    <Path d="M8.6 10V6.4a3.4 3.4 0 0 1 6.8 0V10" {...ln(color)} />
  </S>
);

/** Koti ja tekniikka: läppäri */
export const LaptopIcon = ({ size, color = ICON_GREEN }: IconProps) => (
  <S size={size}>
    <Rect x={4.4} y={4.6} width={15.2} height={10.6} rx={1.2} {...ln(color)} />
    <Path d="M2.4 18.6h19.2l-1.4-3.4H3.8z" {...ln(color)} />
  </S>
);

/* ---------- turvallisuus ja vahvistus (suoraan referensseistä) ---------- */

/** Lukko ja tunnusluku **** (ikonit/lukko-tunnusluku.png) */
export const LockPinIcon = ({ size, color = ICON_GREEN, accent = ICON_ACCENT }: IconProps) => (
  <S size={size}>
    <Path d="M6.4 10V7.2a5 5 0 0 1 10 0V10" {...ln(color)} />
    <Path d="M14 21H4.2a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1h14.4a1 1 0 0 1 1 1v5" {...ln(color)} />
    <Circle cx={11.4} cy={14} r={1.4} fill={color} />
    <Path d="M11.4 14.8v2.6" {...ln(color, 1.6)} />
    {[15.2, 17.6, 20, 22.4].map((x) => (
      <Path key={x} d={`M${x} 18.6v2.4M${x - 1} 19.2l2 1.2M${x + 1} 19.2l-2 1.2`} {...ln(accent, 0.9)} />
    ))}
  </S>
);

/** Puhelin + puhekupla, jossa ruksi (ikonit/puhelin-viesti-ok.png) */
export const PhoneCheckIcon = ({ size, color = ICON_GREEN, accent = ICON_ACCENT }: IconProps) => (
  <S size={size}>
    <Path d="M14 2.8H5.8a1.6 1.6 0 0 0-1.6 1.6v15.2a1.6 1.6 0 0 0 1.6 1.6h8.4a1.6 1.6 0 0 0 1.6-1.6v-2.4" {...ln(color)} />
    <Path d="M8 2.8l.6 1.4h3l.6-1.4M9.6 19h.8" {...ln(color)} />
    <Path d="M10.2 7.6h10.6v7.6h-7l-2.6 2.2v-2.2h-1z" {...ln(color)} />
    <Path d="M13 11.4l1.8 1.8 3.4-3.6" {...ln(accent, 1.9)} />
  </S>
);

/** Kättely: kaksi hihaa ja kädet (ikonit/katattely-valkoinen.png) */
export const HandshakeIcon = ({ size, color = ICON_GREEN }: IconProps) => (
  <S size={size}>
    <Path d="M1.8 9.6 5.6 5.8l4.4 4.4-3.8 3.8zM22.2 9.6l-3.8-3.8-4.4 4.4 3.8 3.8z" {...ln(color)} />
    <Path d="M7.8 12.4 11 15.6c.6.6 1.6.6 2.2 0l3-3M10 10.2l2.6-2.4 3.2 3.2M9.4 14l1.8 1.8M11.4 12.6l2.6 2.6" {...ln(color)} />
    <Path d="M4.4 8.4l.1.1M5.8 9.8l.1.1M19.6 8.4l-.1.1" {...ln(color, 1.5)} />
  </S>
);

/** Onnistui! – täytetyt kädet ylhäällä ja keltaiset säteet (ikonit/kadet-ylos-taytetty.png) */
export const HandsUpIcon = ({ size, color = '#0B7A3E' }: IconProps) => (
  <S size={size}>
    {[
      'M7.6 4.2 7 2.6',
      'M10.4 3.6l.2-1.6',
      'M13.6 3.6l-.2-1.6',
      'M16.4 4.2l.6-1.6',
    ].map((d) => (
      <Path key={d} d={d} stroke="#F0B84A" strokeWidth={1.3} strokeLinecap="round" />
    ))}
    <Path d="M3 21.6v-3.2c-1-1-1.2-2.4-1.2-3.4V9.6a.9.9 0 0 1 1.8 0V8.2a.9.9 0 0 1 1.8 0V7.6a.9.9 0 0 1 1.8 0v.8a.9.9 0 0 1 1.8 0v5.8l1.8-1.4a1.1 1.1 0 0 1 1.4 1.6l-3 3v3.4z" fill={color} />
    <Path d="M21 21.6v-3.2c1-1 1.2-2.4 1.2-3.4V9.6a.9.9 0 0 0-1.8 0V8.2a.9.9 0 0 0-1.8 0V7.6a.9.9 0 0 0-1.8 0v.8a.9.9 0 0 0-1.8 0v5.8l-1.8-1.4a1.1 1.1 0 0 0-1.4 1.6l3 3v3.4z" fill={color} />
  </S>
);
