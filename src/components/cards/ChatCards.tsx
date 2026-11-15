import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import type { Card } from '../../agent/types';
import { eur0 } from '../../finance/analytics';
import { AlertIcon, AppIcon, BulbIcon, CoinsIcon, HandsUpIcon, JarsIcon, TargetIcon, TrendIcon } from '../../icons';
import { useStore } from '../../state/store';
import { C } from '../../theme';
import { useK } from '../scale';
import { Text } from '../Text';
import { Rich } from '../ui';
import { BasketsCard } from './BasketsCard';
import { BlocksCard } from './BlocksCard';
import { SpendingGridCard } from './SpendingGridCard';
import { ForecastChart } from './ForecastChart';
import { GameCard } from './GameCard';
import { WhatIfCard } from './WhatIfCard';
import { GoalPlansCard } from './GoalPlansCard';
import { DataChart } from '../charts/DataChart';
import { GrowingBar } from '../charts/AnimatedPrimitives';
import { CountUp } from '../charts/CountUp';

/**
 * Per Tieerin vastausten visualisoinnit S-mobiilin tyyliin:
 * valkoinen kortti (pyöristys 16), otsikkorivillä S-Pankin kuvitusikoni minttupallossa,
 * Figtree-fontti sovelluksen kokoasteikolla (k), summat muodossa "1 234 €", ei emojeja.
 */
const WARN = '#A86A12';
const toneColor = (t?: string) => (t === 'good' ? C.greenText : t === 'warn' ? WARN : t === 'bad' ? C.danger : C.text);

function Shell({ title, icon, children }: { title?: string; icon?: React.ReactNode; art?: string | null; children: React.ReactNode }) {
  const k = useK();
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 16 * k, padding: 24 * k, marginTop: 4 * k }}>
      {title ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 * k }}>
          {icon ? (
            <View style={{ width: 50 * k, height: 50 * k, borderRadius: 25 * k, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center', marginRight: 14 * k }}>
              {icon}
            </View>
          ) : null}
          <Text style={{ flex: 1, fontSize: Math.max(21, 23 * k), lineHeight: Math.max(23, 30 * k), fontWeight: '700', color: C.text }}>{title}</Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function CardView({ card }: { card: Card }) {
  const k = useK();
  const ic = 28 * k;
  const art = card.kind === 'stat' && card.art === 'selviytymisaika' ? card.art : null;
  switch (card.kind) {
    case 'spendingGrid':
      return <SpendingGridCard data={card.data} />;
    case 'baskets':
      return (
        <Shell title="Kolme rahakoria" icon={<JarsIcon size={ic} />}>
          <BasketsCard months={card.months} />
        </Shell>
      );
    case 'blocks':
      return (
        <Shell art={art} title="Mihin 1 000 € meni?" icon={<CoinsIcon size={ic} />}>
          <BlocksCard />
        </Shell>
      );
    case 'whatif':
      return (
        <Shell art={art} title="Mitä jos? Kokeile muutoksia" icon={<TrendIcon size={ic} />}>
          <WhatIfCard preset={card.preset} scenarioName={card.scenarioName} />
        </Shell>
      );
    case 'forecast':
      return (
        <Shell art={art} title={card.title} icon={<TrendIcon size={ic} />}>
          <ForecastChart sim={card.sim} compare={card.compare} baseLabel={card.baseLabel} compareLabel={card.compareLabel} />
        </Shell>
      );
    case 'stat':
      return (
        <View style={{ backgroundColor: '#fff', borderRadius: 16 * k, padding: 24 * k, marginTop: 4 * k }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 64 * k, height: 64 * k, borderRadius: 32 * k, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center', marginRight: 18 * k }}>
            {card.icon ? <AppIcon name={card.icon} size={34 * k} /> : <CoinsIcon size={34 * k} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: Math.max(16, 19 * k), color: C.sub, fontWeight: '500' }}>{card.label}</Text>
            <Text style={{ fontSize: Math.max(16, 40 * k), lineHeight: Math.max(23, 48 * k), fontWeight: '700', color: card.tone ? toneColor(card.tone) : C.greenText, letterSpacing: -0.5 * k }}>{art ? <CountUp text={card.value} /> : card.value}</Text>
            {card.sub ? <Text style={{ fontSize: Math.max(16, 18 * k), lineHeight: Math.max(23, 25 * k), color: C.sub }}>{card.sub}</Text> : null}
          </View>
        </View>
        </View>
      );
    case 'list':
      return (
        <Shell art={art} title={card.title} icon={card.icon ? <AppIcon name={card.icon} size={ic} /> : undefined}>
          {card.items.map((it, i) => {
            const icon = it.icon ?? it.label;
            return (
              <View
                key={i}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16 * k, borderBottomWidth: i < card.items.length - 1 ? 1.5 * k : 0, borderBottomColor: C.divider }}
              >
                <View style={{ width: 32 * k, marginRight: 14 * k, alignItems: 'center' }}>
                  <AppIcon name={icon} size={28 * k} />
                </View>
                <View style={{ flex: 1, paddingRight: 10 * k }}>
                  <Text style={{ fontSize: Math.max(16, 21 * k), lineHeight: Math.max(23, 28 * k), color: C.text, fontWeight: '500' }}>{it.label}</Text>
                  {it.sub ? <Text style={{ fontSize: Math.max(16, 17.5 * k), lineHeight: Math.max(23, 24 * k), color: it.tone === 'bad' ? C.danger : it.tone === 'warn' ? WARN : C.sub }}>{it.sub}</Text> : null}
                </View>
                <Text style={{ fontSize: Math.max(16, 21 * k), fontWeight: '700', color: toneColor(it.tone) }}>{it.value}</Text>
              </View>
            );
          })}
        </Shell>
      );
    case 'bars': {
      const max = Math.max(...card.rows.map((r) => Math.max(r.value, r.peer ?? 0)), 1);
      return (
        <Shell art={art} title={card.title} icon={<CoinsIcon size={ic} />}>
          {card.rows.map((r) => {
            const over = r.peer != null && r.value > r.peer * 1.15;
            return (
              <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 * k }}>
                <View style={{ width: 32 * k, marginRight: 12 * k, alignItems: 'center' }}>
                  <AppIcon name={r.key ?? r.label} size={26 * k} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ gap: 5, marginBottom: 8 }}>
                    <Text style={{ fontSize: Math.max(16, 19 * k), color: C.text, fontWeight: '500' }}>{r.label}</Text>
                    <Text style={{ fontSize: Math.max(16, 19 * k), fontWeight: '700', color: over ? C.danger : C.text }}>
                      {eur0(r.value)}
                      {r.peer != null ? <Text style={{ color: C.sub, fontWeight: '400' }}> · muut {eur0(r.peer)}</Text> : null}
                    </Text>
                  </View>
                  <View style={{ height: 24, borderRadius: 5, backgroundColor: '#EDF2EE' }}>
                    <GrowingBar percent={r.value / max * 100} color={over ? C.coral : C.greenDark} />
                    {r.peer != null && (
                      <View style={{ position: 'absolute', left: `${(r.peer / max) * 100}%`, top: -4 * k, bottom: -4 * k, width: 2.5 * k, borderRadius: 2, backgroundColor: '#2B2B2B' }} />
                    )}
                  </View>
                </View>
              </View>
            );
          })}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 * k }}>
            <View style={{ width: 2.5 * k, height: 16 * k, backgroundColor: '#2B2B2B', marginRight: 8 * k, borderRadius: 2 }} />
            <Text style={{ fontSize: Math.max(16, 16.5 * k), color: C.sub, flex: 1 }}>{card.note ?? 'Viiva = samanikäisten keskiarvo'}</Text>
          </View>
        </Shell>
      );
    }
    case 'compare':
      return <CompareCard card={card} />;
    case 'chart':
      return <DataChart card={card} />;
    case 'game':
      return <GameCard card={card} />;
    case 'waterfall':
      return <WaterfallCard card={card} />;
    case 'lesson':
      return (
        <Shell title={card.title} icon={<BulbIcon size={ic} />}>
          <Rich text={card.body} style={{ fontSize: Math.max(16, 20 * k), lineHeight: Math.max(23, 29 * k), color: C.text }} />
        </Shell>
      );
    case 'plan':
      return <PlanCard card={card} />;
    case 'goalPlans':
      return <GoalPlansCard goal={card.goal} />;
    case 'quiz':
      return <QuizCard card={card} />;
    case 'question':
      return <QuestionCard card={card} />;
  }
}

/** Saldosta käyttövaraan: porrastettu erittely (show_cashflow) */
function WaterfallCard({ card }: { card: Extract<Card, { kind: 'waterfall' }> }) {
  const k = useK();
  const max = Math.max(1, card.start.value);
  const pct = (v: number) => `${Math.max(0, Math.min(100, (Math.abs(v) / max) * 100))}%` as const;
  // juokseva saldo jokaisen vaiheen jälkeen (lasketaan etukäteen, ei renderöinnin aikana muuttaen)
  const after = card.steps.reduce<number[]>((acc, st) => [...acc, (acc.length ? acc[acc.length - 1] : card.start.value) + st.value], []);
  const row = (label: string, value: number, bar: React.ReactNode, icon?: React.ReactNode, strong?: boolean) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 * k }}>
      <View style={{ width: 32 * k, marginRight: 12 * k, alignItems: 'center' }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 * k }}>
          <Text style={{ flex: 1, fontSize: Math.max(16, 18.5 * k), color: C.text, fontWeight: strong ? '700' : '500' }}>{label}</Text>
          <Text style={{ fontSize: Math.max(16, 18.5 * k), fontWeight: '700', color: strong ? (value < 0 ? C.danger : C.greenText) : value < 0 ? C.text : C.greenText }}>
            {value < 0 && !strong ? '−' : ''}
            {eur0(Math.abs(value) * (strong && value < 0 ? -1 : 1))}
          </Text>
        </View>
        <View style={{ height: 24, borderRadius: 5, backgroundColor: '#EDF2EE', overflow: 'hidden' }}>{bar}</View>
      </View>
    </View>
  );
  return (
    <Shell art="lompakko" title={card.title} icon={<CoinsIcon size={28 * k} />}>
      {row(card.start.label, card.start.value, <GrowingBar percent={Math.abs(card.start.value) / max * 100} color="#7BCB95" />, <AppIcon name="saldo" size={26 * k} />)}
      {card.steps.map((st, si) => {
        const left = Math.max(0, after[si]);
        const el = row(
          st.label,
          st.value,
          <View style={{ position: 'absolute', left: pct(left), width: pct(st.value), top: 0, bottom: 0 }}><GrowingBar percent={100} color={C.coral} /></View>,
          <AppIcon name={st.icon} size={26 * k} />,
        );
        return <React.Fragment key={st.label}>{el}</React.Fragment>;
      })}
      <View style={{ height: 1.5 * k, backgroundColor: C.divider, marginBottom: 14 * k }} />
      {row(card.end.label, card.end.value, <GrowingBar percent={Math.max(0, card.end.value) / max * 100} color={C.greenDark} />, <AppIcon name="kolikot" size={26 * k} />, true)}
      {card.note ? <Text style={{ fontSize: Math.max(16, 15.5 * k), color: C.sub }}>{card.note}</Text> : null}
    </Shell>
  );
}

/** Vertailu: oma luku vs. vertailuryhmä. origin erottaa aineiston asiakkaat ja Tilastokeskuksen selvästi. */
function CompareCard({ card }: { card: Extract<Card, { kind: 'compare' }> }) {
  const k = useK();
  const fmt = (v: number) => (card.unit === '%' ? `${Math.round(v)} %` : eur0(v));
  const vals = card.rows.flatMap((r) => [r.user, r.ref ?? 0, r.p75 ?? 0]).map((v) => Math.abs(v));
  const max = Math.max(1, ...vals) * 1.08;
  const isStat = card.origin === 'statfin';
  return (
    <Shell art="pylvaat" title={card.title} icon={isStat ? <TrendIcon size={28 * k} /> : <JarsIcon size={28 * k} />}>
      <View style={{ alignSelf: 'flex-start', backgroundColor: isStat ? '#E4F1FB' : C.mint, borderRadius: 999, paddingHorizontal: 12 * k, paddingVertical: 4 * k, marginTop: -6 * k, marginBottom: 16 * k }}>
        <Text style={{ fontSize: Math.max(16, 15 * k), fontWeight: '700', color: isStat ? '#1D4E7A' : C.greenText }}>{isStat ? 'Tilastokeskus · Suomen väestö' : 'Muut S-Pankin asiakkaat'}</Text>
      </View>
      {card.rows.map((r) => {
        const w = (v: number) => `${Math.max(0, Math.min(100, (Math.abs(v) / max) * 100))}%` as const;
        const over = !isStat && r.ref != null && r.user > r.ref * 1.15 && card.unit !== '%';
        return (
          <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 * k }}>
            <View style={{ width: 32 * k, marginRight: 12 * k, alignItems: 'center' }}>
              <AppIcon name={r.key ?? r.label} size={26 * k} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ gap: 5, marginBottom: 8 }}>
                <Text style={{ fontSize: Math.max(16, 19 * k), color: C.text, fontWeight: '500', flex: 1 }}>{r.label}</Text>
                <Text style={{ fontSize: Math.max(16, 19 * k), fontWeight: '700', color: over ? C.danger : C.greenText }}>
                  {fmt(r.user)}
                  {r.ref != null ? <Text style={{ color: C.sub, fontWeight: '400' }}> · {fmt(r.ref)}</Text> : null}
                </Text>
              </View>
              <View style={{ height: 24, borderRadius: 5, backgroundColor: '#EDF2EE' }}>
                {r.p25 != null && r.p75 != null && (
                  <View style={{ position: 'absolute', left: w(r.p25), width: `${((Math.abs(r.p75) - Math.abs(r.p25)) / max) * 100}%`, top: 0, bottom: 0, backgroundColor: '#CFE9D6' }} />
                )}
                <GrowingBar percent={Math.abs(r.user) / max * 100} color={over ? C.coral : C.greenDark} />
                {r.ref != null && <View style={{ position: 'absolute', left: w(r.ref), top: -5 * k, bottom: -5 * k, width: 3 * k, borderRadius: 2, backgroundColor: '#2B2B2B' }} />}
              </View>
              {r.note ? <Text style={{ fontSize: Math.max(16, 15 * k), color: C.sub, marginTop: 4 * k }}>{r.note}</Text> : null}
            </View>
          </View>
        );
      })}
      <View style={{ borderTopWidth: 1.5 * k, borderTopColor: C.divider, paddingTop: 12 * k, gap: 4 * k }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 * k }}>
          <View style={{ width: 22 * k, height: 10 * k, borderRadius: 5 * k, backgroundColor: C.greenDark }} />
          <Text style={{ fontSize: Math.max(16, 15.5 * k), color: C.text }}>Te</Text>
          <View style={{ width: 3 * k, height: 16 * k, backgroundColor: '#2B2B2B', marginLeft: 10 * k }} />
          <Text style={{ fontSize: Math.max(16, 15.5 * k), color: C.text, flex: 1 }}>{card.statistic}</Text>
        </View>
        <Text style={{ fontSize: Math.max(16, 15.5 * k), color: C.sub }}>Vertailuryhmä: {card.group}</Text>
        <Text style={{ fontSize: Math.max(16, 15.5 * k), color: C.sub }}>Jakso: {card.period}</Text>
        <Text style={{ fontSize: Math.max(16, 15.5 * k), color: C.sub }}>Lähde: {card.source}</Text>
        {card.note ? <Text style={{ fontSize: Math.max(16, 15.5 * k), color: C.sub }}>{card.note}</Text> : null}
      </View>
    </Shell>
  );
}

/** S-mobiilin painike: täytetty vihreä pilleri tai vihreäreunainen */
function SButton({ label, onPress, outline, disabled }: { label: string; onPress: () => void; outline?: boolean; disabled?: boolean }) {
  const k = useK();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        { borderRadius: 999, paddingVertical: 15 * k, paddingHorizontal: 22 * k, alignItems: 'center', borderWidth: 2 * k, borderColor: C.greenDark, backgroundColor: outline ? '#fff' : C.greenDark },
        pressed && { opacity: 0.8 },
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text style={{ fontSize: Math.max(16, 21 * k), fontWeight: '700', color: outline ? C.greenText : '#fff' }}>{label}</Text>
    </Pressable>
  );
}

function PlanCard({ card }: { card: Extract<Card, { kind: 'plan' }> }) {
  const { send } = useStore();
  const k = useK();
  const [done, setDone] = useState<string | null>(null);
  const p = card.plan;
  return (
    <Shell title={card.title} icon={<TargetIcon size={28 * k} />}>
      {p.items.length === 0 && <Text style={{ fontSize: Math.max(16, 20 * k), color: C.text }}>Ei tarvittavia muutoksia.</Text>}
      {p.items.map((it) => (
        <View key={it.key} style={{ marginBottom: 20 * k }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 * k }}>
            <View style={{ width: 32 * k, marginRight: 12 * k, alignItems: 'center' }}>
              <AppIcon name={it.key} size={26 * k} />
            </View>
            <Text style={{ flex: 1, fontSize: Math.max(16, 20 * k), fontWeight: '600', color: C.text }}>
              {it.label} <Text style={{ color: C.sub, fontWeight: '500' }}>−{it.pct} %</Text>
            </Text>
            <Text style={{ fontSize: Math.max(16, 20 * k), fontWeight: '700', color: C.greenText }}>+{eur0(it.saving)}/kk</Text>
          </View>
          <Text style={{ fontSize: Math.max(16, 17.5 * k), lineHeight: Math.max(23, 25 * k), color: C.sub, marginLeft: 44 * k }}>
            {it.overPeer ? 'Kulutat tähän ikäryhmääsi enemmän, joten tämä on helpoin paikka. ' : ''}
            {it.tip}
          </Text>
          {!done && (
            <Pressable onPress={() => send(`§plan|reject|${it.key}`)} hitSlop={6} style={{ marginLeft: 44 * k, marginTop: 6 * k }}>
              <Text style={{ fontSize: Math.max(16, 17.5 * k), color: C.greenText, fontWeight: '600', textDecorationLine: 'underline' }}>En halua tinkiä tästä</Text>
            </Pressable>
          )}
        </View>
      ))}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1.5 * k, borderTopColor: C.divider, paddingTop: 16 * k, marginBottom: 18 * k }}>
        <Text style={{ fontSize: Math.max(16, 21 * k), fontWeight: '600', color: C.text }}>Yhteensä</Text>
        <Text style={{ fontSize: Math.max(16, 21 * k), fontWeight: '700', color: C.greenText }}>
          {eur0(p.total)}/kk{!p.feasible ? ` (tavoite ${eur0(p.target)})` : ''}
        </Text>
      </View>
      {p.items.length > 0 &&
        (done ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 * k }}>
            <HandsUpIcon size={34 * k} />
            <Text style={{ fontSize: Math.max(16, 20 * k), fontWeight: '700', color: C.greenText }}>{done}</Text>
          </View>
        ) : (
          <SButton
            label="Hyväksy suunnitelma"
            onPress={() => {
              setDone('Suunnitelma hyväksytty');
              send(`§plan|accept|${p.items.map((i) => i.key).join(',')}`);
            }}
          />
        ))}
    </Shell>
  );
}

function QuizCard({ card }: { card: Extract<Card, { kind: 'quiz' }> }) {
  const { quiz, setQuiz } = useStore();
  const k = useK();
  const chosen = quiz[card.id];
  const answered = chosen != null;
  return (
    <Shell title="Pikatehtävä" icon={<BulbIcon size={28 * k} />}>
      <Text style={{ fontSize: Math.max(16, 20 * k), lineHeight: Math.max(23, 28 * k), fontWeight: '600', color: C.text, marginBottom: 14 * k }}>{card.q}</Text>
      {card.options.map((o, i) => {
        const right = i === card.correct;
        const picked = chosen === i;
        const bg = answered && right ? C.greenDark : answered && picked ? C.coral : '#fff';
        return (
          <Pressable
            key={i}
            disabled={answered}
            onPress={() => setQuiz(card.id, i)}
            style={{ borderWidth: 2 * k, borderColor: answered && (right || picked) ? bg : '#D5DDD8', backgroundColor: bg, borderRadius: 12 * k, paddingVertical: 14 * k, paddingHorizontal: 18 * k, marginBottom: 10 * k }}
          >
            <Text style={{ fontSize: Math.max(16, 19 * k), color: answered && (right || picked) ? '#fff' : C.text, fontWeight: '500' }}>{o}</Text>
          </Pressable>
        );
      })}
      {answered && (
        <View style={{ flexDirection: 'row', gap: 12 * k, marginTop: 6 * k }}>
          {chosen === card.correct ? <HandsUpIcon size={30 * k} /> : <BulbIcon size={30 * k} />}
          <Text style={{ flex: 1, fontSize: Math.max(16, 19 * k), lineHeight: Math.max(23, 27 * k), color: C.text }}>
            <Text style={{ fontWeight: '700' }}>{chosen === card.correct ? 'Oikein! ' : 'Melkein. '}</Text>
            {card.why}
          </Text>
        </View>
      )}
    </Shell>
  );
}

function QuestionCard({ card }: { card: Extract<Card, { kind: 'question' }> }) {
  const { send, answers } = useStore();
  const k = useK();
  const ans = answers[card.id];
  return (
    <Shell title={card.title} icon={<AlertIcon size={28 * k} />}>
      <Text style={{ fontSize: Math.max(16, 19 * k), lineHeight: Math.max(23, 27 * k), color: C.text }}>{card.detail}</Text>
      <Text style={{ fontSize: Math.max(16, 19 * k), lineHeight: Math.max(23, 27 * k), fontWeight: '700', color: C.text, marginTop: 12 * k }}>{card.question}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 * k, marginTop: 14 * k }}>
        {card.options.map((o) => (
          <Pressable
            key={o}
            disabled={!!ans}
            onPress={() => send(`§ans|${card.id}|${o}`)}
            style={{ borderWidth: 2 * k, borderColor: C.greenDark, backgroundColor: ans === o ? C.greenDark : '#fff', borderRadius: 999, paddingHorizontal: 18 * k, paddingVertical: 10 * k, opacity: ans && ans !== o ? 0.4 : 1 }}
          >
            <Text style={{ fontSize: Math.max(16, 18 * k), fontWeight: '600', color: ans === o ? '#fff' : C.greenText }}>{o}</Text>
          </Pressable>
        ))}
      </View>
    </Shell>
  );
}
