import React from 'react';
import { View } from 'react-native';
import { AppIcon, iconNameFor } from '../icons';
import { C } from '../theme';
import { Text } from './Text';
import { Rich } from './ui';

/**
 * Per Tieerin vastaus jäsenneltynä puhekuplaan (pedagoginen rakenne, ei leipätekstimuuria):
 *   ## [ikoni:saasto] Otsikko   → otsikko (valinnainen ikoni minttupallossa)
 *   1. Vaihe                    → vihreä pallo, jonka sisällä valkoinen numero
 *   - Kohta                     → viivalista otsikon alla
 *   [ikoni:vuokra] Rivi         → ikonirivi
 *   > Kysymys asiakkaalle       → korostettu kysymyslaatikko
 * Muu teksti = lyhyt kappale. **lihava** toimii kaikkialla.
 */
const ICON_RE = /^\[ikoni:([\wäöå-]+)\]\s*/i;
const FS = 17;
const LH = 25;

function Icon({ name, size = 22 }: { name: string; size?: number }) {
  if (!iconNameFor(name)) return null;
  return (
    <View style={{ width: size + 14, height: size + 14, borderRadius: (size + 14) / 2, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center' }}>
      <AppIcon name={name} size={size} />
    </View>
  );
}

function NumberBall({ n }: { n: string }) {
  return (
    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.greenDark, alignItems: 'center', justifyContent: 'center', marginTop: -1 }}>
      <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', lineHeight: 18 }}>{n}</Text>
    </View>
  );
}

export function RichBlocks({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: React.ReactNode[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push(<Rich key={`p${blocks.length}`} text={para.join(' ')} style={{ fontSize: FS, lineHeight: LH, color: C.text }} />);
    para = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    let m: RegExpExecArray | null;
    if ((m = /^#{1,4}\s+(.*)$/.exec(line))) {
      flush();
      let t = m[1].replace(/^\*\*(.*)\*\*$/, '$1');
      const ic = ICON_RE.exec(t);
      if (ic) t = t.slice(ic[0].length);
      blocks.push(
        <View key={`h${blocks.length}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: blocks.length ? 6 : 0 }}>
          {ic ? <Icon name={ic[1]} /> : null}
          <Rich text={t} style={{ flex: 1, fontSize: 19, lineHeight: 25, fontWeight: '700', color: C.greenText }} />
        </View>,
      );
    } else if ((m = /^(\d{1,2})[.)]\s+(.*)$/.exec(line))) {
      flush();
      blocks.push(
        <View key={`n${blocks.length}`} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <NumberBall n={m[1]} />
          <Rich text={m[2]} style={{ flex: 1, fontSize: FS, lineHeight: LH, color: C.text }} />
        </View>,
      );
    } else if ((m = /^[-•–*]\s+(.*)$/.exec(line))) {
      flush();
      let t = m[1];
      const ic = ICON_RE.exec(t);
      if (ic) t = t.slice(ic[0].length);
      blocks.push(
        <View key={`b${blocks.length}`} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingLeft: 4 }}>
          {ic && iconNameFor(ic[1]) ? <View style={{ marginTop: 1 }}><AppIcon name={ic[1]} size={22} /></View> : <Text style={{ fontSize: FS, lineHeight: LH, color: C.greenText, fontWeight: '700' }}>–</Text>}
          <Rich text={t} style={{ flex: 1, fontSize: FS, lineHeight: LH, color: C.text }} />
        </View>,
      );
    } else if ((m = ICON_RE.exec(line))) {
      flush();
      blocks.push(
        <View key={`i${blocks.length}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Icon name={m[1]} />
          <Rich text={line.slice(m[0].length)} style={{ flex: 1, fontSize: FS, lineHeight: LH, color: C.text }} />
        </View>,
      );
    } else if ((m = /^>\s*(.*)$/.exec(line))) {
      flush();
      blocks.push(
        <View key={`q${blocks.length}`} style={{ backgroundColor: C.mint, borderLeftWidth: 4, borderLeftColor: C.greenDark, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, marginTop: 4 }}>
          <Rich text={m[1]} style={{ fontSize: FS, lineHeight: LH, color: C.text, fontWeight: '600' }} />
        </View>,
      );
    } else para.push(line);
  }
  flush();
  return <View style={{ gap: 10 }}>{blocks}</View>;
}
