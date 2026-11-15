import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, UIManager, useWindowDimensions, View } from 'react-native';
import { FRAME_H, FRAME_W, useFramed } from './src/components/scale';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Tab, TabBar } from './src/components/TabBar';
import { FONT_MAP, Text } from './src/components/Text';
import { SlideScreen, TabScene } from './src/components/Transitions';
import { IconGallery } from './src/icons/IconGallery';
import { AgentNudge } from './src/components/Illustrations';
import { anomalies } from './src/finance/analytics';
import { AgentScreen } from './src/screens/AgentScreen';
import { CustomerPicker } from './src/screens/CustomerPicker';
import { CardDetailScreen, PayeeScreen } from './src/screens/BankDetail';
import { BankScreen, CardScreen, HomeScreen, MeScreen, PaySheet } from './src/screens/OtherScreens';
import { StoreProvider, useStore } from './src/state/store';
import { C } from './src/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function Shell() {
  const st = useStore();
  const [fontsLoaded, fontError] = useFonts(FONT_MAP);
  const insets = useSafeAreaInsets();
  // Sovellus aukeaa aina Minä-sivulle (asiakkaan valinta ja profiili ensimmäisenä)
  const [tab, setTab] = useState<Tab>('me');
  const [plus, setPlus] = useState(false);
  // suljettu/avattu asiakaskohtaisesti: uusi asiakas → ilmoitus voi näkyä taas
  const [nudgeClosedFor, setNudgeClosedFor] = useState<string | null>(null);
  const nudgeClosed = nudgeClosedFor === st.customerId;
  const setNudgeClosed = (v: boolean) => setNudgeClosedFor(v ? st.customerId : null);
  // Per Tieerillä on asiaa, kun asiakkaan datassa on oikeita huomioita (poikkeamat) eikä keskustelua ole vielä avattu
  const insights = st.ready ? anomalies(st.answers).length : 0;
  if (tab === 'agent' && !nudgeClosed) setNudgeClosed(true);
  // alinäkymät, jotka peittävät myös alapalkin (kuten S-mobiilissa)
  const [sub, setSub] = useState<null | 'card' | 'payee' | 'picker'>(null);

  const openAgent = (q?: string) => {
    setPlus(false);
    setTab('agent');
    if (q) st.send(q);
  };

  if (!st.ready || st.switching || (!fontsLoaded && !fontError))
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={C.greenDark} />
      </View>
    );

  if (st.loadError) return (
    <SafeAreaView style={[s.root, { justifyContent: 'center', padding: 24, gap: 20 }]}>
      <Text style={{ fontSize: 24, fontWeight: '700', color: C.greenDark }}>Asiakastietoja ei saatu ladattua</Text>
      <Text style={{ fontSize: 18, lineHeight: 26 }}>Asiakkaan {st.customerId} taloustiedot eivät ole nyt saatavilla. Tarkista yhteys ja yritä uudelleen.</Text>
      <Pressable accessibilityRole="button" onPress={() => st.setCustomer(st.customerId)} style={{ padding: 18, backgroundColor: C.greenDark, borderRadius: 12 }}>
        <Text style={{ color: 'white', fontSize: 18, textAlign: 'center' }}>Yritä uudelleen</Text>
      </Pressable>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      <StatusBar style={tab === 'agent' || tab === 'card' || plus || sub === 'payee' ? 'light' : 'dark'} />
      <View style={{ flex: 1 }}>
        <TabScene key={`${tab}-${st.customerId}`}>
          {tab === 'home' && <HomeScreen openAgent={openAgent} />}
          {tab === 'card' && <CardScreen />}
          {tab === 'agent' && <AgentScreen />}
          {tab === 'bank' && <BankScreen openAgent={openAgent} openCard={() => setSub('card')} openPay={() => setSub('payee')} />}
          {tab === 'me' && <MeScreen openPicker={() => setSub('picker')} />}
        </TabScene>
        {tab !== 'agent' && !plus && !nudgeClosed && insights > 0 && (
          <AgentNudge count={insights} onOpen={() => openAgent()} onClose={() => setNudgeClosed(true)} />
        )}
        <PaySheet open={plus} onClose={() => setPlus(false)} openAgent={openAgent} openPay={() => setSub('payee')} />
      </View>
      <TabBar
        active={tab}
        onTab={(t) => {
          setPlus(false);
          setTab(t);
        }}
        onPlus={() => setPlus((v) => !v)}
        plusOpen={plus}
        unread={st.unread}
      />
      <SlideScreen
        value={sub}
        top={insets.top}
        render={(v) =>
          v === 'card' ? (
            <CardDetailScreen onBack={() => setSub(null)} />
          ) : v === 'picker' ? (
            <CustomerPicker onBack={() => setSub(null)} />
          ) : (
            <PayeeScreen
              onBack={() => setSub(null)}
              onNext={() => {
                // maksusivu on pelkkä S-mobiilin näkymä: ei siirtoa chattiin
              }}
            />
          )
        }
      />
    </SafeAreaView>
  );
}

export default function App() {
  // kehitystyökalu: ikonigalleria (web, ?ikonit)
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.search.includes('ikonit')) return <IconGallery />;
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <PhoneFrame>
          <Shell />
        </PhoneFrame>
      </StoreProvider>
    </SafeAreaProvider>
  );
}

/**
 * Tietokoneen selaimessa sovellus näytetään puhelimen kehyksissä (arvioijat voivat kokeilla kuin puhelimella).
 * Puhelimen selaimessa ja natiivisovelluksessa koko näyttö.
 */
function PhoneFrame({ children }: { children: React.ReactNode }) {
  const framed = useFramed();
  const { width, height } = useWindowDimensions();
  if (!framed) return <View style={s.frame}>{children}</View>;
  // Normaali älypuhelin: näyttöalue 390 × 844 CSS-px (19,5:9). Käyttöliittymä lasketaan aina tälle leveydelle;
  // matalassa ikkunassa koko puhelin skaalataan pienemmäksi kuvasuhdetta muuttamatta.
  const BEZEL = 12;
  const outerW = FRAME_W + BEZEL * 2;
  const outerH = FRAME_H + BEZEL * 2;
  const total = outerH + 14 + 20; // puhelin + väli + kuvateksti
  const scale = Math.min(1, (height - 32) / total, (width - 32) / outerW);
  return (
    <View style={s.desk}>
      <View style={{ width: outerW, height: total, alignItems: 'center', transform: [{ scale }] }}>
        <View style={[s.phone, { width: outerW, height: outerH, padding: BEZEL }]}>
          <View style={[s.screen, { width: FRAME_W, height: FRAME_H }]}>{children}</View>
        </View>
        <Text style={s.caption}>Per Tieeri · S-Pankin talousvalmentaja · Junction 2026</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  desk: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6F2EA', overflow: 'hidden' },
  phone: { borderRadius: 52, backgroundColor: '#14251B', boxShadow: '0 24px 60px rgba(0,60,30,0.28)' },
  screen: { borderRadius: 40, overflow: 'hidden', backgroundColor: '#fff' },
  caption: { fontSize: 14, lineHeight: 20, color: '#2E5A41', marginTop: 14 },
  // webissä näytetään puhelimen levyinen kehys
  frame: { flex: 1, width: '100%', maxWidth: Platform.OS === 'web' ? 430 : undefined, alignSelf: 'center', backgroundColor: '#fff' },
  root: { flex: 1, backgroundColor: '#fff' },
});
