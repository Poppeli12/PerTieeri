import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Svg, { Path, Rect, Text as SvgText } from 'react-native-svg';
import { BackIcon, ClearIcon, ListDocIcon } from '../icons';
import { useK } from '../components/scale';
import { SCard, SHeader, SHeading, SRow } from '../components/smobile';
import { S_PATH } from '../components/SLogo';
import { Text, TextInput } from '../components/Text';
import { C } from '../theme';

/**
 * Pankki › Kortit › Kortti  (design/reference/pankki-kortti.png)
 * Valkoinen yläosa: otsikko, kortin nimi, pystysuora vihreä S-Etukortti Visa -kortti, Google Pay -rivi.
 * Mintunvihreä alaosa: Tilitapahtumat, Korttiturvallisuus-lista.
 */
export function CardDetailScreen({ onBack }: { onBack: () => void }) {
  const k = useK();
  return (
    <View style={{ flex: 1, backgroundColor: C.mint }}>
      <SHeader
        title="Kortti"
        left={
          <Pressable onPress={onBack} hitSlop={12} accessibilityLabel="Takaisin">
            <BackIcon size={30 * k} color="#1E1E1E" />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 * k }}>
        <View style={{ backgroundColor: '#fff' }}>
          <View style={{ height: 50 * k, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1.5 * k, borderBottomColor: C.divider }}>
            <Text style={{ fontSize: 22 * k, color: C.text, fontWeight: '500' }}>S-Etukortti Visa Debit</Text>
          </View>
          <View style={{ alignItems: 'center', paddingTop: 26 * k, paddingBottom: 30 * k }}>
            <VisaCard width={234 * k} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingBottom: 30 * k }}>
            <GPay size={18 * k} />
            <View style={{ width: 1.5 * k, height: 34 * k, backgroundColor: C.divider, marginHorizontal: 18 * k }} />
            <Text style={{ fontSize: 18.5 * k, color: C.text }}>Kortti on lisätty Google Payhin</Text>
          </View>
        </View>

        <SCard style={{ marginTop: 26 * k }} onPress={() => {}}>
          <SRow icon={<ListDocIcon size={30 * k} color="#5E5E5E" />} title="Tilitapahtumat" last />
        </SCard>

        <SHeading>Korttiturvallisuus</SHeading>
        <SCard>
          <SRow title="Kortin sulkeminen" />
          <SRow title="Turvarajat" />
          <SRow title="Käyttöalue" right="Koko maailma" />
          <SRow title="Verkkomaksut" right="Sallittu" last />
        </SCard>
      </ScrollView>
    </View>
  );
}

/** S-Etukortti Visa Debit -kortti pystyasennossa (mittasuhteet 88 × 140 referenssikuvasta) */
function VisaCard({ width }: { width: number }) {
  const h = width * (140 / 88);
  // S-tunnus kortin keskellä: rajaus 201 × 301, korkeus ≈ 36 % kortin korkeudesta
  const sH = 140 * 0.36;
  const sc = sH / 301;
  const sx = 44 - (70.5 + 100.5) * sc;
  const sy = 58 - (33 + 150.5) * sc;
  return (
    <Svg width={width} height={h} viewBox="0 0 88 140">
      <Rect x={0} y={0} width={88} height={140} rx={5} fill="#00AE42" />
      <SvgText x={7} y={12.5} fill="#fff" fontSize={6.2} fontWeight="700" fontFamily="Figtree-700" letterSpacing={-0.1}>
        S-ETUKORTTI
      </SvgText>
      <SvgText x={81} y={14} fill="#fff" fontSize={11} fontWeight="800" fontStyle="italic" fontFamily="Figtree-800" textAnchor="end" letterSpacing={-0.3}>
        VISA
      </SvgText>
      <Path d={S_PATH} transform={`translate(${sx} ${sy}) scale(${sc})`} stroke="#fff" strokeWidth={19} fill="none" />
      <SvgText x={44} y={96} fill="#fff" fontSize={9.6} fontWeight="800" fontFamily="Figtree-800" textAnchor="middle" letterSpacing={0.3}>
        PANKKI
      </SvgText>
      {/* siru */}
      <Rect x={26} y={108} width={11} height={14} rx={2} fill="#E3C27A" />
      <Path d="M26 113h4M26 117h4M33 113h4M33 117h4M30 108v14M33 108v14" stroke="#B9944A" strokeWidth={0.5} />
      <SvgText x={82} y={134} fill="#fff" fontSize={3.8} fontFamily="Figtree-500" textAnchor="end">
        Debit
      </SvgText>
    </Svg>
  );
}

/** Google Pay -merkki: värillinen G + "Pay" */
function GPay({ size }: { size: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" fill="#4285F4" />
        <Path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" fill="#34A853" />
        <Path d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1A10 10 0 0 0 2 12c0 1.6.4 3.1 1.1 4.6z" fill="#FBBC05" />
        <Path d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10c.8-2.3 3-4 5.6-4z" fill="#EA4335" />
      </Svg>
      <Text style={{ fontSize: size * 1.05, color: '#5F6368', marginLeft: size * 0.15, fontWeight: '500' }}>Pay</Text>
    </View>
  );
}

/**
 * Maksu › Uusi maksu › Saaja  (design/reference/maksu-saaja.png)
 * Vihreä yläpalkki, segmenttivalitsin (musta valittu), keskitetyt kenttäotsikot, harmaat kentät,
 * alleviivatut vihreät linkit, alhaalla "Seuraava" (harmaa kunnes tiedot on syötetty).
 */
export function PayeeScreen({ onBack, onNext }: { onBack: () => void; onNext: (iban: string, name: string) => void }) {
  const k = useK();
  const [seg, setSeg] = useState<0 | 1>(0);
  const [iban, setIban] = useState('FI');
  const [name, setName] = useState('');
  const ok = iban.replace(/\s/g, '').length >= 16 && name.trim().length > 1;
  const input = { height: 84 * k, backgroundColor: '#F3F3F3', marginHorizontal: 40 * k, borderRadius: 2 * k, flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 22 * k };
  const label = { fontSize: 25 * k, color: C.text, textAlign: 'center' as const, marginBottom: 16 * k, fontWeight: '500' as const };
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ height: 76 * k, backgroundColor: C.greenDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        <Pressable onPress={onBack} hitSlop={12} style={{ position: 'absolute', left: 30 * k }} accessibilityLabel="Takaisin">
          <BackIcon size={30 * k} color="#fff" />
        </Pressable>
        <Text style={{ color: '#fff', fontSize: 25 * k, fontWeight: '700' }}>Saaja</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingTop: 30 * k, paddingBottom: 30 * k }} keyboardShouldPersistTaps="handled">
        {/* segmenttivalitsin */}
        <View style={{ flexDirection: 'row', marginHorizontal: 40 * k, height: 52 * k, borderWidth: 2 * k, borderColor: '#222', borderRadius: 2 * k, overflow: 'hidden' }}>
          {['Syötä tiedot', 'Maksupohjat'].map((t, i) => (
            <Pressable key={t} onPress={() => setSeg(i as 0 | 1)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: seg === i ? '#222' : '#fff' }}>
              <Text style={{ fontSize: 22.5 * k, color: seg === i ? '#fff' : '#222', fontWeight: '500' }}>{t}</Text>
            </Pressable>
          ))}
        </View>

        {seg === 0 ? (
          <>
            <Text style={[label, { marginTop: 50 * k }]}>Saajan tilinumero</Text>
            <View style={input}>
              <TextInput value={iban} onChangeText={(t) => setIban(t.toUpperCase())} autoCapitalize="characters" style={{ flex: 1, fontSize: 24 * k, color: C.text, fontWeight: '600' }} />
              {iban.length > 0 && (
                <Pressable onPress={() => setIban('')} hitSlop={10}>
                  <ClearIcon size={22 * k} />
                </Pressable>
              )}
            </View>
            <Text style={[label, { marginTop: 32 * k }]}>Saajan nimi</Text>
            <View style={input}>
              <TextInput value={name} onChangeText={setName} style={{ flex: 1, fontSize: 24 * k, color: C.text }} />
            </View>
            <View style={{ alignItems: 'center', marginTop: 40 * k, gap: 28 * k }}>
              {['Lue viivakoodi', 'Liitä virtuaaliviivakoodi'].map((t) => (
                <Pressable key={t} hitSlop={6}>
                  <Text style={{ fontSize: 24.5 * k, color: C.greenText, fontWeight: '600', textDecorationLine: 'underline' }}>{t}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <Text style={{ fontSize: 20 * k, color: C.sub, textAlign: 'center', marginTop: 60 * k }}>Sinulla ei ole vielä maksupohjia.</Text>
        )}
      </ScrollView>

      <View style={{ height: 104 * k, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', boxShadow: '0 -2px 8px rgba(0,0,0,0.05)' }}>
        <Pressable disabled={!ok} onPress={() => onNext(iban, name)} style={{ paddingHorizontal: 60 * k, paddingVertical: 14 * k }}>
          <Text style={{ fontSize: 26 * k, fontWeight: '700', color: ok ? C.greenText : '#D6D6D6' }}>Seuraava</Text>
        </Pressable>
      </View>
    </View>
  );
}
