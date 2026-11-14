import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path } from 'react-native-svg';
import { C } from '../theme';
import { EmotionName, PartKind, PT_EMOTION_HEAD, PT_EMOTION_PARTS, PT_EMOTIONS } from './perTieeriEmotions';
import { PT_H, PT_INK, PT_PIVOT, PT_POSES, PT_W } from './perTieeriPoses';

export type { EmotionName } from './perTieeriEmotions';

/**
 * Per Tieeri – hahmo käyttäjän piirroksista (design/reference/hahmo/).
 *
 * PERUSTILA (aina kun mitään ei tapahdu): kädet ristissä, jatkuva rauhallinen liike yhdestä yhteisestä
 * kellosta → hengitys, pään heilunta, silmien räpyttely, hymyn siristys, käsien hieronta. Ei vilkutuksia.
 *
 * TUNNETILAT (20 kpl, design/reference/hahmo/tunteet/*.png → perTieeriEmotions.ts): Per Tieeri reagoi
 * viesteihin. Asento vaihtuu selkeällä ristiinhäivytyksellä (ei välivaiheita), tunteella on oma
 * animaationsa (esim. nauraessa hytkyy, vihaisena tärisee, surullisena painuu), ja sen jälkeen hahmo
 * palaa pehmeästi perustilaan. Kaikki asennot jakavat saman koordinaatiston (kengät, keskilinja, koko).
 *
 * crop: 'full' = koko hahmo, 'bust' = pää–vyötärö, 'face' = pää (avatarit)
 */
const CROPS = {
  full: { x: 0, y: 0, w: PT_W, h: PT_H },
  bust: { x: 40, y: 0, w: 260, h: 245 },
  face: { x: 121, y: 2, w: 98, h: 98 },
};

/* ---------------- yhteinen kello (perustila) ---------------- */

const PERIOD = 24000;
const CLOCK = new Animated.Value(0);
let clockStarted = false;
function startClock() {
  if (clockStarted) return;
  clockStarted = true;
  Animated.loop(Animated.timing(CLOCK, { toValue: 1, duration: PERIOD, easing: Easing.linear, useNativeDriver: true })).start();
}
const N = 480;
const XS = Array.from({ length: N + 1 }, (_, i) => i / N);
const periodic = (f: (x: number) => number) => CLOCK.interpolate({ inputRange: XS, outputRange: XS.map(f) });
const sin = (cycles: number, phase = 0) => (x: number) => Math.sin(2 * Math.PI * (cycles * x + phase));
const pulse = (centers: number[], w: number) => (x: number) =>
  Math.min(
    1,
    centers.reduce((s, c) => {
      const d = Math.min(Math.abs(x - c), 1 - Math.abs(x - c));
      return s + Math.exp(-((d / w) ** 4));
    }, 0),
  );
const BREATHE = periodic(sin(6)); // 4 s hengitys
const TILT = periodic((x) => 3.2 * sin(3, 0.1)(x) + 0.8 * sin(7, 0.3)(x)); // astetta, pää kallistuu selvästi
const RUB = periodic((x) => pulse([0.18, 0.68], 0.035)(x) * sin(36)(x));
const SMILE = periodic(pulse([0.42, 0.9], 0.06));
const SWAY = periodic((x) => sin(4)(x) + 0.25 * sin(8, 0.25)(x)); // koko vartalon selkeä, hidas heilunta (6 s)


/* ---------------- tunneasentojen liikkuvat osat (raajat, pää, merkit) ---------------- */

const PART_PERIOD = 2400;
const PART_CLOCK = new Animated.Value(0);
let partStarted = false;
function startPartClock() {
  if (partStarted) return;
  partStarted = true;
  Animated.loop(Animated.timing(PART_CLOCK, { toValue: 1, duration: PART_PERIOD, easing: Easing.linear, useNativeDriver: true })).start();
}
const pPer = (f: (x: number) => number) => PART_CLOCK.interpolate({ inputRange: XS, outputRange: XS.map(f) });
const deg = (v: Animated.AnimatedInterpolation<number>, a: number) => v.interpolate({ inputRange: [-1, 1], outputRange: [`${-a}deg`, `${a}deg`] });
const W1 = pPer(sin(1));
const W2 = pPer(sin(2));
const W3 = pPer(sin(3));
const W6 = pPer(sin(6));
const W12 = pPer(sin(12));
const TAPV = pPer((x) => Math.max(0, sin(4)(x)));
/** Jokaisen osan oma jatkuva, saumaton liike (kellon jaksollinen funktio → ei alkua eikä loppua). */
const PART_MOTION: Record<PartKind, (sc: number) => { rotate?: Animated.AnimatedInterpolation<string>; tx?: Animated.AnimatedInterpolation<number>; ty?: Animated.AnimatedInterpolation<number>; scale?: Animated.AnimatedInterpolation<number>; opacity?: Animated.AnimatedInterpolation<number> }> = {
  wave: () => ({ rotate: deg(W3, 14) }),
  waveR: () => ({ rotate: deg(W3, -14) }),
  gesture: () => ({ rotate: deg(W1, 7) }),
  gestureR: () => ({ rotate: deg(W1, -7) }),
  scratch: () => ({ rotate: deg(W6, 6) }),
  bob: (sc) => ({ rotate: deg(W2, 10), ty: W2.interpolate({ inputRange: [-1, 1], outputRange: [-3 * sc, 2 * sc] }) }),
  head: () => ({ rotate: deg(W1, 4) }),
  headFast: () => ({ rotate: deg(W6, 3) }),
  tremble: (sc) => ({ tx: W12.interpolate({ inputRange: [-1, 1], outputRange: [-1.3 * sc, 1.3 * sc] }) }),
  flicker: () => ({ opacity: W3.interpolate({ inputRange: [-1, 1], outputRange: [0.25, 1] }), scale: W3.interpolate({ inputRange: [-1, 1], outputRange: [0.85, 1.12] }) }),
  point: (sc) => ({ tx: W2.interpolate({ inputRange: [-1, 1], outputRange: [-2 * sc, 6 * sc] }) }),
  pat: (sc) => ({ ty: W3.interpolate({ inputRange: [-1, 1], outputRange: [-2.5 * sc, 2.5 * sc] }) }),
  tap: () => ({ rotate: TAPV.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-9deg'] }) }),
  swingL: () => ({ rotate: deg(W1, 4) }),
  swingR: () => ({ rotate: deg(W1, 4) }),
  shiver: () => ({ rotate: deg(W6, 6) }),
  shiverR: () => ({ rotate: deg(W6, -6) }),
};

/* ---------------- tunteiden animaatiot (koko vartalo) ---------------- */

type Motion = { kind: 'bounce' | 'rock' | 'tilt' | 'shake' | 'tap' | 'breathe' | 'sink' | 'pop' | 'lean'; amp: number; ms: number };
/** jokaisella tunteella oma, luonteeseen sopiva liike (amp viewBox-yksikköinä tai asteina) */
export const EMOTION_MOTION: Record<EmotionName, Motion> = {
  perus: { kind: 'rock', amp: 2.4, ms: 1500 },
  sivuilla: { kind: 'rock', amp: 2.2, ms: 1600 },
  tervetuloa: { kind: 'rock', amp: 3, ms: 1100 },
  esittelee: { kind: 'lean', amp: 4, ms: 1200 },
  innostunut: { kind: 'bounce', amp: 14, ms: 420 },
  nauraa: { kind: 'bounce', amp: 7, ms: 300 },
  vilkuttaa: { kind: 'rock', amp: 4, ms: 550 },
  'vilkuttaa-iloisesti': { kind: 'rock', amp: 5, ms: 420 },
  hammentynyt: { kind: 'tilt', amp: 4, ms: 1100 },
  mietteliaas: { kind: 'tilt', amp: 3, ms: 1500 },
  osoittaa: { kind: 'lean', amp: 6, ms: 700 },
  huomio: { kind: 'lean', amp: 5, ms: 800 },
  liikuttunut: { kind: 'sink', amp: 5, ms: 1600 },
  huolestunut: { kind: 'sink', amp: 6, ms: 1400 },
  vihainen: { kind: 'shake', amp: 3, ms: 70 },
  surullinen: { kind: 'sink', amp: 10, ms: 2000 },
  narkastynyt: { kind: 'tap', amp: 4, ms: 230 },
  yllattynyt: { kind: 'pop', amp: 0.09, ms: 380 },
  nolo: { kind: 'rock', amp: 2.5, ms: 1000 },
  kuiskaa: { kind: 'lean', amp: 4, ms: 1000 },
};
const FADE_IN = 320;
const FADE_OUT = 520;

/* ---------------- hahmo ---------------- */

export function PerTieeri({
  size = 140,
  talking = false,
  crop = 'full',
  emotion,
  emotionKey,
}: {
  /** korkeus pikseleinä */
  size?: number;
  /** Per Tieeri miettii vastausta → mietteliäs asento niin kauan kuin kirjoittaa */
  talking?: boolean;
  crop?: keyof typeof CROPS;
  /** tunnetila, johon reagoidaan (näytetään hetken, sitten takaisin perustilaan) */
  emotion?: EmotionName | null;
  /** muuttuu jokaisella uudella reaktiolla (esim. viestin id), jotta sama tunne voi toistua */
  emotionKey?: string;
  /** @deprecated */
  mood?: string;
  /** @deprecated */
  pose?: string;
  /** @deprecated */
  auto?: boolean;
  /** @deprecated */
  wave?: boolean;
}) {
  const box = CROPS[crop];
  const sc = size / box.h;
  const W = box.w * sc;
  const H = size;

  useEffect(startClock, []);
  useEffect(startPartClock, []);

  /* ---- mikä tunne näkyy nyt ---- */
  const [reaction, setReaction] = useState<EmotionName | null>(null);
  // tunne pysyy näkyvissä, kunnes seuraava viesti tuo uuden reaktion (tai Per Tieeri alkaa miettiä)
  useEffect(() => {
    setReaction(emotion && emotion !== 'perus' ? emotion : null);
  }, [emotion, emotionKey]);
  const shown: EmotionName | null = talking ? 'mietteliaas' : reaction;

  /* ---- ristiinhäivytys perustila ↔ tunne ---- */
  const mix = useRef(new Animated.Value(0)).current; // 0 = perustila, 1 = tunne
  const [layer, setLayer] = useState<EmotionName | null>(shown);
  useEffect(() => {
    if (shown) {
      if (layer && layer !== shown) {
        // tunteesta toiseen: nopea häivytys perustilan kautta pitää vaihdon selkeänä
        Animated.timing(mix, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => {
          setLayer(shown);
          Animated.timing(mix, { toValue: 1, duration: FADE_IN, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
        });
      } else {
        setLayer(shown);
        Animated.timing(mix, { toValue: 1, duration: FADE_IN, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      }
    } else if (layer) {
      Animated.timing(mix, { toValue: 0, duration: FADE_OUT, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(({ finished }) => finished && setLayer(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  /* ---- tunteen oma animaatio ---- */
  const m = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!layer) return;
    const mo = EMOTION_MOTION[layer];
    m.setValue(0);
    const ease = Easing.inOut(Easing.sin);
    let a: Animated.CompositeAnimation;
    if (mo.kind === 'pop') {
      a = Animated.sequence([
        Animated.timing(m, { toValue: 1, duration: mo.ms, easing: Easing.out(Easing.back(3)), useNativeDriver: true }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(m, { toValue: 0.4, duration: 900, easing: ease, useNativeDriver: true }),
            Animated.timing(m, { toValue: 1, duration: 900, easing: ease, useNativeDriver: true }),
          ]),
        ),
      ]);
    } else if (mo.kind === 'sink') {
      a = Animated.sequence([
        Animated.timing(m, { toValue: 1, duration: mo.ms, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(m, { toValue: 0.55, duration: 1600, easing: ease, useNativeDriver: true }),
            Animated.timing(m, { toValue: 1, duration: 1600, easing: ease, useNativeDriver: true }),
          ]),
        ),
      ]);
    } else {
      a = Animated.loop(
        Animated.sequence([
          Animated.timing(m, { toValue: 1, duration: mo.ms, easing: ease, useNativeDriver: true }),
          Animated.timing(m, { toValue: -1, duration: mo.ms, easing: ease, useNativeDriver: true }),
        ]),
      );
    }
    a.start();
    return () => a.stop();
  }, [layer, m]);

  /* ---- perustilan yksityiskohdat ---- */
  const blink = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let alive = true;
    const loop = () => {
      if (!alive) return;
      Animated.sequence([
        Animated.delay(2200 + Math.random() * 2800),
        Animated.timing(blink, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.delay(90),
        Animated.timing(blink, { toValue: 0, duration: 80, useNativeDriver: true }),
      ]).start(loop);
    };
    loop();
    return () => {
      alive = false;
    };
  }, [blink]);

  const around = (px: number, py: number, t: any[]) => {
    const dx = (px - box.x) * sc - W / 2;
    const dy = (py - box.y) * sc - H / 2;
    return [{ translateX: dx }, { translateY: dy }, ...t, { translateX: -dx }, { translateY: -dy }];
  };
  const P = PT_PIVOT;
  const FEET = { x: 170, y: 525 };
  const WAIST = { x: 170, y: 330 };
  const breatheY = BREATHE.interpolate({ inputRange: [-1, 1], outputRange: [1.4 * sc, -1.4 * sc] });
  const swayRot = SWAY.interpolate({ inputRange: [-1.25, 1.25], outputRange: ['-2.4deg', '2.4deg'] });
  const headRot = TILT.interpolate({ inputRange: [-10, 10], outputRange: ['-10deg', '10deg'] });
  const vb = `${box.x} ${box.y} ${box.w} ${box.h}`;
  const svg = (children: React.ReactNode) => (
    <Svg width={W} height={H} viewBox={vb} style={StyleSheet.absoluteFill}>
      {children}
    </Svg>
  );
  const fill = (d: string) => <Path d={d} fill={PT_INK} fillRule="evenodd" />;
  const lid = (x: number) => `M${x - 5.6} ${P.eyes.y - 0.2}Q${x} ${P.eyes.y + 2.2} ${x + 5.6} ${P.eyes.y - 0.2}`;
  const abs = StyleSheet.absoluteFill;
  const base = PT_POSES.ristissa;

  const emotionTransform = (e: EmotionName): any[] => {
    const mo = EMOTION_MOTION[e];
    switch (mo.kind) {
      case 'bounce':
        return [{ translateY: m.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, -mo.amp * sc * 0.5, -mo.amp * sc] }) }];
      case 'rock':
        // vain perusasento heiluu puolelta toiselle – tunneasennoissa liikkuvat raajat (PART_MOTION)
        return [];
      case 'tilt':
        return around(WAIST.x, WAIST.y, [{ rotate: m.interpolate({ inputRange: [-1, 1], outputRange: [`-${mo.amp}deg`, `${mo.amp}deg`] }) }]);
      case 'shake':
        return [{ translateX: m.interpolate({ inputRange: [-1, 1], outputRange: [-mo.amp * sc, mo.amp * sc] }) }];
      case 'tap':
        return [{ translateY: m.interpolate({ inputRange: [-1, 1], outputRange: [0, -mo.amp * sc] }) }];
      case 'lean':
        return around(FEET.x, FEET.y, [{ rotate: m.interpolate({ inputRange: [-1, 1], outputRange: [`${-mo.amp * 0.3}deg`, `${mo.amp * 0.6}deg`] }) }]);
      case 'sink':
        return [{ translateY: m.interpolate({ inputRange: [0, 1], outputRange: [0, mo.amp * sc] }) }];
      case 'pop':
        return around(FEET.x, FEET.y, [{ scale: m.interpolate({ inputRange: [0, 1], outputRange: [1 - mo.amp, 1] }) }]);
      case 'breathe':
      default:
        return around(FEET.x, FEET.y, [{ scaleY: m.interpolate({ inputRange: [-1, 1], outputRange: [1, 1 + mo.amp] }) }]);
    }
  };

  return (
    <View style={{ width: W, height: H, overflow: crop === 'full' ? 'visible' : 'hidden' }} pointerEvents="none">
      {/* PERUSTILA: kädet ristissä, jatkuva rauhallinen liike */}
      <Animated.View style={[abs, { opacity: mix.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [...around(FEET.x, FEET.y, [{ rotate: swayRot }])] }]}>
        {svg(
          <>
            <Path d={base.silhouette} fill="#fff" />
            {fill(base.body)}
          </>,
        )}
        {svg(fill(base.extra))}
        <Animated.View style={[abs, { transform: around(P.neck.x, P.neck.y, [{ rotate: headRot }]) }]}>
          {svg(fill(base.head))}
          <Animated.View
            style={[
              abs,
              {
                opacity: blink.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              },
            ]}
          >
            {svg(fill(base.eyes))}
          </Animated.View>
          <Animated.View style={[abs, { opacity: blink }]}>{svg(<Path d={lid(P.eyeL.x) + lid(P.eyeR.x)} stroke={PT_INK} strokeWidth={1.6} strokeLinecap="round" fill="none" />)}</Animated.View>
          <Animated.View
            style={[
              abs,
              {
                transform: around(P.stache.x, P.stache.y, [
                  { scaleX: SMILE.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) },
                  { translateY: SMILE.interpolate({ inputRange: [0, 1], outputRange: [0, -0.5 * sc] }) },
                ]),
              },
            ]}
          >
            {svg(fill(base.stache))}
          </Animated.View>
        </Animated.View>
      </Animated.View>

      {/* TUNNETILA */}
      {layer && (
        <Animated.View
          style={[
            abs,
            {
              opacity: mix,
              transform: [
                // kasvokuvassa pää keskitetään samaan kohtaan kuin perusasennossa (nojaavat asennot)
                ...(crop === 'face' ? [{ translateX: (PT_EMOTION_HEAD.perus.x - PT_EMOTION_HEAD[layer].x) * sc }, { translateY: -PT_EMOTION_HEAD[layer].y * sc }] : []),
              ],
            },
          ]}
        >
          <Animated.View style={[abs, { transform: emotionTransform(layer) }]}>
            {svg(
              <>
                <Path d={PT_EMOTIONS[layer].sil} fill="#fff" />
                {fill(PT_EMOTIONS[layer].ink)}
              </>,
            )}
            {PT_EMOTION_PARTS[layer].map((part, pi) => {
              const mo = PART_MOTION[part.kind](sc);
              const t: any[] = [];
              if (mo.tx) t.push({ translateX: mo.tx });
              if (mo.ty) t.push({ translateY: mo.ty });
              const inner: any[] = [];
              if (mo.rotate) inner.push({ rotate: mo.rotate });
              if (mo.scale) inner.push({ scale: mo.scale });
              return (
                <Animated.View key={pi} style={[abs, { opacity: mo.opacity ?? 1, transform: [...t, ...(inner.length ? around(part.px, part.py, inner) : [])] }]}>
                  {svg(fill(part.d))}
                </Animated.View>
              );
            })}
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

/**
 * Tuki-kuvake: konduktööri/pankkivirkailija rintakuvana (valkoinen kuvio vihreällä).
 * Piirretty 100 × 100 -ruutuun, jossa ympyränapin halkaisija = 100, joten kuvio asettuu
 * napin sisään samoissa suhteissa kuin S-mobiilin Tuki-napissa.
 *  - `bg` = taustan väri (kuvion "reiät": kasvot, kaulus ja raidat piirretään sillä)
 *  - `round` = piirrä myös vihreä ympyrä (muuten läpinäkyvä tausta)
 */
export function PerTieeriHead({ size = 40, color = '#fff', bg = C.greenDark, round = false }: { size?: number; color?: string; bg?: string; round?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <ClipPath id="tuki-clip">
          <Circle cx={50} cy={50} r={50} />
        </ClipPath>
      </Defs>
      {round && <Circle cx={50} cy={50} r={50} fill={bg} />}
      <G clipPath="url(#tuki-clip)">
        <Path d="M20 90 Q21 76 33 72.4 L43 69.6 L50 80 L57 69.6 L67 72.4 Q79 76 80 90 Z" fill={color} />
        <Path d="M43 69.6 L40.6 77.5 L45.5 76 M57 69.6 L59.4 77.5 L54.5 76" stroke={bg} strokeWidth={1.3} fill="none" strokeLinejoin="round" />
        <Path d="M47.7 71.6 H52.3 L51.4 75 H48.6 Z" fill={color} />
        <Path d="M48.6 75.8 H51.4 L53 84.5 L50 88 L47 84.5 Z" fill={color} stroke={bg} strokeWidth={1.1} strokeLinejoin="round" />
        <Path d="M43.6 64.5 V69.6 M56.4 64.5 V69.6" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
      </G>
      <Path d="M34.2 39.5 V50 Q34.2 66.6 50 68 Q65.8 66.6 65.8 50 V39.5" stroke={color} strokeWidth={2.8} fill="none" strokeLinecap="round" />
      <Path d="M34.2 46.4 Q31 46.2 31.4 50.6 Q31.9 54.8 34.8 55" stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <Path d="M65.8 46.4 Q69 46.2 68.6 50.6 Q68.1 54.8 65.2 55" stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <Path
        d="M39.6 58 Q43.4 53.2 47.6 54.2 Q49.3 54.7 50 56 Q50.7 54.7 52.4 54.2 Q56.6 53.2 60.4 58 Q56.4 60.2 52.4 58.6 Q50.9 58 50 57.3 Q49.1 58 47.6 58.6 Q43.6 60.2 39.6 58 Z"
        fill={color}
      />
      <Path d="M25.5 27.2 C25.5 19 38 15.4 50 15.4 C62 15.4 74.5 19 74.5 27.2 C74.5 30.4 71 31.8 66.5 31.8 H33.5 C29 31.8 25.5 30.4 25.5 27.2 Z" fill={color} />
      <Path d="M31.6 33.2 H68.4 V38 H31.6 Z" fill={color} />
      <Path d="M32.6 35.6 H67.4" stroke={bg} strokeWidth={1.1} />
      <Path d="M32.4 39.4 Q50 37.4 67.6 39.4 Q66.8 42.6 50 42.6 Q33.2 42.6 32.4 39.4 Z" fill={color} />
    </Svg>
  );
}
