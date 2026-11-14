import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { BasketsCard } from '../components/cards/BasketsCard';
import { BlocksCard } from '../components/cards/BlocksCard';
import { ForecastChart } from '../components/cards/ForecastChart';
import { WhatIfCard } from '../components/cards/WhatIfCard';
import { Card, Chip, H2 } from '../components/ui';
import { anomalies, eur, eur0, fmtDay, recurring, safeToSpend, spenderType } from '../finance/analytics';
import { simulate } from '../finance/forecast';
import { useStore } from '../state/store';
import { C } from '../theme';

/** "Oma talous" – MyData-henkinen näkymä, jossa kaikki visualisoinnit yhdessä */
export function InsightsView({ onAsk }: { onAsk: (q: string) => void }) {
  const { answers, profile } = useStore();
  const sts = safeToSpend();
  const st = spenderType();
  const sim = simulate({ until: '2026-12-31', rentDelta: profile?.rentDelta, incomeDelta: profile?.incomeDelta });
  const rec = recurring().filter((r) => r.kind !== 'habit');
  const an = anomalies(answers);

  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <View style={s.hero}>
        <Text style={s.heroLabel}>Turvallisesti käytettävissä {fmtDay(sts.until)} asti</Text>
        <Text style={s.heroVal}>{eur0(sts.perWeek)} / viikko</Text>
        <Text style={s.heroSub}>
          Saldo {eur(sts.balance)} · vapaata {eur0(Math.max(0, sts.free))}
        </Text>
        <View style={s.typePill}>
          <Text style={s.typeText}>{st.type}</Text>
        </View>
      </View>

      {an.length > 0 && (
        <>
          <H2 style={s.h2}>Per Tieeri huomasi</H2>
          <Card>
            {an.slice(0, 4).map((a, i) => (
              <View key={a.id} style={[s.an, i > 0 && s.anLine]}>
                <View style={[s.anDot, { backgroundColor: a.severity === 'warn' ? C.amber : a.severity === 'question' ? C.coral : C.green }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.anTitle}>{a.title}</Text>
                  <Text style={s.anText}>{a.detail}</Text>
                </View>
              </View>
            ))}
            <View style={{ marginTop: 10, alignItems: 'flex-start' }}>
              <Chip label="Käydään läpi yhdessä" onPress={() => onAsk('Hei')} />
            </View>
          </Card>
        </>
      )}

      <H2 style={s.h2}>Kolme rahakoria</H2>
      <Card>
        <BasketsCard />
      </Card>

      <H2 style={s.h2}>Mihin 1 000 € meni?</H2>
      <Card>
        <BlocksCard />
      </Card>

      <H2 style={s.h2}>Mitä jos?</H2>
      <Card>
        <WhatIfCard />
      </Card>

      <H2 style={s.h2}>Ennuste vuoden loppuun</H2>
      <Card>
        <ForecastChart sim={sim} />
        {sim.probNegative > 0.1 && (
          <Text style={s.warn}>
            ⚠ {Math.round(sim.probNegative * 100)} %:n riski käydä miinuksella. Tiukin kohta on noin {fmtDay(sim.minDate)}
          </Text>
        )}
      </Card>

      <H2 style={s.h2}>Toistuvat maksut</H2>
      <Card pad={false}>
        {rec.map((r, i) => (
          <View key={r.key} style={[s.rec, i < rec.length - 1 && s.anLine]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.recLabel, r.suspicious && { color: C.danger, fontWeight: '700' }]}>
                {r.label}
                {r.demo ? <Text style={s.demo}>  DEMO</Text> : null}
              </Text>
              <Text style={s.recSub}>
                {r.priceChange ? `Havaittu hintamuutos ${eur(r.priceChange.from)} → ${eur(r.priceChange.to)}` : r.cadence ?? 'Toistuva maksutyyppiryhmä'}{r.active ? '' : ' · ei tuoreita havaintoja'}
              </Text>
            </View>
            <Text style={s.recVal}>{eur(r.amount)}/kk</Text>
          </View>
        ))}
      </Card>
      <Text style={s.foot}>Oman valitun asiakkaan tapahtumat. Toistuvien maksujen summat ovat toteutuneita kuukausikeskiarvoja, eivät vahvistettuja tulevia laskuja. Väestövertailut tehdään erikseen Tilastokeskuksen tiedoilla.</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 40, gap: 10 },
  hero: { backgroundColor: C.greenDark, borderRadius: 16, padding: 18 },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13.5 },
  heroVal: { color: '#fff', fontSize: 34, fontWeight: '800', letterSpacing: -0.8, marginVertical: 2 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13.5 },
  typePill: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginTop: 10 },
  typeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  h2: { marginTop: 14, marginBottom: 2 },
  an: { flexDirection: 'row', gap: 10, paddingVertical: 8 },
  anLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D8DDD9' },
  anDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  anTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  anText: { fontSize: 13.5, color: C.sub, lineHeight: 19, marginTop: 2 },
  warn: { fontSize: 13.5, color: C.danger, marginTop: 8, fontWeight: '600' },
  rec: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  recLabel: { fontSize: 15.5, color: C.text },
  recSub: { fontSize: 12.5, color: C.sub, marginTop: 2 },
  recVal: { fontSize: 15, fontWeight: '700', color: C.text },
  demo: { fontSize: 10, color: C.gray, fontWeight: '800' },
  foot: { fontSize: 12, color: C.sub, textAlign: 'center', marginTop: 10 },
});
