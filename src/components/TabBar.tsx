import React, { useEffect, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../theme';
import { HomeIcon, PersonIcon, PlusIcon, SIcon, WalletIcon } from '../icons';
import { PerTieeriTabIcon } from './PerTieeriTabIcon';
import { useK } from './scale';

export type Tab = 'home' | 'card' | 'agent' | 'bank' | 'me';

type Props = { active: Tab; onTab: (t: Tab) => void; onPlus: () => void; plusOpen: boolean; unread: number };

/**
 * S-mobiilin alapalkki + uusi Tuki-nappi: Koti · S-Etukortti · (+) Maksu · Tuki · Pankki · Minä.
 * Kaikki mitat ovat referenssikuvakaappauksen pikseleitä (leveys 591) kerrottuna k:lla,
 * joten suhteet pysyvät samoina kaikilla näytöillä. Kuusi yhtä leveää saraketta;
 * (+) ja Tuki ovat vierekkäin keskellä samankokoisina pyöreinä nappeina.
 */
const R = {
  bar: 95, // palkin korkeus
  icon: 29, // kuvakkeen koko (6 saraketta → hieman pienempi kuin 5 sarakkeen 31)
  iconY: 30, // kuvakkeen keskipiste palkin yläreunasta
  labelY: 64, // tekstin keskipiste palkin yläreunasta
  label: 15.5, // fonttikoko (6 saraketta)
  big: 76, // ison pyöreän napin halkaisija
  bigY: 12, // ison napin keskipiste palkin yläreunasta
  plus: 26,
};

const INACTIVE = '#5B605D';
const ACTIVE_ICON = '#22A34A';

export function TabBar({ active, onTab, onPlus, plusOpen, unread }: Props) {
  const insets = useSafeAreaInsets();
  const k = useK();
  const [rot] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));
  const agentOn = active === 'agent';
  const [agentRot] = useState(() => new Animated.Value(agentOn ? 1 : 0));

  useEffect(() => {
    const animation = Animated.timing(agentRot, { toValue: agentOn ? 1 : 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [agentOn, agentRot]);

  useEffect(() => {
    Animated.timing(rot, { toValue: plusOpen ? 1 : 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [plusOpen, rot]);

  // hillitty "uusia havaintoja" -pulssi Tuki-napin ympärillä
  useEffect(() => {
    if (!unread || active === 'agent') {
      pulse.setValue(0);
      return;
    }
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(2200),
      ]),
    );
    a.start();
    return () => a.stop();
  }, [unread, active, pulse]);

  const big = R.big * k;
  const bigTop = (R.bigY - R.big / 2) * k; // negatiivinen: nousee palkin yläpuolelle
  const iconTop = (R.iconY - R.icon / 2) * k;
  const labelStyle = { fontSize: R.label * k, lineHeight: R.label * k * 1.25, top: R.labelY * k - (R.label * k * 1.25) / 2 };

  const slot = (key: string, label: React.ReactNode, onPress: () => void, children: React.ReactNode, a11y: string, selected?: boolean) => (
    <Pressable key={key} style={s.slot} onPress={onPress} accessibilityRole="tab" accessibilityLabel={a11y} accessibilityState={{ selected: !!selected }}>
      {children}
      {label}
    </Pressable>
  );

  const item = (key: Tab, label: string, icon: (c: string, on: boolean) => React.ReactNode) => {
    const on = active === key;
    return slot(
      key,
      <Text style={[s.label, labelStyle, { color: on ? C.text : INACTIVE, fontWeight: on ? '700' : '400' }]} numberOfLines={1}>
        {label}
      </Text>,
      () => onTab(key),
      <View style={[s.iconBox, { top: iconTop, height: R.icon * k }]}>{icon(on ? ACTIVE_ICON : INACTIVE, on)}</View>,
      label,
      on,
    );
  };

  const bigStyle = { width: big, height: big, borderRadius: big / 2, top: bigTop };

  return (
    <View style={[s.bar, { height: R.bar * k + insets.bottom, paddingBottom: insets.bottom }]}>
      {item('home', 'Koti', (c, on) => <HomeIcon size={R.icon * k} color={c} filled={on} />)}
      {item('card', 'S-Etukortti', (c) => <SIcon size={R.icon * k} color={c} />)}

      {/* Maksu (+) */}
      {slot(
        'pay',
        <Text style={[s.label, labelStyle, { color: INACTIVE }]}>Maksu</Text>,
        onPlus,
        <Animated.View
          style={[
            s.big,
            bigStyle,
            { backgroundColor: plusOpen ? C.gray : C.greenDark, transform: [{ rotate: rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }] },
          ]}
        >
          <PlusIcon size={R.plus * k} />
        </Animated.View>,
        'Maksu',
      )}

      {/* Tuki = Per Tieeri -talousvalmentaja */}
      <Pressable
        style={s.slot}
        onPress={() => onTab('agent')}
        accessibilityRole="tab"
        accessibilityLabel="Tuki – Per Tieeri, talousvalmentaja"
        accessibilityState={{ selected: agentOn }}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            s.big,
            bigStyle,
            s.pulse,
            {
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }],
            },
          ]}
        />
        <Animated.View style={[s.big, bigStyle, {
          backgroundColor: agentOn ? C.greenDark : C.gray,
          transform: [
            { rotate: agentRot.interpolate({ inputRange: [0, 1], outputRange: ['45deg', '0deg'] }) },
          ],
        }]}>
          <PerTieeriTabIcon size={big} color={agentOn ? C.greenDark : C.gray} />
        </Animated.View>
        {unread > 0 && !agentOn && (
          <View style={[s.badge, { top: bigTop - 2, left: '50%', marginLeft: big / 2 - 14 }]}>
            <Text style={s.badgeText}>{unread}</Text>
          </View>
        )}
        <Text style={[s.label, labelStyle, { color: C.greenDark, fontWeight: agentOn ? '700' : '400' }]} numberOfLines={1}>
          Tuki
        </Text>
      </Pressable>

      {item('bank', 'Pankki', (c, on) => <WalletIcon size={R.icon * k} color={c} filled={on} />)}
      {item('me', 'Minä', (c, on) => <PersonIcon size={R.icon * k} color={c} filled={on} />)}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: C.white,
    ...Platform.select({
      web: { boxShadow: '0 -1px 6px rgba(0,0,0,0.07)' },
      default: { shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 6, shadowOffset: { width: 0, height: -1 }, elevation: 8 },
    }),
  },
  slot: { flex: 1, alignItems: 'center' },
  iconBox: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
  label: { position: 'absolute', left: 0, right: 0, textAlign: 'center', letterSpacing: 0.1 },
  big: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: C.greenDark,
  },
  pulse: { backgroundColor: C.green },
  badge: {
    position: 'absolute',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.coral,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
