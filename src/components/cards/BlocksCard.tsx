import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { eur0, isOut, labelOf, lastOutflows } from '../../finance/analytics';
import { C, CAT_COLORS } from '../../theme';

/** "Mihin 1000 € meni?" – 100 ruutua, jokainen = 10 € */
export function BlocksCard() {
  const [mode, setMode] = useState<'daily' | 'all'>('daily');
  const data = useMemo(() => {
    const pred = mode === 'daily' ? (t: any) => isOut(t) && t.c !== 'Housing' && t.c !== 'Utilities' : isOut;
    const list = lastOutflows(1000, pred);
    const g: Record<string, number> = {};
    let total = 0;
    for (const t of list) {
      const room = 1000 - total;
      const v = Math.min(-t.a, room);
      if (v <= 0) break;
      const l = t.c === 'Housing' ? 'Vuokra' : labelOf(t);
      g[l] = (g[l] || 0) + v;
      total += v;
    }
    let groups = Object.entries(g)
      .map(([label, v]) => ({ label, v }))
      .sort((a, b) => b.v - a.v);
    // max 7 ryhmää + muut
    if (groups.length > 8) {
      const rest = groups.slice(7).reduce((s, x) => s + x.v, 0);
      groups = [...groups.slice(0, 7), { label: 'Muut', v: rest }];
    }
    // suurimman jäännöksen menetelmä -> tasan 100 ruutua
    const raw = groups.map((x) => (x.v / total) * 100);
    const blocks = raw.map(Math.floor);
    let left = 100 - blocks.reduce((s, x) => s + x, 0);
    raw
      .map((r, i) => [r - Math.floor(r), i] as const)
      .sort((a, b) => b[0] - a[0])
      .forEach(([, i]) => {
        if (left-- > 0) blocks[i]++;
      });
    const cells: number[] = [];
    blocks.forEach((n, gi) => {
      for (let k = 0; k < n; k++) cells.push(gi);
    });
    const from = list.length ? list[list.length - 1].d : '';
    return { groups: groups.map((x, i) => ({ ...x, blocks: blocks[i] })), cells, from };
  }, [mode]);

  const [anims] = useState(() => Array.from({ length: 100 }, () => new Animated.Value(0)));
  const [sel, setSel] = useState<number | null>(null);
  useEffect(() => {
    anims.forEach((a) => a.setValue(0));
    Animated.stagger(9, anims.map((a) => Animated.timing(a, { toValue: 1, duration: 180, useNativeDriver: true }))).start();
  }, [data, anims]);

  return (
    <View>
      <View style={s.seg}>
        {(['daily', 'all'] as const).map((m) => (
          <Pressable key={m} onPress={() => setMode(m)} style={[s.segBtn, mode === m && s.segOn]}>
            <Text style={[s.segText, mode === m && { color: '#fff' }]}>{m === 'daily' ? 'Arjen ostokset' : 'Kaikki menot'}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={s.caption}>1 ruutu = 10 €</Text>
      <View style={s.grid}>
        {data.cells.map((gi, i) => (
          <Animated.View
            key={i}
            style={[
              s.cell,
              { backgroundColor: CAT_COLORS[gi % CAT_COLORS.length], opacity: sel == null || sel === gi ? anims[i] : 0.18, transform: [{ scale: anims[i] }] },
            ]}
          />
        ))}
      </View>
      <View style={s.legend}>
        {data.groups.map((g, i) => (
          <Pressable key={g.label} style={s.lgRow} onPress={() => setSel(sel === i ? null : i)}>
            <View style={[s.sw, { backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }]} />
            <Text style={[s.lgLabel, sel === i && { fontWeight: '800' }]}>{g.label}</Text>
            <Text style={s.lgVal}>
              {eur0(g.v)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  seg: { flexDirection: 'row', borderWidth: 1.5, borderColor: C.text, marginBottom: 10 },
  segBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#fff' },
  segOn: { backgroundColor: C.text },
  segText: { fontSize: 17, fontWeight: '700', color: C.text },
  caption: { fontSize: 19, fontWeight: '700', color: C.text, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, alignSelf: 'center', width: 10 * 24 + 9 * 3 },
  cell: { width: 24, height: 24, borderRadius: 5 },
  legend: { marginTop: 14, gap: 10 },
  lgRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sw: { width: 22, height: 22, borderRadius: 5 },
  lgLabel: { flex: 1, fontSize: 18, fontWeight: '600', color: C.text },
  lgVal: { fontSize: 18, fontWeight: '700', color: C.greenText },
});
