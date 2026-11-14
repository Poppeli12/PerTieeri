import { supabase } from '../data/supabase';
import { normalizeMemory, type BankSnapshot, type MemoryState } from './memoryModel';
const uploadedBanks = new Map<string, BankSnapshot>();
function deadline() { const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 12000); return { controller, done: () => clearTimeout(timer) }; }

export async function cloudLoad(owner: string, customerId: string) {
  if (!supabase || owner === 'device') return null;
  const request = deadline();
  try {
  const [memory, bank] = await Promise.all([
    supabase.from('pt_customer_memory').select('state').eq('owner_id', owner).eq('customer_id', customerId).abortSignal(request.controller.signal).maybeSingle(),
    supabase.from('pt_bank_snapshots').select('payload').eq('owner_id', owner).eq('customer_id', customerId).abortSignal(request.controller.signal).maybeSingle(),
  ]);
  if (memory.error || bank.error) throw new Error((memory.error || bank.error)!.message);
  return { memory: normalizeMemory(memory.data?.state), bank: bank.data?.payload as BankSnapshot | undefined };
  } finally { request.done(); }
}
export async function cloudSave(owner: string, customerId: string, state: MemoryState, bank?: BankSnapshot) {
  if (!supabase || owner === 'device') return;
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user.id !== owner) throw new Error('Pilvitilin istunto vaihtui.');
  const request = deadline();
  try {
  const key = owner + ':' + customerId;
  if (bank && uploadedBanks.get(key) !== bank) {
    const result = await supabase.from('pt_bank_snapshots').upsert({ owner_id: owner, customer_id: customerId, payload: bank, updated_at: new Date().toISOString() }).abortSignal(request.controller.signal);
    if (result.error) throw new Error(result.error.message);
    uploadedBanks.set(key, bank);
  }
  const result = await supabase.rpc('pt_save_memory', { p_customer_id: customerId, p_state: state }).abortSignal(request.controller.signal);
  if (result.error) throw new Error(result.error.message);
  } finally { request.done(); }
}
