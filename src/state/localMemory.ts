import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeMemory, type BankSnapshot, type MemoryState } from './memoryModel';

// Small chunks avoid Android's per-row cursor limit. Publish the manifest last,
// so an interrupted write never replaces the preceding complete snapshot.
const CHUNK = 100_000;
const queues = new Map<string, Promise<void>>();
const keyFor = (owner: string, id: string, kind: string) => `pertieeri:v3:${owner}:${id}:${kind}`;
export async function readRecord<T>(key: string): Promise<T | null> {
  await queues.get(key);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  const manifest = JSON.parse(raw) as { keys: string[] };
  if (!Array.isArray(manifest.keys)) throw new Error('Tallennetun muistin rakenne on virheellinen.');
  const values = await AsyncStorage.multiGet(manifest.keys);
  if (values.some(([, v]) => v === null)) throw new Error('Tallennettu muisti on keskeneräinen.');
  return JSON.parse(values.map(([, v]) => v).join('')) as T;
}
export function writeRecord(key: string, value: unknown): Promise<void> {
  const serialized = JSON.stringify(value);
  const task = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(async () => {
    const oldRaw = await AsyncStorage.getItem(key);
    const old = oldRaw ? JSON.parse(oldRaw) as { keys: string[] } : null;
    const generation = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const entries: [string, string][] = [];
    for (let i = 0; i < serialized.length; i += CHUNK) entries.push([`${key}:${generation}:${i / CHUNK}`, serialized.slice(i, i + CHUNK)]);
    await AsyncStorage.multiSet(entries);
    await AsyncStorage.setItem(key, JSON.stringify({ keys: entries.map(([k]) => k) }));
    if (old?.keys?.length) await AsyncStorage.multiRemove(old.keys).catch(() => {});
  });
  queues.set(key, task);
  task.finally(() => { if (queues.get(key) === task) queues.delete(key); }).catch(() => {});
  return task;
}
export async function loadLocalMemory(owner: string, id: string) {
  let state = await readRecord<MemoryState>(keyFor(owner, id, 'memory'));
  // Upgrade the old device-only profile without discarding any history it contains.
  if (!state && owner === 'device') {
    const legacy = await AsyncStorage.getItem(`pertieeri:v2:${id}`);
    if (legacy) state = JSON.parse(legacy);
  }
  return normalizeMemory(state);
}
export const saveLocalMemory = (owner: string, id: string, value: MemoryState) => writeRecord(keyFor(owner, id, 'memory'), value);
export const loadLocalBank = (owner: string, id: string) => readRecord<BankSnapshot>(keyFor(owner, id, 'bank'));
export const saveLocalBank = (owner: string, id: string, value: BankSnapshot) => writeRecord(keyFor(owner, id, 'bank'), value);
export async function flushMemory() { await Promise.all([...queues.values()]); }
