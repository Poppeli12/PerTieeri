// Siirtää Per Tieerin datan Supabase Storageen (julkinen säiliö "pt-data"), jotta pilvifunktio ja
// julkaistu sovellus toimivat ilman omaa konetta. Aja kerran (ja aina, jos data/ muuttuu):
//
//   node scripts/cloud-upload.mjs            (kaikki)
//   node scripts/cloud-upload.mjs --small    (vain index/metrics/mortgage/statfin, ei 5 100 asiakasta)
//
// Tarvitsee .env.local-tiedostoon (EI EXPO_PUBLIC_-etuliitettä, ei koskaan sovellukseen):
//   SUPABASE_SERVICE_ROLE_KEY=...   (Supabase → Project Settings → API Keys → secret / service_role)
// sekä EXPO_PUBLIC_SUPABASE_URL (on jo).
// Data on Junction 2026 -haasteen julkista synteettistä aineistoa (GitHub), joten säiliö on julkisesti luettava.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^\s*[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error('Puuttuu EXPO_PUBLIC_SUPABASE_URL tai SUPABASE_SERVICE_ROLE_KEY (.env.local).');
  process.exit(1);
}
const BUCKET = 'pt-data';
const H = { Authorization: `Bearer ${KEY}`, apikey: KEY };

async function ensureBucket() {
  const r = await fetch(`${URL_}/storage/v1/bucket/${BUCKET}`, { headers: H });
  if (r.ok) return;
  const c = await fetch(`${URL_}/storage/v1/bucket`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, file_size_limit: 20 * 1024 * 1024, allowed_mime_types: ['application/json'] }),
  });
  if (!c.ok) throw new Error(`Säiliön luonti epäonnistui: ${c.status} ${await c.text()}`);
  console.log('Luotiin julkinen säiliö', BUCKET);
}

async function upload(remote, file, tries = 4) {
  const body = fs.readFileSync(file);
  for (let i = 0; ; i++) {
    const r = await fetch(`${URL_}/storage/v1/object/${BUCKET}/${remote}`, {
      method: 'POST',
      headers: { ...H, 'Content-Type': 'application/json', 'x-upsert': 'true', 'cache-control': '3600' },
      body,
    });
    if (r.ok) return;
    if (i >= tries) throw new Error(`${remote}: ${r.status} ${await r.text()}`);
    await new Promise((res) => setTimeout(res, 800 * (i + 1)));
  }
}

async function pool(items, n, fn) {
  let i = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const it = items[i++];
        await fn(it);
        if (++done % 250 === 0 || done === items.length) console.log(`  ${done}/${items.length}`);
      }
    }),
  );
}

const small = process.argv.includes('--small');
await ensureBucket();
const DATA = path.join(ROOT, 'data');
const jobs = ['index.json', 'metrics.json', 'mortgage.json'].map((f) => [f, path.join(DATA, f)]);
for (const f of fs.readdirSync(path.join(DATA, 'statfin'))) jobs.push([`statfin/${f}`, path.join(DATA, 'statfin', f)]);
console.log('Ladataan perustiedostot…');
await pool(jobs, 6, ([r, f]) => upload(r, f));
if (!small) {
  const files = fs.readdirSync(path.join(DATA, 'customers')).filter((f) => /^CUST\d{5}\.json$/.test(f));
  console.log(`Ladataan ${files.length} asiakasta…`);
  await pool(files, 16, (f) => upload(`customers/${f}`, path.join(DATA, 'customers', f)));
}
console.log('Valmis.');
