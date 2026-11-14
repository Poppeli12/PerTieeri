import React, { useEffect, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import type { Card } from '../../agent/types';
import { C } from '../../theme';
import { Text } from '../Text';
import { AnimatedRect, LineReveal } from './AnimatedPrimitives';
import { useChartAnimation } from './useChartAnimation';
import { CountUp } from './CountUp';

type Chart = Extract<Card, { kind: 'chart' }>;
// Ensimmäinen väri on S-Pankin vihreä; muut selvästi erottuvia sävyjä, jotta osat erottaa toisistaan
const COLORS = [C.greenDark, '#E3A12F', '#3A78C2', '#D9604A', '#8A5BB4', '#2AA39C', '#9AA53A', '#C2508A'];
const number = (value: number) => value.toLocaleString('fi-FI', { maximumFractionDigits: 2 });
const valueText = (value: number, unit: string) => `${number(value)} ${unit}`.trim();
/** Pylvään päällä oleva luku: lyhyt ja selvä (1 234 → 1 234, 12 500 → 12,5 t) */
const shortValue = (value: number) => (Math.abs(value) >= 10000 ? `${(value / 1000).toLocaleString('fi-FI', { maximumFractionDigits: 1 })} t` : Math.round(value).toLocaleString('fi-FI'));
const AnimatedSvgText = Animated.createAnimatedComponent(SvgText);
const MONTHS = ['tammi', 'helmi', 'maalis', 'huhti', 'touko', 'kesä', 'heinä', 'elo', 'syys', 'loka', 'marras', 'joulu'];

/** Large, zero-based plots. Exact values stay available as readable text beside the explanation. */
export function DataChart({ card }: { card: Chart }) {
  const [width, setWidth] = useState(300);
  const [allRows, setAllRows] = useState(false);
  const { progress, replay, reduced } = useChartAnimation(JSON.stringify(card));
  const [replays, setReplays] = useState(0);
  // ympyrä piirretään JS-arvosta (strokeDasharray ei animoidu natiivisti)
  const [p, setP] = useState(1);
  useEffect(() => {
    const id = progress.addListener(({ value }) => setP(value));
    return () => progress.removeListener(id);
  }, [progress]);
  const n = card.labels.length;
  const ns = card.series.length;
  const values = card.series.flatMap(series => series.values);
  const valid = n > 0 && ns > 0 && card.series.every(series => series.values.length === n && series.values.every(Number.isFinite));
  const total = card.series[0]?.values.reduce((sum, value) => sum + value, 0) ?? 0;
  const pie = card.chart === 'pie';
  const validPie = !pie || (ns === 1 && total > 0 && values.every(value => value >= 0));
  const height = 320;
  const plotWidth = card.chart === 'bar' ? Math.max(width, 80 + n * Math.max(42, ns * 28)) : width;
  const pad = { left: 72, right: 16, top: 22, bottom: 42 };
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const rawStep = (max - min || 1) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 5, 10].find(value => value * magnitude >= rawStep)! * magnitude;
  const low = Math.floor(min / step) * step;
  const high = Math.max(low + step, Math.ceil(max / step) * step);
  const axisDivisor = Math.max(Math.abs(low), high) >= 1e6 ? 1e6 : Math.max(Math.abs(low), high) >= 10000 ? 1000 : 1;
  const y = (value: number) => pad.top + (high - value) / (high - low) * (height - pad.top - pad.bottom);
  const slot = (plotWidth - pad.left - pad.right) / Math.max(1, n);
  const x = (i: number) => pad.left + slot * (i + .5);
  const ticks = Array.from({ length: Math.round((high - low) / step) + 1 }, (_, i) => low + step * i);
  const labelIndices = new Set(Array.from({ length: Math.min(4, n) }, (_, i) => Math.round(i * (n - 1) / Math.max(1, Math.min(4, n) - 1))));
  const axisLabel = (label: string, i: number) => {
    const month = MONTHS.find(name => label.toLowerCase().startsWith(name));
    if (month) return month.slice(0, 3);
    if (/^\d{4}-\d{2}$/.test(label)) return `${+label.slice(5)}/${label.slice(2, 4)}`;
    const space = slot * (card.chart === 'line' ? Math.max(1, Math.floor(n / 4)) : 1);
    return label.length <= Math.max(3, Math.floor((space - 6) / 7)) ? label : String(i + 1);
  };
  const barWidth = Math.min(42, slot * .76 / Math.max(1, ns));
  const radius = Math.min(92, (width - 60) / 2);
  const circumference = 2 * Math.PI * radius;
  const rows = allRows || n <= 6 ? card.labels : card.labels.slice(0, 3);
  return <View testID={`data-chart-${card.chart}`} style={s.card}>
    <Text accessibilityRole="header" style={s.title}>{card.title}</Text>
    {!valid || !validPie ? <Text style={s.note}>Näille tiedoille ei voi piirtää tätä kaaviota. Tarvitaan keskenään yhteensopivat luvut.</Text> : <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <Text style={[s.unit, { flex: 1, marginBottom: 0 }]}>{pie ? 'Osuus näytetystä kokonaisuudesta' : `Asteikko: ${axisDivisor === 1e6 ? 'miljoonaa ' : axisDivisor === 1000 ? 'tuhatta ' : ''}${card.unit || 'lukumäärä'}`}</Text>
        {reduced === false && <Pressable accessibilityRole="button" onPress={() => { replay(); setReplays(x => x + 1); }} style={s.replay}><Text style={s.link}>Toista rakentuminen</Text></Pressable>}
      </View>
      <View onLayout={event => setWidth(event.nativeEvent.layout.width)}>
        {pie && p > 0.97 && <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 136, alignItems: 'center', zIndex: 1 }}>
          <Text style={{ fontSize: 26, lineHeight: 32, fontWeight: '700', color: C.greenText }}><CountUp key={replays} text={valueText(Math.round(total), card.unit)} duration={700} /></Text>
        </View>}
        {pie ? <Svg testID="pie-plot" width={width} height={280} accessible accessibilityLabel={`${card.title}. Kokonaismäärä ${valueText(total, card.unit)}. Osat on lueteltu alla.`}>
          <G rotation={-90} origin={`${width / 2},140`}>
            {card.series[0].values.map((value, i, list) => {
              const before = list.slice(0, i).reduce((sum, v) => sum + v, 0);
              const shown = Math.max(0, Math.min(value, p * total - before));
              return shown <= 0 ? null : <Circle key={i} cx={width / 2} cy={140} r={radius} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth={42}
                strokeDasharray={[circumference * shown / total, circumference * (1 - shown / total)]}
                strokeDashoffset={-circumference * before / total} />;
            })}
          </G>
          <SvgText x={width / 2} y={128} textAnchor="middle" fontFamily="Figtree-500" fontSize={17} fill={C.sub} opacity={p > 0.97 ? 1 : 0}>Yhteensä</SvgText>
        </Svg> : <ScrollView horizontal showsHorizontalScrollIndicator={plotWidth > width}>
          <Svg testID="chart-plot" width={plotWidth} height={height} accessible accessibilityLabel={`${card.title}. ${card.chart === 'line' ? 'Viivakaavio' : 'Pylväskaavio'}. Tarkat arvot alla.`}>
            {ticks.map((tick, i) => <G key={i}>
              <Line x1={pad.left} x2={plotWidth - pad.right} y1={y(tick)} y2={y(tick)} stroke="#DEE7E1" />
              <SvgText x={pad.left - 9} y={y(tick) + 5} textAnchor="end" fontFamily="Figtree-500" fontSize={16} fill={C.sub}>{(tick / axisDivisor).toLocaleString('fi-FI', { maximumFractionDigits: Math.max(0, Math.min(6, Math.ceil(-Math.log10(step / axisDivisor)))) })}</SvgText>
            </G>)}
            <Line x1={pad.left} x2={plotWidth - pad.right} y1={y(0)} y2={y(0)} stroke="#66766B" strokeWidth={1.5} />
            {card.chart === 'bar' ? card.series.map((series, si) => series.values.map((value, i) => <AnimatedRect key={`${si}-${i}`} x={x(i) - ns * barWidth / 2 + si * barWidth + 2} width={barWidth - 4} rx={3} fill={value < 0 ? C.coral : COLORS[si % COLORS.length]}
              y={progress.interpolate({ inputRange: [0, 1], outputRange: [y(0), Math.min(y(value), y(0))] })}
              height={progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.abs(y(value) - y(0))] })} />))
              : null}
            {card.chart === 'bar' && card.series.map((series, si) => series.values.map((value, i) => <AnimatedSvgText key={`v${si}-${i}`}
              x={x(i) - ns * barWidth / 2 + si * barWidth + barWidth / 2} y={value >= 0 ? y(value) - 7 : y(value) + 18}
              textAnchor="middle" fontFamily="Figtree-700" fontSize={barWidth >= 34 ? 15 : 12} fill={value < 0 ? C.danger : C.greenText}
              opacity={progress.interpolate({ inputRange: [0, 0.85, 1], outputRange: [0, 0, 1] })}>{shortValue(value)}</AnimatedSvgText>))}
            {card.chart === 'bar' ? null
              : <LineReveal progress={progress} width={plotWidth} height={height}>
                {card.series.map((series, si) => <G key={si}>
                  <Path d={series.values.map((value, i) => `${i ? 'L' : 'M'}${x(i)} ${y(value)}`).join(' ')} stroke={COLORS[si % COLORS.length]} strokeWidth={3.5} fill="none" strokeLinejoin="round" />
                  {series.values.map((value, i) => <Circle key={i} cx={x(i)} cy={y(value)} r={4} stroke={COLORS[si % COLORS.length]} strokeWidth={2} fill="white" />)}
                </G>)}
              </LineReveal>}
            {card.labels.map((label, i) => (card.chart === 'bar' || labelIndices.has(i)) && <SvgText key={i} x={x(i)} y={height - 14} textAnchor="middle" fontFamily="Figtree-600" fontSize={16} fill={C.text}>{axisLabel(label, i)}</SvgText>)}
          </Svg>
        </ScrollView>}
      </View>
      {!pie && plotWidth > width && <Text style={s.note}>Pyyhkäise kuvaajaa sivulle nähdäksesi kaikki pylväät.</Text>}
      {!pie && ns > 1 && <View style={s.legend}>{card.series.map((series, i) => <View key={i} style={s.legendItem}><View style={[s.dot, { backgroundColor: COLORS[i % COLORS.length] }]} /><Text style={s.body}>{series.name}</Text></View>)}</View>}
      <View style={s.data}>
        {rows.map((label, i) => <View key={i} style={s.row}>
          <View style={s.labelRow}>{pie && <View style={[s.dot, { backgroundColor: COLORS[i % COLORS.length] }]} />}<Text style={s.rowLabel}>{!pie && axisLabel(label, i) === String(i + 1) ? `${i + 1}. ` : ''}{label}</Text></View>
          {card.series.map((series, si) => <Text key={si} style={s.value}>{ns > 1 ? `${series.name}: ` : ''}{valueText(series.values[i], card.unit)}{pie && !card.unit.includes('%') ? ` · ${(series.values[i] / total * 100).toLocaleString('fi-FI', { maximumFractionDigits: 1 })} %` : ''}</Text>)}
        </View>)}
        {n > 6 && <Pressable accessibilityRole="button" aria-expanded={allRows} onPress={() => setAllRows(value => !value)} style={s.replay}><Text style={s.link}>{allRows ? 'Näytä vähemmän lukuja' : `Näytä kaikki ${n} arvoa`}</Text></Pressable>}
      </View>
      {card.note && <Text style={s.note}>{card.note}</Text>}
    </>}
  </View>;
}

const s = StyleSheet.create({
  card: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginTop: 4 },
  title: { fontSize: 21, lineHeight: 28, fontWeight: '700', color: C.text, marginBottom: 12 },
  unit: { fontSize: 16, color: C.sub, marginBottom: 10 },
  note: { fontSize: 16, lineHeight: 24, color: C.sub, marginTop: 12 },
  body: { fontSize: 16, color: C.text },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 3 },
  replay: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingVertical: 8 },
  link: { fontSize: 16, color: C.greenText, fontWeight: '600', textDecorationLine: 'underline' },
  data: { marginTop: 8 },
  row: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.divider, gap: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { flex: 1, fontSize: 16, lineHeight: 22, fontWeight: '600', color: C.text },
  value: { fontSize: 17, lineHeight: 24, color: C.greenText, fontWeight: '600' },
});
