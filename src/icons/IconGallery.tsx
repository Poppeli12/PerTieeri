import React from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from '../components/Text';
import { C } from '../theme';
import { ICONS } from './registry';

/** Kehitystyökalu: kaikki rekisterin ikonit ruudukossa (web: http://localhost:8101/?ikonit) */
export function IconGallery() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.mint }} contentContainerStyle={{ padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {Object.entries(ICONS).map(([name, I]) => (
        <View key={name} style={{ width: 88, height: 88, backgroundColor: '#fff', borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <I size={34} />
          <Text style={{ fontSize: 11, color: C.sub }}>{name}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
