import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

/** One short sideways transition; repeated taps cannot skip pages. */
export function useSlideTransition() {
  const [offset] = useState(() => new Animated.Value(0));
  const [busy, setBusy] = useState(false);
  const moving = useRef(false);
  const reduced = useRef(true);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) reduced.current = value; }).catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { reduced.current = value; });
    return () => { mounted = false; listener.remove(); offset.stopAnimation(); };
  }, [offset]);

  const slide = (direction: number, change: () => void) => {
    if (moving.current) return;
    if (reduced.current) { change(); return; }
    moving.current = true;
    setBusy(true);
    Animated.timing(offset, { toValue: -direction, duration: 110, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(({ finished }) => {
      if (!finished) return;
      offset.setValue(direction);
      change();
      Animated.timing(offset, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(({ finished: arrived }) => {
        if (!arrived) return;
        moving.current = false;
        setBusy(false);
      });
    });
  };
  return { slide, busy, style: {
    opacity: offset.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }),
    transform: [{ translateX: offset.interpolate({ inputRange: [-1, 0, 1], outputRange: [-60, 0, 60] }) }],
  } };
}
