import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '../Text';
import { eur0 } from '../../finance/analytics';
import type { goalPlans } from '../../finance/insights';
import { useStore } from '../../state/store';
import { C } from '../../theme';

export function GoalPlansCard({ goal }: { goal: ReturnType<typeof goalPlans> }) {
  const { send, updateScenario, typing } = useStore();
  return <View testID="goal-plans" style={{ backgroundColor: '#fff', padding: 20, borderRadius: 16, gap: 16 }}>
    <Text style={{ fontSize: 24, lineHeight: 31, fontWeight: '700', color: C.text }}>{goal.kind === 'balance' ? `${eur0(goal.target)} tilillä ${goal.until}` : `Tavoite: ${eur0(goal.target)}/kk säästöön`}</Text>
    <Text style={{ fontSize: 17, lineHeight: 25, color: C.sub }}>Nykyinen arvioitu kuukausiylijäämä {eur0(goal.baseline)}. {goal.baseline < 0 ? 'Menovähennyksillä paikataan ensin vajaus. ' : ''}Menoista tarvitaan pois noin {eur0(goal.cutNeeded)}/kk.</Text>
    {goal.plans.map((plan, index) => <View key={index} style={{ padding: 16, borderWidth: 1, borderColor: C.divider, borderRadius: 14, gap: 10 }}>
      <Text style={{ fontSize: 21, lineHeight: 28, fontWeight: '700', color: C.text }}>{index + 1}. {plan.label}</Text>
      <Text style={{ fontSize: 17, lineHeight: 25, color: C.sub }}>{plan.explanation}</Text>
      <Text style={{ fontSize: 24, fontWeight: '700', color: C.greenText }}>{eur0(plan.total)}/kk vähemmän menoja</Text>
      {!plan.items.length && <Text style={{ fontSize: 17, lineHeight: 25 }}>Uutta menovähennystä ei tarvita kuukausilaskelmassa. Tarkistakaa silti ennusteen ajoitus.</Text>}
      {plan.items.map(item => <View key={item.key} style={{ gap: 3 }}>
        <Text style={{ fontSize: 18, fontWeight: '600', color: C.text }}>{item.label} −{item.pct} %</Text>
        <Text style={{ fontSize: 17, color: C.sub }}>{eur0(item.base)} → {eur0(item.base - item.saving)}/kk · vapautuu {eur0(item.saving)}</Text>
      </View>)}
      <Text style={{ fontSize: 17, lineHeight: 25, color: C.text }}>Arvioitu ylijäämä muutosten jälkeen: {eur0(plan.netMonthly)}/kk.{goal.kind === 'saving' ? ` Suunnitellut säästösiirrot jakson aikana: ${eur0(plan.forecast.saved)}.` : ''}</Text>
      <Text style={{ fontSize: 17, lineHeight: 25, color: plan.cashflowAcceptable ? C.greenText : C.danger }}>{plan.cashflowAcceptable ? 'Läpäisee mallin kassavirtatarkistuksen.' : 'Tavoite ei vielä läpäise kassavirtatarkistusta.'} Alin ennustettu saldo {eur0(plan.forecast.min)}, miinusriski {Math.round(plan.forecast.risk * 100)} %.</Text>
      <Pressable disabled={typing} accessibilityRole="button" accessibilityLabel={`Tutki vaihtoehtoa ${index + 1}`} onPress={() => {
        const name = `Tavoite: ${plan.label}`;
        updateScenario(name, { ...plan.scenario, name });
        send(`Valitsin kokeiluun suunnitelman ”${name}”. Näytä sen vaikutus graafina ${goal.until} asti ja selitä tärkein vaikutus rahojeni riittävyyteen.`);
      }} style={{ minHeight: 48, padding: 13, backgroundColor: C.greenDark, borderRadius: 24, opacity: typing ? 0.5 : 1 }}><Text style={{ color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center' }}>Tutki tätä vaihtoehtoa</Text></Pressable>
    </View>)}
    <Text style={{ fontSize: 16, lineHeight: 24, color: C.sub }}>Arvio omasta synteettisestä asiakasdatasta, ei lupaus. Tulevat laskut, tulot ja kulutus voivat poiketa historiasta. Varovaisuusraja on enintään 10 % mallinnettu miinusriski.</Text>
  </View>;
}
