import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { Msg } from '../agent/types';
import { CardView } from '../components/cards/ChatCards';
import { Chevron } from '../icons';
import { EmotionName, PerTieeri } from '../components/PerTieeri';
import { PerTieeriTabIcon } from '../components/PerTieeriTabIcon';
import { useK } from '../components/scale';
import { SCard, SM } from '../components/smobile';
import { Text, TextInput } from '../components/Text';
import { FadeIn } from '../components/ui';
import { RichBlocks } from '../components/RichBlocks';
import { SafeBoundary } from '../components/SafeBoundary';
import { useStore } from '../state/store';
import { GAME_PROMPT, SuggestionPager } from '../components/SuggestionPager';
import { C } from '../theme';
import { SortingScene } from '../components/buckets/SortingScene';

/**
 * Tuki = Per Tieeri -chat. Yksi iso, siisti keskustelunäkymä S-mobiilin tyyliin:
 * valkoinen yläpalkki, minttutausta, valkoiset kortit, tummanvihreät omat viestit,
 * harmaa pyöristetty kirjoituskenttä ja vihreä lähetysnappi. Ei alkukyselyä.
 */

const GRID_PROMPT = 'Katso kulujani ruudukkonäkymällä';

const STARTERS = [
  'Mihin rahani kuluvat eniten kuukausittain?',
  'Paljonko voin käyttää turvallisesti tällä viikolla?',
  'Riittävätkö rahani tuleviin laskuihin ja menoihin?',
  'Mistä menoistani voisin säästää 100 € kuukaudessa?',
  GRID_PROMPT,
  'Mitä pankki katsoo asuntolainassa, ja miltä minun lukuni näyttävät siihen verrattuna?',
  'Kerro asuntolainahakemuksestani: miksi se hyväksyttiin tai hylättiin?',
];

/** Kokeiltavia aloituksia (tuomareille ja käyttäjille) – Per Tieeri ratkaisee ne vapaasti työkaluillaan. */
const TRY_THESE = [
  GAME_PROMPT,
  GRID_PROMPT,
  'Näytä ympyrädiagrammi kulutuksestani viime kuussa',
  'Mihin viimeiset 1 000 euroa menivät?',
  'Voinko ostaa 700 € tietokoneen ensi viikolla?',
  'Tee minulle budjetti niin, että pystyn säästämään 200 € kuussa',
  'Varoita minua ajoissa, jos rahat eivät riitä vuokraan',
  'Mistä kaikista palveluista maksan kuukausittain?',
  'Kuinka kauan rahani riittäisivät ilman tuloja?',
  'Miksi rahaa jäi tässä kuussa vähemmän kuin viime kuussa?',
  'Paljonko minulla on rahaa joulukuun lopussa?',
  'Mitä jos vähennän ravintoloita 30 % ja takseja 50 %?',
  'Haluan säästää 2 000 € ensi kesään mennessä. Miten onnistun?',
  'Paljonko voin säästää turvallisesti kuukaudessa?',
  'Selitä hätärahasto ja näytä, mitä se tarkoittaisi minun taloudessani',
  'Miksi 1 500 € tilillä ei tarkoita, että voin käyttää 1 500 €?',
  'Kulutanko ravintoloihin enemmän kuin muut ikäiseni?',
  'Paljonko omarahoitusta tarvitsisin asuntolainaan?',
];

export function AgentScreen() {
  const st = useStore();
  const k = useK();
  useEffect(() => {
    st.markRead();
    // ei automaattista toista viestiä: ensimmäinen näkymä on vain lajittelu + monivalinnat
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: C.mint }}>
      <Header k={k} typing={st.typing} />
      <Chat k={k} />
    </View>
  );
}

/** Per Tieerin viimeisin tunnereaktio (uusimman vastauksen mood) */
function useReaction() {
  const { messages } = useStore();
  const m = [...messages].reverse().find((x) => x.from === 'bot');
  return m?.mood && m.mood !== 'perus' ? { emotion: m.mood as EmotionName, key: m.id } : null;
}
/** selvät tunteet, joilla esittelykortti vaihtuu hetkeksi tunneasentoon (ei herkästi) */
const STRONG = new Set(['innostunut', 'nauraa', 'vilkuttaa', 'vilkuttaa-iloisesti', 'yllattynyt', 'huolestunut', 'surullinen', 'hammentynyt', 'liikuttunut', 'narkastynyt', 'vihainen']);

function Header({ k, typing }: { k: number; typing: boolean }) {
  return (
    <View style={{ height: 96 * k, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 31 * k, borderBottomWidth: 1.5 * k, borderBottomColor: C.divider }}>
      <FaceAvatar size={62 * k} />
      <View style={{ flex: 1, marginLeft: 18 * k }}>
        <Text style={{ fontSize: 26 * k, fontWeight: '700', color: C.text }}>Per Tieeri</Text>
        <Text style={{ fontSize: 19 * k, color: typing ? C.greenText : C.sub, marginTop: 1 * k }}>{typing ? 'kirjoittaa…' : 'Henkilökohtainen talousvalmentajasi'}</Text>
      </View>
    </View>
  );
}

/** Sama keskitetty kasvokuva ylätunnisteessa, vastauksissa ja kirjoitusilmaisimessa (kuin alapalkin Tuki-napissa). */
function FaceAvatar({ size }: { size: number }) {
  return <PerTieeriTabIcon size={size} color={C.greenDark} />;
}

function Chat({ k }: { k: number }) {
  const { messages, typing, send, draft: text, setDraft: setText, scrollY, setScrollY, memoryStatus } = useStore();
  const [deskVisible, setDeskVisible] = useState(true);
  const scroll = useRef<any>(null);
  const initialCount = useRef(messages.length);
  const initialScroll = useRef(scrollY);
  const restored = useRef(false);
  const scrolledTo = useRef(new Set<string>());
  const previousCount = useRef(messages.length);
  // Esimerkkiviestit kirjoituskentän yläpuolella: Per Tieerin omat jatkoehdotukset, muuten 2 esimerkkiä.
  // Enintään 2, jotta teksti mahtuu kokonaan näkyviin.
  const lastBot = [...messages].reverse().find((m) => m.from === 'bot');
  const [examples] = useState(() => [GAME_PROMPT, ...TRY_THESE.filter(t => t !== GAME_PROMPT).sort(() => Math.random() - 0.5)]);
  // Kun peli on kerran aloitettu tai pelattu, sen aloitusta ei enää tarjota vaihtoehdoissa
  const gameStarted = messages.some((m) => m.cards?.some((c) => c.kind === 'game'));
  const offer = (list: string[]) => (gameStarted ? list.filter((t) => t !== GAME_PROMPT && !/talouspeli|peliä/i.test(t)) : list);
  const allChips = offer(typing ? [] : lastBot?.chips?.length ? lastBot.chips : lastBot ? examples.filter(c => c !== GRID_PROMPT) : examples);
  // Uusi vastaus aloittaa ehdotusten selauksen ensimmäiseltä sivulta.
  const chipKey = lastBot?.id ?? 'examples';

  const hasUserMessage = messages.some((message) => message.from === 'user');
  const latestHasChart = messages[messages.length - 1]?.from === 'bot' && !!messages[messages.length - 1]?.cards?.length;
  useEffect(() => {
    // Keep the default sorting scene visible until the user starts the conversation.
    if (messages.length <= previousCount.current) return;
    previousCount.current = messages.length;
    if (!hasUserMessage || latestHasChart) return;
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages.length, typing, hasUserMessage, latestHasChart]);

  const submit = (v?: string) => {
    const q = (v ?? text).trim();
    if (!q || typing) return;
    send(q);
    setText('');
  };
  const canSend = text.trim().length > 0 && !typing;
  // vain tekstiviestit (kaaviokortit eivät näy tässä yksinkertaisessa näkymässä); ensimmäinen viesti on aina tervehdys
  const shown = messages.filter((m) => m.text?.trim() || m.cards?.length);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {memoryStatus.startsWith('Tallennus epäonnistui') && <Text accessibilityRole="alert" style={{ fontSize: 16, padding: 12, color: C.danger }}>{memoryStatus}</Text>}
      <View style={{ flex: 1 }}>
      <ScrollView testID="chat-scroll" ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 26 * k, paddingBottom: 20 * k, gap: 18 * k }} keyboardShouldPersistTaps="handled" scrollEventThrottle={300}
        onContentSizeChange={() => {
          if (!restored.current) {
            restored.current = true;
            scroll.current?.scrollTo({ y: initialScroll.current, animated: false });
          }
        }}
        onScroll={(event) => {
          const y = event.nativeEvent.contentOffset.y;
          setDeskVisible(y < 570 * k);
          if (restored.current) setScrollY(y);
        }}>
        <Welcome k={k} active={deskVisible} onAsk={submit} hideGame={gameStarted} />
        {shown.map((m, i) => (
          <View key={m.id} onLayout={event => {
            // Uuden kaaviovastauksen alkuun vieritetään vain KERRAN. Kortin koon muuttuminen myöhemmin
            // (esim. pelin seuraava kysymys) ei saa siirtää näkymää.
            if (messages.length > initialCount.current && hasUserMessage && m.id === messages[messages.length - 1]?.id && m.from === 'bot' && m.cards?.length && !scrolledTo.current.has(m.id)) {
              scrolledTo.current.add(m.id);
              scroll.current?.scrollTo({ y: event.nativeEvent.layout.y, animated: true });
            }
          }}><SafeBoundary><Bubble k={k} m={m} first={m.from === 'bot' && shown[i - 1]?.from !== 'bot'} /></SafeBoundary></View>
        ))}
        {/* Per Tieeri muodostaa vastausta: kuva + kirjoituspisteet chatissa */}
        {typing && <View onLayout={() => scroll.current?.scrollToEnd({ animated: true })}><Typing k={k} /></View>}
      </ScrollView>
      </View>

      {/* ehdotukset */}
      <SuggestionPager key={chipKey} items={allChips} onSend={submit} />

      {/* kirjoituskenttä */}
      {/* alareunaan tilaa alapalkin pyöreille napeille, jotka nousevat palkin yli */}
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 24 * k, paddingTop: 16 * k, paddingBottom: 46 * k, borderTopWidth: 1.5 * k, borderTopColor: C.divider }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Kirjoita viesti"
          placeholderTextColor="#8E8E8E"
          onSubmitEditing={() => submit()}
          returnKeyType="send"
          style={{ flex: 1, height: 64 * k, backgroundColor: '#F3F3F3', borderRadius: 32 * k, paddingHorizontal: 26 * k, fontSize: 23 * k, color: C.text }}
        />
        <Pressable
          onPress={() => submit()}
          disabled={!canSend}
          accessibilityLabel="Lähetä"
          style={({ pressed }) => [
            { width: 64 * k, height: 64 * k, borderRadius: 32 * k, marginLeft: 14 * k, alignItems: 'center', justifyContent: 'center', backgroundColor: canSend ? C.greenDark : '#C9D3CD' },
            pressed && { transform: [{ scale: 0.94 }] },
          ]}
        >
          <Svg width={30 * k} height={30 * k} viewBox="0 0 24 24">
            <Path d="M12 19V5.5M6 11l6-6 6 6" stroke="#fff" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

/** Esittelyn hahmoalue: perusanimaationa kuittien lajittelu; selvissä tunteissa hetkeksi tunneasento. */
function HeroStage({ k, active }: { k: number; active: boolean }) {
  const reaction = useReaction();
  const [expiredKey, setExpiredKey] = useState('');
  const shown = reaction && STRONG.has(reaction.emotion) && reaction.key !== expiredKey ? reaction : null;
  useEffect(() => {
    if (!reaction || !STRONG.has(reaction.emotion)) return;
    const t = setTimeout(() => setExpiredKey(reaction.key), 6000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reaction?.key]);
  if (shown)
    return (
      <View style={{ alignItems: 'center', paddingVertical: 10 * k }}>
        <PerTieeri size={300 * k} crop="bust" emotion={shown.emotion} emotionKey={shown.key} />
      </View>
    );
  return <SortingScene active={active} />;
}

/** Iso esittelyviesti: hahmo + tervehdys + aloituskysymykset S-mobiilin listariveinä */
function Welcome({ k, active, onAsk, hideGame }: { k: number; active: boolean; onAsk: (q: string) => void; hideGame?: boolean }) {
  return (
    <SCard>
      <View style={{ paddingTop: 22 * k, paddingHorizontal: 22 * k, backgroundColor: '#fff' }}>
        <View style={{ paddingHorizontal: 4 * k, paddingBottom: 12 * k }}>
          <Text style={{ fontSize: 30 * k, fontWeight: '700', color: C.greenText }}>Hyvää päivää!</Text>
          <Text style={{ fontSize: 21 * k, lineHeight: 30 * k, color: C.text, marginTop: 8 * k }}>
            Olen Per Tieeri. Lajittelen menosi kolmeen ämpäriin, jotta näet mihin rahasi menevät.
          </Text>
        </View>
        <HeroStage k={k} active={active} />
      </View>
      <View style={{ height: 1.5 * k, backgroundColor: C.divider }} />
      {STARTERS.map((question, i) => (
        <Pressable key={question} accessibilityRole="button" accessibilityLabel={question} onPress={() => onAsk(question)} style={({ pressed }) => [pressed && { backgroundColor: '#F4F7F5' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 22 * k, paddingLeft: 26 * k, paddingRight: 22 * k }}>
            <Text style={{ flex: 1, fontSize: Math.max(17, 23 * k), lineHeight: Math.max(24, 31 * k), color: C.text, fontWeight: '500' }}>{question}</Text>
            <Chevron size={26 * k} color="#1E1E1E" />
          </View>
          {i < STARTERS.length - 1 && <View style={{ height: 1.5 * k, backgroundColor: C.divider, marginLeft: 26 * k, marginRight: 22 * k }} />}
        </Pressable>
      ))}
      <View style={{ height: 1.5 * k, backgroundColor: C.divider }} />
      <View style={{ padding: 22 * k, gap: 12 * k }}>
        <Text style={{ fontSize: 21 * k, fontWeight: '700', color: C.greenText, marginBottom: 2 * k }}>Kokeile esimerkiksi</Text>
        {TRY_THESE.filter((t) => !hideGame || t !== GAME_PROMPT).map((t) => (
          <Pressable
            key={t}
            accessibilityRole="button"
            onPress={() => onAsk(t)}
            style={({ pressed }) => [{ borderWidth: 2 * k, borderColor: C.greenDark, borderRadius: 10 * k, paddingVertical: 15 * k, paddingHorizontal: 18 * k, backgroundColor: '#fff', opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={{ fontSize: Math.max(17, 19 * k), lineHeight: Math.max(24, 26 * k), fontWeight: '600', color: C.greenText }}>{t}</Text>
          </Pressable>
        ))}
      </View>
    </SCard>
  );
}

const VISUAL_CARDS = new Set(['chart', 'blocks', 'spendingGrid', 'baskets', 'waterfall', 'compare', 'bars', 'forecast', 'stat']);

function Bubble({ k, m, first }: { k: number; m: Msg; first: boolean }) {
  const bot = m.from === 'bot';
  if (!bot)
    return (
      <FadeIn style={{ alignItems: 'flex-end', paddingLeft: 110 * k, paddingRight: SM.margin * k }}>
        <View style={{ backgroundColor: C.greenDark, borderRadius: 20 * k, paddingHorizontal: 22 * k, paddingVertical: 14 * k }}>
          <Text style={{ fontSize: 22 * k, lineHeight: 30 * k, color: '#fff' }}>{m.text}</Text>
        </View>
      </FadeIn>
    );
  // Kaaviot ja muut kuvat näytetään ENSIN (käyttäjä näkee ilmiön heti), selitys niiden alla.
  // Toiminnalliset kortit (peli, kysymykset, suunnitelmat) tulevat selityksen jälkeen.
  const visual = (m.cards ?? []).filter((c) => VISUAL_CARDS.has(c.kind));
  const other = (m.cards ?? []).filter((c) => !VISUAL_CARDS.has(c.kind));
  return (
    <View style={{ gap: 12, paddingHorizontal: 12 }}>
      {visual.map((c, i) => <CardView key={`v${i}`} card={c} />)}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ width: 48 * k, marginRight: 12 * k }}>{first && <FaceAvatar size={48 * k} />}</View>
        {m.text ? (
          <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 22 * k, borderTopLeftRadius: first ? 6 * k : 22 * k, paddingHorizontal: 16, paddingVertical: 14 }}>
            <RichBlocks text={m.text} />
          </View>
        ) : null}
      </View>
      {other.map((c, i) => <CardView key={`o${i}`} card={c} />)}
    </View>
  );
}

function Typing({ k }: { k: number }) {
  const [dots] = useState(() => [0, 1, 2].map(() => new Animated.Value(0)));
  useEffect(() => {
    const a = Animated.loop(
      Animated.stagger(
        140,
        dots.map((d) =>
          Animated.sequence([
            Animated.timing(d, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(d, { toValue: 0, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          ]),
        ),
      ),
    );
    a.start();
    return () => a.stop();
  }, [dots]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingLeft: 20 * k }}>
      <View style={{ width: 48 * k, marginRight: 12 * k }}>
        <FaceAvatar size={48 * k} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 22 * k, borderTopLeftRadius: 6 * k, paddingHorizontal: 24 * k, paddingVertical: 20 * k, gap: 8 * k }}>
        {dots.map((d, i) => (
          <Animated.View
            key={i}
            style={{ width: 10 * k, height: 10 * k, borderRadius: 5 * k, backgroundColor: C.greenDark, transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -6 * k] }) }] }}
          />
        ))}
      </View>
    </View>
  );
}
