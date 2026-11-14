# Per Tieerin muisti ja Supabasen käyttöönotto

Paikallinen muisti toimii jo ilman Supabasea. Asiakaskohtaisesti säilyvät keskustelu ja kortit, profiili, vahvistetut tavoitteet ja suojatut menot, vastaukset, mitä jos -skenaariot ostoksineen, luonnos ja keskustelun vierityskohta. Myös valitun asiakkaan koko pankkidata (tilitapahtumat metatietoineen sekä mahdollinen lainahakemus) tallennetaan laitteelle. Sovelluksen poistaminen tai selaimen sivustotietojen tyhjentäminen poistaa paikallisen muistin.

## 1. Luo oma projekti

1. Avaa https://supabase.com/dashboard ja luo käyttäjätili tai kirjaudu sisään.
2. Valitse **New project**, organisaatio ja nimeksi esimerkiksi **per-tieeri**.
3. Valitse Euroopan alue ja tallenna tietokannan salasana omaan salasananhallintaasi. Salasanaa ei tarvita sovelluksen asetuksiin.
4. Odota, että projekti valmistuu.

## 2. Luo tietokantataulut ja käyttöoikeudet

1. Avaa projektin **SQL Editor → New query**.
2. Kopioi tiedoston `supabase/migrations/202611150001_customer_memory.sql` koko sisältö editoriin ja valitse **Run**. Aja kerran uuteen projektiin.
3. Table Editorissa pitäisi näkyä `pt_customer_memory` ja `pt_bank_snapshots`. Molemmissa on RLS käytössä. Kirjautunut käyttäjä voi lukea ja kirjoittaa vain omia rivejään. Samalla demohenkilöllä voi olla eri testaajien erilliset muistot.

## 3. Lisää kaksi julkista asetusta

Projektin **Connect**-ikkunasta tai **Project Settings → API Keys** -kohdasta löydät Project URL:n ja **Publishable key** -avaimen. Lisää projektikansion olemassa olevaan `.env.local`-tiedostoon nämä rivit. Säilytä tiedoston muut rivit:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://OMA-PROJEKTI.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_OMA-AVAIN
```

Älä laita sovellukseen Secret key / service_role -avainta tai tietokannan salasanaa. Julkisen avaimen käyttö perustuu yllä luotuihin RLS-oikeuksiin.

Käynnistä Expo-kehityspalvelin uudelleen projektikansiossa:

```powershell
npm run phone
```

Skannaa uuden palvelimen QR-koodi Androidin Expo Go -sovelluksella. Palvelin tarvitsee pysyä käynnissä. Selaimen nykyinen muisti ei automaattisesti siirry puhelimeen ennen seuraavaa kirjautumista ja kopiointia.

## 4. Salli anonyymi kirjautuminen (ei kirjautumisnäkymää)

Sovelluksessa ei ole kirjautumisnäkymää. Se kirjautuu käynnistyessään automaattisesti anonyyminä Supabase-käyttäjänä (`signInAnonymously`).

1. Avaa **Authentication → Sign In / Providers**.
2. Ota käyttöön **Allow anonymous sign-ins** ja tallenna.
3. Käynnistä sovellus uudelleen. Table Editorin `auth.users`-listaan ilmestyy anonyymi käyttäjä.

Jokaisella aineiston 5 100 asiakkaalla (CUST00001…) on oma rivinsä `pt_customer_memory`-taulussa: oma keskusteluhistoria, muisti ja skenaariot. Rivi syntyy, kun asiakas valitaan ensimmäisen kerran. Kun asiakasta vaihdetaan, sovellus lataa juuri sen asiakkaan historian, ja palatessa edellinen historia on tallessa.

Anonyymi käyttäjä on laitekohtainen. Saman historian näkyminen toisella laitteella vaatisi sähköpostikirjautumisen.

## Tarkista toiminta

Kerro esimerkiksi: ”Tavoitteeni on tietokone, eikä liikunnasta tingitä.” Tee mitä jos -kokeilu. Sulje ja avaa sovellus. Kysy: ”Mitä sovimme tärkeistä menoistani?” Tarkista myös toisella laitteella, että viestit ja kokeilu näkyvät samalla käyttäjällä ja asiakastunnuksella.

Katkennut pilviyhteys jättää paikallisen kopion käyttöön. Sovellus yrittää synkronointia uudelleen muutosten, aktiiviseksi palaamisen tai tallennuspainikkeen yhteydessä. Eri laitteiden viestit yhdistetään; muun tilan yhtäaikaisissa muokkauksissa viimeisin päivitys voittaa. Tämä on tavallinen keskustelumuisti, ei semanttinen vektoritietokanta. Kielimalli saa viimeisimmät viestit ja voi hakea vanhempaa arkistoa työkalulla.

## Toteutuksen rajat

Tässä projektissa on synteettinen pankkidemo. Supabasen käyttöoikeuksia ja SQL-migraatiota testataan paikallisella PostgreSQL-moottorilla. Oikeaa Supabase-yhteyttä ja kahden laitteen pilvisynkronointia ei voi vahvistaa ennen kuin oma projektisi on luotu ja asetukset lisätty. Kehityspalvelimen asiakasvalitsin ja tekoälyvälityspiste eivät ole tuotantopankin tunnistautuminen. Laitemuisti on AsyncStoragea, ei erikseen salattu pankkitietovarasto.

Viralliset ohjeet: [Expo ja Supabase](https://docs.expo.dev/guides/using-supabase/), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
