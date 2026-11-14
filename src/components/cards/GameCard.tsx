import React, { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import Svg, { Path, Rect, Text as SvgText } from 'react-native-svg';
import type { Card } from '../../agent/types';
import type { GameQ } from '../../finance/insights';
import { HandsUpIcon } from '../../icons';
import { C } from '../../theme';
import { PerTieeriPortrait } from '../PerTieeriPortrait';
import { useK } from '../scale';
import { S_PATH } from '../SLogo';
import { Text, TextInput } from '../Text';

/**
 * Kuukauden talouskoetus: asiakkaan omasta edellisestä kuukaudesta generoidut kysymykset.
 * Monivalinnat + numeroarviot (hyväksytään riittävän lähellä oleva vastaus), lyhyt opettava palaute,
 * Per Tieerin ilme reagoi. Lopussa S-Etukortin näköinen palkintokortti (KONSEPTI – ei oikea etu).
 */
export function GameCard({ card }: { card: Extract<Card, { kind: 'game' }> }) {
  const k = useK();
  const qs = card.questions;
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState<string>('');
  const [result, setResult] = useState<null | { ok: boolean; why: string }>(null);
  const [score, setScore] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const done = i >= qs.length;
  const q: GameQ | undefined = qs[i];

  const check = (choice?: number) => {
    if (!q || result) return;
    let ok = false;
    if (q.type === 'choice') ok = choice === q.correct;
    else {
      const v = parseFloat(answer.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
      ok = Number.isFinite(v) && Math.abs(v - q.answer) <= Math.max(10, Math.abs(q.answer) * q.tolerance);
    }
    if (ok) setScore((s) => s + 1);
    setResult({ ok, why: q.why });
  };
  const next = () => {
    setResult(null);
    setAnswer('');
    setI((x) => x + 1);
  };

  if (skipped)
    return (
      <View style={{ backgroundColor: '#fff', borderRadius: 16 * k, padding: 22 * k, marginTop: 4 * k }}>
        <Text style={{ fontSize: 19 * k, color: C.sub }}>Koetus ohitettu. Sen voi pyytää myöhemmin uudelleen.</Text>
      </View>
    );

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 16 * k, padding: 22 * k, marginTop: 4 * k, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 64 * k, height: 64 * k, borderRadius: 32 * k, backgroundColor: C.avatar, overflow: 'hidden', alignItems: 'center' }}>
          <View style={{ marginTop: 4 * k }}>
            <PerTieeriPortrait size={66 * k} />
          </View>
        </View>
        <View style={{ flex: 1, marginLeft: 14 * k }}>
          <Text style={{ fontSize: 22 * k, fontWeight: '700', color: C.text }}>{card.title}</Text>
          <View style={{ flexDirection: 'row', gap: 6 * k, marginTop: 8 * k }}>
            {qs.map((_, j) => (
              <View key={j} style={{ flex: 1, height: 6 * k, borderRadius: 3 * k, backgroundColor: j < i || (j === i && result) ? C.greenDark : '#E3EAE5' }} />
            ))}
          </View>
        </View>
      </View>

      {!done && q && (
        <View style={{ marginTop: 20 * k }}>
          <Text style={{ fontSize: 15.5 * k, color: C.sub, marginBottom: 6 * k }}>
            Kysymys {i + 1}/{qs.length}
          </Text>
          <Text style={{ fontSize: 21 * k, lineHeight: 29 * k, fontWeight: '600', color: C.text, marginBottom: 16 * k }}>{q.q}</Text>
          {q.type === 'choice' ? (
            q.options.map((o, j) => {
              const show = !!result;
              const right = j === q.correct;
              return (
                <Pressable
                  key={j}
                  disabled={!!result}
                  onPress={() => check(j)}
                  style={({ pressed }) => [
                    {
                      borderWidth: 2 * k,
                      borderColor: show && right ? C.greenDark : '#D5DDD8',
                      backgroundColor: show && right ? C.greenDark : '#fff',
                      borderRadius: 14 * k,
                      paddingVertical: 18 * k,
                      paddingHorizontal: 20 * k,
                      marginBottom: 10 * k,
                    },
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Text style={{ fontSize: 20 * k, fontWeight: '600', color: show && right ? '#fff' : C.text }}>{o}</Text>
                </Pressable>
              );
            })
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 * k }}>
              <View style={{ flex: 1, height: 64 * k, backgroundColor: '#F3F3F3', borderRadius: 32 * k, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22 * k }}>
                <TextInput value={answer} onChangeText={setAnswer} editable={!result} keyboardType="numeric" placeholder="Arvionne" placeholderTextColor="#8E8E8E" onSubmitEditing={() => check()} style={{ flex: 1, fontSize: 22 * k, color: C.text }} />
                <Text style={{ fontSize: 22 * k, color: C.sub }}>{q.unit}</Text>
              </View>
              {!result && (
                <Pressable onPress={() => check()} style={{ height: 64 * k, paddingHorizontal: 24 * k, borderRadius: 32 * k, backgroundColor: C.greenDark, justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 20 * k, fontWeight: '700' }}>Vastaa</Text>
                </Pressable>
              )}
            </View>
          )}
          {result && (
            <View style={{ marginTop: 14 * k, backgroundColor: result.ok ? C.mint : '#FFF6E8', borderRadius: 12 * k, padding: 16 * k }}>
              <Text style={{ fontSize: 19 * k, lineHeight: 27 * k, color: C.text }}>
                <Text style={{ fontWeight: '700', color: result.ok ? C.greenText : '#A86A12' }}>{result.ok ? 'Oikein! ' : 'Melkein. '}</Text>
                {result.why}
              </Text>
              <Pressable onPress={next} style={{ alignSelf: 'flex-end', marginTop: 10 * k, paddingVertical: 10 * k, paddingHorizontal: 20 * k, borderRadius: 999, backgroundColor: C.greenDark }}>
                <Text style={{ color: '#fff', fontSize: 18 * k, fontWeight: '700' }}>{i + 1 < qs.length ? 'Seuraava' : 'Katso tulos'}</Text>
              </Pressable>
            </View>
          )}
          {!result && i === 0 && (
            <Pressable onPress={() => setSkipped(true)} hitSlop={8} style={{ alignSelf: 'center', marginTop: 12 * k }}>
              <Text style={{ fontSize: 17 * k, color: C.greenText, textDecorationLine: 'underline' }}>Ohita koetus</Text>
            </Pressable>
          )}
        </View>
      )}

      {done && <Reward k={k} score={score} total={qs.length} />}
    </View>
  );
}

/** Animoitu S-Etukortin näköinen palkintokortti (liukuu esiin ja kääntyy) */
function Reward({ k, score, total }: { k: number; score: number; total: number }) {
  const [v] = useState(() => new Animated.Value(0));
  const passed = score >= Math.ceil(total * 0.6);
  useEffect(() => {
    Animated.sequence([Animated.delay(200), Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true })]).start();
  }, [v]);
  const W = 300 * k;
  const H = W * 0.63;
  const sc = 0.15;
  return (
    <View style={{ alignItems: 'center', marginTop: 22 * k }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 * k }}>
        {passed && <HandsUpIcon size={34 * k} />}
        <Text style={{ fontSize: 24 * k, fontWeight: '700', color: C.greenText }}>
          {score}/{total} oikein
        </Text>
      </View>
      <Text style={{ fontSize: 18 * k, lineHeight: 26 * k, color: C.sub, textAlign: 'center', marginTop: 6 * k, marginBottom: 18 * k }}>
        {passed ? 'Tunnette taloutenne erinomaisesti.' : 'Hyvä alku – ensi kuussa tunnette luvut vielä paremmin.'}
      </Text>
      <Animated.View
        style={{
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [40 * k, 0] }) }, { perspective: 800 }, { rotateY: v.interpolate({ inputRange: [0, 1], outputRange: ['70deg', '0deg'] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
        }}
      >
        <Svg width={W} height={H} viewBox="0 0 300 189">
          <Rect x={0} y={0} width={300} height={189} rx={14} fill={passed ? '#00AE42' : '#9AA39E'} />
          <SvgText x={20} y={30} fill="#fff" fontSize={15} fontFamily="Figtree-700">
            S-ETUKORTTI
          </SvgText>
          <Path d={S_PATH} transform={`translate(${210 - 171 * sc} ${100 - 183.5 * sc}) scale(${sc})`} stroke="#fff" strokeWidth={19} fill="none" />
          <SvgText x={20} y={118} fill="#fff" fontSize={26} fontFamily="Figtree-800">
            {passed ? 'Talousosaaja' : 'Harjoittelija'}
          </SvgText>
          <SvgText x={20} y={144} fill="#fff" fontSize={13} fontFamily="Figtree-500">
            {passed ? 'Kuukauden koetus läpäisty' : `${score}/${total} oikein`}
          </SvgText>
          <SvgText x={20} y={174} fill="#fff" fontSize={11} fontFamily="Figtree-500" opacity={0.85}>
            Palkitsemiskonsepti – ei oikea S-Bonus-etu
          </SvgText>
        </Svg>
      </Animated.View>
    </View>
  );
}
