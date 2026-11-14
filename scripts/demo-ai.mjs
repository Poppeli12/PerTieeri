// Per Tieerin AI-agentin pääkytkin julkisessa demossa (Supabase Edge Function -salaisuus DEMO_AI_ENABLED).
//
//   npm run ai:off      → agentti pois päältä (OpenAI-kutsuja ei tehdä, muu sovellus ja muistit toimivat)
//   npm run ai:on       → agentti takaisin päälle (ei uudelleenrakennusta)
//   npm run ai:status   → näyttää nykyisen tilan pilvestä
//
// Tarvitsee .env.local-tiedostoon SUPABASE_ACCESS_TOKEN (Supabase → Account → Access Tokens).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^\s*[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const REF = (env.EXPO_PUBLIC_SUPABASE_URL || '').match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const STATUS_URL = `https://${REF}.supabase.co/functions/v1/api/agent`;

async function status() {
  const r = await fetch(STATUS_URL, { cache: 'no-store' });
  const j = await r.json();
  return j.ai_enabled !== false;
}

const cmd = process.argv[2];
if (!REF) throw new Error('EXPO_PUBLIC_SUPABASE_URL puuttuu .env.local-tiedostosta.');
if (cmd === 'status') {
  console.log(`Per Tieerin AI-agentti on nyt: ${(await status()) ? 'PÄÄLLÄ' : 'POIS PÄÄLTÄ'}`);
  process.exit(0);
}
if (cmd !== 'on' && cmd !== 'off') {
  console.log('Käyttö: node scripts/demo-ai.mjs on | off | status');
  process.exit(1);
}
if (!TOKEN) throw new Error('SUPABASE_ACCESS_TOKEN puuttuu .env.local-tiedostosta.');
const want = cmd === 'on';
const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/secrets`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify([{ name: 'DEMO_AI_ENABLED', value: want ? 'true' : 'false' }]),
});
if (!r.ok) throw new Error(`Supabase ei hyväksynyt muutosta: ${r.status} ${await r.text()}`);
// Funktiot ottavat uuden arvon käyttöön hetken kuluttua: odotetaan, että pilvi vastaa oikein.
for (let i = 0; i < 30; i++) {
  if ((await status()) === want) {
    console.log(`Valmis: Per Tieerin AI-agentti on nyt ${want ? 'PÄÄLLÄ' : 'POIS PÄÄLTÄ'}.`);
    process.exit(0);
  }
  await new Promise((res) => setTimeout(res, 3000));
}
console.log('Arvo tallennettiin, mutta pilvi ei vielä raportoi uutta tilaa. Tarkista hetken päästä: npm run ai:status');
