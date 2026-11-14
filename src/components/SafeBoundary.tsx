import React from 'react';
import { View } from 'react-native';
import { C } from '../theme';
import { Text } from './Text';

/**
 * Yksittäisen viestin tai kortin virhe ei saa kaataa koko chattia eikä heittää käyttäjää ulos.
 * Virheen sattuessa näytetään kohtelias korvaava rivi, muu keskustelu jatkuu normaalisti.
 */
export class SafeBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn('Per Tieeri: näkymän osa ohitettiin virheen vuoksi', error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginHorizontal: 12 }}>
        <Text style={{ fontSize: 17, color: C.sub }}>Tätä kuvaa ei saatu näytettyä. Keskustelu jatkuu normaalisti.</Text>
      </View>
    );
  }
}
