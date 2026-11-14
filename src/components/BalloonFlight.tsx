import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';

/**
 * Ilmapallot nousevat, kun käyttäjä lähettää viestin – viesti "lähtee leijailemaan" Per Tieerille.
 * Ripeä mutta rauhallinen nousu alhaalta näytön yläreunaan, pieni sivuttaisheilunta, katoaa ylhäällä.
 */
export function BalloonFlight({ height, size, onDone }: { height: number; size: number; onDone: () => void }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 2300, easing: Easing.bezier(0.3, 0.05, 0.4, 1), useNativeDriver: true }).start(() => onDone());
  }, [v, onDone]);
  const h = size * (517 / 365);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={{
          position: 'absolute',
          right: size * 0.35,
          bottom: 0,
          opacity: v.interpolate({ inputRange: [0, 0.08, 0.8, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -(height + h * 0.2)] }) },
            { translateX: v.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -10, 4, -8, 0] }) },
            { rotate: v.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['0deg', '-4deg', '3deg', '-3deg', '0deg'] }) },
          ],
        }}
      >
        <Image source={require('../../assets/per-tieeri/ilmapallot.png')} style={{ width: size, height: h }} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}
