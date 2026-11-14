import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { eur0, MONTH_FI } from '../../finance/analytics';
import type { SimResult } from '../../finance/forecast';
import { C } from '../../theme';
import { Text } from '../Text';
import { LineReveal } from '../charts/AnimatedPrimitives';
import { useChartAnimation } from '../charts/useChartAnimation';

/**
 * Saldoennuste S-mobiilin tyyliin: todennäköisin polku (vihreä), 80 % vaihteluväli (vaalea),
 * valinnainen vertailupolku. Akselit sovelluksen fontilla ja muodossa "1 000 €" / "loka".
 */
const FONT = 'Figtree-500';
const shortMonth = (iso: string) => MONTH_FI[+iso.slice(5, 7) - 1].replace(/kuu$/, '');

/** siisti akseliväli: 0, 500, 1 000 … */
function niceStep(span: number) {
  const raw = span / 3;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / pow;
  return (m < 1.5 ? 1 : m < 3.5 ? 2.5 : m < 7.5 ? 5 : 10) * pow;
}

export function ForecastChart({
  sim,
  compare,
  baseLabel = 'Todennäköisin',
  compareLabel = 'Muutoksen jälkeen',
  height = 320,
}: {
  sim: SimResult;
  compare?: SimResult;
  baseLabel?: string;
  compareLabel?: string;
  height?: number;
}) {
  const k = 1;
  const { progress, replay, reduced } = useChartAnimation(JSON.stringify([sim, compare]));
  const [w, setW] = useState(300);
  const fs = 16;
  const pad = { l: 84, r: 24, t: 16, b: 36 };
  const all = [...sim.p10, ...sim.p90, ...(compare ? [...compare.p10, ...compare.p90] : []), 0];
  const step = niceStep(Math.max(...all) - Math.min(...all) || 1);
  const lo = Math.floor(Math.min(...all) / step) * step;
  const hi = Math.ceil(Math.max(...all) / step) * step;
  const span = hi - lo || 1;
  const n = sim.dates.length;
  const x = (i: number) => pad.l + (i / Math.max(1, n - 1)) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / span) * (height - pad.t - pad.b);
  const line = (arr: number[]) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const band = (a: number[], b: number[]) =>
    `${line(a)} ${b
      .map((v, i) => [i, v] as const)
      .reverse()
      .map(([i, v]) => `L${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
      .join(' ')} Z`;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-6; v += step) ticks.push(v);
  const monthIdx = sim.dates.map((d, i) => (d.endsWith('-01') ? i : -1)).filter((i) => i >= 0);
  const main = compare ? compare : sim;
  const lastI = n - 1;

  const legend = (color: string, label: string, value: number, dashed?: boolean) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 * k }}>
      <View style={{ width: 22 * k, height: 3.5 * k, borderRadius: 2, backgroundColor: dashed ? 'transparent' : color, borderTopWidth: dashed ? 3 * k : 0, borderStyle: 'dashed', borderColor: color, marginRight: 10 * k }} />
      <Text style={{ flex: 1, fontSize: 18 * k, color: C.text }}>{label}</Text>
      <Text style={{ fontSize: 18 * k, fontWeight: '700', color: value < 0 ? C.danger : C.greenText }}>{eur0(value)}</Text>
    </View>
  );

  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      <Svg testID="forecast-plot" width={w} height={height}>
        {ticks.map((t) => (
          <React.Fragment key={t}>
            <Line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#9AA39E' : '#E7ECE8'} strokeWidth={t === 0 ? 1.4 : 1} />
            <SvgText x={pad.l - 10 * k} y={y(t) + fs * 0.35} fontSize={fs} fontFamily={FONT} fill={t < 0 ? C.danger : C.sub} textAnchor="end">
              {eur0(t)}
            </SvgText>
          </React.Fragment>
        ))}
        {monthIdx.map((i) => (
          <SvgText key={i} x={x(i)} y={height - 8 * k} fontSize={fs} fontFamily={FONT} fill={C.sub} textAnchor="middle">
            {shortMonth(sim.dates[i])}
          </SvgText>
        ))}
        <LineReveal progress={progress} width={w} height={height}>
        <Path d={band(main.p90, main.p10)} fill={C.green} opacity={0.13} />
        {compare && <Path d={line(sim.p50)} stroke="#8E9691" strokeWidth={2.6 * k} strokeDasharray={`${8 * k} ${6 * k}`} fill="none" />}
        <Path d={line(main.p50)} stroke={C.greenDark} strokeWidth={3.4 * k} fill="none" strokeLinejoin="round" />
        <Circle cx={x(lastI)} cy={y(main.p50[lastI])} r={5.5 * k} fill="#fff" stroke={C.greenDark} strokeWidth={3 * k} />
        </LineReveal>
      </Svg>
      <View style={{ marginTop: 14 * k }}>
        {compare ? (
          <>
            {legend('#8E9691', baseLabel, sim.end.p50, true)}
            {legend(C.greenDark, compareLabel, compare.end.p50)}
          </>
        ) : (
          legend(C.greenDark, `${baseLabel} ${sim.dates[lastI].slice(8, 10).replace(/^0/, '')}.${+sim.dates[lastI].slice(5, 7)}.`, sim.end.p50)
        )}
        <Text style={{ fontSize: 16 * k, color: C.sub, marginTop: 2 * k }}>Vaalea alue: 80 % todennäköinen vaihteluväli</Text>
      </View>
      {reduced === false && <Pressable accessibilityRole="button" onPress={replay} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ fontSize: 16, color: C.greenText, textDecorationLine: 'underline' }}>Toista rakentuminen</Text></Pressable>}
    </View>
  );
}
