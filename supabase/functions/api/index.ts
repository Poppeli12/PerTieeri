// Per Tieerin pilvipalvelu (Supabase Edge Function "api").
// Korvaa paikallisen kehityspalvelimen, jotta web-versio ja asennettava sovellus toimivat ilman omaa konetta.
//
//  POST /api/agent        → OpenAI Responses API (avain on Supabasen salaisuus OPENAI_API_KEY, ei sovelluksessa)
//  GET  /api/customers, /api/customer, /api/peers, /api/mortgage-stats, /api/statfin/*  (ks. _shared/pt-core.mjs)
//
// Data luetaan julkisesta Storage-säiliöstä "pt-data" (scripts/cloud-upload.mjs):
//   index.json, metrics.json, mortgage.json, customers/CUSTxxxxx.json, statfin/*.json (Tilastokeskus-esivälimuisti)
// Deploy: npx supabase functions deploy api --no-verify-jwt
import { createPtApi } from '../_shared/pt-core.mjs';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const BUCKET = `${SUPABASE_URL}/storage/v1/object/public/pt-data`;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-per-tieeri, authorization, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });

// ---------- data Storagesta (muistivälimuisti instanssin eliniän ajan) ----------
const mem = new Map<string, unknown>();
async function storageText(path: string): Promise<string | null> {
  const r = await fetch(`${BUCKET}/${path}`);
  if (r.status === 404 || r.status === 400) return null;
  if (!r.ok) throw new Error(`Storage ${r.status}`);
  return await r.text();
}
const statfinMem = new Map<string, unknown>();

const api = createPtApi({
  readJson: async (name: string) => {
    if (!mem.has(name)) {
      const t = await storageText(name);
      if (t == null) throw new Error(`${name} puuttuu`);
      mem.set(name, JSON.parse(t));
    }
    return mem.get(name);
  },
  readCustomer: (id: string) => storageText(`customers/${id}.json`),
  cacheGet: async (key: string) => {
    if (statfinMem.has(key)) return statfinMem.get(key);
    // esiladattu välimuisti (data/statfin) – käytetään, jos rajapinta ei vastaa tai haku on tuore
    const t = await storageText(`statfin/${key}.json`).catch(() => null);
    const v = t ? JSON.parse(t) : null;
    if (v) statfinMem.set(key, v);
    return v;
  },
  cacheSet: async (key: string, value: unknown) => {
    statfinMem.set(key, value);
  },
  sha1: async (text: string) => {
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  },
});

// ---------- agentti (OpenAI) ----------
// Suojaukset julkista demoa varten:
//  1) vain sovelluksen käyttäjät: pyynnössä pitää olla voimassa oleva Supabase-istunto (anonyymi kirjautuminen)
//  2) käyttäjäkohtainen päiväkiintiö + koko demon päiväkatto (pt_ai_take, tietokannassa)
//  3) varalla instanssikohtainen minuutti- ja päiväraja, jos kiintiötaulua ei ole
//  4) malli, päättelytaso ja tulosteen enimmäispituus päätetään täällä, ei sovelluksessa
const USER_DAILY = Number(Deno.env.get('PT_USER_DAILY_CALLS') || 150); // ~30 kysymystä (työkalukierrokset mukaan lukien)
const GLOBAL_DAILY = Number(Deno.env.get('PT_GLOBAL_DAILY_CALLS') || 4000);
const hits: number[] = [];
const RATE = 40; // pyyntöä / minuutti / instanssi
let localDay = '';
let localCalls = 0;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const ANON = Deno.env.get('SUPABASE_ANON_KEY') || '';

async function userFrom(req: Request): Promise<string | null> {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token || token === ANON || token.startsWith('sb_')) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON || SERVICE, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const u = await r.json();
  return typeof u?.id === 'string' ? u.id : null;
}

async function take(userId: string): Promise<'ok' | 'user_limit' | 'global_limit'> {
  const day = new Date().toISOString().slice(0, 10);
  if (day !== localDay) { localDay = day; localCalls = 0; }
  if (++localCalls > GLOBAL_DAILY) return 'global_limit';
  if (!SERVICE) return 'ok';
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pt_ai_take`, {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_user: userId, p_user_limit: USER_DAILY, p_global_limit: GLOBAL_DAILY }),
  });
  if (!r.ok) return 'ok'; // kiintiötaulua ei vielä ole → varasuojat (minuutti- ja instanssiraja) jäävät voimaan
  const v = await r.json();
  return v === 'user_limit' || v === 'global_limit' ? v : 'ok';
}

/** Pääkytkin (Supabase-salaisuus DEMO_AI_ENABLED). false/0/off → agentti pois päältä, OpenAI:ta ei kutsuta. */
function aiEnabled() {
  const v = (Deno.env.get('DEMO_AI_ENABLED') ?? 'true').trim().toLowerCase();
  return !['false', '0', 'off', 'no'].includes(v);
}

async function agent(req: Request) {
  if (req.method === 'GET') return json(200, { ok: !!Deno.env.get('OPENAI_API_KEY') && aiEnabled(), ai_enabled: aiEnabled(), model: Deno.env.get('OPENAI_MODEL') || 'gpt-6-luna' });
  if (req.method !== 'POST') return json(405, { error: 'POST' });
  // Luetaan pyynnön runko aina ensin: jos vastataan lukematta sitä, selaimen yhteys voi jäädä odottamaan.
  const text = await req.text();
  // Ensimmäinen tarkistus: kun demo-AI on pois päältä, mitään ei välitetä OpenAI:lle (ei istuntoa, kiintiötä eikä kutsua).
  if (!aiEnabled()) return json(403, { error: 'Per Tieeri on tauolla', ai_enabled: false });
  if (req.headers.get('x-per-tieeri') !== '1') return json(403, { error: 'kielletty' });
  const userId = await userFrom(req);
  if (!userId) return json(401, { error: 'istunto puuttuu' });
  const now = Date.now();
  // Käyttörajat poistettu demoa varten (minuutti-, käyttäjä- ja päivärajat): agentti ei saa jumittua.
  // Pääkytkin DEMO_AI_ENABLED ja istuntovaatimus säilyvät.
  void now; void take;
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) return json(503, { error: 'OPENAI_API_KEY puuttuu Supabasen salaisuuksista' });
  if (text.length > 512 * 1024) return json(413, { error: 'liian suuri pyyntö' });
  const body = JSON.parse(text);
  // vain sallitut kentät eteenpäin; malli ja päättelytaso päätetään palvelimella
  const payload = {
    model: Deno.env.get('OPENAI_MODEL') || 'gpt-6-luna',
    instructions: body.instructions,
    input: body.input,
    tools: body.tools,
    previous_response_id: body.previous_response_id,
    reasoning: { effort: Deno.env.get('OPENAI_REASONING') || 'medium' },
    store: true,
  };
  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return new Response(await r.text(), { status: r.status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });
}

// ---------- jaetut demokeskustelut ----------
// Kuusi valmista esimerkkikeskustelua tallennetaan demon ylläpitäjän (DEMO_OWNER_ID) riveille.
// Kuka tahansa voi lukea ne (vain nämä kuusi asiakasta), ja vierailijan oma jatko tallentuu hänen omalle rivilleen.
const DEMO_CUSTOMERS = new Set(['CUST00106', 'CUST00049', 'CUST00007', 'CUST00027', 'CUST00021', 'CUST00149']);
async function demoConversation(id: string) {
  const owner = Deno.env.get('DEMO_OWNER_ID');
  if (!owner || !DEMO_CUSTOMERS.has(id) || !SERVICE) return json(404, { error: 'ei demokeskustelua' });
  const r = await fetch(`${SUPABASE_URL}/rest/v1/pt_customer_memory?select=state&owner_id=eq.${owner}&customer_id=eq.${id}`, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
  if (!r.ok) return json(502, { error: 'demokeskustelua ei saatu' });
  const rows = await r.json();
  const st = rows[0]?.state;
  if (!st || !Array.isArray(st.messages) || !st.messages.length) return json(404, { error: 'ei demokeskustelua' });
  // vain keskustelun sisältö ja sen aikana opitut asiat (ei ylläpitäjän luonnosta tai vierityskohtaa)
  return json(200, { messages: st.messages, profile: st.profile ?? null, prefs: st.prefs ?? null, answers: st.answers ?? {}, scenarios: st.scenarios ?? {}, quiz: st.quiz ?? {} });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const u = new URL(req.url);
  // Supabase välittää polun muodossa /api/... (funktion nimi + loppuosa)
  const pathname = u.pathname.replace(/^\/functions\/v1/, '');
  try {
    if (pathname === '/api/agent') return await agent(req);
    if (pathname === '/api/demo-conversation') return await demoConversation(u.searchParams.get('id') || '');
    const out = await api.route(pathname, Object.fromEntries(u.searchParams));
    if (out.raw != null) return new Response(out.raw, { status: out.status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
    return json(out.status, out.json);
  } catch (e) {
    return json(500, { error: String((e as Error)?.message ?? e) });
  }
});
