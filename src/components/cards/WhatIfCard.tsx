import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '../Text';
import { addDays, eur0, TODAY } from '../../finance/analytics';
import { LeverKey } from '../../finance/categories';
import { simScenario, type Scenario } from '../../finance/insights';
import { levers } from '../../finance/optimizer';
import { useStore } from '../../state/store';
import { C } from '../../theme';
import { Slider } from '../Slider';
import { ForecastChart } from './ForecastChart';

/** The sliders edit the same persistent scenario that the agent sees. */
export function WhatIfCard({ preset, scenarioName = 'Oma kokeilu' }: { preset?: Partial<Record<LeverKey, number>>; scenarioName?: string }) {
  const { profile, prefs, scenarios, updateScenario, typing } = useStore();
  // The chat is remounted with the selected customer's ID as its React key.
  const ls = useMemo(() => levers(), []);
  const initial = useMemo<Scenario>(() => ({ name: scenarioName, changes: Object.fromEntries(Object.entries(preset ?? {}).map(([key, value]) => [key, -(value ?? 0)])), purchases: [], incomeDelta: 0, rentDelta: 0, monthlySaving: 0 }), [preset, scenarioName]);
  const scenario = scenarios[scenarioName] ?? initial;
  const [drag, setDrag] = useState<{ key: LeverKey; value: number } | null>(null);
  const rd = profile?.rentDelta ?? 0, id = profile?.incomeDelta ?? 0;
  const lastPurchase = scenario.purchases.map(p => p.date).sort().at(-1);
  const until = lastPurchase && lastPurchase > addDays(TODAY, 62) ? addDays(lastPurchase, 30) : addDays(TODAY, 92);
  const base = useMemo(() => simScenario(null, until, { rentDelta: rd, incomeDelta: id }), [until, rd, id]);
  const alt = useMemo(() => simScenario(scenario, until, { rentDelta: rd, incomeDelta: id }), [scenario, until, rd, id]);
  const freed = ls.reduce((sum, l) => sum - l.base * (scenario.changes[l.key] ?? 0) / 100, 0);
  const commit = (key: LeverKey, reduction: number) => {
    updateScenario(scenarioName, { ...scenario, changes: { ...scenario.changes, [key]: -reduction } });
    setDrag(null);
  };
  return (
    <View testID="persistent-whatif" style={{ gap: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: '700', color: C.text }}>{scenarioName}</Text>
      <Text style={{ fontSize: 16, lineHeight: 23, color: C.sub }}>Muutokset säilyvät tässä kokeilussa. Ostokset, tulomuutokset ja muut aiemmat valinnat pysyvät mukana.</Text>
      {ls.map(l => {
        const value = drag?.key === l.key ? drag.value : -(scenario.changes[l.key] ?? 0);
        const protectedExpense = prefs.protected.includes(l.key);
        return <View key={l.key} style={{ gap: 8, paddingBottom: 12, borderBottomWidth: 1, borderColor: C.divider }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: C.text }}>{l.label}</Text>
          <Text style={{ fontSize: 16, color: C.sub }}>{eur0(l.base)}/kk → {eur0(l.base * (1 - value / 100))}/kk · {value > 0 ? '−' : '+'}{Math.abs(value).toFixed(0)} %</Text>
          {protectedExpense ? <Text style={{ fontSize: 16, color: C.greenText }}>Suojattu toiveenne mukaisesti</Text> : typing ? <Text style={{ fontSize: 16, color: C.sub }}>Laskenta kesken…</Text> : <>
            <Slider value={Math.max(-100, Math.min(100, value))} min={-100} max={100} step={5} onChange={next => setDrag({ key: l.key, value: next })} onEnd={next => commit(l.key, next)} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {[{ label: 'Vähennä 5 %', delta: 5 }, { label: 'Lisää 5 %', delta: -5 }].map(button => <Pressable accessibilityRole="button" accessibilityLabel={`${l.label}: ${button.label}`} key={button.label} onPress={() => commit(l.key, Math.max(-100, Math.min(100, value + button.delta)))} style={{ flex: 1, minHeight: 44, padding: 10, borderRadius: 12, backgroundColor: C.mint }}><Text style={{ fontSize: 16, textAlign: 'center', color: C.greenText }}>{button.label}</Text></Pressable>)}
            </View>
          </>}
        </View>;
      })}
      <View style={{ padding: 16, backgroundColor: C.mint, borderRadius: 16, gap: 6 }}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: C.greenText }}>{eur0(freed)}/kk</Text>
        <Text style={{ fontSize: 16, lineHeight: 23, color: C.text }}>Menojen laskennallinen vähennys. Positiivinen summa vapauttaa rahaa, mutta mahdollinen kuukausivaje ja säästösiirrot vaikuttavat käyttövaraan.</Text>
        <Text style={{ fontSize: 16, color: C.text }}>Ennusteen alin saldo {eur0(alt.min50)} · mallinnettu miinusriski {Math.round(alt.probNegative * 100)} %</Text>
      </View>
      {scenario.purchases.map(p => <Text key={p.label} style={{ fontSize: 16, color: C.text }}>{p.label}: {eur0(p.amount)}, {p.date}</Text>)}
      <ForecastChart sim={base} compare={alt} baseLabel="Nykyinen tahti" compareLabel={scenarioName} />
      <Text style={{ fontSize: 16, lineHeight: 23, color: C.sub }}>Ennuste omasta historiasta {until} asti. Vähennys on kokeilu, ei muutos pankkitapahtumiin tai sopimuksiin.</Text>
    </View>
  );
}
