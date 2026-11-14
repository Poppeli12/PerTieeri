import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';

/**
 * Sivunvaihtoanimaatiot – nopeat ja pehmeät (natiivi ajuri, ei JS-säiettä):
 *  - TabScene: välilehden vaihto → sisältö häivyttyy esiin ja nousee 8 px (190 ms, ease-out)
 *  - SlideScreen: alisivu liukuu oikealta sisään ja takaisin ulos (260 ms / 220 ms),
 *    alla oleva näkymä himmenee kevyesti
 */
const EASE_OUT = Easing.bezier(0.2, 0.8, 0.2, 1); // "premium" hidastuva loppu
const EASE_IN = Easing.bezier(0.4, 0, 1, 1);

export function TabScene({ children }: { children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 190, easing: EASE_OUT, useNativeDriver: true }).start();
  }, [v]);
  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }),
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Alisivu, joka pysyy asennettuna ulosliu'un ajan. `open`=false → liukuu ulos ja poistuu.
 * `render` saa viimeksi avatun avaimen, jotta sisältö ei katoa kesken animaation.
 */
export function SlideScreen<T extends string>({ value, render, top = 0 }: { value: T | null; render: (v: T) => React.ReactNode; top?: number }) {
  const { width } = useWindowDimensions();
  const w = Math.min(width, 430);
  const v = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState<T | null>(value);

  useEffect(() => {
    if (value) {
      setShown(value);
      v.setValue(0);
      Animated.timing(v, { toValue: 1, duration: 260, easing: EASE_OUT, useNativeDriver: true }).start();
    } else if (shown) {
      Animated.timing(v, { toValue: 0, duration: 220, easing: EASE_IN, useNativeDriver: true }).start(({ finished }) => finished && setShown(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!shown) return null;
  return (
    <>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { top, backgroundColor: '#000', opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0, 0.18] }) }]} />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { top, backgroundColor: '#fff', transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [w, 0] }) }] },
          { boxShadow: '-6px 0 18px rgba(0,0,0,0.12)' },
        ]}
      >
        {render(shown)}
      </Animated.View>
    </>
  );
}
