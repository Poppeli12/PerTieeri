import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { useK } from '../components/scale';
import { Text, TextInput } from '../components/Text';
import { CustomerRow, getJson } from '../data/api';
import { customerLetter } from '../data/customerLetter';
import { eur0 } from '../finance/analytics';
import { BackIcon, Chevron, ClearIcon } from '../icons';
import { useStore } from '../state/store';
import { C } from '../theme';

/**
 * DEMON asiakasvalinta: kuka tahansa Junction 2026 -aineiston 5 100 asiakkaasta.
 * Oikeassa S-mobiilissa asiakas tunnistetaan kirjautumisesta – toisen tietoja ei voi valita.
 */
const BANDS = ['18-24', '25-34', '35-49', '50-64', '65-74', '75-'];

export function CustomerPicker({ onBack }: { onBack: () => void }) {
  const k = useK();
  const st = useStore();
  const [q, setQ] = useState('');
  const [age, setAge] = useState<string | null>(null);
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getJson(`/api/customers?limit=200&q=${encodeURIComponent(q)}${age ? `&age=${age}` : ''}`)
      .then((r) => alive && (setRows(r.customers), setTotal(r.total), setErr(null)))
      .catch((e) => alive && setErr(String(e.message || e)));
    return () => {
      alive = false;
    };
  }, [q, age]);

  return (
    <View style={{ flex: 1, backgroundColor: C.mint }}>
      <View style={{ height: 76 * k, backgroundColor: C.greenDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        <Pressable onPress={onBack} hitSlop={12} style={{ position: 'absolute', left: 30 * k }} accessibilityLabel="Takaisin">
          <BackIcon size={30 * k} color="#fff" />
        </Pressable>
        <Text style={{ color: '#fff', fontSize: 25 * k, fontWeight: '700' }}>Valitse asiakas</Text>
      </View>

      <View style={{ backgroundColor: '#fff', paddingHorizontal: 31 * k, paddingTop: 22 * k, paddingBottom: 18 * k }}>
        <Text style={{ fontSize: 18 * k, lineHeight: 25 * k, color: C.sub }}>
          Demo: valitse kuka tahansa S-Pankin synteettisen aineiston {total ? `${total.toLocaleString('fi-FI')} ` : ''}asiakkaasta. Oikeassa sovelluksessa asiakas tunnistetaan kirjautumisesta.
        </Text>
        <View style={{ height: 64 * k, backgroundColor: '#F3F3F3', borderRadius: 32 * k, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24 * k, marginTop: 16 * k }}>
          <TextInput value={q} onChangeText={setQ} placeholder="Hae asiakastunnuksella tai postinumerolla" placeholderTextColor="#8E8E8E" autoCapitalize="characters" style={{ flex: 1, fontSize: 21 * k, color: C.text }} />
          {q ? (
            <Pressable onPress={() => setQ('')} hitSlop={10}>
              <ClearIcon size={22 * k} />
            </Pressable>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 * k, marginTop: 16 * k }}>
          {BANDS.map((b) => (
            <Pressable
              key={b}
              onPress={() => setAge(age === b ? null : b)}
              style={{ borderWidth: 2 * k, borderColor: C.greenDark, backgroundColor: age === b ? C.greenDark : '#fff', borderRadius: 999, paddingHorizontal: 16 * k, paddingVertical: 8 * k }}
            >
              <Text style={{ fontSize: 17 * k, fontWeight: '600', color: age === b ? '#fff' : C.greenText }}>{b} v</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {err ? (
        <Text style={{ fontSize: 19 * k, color: C.danger, padding: 31 * k }}>Asiakaslistaa ei saatu: {err}. Käynnistä kehityspalvelin ja aja scripts/build-data.py.</Text>
      ) : !rows.length ? (
        <ActivityIndicator color={C.greenDark} style={{ marginTop: 40 * k }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingVertical: 20 * k }}
          renderItem={({ item: r, index }) => {
            const on = r.id === st.customerId;
            return (
              <Pressable
                onPress={async () => {
                  setBusy(r.id);
                  await st.setCustomer(r.id);
                  setBusy(null);
                  onBack();
                }}
                style={({ pressed }) => [
                  {
                    marginHorizontal: 31 * k,
                    backgroundColor: '#fff',
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 18 * k,
                    paddingHorizontal: 24 * k,
                    borderTopLeftRadius: index === 0 ? 16 * k : 0,
                    borderTopRightRadius: index === 0 ? 16 * k : 0,
                    borderBottomLeftRadius: index === rows.length - 1 ? 16 * k : 0,
                    borderBottomRightRadius: index === rows.length - 1 ? 16 * k : 0,
                    borderBottomWidth: index === rows.length - 1 ? 0 : 1.5 * k,
                    borderBottomColor: C.divider,
                  },
                  pressed && { backgroundColor: '#F4F7F5' },
                ]}
              >
                <View style={{ width: 52 * k, height: 52 * k, borderRadius: 26 * k, backgroundColor: on ? C.greenDark : C.avatar, alignItems: 'center', justifyContent: 'center', marginRight: 18 * k }}>
                  <Text style={{ fontSize: 24 * k, fontWeight: '800', color: on ? '#fff' : C.greenText }}>{customerLetter(r.id)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 21 * k, fontWeight: '600', color: C.text }}>{r.id}</Text>
                  <Text style={{ fontSize: 17 * k, color: C.sub, marginTop: 2 * k }}>
                    {r.age} v · postinro {r.postal} · tulot {eur0(r.income)}/kk{r.mortgage ? ` · asuntolaina ${r.mortgage === 'approved' ? 'hyväksytty' : 'hylätty'}` : ''}
                  </Text>
                </View>
                {busy === r.id ? <ActivityIndicator color={C.greenDark} /> : on ? <Text style={{ fontSize: 16 * k, fontWeight: '700', color: C.greenText }}>Valittu</Text> : <Chevron size={24 * k} color="#1E1E1E" />}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
