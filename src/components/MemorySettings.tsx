import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { supabase } from '../data/supabase';
import { useStore } from '../state/store';
import { C } from '../theme';
import { Text, TextInput } from './Text';
import { Card } from './ui';

export function MemorySettings() {
  const st = useStore();
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setNotice('');
    try { await action(); } catch (e) { setNotice(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const auth = (signup: boolean) => run(async () => {
    if (!supabase) return;
    const credentials = { email: email.trim(), password };
    const result = signup ? await supabase.auth.signUp(credentials) : await supabase.auth.signInWithPassword(credentials);
    if (result.error) throw result.error;
    setPassword('');
    if (signup && !result.data.session) setNotice('Vahvista sähköpostiosoite saamastasi viestistä ja kirjaudu sitten sisään.');
  });
  const button = (title: string, action: () => void) => <Pressable accessibilityRole="button" disabled={busy} onPress={action} style={{ paddingVertical: 14, minHeight: 48 }}><Text style={{ fontSize: 17, color: C.greenText, fontWeight: '700' }}>{title}</Text></Pressable>;
  return <Card>
    <Text style={{ fontSize: 20, fontWeight: '700' }}>Keskustelu ja muisti</Text>
    <Text testID="memory-status" style={{ fontSize: 16, lineHeight: 23, marginTop: 8 }}>{st.memoryStatus}</Text>
    <Text style={{ fontSize: 16, lineHeight: 23 }}>{st.cloudStatus}</Text>
    <Text style={{ fontSize: 16, lineHeight: 23, marginTop: 8 }}>{st.messages.length} viestiä · asiakas {st.customerId}. Myös profiili, tavoitteet, skenaariot ja pankkitiedot säilytetään.</Text>
    {!supabase ? <Text style={{ fontSize: 16, lineHeight: 23, marginTop: 10 }}>Supabasea ei ole vielä yhdistetty. Muisti säilyy tällä laitteella. Pilvimuisti tulee käyttöön projektin asetusten lisäämisen jälkeen.</Text> : st.ownerId === 'device' ? <View style={{ gap: 10, marginTop: 12 }}>
      <Text style={{ fontSize: 16, lineHeight: 23 }}>Kirjaudu samalla tilillä myös puhelimessa, jotta voit jatkaa siellä. Kirjautumisen jälkeen voit kopioida tämän laitteen muistin pilvitilillesi.</Text>
      <TextInput accessibilityLabel="Supabase-sähköposti" placeholder="Sähköposti" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} style={{ fontSize: 18, padding: 12, borderWidth: 1, borderColor: C.divider, borderRadius: 8 }} />
      <TextInput accessibilityLabel="Supabase-salasana" placeholder="Salasana" secureTextEntry value={password} onChangeText={setPassword} style={{ fontSize: 18, padding: 12, borderWidth: 1, borderColor: C.divider, borderRadius: 8 }} />
      {button('Kirjaudu pilvimuistiin', () => void auth(false))}
      {button('Luo pilvimuistin käyttäjätili', () => void auth(true))}
    </View> : <>
      {button('Kopioi tämän laitteen muisti pilvitilille', () => void run(st.importDeviceMemory))}
      {button('Kirjaudu ulos pilvimuistista', () => void run(async () => { await st.syncNow(); const result = await supabase!.auth.signOut(); if (result.error) throw result.error; }))}
    </>}
    {button('Tallenna ja synkronoi nyt', () => void run(st.syncNow))}
    {!!notice && <Text accessibilityRole="alert" style={{ fontSize: 16, lineHeight: 23 }}>{notice}</Text>}
  </Card>;
}
