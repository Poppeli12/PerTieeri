import type { Msg } from './types';

/** Recent conversational context; the complete archive stays in app storage. */
export function conversationInput(messages: Msg[], currentText: string) {
  const selected: { role: 'user' | 'assistant'; content: string }[] = [];
  let chars = 0;
  for (let i = messages.length - 1; i >= 0 && selected.length < 60; i--) {
    const m = messages[i];
    const cardText = m.cards?.length ? JSON.stringify(m.cards) : '';
    const content = [m.text, cardText ? `Aiemmin näytetyt kortit (historiallisia lukuja): ${cardText.length <= 12000 ? cardText : cardText.slice(0, 12000) + ' [korttitiedot lyhennetty; hae luvut uudelleen työkalulla]'}` : ''].filter(Boolean).join('\n').slice(0, 20000);
    if (!content) continue;
    if (chars + content.length > 70_000) break;
    selected.unshift({ role: m.from === 'user' ? 'user' : 'assistant', content });
    chars += content.length;
  }
  return [...selected, { role: 'user' as const, content: currentText }];
}
export function searchConversation(messages: Msg[], query: string) {
  const terms = query.toLocaleLowerCase('fi').split(/\s+/).filter(Boolean);
  return messages.filter(m => terms.every(term => (m.text ?? '').toLocaleLowerCase('fi').includes(term))).slice(-20)
    .map(m => ({ role: m.from, date: new Date(m.ts).toISOString(), text: m.text }));
}
