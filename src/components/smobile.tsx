import React from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { C } from '../theme';
import { ChatIcon, Chevron } from '../icons';
import { useK } from './scale';
import { Text } from './Text';

/**
 * S-mobiilin rakennuspalikat. Kaikki mitat ovat referenssikuvakaappausten pikseleitä
 * (leveys 591 px, ks. design/REFERENCE.md) kerrottuna k:lla, joten suhteet säilyvät.
 *
 *  - sivun tausta: minttu C.mint, kortit: valkoinen, pyöristys 16, ei varjoa, sivumarginaali 31
 *  - osio-otsikko: 29 px, lihava, tummanvihreä C.greenText
 *  - leipäteksti: 25 px, musta · alateksti 18 px, harmaa
 *  - kuvakkeet: vihreät ääriviivat C.icon, 30 px
 */
export const SM = {
  margin: 31,
  radius: 16,
  heading: 30,
  body: 25,
  sub: 18,
  icon: 30,
  row: 92,
};

export function SCard({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const k = useK();
  const base: ViewStyle = { marginHorizontal: SM.margin * k, borderRadius: SM.radius * k, backgroundColor: C.white, overflow: 'hidden' };
  if (onPress)
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [base, style, pressed && { opacity: 0.75 }]}>
        {children}
      </Pressable>
    );
  return <View style={[base, style]}>{children}</View>;
}

/** Osio-otsikko, valinnainen oikean reunan linkki ("Avaa") */
export function SHeading({ children, link, onLink, top = 34 }: { children: React.ReactNode; link?: string; onLink?: () => void; top?: number }) {
  const k = useK();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: SM.margin * k, marginTop: top * k, marginBottom: 32 * k }}>
      <Text style={{ fontSize: SM.heading * k, lineHeight: SM.heading * k * 1.3, fontWeight: '700', color: C.greenText, letterSpacing: -0.1 }}>{children}</Text>
      {link ? (
        <Pressable onPress={onLink} hitSlop={10}>
          <Text style={{ fontSize: 22 * k, color: C.greenText, fontWeight: '500' }}>{link}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Listarivi: vihreä kuvake · otsikko (+ alateksti) · oikea arvo · nuoli */
export function SRow({
  icon,
  title,
  sub,
  right,
  onPress,
  last,
  chevron = true,
  titleStyle,
}: {
  icon?: React.ReactNode;
  title: string;
  sub?: string;
  right?: string;
  onPress?: () => void;
  last?: boolean;
  chevron?: boolean;
  titleStyle?: any;
}) {
  const k = useK();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ minHeight: SM.row * k }, pressed && onPress && { backgroundColor: '#F4F7F5' }]}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 26 * k, paddingRight: 22 * k, paddingVertical: (sub ? 28 : 22) * k }}>
        {icon ? <View style={{ width: SM.icon * k, marginRight: 20 * k, alignItems: 'center' }}>{icon}</View> : null}
        <View style={{ flex: 1 }}>
          <Text style={[{ fontSize: SM.body * k, lineHeight: SM.body * k * 1.28, color: C.text, fontWeight: '500' }, titleStyle]}>{title}</Text>
          {sub ? <Text style={{ fontSize: 22 * k, lineHeight: 30 * k, color: C.sub, marginTop: 2 * k }}>{sub}</Text> : null}
        </View>
        {right ? <Text style={{ fontSize: 22 * k, color: C.text, marginLeft: 10 * k }}>{right}</Text> : null}
        {chevron ? (
          <View style={{ marginLeft: 12 * k }}>
            <Chevron size={26 * k} color="#1E1E1E" />
          </View>
        ) : null}
      </View>
      {!last && <View style={{ height: 1.5 * k, backgroundColor: C.divider, marginLeft: 26 * k, marginRight: 22 * k }} />}
    </Pressable>
  );
}

/** Valkoinen yläpalkki: otsikko keskellä, viestikuvake oikealla (Pankki, Minä) */
export function SHeader({ title, left, onChat }: { title: string; left?: React.ReactNode; onChat?: () => void }) {
  const k = useK();
  return (
    <View style={{ height: 80 * k, backgroundColor: C.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', left: 37 * k }}>{left}</View>
      <Text style={{ fontSize: 24 * k, fontWeight: '600', color: C.text }}>{title}</Text>
      <Pressable onPress={onChat} hitSlop={10} style={{ position: 'absolute', right: 37 * k }}>
        <ChatIcon size={30 * k} color="#1E1E1E" dot />
      </Pressable>
    </View>
  );
}
