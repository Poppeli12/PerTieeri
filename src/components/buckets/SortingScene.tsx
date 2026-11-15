import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { addDays, eur0, fmtDay, labelOf, TODAY, txs } from '../../finance/analytics';
import { Basket, basketOf } from '../../finance/categories';
import { paymentKey, paymentPatterns, type PaymentPattern } from '../../finance/paymentPatterns';
import { C } from '../../theme';
import { useK } from '../scale';
import { Text } from '../Text';

/**
 * PERUSANIMAATIO: Per Tieeri lajittelee asiakkaan OIKEITA kuitteja kolmeen ämpäriin.
 * Käyttäjän kolme piirrosta (assets/per-tieeri/lajittelu-1..3.png) – yksi kutakin ämpäriä kohden.
 * Jokaisessa kuvassa: kulun nimi ja summa nousevat isolla esiin → kuitti putoaa kädestä ämpäriin → kuva vaihtuu
 * seuraavaan ämpäriin. Silmukka on saumaton (ei alkua eikä loppua), eikä lajittelua aloiteta uudelleen nappia painamalla.
 */
const SCENES: Record<Basket, { img: any; aspect: number; hand: { x: number; y: number }; mouth: number }> = {
  regular: { img: require('../../../assets/per-tieeri/lajittelu-1.png'), aspect: 701 / 576, hand: { x: 0.16, y: 0.53 }, mouth: 0.64 },
  irregular: { img: require('../../../assets/per-tieeri/lajittelu-2.png'), aspect: 674 / 578, hand: { x: 0.5, y: 0.58 }, mouth: 0.66 },
  slipping: { img: require('../../../assets/per-tieeri/lajittelu-3.png'), aspect: 681 / 579, hand: { x: 0.8, y: 0.53 }, mouth: 0.64 },
};
const STEP = 3200; // ms per kuitti
const PER_BUCKET = 3;

type Receipt = { key: string; label: string; date: string; amount: number; basket: Basket; pattern: string };

/** Maksun luonne metatiedoista (maksutyyppi, MCC, kauppiastunnus, aikarytmi) – hinta ei ratkaise. */
const PATTERN_FI: Record<PaymentPattern['status'], string> = {
  recurring: 'Jatkuva',
  habit: 'Toistuva tapa',
  one_off_candidate: 'Yksittäinen',
  uncertain: 'Yksittäinen',
};

/**
 * Yksi lajittelukierros asiakkaan OIKEISTA tapahtumista (viimeiset 12 kk):
 * 1) Per Tieeri on luokitellut jokaisen menon valmiiksi ämpäriin (basketOf: kategoria + kauppiasluokka).
 * 2) Jokaiseen ämpäriin arvotaan 3 eri kulua kaikista sen ämpärin menoista.
 * 3) Järjestys arvotaan: seuraava kuitti tulee satunnaisesta ämpäristä, jossa on vielä lajittelematonta.
 *    Täyttynyt ämpäri jää pois, kunnes kaikki 9 on lajiteltu – sitten arvotaan uusi kierros.
 */
function randomRound(): Receipt[] {
  const from = addDays(TODAY, -365);
  const pools: Record<Basket, Receipt[]> = { regular: [], irregular: [], slipping: [] };
  const all = txs();
  const status = new Map(paymentPatterns(all, from, TODAY, 12).map((p) => [p.key, p.status]));
  all.forEach((t, idx) => {
    if (t.d < from || t.a >= 0) return;
    const b = basketOf(t.c, t.mcc);
    if (!b) return;
    pools[b].push({ key: `${t.d}-${t.t}-${idx}`, label: labelOf(t), date: t.d, amount: -t.a, basket: b, pattern: PATTERN_FI[status.get(paymentKey(t)) ?? 'uncertain'] });
  });
  const pick: Record<Basket, Receipt[]> = { regular: [], irregular: [], slipping: [] };
  (Object.keys(pools) as Basket[]).forEach((b) => {
    const pool = [...pools[b]];
    const used = new Set<string>();
    while (pick[b].length < PER_BUCKET && pool.length) {
      const r = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      if (used.has(r.label) && pool.length > PER_BUCKET) continue; // eri kulut, jos mahdollista
      used.add(r.label);
      pick[b].push(r);
    }
  });
  const order: Receipt[] = [];
  const left = { ...pick, regular: [...pick.regular], irregular: [...pick.irregular], slipping: [...pick.slipping] };
  while (true) {
    const open = (Object.keys(left) as Basket[]).filter((b) => left[b].length);
    if (!open.length) break;
    const b = open[Math.floor(Math.random() * open.length)];
    order.push(left[b].shift()!);
  }
  return order;
}

export function SortingScene({ active = true }: { months?: number; active?: boolean }) {
  const k = useK();
  const [receipts, setReceipts] = useState<Receipt[]>(() => randomRound());
  const [i, setI] = useState(0);
  const [w, setW] = useState(0);
  const [reduce, setReduce] = useState(false);
  const fade = useState(() => new Animated.Value(1))[0];
  const drop = useState(() => new Animated.Value(0))[0];
  const r = receipts.length ? receipts[Math.min(i, receipts.length - 1)] : null;
  const scene = SCENES[r?.basket ?? 'regular'];

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
  }, []);

  useEffect(() => {
    if (!active || !r || reduce) return;
    drop.setValue(0);
    const a = Animated.sequence([
      Animated.timing(fade, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(drop, { toValue: 1, duration: STEP - 700, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0.25, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]);
    a.start(({ finished }) => {
      if (!finished) return;
      if (i + 1 >= receipts.length) {
        // kierros valmis → uusi satunnainen kierros
        setReceipts(randomRound());
        setI(0);
      } else setI(i + 1);
    });
    return () => a.stop();
  }, [i, active, r, reduce, fade, drop]);

  const h = w / scene.aspect;
  // pudotus: 0–0.35 kuitti kädessä (pieni heilahdus), 0.35–0.75 putoaa ämpäriin, 0.75–1 ämpäri "nielaisee"
  const y = drop.interpolate({ inputRange: [0, 0.35, 0.75, 1], outputRange: [scene.hand.y * h, scene.hand.y * h - 4 * k, scene.mouth * h + 14 * k, scene.mouth * h + 22 * k] });
  const rot = drop.interpolate({ inputRange: [0, 0.18, 0.35, 0.75], outputRange: ['0deg', '-6deg', '4deg', '-8deg'] });
  const op = drop.interpolate({ inputRange: [0, 0.08, 0.7, 0.82], outputRange: [0, 1, 1, 0] });

  return (
    <View>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ width: '100%', aspectRatio: scene.aspect }} accessible accessibilityRole="image" accessibilityLabel="Per Tieeri lajittelee kuitteja kolmeen ämpäriin: pakolliset ja säännölliset, pakolliset ja epäsäännölliset sekä arjen lipsuvat menot.">
        {/* Kaikki kolme kuvaa ladataan heti ja pidetään päällekkäin: vaihto on välitön eikä kuva välähdä tyhjänä. */}
        <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: fade }}>
          {(Object.keys(SCENES) as Basket[]).map((b) => (
            <Image key={b} source={SCENES[b].img} style={{ position: 'absolute', width: '100%', height: '100%', opacity: SCENES[b] === scene ? 1 : 0 }} resizeMode="contain" />
          ))}
        </Animated.View>
        {w > 0 && r && !reduce && (
          <Animated.View pointerEvents="none" style={{ position: 'absolute', left: scene.hand.x * w - 16 * k, top: 0, opacity: op, transform: [{ translateY: y }, { rotate: rot }] }}>
            <Svg width={32 * k} height={44 * k} viewBox="0 0 32 44">
              <Rect x={2} y={2} width={28} height={40} rx={2} fill="#fff" stroke="#175636" strokeWidth={2.4} />
              <Path d="M8 12h16M8 18h16M8 24h12M8 30h16" stroke="#175636" strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </Animated.View>
        )}
      </View>
      {/* PROSESSI korien alla: jokaisen ämpärin alle kertyvät siihen lajitellut oikeat kulut (ei nousevaa tekstiä) */}
      {r ? (
        <View style={{ flexDirection: 'row', gap: 8 * k, paddingTop: 6 * k, paddingBottom: 10 * k }}>
          {(['regular', 'irregular', 'slipping'] as Basket[]).map((bk) => {
            const done = receipts.slice(0, i + 1).filter((x) => x.basket === bk);
            return (
              <View key={bk} style={{ flex: 1, minHeight: 96 * k, gap: 5 * k }}>
                {done.map((x) => {
                  const now = x.key === r.key;
                  return (
                    <View key={x.key} style={{ borderRadius: 8 * k, paddingVertical: 5 * k, paddingHorizontal: 7 * k, backgroundColor: now ? C.greenDark : C.mint }}>
                      <Text numberOfLines={2} style={{ fontSize: 15 * k, lineHeight: 19 * k, fontWeight: '600', color: now ? '#fff' : C.text }}>{x.label}</Text>
                      <Text style={{ fontSize: 15 * k, fontWeight: '700', color: now ? '#fff' : C.greenText }}>{eur0(x.amount)} · {fmtDay(x.date)}{x.date.slice(0, 4)}</Text>
                      <Text style={{ fontSize: 14 * k, fontWeight: '600', color: now ? '#DDF3E4' : C.sub }}>{x.pattern}</Text>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={{ fontSize: 18 * k, color: C.sub, textAlign: 'center', paddingVertical: 12 * k }}>Ämpärit odottavat tilitapahtumianne</Text>
      )}
    </View>
  );
}
