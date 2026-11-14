import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing } from 'react-native';

/** Runs once per dataset/replay, never loops or changes the underlying financial values. */
export function useChartAnimation(dataKey: string) {
  const [progress] = useState(() => new Animated.Value(1));
  const [replay, setReplay] = useState(0);
  const [reduced, setReduced] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduced(value); });
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    const state = AppState.addEventListener('change', value => {
      if (value !== 'active') { progress.stopAnimation(); progress.setValue(1); }
    });
    return () => { mounted = false; motion.remove(); state.remove(); };
  }, [progress]);
  useEffect(() => {
    if (reduced !== false) { progress.setValue(1); return; }
    progress.setValue(0);
    const animation = Animated.sequence([
      Animated.delay(300),
      Animated.timing(progress, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [dataKey, replay, reduced, progress]);
  return { progress, replay: () => setReplay(value => value + 1), reduced };
}
