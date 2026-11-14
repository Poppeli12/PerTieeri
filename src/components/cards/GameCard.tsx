import React, { useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import type { Card } from '../../agent/types';
import { gameCoupon, gamePoints, parseGameAnswer } from '../../finance/insights';
import { useStore } from '../../state/store';
import { C } from '../../theme';
import { PerTieeriPortrait } from '../PerTieeriPortrait';
import { PageArrow } from '../SuggestionPager';
import { Text, TextInput } from '../Text';
import { useSlideTransition } from '../useSlideTransition';

/** Questions and answers come from this customer's transactions. Progress uses existing customer memory. */
export function GameCard({ card }: { card: Extract<Card, { kind: 'game' }> }) {
  const { quiz, setQuiz } = useStore();
  const qs = card.questions;
  // Older saved cards did not have an ID. Their month and question values keep the fallback stable.
  const id = card.id ?? `game-${card.ym}-${JSON.stringify(qs).split('').reduce((hash, c) => Math.imul(hash ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0}`;
  const answerKey = (index: number) => `${id}:${qs[index].id}`;
  const answered = (index: number) => Number.isFinite(quiz[answerKey(index)]);
  const firstUnanswered = qs.findIndex((_, index) => !answered(index));
  const allDone = qs.length > 0 && firstUnanswered === -1;
  const [index, setIndex] = useState(() => Math.max(0, Math.min(quiz[`${id}:page`] ?? (allDone ? qs.length : Math.max(0, firstUnanswered)), allDone ? qs.length : Math.max(0, firstUnanswered))));
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [skipped, setSkipped] = useState(false);
  const motion = useSlideTransition();
  const done = index >= qs.length && allDone;
  const q = qs[index];
  const result = q && answered(index) ? gamePoints(q, quiz[answerKey(index)]) : null;
  const score = qs.reduce((sum, question, j) => sum + (answered(j) ? gamePoints(question, quiz[answerKey(j)]) : 0), 0);
  const draft = drafts[index] ?? '';
  const number = parseGameAnswer(draft);

  const check = (choice?: number) => {
    if (!q || result !== null || motion.busy) return;
    const value = q.type === 'choice' ? choice : number;
    if (value === null || value === undefined || !Number.isFinite(value)) return;
    setQuiz(answerKey(index), value);
  };
  const go = (direction: -1 | 1) => {
    if ((direction < 0 && index === 0) || (direction > 0 && (result === null || done))) return;
    motion.slide(direction, () => {
      const next = index + direction;
      setIndex(next);
      setQuiz(`${id}:page`, next);
    });
  };

  if (!qs.length) return <View style={s.card}><Text style={s.body}>Tähän peliin ei ole riittävästi tilitapahtumia. Pyytäkää peli toiselta kuukaudelta.</Text></View>;
  if (skipped) return <View style={s.card}><Text style={s.body}>Voitte palata koetukseen myöhemmin.</Text><Pressable accessibilityRole="button" onPress={() => setSkipped(false)} style={s.action}><Text style={s.actionText}>Jatka peliä</Text></Pressable></View>;

  return <View testID="finance-game" style={s.card}>
    <View style={s.header}>
      <PerTieeriPortrait size={52} />
      <View style={{ flex: 1 }}>
        <Text style={s.title}>{card.title}</Text>
        <View style={s.progress} accessibilityLabel={`${qs.filter((_, j) => answered(j)).length}/${qs.length} kysymystä vastattu`}>
          {qs.map((question, j) => <View key={question.id} style={[s.step, { backgroundColor: answered(j) ? C.greenDark : '#E3EAE5' }]} />)}
        </View>
      </View>
    </View>
    {!done && <Text style={[s.body, { marginTop: 14, color: C.sub }]}>Kolme monivalintaa ja kaksi omaa euroarviota tilitapahtumistanne. Lopuksi saatte pisteet ja demokupongin. Kuponki ei ole lunastettava etu.</Text>}
    <Animated.View testID="game-page" style={motion.style}>
      {!done && q && <View style={{ marginTop: 20, gap: 12 }}>
        <Text style={s.label}>Kysymys {index + 1}/{qs.length} · {q.type === 'choice' ? 'Monivalinta' : 'Oma euroarvio'}</Text>
        <Text accessibilityRole="header" style={s.question}>{q.q}</Text>
        {q.type === 'choice' ? q.options.map((option, j) => {
          const right = result !== null && j === q.correct;
          const selected = result !== null && quiz[answerKey(index)] === j;
          return <Pressable key={option} accessibilityRole="button" accessibilityState={{ disabled: result !== null || motion.busy, selected }} disabled={result !== null || motion.busy} onPress={() => check(j)}
            style={({ pressed }) => [s.option, right && { backgroundColor: C.greenDark, borderColor: C.greenDark }, selected && !right && { borderColor: '#A86A12', backgroundColor: '#FFF6E8' }, pressed && { opacity: 0.7 }]}>
            <Text style={[s.body, { color: right ? '#fff' : C.text, fontWeight: '600' }]}>{option}{selected ? ' · Oma vastaus' : ''}{right ? ' · Oikein' : ''}</Text>
          </Pressable>;
        }) : <View style={{ gap: 10 }}>
          <Text style={s.body}>Kirjoittakaa arvio euroina. Lähelle osumisestakin saa pisteitä.</Text>
          <TextInput accessibilityLabel="Oma arvio euroina" value={result !== null ? String(quiz[answerKey(index)]).replace('.', ',') : draft} onChangeText={text => setDrafts(previous => ({ ...previous, [index]: text }))} editable={result === null && !motion.busy} keyboardType="decimal-pad" placeholder="Esimerkiksi 100" placeholderTextColor={C.sub} onSubmitEditing={() => check()} style={s.input} />
          {result === null && <Pressable accessibilityRole="button" disabled={number === null || motion.busy} onPress={() => check()} style={[s.action, (number === null || motion.busy) && { backgroundColor: '#C9D3CD' }]}><Text style={s.actionText}>Vastaa</Text></Pressable>}
        </View>}
        {result !== null && <View accessibilityLiveRegion="polite" style={[s.feedback, { backgroundColor: result > 0 ? C.mint : '#FFF6E8' }]}>
          <Text style={[s.body, { fontWeight: '700', color: C.greenText }]}>{result === 2 ? (q.type === 'choice' ? 'Oikein!' : 'Hyvin arvioitu!') : result === 1 ? 'Lähellä!' : 'Tästä opimme.'} {result}/2 pistettä</Text>
          <Text style={s.body}>{q.why}</Text>
        </View>}
      </View>}
      {done && <Reward score={score} total={qs.length * 2} />}
    </Animated.View>
    <View style={s.navigation}>
      <PageArrow direction={-1} disabled={index === 0 || motion.busy} label="Edellinen kysymys" onPress={() => go(-1)} />
      <Text style={[s.body, { flex: 1, textAlign: 'center', color: C.sub }]}>{done ? 'Vastauksia voi vielä selata' : result === null ? 'Vastatkaa ensin' : index + 1 === qs.length ? 'Katso tulos' : 'Seuraava kysymys'}</Text>
      <PageArrow direction={1} disabled={done || result === null || motion.busy} label={index + 1 === qs.length ? 'Katso tulos' : 'Seuraava kysymys'} onPress={() => go(1)} />
    </View>
    {!done && <Pressable accessibilityRole="button" onPress={() => setSkipped(true)} style={{ padding: 12, alignSelf: 'center' }}><Text style={[s.body, { color: C.greenText, textDecorationLine: 'underline' }]}>Jatkan myöhemmin</Text></Pressable>}
  </View>;
}

function Reward({ score, total }: { score: number; total: number }) {
  const coupon = gameCoupon(score, total);
  return <View testID="game-reward" style={{ gap: 14, marginTop: 22 }}>
    <Text style={s.question}>Koetus valmis!</Text>
    <Text style={[s.title, { fontSize: 30 }]}>{score}/{total} pistettä</Text>
    <Text style={s.body}>Pisteet kertovat tämän koetuksen vastauksista. Tärkeintä on, että opitte huomaamaan oman taloutenne tapoja.</Text>
    <View testID="game-coupon" style={s.coupon}>
      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>PER TIEERI · DEMOKUPONKI</Text>
      <Text style={{ color: '#fff', fontSize: 42, fontWeight: '800' }}>{coupon.discount} %</Text>
      <Text style={{ color: '#fff', fontSize: 23, fontWeight: '700' }}>{coupon.level}</Text>
      <View style={{ borderTopColor: '#A9D4BB', borderTopWidth: 1, borderStyle: 'dashed', marginVertical: 6 }} />
      <Text style={{ color: '#fff', fontSize: 16, lineHeight: 23 }}>Harjoittelupalkinto. Ei oikea alennus, S-Bonus-etu tai lunastettava kuponki.</Text>
    </View>
    <Text style={[s.body, { color: C.sub }]}>Pisteet 0–2: 2 % · 3–5: 5 % · 6–8: 10 % · 9–10: 15 %. Jokaisesta kysymyksestä saa enintään 2 pistettä.</Text>
  </View>;
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginTop: 4, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 21, lineHeight: 27, fontWeight: '700', color: C.greenText },
  progress: { flexDirection: 'row', gap: 6, marginTop: 10 },
  step: { flex: 1, height: 6, borderRadius: 3 },
  body: { fontSize: 17, lineHeight: 25, color: C.text },
  label: { fontSize: 16, color: C.sub, fontWeight: '600' },
  question: { fontSize: 21, lineHeight: 29, fontWeight: '700', color: C.text },
  option: { padding: 16, minHeight: 52, borderRadius: 14, borderWidth: 1.5, borderColor: '#D5DDD8' },
  input: { fontSize: 22, color: C.text, minHeight: 56, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, backgroundColor: '#F3F3F3' },
  action: { backgroundColor: C.greenDark, padding: 14, borderRadius: 28, minHeight: 48, alignItems: 'center' },
  actionText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  feedback: { padding: 16, borderRadius: 14, gap: 8 },
  navigation: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 20 },
  coupon: { backgroundColor: C.greenDark, padding: 22, borderRadius: 18, gap: 8 },
});
