import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { S_PATH, SLogo } from '../components/SLogo';

type P = { size?: number; color?: string; filled?: boolean };

/** S-mobiilin koti: aktiivisena täytetty talo, jossa valkoinen ovi */
export const HomeIcon = ({ size = 26, color = '#333', filled }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {filled ? (
      <>
        <Path d="M12 2.6 1.6 11.4h2.9V21.4h15V11.4h2.9z" fill={color} />
        <Rect x={10} y={15.2} width={4} height={6.2} fill="#fff" />
      </>
    ) : (
      <Path d="M12 3.6 3 11.2h2.2v9.4h13.6v-9.4H21zM10 20.6v-5.4h4v5.4" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    )}
  </Svg>
);

/** S-mobiilin lompakko (Pankki) */
export const WalletIcon = ({ size = 26, color = '#333', filled }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M4.5 6.6V5.4a1.2 1.2 0 0 1 1.2-1.2h11.6" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    <Rect x={2.8} y={6.6} width={18.4} height={13.4} rx={1.8} stroke={color} strokeWidth={1.6} fill={filled ? color : 'none'} />
    <Circle cx={17.4} cy={13.3} r={1.15} fill={filled ? '#fff' : color} />
  </Svg>
);

/** S-mobiilin Minä-hahmo */
export const PersonIcon = ({ size = 26, color = '#333', filled }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={7.6} r={3.9} stroke={color} strokeWidth={1.6} fill={filled ? color : 'none'} />
    <Path d="M4.6 21.2c0-4.3 3.3-7.1 7.4-7.1s7.4 2.8 7.4 7.1z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" fill={filled ? color : 'none'} />
  </Svg>
);

/** S-tunnus alapalkkiin – sama tarkka muoto kuin SLogo, ohuemmalla viivalla */
export const SIcon = ({ size = 26, color = '#333' }: P) => <SLogo variant="plain" size={size} color={color} weight={24} />;

/** S-mobiilin viestikuvake: kulmikas puhekupla, häntä vasemmassa alakulmassa, ilmoituspiste oikeassa yläkulmassa */
export const ChatIcon = ({ size = 26, color = '#333', dot }: P & { dot?: boolean }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d={dot ? 'M20 10.8V17.6a.9.9 0 0 1-.9.9H8.2L4 21.6V5.9a.9.9 0 0 1 .9-.9h9.4' : 'M20 5.9v11.7a.9.9 0 0 1-.9.9H8.2L4 21.6V5.9a.9.9 0 0 1 .9-.9h14.2a.9.9 0 0 1 .9.9z'}
      stroke={color}
      strokeWidth={1.6}
      strokeLinejoin="round"
    />
    {dot && <Circle cx={19.6} cy={5.2} r={2.6} fill={color} />}
  </Svg>
);

/** lukko (kotinäkymän vasen yläkulma) */
export const LockIcon = ({ size = 24, color = '#333' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={5.2} y={10.4} width={13.6} height={10.6} rx={1.4} stroke={color} strokeWidth={1.6} />
    <Path d="M8.2 10.4V7.3a3.8 3.8 0 0 1 7.6 0v3.1" stroke={color} strokeWidth={1.6} />
  </Svg>
);

/** ohut nuoli oikealle (listarivit, linkit) */
export const Chevron = ({ size = 20, color = '#555' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M9.5 5.5 16 12l-6.5 6.5" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/* ---------- S-mobiilin ääriviivakuvakkeet (vihreät, 24 × 24, viiva 1.6) ---------- */

const I = ({ size = 26, children }: { size?: number; children: React.ReactNode }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {children}
  </Svg>
);
const st = (color: string, w = 1.6) => ({ stroke: color, strokeWidth: w, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

/** Lähellä: sijaintineula */
export const PinIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Path d="M12 21.2s-6.6-6.3-6.6-11.4a6.6 6.6 0 0 1 13.2 0c0 5.1-6.6 11.4-6.6 11.4z" {...st(color)} />
    <Circle cx={12} cy={9.8} r={2.4} {...st(color)} />
  </I>
);

/** Tallennetut: kirjanmerkki */
export const BookmarkIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Path d="M6.6 3.4h10.8v17.4L12 16.9l-5.4 3.9z" {...st(color)} />
  </I>
);

/** Kuitit: kuitti viivoineen */
export const ReceiptIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Rect x={5.2} y={2.8} width={13.6} height={18.4} rx={1.2} {...st(color)} />
    <Path d="M8.4 7.6h7.2M8.4 11.2h7.2M8.4 14.8h7.2" {...st(color)} />
  </I>
);

/** S-tunnus pienenä kuvakkeen sisällä (sama tarkka muoto kuin SLogo), keskitettynä (cx, cy), korkeus h */
const miniS = (cx: number, cy: number, h: number, color: string, w = 1.3) => {
  const sc = h / 301; // S-tunnuksen rajauksen korkeus
  const tx = cx - (70.5 + 201 / 2) * sc;
  const ty = cy - (33 + 301 / 2) * sc;
  return <Path d={S_PATH} transform={`translate(${tx} ${ty}) scale(${sc})`} stroke={color} strokeWidth={w / sc} fill="none" />;
};

/** Pankki › Tilit: tilikirja, jossa S (kirja = suorakaide + selkä alhaalla) */
export const PassbookSIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Path d="M6.2 3h12.2v16H6.2z" {...st(color)} />
    <Path d="M6.2 3 4.2 4.6V21h12.2l2-2" {...st(color)} />
    {miniS(12.3, 11, 10.4, color, 1.25)}
  </I>
);

/** Pankki › Maksut ja e-laskut: lasku, jossa €-merkki ja rivit */
export const InvoiceEuroIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Rect x={5} y={2.8} width={14} height={18.4} rx={0.8} {...st(color)} />
    {euro(9.6, 7.8, 1.9, color, 1.3)}
    <Path d="M8 13.4h8M8 16.4h8" {...st(color)} />
  </I>
);

/** Pankki › Kortit, S-Etukortti S-mobiilissa: pystykortti, jossa S */
export const CardSIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Rect x={6} y={2.8} width={12} height={18.4} rx={1.2} {...st(color)} />
    {miniS(12, 12, 10.6, color, 1.25)}
  </I>
);

/** S-Etukortit (tilaa): vaakakortti + plus-merkki */
export const CardPlusIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Path d="M14.2 18.4H3.8a1.2 1.2 0 0 1-1.2-1.2V6.6a1.2 1.2 0 0 1 1.2-1.2h16.4a1.2 1.2 0 0 1 1.2 1.2v6" {...st(color)} />
    <Path d="M2.6 9.4h18.8" {...st(color)} />
    <Circle cx={18.4} cy={17.6} r={3.4} {...st(color)} />
    <Path d="M18.4 16v3.2M16.8 17.6H20" {...st(color, 1.3)} />
  </I>
);

/** Sähköiset kuitit: kuitti, jonka alareuna on sahalaita */
export const ReceiptZigIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Path d="M5.6 2.8h12.8v18.4l-2.1-1.4-2.1 1.4-2.2-1.4-2.1 1.4-2.1-1.4-2.2 1.4z" {...st(color)} />
    <Path d="M8.6 7.4h6.8M8.6 10.6h6.8M8.6 13.8h6.8" {...st(color)} />
  </I>
);

/** Asiakastiedot: asiakirja + henkilömerkki oikeassa alakulmassa */
export const CustomerDocIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Path d="M12.4 21H4.6V3h12.6v8.4" {...st(color)} />
    <Path d="M7.6 7.4h6.6M7.6 10.4h6.6M7.6 13.4h3.4" {...st(color)} />
    <Circle cx={17.4} cy={14.8} r={1.9} {...st(color)} />
    <Path d="M13.8 21c.3-1.9 1.8-3.1 3.6-3.1S20.7 19.1 21 21z" {...st(color)} />
  </I>
);

/** Lapsen pankkipalvelut: kaksi aikuista ja lapsi */
export const GroupIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Circle cx={6.6} cy={7.2} r={2.4} {...st(color)} />
    <Circle cx={17.4} cy={7.2} r={2.4} {...st(color)} />
    <Circle cx={12} cy={11.6} r={2} {...st(color)} />
    <Path d="M2.4 16.4c0-2.8 1.8-4.6 4.2-4.6 1.2 0 2.2.4 3 1.2M21.6 16.4c0-2.8-1.8-4.6-4.2-4.6-1.2 0-2.2.4-3 1.2M8.4 20.4c0-2.5 1.6-4.2 3.6-4.2s3.6 1.7 3.6 4.2z" {...st(color)} />
  </I>
);

/** Lue QR-koodi: QR skannauskehyksen sisällä */
export const QrScanIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Path d="M3 8V4.2A1.2 1.2 0 0 1 4.2 3H8M16 3h3.8A1.2 1.2 0 0 1 21 4.2V8M21 16v3.8a1.2 1.2 0 0 1-1.2 1.2H16M8 21H4.2A1.2 1.2 0 0 1 3 19.8V16" {...st(color)} />
    <Rect x={7} y={7} width={4} height={4} {...st(color, 1.3)} />
    <Rect x={13} y={7} width={4} height={4} {...st(color, 1.3)} />
    <Rect x={7} y={13} width={4} height={4} {...st(color, 1.3)} />
    <Path d="M13 13h1.8v1.8M17 13v.1M13 17h.1M15.6 17H17v-1.6" {...st(color, 1.3)} />
  </I>
);

/** Hyväksy tapahtuma: kilpi, jossa avaimenreikä */
export const ShieldKeyIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Path d="M12 2.8 4.6 5.6v5.6c0 4.6 3.1 8.4 7.4 10 4.3-1.6 7.4-5.4 7.4-10V5.6z" {...st(color)} />
    <Circle cx={12} cy={10} r={1.9} {...st(color)} />
    <Path d="M12 11.9v4.3" {...st(color)} />
  </I>
);

/** Viivakoodin skannaus (S-Etukortin valkoinen pallo) */
export const ScanBarcodeIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Path d="M3.4 8V3.4H8M16 3.4h4.6V8M20.6 16v4.6H16M8 20.6H3.4V16" {...st(color, 1.8)} />
    <Path d="M8 8v8M10.6 8v8M13.4 8v8M16 8v8" {...st(color, 1.6)} />
  </I>
);

/** Bonus ja ostot: kassi, jossa sydän */
export const BagHeartIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Path d="M4.6 7.4h14.8V21H4.6z" {...st(color)} />
    <Path d="M8.8 7.4V5.2a3.2 3.2 0 0 1 6.4 0v2.2" {...st(color)} />
    <Path d="M12 17.4s-3.2-2-3.2-4a1.6 1.6 0 0 1 3.2-.6 1.6 1.6 0 0 1 3.2.6c0 2-3.2 4-3.2 4z" fill={color} />
  </I>
);

/** Vahvista sähköpostisi: kirje + ruksi */
export const MailCheckIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Path d="M15 18.6H3.4a.8.8 0 0 1-.8-.8V6.2a.8.8 0 0 1 .8-.8h14.4a.8.8 0 0 1 .8.8v4.6" {...st(color)} />
    <Path d="M3 6 10.6 12 18.2 6M3 18l5.6-5M18.6 13.4l-1.4-1.2" {...st(color)} />
    <Circle cx={18.4} cy={17} r={3.6} fill={color} />
    <Path d="M16.8 17l1.1 1.1 2.1-2.2" stroke="#fff" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
  </I>
);

/** Sulje (×) */
export const CloseIcon = ({ size = 22, color = '#5E5E5E' }: P) => (
  <I size={size}>
    <Path d="M6 6l12 12M18 6 6 18" {...st(color, 1.6)} />
  </I>
);

/** Tilitapahtumat: lista */
export const ListDocIcon = ({ size, color = '#5E5E5E' }: P) => (
  <I size={size}>
    <Rect x={4} y={3} width={16} height={18} rx={1.2} {...st(color)} />
    <Path d="M7.4 8h.1M10.4 8h6.2M7.4 12h.1M10.4 12h6.2M7.4 16h.1M10.4 16h6.2" {...st(color)} />
  </I>
);

/** Uusi maksu: vihreä pallo, jossa kaareva nuoli */
export const PayArrowIcon = ({ size = 26, color = '#22A34A' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx={12} cy={12} r={12} fill={color} />
    <Path d="M7.4 15.6c.6-3.6 2.8-5.6 7-5.6M12.6 7.6 15 10l-2.4 2.4" stroke="#fff" strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/** Tekstikentän tyhjennys: harmaa pallo, jossa × */
export const ClearIcon = ({ size = 18 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx={12} cy={12} r={10} fill="#8E8E8E" />
    <Path d="M8.6 8.6l6.8 6.8M15.4 8.6l-6.8 6.8" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

/** Karusellin nuolipallo (ääriviiva) */
export const CircleArrow = ({ size = 40, color = '#126645', dir = 'right' }: P & { dir?: 'left' | 'right' }) => (
  <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
    <Circle cx={20} cy={20} r={18.6} stroke={color} strokeWidth={1.6} />
    <Path d={dir === 'right' ? 'M17.4 13.4 24 20l-6.6 6.6' : 'M22.6 13.4 16 20l6.6 6.6'} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/** Bonus ja ostot: ostoskassi */
export const BagIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Path d="M4.6 7.6h14.8l-1.1 13.2H5.7z" {...st(color)} />
    <Path d="M8.6 10V6.4a3.4 3.4 0 0 1 6.8 0V10" {...st(color)} />
  </I>
);

/** Uudet pankkiviestit: kirjekuori */
export const MailIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Rect x={2.6} y={5.2} width={18.8} height={13.6} rx={0.8} {...st(color)} />
    <Path d="M3 5.8 12 13l9-7.2M3 18.3l6.6-6.1M21 18.3l-6.6-6.1" {...st(color)} />
  </I>
);

/** €-merkki pienenä (käytetään kuvakkeiden sisällä) */
const euro = (cx: number, cy: number, r: number, color: string, w = 1.4) => (
  <Path
    d={`M${cx + r * 0.75} ${cy - r * 0.8}a${r} ${r} 0 1 0 0 ${r * 1.6}M${cx - r * 1.25} ${cy - r * 0.25}h${r * 1.5}M${cx - r * 1.25} ${cy + r * 0.3}h${r * 1.5}`}
    {...st(color, w)}
  />
);

/** Säästäjä: pokaali, jossa €-merkki */
export const TrophyIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Path d="M6.8 3.6h10.4v5.6a5.2 5.2 0 0 1-10.4 0z" {...st(color)} />
    <Path d="M6.8 5.4H3.6v1.4a3.4 3.4 0 0 0 3.6 3.4M17.2 5.4h3.2v1.4a3.4 3.4 0 0 1-3.6 3.4M12 14.4v3.4M8 20.6h8M9.4 17.8h5.2v2.8H9.4z" {...st(color)} />
    {euro(12.2, 8.6, 2.2, color, 1.3)}
  </I>
);

/** Sijoitukset: salkku, jossa nouseva käyrä */
export const BriefcaseIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Rect x={2.6} y={6.8} width={18.8} height={13.4} rx={1.2} {...st(color)} />
    <Path d="M9 6.8V4.4h6v2.4" {...st(color)} />
    <Path d="M6 16.4l3.6-3.6 3 2.4 5.4-5.2M15.2 10h2.8v2.8" {...st(color)} />
  </I>
);

/** Lainat: asiakirja, €-merkki ja kynä */
export const LoanIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Path d="M15.6 8.2V3.4H4.4v17.2h11.2v-2" {...st(color)} />
    {euro(10.4, 10.6, 2.4, color, 1.4)}
    <Path d="M7 16.4h4.6" {...st(color)} />
    <Path d="M20.8 9.6 14 16.4l-.9 2.7 2.7-.9 6.8-6.8z" {...st(color)} />
  </I>
);

/** Palkka ja eläke: kirjekuori, josta nousee paperi */
export const SalaryIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Path d="M6 11.6V3.4h12v8.2M9 6.6h6M9 9.2h6" {...st(color)} />
    <Path d="M2.8 9.6v11h18.4v-11M2.8 9.8 12 16l9.2-6.2M2.8 20.4l6.8-6M21.2 20.4l-6.8-6" {...st(color)} />
  </I>
);

/** Tunnistaminen: avain */
export const KeyIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Circle cx={6.6} cy={12} r={3.4} {...st(color)} />
    <Path d="M10 12h11M17.6 12v3M20.6 12v2.4" {...st(color)} />
  </I>
);

/** Tarkista käyttäjätunnus: henkilökortti */
export const IdCardIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Rect x={2.6} y={5} width={18.8} height={14} rx={1.2} {...st(color)} />
    <Circle cx={8.2} cy={10.4} r={1.9} {...st(color)} />
    <Path d="M5.2 15.8c.5-1.7 1.6-2.6 3-2.6s2.5.9 3 2.6M14 10h4.6M14 13.4h4.6" {...st(color)} />
  </I>
);

/** Asiakastiedot: lomake, jossa rivit ja ruksi */
export const CustomerInfoIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Rect x={4.2} y={3} width={15.6} height={18} rx={1.2} {...st(color)} />
    <Path d="M7.4 7.8l1 1 1.8-2M12 8h4.6M7.4 12.8l1 1 1.8-2M12 13h4.6M7.6 17.4h9" {...st(color)} />
  </I>
);

/** Lapsen pankkipalvelut: aikuinen ja lapsi */
export const FamilyIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Circle cx={8.4} cy={7.6} r={3} {...st(color)} />
    <Path d="M2.8 19.4c0-3.6 2.4-6 5.6-6s5.6 2.4 5.6 6" {...st(color)} />
    <Circle cx={17} cy={10.4} r={2.3} {...st(color)} />
    <Path d="M14.6 14.6a4 4 0 0 1 2.4-.8c2.6 0 4.2 2 4.2 5" {...st(color)} />
  </I>
);

/** S-Etukortti S-mobiilissa: puhelin, jossa kortti */
export const PhoneCardIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Rect x={6} y={2.6} width={12} height={18.8} rx={1.6} {...st(color)} />
    <Path d="M9 7h6v5H9zM9 15h6M11 18.6h2" {...st(color)} />
  </I>
);

/** S-Etukortti: maksukortti */
export const CardIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Rect x={2.6} y={5.4} width={18.8} height={13.2} rx={1.2} {...st(color)} />
    <Path d="M2.6 9.4h18.8M5.8 15h4" {...st(color)} />
  </I>
);

/** Sovellusversio: puhelin */
export const PhoneIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Rect x={6} y={2.6} width={12} height={18.8} rx={1.6} {...st(color)} />
    <Path d="M10.6 18.4h2.8" {...st(color)} />
  </I>
);

/** Ilmoitukset: megafoni */
export const MegaphoneIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Path d="M3.4 9.6h3.4l10-5.2v15.2l-10-5.2H3.4z" {...st(color)} />
    <Path d="M6.8 14.4l1.6 5.4h2.6l-1.2-4.4M19.6 9.4a3.4 3.4 0 0 1 0 5.2" {...st(color)} />
  </I>
);

/** Lue QR-koodi */
export const QrIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Rect x={3.2} y={3.2} width={6.6} height={6.6} rx={0.6} {...st(color)} />
    <Rect x={14.2} y={3.2} width={6.6} height={6.6} rx={0.6} {...st(color)} />
    <Rect x={3.2} y={14.2} width={6.6} height={6.6} rx={0.6} {...st(color)} />
    <Path d="M14.2 14.2h2.6v2.6M20.8 14.2v.1M14.2 20.8h.1M17.4 20.8h3.4v-3.4" {...st(color)} />
    <Rect x={5.6} y={5.6} width={1.8} height={1.8} fill={color} />
    <Rect x={16.6} y={5.6} width={1.8} height={1.8} fill={color} />
    <Rect x={5.6} y={16.6} width={1.8} height={1.8} fill={color} />
  </I>
);

/** Hyväksy tapahtuma: kilpi ja ruksi */
export const ShieldCheckIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Path d="M12 2.8 4.6 5.6v5.6c0 4.6 3.1 8.4 7.4 10 4.3-1.6 7.4-5.4 7.4-10V5.6z" {...st(color)} />
    <Path d="M8.6 12.2l2.4 2.4 4.6-4.8" {...st(color)} />
  </I>
);

/** Omat tiedot: henkilö ja tietorivit */
export const PersonLinesIcon = ({ size, color = '#14874A' }: P) => (
  <I size={size}>
    <Circle cx={8} cy={8.2} r={3.2} {...st(color)} />
    <Path d="M2.6 19.6c0-3.8 2.4-6.2 5.4-6.2s5.4 2.4 5.4 6.2zM15.4 8h6M15.4 12h6M17.4 16h4" {...st(color)} />
  </I>
);

export const BackIcon = ({ size = 24, color = '#333' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M15 4l-8 8 8 8" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const SendIcon = ({ size = 22, color = '#fff' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M4 12l16-8-6 16-2-6z" stroke={color} strokeWidth={2} strokeLinejoin="round" fill={color} />
  </Svg>
);

export const PlusIcon = ({ size = 30, color = '#fff' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Line x1={12} y1={4} x2={12} y2={20} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    <Line x1={4} y1={12} x2={20} y2={12} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
  </Svg>
);

export const BarcodeIcon = ({ size = 26, color = '#333' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {[4, 7, 9, 12, 15, 17, 20].map((x, i) => (
      <Line key={x} x1={x} y1={6} x2={x} y2={18} stroke={color} strokeWidth={i % 2 ? 1.2 : 2} />
    ))}
  </Svg>
);

export const ArrowIcon = ({ size = 22, color = '#fff' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M6 16c1-5 4-8 10-8M12 4l4 4-4 4" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const ListIcon = ({ size = 28, color = '#555' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={4} y={3} width={16} height={18} rx={1.5} stroke={color} strokeWidth={1.6} />
    <Path d="M8 8h8M8 12h8M8 16h8" stroke={color} strokeWidth={1.6} />
  </Svg>
);
