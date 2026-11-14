// Per Tieerin tietopalvelu kehityspalvelimelle (Metro, ks. metro.config.js).
// Logiikka on yhteinen pilvifunktion kanssa: supabase/functions/_shared/pt-core.mjs.
// Tässä vain tiedostojen luku levyltä (data/) ja Tilastokeskus-välimuisti data/statfin/*.json.
//
//  GET /api/customers?q=&age=&offset=&limit=   asiakaslista (5 100 asiakasta)
//  GET /api/customer?id=CUST00001               yhden asiakkaan kaikki tapahtumat
//  GET /api/peers?id=&metrics=a,b&group=age|all muut S-Pankin asiakkaat (mediaani, kvartiilit)
//  GET /api/statfin/consumption|income|cpi      Tilastokeskus (PxWeb)
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createPtApi } = require('../supabase/functions/_shared/pt-core.mjs');

const ROOT = path.join(__dirname, '..', 'data');
const STATFIN = path.join(ROOT, 'statfin');
const readJsonFile = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

const api = createPtApi({
  readJson: async (name) => JSON.parse(fs.readFileSync(path.join(ROOT, name), 'utf8')),
  readCustomer: async (id) => {
    const f = path.join(ROOT, 'customers', id + '.json');
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
  },
  cacheGet: async (key) => {
    const f = path.join(STATFIN, key + '.json');
    const v = readJsonFile(f);
    // vanhoissa metatiedostoissa ei ole savedAt-kenttää: käytetään tiedoston muokkausaikaa
    if (v && v.variables && !v.savedAt) { try { v.savedAt = fs.statSync(f).mtimeMs; } catch {} }
    return v;
  },
  cacheSet: async (key, value) => {
    fs.mkdirSync(STATFIN, { recursive: true });
    fs.writeFileSync(path.join(STATFIN, key + '.json'), JSON.stringify(value));
  },
  sha1: async (text) => crypto.createHash('sha1').update(text).digest('hex'),
});

async function handle(req, res) {
  const u = new URL(req.url, 'http://x');
  const out = await api.route(u.pathname, Object.fromEntries(u.searchParams));
  res.statusCode = out.status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(out.raw != null ? out.raw : JSON.stringify(out.json));
}

module.exports = { handle, band: api.band, consumption: api.consumption, income: api.income, cpi: api.cpi, peers: api.peers, rows: api.rows, CONSUMPTION_AGES: api.CONSUMPTION_AGES };
