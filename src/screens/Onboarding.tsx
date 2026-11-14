import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import type { Profile } from '../agent/types';
import { PerTieeri } from '../components/PerTieeri';
import { SLogo } from '../components/SLogo';
import { FadeIn, GreenButton } from '../components/ui';
import { CUSTOMER, txs } from '../finance/analytics';
import { LeverKey, PROTECT_OPTIONS } from '../finance/categories';
import { DEFAULT_PROFILE, useStore } from '../state/store';
import { C } from '../theme';

type Step = {
  key: keyof Profile | 'intro' | 'protect';
  say: string;
  options?: string[];
  multi?: boolean;
};

const STEPS: Step[] = [
  {
    key: 'intro',
    say: `Hyvää päivää! Olen Per Tieeri. Ennen vanhaan pankkiiri tunsi asiakkaansa nimeltä. Nykyään kaikki on niin… mutkatonta. No, tutustutaan silti kunnolla.\n\nKysyn 5 lyhyttä kysymystä, jotta neuvoni sopivat juuri sinulle. Tiedot pysyvät vain sinun käytössäsi.`,
  },
  { key: 'age', say: `Tietojemme mukaan olet ${CUSTOMER.age}-vuotias. Pitääkö paikkansa?`, options: [`Kyllä, ${CUSTOMER.age}`, 'Alle 20', '20–25', '26–30', 'Yli 30'] },
  { key: 'situation', say: 'Mikä on tämänhetkinen elämäntilanteesi?', options: ['Käyn töissä', 'Opiskelen', 'Opiskelen ja käyn töissä', 'Työnhaussa', 'Muu'] },
  { key: 'living', say: 'Miten asut?', options: ['Yksin vuokralla', 'Kimppakämpässä', 'Kumppanin kanssa', 'Vanhempien luona', 'Omistusasunnossa'] },
  { key: 'goal', say: 'Mikä on tärkein raha-asiasi juuri nyt?', options: ['Puskuri yllätyksiin', 'Säästää johonkin isoon', 'Kulutuksen hallinta', 'Ensiasunto', 'Oppia taloutta'] },
  { key: 'protect', say: 'Mistä et halua tinkiä missään tilanteessa? En ehdota säästämistä näistä. Voit valita useamman.', options: [...PROTECT_OPTIONS.map((p) => p.label), 'Ei mistään erityisesti'], multi: true },
  { key: 'style', say: 'Viimeinen kysymys: miten haluat, että puhun sinulle?', options: ['Opettaen ja perustellen', 'Lyhyesti ja suoraan'] },
];

export function Onboarding() {
  const { completeOnboarding } = useStore();
  const [i, setI] = useState(0);
  const [p, setP] = useState<Profile>({ ...DEFAULT_PROFILE });
  const [multi, setMulti] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [talking, setTalking] = useState(true);
  const step = STEPS[i];

  useEffect(() => {
    setTalking(true);
    const t = setTimeout(() => setTalking(false), 1600);
    return () => clearTimeout(t);
  }, [i]);

  const next = (patch: Partial<Profile> = {}) => {
    const np = { ...p, ...patch };
    setP(np);
    if (i < STEPS.length - 1) setI(i + 1);
    else {
      setAnalyzing(true);
      setTimeout(() => completeOnboarding(np), 2300);
    }
  };

  const choose = (o: string) => {
    switch (step.key) {
      case 'age': {
        const map: Record<string, number> = { 'Alle 20': 19, '20–25': 23, '26–30': 28, 'Yli 30': 33 };
        return next({ age: map[o] ?? CUSTOMER.age });
      }
      case 'situation':
        return next({ situation: o });
      case 'living':
        return next({ living: o });
      case 'goal':
        return next({ goal: o });
      case 'style':
        return next({ style: o.startsWith('Lyhyesti') ? 'short' : 'teach' });
    }
  };

  if (analyzing) return <Analyzing />;

  return (
    <View style={s.root}>
      <View style={s.header}>
        <SLogo size={34} />
        <Text style={s.hTitle}>Tutustutaan</Text>
        <Text style={s.hStep}>
          {i}/{STEPS.length - 1}
        </Text>
      </View>
      <View style={s.progress}>
        <View style={[s.progressFill, { width: `${(i / (STEPS.length - 1)) * 100}%` }]} />
      </View>
      <ScrollView contentContainerStyle={s.body}>
        <View style={s.avatarRow}>
          <PerTieeri size={i === 0 ? 170 : 120} talking={talking} mood="shrug" />
        </View>
        <FadeIn key={i} style={s.say}>
          <Text style={s.sayText}>{step.say}</Text>
        </FadeIn>

        {step.key === 'intro' && (
          <FadeIn delay={200} style={{ gap: 10, marginTop: 8 }}>
            <GreenButton label="Aloitetaan" onPress={() => next()} />
            <Text style={s.privacy}>MyData-periaate: näet ja voit poistaa kaiken, mitä Per Tieeri oppii, Minä-sivulta.</Text>
          </FadeIn>
        )}

        {step.options && !step.multi && (
          <View style={s.opts}>
            {step.options.map((o, k) => (
              <FadeIn key={o} delay={120 + k * 50}>
                <Pressable style={({ pressed }) => [s.opt, pressed && s.optPressed]} onPress={() => choose(o)}>
                  <Text style={s.optText}>{o}</Text>
                </Pressable>
              </FadeIn>
            ))}
          </View>
        )}

        {step.multi && (
          <View style={s.opts}>
            {step.options!.map((o, k) => {
              const on = multi.includes(o);
              return (
                <FadeIn key={o} delay={120 + k * 50}>
                  <Pressable
                    style={[s.opt, on && s.optOn]}
                    onPress={() =>
                      setMulti((m) => (o === 'Ei mistään erityisesti' ? [o] : on ? m.filter((x) => x !== o) : [...m.filter((x) => x !== 'Ei mistään erityisesti'), o]))
                    }
                  >
                    <Text style={[s.optText, on && { color: '#fff' }]}>
                      {on ? '✓ ' : ''}
                      {o}
                    </Text>
                  </Pressable>
                </FadeIn>
              );
            })}
            <View style={{ marginTop: 8 }}>
              <GreenButton
                label="Jatka"
                disabled={!multi.length}
                onPress={() => {
                  const levers = PROTECT_OPTIONS.filter((x) => multi.includes(x.label)).flatMap((x) => x.levers) as LeverKey[];
                  next({ protect: levers });
                }}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Analyzing() {
  const v = useRef(new Animated.Value(0)).current;
  const [line, setLine] = useState(0);
  const lines = [`Luen ${txs().length} tapahtumaa…`, 'Jaan menot kolmeen koriin…', 'Etsin toistuvat maksut ja poikkeamat…', 'Simuloin tulevia viikkoja…'];
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: false }).start();
    const t = setInterval(() => setLine((l) => Math.min(lines.length - 1, l + 1)), 560);
    return () => clearInterval(t);
  }, [v, lines.length]);
  return (
    <View style={[s.root, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
      <PerTieeri size={150} talking />
      <Text style={s.anTitle}>Hetkinen, käyn tilikirjat läpi</Text>
      <Text style={s.anLine}>{lines[line]}</Text>
      <View style={[s.progress, { width: '80%', borderRadius: 4, marginTop: 16 }]}>
        <Animated.View style={[s.progressFill, { width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.mint },
  header: { backgroundColor: C.greenDark, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  hTitle: { color: '#fff', fontSize: 20, fontWeight: '800', flex: 1 },
  hStep: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' },
  progress: { height: 5, backgroundColor: C.mint2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.green },
  body: { padding: 18, paddingBottom: 40 },
  avatarRow: { alignItems: 'center', marginTop: 4 },
  say: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 6, marginBottom: 14 },
  sayText: { fontSize: 16.5, lineHeight: 24, color: C.text },
  privacy: { fontSize: 12.5, color: C.sub, textAlign: 'center' },
  opts: { gap: 8 },
  opt: { backgroundColor: '#fff', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 18, borderWidth: 1.5, borderColor: '#fff' },
  optPressed: { borderColor: C.greenDark },
  optOn: { backgroundColor: C.greenDark, borderColor: C.greenDark },
  optText: { fontSize: 16.5, color: C.text, fontWeight: '600' },
  anTitle: { fontSize: 20, fontWeight: '800', color: C.greenText, marginTop: 12 },
  anLine: { fontSize: 15, color: C.sub, marginTop: 6 },
});
