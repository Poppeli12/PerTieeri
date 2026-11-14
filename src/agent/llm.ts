import { apiUrl } from '../data/api';
import { supabase } from '../data/supabase';
import { CUSTOMER, dataVersion } from '../finance/analytics';
import { instructions } from './persona';
import { COACH_TOOL_DEFS, COACH_TOOLS, runCoachTool } from './coach';
import { ASYNC_TOOL_DEFS, ASYNC_TOOLS, runAsyncTool } from './compare';
import { runTool, TOOL_DEFS } from './tools';
import type { AgentCtx, BotMsg, Card } from './types';
import { conversationInput, searchConversation } from './history';
import { getScenarios } from '../finance/insights';

/**
 * Per Tieerin aivot: OpenAI Responses API kehityspalvelimen välityspisteen (/api/agent, metro.config.js) kautta.
 * Avain on vain palvelimella. Malli kutsuu työkaluja → ajetaan laitteella → tulokset takaisin, kunnes vastaus valmis.
 */

/** Sama palvelin, josta sovellus latasi koodinsa (web: sama origin; Expo Go: LAN-osoite tai tunneli). */
function endpoint() {
  try { return apiUrl('/api/agent'); } catch { return null; }
}

type Out = { type: string; call_id?: string; name?: string; arguments?: string; content?: { type: string; text?: string }[] };

async function call(body: Record<string, unknown>, signal: AbortSignal) {
  const url = endpoint();
  if (!url) throw new Error('ei palvelinosoitetta');
  // Verkkokatko (esim. palvelin käynnistyy uudelleen): yritetään hiljaa uudelleen, käyttäjä ei näe teknistä virhettä
  // Pilviversiossa agentti vaatii sovelluksen (anonyymin) Supabase-istunnon: julkinen avain yksin ei riitä.
  const session = supabase ? (await supabase.auth.getSession().catch(() => null))?.data.session : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-per-tieeri': '1' };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  let r: Response | undefined;
  for (let attempt = 0; ; attempt++) {
    try {
      r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal });
      if (r.status >= 502 && r.status <= 504 && attempt < 4) throw new TypeError('gateway');
      break;
    } catch (e) {
      if (signal.aborted || attempt >= 4 || !(e instanceof TypeError)) throw e;
      await new Promise((res) => setTimeout(res, 1200 * (attempt + 1)));
    }
  }
  const raw = await r.text();
  let j: any;
  try {
    j = JSON.parse(raw);
  } catch {
    throw new Error('VANHA_PALVELIN');
  }
  if (!r.ok || j.error) throw new Error(typeof j.error === 'string' ? j.error : j.error?.message || `HTTP ${r.status}`);
  return j as { id: string; output: Out[] };
}

let conversationGeneration = 0;
/** uusi keskustelu (esim. sovelluksen käynnistyessä) */
export function resetConversation() {
  conversationGeneration++;
}

export type LlmResult = { msgs: BotMsg[]; profile?: Record<string, any> };

const ALL_TOOLS = [...TOOL_DEFS, ...ASYNC_TOOL_DEFS, ...COACH_TOOL_DEFS, {
  type: 'function', name: 'search_conversation', strict: false,
  description: 'Hae valitun asiakkaan koko tallennetusta keskusteluhistoriasta aiemmin sovittuja asioita. Käytä kun asiakas viittaa vanhempaan keskusteluun, jota ei näy viime viesteissä. Palauttaa viimeiset 20 osumaa. Tyhjä haku palauttaa uusimmat viestit.',
  parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'], additionalProperties: false },
}];

export async function askLLM(text: string, ctx: AgentCtx, customerId: string, checkpoint?: () => Promise<void>): Promise<LlmResult> {
  const generation = conversationGeneration;
  const version = dataVersion();
  const assertCustomer = () => {
    if (CUSTOMER.id !== customerId || version !== dataVersion() || generation !== conversationGeneration) throw new Error('Asiakas vaihtui. Keskustelupyyntö peruttiin.');
  };
  assertCustomer();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90_000);
  const currentInstructions = () => {
    const p = ctx.profile;
    const profileLine = [
    `asiakastunnus ${customerId}`,
    `ikä ${p.age} v (aineistosta)`,
    `elämäntilanne: ${p.situation}`,
    `kotitalous: ${p.household ?? 'ei tiedossa'}`,
    `asuminen: ${p.living}`,
    `tili kattaa kotitalouden kaikki menot: ${p.expensesComplete === undefined ? 'ei vahvistettu' : p.expensesComplete ? 'asiakas vahvisti' : 'ei kata'}`,
    `tilin palkka ja muut tulot kattavat henkilökohtaiset nettotulot: ${p.incomeComplete === undefined ? 'ei vahvistettu' : p.incomeComplete ? 'asiakas vahvisti' : 'ei kata'}`,
    `puolison ikä: ${p.partnerAge ?? 'ei tiedossa'}`,
    `alle 25-vuotiaita huollettavia lapsia: ${p.dependentChildrenUnder25 ?? 'ei tiedossa'}`,
    `kaikki kotitalouden jäsenet vähintään 65 v: ${p.allMembers65Plus ?? 'ei tiedossa'}`,
    `tavoite: ${p.goal}`,
    ctx.prefs.protected.length ? `ei säästöehdotuksia kohteista: ${ctx.prefs.protected.join(', ')}` : '',
    p.changes.length ? `elämänmuutokset: ${p.changes.map((c) => c.text).join('; ')}` : '',
    p.notes?.length ? `asiakkaan kertomaa: ${p.notes.join('; ')}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
    return instructions(profileLine + ` · vastaustyyli: ${p.style} · tallennetut skenaariot: ${JSON.stringify(getScenarios())}`);
  };

  const cards: Card[] = [];
  let chips: string[] | undefined;
  let mood: string | undefined;
  let profile: Record<string, any> | undefined;
  try {
    // Reconstruct every turn from our own durable history. A provider response ID
    // can expire and must not be the only copy of the customer's memory.
    let res = await call({ instructions: currentInstructions(), input: conversationInput(ctx.history ?? [], text), tools: ALL_TOOLS }, ctrl.signal);
    assertCustomer();
    for (let round = 0; round < 8; round++) {
      const calls = res.output.filter((o) => o.type === 'function_call');
      if (!calls.length) break;
      const outputs = [];
      // Profiilin tallennus voi muuttaa heti seuraavan vertailun edellytyksiä.
      for (const c of calls) {
          assertCustomer();
          let args: any = {};
          try {
            args = JSON.parse(c.arguments || '{}');
          } catch {}
          let out: { result: unknown; card?: Card; chips?: string[]; mood?: string; profile?: Record<string, any> };
          try {
            out = c.name === 'search_conversation' ? { result: searchConversation(ctx.history ?? [], String(args.query ?? '')) } : ASYNC_TOOLS.has(c.name!) ? await runAsyncTool(c.name!, args, ctx, customerId) : COACH_TOOLS.has(c.name!) ? runCoachTool(c.name!, args, ctx) : runTool(c.name!, args, ctx);
          } catch (e) {
            out = { result: { virhe: String(e) } };
          }
          assertCustomer();
          if (out.card && cards.length < 3) cards.push(out.card);
          if (out.chips?.length) chips = out.chips;
          if (out.mood) mood = out.mood;
          if (out.profile) {
            profile = { ...profile, ...out.profile, notes: [...(profile?.notes ?? []), ...(out.profile.notes ?? [])] };
            ctx.profile = { ...ctx.profile, ...out.profile, notes: [...(ctx.profile.notes ?? []), ...(out.profile.notes ?? [])] } as any;
            if (out.profile.protect) ctx.prefs = { ...ctx.prefs, protected: out.profile.protect };
          }
          if (out.profile || ['scenario', 'show_whatif'].includes(c.name ?? '')) await checkpoint?.();
          outputs.push({ type: 'function_call_output', call_id: c.call_id, output: JSON.stringify(out.result) });
      }
      res = await call({ instructions: currentInstructions(), input: outputs, tools: ALL_TOOLS, previous_response_id: res.id }, ctrl.signal);
      assertCustomer();
    }
    const reply = res.output
      .filter((o) => o.type === 'message')
      .flatMap((o) => o.content ?? [])
      .filter((c) => c.type === 'output_text')
      .map((c) => c.text)
      .join('\n')
      // mallin sisäistä työkalusyntaksia ei koskaan näytetä käyttäjälle
      .replace(/^.*(~~~|to=functions\.|<\|[a-z_]+\|>).*$/gm, '')
      // ei emojeja viesteissä
      .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/gu, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return { msgs: [{ text: reply || 'Pahoittelen, hyvä herrasväki – kynäni lipsahti. Kysyisittekö uudelleen?', cards: cards.length ? cards : undefined, chips, mood }], profile };
  } finally {
    clearTimeout(timer);
  }
}
