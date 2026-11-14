import React, { memo, useEffect, useId, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path } from 'react-native-svg';
import { eur0 } from '../../finance/analytics';
import { Basket } from '../../finance/categories';
import { C } from '../../theme';
import { PT_POSES } from '../perTieeriPoses';
import { Text } from '../Text';
import { BucketBack, BucketFront, INK, ReceiptArt } from './BucketArt';
import { BUCKET_LABELS, BUCKET_ORDER, sortingReceipts } from './receiptSorting';
import { motionFrames, SORT_DURATION } from './sortingMotion';
import { LeftSortingHand, RightSortingHand } from './SortingHands';

const W = 600;
const H = 500;
const AnimatedPath = Animated.createAnimatedComponent(Path);
const portrait = PT_POSES.ristissa;
const bucketTransform = (i: number) => `translate(${6 + i * 200} 252) scale(.94)`;

const DeskBackdrop = memo(function DeskBackdrop() {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
      <G stroke={INK} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" fill="white">
        {/* Original jacket; the arms are separate articulated layers. */}
        <Path d="M266 142L224 157L238 222L231 360H369L360 205L379 174L337 142Z" />
        <Path d="M232 231l10-35M265 145l-24 47 25-3-13 21 29 23M332 145l22 47-25-3 13 21-52 37v107M264 146l34 40 34-40M285 172l13 14 13-14-5 32-8 13-10-14Z" fill="none" />
        {[251, 289, 327].map((y) => <G key={y}><Circle cx={303} cy={y} r={6} /><Circle cx={345} cy={y} r={6} /></G>)}
      </G>
      <Path d="M2 487H598" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      {BUCKET_ORDER.map((basket, i) => <G key={basket} transform={bucketTransform(i)}><BucketBack basket={basket} /></G>)}
    </Svg>
  );
});

const DeskHead = memo(function DeskHead() {
  const headId = `sorting-head-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return <Svg testID="sorting-head" width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
    <Defs><ClipPath id={headId}><Path d="M80 -10H260V91H193L189 99.5H151L147 91H80Z" /></ClipPath></Defs>
    <G stroke={INK} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" fill="white">
      <Path d="M224 157q16-15 34-9l-4 11q-18 7-30-2Zm113-9q18-6 32 10l-3 8q-18 3-30-9Z" />
      <Path d="M226 162l-4 17m12-15-4 19m12-19-3 16m106-17 3 16m4-12 5 14m2-12 6 13" fill="none" />
    </G>
    {/* Face geometry, position and expression are unchanged and never animated. */}
    <G transform="translate(19.5 -2) scale(1.65)">
      <Path d={portrait.silhouette} clipPath={`url(#${headId})`} fill="white" stroke="white" strokeWidth={2} />
      <Path d={portrait.head} fill={INK} fillRule="evenodd" />
      <Path d={portrait.eyes} fill={INK} fillRule="evenodd" />
      <Path d={portrait.stache} fill={INK} fillRule="evenodd" />
    </G>
  </Svg>;
});

/** Default welcome scene: code-only vectors, with receipts occluded by the bucket fronts. */
export function SortingDesk({ months = 6, active = true, selected, onBucketPress }: {
  months?: number;
  active?: boolean;
  selected?: Basket | null;
  onBucketPress?: (basket: Basket) => void;
}) {
  const receipts = useMemo(() => sortingReceipts(months), [months]);
  const [width, setWidth] = useState(0);
  const [turn, setTurn] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [progress] = useState(() => new Animated.Value(0));
  const receipt = receipts[turn % receipts.length];
  const running = active && foreground && reduceMotion === false && !paused && !!receipt;
  const scale = width / W;
  const basket = receipt?.basket ?? 'regular';
  const frames = useMemo(() => motionFrames(basket), [basket]);
  const inputRange = frames.map(frame => frame.t);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (mounted) setReduceMotion(value); });
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const app = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => { mounted = false; motion.remove(); app.remove(); };
  }, []);

  useEffect(() => {
    if (!running || !width) return;
    // Starting with a new receipt is deliberate after resume; no partial drop is counted twice.
    progress.setValue(0);
    const animation = Animated.timing(progress, { toValue: 1, duration: SORT_DURATION, easing: Easing.linear, useNativeDriver: false });
    animation.start(({ finished }) => { if (finished) setTurn((value) => value + 1); });
    return () => animation.stop();
  }, [running, width, turn, progress, receipts]);

  type Frame = typeof frames[number];
  const value = (get: (frame: Frame) => number) => progress.interpolate({ inputRange, outputRange: frames.map(get) });
  const curve = (get: (frame: Frame) => string) => progress.interpolate({ inputRange, outputRange: frames.map(get) });
  const handStyle = (side: 'left' | 'right') => ({ width: 130 * scale, height: 210 * scale, transform: [
    { translateX: value(frame => (frame[side].x - 65) * scale) },
    { translateY: value(frame => (frame[side].y - 105) * scale) },
    { rotate: curve(frame => `${frame[side].angle}deg`) },
  ] });
  const leftStyle = handStyle('left');
  const rightStyle = handStyle('right');

  return (
    <View testID="receipt-sorter">
      <View testID="sorting-scene" style={s.scene} accessible={!onBucketPress} accessibilityRole={onBucketPress ? undefined : 'image'} accessibilityLabel="Per Tieeri lajittelee kuitteja kolmeen pöydällä olevaan ämpäriin: pakolliset ja säännölliset menot, pakolliset ja epäsäännölliset menot sekä arjen lipsuvat menot." onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}><DeskBackdrop /></View>
        {width > 0 && <>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
              {(['leftSleeve', 'rightSleeve'] as const).map(side => <G key={side} stroke={INK} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
                <AnimatedPath d={curve(frame => frame[side].path)} fill="white" />
                <AnimatedPath d={curve(frame => frame[side].crease)} fill="none" strokeWidth={2} />
                <AnimatedPath d={curve(frame => frame[side].band)} fill="white" strokeWidth={2.5} />
              </G>)}
            </Svg>
          </View>
          {/* The remaining receipts stay in the left palm when the front sheet is taken. */}
          <Animated.View pointerEvents="none" style={[s.moving, leftStyle]}>
            <Svg width="100%" height="100%" viewBox="-65 -105 130 210">
              <G transform="translate(-26 -89) rotate(-7)"><ReceiptArt /></G>
              <G transform="translate(-15 -82) rotate(5)"><ReceiptArt /></G>
            </Svg>
          </Animated.View>
          {receipt && <Animated.View testID="sorting-receipt" pointerEvents="none" style={[s.moving, {
            width: 42 * scale, height: 64 * scale,
            opacity: value(frame => frame.paperOpacity),
            transform: [
              { translateX: value(frame => (frame.paperX - 21) * scale) },
              { translateY: value(frame => (frame.paperY - 32) * scale) },
              { rotate: curve(frame => `${frame.paperAngle}deg`) },
            ],
          }]}><Svg width="100%" height="100%" viewBox="0 0 42 64"><ReceiptArt /></Svg></Animated.View>}
          <Animated.View pointerEvents="none" testID="sorting-left-hand" style={[s.moving, leftStyle]}>
            <Svg width="100%" height="100%" viewBox="-65 -105 130 210"><LeftSortingHand open={value(frame => frame.leftOpen)} /></Svg>
          </Animated.View>
          <Animated.View pointerEvents="none" testID="sorting-hand" style={[s.moving, rightStyle]}>
            <Svg width="100%" height="100%" viewBox="-65 -105 130 210"><RightSortingHand open={value(frame => frame.rightOpen)} /></Svg>
          </Animated.View>
        </>}
        <View style={StyleSheet.absoluteFill} pointerEvents="none"><DeskHead /></View>
        {/* Opaque fronts cover a receipt only after it crosses the open rim. */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
            {BUCKET_ORDER.map((basket, i) => <G key={basket} transform={bucketTransform(i)}><BucketFront basket={basket} selected={selected === basket} /></G>)}
          </Svg>
        </View>
        {onBucketPress && <View style={s.bucketButtons}>
          {BUCKET_ORDER.map((basket) => <Pressable key={basket} style={s.bucketButton} accessibilityRole="button" accessibilityLabel={BUCKET_LABELS[basket].join(' ')} accessibilityHint="Näytä tämän ämpärin menot" aria-expanded={selected === basket} onPress={() => onBucketPress(basket)} />)}
        </View>}
      </View>
      <View style={s.caption}>
        <Text style={s.eyebrow}>{receipt ? 'Esimerkkejä omista tilitapahtumistasi' : 'Ämpärit odottavat tilitapahtumiasi'}</Text>
        {receipt && <Text testID="sorting-current" style={s.current} numberOfLines={2}>{receipt.label} · {eur0(receipt.amount)} → {BUCKET_LABELS[receipt.basket].join(' ')}</Text>}
        {receipt && reduceMotion === false && <Pressable accessibilityRole="button" accessibilityLabel={paused ? 'Jatka lajitteluanimaatiota' : 'Keskeytä lajitteluanimaatio'} hitSlop={8} onPress={() => setPaused((value) => !value)} style={s.pause}>
          <Text style={s.pauseText}>{paused ? 'Jatka lajittelua' : 'Keskeytä animaatio'}</Text>
        </Pressable>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  scene: { width: '100%', aspectRatio: W / H, backgroundColor: 'white' },
  moving: { position: 'absolute', left: 0, top: 0 },
  bucketButtons: { position: 'absolute', left: 0, right: 0, top: '63%', bottom: 0, flexDirection: 'row' },
  bucketButton: { flex: 1, borderRadius: 12 },
  caption: { alignItems: 'center', paddingHorizontal: 12, paddingTop: 6, paddingBottom: 12 },
  eyebrow: { color: C.sub, fontSize: 11, textAlign: 'center' },
  current: { color: C.greenText, fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 5, minHeight: 32 },
  pause: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14 },
  pauseText: { color: C.greenText, fontSize: 12, textDecorationLine: 'underline' },
});
