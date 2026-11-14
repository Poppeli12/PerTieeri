import React, { useEffect, useState } from 'react';
import { Animated, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Text } from './Text';
import { C, radius, shadow } from '../theme';
import { Chevron } from '../icons';

export function Card({ children, style, pad = true }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; pad?: boolean }) {
  return <View style={[u.card, pad && { padding: 16 }, style]}>{children}</View>;
}

export function H2({ children, style }: { children: React.ReactNode; style?: any }) {
  return <Text style={[u.h2, style]}>{children}</Text>;
}

export function Row({
  icon,
  title,
  sub,
  right,
  onPress,
  last,
  big,
}: {
  icon?: React.ReactNode;
  title: string;
  sub?: string;
  right?: string;
  onPress?: () => void;
  last?: boolean;
  big?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [u.row, !last && u.rowLine, pressed && { opacity: 0.6 }]}>
      {icon && <View style={u.rowIcon}>{icon}</View>}
      <View style={{ flex: 1 }}>
        <Text style={[u.rowTitle, big && { fontSize: 20 }]}>{title}</Text>
        {sub ? <Text style={u.rowSub}>{sub}</Text> : null}
      </View>
      {right ? <Text style={u.rowRight}>{right}</Text> : null}
      <Chevron color="#555" />
    </Pressable>
  );
}

export function Chip({ label, onPress, dark }: { label: string; onPress: () => void; dark?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [u.chip, dark && u.chipDark, pressed && { transform: [{ scale: 0.97 }], opacity: 0.85 }]}>
      <Text style={[u.chipText, dark && { color: '#fff' }]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

export function GreenButton({ label, onPress, disabled, ghost }: { label: string; onPress: () => void; disabled?: boolean; ghost?: boolean }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [u.btn, ghost && u.btnGhost, disabled && { opacity: 0.4 }, pressed && { opacity: 0.8 }]}
    >
      <Text style={[u.btnText, ghost && { color: C.greenDark }]}>{label}</Text>
    </Pressable>
  );
}

/** Kevyt sisääntuloanimaatio (fade + nousu) */
export function FadeIn({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 320, delay, useNativeDriver: true }).start();
  }, [v, delay]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** Teksti, jossa **lihavointi** tuetaan */
export function Rich({ text, style, numberOfLines }: { text: string; style?: any; numberOfLines?: number }) {
  // **lihava**; *kursiivi* vain kun tähdet ovat sanan rajoilla (ei esim. "PAYSRV*7731")
  const parts = text.split(/(\*\*[^*\n]+\*\*|(?<![\w*])\*(?![\s*])[^*\n]+?(?<!\s)\*(?![\w*]))/g);
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((p, i) =>
        p.startsWith('**') ? (
          <Text key={i} style={{ fontWeight: '800' }}>
            {p.slice(2, -2)}
          </Text>
        ) : p.startsWith('*') && p.length > 2 ? (
          <Text key={i} style={{ fontStyle: 'italic' }}>
            {p.slice(1, -1)}
          </Text>
        ) : (
          p
        ),
      )}
    </Text>
  );
}

export const u = StyleSheet.create({
  card: { backgroundColor: C.white, borderRadius: radius.card, ...shadow },
  h2: { fontSize: 22, fontWeight: '800', color: C.greenText, letterSpacing: -0.3 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 16, gap: 12 },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D8DDD9' },
  rowIcon: { width: 32, alignItems: 'center' },
  rowTitle: { fontSize: 17, color: C.text },
  rowSub: { fontSize: 13.5, color: C.sub, marginTop: 2 },
  rowRight: { fontSize: 16, color: C.sub, marginRight: 4 },
  chip: {
    backgroundColor: C.white,
    borderColor: C.greenDark,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    maxWidth: 280,
  },
  chipDark: { backgroundColor: C.greenDark },
  chipText: { color: C.greenDark, fontWeight: '700', fontSize: 14 },
  btn: { backgroundColor: C.greenDark, borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: C.greenDark },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16.5 },
});
