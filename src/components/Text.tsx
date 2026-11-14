import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
} from '@expo-google-fonts/figtree';
import React from 'react';
import { Text as RNText, TextInput as RNTextInput, StyleSheet, TextProps, TextStyle } from 'react-native';

/**
 * S-mobiili käyttää S-ryhmän omaa S Bonus -fonttia, joka ei ole vapaasti saatavilla.
 * Figtree on lähin vapaa vastine: geometrinen, pyöreähkö groteski, samat leveät numerot.
 *
 * Kaikki sovelluksen tekstit kulkevat tämän komponentin kautta: fontWeight muutetaan
 * oikeaksi fonttiperheeksi (Androidilla fontWeight ei valitse custom-fontin leikkausta).
 */
export const FONT_MAP = {
  'Figtree-400': Figtree_400Regular,
  'Figtree-500': Figtree_500Medium,
  'Figtree-600': Figtree_600SemiBold,
  'Figtree-700': Figtree_700Bold,
  'Figtree-800': Figtree_800ExtraBold,
};

function family(weight: TextStyle['fontWeight']) {
  const w = weight === 'bold' ? 700 : weight === 'normal' || weight == null ? 400 : Number(weight);
  if (w >= 800) return 'Figtree-800';
  if (w >= 700) return 'Figtree-700';
  if (w >= 600) return 'Figtree-600';
  if (w >= 500) return 'Figtree-500';
  return 'Figtree-400';
}

function fontStyle(style: TextProps['style'], inherit: boolean) {
  const flat = StyleSheet.flatten(style) || {};
  // sisäkkäinen teksti ilman omaa painoa perii fontin vanhemmalta
  if (inherit && flat.fontWeight == null && flat.fontFamily == null) return style;
  if (flat.fontFamily && !flat.fontFamily.startsWith('Figtree')) return style;
  return [style, { fontFamily: family(flat.fontWeight), fontWeight: 'normal' as const }];
}

const InText = React.createContext(false);

// React 19: ref kulkee tavallisena propsina, joten forwardRefiä ei tarvita
export function Text(props: React.ComponentProps<typeof RNText>) {
  const inside = React.useContext(InText);
  const el = <RNText {...props} style={fontStyle(props.style, inside)} />;
  return inside ? el : <InText.Provider value={true}>{el}</InText.Provider>;
}

export function TextInput(props: React.ComponentProps<typeof RNTextInput>) {
  return <RNTextInput {...props} style={fontStyle(props.style, false)} />;
}
