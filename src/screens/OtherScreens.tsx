import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import {
  BagHeartIcon,
  BookmarkIcon,
  BriefcaseIcon,
  CardPlusIcon,
  CardSIcon,
  ChatIcon,
  CloseIcon,
  Chevron,
  CircleArrow,
  CustomerDocIcon,
  GroupIcon,
  IdCardIcon,
  InvoiceEuroIcon,
  KeyIcon,
  LoanIcon,
  LockIcon,
  MailCheckIcon,
  MegaphoneIcon,
  PayArrowIcon,
  PersonIcon,
  PassbookSIcon,
  PhoneIcon,
  PinIcon,
  QrScanIcon,
  ReceiptIcon,
  ReceiptZigIcon,
  SalaryIcon,
  ScanBarcodeIcon,
  ShieldKeyIcon,
  TrophyIcon,
} from '../icons';
import { PerTieeriHead } from '../components/PerTieeri';
import { useK } from '../components/scale';
import { SCard, SHeader, SHeading, SM, SRow } from '../components/smobile';
import { S_GREEN, S_PATH, SLogo } from '../components/SLogo';
import { anomalies, BALANCE_NOW, CUSTOMER, eur, fmtDay, txs } from '../finance/analytics';
import { useStore } from '../state/store';
import { customerLetter } from '../data/customerLetter';
import { C } from '../theme';

const bal = () => eur(BALANCE_NOW);

/* =========================== KOTI =========================== */

/** S-mobiilin bonusvihreä (mitattu kuvakaappauksesta) */
const BG = '#007842';
/** S-mobiilin tekstivihreä (otsikot, summat, linkit) */
const TG = C.greenText;

/**
 * Teksti, jonka isojen kirjainten keskikohta asetetaan kohtaan `y` (referenssipikseleinä).
 * Kaikki mitat ovat S-mobiilin kuvakaappauksesta (leveys 591 px) ja kerrotaan k:lla.
 */
function At({ k, y, size, style, children, left, right }: { k: number; y: number; size: number; style?: any; children: React.ReactNode; left?: number; right?: number }) {
  const lh = size * k * 1.2;
  const pos = left != null ? { left: left * k } : right != null ? { right: right * k } : { left: 0, right: 0, textAlign: 'center' as const };
  return (
    <Text style={[{ position: 'absolute', top: y * k - lh / 2, fontSize: size * k, lineHeight: lh }, pos, style]} numberOfLines={1}>
      {children}
    </Text>
  );
}

/** Bonusnäkymä täsmälleen S-mobiilin mittasuhteilla (referenssikuvan y-koordinaatit − tilapalkki 50 px) */
function BonusHero({ k }: { k: number }) {
  const W = 591;
  // talo: x 141–449, harja y 352, räystäs y 390, pohja y 536
  const house = 'M141 391 L295 352 L449 391 L449 531 Q449 536 444 536 L146 536 Q141 536 141 531 Z';
  // Per Tieerin talouspelistä kertynyt S-Bonus (tallentuu asiakkaan muistiin)
  const { quiz } = useStore();
  const earned = Object.entries(quiz).filter(([key]) => key.startsWith('bonus:')).reduce((sum, [, v]) => sum + (Number(v) || 0), 0);
  const earnedText = `${earned.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  return (
    <View style={{ height: 595 * k, backgroundColor: '#fff' }}>
      {/* yläpalkki: lukko · sivupisteet · viestit */}
      <View style={[hh.abs, { left: (52 - 15) * k, top: (40 - 15) * k }]}>
        <LockIcon size={30 * k} color="#2B2F2D" />
      </View>
      <View style={[hh.abs, hh.dots, { top: (40 - 6) * k, left: 0, right: 0, gap: 12 * k }]}>
        <View style={{ width: 12 * k, height: 12 * k, borderRadius: 6 * k, backgroundColor: '#7A7F7C' }} />
        <View style={{ width: 12 * k, height: 12 * k, borderRadius: 6 * k, backgroundColor: '#CDD1CF' }} />
      </View>
      <View style={[hh.abs, { left: (538 - 15) * k, top: (40 - 15) * k }]}>
        <ChatIcon size={30 * k} color="#2B2F2D" dot />
      </View>

      <At k={k} y={217} size={31} style={{ color: TG, fontWeight: '700', letterSpacing: -0.2 }}>
        {earned > 0 ? 'S-Bonusta kertynyt' : 'Bonustietoja ei ole saatavilla'}
      </At>
      <View style={[hh.abs, hh.row, { left: 0, right: 0, top: (246.5 - 11) * k, height: 22 * k }]}>
        <Text style={{ color: TG, fontSize: 19.5 * k, fontWeight: '500' }}>{earned > 0 ? 'Talouspelin pisteistä 0,20 € / piste' : 'Ruokakaupan ketju ei käy ilmi tapahtumista '}</Text>
        {earned > 0 ? null : <InfoDot size={11 * k} />}
      </View>

      {/* viivat ja talo */}
      <Svg width={W * k} height={595 * k} viewBox={`0 0 ${W} 595`} style={StyleSheet.absoluteFill}>
        <Line x1={46} y1={302.5} x2={545} y2={302.5} stroke={TG} strokeWidth={1.6} strokeDasharray="9 7" />
        <Line x1={48} y1={422.5} x2={141} y2={422.5} stroke={TG} strokeWidth={2} />
        <Line x1={449} y1={422.5} x2={545} y2={422.5} stroke={TG} strokeWidth={2} />
        <Path d={house} fill={BG} />
      </Svg>

      <At k={k} y={288.5} size={22} left={48} style={{ color: TG, fontWeight: '500' }}>
        —
      </At>
      <At k={k} y={288.5} size={22} right={48} style={{ color: TG, fontWeight: '500' }}>
        —
      </At>
      <At k={k} y={407} size={22} left={48} style={{ color: TG, fontWeight: '800' }}>
        —
      </At>
      <At k={k} y={407} size={22} right={48} style={{ color: TG, fontWeight: '800' }}>
        —
      </At>

      <At k={k} y={421.5} size={27.5} style={{ color: '#fff', fontWeight: '600' }}>
        Bonus
      </At>
      <At k={k} y={470} size={earned > 0 ? 60 : 71} style={{ color: '#fff', fontWeight: '700', letterSpacing: -1 * k }}>
        {earned > 0 ? earnedText : '—'}
      </At>

      <View style={[hh.abs, hh.row, { left: 0, right: 0, top: (565.5 - 16) * k, height: 32 * k }]}>
        <Text style={{ color: TG, fontSize: 22 * k, fontWeight: '700' }}>{earned > 0 ? 'Per Tieerin talouspelistä' : 'Bonusta ei voida laskea näistä tiedoista'}</Text>
        <View style={{ marginLeft: 2 * k }}>
          <Chevron size={26 * k} color={TG} />
        </View>
      </View>
    </View>
  );
}

const InfoDot = ({ size }: { size: number }) => (
  <Svg width={size} height={size} viewBox="0 0 12 12">
    <Circle cx={6} cy={6} r={6} fill={TG} />
    <Circle cx={6} cy={3.4} r={0.95} fill="#fff" />
    <Path d="M6 5.4v3.6" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" />
  </Svg>
);

const EnvelopeIcon = ({ size, color }: { size: number; color: string }) => (
  <Svg width={size} height={size * 0.72} viewBox="0 0 28 20" fill="none">
    <Rect x={1} y={1} width={26} height={18} rx={1} stroke={color} strokeWidth={1.8} />
    <Path d="M1.5 1.8 14 11.5 26.5 1.8M1.5 18.4l9.2-8.6M26.5 18.4l-9.2-8.6" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
  </Svg>
);

const hh = StyleSheet.create({
  abs: { position: 'absolute' },
  dots: { flexDirection: 'row', justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});

export function HomeScreen({ openAgent }: { openAgent: (q?: string, display?: string) => void }) {
  const { answers } = useStore();
  const [hidden, setHidden] = useState(false);
  const k = useK();
  // Per Tieerin OIKEAT havainnot tästä asiakkaasta: määrä ja otsikot tulevat suoraan datasta
  const found = anomalies(answers);
  const n = found.length;
  const askAboutFindings = () => {
    const list = found.map((a, i) => `${i + 1}) ${a.title}: ${a.detail}`).join('\n');
    openAgent(
      `Kerro ne ${n} asiaa, jotka huomasit taloudestani. Käsittele jokainen omana numeroituna kohtanaan: mitä huomasit, mitä se tarkoittaa minulle ja mitä voisin tehdä. Tarkista luvut työkaluilla.\n\nSovelluksen havainnot:\n${list}`,
      `Kerro ne ${n} asiaa, jotka huomasit taloudestani`,
    );
  };
  const lastGrocery = [...txs()].reverse().find((t) => t.c === 'Groceries')!;
  const card = { marginHorizontal: 31 * k, borderRadius: 16 * k, backgroundColor: '#fff', overflow: 'hidden' as const };
  const body = { fontSize: 25 * k, color: C.text };
  const divider = { height: 1.5 * k, backgroundColor: '#E7E7E7' };
  return (
    <ScrollView style={{ backgroundColor: C.mint }} contentContainerStyle={{ paddingBottom: 30 }}>
      <BonusHero k={k} />

      {/* Uudet pankkiviestit: kortti y 672–755 */}
      <View style={[card, { marginTop: (672 - 645) * k, height: 84 * k, flexDirection: 'row', alignItems: 'center', paddingLeft: 28 * k, paddingRight: 25 * k }]}>
        <EnvelopeIcon size={28 * k} color="#22A34A" />
        <Text style={[body, { flex: 1, marginLeft: 20 * k }]}>Uudet pankkiviestit</Text>
        <View style={{ width: 26 * k, height: 26 * k, borderRadius: 13 * k, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 * k }}>1</Text>
        </View>
      </View>

      {/* Tilit ja kortit: otsikko y 811, kortti alkaa y 853 */}
      <Text style={{ marginLeft: 31 * k, marginTop: (790 - 756) * k, height: 42 * k, lineHeight: 42 * k, fontSize: 30 * k, fontWeight: '700', color: TG }}>Tilit ja kortit</Text>
      <View style={[card, { marginTop: (853 - 832) * k }]}>
        <View style={{ height: 99 * k, paddingLeft: 25 * k, justifyContent: 'center' }}>
          <Text style={[body, { lineHeight: 32 * k }]}>S-Tili</Text>
          <Text style={{ fontSize: 30 * k, lineHeight: 36 * k, fontWeight: '700', color: TG }}>{hidden ? '•••••' : bal()}</Text>
        </View>
        <View style={divider} />
        <View style={{ height: 101 * k, paddingLeft: 25 * k, justifyContent: 'center' }}>
          <Text style={[body, { lineHeight: 32 * k }]}>S-Etukortti Visa Debit</Text>
          <Text style={{ fontSize: 18 * k, lineHeight: 24 * k, color: '#5E6360' }}>Debit **** {CUSTOMER.id.slice(-4)}</Text>
        </View>
        <View style={divider} />
        <Pressable onPress={() => setHidden(!hidden)} style={{ height: 80 * k, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: TG, fontSize: 27.5 * k }}>{hidden ? 'Näytä tiedot' : 'Piilota tiedot'}</Text>
        </Pressable>
      </View>

      {/* Per Tieeri -nosto (S-mobiilin korttityyliin: valkoinen kortti, vihreä pyöreä hahmo) */}
      {n > 0 && <SCard onPress={askAboutFindings} style={{ marginTop: 20 * k, flexDirection: 'row', alignItems: 'center', padding: 22 * k }}>
        <PerTieeriHead size={64 * k} round />
        <View style={{ flex: 1, marginLeft: 20 * k }}>
          <Text style={{ fontSize: 23 * k, fontWeight: '700', color: C.greenText }}>Per Tieeri huomasi {n} {n === 1 ? 'asian' : 'asiaa'}</Text>
          <Text numberOfLines={2} style={{ fontSize: 18 * k, lineHeight: 24 * k, color: C.sub, marginTop: 2 * k }}>{found.slice(0, 2).map((a) => a.title).join(' · ')}</Text>
        </View>
        <Chevron size={26 * k} color="#1E1E1E" />
      </SCard>}

      <SHeading link="Avaa">Edut ja vinkit</SHeading>
      {[
        { t: 'Lähellä', i: <PinIcon size={30 * k} color={C.icon} /> },
        { t: 'Tallennetut', i: <BookmarkIcon size={30 * k} color={C.icon} /> },
      ].map((x, idx) => (
        <SCard key={x.t} onPress={() => {}} style={{ height: 102 * k, alignItems: 'center', justifyContent: 'center', marginTop: idx ? 18 * k : 0 }}>
          {x.i}
          <Text style={{ fontSize: 22 * k, color: C.text, marginTop: 6 * k }}>{x.t}</Text>
        </SCard>
      ))}

      <SHeading link="Avaa">Kuitit</SHeading>
      <SCard style={{ height: 104 * k, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 26 * k }}>
        <ReceiptIcon size={30 * k} color={C.icon} />
        <View style={{ flex: 1, marginLeft: 22 * k }}>
          <Text style={{ fontSize: 23 * k, color: C.text }}>{storeName(lastGrocery.m)}</Text>
          <Text style={{ fontSize: 19 * k, color: C.text, marginTop: 2 * k }}>
            {lastGrocery.t.slice(0, 5)} {fmtDay(lastGrocery.d)}
          </Text>
        </View>
        <Text style={{ fontSize: 23 * k, color: C.text }}>{eur(-lastGrocery.a)}</Text>
      </SCard>

      <ArticleCarousel k={k} />
      <FavouritePlaces k={k} />

      <SHeading link="Näytä kaikki">Mistä saat Bonusta?</SHeading>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 20 * k, rowGap: 22 * k }}>
        {BONUS_PLACES.map((b) => (
          <View key={b.name} style={{ width: '25%', alignItems: 'center' }}>
            <StoreLogo b={b} size={86 * k} />
            <Text style={{ fontSize: 21 * k, lineHeight: 26 * k, color: C.text, textAlign: 'center', marginTop: 8 * k, paddingHorizontal: 4 * k }}>{b.name}</Text>
          </View>
        ))}
      </View>
      <View style={{ height: 40 * k }} />
    </ScrollView>
  );
}

/* ---------- Kodin alaosa: artikkelit, suosikkitoimipaikat, bonuspaikat ---------- */

const ARTICLES = [
  { t: 'Tiesitkö? Nämä yllättävät oireet voivat kertoa D-vitamiinin puutteesta', s: 'Otatko joka päivä D-vitamiinia? Se on erittäin tärkeää pimeänä vuodenaikana.' },
  { t: 'Näin teet viikon ruokaostokset fiksusti', s: 'Ostoslista ja kauden kasvikset säästävät helposti kymppejä kuussa.' },
  { t: 'Bonus kertyy myös hotelliyöistä', s: 'Sokos Hotelsin yöpymiset kerryttävät Bonusta samalla tavalla kuin ruokaostokset.' },
  { t: 'Puskuri ensin, sitten säästötili', s: 'Per Tieeri auttaa laskemaan, paljonko sinun kannattaa pitää sivussa.' },
  { t: 'Joulun budjetti haltuun ajoissa', s: 'Pienet erät syksyn aikana tasoittavat joulukuun menoja.' },
  { t: 'Kuitit talteen S-mobiiliin', s: 'Sähköiset kuitit löydät aina Kuitit-osiosta.' },
];

function ArticleCarousel({ k }: { k: number }) {
  const [i, setI] = useState(0);
  const a = ARTICLES[i];
  const go = (d: number) => setI((v) => (v + d + ARTICLES.length) % ARTICLES.length);
  return (
    <View style={{ marginTop: 44 * k }}>
      <SCard>
        <ArticleImage k={k} variant={i % 3} />
        <View style={{ paddingHorizontal: 22 * k, paddingTop: 16 * k, paddingBottom: 18 * k }}>
          <Text numberOfLines={1} style={{ fontSize: 21 * k, fontWeight: '700', color: C.text }}>
            {a.t}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 21 * k, color: C.text, marginTop: 4 * k }}>
            {a.s}
          </Text>
        </View>
      </SCard>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 18 * k, marginTop: 14 * k }}>
        <Pressable onPress={() => go(-1)} hitSlop={8} accessibilityLabel="Edellinen">
          <CircleArrow size={68 * k} dir="left" color={C.greenText} />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8 * k }}>
          {ARTICLES.map((_, j) => (
            <View key={j} style={{ width: 32 * k, height: 5 * k, borderRadius: 3 * k, backgroundColor: j === i ? '#2B2B2B' : '#D3D8D5' }} />
          ))}
        </View>
        <Pressable onPress={() => go(1)} hitSlop={8} accessibilityLabel="Seuraava">
          <CircleArrow size={68 * k} dir="right" color={C.greenText} />
        </Pressable>
      </View>
    </View>
  );
}

/** Artikkelikuvan sijainen: vaalea "marmoripöytä", kulho, kurkkuviipaleet, smoothie-lasi ja purkki */
function ArticleImage({ k, variant }: { k: number; variant: number }) {
  const bg = ['#E9EDEA', '#EFE9E1', '#E6ECF0'][variant];
  return (
    <Svg width="100%" height={200 * k} viewBox="0 0 528 200" preserveAspectRatio="xMidYMid slice">
      <Rect x={0} y={0} width={528} height={200} fill={bg} />
      <Path d="M0 150 C120 130 260 175 528 140 L528 200 L0 200 Z" fill="#fff" opacity={0.55} />
      {/* kulho ja pähkinät */}
      <Path d="M150 52 h120 a60 30 0 0 1 -120 0z" fill="#B98552" />
      <Path d="M156 52 q54 -26 108 0z" fill="#8E5A33" />
      {[168, 186, 204, 222, 240].map((x, n) => (
        <Circle key={x} cx={x} cy={44 + (n % 2) * 4} r={7} fill={['#C99A63', '#7A4B2A', '#E1BE8A'][n % 3]} />
      ))}
      {/* kurkkuviipaleet ja pinaatti */}
      <Path d="M20 120 q40 -60 90 -20 q-20 40 -90 20z" fill="#3E7D3A" />
      <Circle cx={70} cy={140} r={34} fill="#9CCB6A" />
      <Circle cx={70} cy={140} r={26} fill="#E4F2C8" />
      <Circle cx={120} cy={170} r={30} fill="#9CCB6A" />
      <Circle cx={120} cy={170} r={22} fill="#E4F2C8" />
      {/* kämmen ja kapselit */}
      <Path d="M240 150 q60 -50 140 -20 q10 30 -40 40 q-60 10 -100 -20z" fill="#F0C8A8" />
      {[290, 305, 320, 300, 315].map((x, n) => (
        <Path key={n} d={`M${x} ${128 + (n > 2 ? 10 : 0)} a7 4 0 1 1 0.1 0z`} fill="#E5A92A" />
      ))}
      {/* smoothie-lasi ja purkki */}
      <Rect x={420} y={70} width={52} height={90} rx={8} fill="#5E9A3C" opacity={0.9} />
      <Rect x={420} y={70} width={52} height={14} rx={6} fill="#fff" opacity={0.4} />
      <Rect x={480} y={10} width={48} height={110} rx={6} fill="#6B3E1F" />
      <Rect x={482} y={50} width={44} height={40} fill="#F4EEE6" />
    </Svg>
  );
}

function FavouritePlaces({ k }: { k: number }) {
  // kuvituksen pallot: x-keskikohta, y, säde ja pieni kuvake
  const balls: { x: number; y: number; r: number; d: string }[] = [
    { x: 44, y: 54, r: 22, d: 'M38 46h8v14h-8zM42 46v-4' }, // lasi
    { x: 92, y: 30, r: 24, d: 'M82 28h20M84 28a8 8 0 0 0 16 0M92 20v-4' }, // kulho
    { x: 140, y: 56, r: 22, d: 'M135 48h10v16h-10zM137 44h6' }, // pullo
    { x: 236, y: 54, r: 22, d: 'M228 48h16v10h-16zM231 58v6M241 58v6' }, // apteekki/kassi
    { x: 284, y: 30, r: 24, d: 'M272 34h24v-8h-24zM272 26a12 6 0 0 1 24 0' }, // sänky
  ];
  return (
    <SCard style={{ marginTop: 30 * k, alignItems: 'center', paddingVertical: 24 * k, paddingHorizontal: 22 * k }}>
      <Svg width={300 * k * 0.9} height={88 * k * 0.9} viewBox="10 0 310 88">
        {balls.map((b, n) => (
          <React.Fragment key={n}>
            <Circle cx={b.x} cy={b.y} r={b.r} fill="#fff" stroke={C.icon} strokeWidth={2} />
            <Path d={b.d} stroke={C.icon} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </React.Fragment>
        ))}
        {/* keskellä S-tunnus isommassa pallossa */}
        <Circle cx={188} cy={36} r={30} fill="#fff" stroke={C.icon} strokeWidth={2} />
        <Path d={S_PATH} transform={`translate(${188 - 171 * 0.12} ${36 - 183.5 * 0.12}) scale(0.12)`} stroke={C.icon} strokeWidth={19} fill="none" />
      </Svg>
      <Text style={{ fontSize: 23 * k, fontWeight: '700', color: C.text, marginTop: 10 * k }}>Suosikkitoimipaikat</Text>
      <Text style={{ fontSize: 20 * k, lineHeight: 27 * k, color: C.text, textAlign: 'center', marginTop: 6 * k }}>Löydät toimipaikan edut helposti lisäämällä toimipaikan suosikiksi.</Text>
      <Pressable hitSlop={8} style={{ marginTop: 14 * k }}>
        <Text style={{ fontSize: 21 * k, fontWeight: '600', color: C.greenText }}>Hae toimipaikka</Text>
      </Pressable>
    </SCard>
  );
}

type Place = { name: string; bg: string; fg: string; label: string; font?: 'script' | 'serif' | 'bold' | 'tiny'; border?: boolean; swoosh?: boolean };
const BONUS_PLACES: Place[] = [
  { name: 'LähiTapiola', bg: '#2CB4E8', fg: '#fff', label: 'LÄHITAPIOLA', font: 'tiny' },
  { name: 'Presso', bg: '#111', fg: '#fff', label: 'Presso', font: 'script' },
  { name: 'Prisma', bg: '#00843D', fg: '#fff', label: 'PRISMA', font: 'bold' },
  { name: 'Rosso', bg: '#fff', fg: '#D52B1E', label: 'ROSSO', font: 'serif', border: true },
  { name: 'Sale', bg: '#F7DCC6', fg: '#E3262E', label: 'Sale', font: 'script' },
  { name: 'Silmäasema', bg: '#8D3D97', fg: '#fff', label: 'SILMÄASEMA', font: 'tiny' },
  { name: 'Sokos', bg: '#1B2A6B', fg: '#fff', label: 'SOKOS', font: 'serif' },
  { name: 'Sokos Hotels', bg: '#D8232A', fg: '#fff', label: '', swoosh: true },
];

function StoreLogo({ b, size }: { b: Place; size: number }) {
  const fs = b.font === 'tiny' ? size * 0.1 : b.font === 'script' ? size * 0.26 : b.font === 'serif' ? size * 0.17 : size * 0.15;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: b.bg, alignItems: 'center', justifyContent: 'center', borderWidth: b.border ? 1 : 0, borderColor: '#E3E3E3', overflow: 'hidden' }}>
      {b.swoosh ? (
        <Svg width={size * 0.7} height={size * 0.7} viewBox="0 0 40 40">
          <Path d="M30 8C20 8 12 12 12 18s8 6 12 8-2 8-14 8" stroke="#fff" strokeWidth={3} fill="none" strokeLinecap="round" />
          <Path d="M34 12C24 12 17 15 17 19" stroke="#fff" strokeWidth={1.6} fill="none" strokeLinecap="round" />
        </Svg>
      ) : (
        <Text
          style={{
            color: b.fg,
            fontSize: fs,
            fontWeight: b.font === 'tiny' ? '700' : '800',
            fontStyle: b.font === 'script' ? 'italic' : 'normal',
            letterSpacing: b.font === 'serif' ? fs * 0.08 : 0,
          }}
          numberOfLines={1}
        >
          {b.label}
        </Text>
      )}
    </View>
  );
}

/** Anonymous source merchant ID; never invent a retail chain or location. */
function storeName(m?: string | null) {
  return m ? `Ruokakauppa · ${m}` : 'Ruokakauppa · saaja ei tiedossa';
}

/* =========================== S-ETUKORTTI =========================== */

export function CardScreen() {
  const k = useK();
  const [mailOpen, setMailOpen] = useState(true);
  return (
    <ScrollView style={{ backgroundColor: C.mint }} contentContainerStyle={{ paddingBottom: 30 * k }}>
      {/* tummanvihreä kaista, jonka alareunaan kirkkaanvihreä S-Etukortti-kortti asettuu (alakulmat suorat) */}
      <View style={{ backgroundColor: C.greenDark, height: 167 * k, justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: S_GREEN, marginHorizontal: 24 * k, height: 100 * k, borderTopLeftRadius: 12 * k, borderTopRightRadius: 12 * k, paddingLeft: 30 * k, paddingRight: 22 * k, flexDirection: 'row', alignItems: 'center' }}>
          <SLogo size={48 * k} variant="plain" color="#fff" />
          <Text style={{ color: '#fff', fontSize: 29 * k, fontWeight: '700', flex: 1, marginLeft: 22 * k, letterSpacing: -0.2 * k }}>S-ETUKORTTI</Text>
          <Pressable accessibilityLabel="Näytä viivakoodi" style={{ width: 70 * k, height: 70 * k, borderRadius: 35 * k, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <ScanBarcodeIcon size={34 * k} color={C.icon} />
          </Pressable>
        </View>
      </View>

      <View style={{ height: 27 * k }} />
      {[
        { t: 'Bonus ja ostot', i: <BagHeartIcon size={30 * k} color={C.icon} /> },
        { t: 'Kuitit', i: <ReceiptIcon size={30 * k} color={C.icon} /> },
      ].map((x, idx) => (
        <SCard key={x.t} onPress={() => {}} style={{ height: 130 * k, alignItems: 'center', justifyContent: 'center', marginTop: idx ? 14 * k : 0 }}>
          {x.i}
          <Text style={{ fontSize: 24 * k, color: C.text, marginTop: 10 * k, fontWeight: '500' }}>{x.t}</Text>
        </SCard>
      ))}

      {mailOpen && (
        <SCard style={{ marginTop: 30 * k, flexDirection: 'row', padding: 22 * k }}>
          <View style={{ width: 60 * k, height: 60 * k, borderRadius: 8 * k, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center' }}>
            <MailCheckIcon size={36 * k} color={C.icon} />
          </View>
          <View style={{ flex: 1, marginLeft: 16 * k, paddingTop: 10 * k }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Text style={{ flex: 1, fontSize: 24 * k, fontWeight: '700', color: C.text }}>Vahvista sähköpostisi</Text>
              <Pressable onPress={() => setMailOpen(false)} hitSlop={12} accessibilityLabel="Sulje">
                <CloseIcon size={26 * k} color="#5E5E5E" />
              </Pressable>
            </View>
            <Text style={{ fontSize: 22.5 * k, lineHeight: 33 * k, color: C.sub, marginTop: 14 * k }}>Sähköpostiasi ei ole vielä vahvistettu – voit vahvistaa sen helposti S-mobiilissa.</Text>
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 * k }}>
              <Text style={{ color: C.greenText, fontWeight: '700', fontSize: 23.5 * k }}>Vahvista</Text>
              <Chevron size={26 * k} color={C.greenText} />
            </Pressable>
          </View>
        </SCard>
      )}

      <SHeading link="Näytä kaikki">Etuja sinulle</SHeading>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 * k, gap: 16 * k }}>
        {OFFERS.map((o, i) => (
          <View key={o.t} style={{ width: 320 * k, borderRadius: SM.radius * k, backgroundColor: '#fff', overflow: 'hidden' }}>
            <View style={{ height: 250 * k }}>
              <OfferImage kind={i % 3} />
              <Pressable style={{ position: 'absolute', top: 18 * k, right: 18 * k, width: 40 * k, height: 40 * k, borderRadius: 4 * k, backgroundColor: '#F3F3F3', alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Tallenna etu">
                <BookmarkIcon size={24 * k} color="#2B2B2B" />
              </Pressable>
              <View style={{ position: 'absolute', right: -20 * k, top: 120 * k, width: 84 * k, height: 84 * k, borderRadius: 42 * k, backgroundColor: S_GREEN, justifyContent: 'center', paddingLeft: 12 * k }}>
                <Text style={{ color: '#fff', fontSize: 26 * k, fontWeight: '800' }}>{o.badge}</Text>
              </View>
            </View>
            <View style={{ padding: 18 * k }}>
              <Text style={{ fontSize: 21 * k, fontWeight: '700', color: C.text }}>{o.t}</Text>
              <Text style={{ fontSize: 17 * k, color: C.sub, marginTop: 4 * k }}>{o.s}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </ScrollView>
  );
}

const OFFERS = [
  { t: 'Talouspaperit', s: 'Voimassa 17.11. asti', badge: '-30%' },
  { t: 'Juustot 2 kpl', s: 'Voimassa 17.11. asti', badge: '2 kpl' },
  { t: 'Kahvit', s: 'Voimassa 19.11. asti', badge: '-25%' },
];

/** Tuotekuvien sijaiset: talouspaperipaketit, juustot ja kahvipaketit */
function OfferImage({ kind }: { kind: number }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 320 250" preserveAspectRatio="xMidYMid slice">
      <Rect width={320} height={250} fill="#fff" />
      {kind === 0 && (
        <>
          <Rect x={0} y={40} width={180} height={140} rx={6} fill="#1F4E9C" />
          {[30, 80, 130].map((x) => (
            <Path key={x} d={`M${x} 70 q10 -14 22 -4 q12 -10 20 4 q8 2 4 10 h-46 q-6 -6 0 -10z`} fill="#fff" />
          ))}
          <Rect x={70} y={90} width={200} height={130} rx={8} fill="#F6B9CF" />
          {[95, 145, 195].map((x) => (
            <Circle key={x} cx={x + 22} cy={160} r={26} fill="#FBE1EA" stroke="#fff" strokeWidth={3} />
          ))}
          <Path d="M130 104 q40 -16 80 0 q-40 24 -80 0z" fill="#fff" />
        </>
      )}
      {kind === 1 && (
        <>
          <Path d="M20 200 L120 60 L200 200 Z" fill="#1E4D2B" />
          <Path d="M30 196 L118 74 L190 196 Z" fill="#F2E3B3" />
          <Path d="M150 210 L240 70 L310 210 Z" fill="#2C2C2C" />
          <Path d="M160 206 L238 84 L300 206 Z" fill="#E8DDB8" />
          <Rect x={60} y={150} width={80} height={14} fill="#C9A23A" />
        </>
      )}
      {kind === 2 && (
        <>
          <Rect x={40} y={50} width={100} height={160} rx={6} fill="#8B1E1E" />
          <Rect x={150} y={60} width={100} height={150} rx={6} fill="#1D1D1D" />
          <Rect x={52} y={100} width={76} height={40} fill="#F1E3C6" />
          <Rect x={162} y={110} width={76} height={40} fill="#C9A23A" />
        </>
      )}
    </Svg>
  );
}

/* =========================== PANKKI =========================== */

export function BankScreen({ openAgent, openCard, openPay }: { openAgent: (q?: string) => void; openCard: () => void; openPay: () => void }) {
  const k = useK();
  const [promo, setPromo] = useState(true);
  const ic = 62 * k;
  const items: { t: string; sub: string; v?: string; icon: React.ReactNode; onPress?: () => void }[] = [
    { t: 'Tilit', sub: 'S-Tili', v: bal(), icon: <PassbookSIcon size={ic} color={C.icon} /> },
    { t: 'Maksut ja e-laskut', sub: 'Tee uusi maksu tai tarkastele ja tilaa e-laskuja', icon: <InvoiceEuroIcon size={ic} color={C.icon} />, onPress: openPay },
    { t: 'Kortit', sub: 'S-Etukortti Visa Debit', v: bal(), icon: <CardSIcon size={ic} color={C.icon} />, onPress: openCard },
    { t: 'Säästäjä', sub: 'Säästä ylivoimaisen helposti.', icon: <TrophyIcon size={ic} color={C.icon} /> },
    { t: 'Sijoitukset', sub: 'Tutustu säästämisen ja sijoittamisen palveluihimme.', icon: <BriefcaseIcon size={ic} color={C.icon} /> },
    { t: 'Lainat', sub: 'Hae lainaa kaiken kokoisiin hankintoihin', icon: <LoanIcon size={ic} color={C.icon} /> },
    { t: 'Palkka ja eläke', sub: 'Katso palkkalaskelmasi ja työeläkeotteesi', icon: <SalaryIcon size={ic} color={C.icon} /> },
  ];
  return (
    <View style={{ flex: 1, backgroundColor: C.mint }}>
      <SHeader title="S-Pankki" />
      <ScrollView contentContainerStyle={{ paddingTop: 30 * k, paddingBottom: 30 * k, gap: 20 * k }}>
        {promo && (
          <SCard style={{ paddingVertical: 34 * k, paddingLeft: 36 * k, paddingRight: 28 * k }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Text style={{ flex: 1, fontSize: 25 * k, fontWeight: '700', color: C.text }}>Pankkipalvelut opiskelijalle</Text>
              <Pressable onPress={() => setPromo(false)} hitSlop={12} accessibilityLabel="Sulje">
                <CloseIcon size={26 * k} color="#6B6B6B" />
              </Pressable>
            </View>
            <Text style={{ fontSize: 23 * k, lineHeight: 31 * k, color: C.sub, marginTop: 10 * k, paddingRight: 70 * k }}>
              Kun arki täyttyy opiskeluista, raha-asioista ei kannata stressata. Asiakasomistajana hyödynnät maksuttomat päivittäispankkipalvelut ja hoidat raha-asiasi kätevästi S-mobiililla.
            </Text>
            <Text style={{ fontSize: 23 * k, lineHeight: 31 * k, color: C.greenText, fontWeight: '700', marginTop: 22 * k, paddingRight: 150 * k }}>Tutustu opiskelijan pankkipalveluihin</Text>
            <Text style={{ fontSize: 17 * k, color: C.sub, marginTop: 4 * k }}>www.s-pankki.fi</Text>
          </SCard>
        )}
        {items.map((x) => (
          <SCard key={x.t} onPress={x.onPress ?? (() => {})} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 40 * k, paddingLeft: 28 * k, paddingRight: 24 * k }}>
            {x.icon}
            <View style={{ flex: 1, marginLeft: 32 * k }}>
              <Text style={{ fontSize: 36 * k, lineHeight: 44 * k, fontWeight: '800', color: C.greenText, letterSpacing: -0.3 }}>{x.t}</Text>
              <Text style={{ fontSize: 23.5 * k, lineHeight: 31 * k, color: C.text }}>{x.sub}</Text>
              {x.v ? <Text style={{ fontSize: 22 * k, lineHeight: 30 * k, color: C.sub }}>{x.v}</Text> : null}
            </View>
            <Chevron size={28 * k} color="#1E1E1E" />
          </SCard>
        ))}
        <SCard onPress={() => {}} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 30 * k, paddingLeft: 28 * k, paddingRight: 24 * k }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 23.5 * k, lineHeight: 32 * k, color: C.text, fontWeight: '500' }}>Tee peruutuspyyntö</Text>
            <Text style={{ fontSize: 21.5 * k, lineHeight: 30 * k, color: C.sub }}>Peruutuspyyntö 14 päivän sisällä avatusta tuotteesta</Text>
          </View>
          <Chevron size={28 * k} color="#1E1E1E" />
        </SCard>
      </ScrollView>
    </View>
  );
}

/* =========================== MINÄ =========================== */

export function MeScreen({ openPicker }: { openPicker: () => void }) {
  const k = useK();
  const ic = (el: React.ComponentType<{ size?: number; color?: string }>) => React.createElement(el, { size: 30 * k, color: C.icon });
  return (
    <View style={{ flex: 1, backgroundColor: C.mint }}>
      <SHeader title="Minä" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 * k }}>
        {/* profiili */}
        <View style={{ alignItems: 'center', paddingTop: 30 * k, paddingBottom: 50 * k, backgroundColor: '#fff' }}>
          <View style={{ width: 128 * k, height: 128 * k, borderRadius: 64 * k, backgroundColor: C.avatar, alignItems: 'center', justifyContent: 'center' }}>
            <Text testID="customer-letter" style={{ fontSize: 74 * k, lineHeight: 88 * k, fontWeight: '800', color: C.greenText }}>{customerLetter(CUSTOMER.id)}</Text>
          </View>
          <Text style={{ fontSize: 36 * k, fontWeight: '800', color: '#2A2A2A', marginTop: 28 * k, letterSpacing: 0.2 }}>{CUSTOMER.id}</Text>
          <Text style={{ fontSize: 20 * k, color: C.sub, marginTop: 6 * k }}>Demoasiakas · {CUSTOMER.age} v{CUSTOMER.postal ? ` · postinro ${CUSTOMER.postal}` : ''}</Text>
          {/* VAIHDA ASIAKASTA: iso ja selkeä – kaikki 5 100 GitHub-aineiston asiakasta valittavissa */}
          <Pressable
            testID="switch-customer"
            accessibilityRole="button"
            accessibilityLabel="Vaihda asiakasta"
            onPress={openPicker}
            style={({ pressed }) => [{ marginTop: 26 * k, alignSelf: 'stretch', marginHorizontal: SM.margin * k, backgroundColor: C.greenDark, borderRadius: 999, paddingVertical: 20 * k, paddingHorizontal: 24 * k, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 * k }, pressed && { opacity: 0.85 }]}
          >
            <GroupIcon size={34 * k} color="#fff" />
            <Text style={{ fontSize: 26 * k, fontWeight: '800', color: '#fff' }}>Vaihda asiakasta</Text>
          </Pressable>
          <Text style={{ fontSize: 18 * k, color: C.sub, marginTop: 10 * k, textAlign: 'center', paddingHorizontal: SM.margin * k }}>Valittavissa kaikki 5 100 asiakasta · nyt {CUSTOMER.id}</Text>
        </View>

        <SCard style={{ marginTop: 26 * k }}>
          <SRow icon={ic(PersonIcon)} title="Omat tiedot" sub="Yhteystiedot, asiakasomistajuuden tiedot, viestintä, yksityisyys" last />
        </SCard>

        <SHeading>Tunnistaminen</SHeading>
        <View style={{ flexDirection: 'row', marginHorizontal: SM.margin * k, gap: 18 * k }}>
          {[
            { t: 'Lue QR-koodi', i: QrScanIcon },
            { t: 'Hyväksy tapahtuma', i: ShieldKeyIcon },
          ].map((x) => (
            <Pressable key={x.t} style={({ pressed }) => [{ flex: 1, height: 112 * k, borderRadius: SM.radius * k, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.75 }]}>
              {ic(x.i)}
              <Text style={{ fontSize: 21 * k, color: C.text, marginTop: 10 * k, fontWeight: '500' }}>{x.t}</Text>
            </Pressable>
          ))}
        </View>

        <SHeading>S-Pankin palvelut</SHeading>
        <SCard>
          <SRow icon={ic(KeyIcon)} title="Tunnistaminen" />
          <SRow icon={ic(IdCardIcon)} title="Tarkista verkkopankin käyttäjätunnus" />
          <SRow icon={ic(CustomerDocIcon)} title="Asiakastiedot" />
          <SRow icon={ic(GroupIcon)} title="Lapsen pankkipalvelut" last />
        </SCard>

        <SHeading>Asiakasomistajan palvelut</SHeading>
        <SCard>
          <SRow icon={ic(CardSIcon)} title="S-Etukortti S-mobiilissa" />
          <SRow icon={ic(ReceiptZigIcon)} title="Sähköiset kuitit" />
          <SRow icon={ic(CardPlusIcon)} title="S-Etukortit" sub="Tilaa itsellesi tai perheenjäsenille" last />
        </SCard>

        <SHeading>Sovelluksen asetukset</SHeading>
        <SCard>
          <SRow icon={ic(PhoneIcon)} title="Sovellusversio" right="2.41.5" chevron={false} />
          <SRow icon={ic(MegaphoneIcon)} title="Ilmoitukset" last />
        </SCard>
      </ScrollView>
    </View>
  );
}


/* =========================== MAKSU (+) =========================== */

export function PaySheet({ open, onClose, openAgent, openPay }: { open: boolean; onClose: () => void; openAgent: (q?: string) => void; openPay: () => void }) {
  const k = useK();
  const v = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) setMounted(true);
    Animated.timing(v, { toValue: open ? 1 : 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => !open && setMounted(false));
  }, [open, v]);
  if (!mounted) return null;
  const [whole, cents] = bal().replace(/\s*€/, '').split(',');
  // iso saldo kuten S-mobiilissa (157,80 → 104 px); pitkät summat pienennetään mahtumaan riville
  const bigFs = Math.min(104, (104 * 6) / (whole.length + 3));
  const row = (icon: React.ReactNode, title: string, sub: string, onPress: () => void) => (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flexDirection: 'row', paddingVertical: 24 * k, borderBottomWidth: 1.5 * k, borderBottomColor: C.divider }, pressed && { opacity: 0.6 }]}>
      <View style={{ width: 36 * k, marginRight: 18 * k, paddingTop: 2 * k }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 25 * k, color: C.text, fontWeight: '500' }}>{title}</Text>
        <Text style={{ fontSize: 22.5 * k, lineHeight: 31 * k, color: C.sub, marginTop: 2 * k }}>{sub}</Text>
      </View>
      <View style={{ paddingTop: 2 * k }}>
        <Chevron size={24 * k} color="#8A8A8A" />
      </View>
    </Pressable>
  );
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* tummanvihreä tausta paneelin yläpuolella */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#00391C', opacity: v }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Sulje maksu" />
      </Animated.View>
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 34 * k,
          bottom: 0,
          backgroundColor: '#fff',
          borderTopLeftRadius: 8 * k,
          borderTopRightRadius: 8 * k,
          paddingHorizontal: 44 * k,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [900, 0] }) }],
        }}
      >
        {/* kahva: kaksi ohutta viivaa */}
        <Pressable onPress={onClose} hitSlop={14} style={{ alignSelf: 'center', marginTop: 22 * k, gap: 5 * k }}>
          <View style={{ width: 40 * k, height: 2.5 * k, borderRadius: 2, backgroundColor: '#B5B5B5' }} />
          <View style={{ width: 40 * k, height: 2.5 * k, borderRadius: 2, backgroundColor: '#B5B5B5' }} />
        </Pressable>
        <Text style={{ fontSize: 25 * k, fontWeight: '700', color: C.text, marginTop: 270 * k }}>S-Tili</Text>
        <Text numberOfLines={1} style={{ fontSize: bigFs * k, lineHeight: bigFs * 1.15 * k, fontWeight: '800', color: C.greenText, letterSpacing: -3 * k, marginTop: 4 * k }}>
          {whole},{cents}
          <Text style={{ fontSize: bigFs * 0.44 * k, fontWeight: '700', letterSpacing: 0 }}>€</Text>
        </Text>
        <View style={{ marginTop: 34 * k }}>
          {row(<PayArrowIcon size={34 * k} />, 'Uusi maksu', 'Maksa kätevästi laskuja esimerkiksi viivakoodilla tai siirrä rahaa toiselle henkilölle.', () => {
            onClose();
            openPay();
          })}
          {row(<PerTieeriHead size={34 * k} round />, 'Kysy Per Tieeriltä ennen maksua', 'Näe turvallinen käyttövarasi ja miten maksu vaikuttaa tuleviin laskuihin.', () => {
            onClose();
            openAgent('Paljonko voin käyttää tällä viikolla?');
          })}
        </View>
      </Animated.View>
    </View>
  );
}
