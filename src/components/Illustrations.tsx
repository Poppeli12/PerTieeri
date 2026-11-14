import React, { useEffect, useState } from 'react';
import { Animated, Easing, Image, Pressable, View } from 'react-native';
import { C } from '../theme';
import { CloseIcon } from '../icons';
import { useK } from './scale';
import { Text } from './Text';

/** S-Pankin tyyliset kuvitukset (design/reference/kuvitukset → assets/per-tieeri, scripts/clean-illustrations.py) */
export const ILLUSTRATIONS = {
  suurennuslasi: { img: require('../../assets/per-tieeri/suurennuslasi.png'), aspect: 360 / 295 },
  ajatuskupla: { img: require('../../assets/per-tieeri/ajatuskupla.png'), aspect: 236 / 401 },
  kasvu: { img: require('../../assets/per-tieeri/kasvu.png'), aspect: 368 / 315 },
  kalenteri: { img: require('../../assets/per-tieeri/kalenteri.png'), aspect: 379 / 264 },
  budjettirengas: { img: require('../../assets/per-tieeri/budjettirengas.png'), aspect: 558 / 269 },
  ilmoitus: { img: require('../../assets/per-tieeri/ilmoitus.png'), aspect: 606 / 357 },
  pylvaat: { img: require('../../assets/per-tieeri/pylvaat.png'), aspect: 460 / 353 },
  donitsi: { img: require('../../assets/per-tieeri/donitsi.png'), aspect: 490 / 337 },
  lompakko: { img: require('../../assets/per-tieeri/lompakko.png'), aspect: 435 / 419 },
  ennuste: { img: require('../../assets/per-tieeri/ennuste.png'), aspect: 502 / 291 },
  selviytymisaika: { img: require('../../assets/per-tieeri/selviytymisaika.png'), aspect: 415 / 404 },
  mitajos: { img: require('../../assets/per-tieeri/mitajos.png'), aspect: 489 / 322 },
  sataruutua: { img: require('../../assets/per-tieeri/sataruutua.png'), aspect: 506 / 384 },
  tilaukset: { img: require('../../assets/per-tieeri/tilaukset.png'), aspect: 448 / 457 },
  muutosetsiva: { img: require('../../assets/per-tieeri/muutosetsiva.png'), aspect: 514 / 513 },
  budjetti: { img: require('../../assets/per-tieeri/budjetti.png'), aspect: 480 / 433 },
};
/**
 * Ilmoitus muille sivuille, kun Per Tieerillä on asiaa: kuva liukuu esiin, kello-osa heilahtaa kevyesti,
 * nappi vie suoraan keskusteluun. Voi sulkea.
 */
export function AgentNudge({ count, onOpen, onClose }: { count: number; onOpen: () => void; onClose: () => void }) {
  const k = useK();
  const v = useState(() => new Animated.Value(0))[0];
  const wiggle = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 420, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }).start();
    const a = Animated.loop(
      Animated.sequence([
        Animated.delay(1600),
        Animated.timing(wiggle, { toValue: 1, duration: 140, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: -1, duration: 160, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: 0.6, duration: 140, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: 0, duration: 160, useNativeDriver: true }),
      ]),
    );
    a.start();
    return () => a.stop();
  }, [v, wiggle]);
  const it = ILLUSTRATIONS.ilmoitus;
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: 20 * k,
        right: 20 * k,
        bottom: 14 * k,
        backgroundColor: '#fff',
        borderRadius: 18 * k,
        padding: 16 * k,
        flexDirection: 'row',
        alignItems: 'center',
        boxShadow: '0 6px 22px rgba(0,60,30,0.18)',
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [40 * k, 0] }) }],
      }}
    >
      <Animated.View style={{ transform: [{ rotate: wiggle.interpolate({ inputRange: [-1, 1], outputRange: ['-3deg', '3deg'] }) }] }}>
        <Image source={it.img} style={{ height: 92 * k, width: 92 * k * it.aspect }} resizeMode="contain" />
      </Animated.View>
      <View style={{ flex: 1, marginLeft: 12 * k }}>
        <Text style={{ fontSize: 19 * k, fontWeight: '700', color: C.text }}>Per Tieerillä on teille asiaa</Text>
        <Text style={{ fontSize: 16 * k, color: C.sub, marginTop: 2 * k }}>{count > 1 ? `${count} huomiota taloudestanne` : 'Uusi huomio taloudestanne'}</Text>
        <Pressable onPress={onOpen} style={({ pressed }) => [{ alignSelf: 'flex-start', marginTop: 10 * k, backgroundColor: C.greenDark, borderRadius: 999, paddingVertical: 10 * k, paddingHorizontal: 18 * k }, pressed && { opacity: 0.8 }]}>
          <Text style={{ color: '#fff', fontSize: 17 * k, fontWeight: '700' }}>Avaa keskustelu</Text>
        </Pressable>
      </View>
      <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Sulje ilmoitus" style={{ position: 'absolute', top: 10 * k, right: 10 * k }}>
        <CloseIcon size={22 * k} color="#6B6B6B" />
      </Pressable>
    </Animated.View>
  );
}
