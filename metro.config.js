// Metro-asetukset + Per Tieerin "aivojen" välityspiste.
//
// POST /api/agent  →  OpenAI Responses API (/v1/responses)
// API-avain luetaan kehityspalvelimen ympäristöstä (.env.local, jonka Expo CLI lataa käynnistyessä).
// Avainta EI ole sovelluksen JavaScript-paketissa (ei EXPO_PUBLIC_-etuliitettä), joten sitä ei voi kaivaa
// sovelluksesta. Sovellus (web, Expo Go LAN tai tunneli) puhuu samalle palvelimelle, josta se latasi koodinsa.
const { getDefaultConfig } = require('expo/metro-config');
const dataApi = require('./server/api');

const config = getDefaultConfig(__dirname);
// data/ (asiakasaineisto, välimuisti) ei kuulu sovelluspakettiin
config.resolver = { ...config.resolver, blockList: [/[\/]data[\/](customers|statfin)[\/].*/, /[\/]server[\/].*/] };

const MAX_BODY = 512 * 1024;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('liian suuri pyyntö'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-per-tieeri');
  res.end(JSON.stringify(obj));
}

// yksinkertainen suoja tunnelitilaa varten: tunnisteotsake + nopeusrajoitus (avaimen väärinkäytön esto)
const hits = [];
const RATE = 40; // pyyntöä / minuutti

async function agent(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method === 'GET') return send(res, 200, { ok: !!process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || 'gpt-6-luna' });
  if (req.method !== 'POST') return send(res, 405, { error: 'POST' });
  if (req.headers['x-per-tieeri'] !== '1') return send(res, 403, { error: 'kielletty' });
  // Sama pääkytkin kuin pilvessä (.env.local: DEMO_AI_ENABLED=false → agentti tauolla, OpenAI:ta ei kutsuta)
  if (['false', '0', 'off', 'no'].includes(String(process.env.DEMO_AI_ENABLED || 'true').trim().toLowerCase())) return send(res, 403, { error: 'Per Tieeri on tauolla', ai_enabled: false });
  const now = Date.now();
  void hits; void RATE; void now; // nopeusraja poistettu demoa varten
  const key = process.env.OPENAI_API_KEY;
  if (!key) return send(res, 503, { error: 'OPENAI_API_KEY puuttuu (.env.local) – käynnistä palvelin uudelleen' });
  try {
    const body = JSON.parse(await readBody(req));
    // vain sallitut kentät eteenpäin; malli ja päättelytaso päätetään palvelimella
    const payload = {
      model: process.env.OPENAI_MODEL || 'gpt-6-luna',
      instructions: body.instructions,
      input: body.input,
      tools: body.tools,
      previous_response_id: body.previous_response_id,
      reasoning: { effort: process.env.OPENAI_REASONING || 'medium' },
      store: true,
    };
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const j = await r.json();
    send(res, r.status, j);
  } catch (e) {
    send(res, 500, { error: String((e && e.message) || e) });
  }
}

const prev = config.server && config.server.enhanceMiddleware;
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    const base = prev ? prev(middleware, server) : middleware;
    return (req, res, next) => {
      const p = req.url ? req.url.split('?')[0] : '';
      if (p === '/api/agent') return void agent(req, res);
      if (p.startsWith('/api/')) return void dataApi.handle(req, res);
      return base(req, res, next);
    };
  },
};

module.exports = config;
