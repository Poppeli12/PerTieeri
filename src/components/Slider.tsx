import React, { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';
import { C } from '../theme';

/** Kevyt liukusäädin ilman natiiviriippuvuuksia (toimii myös webissä) */
export function Slider({
  value,
  min = 0,
  max = 100,
  step = 5,
  onChange,
  onEnd,
  color = C.greenDark,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  onEnd?: (v: number) => void;
  color?: string;
}) {
  const [w, setW] = useState(1);
  const wRef = useRef(1);
  const startX = useRef(0);
  const last = useRef(value);
  const cb = useRef({ onChange, onEnd, min, max, step });
  useEffect(() => { cb.current = { onChange, onEnd, min, max, step }; last.current = value; }, [onChange, onEnd, min, max, step, value]);
  const set = (x: number) => {
    const ratio = Math.max(0, Math.min(1, x / wRef.current));
    const { min, max, step } = cb.current;
    const v = Math.max(min, Math.min(max, Math.round((min + ratio * (max - min)) / step) * step));
    if (v !== last.current) {
      last.current = v;
      cb.current.onChange(v);
    }
  };
  // PanResponder stores these handlers; it does not invoke them during creation.
  // Ref reads below happen only in gesture events, not in the lazy initializer.
  // eslint-disable-next-line react-hooks/refs
  const [pr] = useState(() => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        startX.current = e.nativeEvent.locationX;
        set(startX.current);
      },
      onPanResponderMove: (_, g) => set(startX.current + g.dx),
      onPanResponderRelease: () => cb.current.onEnd?.(last.current),
    }));
  const pct = (value - min) / (max - min);
  return (
    <View
      style={s.hit}
      onLayout={(e: LayoutChangeEvent) => {
        wRef.current = e.nativeEvent.layout.width;
        setW(e.nativeEvent.layout.width);
      }}
      {...pr.panHandlers}
    >
      <View style={s.track} pointerEvents="none">
        <View style={[s.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
      <View pointerEvents="none" style={[s.thumb, { left: pct * w - 13, borderColor: color }]} />
    </View>
  );
}

const s = StyleSheet.create({
  hit: { height: 34, justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, backgroundColor: C.mint2, overflow: 'hidden' },
  fill: { height: 6 },
  thumb: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    borderWidth: 3,
    top: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
