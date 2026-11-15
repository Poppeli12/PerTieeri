import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { eur } from '../../finance/analytics';
import type { SpendingGrid } from '../../finance/spendingGrid';
import { C } from '../../theme';
import { Text } from '../Text';
import { AppIcon } from '../../icons';

const percent = (hundredths: number) => (hundredths / 100).toFixed(2).replace('.', ',') + ' %';
const monthLabel = (month: string) => /^\d{4}-\d{2}$/.test(month) ? `${month.slice(5)} / ${month.slice(0, 4)}` : month;

export function SpendingGridCard({ data }: { data: SpendingGrid }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  if (data.status !== 'ready') return <View testID="spending-grid-unavailable" style={s.card}>
    <Text accessibilityRole="header" style={s.title}>Kuukauden kulutusruudukko</Text>
    <Text style={s.body}>{monthLabel(data.month)}</Text>
    <Text accessibilityLiveRegion="polite" style={s.body}>{data.message}</Text>
  </View>;
  const cells = data.groups.flatMap(g => Array.from({ length: g.cells }, () => g));
  const top = data.groups[0];
  return <View testID="monthly-spending-card" style={s.card}>
    <Text accessibilityRole="header" style={s.title}>Mihin rahat menivät · {monthLabel(data.month)}</Text>
    <Text testID="spending-total" style={s.total}>{eur(data.totalCents / 100)}</Text>
    <Text testID="spending-cell-value" style={s.big}>1 ruutu = {eur(data.cellEuros)}</Text>
    <View testID="monthly-spending-grid" accessible accessibilityRole="image" accessibilityLabel={`100 ruutua. Kuukauden menot ${eur(data.totalCents / 100)}. Kululuokkien osuudet ja valinnat ovat ruudukon alla.`} style={s.grid}>
      {Array.from({ length: 10 }, (_, row) => <View key={row} testID="spending-grid-row" style={s.row}>
        {cells.slice(row * 10, row * 10 + 10).map((g, column) => <View key={column} testID={`spending-cell-${row * 10 + column}`} style={[s.cell, { backgroundColor: g.color, opacity: selected === null || selected === g.key ? 1 : 0.15, borderWidth: selected === g.key ? 2 : 0, borderColor: C.greenDark }]} />)}
      </View>)}
    </View>
    <Text style={s.big}>Suurin: {top.label.toLowerCase()} {eur(top.cents / 100)}</Text>
    {selected !== null && <Pressable accessibilityRole="button" onPress={() => { setSelected(null); setShowAll(false); }} style={s.clear}><Text style={s.link}>Näytä kaikki ruudut</Text></Pressable>}
    <View testID="spending-legend" style={{ gap: 8 }}>
      {data.groups.map(g => <View key={g.key}>
        <Pressable testID={`spending-category-${g.key}`} accessibilityRole="button" accessibilityState={{ selected: selected === g.key, expanded: selected === g.key }} accessibilityLabel={`${g.label}, ${eur(g.cents / 100)}, ${percent(g.percentHundredths)}, ${g.cells} ruutua`}
          onPress={() => { setSelected(selected === g.key ? null : g.key); setShowAll(false); }}
          style={({ pressed }) => [s.category, selected === g.key && { backgroundColor: C.mint, borderColor: C.greenDark }, pressed && { opacity: 0.7 }]}>
          <View style={[s.swatch, { backgroundColor: g.color }]} />
          <AppIcon name={g.key} size={26} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[s.body, { fontWeight: '700' }]}>{g.label}</Text>
            <Text style={[s.body, { color: C.greenText, fontWeight: '700' }]}>{eur(g.cents / 100)} · {Math.round(g.percentHundredths / 100)} %</Text>
          </View>
          <Text accessible={false} style={s.link}>{selected === g.key ? '−' : '+'}</Text>
        </Pressable>
        {selected === g.key && <View testID="spending-details" style={s.details}>
          <Text style={[s.body, { fontWeight: '700' }]}>{g.label} · tarkemmat menot</Text>
          {(showAll ? g.expenses : g.expenses.slice(0, 5)).map((t, index) => <View key={`${t.date}-${index}`} style={s.expense}>
            <Text style={s.body}>{t.label}</Text>
            <Text style={s.body}>{t.date.slice(8)}.{t.date.slice(5, 7)}. · {eur(t.cents / 100)}</Text>
          </View>)}
          {g.expenses.length > 5 && <Pressable accessibilityRole="button" style={s.clear} onPress={() => setShowAll(!showAll)}><Text style={s.link}>{showAll ? 'Näytä vähemmän' : `Näytä kaikki ${g.expenses.length} tapahtumaa`}</Text></Pressable>}
        </View>}
      </View>)}
    </View>
  </View>;
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', padding: 18, borderRadius: 18, gap: 14, marginTop: 4 },
  title: { fontSize: 23, lineHeight: 30, color: C.greenText, fontWeight: '700' },
  body: { fontSize: 17, lineHeight: 25, color: C.text },
  total: { fontSize: 34, lineHeight: 40, fontWeight: '800', color: C.greenText },
  big: { fontSize: 19, lineHeight: 26, fontWeight: '700', color: C.text },
  note: { fontSize: 15, lineHeight: 22, color: C.sub },
  grid: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: 3 },
  row: { flexDirection: 'row', gap: 3 },
  cell: { flex: 1, aspectRatio: 1, borderRadius: 4 },
  category: { minHeight: 60, padding: 12, borderWidth: 1, borderColor: '#D5DDD8', borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  swatch: { width: 24, height: 24, borderRadius: 5 },
  details: { padding: 14, backgroundColor: '#F3F8F5', borderRadius: 12, gap: 10 },
  expense: { borderTopWidth: 1, borderColor: '#D5DDD8', paddingTop: 10, gap: 4 },
  clear: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 4 },
  link: { fontSize: 17, lineHeight: 25, color: C.greenText, fontWeight: '700' },
});
