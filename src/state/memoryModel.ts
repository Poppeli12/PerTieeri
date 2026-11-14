import type { Msg, Profile } from '../agent/types';
import type { CustomerInfo, Mortgage, Tx } from '../finance/analytics';
import type { Prefs } from '../finance/optimizer';
import type { Scenario } from '../finance/insights';

export type BankSnapshot = { customer: CustomerInfo; transactions: Tx[]; mortgage?: Mortgage };
export type MemoryState = {
  profile: Profile | null; prefs: Prefs; answers: Record<string, string>; messages: Msg[];
  demo: boolean; quiz: Record<string, number>; scenarios: Record<string, Scenario>;
  draft: string; scrollY: number; updatedAt: number; resetAt: number;
};
export function emptyMemory(): MemoryState {
  return { profile: null, prefs: { protected: [], rejections: {}, accepted: {} }, answers: {}, messages: [], demo: false, quiz: {}, scenarios: {}, draft: '', scrollY: 0, updatedAt: 0, resetAt: 0 };
}
export function normalizeMemory(value: Partial<MemoryState> | null): MemoryState {
  return { ...emptyMemory(), ...value, messages: Array.isArray(value?.messages) ? value.messages : [], scenarios: value?.scenarios ?? {} };
}
/** Message union prevents a stale device from dropping another device's conversation. */
export function mergeMemory(a: MemoryState, b: MemoryState): MemoryState {
  const resetAt = Math.max(a.resetAt, b.resetAt);
  const newer = a.resetAt !== b.resetAt ? (a.resetAt > b.resetAt ? a : b) : a.updatedAt >= b.updatedAt ? a : b;
  const messages = new Map<string, Msg>();
  for (const m of [...a.messages, ...b.messages]) if (m.ts > resetAt) messages.set(m.id, m);
  return { ...newer, resetAt, messages: [...messages.values()].sort((x, y) => x.ts - y.ts || x.id.localeCompare(y.id)) };
}
