import React, { useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import type { Card } from '../../agent/types';
import { gameBonus, gameCoupon, gamePoints, parseGameAnswer } from '../../finance/insights';
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
    // viimeinen vastaus: ansaittu S-Bonus talteen (näkyy etusivun Bonus-talossa)
    if (qs.every((_, j) => j === index || answered(j))) setQuiz(`bonus:${id}`, gameBonus(score + gamePoints(q, value)));
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
    {!done && index === 0 && result === null && <View style={s.intro}>
      <Text style={s.introLine}>5 kysymystä omasta kuukaudestanne</Text>
      <Text style={s.introLine}>Jokainen piste = <Text style={{ fontWeight: '800', color: C.greenText }}>0,20 € S-Bonusta</Text></Text>
      <Text style={s.introLine}>Lopuksi <Text style={{ fontWeight: '800', color: C.greenText }}>bonuskuponki</Text></Text>
    </View>}
    <Animated.View testID="game-page" style={motion.style}>
      {!done && q && <View style={{ marginTop: 20, gap: 12 }}>
        <Text style={s.label}>Kysymys {index + 1}/{qs.length}</Text>
        <Text accessibilityRole="header" style={s.question}>{q.q}</Text>
        {q.type === 'choice' ? q.options.map((option, j) => {
          const right = result !== null && j === q.correct;
          const selected = result !== null && quiz[answerKey(index)] === j;
          return <Pressable key={option} accessibilityRole="button" accessibilityState={{ disabled: result !== null || motion.busy, selected }} disabled={result !== null || motion.busy} onPress={() => check(j)}
            style={({ pressed }) => [s.option, right && { backgroundColor: C.greenDark, borderColor: C.greenDark }, selected && !right && { borderColor: '#A86A12', backgroundColor: '#FFF6E8' }, pressed && { opacity: 0.7 }]}>
            <Text style={[s.optionText, { color: right ? '#fff' : C.text }]}>{option}</Text>
          </Pressable>;
        }) : <View style={{ gap: 10 }}>
          <TextInput accessibilityLabel="Oma arvio euroina" value={result !== null ? String(quiz[answerKey(index)]).replace('.', ',') : draft} onChangeText={text => setDrafts(previous => ({ ...previous, [index]: text }))} editable={result === null && !motion.busy} keyboardType="decimal-pad" placeholder="Arvio euroina" placeholderTextColor={C.sub} onSubmitEditing={() => check()} style={s.input} />
          {result === null && <Pressable accessibilityRole="button" disabled={number === null || motion.busy} onPress={() => check()} style={[s.action, (number === null || motion.busy) && { backgroundColor: '#C9D3CD' }]}><Text style={s.actionText}>Vastaa</Text></Pressable>}
        </View>}
        {result !== null && <View accessibilityLiveRegion="polite" style={[s.feedback, { backgroundColor: result > 0 ? C.mint : '#FFF6E8' }]}>
          <Text style={[s.body, { fontSize: 20, fontWeight: '800', color: result > 0 ? C.greenText : '#A86A12' }]}>{result === 2 ? 'Oikein!' : result >= 1 ? 'Lähellä!' : result > 0 ? 'Suunta oikea!' : 'Tästä opimme.'} +{pts(result)} pistettä</Text>
          <Text style={s.body}>{q.why}</Text>
        </View>}
      </View>}
      {done && <Reward score={score} total={qs.length * 2} />}
    </Animated.View>
    <View style={s.navigation}>
      <PageArrow direction={-1} disabled={index === 0 || motion.busy} label="Edellinen kysymys" onPress={() => go(-1)} />
      <Text style={[s.body, { flex: 1, textAlign: 'center', fontWeight: '700', color: C.greenText }]}>{pts(score)} pistettä</Text>
      <PageArrow direction={1} disabled={done || result === null || motion.busy} label={index + 1 === qs.length ? 'Katso tulos' : 'Seuraava kysymys'} onPress={() => go(1)} />
    </View>
    {!done && <Pressable accessibilityRole="button" onPress={() => setSkipped(true)} style={{ padding: 12, alignSelf: 'center' }}><Text style={[s.body, { color: C.greenText, textDecorationLine: 'underline' }]}>Jatkan myöhemmin</Text></Pressable>}
  </View>;
}

const pts = (n: number) => n.toLocaleString('fi-FI', { maximumFractionDigits: 1 });
const eur = (n: number) => `${n.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

function Reward({ score, total }: { score: number; total: number }) {
  const coupon = gameCoupon(score, total);
  return <View testID="game-reward" style={{ gap: 14, marginTop: 22, alignItems: 'center' }}>
    <Text style={[s.title, { fontSize: 30, lineHeight: 36 }]}>{pts(score)}/{total} pistettä</Text>
    <View style={s.bonus}>
      <Text style={{ color: C.greenText, fontSize: 20, fontWeight: '700' }}>S-Bonusta kertyi</Text>
      <Text style={{ color: C.greenText, fontSize: 44, lineHeight: 50, fontWeight: '800' }}>+{eur(gameBonus(score))}</Text>
    </View>
    <View testID="game-coupon" style={s.coupon}>
      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>BONUSKUPONKI · {coupon.level.toUpperCase()}</Text>
      <Text style={{ color: '#fff', fontSize: 44, lineHeight: 50, fontWeight: '800' }}>+{coupon.discount} %</Text>
      <Text style={{ color: '#fff', fontSize: 19, fontWeight: '700' }}>lisäbonusta seuraavasta ostoksesta</Text>
    </View>
  </View>;
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginTop: 4, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 21, lineHeight: 27, fontWeight: '700', color: C.greenText },
  progress: { flexDirection: 'row', gap: 6, marginTop: 10 },
  step: { flex: 1, height: 6, borderRadius: 3 },
  body: { fontSize: 17, lineHeight: 25, color: C.text },
  label: { fontSize: 17, color: C.greenText, fontWeight: '700' },
  intro: { marginTop: 14, gap: 8, backgroundColor: C.mint, borderRadius: 14, padding: 16 },
  introLine: { fontSize: 19, lineHeight: 26, color: C.text, fontWeight: '600' },
  optionText: { fontSize: 19, lineHeight: 25, fontWeight: '700' },
  bonus: { alignSelf: 'stretch', alignItems: 'center', backgroundColor: C.mint, borderRadius: 18, paddingVertical: 16 },
  question: { fontSize: 21, lineHeight: 29, fontWeight: '700', color: C.text },
  option: { paddingVertical: 18, paddingHorizontal: 18, minHeight: 60, borderRadius: 14, borderWidth: 2, borderColor: C.greenDark, justifyContent: 'center' },
  input: { fontSize: 22, color: C.text, minHeight: 56, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, backgroundColor: '#F3F3F3' },
  action: { backgroundColor: C.greenDark, padding: 14, borderRadius: 28, minHeight: 48, alignItems: 'center' },
  actionText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  feedback: { padding: 16, borderRadius: 14, gap: 8 },
  navigation: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 20 },
  coupon: { alignSelf: 'stretch', backgroundColor: C.greenDark, padding: 22, borderRadius: 18, gap: 6 },
});
