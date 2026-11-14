import React, { useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { Chevron } from '../icons';
import { displayFor } from '../state/store';
import { C } from '../theme';
import { Text } from './Text';
import { useSlideTransition } from './useSlideTransition';

export const GAME_PROMPT = 'Haluan kokeilla peliä';

export function PageArrow({ direction, disabled, label, onPress }: { direction: -1 | 1; disabled: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: disabled ? '#E3E8E5' : C.greenDark, opacity: pressed ? 0.7 : 1 })}>
    <View style={{ transform: [{ rotate: direction === -1 ? '180deg' : '0deg' }] }}><Chevron size={23} color={disabled ? '#89958E' : '#fff'} /></View>
  </Pressable>;
}

export function SuggestionPager({ items, onSend }: { items: string[]; onSend: (text: string) => void }) {
  const [page, setPage] = useState(0);
  const motion = useSlideTransition();
  const pages = Math.ceil(items.length / 2);
  const current = Math.min(page, Math.max(0, pages - 1));
  const go = (direction: -1 | 1) => motion.slide(direction, () => setPage(current + direction));
  if (!items.length) return null;
  return <View testID="suggestion-pager" style={{ paddingHorizontal: 12, paddingBottom: 8, paddingTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <PageArrow direction={-1} disabled={current === 0 || motion.busy} label="Edelliset ehdotukset" onPress={() => go(-1)} />
    <View style={{ flex: 1, overflow: 'hidden' }}>
      <Animated.View testID="suggestion-page" style={[{ gap: 8 }, motion.style]}>
        {items.slice(current * 2, current * 2 + 2).map(text => {
          const game = text === GAME_PROMPT;
          const filled = game || text.startsWith('§save');
          return <Pressable key={text} accessibilityRole="button" disabled={motion.busy} onPress={() => onSend(text)}
            style={({ pressed }) => ({ borderWidth: 1.5, borderColor: C.greenDark, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, minHeight: 44, justifyContent: 'center', backgroundColor: filled ? C.greenDark : '#fff', opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ fontSize: 16, lineHeight: 21, fontWeight: '600', color: filled ? '#fff' : C.greenText }}>{game ? 'Aloita peli' : displayFor(text)}</Text>
          </Pressable>;
        })}
      </Animated.View>
      {pages > 1 && <Text accessibilityLabel={`Ehdotussivu ${current + 1}/${pages}`} style={{ color: C.sub, fontSize: 12, textAlign: 'center', marginTop: 3 }}>{current + 1} / {pages}</Text>}
    </View>
    <PageArrow direction={1} disabled={current >= pages - 1 || motion.busy} label="Seuraavat ehdotukset" onPress={() => go(1)} />
  </View>;
}
