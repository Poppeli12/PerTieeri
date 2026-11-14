import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { greeting, respond, saveLifeChange } from '../agent/engine';
import { askLLM, resetConversation } from '../agent/llm';
import type { AgentCtx, AgentReply, Profile } from '../agent/types';
import { AppState } from 'react-native';
import { getJson } from '../data/api';
import { CUSTOMER, setCustomerData, setDemo as setDemoData, setPeerMedians } from '../finance/analytics';
import { resetForecastCache } from '../finance/forecast';
import { getScenarios, restoreScenarios, upsertScenario, type Scenario } from '../finance/insights';
import { emptyMemory, mergeMemory, type BankSnapshot, type MemoryState } from './memoryModel';
import { flushMemory, loadLocalBank, loadLocalMemory, saveLocalBank, saveLocalMemory } from './localMemory';
import { cloudLoad, cloudSave } from './cloudMemory';
import { supabase } from '../data/supabase';

/**
 * Sovelluksen tila ASIAKASKOHTAISESTI. Jokaisella aineiston asiakkaalla on oma profiili, muisti
 * (preferenssit, vastaukset, tehtävät) ja keskustelu. Asiakkaan vaihtuessa kaikki edellisen asiakkaan
 * tiedot poistetaan muistista ennen kuin uuden asiakkaan data ladataan.
 *
 * Demossa asiakkaan voi valita (Minä › Vaihda asiakas). Oikeassa pankkisovelluksessa asiakas
 * tunnistettaisiin kirjautumisesta, eikä toisen henkilön tietoja voisi valita.
 */
const KEY_SELECTED = 'pertieeri:asiakas';
const DEFAULT_ID = 'CUST00171';

type Persisted = MemoryState;
const EMPTY: Persisted = emptyMemory();

/** Profiili ilman oletuksia: kaikki mitä ei tiedetä on 'ei tiedossa' (ikä tulee aineistosta). */
export function defaultProfile(): Profile {
  return {
    age: CUSTOMER.age,
    situation: 'ei tiedossa',
    living: 'ei tiedossa',
    goal: 'ei tiedossa',
    household: 'ei tiedossa',
    protect: [],
    style: 'teach',
    rentDelta: 0,
    incomeDelta: 0,
    changes: [],
    notes: [],
  };
}
/** @deprecated käytä defaultProfile() */
export const DEFAULT_PROFILE = defaultProfile();

type Store = Persisted & {
  ownerId: string;
  memoryStatus: string;
  cloudStatus: string;
  syncNow: () => Promise<void>;
  importDeviceMemory: () => Promise<void>;
  setDraft: (text: string) => void;
  setScrollY: (y: number) => void;
  updateScenario: (name: string, patch: Partial<Scenario>) => void;
  ready: boolean;
  typing: boolean;
  unread: number;
  customerId: string;
  switching: boolean;
  loadError: string | null;
  setCustomer: (id: string) => Promise<void>;
  send: (text: string, display?: string) => void;
  kickoff: () => void;
  completeOnboarding: (p: Profile) => void;
  resetAll: () => void;
  setDemo: (v: boolean) => void;
  setQuiz: (id: string, i: number) => void;
  markRead: () => void;
  removeProtected: (k: string) => void;
  undoChanges: () => void;
};

const Ctx = createContext<Store | null>(null);

let mid = 0;
const newId = () => `${Date.now()}-${mid++}-${Math.random().toString(36).slice(2, 10)}`;

export function displayFor(text: string) {
  if (text.startsWith('§save|')) return 'Tallenna muutos';
  if (text.startsWith('§plan|accept')) return 'Hyväksyn suunnitelman';
  if (text.startsWith('§plan|reject')) return 'En halua tätä ehdotusta';
  if (text.startsWith('§ans|')) return text.split('|')[2];
  return text;
}

/** Hae asiakkaan data + saman ikäryhmän mediaanit (synteettinen aineisto) */
async function loadCustomer(id: string, isCurrent: () => boolean, fallback: BankSnapshot | null) {
  let data: BankSnapshot;
  try { data = await getJson(`/api/customer?id=${encodeURIComponent(id)}`); }
  catch (e) { if (!fallback) throw e; data = fallback; }
  if (!isCurrent()) return;
  if (data.customer?.id !== id) throw new Error('Palvelin palautti väärän asiakkaan.');
  setCustomerData(data);
  const cats = ['Groceries', 'Restaurants', 'Transportation', 'Utilities', 'Housing', 'Entertainment', 'Health', 'Home & Tech', 'Lifestyle', 'Travel'];
  try {
    const p = await getJson(`/api/peers?id=${id}&group=age&metrics=${cats.map((c) => encodeURIComponent('cat:' + c)).join(',')}`);
    if (!isCurrent()) return;
    const med: Record<string, number> = {};
    for (const c of cats) med[c] = p.metrics['cat:' + c].median;
    setPeerMedians(p.reliable ? med : {}, p.group_size, p.group);
  } catch {
    if (!isCurrent()) return;
    setPeerMedians({}, 0, '');
  }
  return data;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [customerId, setCustomerId] = useState(DEFAULT_ID);
  const [switching, setSwitching] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [state, setRawState] = useState<Persisted>(EMPTY);
  const [ownerId, setOwnerId] = useState('device');
  const ownerRef = useRef('device');
  const bankRef = useRef<BankSnapshot | null>(null);
  const [memoryStatus, setMemoryStatus] = useState('Ladataan muistia…');
  const [cloudStatus, setCloudStatus] = useState('Vain tällä laitteella');
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState(3);
  const stateRef = useRef(state);
  const idRef = useRef(customerId);
  const gen = useRef(0); // estää edellisen asiakkaan myöhässä saapuvan vastauksen
  const busyRef = useRef(false);
  const setState = useCallback((update: React.SetStateAction<Persisted>) => {
    const next = typeof update === 'function' ? update(stateRef.current) : update;
    stateRef.current = { ...next, updatedAt: Date.now() };
    setRawState(stateRef.current);
    setMemoryStatus('Tallennetaan laitteelle…');
  }, []);

  const activate = useCallback(async (id: string, owner = ownerRef.current) => {
    const generation = ++gen.current;
    const isCurrent = () => gen.current === generation;
    setSwitching(true);
    busyRef.current = false;
    resetConversation();
    setTyping(false);
    setLoadError(null);
    try {
      if (bankRef.current) {
        await saveLocalMemory(ownerRef.current, idRef.current, stateRef.current);
        if (ownerRef.current !== 'device' && ownerRef.current === owner) {
          void cloudSave(ownerRef.current, idRef.current, stateRef.current, bankRef.current).catch(() => {});
        }
      }
      await flushMemory();
      let saved = await loadLocalMemory(owner, id);
      let bank = await loadLocalBank(owner, id);
      if (owner !== 'device') {
        try {
          const remote = await cloudLoad(owner, id);
          if (!isCurrent()) return;
          if (remote) { saved = mergeMemory(saved, remote.memory); bank = remote.bank ?? bank; }
          setCloudStatus('Pilvimuisti ladattu');
        } catch { setCloudStatus('Pilviyhteys ei toimi – paikallinen muisti käytössä'); }
        // Pilvi otettiin käyttöön vasta nyt: siirretään tämän laitteen aiempi historia tälle asiakkaalle, ettei mitään katoa.
        if (!saved.messages.length && !saved.profile) {
          const device = await loadLocalMemory('device', id);
          if (device.messages.length || device.profile) saved = mergeMemory(saved, device);
        }
      } else setCloudStatus('Vain tällä laitteella');
      if (!isCurrent()) return;
      const loaded = await loadCustomer(id, isCurrent, bank);
      if (!isCurrent() || !loaded) return;
      bankRef.current = loaded;
      await saveLocalBank(owner, id, loaded);
      if (!isCurrent()) return;
      restoreScenarios(saved.scenarios);
      setDemoData(false);
      resetForecastCache();
      ownerRef.current = owner;
      idRef.current = id;
      setOwnerId(owner);
      setCustomerId(id);
      stateRef.current = { ...saved, demo: false };
      setRawState(stateRef.current);
      setUnread(0);
      setMemoryStatus('Tallennettu laitteelle');
      await AsyncStorage.setItem(KEY_SELECTED + ':' + owner, id);
    } catch (e: any) {
      if (!isCurrent()) return;
      // Never relabel the preceding customer's data as the requested customer.
      setCustomerData({ customer: { id, age: 0 }, transactions: [] });
      bankRef.current = null;
      idRef.current = id;
      setCustomerId(id);
      setLoadError(String(e?.message ?? e));
    } finally {
      if (isCurrent()) setSwitching(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      let session = await supabase?.auth.getSession().catch(() => undefined);
      // Ei kirjautumisnäkymää: laite saa automaattisesti oman anonyymin Supabase-käyttäjän,
      // jonka alle jokaisen asiakkaan (CUSTxxxxx) keskusteluhistoria ja muisti tallentuvat omille riveilleen.
      if (supabase && !session?.data.session) {
        const anon = await supabase.auth.signInAnonymously().catch(() => undefined);
        if (anon?.data.session) session = { data: { session: anon.data.session }, error: null } as typeof session;
      }
      const owner = session?.data.session?.user.id ?? 'device';
      let id = DEFAULT_ID;
      try {
        id = (await AsyncStorage.getItem(KEY_SELECTED + ':' + owner)) || (owner === 'device' ? await AsyncStorage.getItem(KEY_SELECTED) : null) || DEFAULT_ID;
      } catch {}
      await activate(id, owner);
      setReady(true);
    })();
  }, [activate]);

  useEffect(() => {
    if (!ready || !supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const owner = session?.user.id ?? 'device';
      if (owner !== ownerRef.current) void activate(idRef.current, owner);
    });
    return () => data.subscription.unsubscribe();
  }, [ready, activate]);

  useEffect(() => {
    if (!ready || switching || loadError) return;
    const generation = gen.current;
    saveLocalMemory(ownerId, customerId, state).then(() => {
      if (gen.current === generation) setMemoryStatus('Tallennettu laitteelle');
    }).catch(() => { if (gen.current === generation) setMemoryStatus('Tallennus epäonnistui – yritä uudelleen'); });
  }, [state, ready, switching, customerId, ownerId, loadError]);

  const syncNow = useCallback(async () => {
    const owner = ownerRef.current, id = idRef.current, generation = gen.current;
    const snapshot = stateRef.current, bank = bankRef.current;
    try {
      await saveLocalMemory(owner, id, snapshot);
      if (gen.current === generation) setMemoryStatus('Tallennettu laitteelle');
      if (owner === 'device') return;
      if (gen.current === generation) setCloudStatus('Synkronoidaan…');
      await cloudSave(owner, id, snapshot, bank ?? undefined);
      const remote = await cloudLoad(owner, id);
      if (gen.current === generation) {
        if (remote) {
          const merged = mergeMemory(stateRef.current, remote.memory);
          if (JSON.stringify(merged) !== JSON.stringify(stateRef.current)) {
            stateRef.current = merged;
            setRawState(merged);
            restoreScenarios(merged.scenarios);
            await saveLocalMemory(owner, id, merged);
          }
        }
        setCloudStatus('Tallennettu Supabaseen');
      }
    } catch (e) {
      if (gen.current === generation) setCloudStatus(`Tallennus kesken: ${String(e instanceof Error ? e.message : e)}`);
    }
  }, []);
  useEffect(() => {
    if (!ready || switching || loadError || ownerId === 'device') return;
    const timer = setTimeout(() => void syncNow(), 2000);
    return () => clearTimeout(timer);
  }, [state, ready, switching, loadError, ownerId, syncNow]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', next => {
      if (ready && !switching && !loadError) void syncNow();
      if (supabase) { if (next === 'active') supabase.auth.startAutoRefresh(); else supabase.auth.stopAutoRefresh(); }
    });
    return () => listener.remove();
  }, [ready, switching, loadError, syncNow]);

  const ctx = (): AgentCtx => ({
    profile: stateRef.current.profile ?? defaultProfile(),
    prefs: stateRef.current.prefs,
    answers: stateRef.current.answers,
    history: stateRef.current.messages,
  });

  const deliver = useCallback((reply: AgentReply) => {
    const generation = gen.current;
    setState((s) => ({
      ...s,
      prefs: reply.prefs ?? s.prefs,
      answers: reply.answers ?? s.answers,
      profile: reply.profile ? { ...(s.profile ?? defaultProfile()), ...reply.profile } : s.profile,
    }));
    reply.msgs.forEach((m, i) => {
      setTimeout(() => {
        if (gen.current !== generation) return;
        setState((s) => ({ ...s, messages: [...s.messages, { ...m, id: newId(), from: 'bot', ts: Date.now() }] }));
        if (i === reply.msgs.length - 1) { setTyping(false); busyRef.current = false; }
      }, 500 + i * 900);
    });
    if (!reply.msgs.length) { setTyping(false); busyRef.current = false; }
  }, [setState]);

  const send = useCallback(
    (text: string, display?: string) => {
      if (loadError || switching || busyRef.current) return;
      const before = ctx();
      busyRef.current = true;
      const shown = display ?? displayFor(text);
      const myGen = gen.current;
      const requestCustomer = idRef.current;
      setState((s) => ({ ...s, messages: [...s.messages, { id: newId(), from: 'user', text: shown, ts: Date.now() }] }));
      setTyping(true);
      const fallback = () => {
        let reply: AgentReply;
        try {
          reply = text.startsWith('§save|') ? saveLifeChange(text, ctx()) : respond(text, ctx());
        } catch (e) {
          reply = { msgs: [{ text: 'Hups, laskimeni jumittui. Ennen vanhaan olisin syyttänyt mustekynää. Kokeiletko uudelleen toisin sanoin?' }] };
          console.warn(e);
        }
        if (myGen === gen.current) deliver(reply);
      };
      if (text.startsWith('§')) {
        setTimeout(fallback, 350);
        return;
      }
      saveLocalMemory(ownerRef.current, idRef.current, stateRef.current)
        .then(() => {
          if (gen.current !== myGen) throw new Error('Asiakas vaihtui.');
          return askLLM(text, before, requestCustomer, async () => {
            if (gen.current !== myGen) throw new Error('Asiakas vaihtui.');
            setState(s => ({ ...s, profile: before.profile, prefs: before.prefs, scenarios: JSON.parse(JSON.stringify(getScenarios())) }));
            await saveLocalMemory(ownerRef.current, requestCustomer, stateRef.current);
          });
        })
        .then((r) => {
          if (myGen !== gen.current) return; // asiakas vaihtui kesken – hylätään
          setState((s) => ({
            ...s,
            scenarios: JSON.parse(JSON.stringify(getScenarios())),
            prefs: r.profile?.protect ? { ...s.prefs, protected: r.profile.protect } : s.prefs,
            profile: before.profile,
            messages: [...s.messages, ...r.msgs.map((m) => ({ ...m, id: newId(), from: 'bot' as const, ts: Date.now() }))],
          }));
          setTyping(false);
          busyRef.current = false;
        })
        .catch((e) => {
          // EI kovakoodattuja korvikevastauksia: kerrotaan rehellisesti, ettei yhteys toiminut
          console.warn('Per Tieerin aivot eivät vastanneet:', e?.message ?? e);
          if (myGen !== gen.current) return;
          setState((s) => ({
            ...s,
            scenarios: JSON.parse(JSON.stringify(getScenarios())),
            profile: before.profile,
            prefs: before.prefs,
            messages: [
              ...s.messages,
              {
                id: newId(),
                from: 'bot',
                ts: Date.now(),
                mood: 'nolo',
                // ei teknisiä virhetekstejä asiakkaalle; painike lähettää saman kysymyksen uudelleen
                text: /tauolla/.test(String(e?.message ?? ''))
                  ? 'Suokaa anteeksi, olen juuri nyt pienellä tauolla enkä voi vastata. Sovelluksen muut tiedot toimivat normaalisti, ja palvelen taas pian.'
                  : /kiintiö/.test(String(e?.message ?? ''))
                  ? 'Suokaa anteeksi, tämän päivän kysymykset on tässä esittelyversiossa käytetty. Palataan asiaan huomenna.'
                  : 'Suokaa anteeksi, yhteys katkesi hetkeksi, enkä halua vastata arvaamalla. Painakaa alta, niin katson asian uudelleen.',
                chips: [shown],
              },
            ],
          }));
          setTyping(false);
          busyRef.current = false;
        });
    },
    [deliver, loadError, switching, setState],
  );

  /** Keskustelun avaus: Per Tieeri katsoo asiakkaan tilanteen ja tekee korkeintaan yhden olennaisen huomion. */
  const kicked = useRef<string | null>(null);
  const kickoff = useCallback(() => {
    if (loadError || switching || busyRef.current) return;
    if (kicked.current === idRef.current || stateRef.current.messages.length) return;
    kicked.current = idRef.current;
    const myGen = gen.current;
    busyRef.current = true;
    setTyping(true);
    askLLM(
      '[Sovellus: asiakas avasi keskustelun – tämä ei ole asiakkaan kirjoittama viesti. Esittelyviestisi (Hyvää päivää! Olen Per Tieeri…) näkyy jo hänelle, älä toista sitä. ' +
        'Katso hänen tilanteensa (esim. get_overview, get_anomalies). Jos datassa on jotain aidosti olennaista ja ajankohtaista, mainitse siitä yksi lyhyt henkilökohtainen huomio luontevasti; muuten kysy kohteliaasti, mistä hän haluaisi aloittaa. ' +
        'Pidä lyhyenä (1–3 virkettä), ei kaavioita. Tarjoa suggest_followups-työkalulla 3 hänen tilanteeseensa sopivaa aloitusvaihtoehtoa.]',
      ctx(),
      idRef.current,
    )
      .then((r) => {
        if (myGen !== gen.current) return;
        setState((s) => ({ ...s, messages: [...s.messages, ...r.msgs.map((m) => ({ ...m, id: newId(), from: 'bot' as const, ts: Date.now() }))] }));
        setTyping(false);
        busyRef.current = false;
      })
      .catch(() => { if (myGen === gen.current) { setTyping(false); busyRef.current = false; } });
  }, [loadError, switching, setState]);

  const completeOnboarding = useCallback(
    (p: Profile) => {
      setState((s) => ({ ...s, profile: p, prefs: { ...s.prefs, protected: p.protect } }));
      setTyping(true);
      setTimeout(() => {
        const c: AgentCtx = { profile: p, prefs: { ...stateRef.current.prefs, protected: p.protect }, answers: stateRef.current.answers };
        deliver({ msgs: greeting(c) });
      }, 400);
    },
    [deliver, setState],
  );

  const value = useMemo<Store>(
    () => ({
      ...state,
      ownerId,
      memoryStatus,
      cloudStatus,
      syncNow,
      importDeviceMemory: async () => {
        const local = await loadLocalMemory('device', customerId);
        setState(mergeMemory(stateRef.current, local));
        restoreScenarios(stateRef.current.scenarios);
        await syncNow();
      },
      setDraft: (draft) => setState(s => ({ ...s, draft })),
      setScrollY: (scrollY) => setState(s => ({ ...s, scrollY })),
      updateScenario: (name, patch) => {
        upsertScenario(name, patch);
        setState(s => ({ ...s, scenarios: JSON.parse(JSON.stringify(getScenarios())) }));
      },
      ready,
      typing,
      unread,
      customerId,
      switching,
      loadError,
      setCustomer: async (id: string) => {
        if (id === idRef.current && !loadError) return;
        setSwitching(true);
        await activate(id);
        setSwitching(false);
      },
      send,
      kickoff,
      completeOnboarding,
      resetAll: () => {
        gen.current++;
        busyRef.current = false;
        setTyping(false);
        restoreScenarios({});
        setState({ ...emptyMemory(), resetAt: Date.now() });
        resetConversation();
        setUnread(3);
      },
      setDemo: (v: boolean) => {
        setDemoData(v);
        resetForecastCache();
        setState((s) => ({ ...s, demo: v }));
      },
      setQuiz: (id, i) => setState((s) => ({ ...s, quiz: { ...s.quiz, [id]: i } })),
      markRead: () => setUnread(0),
      removeProtected: (k) => setState((s) => ({ ...s, profile: s.profile ? { ...s.profile, protect: s.profile.protect.filter(x => x !== k) } : s.profile, prefs: { ...s.prefs, protected: s.prefs.protected.filter((x) => x !== k) } })),
      undoChanges: () => setState((s) => (s.profile ? { ...s, profile: { ...s.profile, rentDelta: 0, incomeDelta: 0, changes: [] } } : s)),
    }),
    [state, ready, typing, unread, customerId, switching, loadError, activate, send, kickoff, completeOnboarding, ownerId, memoryStatus, cloudStatus, syncNow, setState],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider puuttuu');
  return s;
}
