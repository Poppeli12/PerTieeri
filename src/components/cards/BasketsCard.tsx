import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '../Text';
import { baskets, eur0 } from '../../finance/analytics';
import { Basket, BASKET_EXPLAIN, BASKET_FI } from '../../finance/categories';
import { AppIcon } from '../../icons';
import { BASKET_COLORS, C } from '../../theme';
import { useK } from '../scale';
import { BUCKET_ORDER } from '../buckets/receiptSorting';

const ICON: Record<Basket, string> = { regular: 'vuokra', irregular: 'terveys', slipping: 'ravintola' };
const SHORT: Record<Basket, string> = { regular: 'Pakolliset säännölliset', irregular: 'Pakolliset epäsäännölliset', slipping: 'Arjen lipsuvat' };

/**
 * Kolme rahakoria chatissa: isot, helppolukuiset ämpärit summineen ja täyttöasteineen.
 * (Lajitteluanimaatio näkyy esittelyssä – täällä ei aloiteta uutta lajittelua, jottei näkymä sekoitu.)
 */
export function BasketsCard({ months = 6 }: { compact?: boolean; months?: number }) {
  const k = useK();
  const b = useMemo(() => baskets(months), [months]);
  const [open, setOpen] = useState<Basket | null>(null);
  const total = b.totals.regular + b.totals.irregular + b.totals.slipping;
  const denominator = Math.max(total, b.income, 1);

  return (
    <View>
      <Text style={{ fontSize: 17 * k, color: C.sub, marginBottom: 14 * k }}>
        {b.months === 1 ? 'Viimeisin kuukausi' : `Keskimäärin kuukaudessa, viimeiset ${b.months} kk`} · tulot {eur0(b.income)}/kk
      </Text>
      <View style={{ flexDirection: 'row', gap: 10 * k }}>
        {BUCKET_ORDER.map((basket) => {
          const share = Math.min(1, b.totals[basket] / Math.max(1, b.income));
          const on = open === basket;
          return (
            <Pressable
              key={basket}
              onPress={() => setOpen(on ? null : basket)}
              accessibilityRole="button"
              accessibilityLabel={`${BASKET_FI[basket]}, ${eur0(b.totals[basket])} kuukaudessa`}
              style={{ flex: 1, alignItems: 'center' }}
            >
              {/* ämpäri: pyöristetty astia, joka täyttyy osuuden mukaan */}
              <View style={{ width: '100%', height: 150 * k, borderWidth: 2.5 * k, borderColor: on ? BASKET_COLORS[basket] : '#175636', borderTopLeftRadius: 6 * k, borderTopRightRadius: 6 * k, borderBottomLeftRadius: 18 * k, borderBottomRightRadius: 18 * k, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: '#fff' }}>
                <View style={{ height: `${Math.round(share * 100)}%`, backgroundColor: BASKET_COLORS[basket], opacity: 0.85 }} />
                <View style={{ position: 'absolute', top: 10 * k, left: 0, right: 0, alignItems: 'center' }}>
                  <AppIcon name={ICON[basket]} size={30 * k} />
                  <Text style={{ fontSize: 19 * k, fontWeight: '700', color: C.text, marginTop: 4 * k }}>{Math.round(share * 100)} %</Text>
                </View>
              </View>
              <Text style={{ fontSize: 22 * k, fontWeight: '800', color: C.greenText, marginTop: 10 * k }}>{eur0(b.totals[basket])}</Text>
              <Text style={{ fontSize: 15.5 * k, lineHeight: 20 * k, color: C.text, textAlign: 'center', marginTop: 2 * k }}>{SHORT[basket]}</Text>
            </Pressable>
          );
        })}
      </View>

      {open ? (
        <View style={{ marginTop: 16 * k, backgroundColor: C.mint, borderRadius: 12 * k, padding: 16 * k }}>
          <Text style={{ fontSize: 19 * k, fontWeight: '700', color: C.text, marginBottom: 6 * k }}>{BASKET_FI[open]}</Text>
          <Text style={{ fontSize: 17 * k, lineHeight: 24 * k, color: C.text, marginBottom: 8 * k }}>{BASKET_EXPLAIN[open]}</Text>
          {b.items[open].slice(0, 5).map((item) => (
            <View key={item.label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 * k }}>
              <Text style={{ flex: 1, fontSize: 17 * k, color: C.text }}>{item.label}</Text>
              <Text style={{ fontSize: 17 * k, fontWeight: '700', color: C.text }}>{eur0(item.amount)}/kk</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={{ fontSize: 16 * k, color: C.sub, textAlign: 'center', marginTop: 12 * k }}>Napauta ämpäriä, niin näet mitä siinä on.</Text>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 * k, marginBottom: 8 * k }}>
        <Text style={{ fontSize: 19 * k, fontWeight: '600', color: C.text }}>Jää käteen</Text>
        <Text style={{ fontSize: 21 * k, fontWeight: '800', color: b.left >= 0 ? C.greenText : C.danger }}>{eur0(b.left)}/kk</Text>
      </View>
      <View style={{ flexDirection: 'row', height: 14 * k, borderRadius: 7 * k, overflow: 'hidden', backgroundColor: C.mint2 }}>
        {BUCKET_ORDER.map((basket) => <View key={basket} style={{ flex: b.totals[basket] / denominator, backgroundColor: BASKET_COLORS[basket] }} />)}
        {b.left > 0 && <View style={{ flex: b.left / denominator, backgroundColor: C.mint2 }} />}
      </View>
      {b.left < 0 && <Text style={{ fontSize: 16 * k, color: C.danger, marginTop: 8 * k }}>Menot ylittävät tulot – erotus on otettu tilin saldosta.</Text>}
    </View>
  );
}
