import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Kehityspalvelimen osoite (sama palvelin, josta sovellus latasi koodinsa: web, LAN tai tunneli) */
export function apiUrl(path: string) {
  // Pilviversio (julkaistu web ja asennettava sovellus): Supabase Edge Function, esim.
  // EXPO_PUBLIC_API_BASE=https://<projekti>.supabase.co/functions/v1  → …/functions/v1/api/customer
  const base = process.env.EXPO_PUBLIC_API_BASE;
  if (base) return `${base.replace(/\/$/, '')}${path}`;
  if (Platform.OS === 'web') return path;
  const host = Constants.expoConfig?.hostUri ?? (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ?? (Constants as any).manifest?.debuggerHost;
  if (!host) throw new Error('ei palvelinosoitetta');
  // Expo's HTTPS tunnel redirects HTTP with 301, which can turn a chat POST into GET.
  // Keep local LAN connections on HTTP and use HTTPS directly for Expo tunnels.
  const origin = /^https?:\/\//.test(host) ? host : `${/\.(on\.expo\.app|exp\.direct)(?::\d+)?$/.test(host) ? 'https' : 'http'}://${host}`;
  return `${origin.replace(/\/$/, '')}${path}`;
}

export async function getJson<T = any>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
  const r = await fetch(apiUrl(path), { headers: { 'x-per-tieeri': '1' }, signal: controller.signal });
  const raw = await r.text();
  let j: any;
  try {
    j = JSON.parse(raw);
  } catch {
    throw new Error('Kehityspalvelin ei tunne Per Tieerin rajapintaa – se on käynnistetty ennen päivitystä. Sulje vanha palvelin ja aja npm start uudelleen.');
  }
  if (!r.ok || (j && j.error)) throw new Error(j?.error || `HTTP ${r.status}`);
  return j as T;
  } finally { clearTimeout(timer); }
}

export type CustomerRow = { id: string; age: number; postal: string; n: number; first: string; last: string; income: number; balance: number; mortgage?: 'approved' | 'rejected' };
