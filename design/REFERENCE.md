# S-mobiili – visuaalinen referenssi

Tavoite: Per Tieeri -sovellus näyttää **identtiseltä** S-mobiilin kanssa (ikonit, värit, fontti, rakenne).
Tämä tiedosto + `reference/`-kansion kuvat ovat totuuden lähde. Päivitä aina kun saat uusia kuvakaappauksia.

## Kuvat

| Tiedosto | Sisältö |
|---|---|
| `reference/s-logo.png` | Oikea S-tunnus (vihreä neliö, valkoinen S) – 349 × 372 |
| `reference/koti-bonus.png` | Koti: bonusnäkymä, pankkiviestit, Tilit ja kortit, alapalkki – 591 × 1280 (tarkin kuva, mittojen pohja) |
| `reference/koti-yla.png`, `koti-yla-2.png` | Koti yläosa (pieni resoluutio; sama mittakaava kuin koti-bonus) |
| `reference/koti-ala-bonuspaikat.png` | Koti alaosa: artikkelikaruselli, Suosikkitoimipaikat, Mistä saat Bonusta? -logot |
| `reference/s-etukortti.png` | S-Etukortti-välilehti |
| `reference/pankki-yla.png`, `pankki-ala.png` | Pankki-välilehti |
| `reference/pankki-kortti.png` | Pankki › Kortit › Kortti (Visa-kortti, Korttiturvallisuus) |
| `reference/mina-yla.png`, `mina-yla-2.png`, `mina-ala.png` | Minä-välilehti |
| `reference/maksu-sheet.png` | (+) Maksu -paneeli (nappi muuttuu harmaaksi ×:ksi) |
| `reference/maksu-saaja.png` | Maksu › Uusi maksu › Saaja -lomake |
| `reference/alapalkki-tuki.png`, `alapalkki-tuki-hd.png` | Käyttäjän luonnos Tuki-napista (+):n oikealla puolella |
| `current/*.png` | Tämän sovelluksen kuvakaappaukset (`node scripts/shots-ref.js 8101`), `current/vertailu-*.png` = ref vasemmalla, oma oikealla |

**Huom. mittakaava:** pienet kuvat (≈220 px) ovat samassa mittakaavassa kuin koti-bonus.png (tarkistettu otsikon leveydestä).
Pankki-, S-Etukortti-, Saaja- ja Maksu-näkymien tekstit ovat ~15–20 % isompia kuin ensimmäinen arvio – leipäteksti n. 23–25 px, listarivi 25 px.

## Mittajärjestelmä

Kaikki mitat ovat referenssikuvakaappauksen pikseleitä (leveys **591 px**) ja kerrotaan
`k = näytön leveys / 591` (`useK()` tiedostossa `src/components/scale.ts`). Näin suhteet pysyvät samoina.

## S-tunnus (`src/components/SLogo.tsx`)

- **Yksi** tasapaksu valkoinen viiva (paksuus 19/372), joka kiertää paksun S:n ääriviivan. EI kahta erillistä viivaa, EI kursivointia.
- Jäljitetty pikseleistä, IoU 0,94 alkuperäiseen. Polku: `S_PATH`.
- Kuvakkeen vihreä `#00A344`.

## Värit (mitattu pikseleistä)

| Käyttö | Väri |
|---|---|
| Bonustalo, (+)-nappi, Tuki-nappi | `#007842` |
| Otsikot / summat / linkit / bonusnäkymän tekstit ja viivat | `#126645` |
| Korttien ääriviivakuvakkeet (kirje, sijainti, kuitti…) | `#14874A` |
| Aktiivinen alapalkin kuvake (täytetty talo/lompakko/henkilö) | `#00AE42` |
| Sivun tausta (minttu) | `#EBF7ED` |
| Kortit | `#FFFFFF`, pyöristys 16, ei varjoa |
| Leipäteksti | `#161616` |
| Alateksti (Debit **** 2600) | `#5E5E5E` |
| Passiivinen alapalkin teksti ja kuvake | `#5F5F5F` |
| Aktiivinen alapalkin teksti | musta (EI vihreä) |
| Tuki-teksti | vihreä `#007842` |
| Erotinviiva | `#E7E7E7` |

## Fontti

S-mobiili käyttää S-ryhmän omaa **S Bonus** -fonttia (ei vapaasti saatavilla). Käytössä lähin vapaa vastine
**Figtree** (`@expo-google-fonts/figtree`), joka valitaan fontWeightin mukaan `src/components/Text.tsx`:ssä.
Kaikki tekstit tuodaan sieltä, EI `react-native`:sta.

## Koti (koti-bonus.png, y-koordinaatit, tilapalkki 0–50)

- Yläpalkki y 90: lukko x 52, kaksi sivupistettä x 283/307 (tumma + vaalea), viestikupla pisteellä x 538.
- "Seuraavaan tasoon 106,97 €" 33 px lihava, isojen kirjainten keskikohta y 267.
- "Saatat jo olla seuraavalla bonustasolla ⓘ" 18 px, y 296.
- 1,5 % / 200 € (ohut) y 338 · katkoviiva y 352 (x 46–545).
- 1,0 % / 50 € (lihava) y 457 · yhtenäinen viiva y 472.
- Talo x 141–449, harja y 402, räystäs y 440, pohja y 586.
- "Bonusta tulossa" 26 px y 471 · "0,93" 70 px + "€" 40 px y 520.
- "Katso kokonaishyötysi ›" 24 px lihava y 615. Valkoinen alue loppuu y 645.
- Kortti "Uudet pankkiviestit" y 672–755 (kirje vihreä, pallo "1" #007842).
- "Tilit ja kortit" 29 px lihava y 811. Kortti y 853: S-Tili / 157,80 € (30 px lihava vihreä) │ S-Etukortti Visa Debit / Debit **** 2600 │ Piilota tiedot (keskitetty vihreä).

## Koti alaosa (koti-ala)

Tilit ja kortit -kortti → "Edut ja vinkit" + "Avaa" oikealla → kortti "Lähellä" (sijaintineula keskellä tekstin yllä)
→ kortti "Tallennetut" (kirjanmerkki) → "Kuitit" + "Avaa" → kortti: kuitti-ikoni · "Prisma Iso Omena" / "21:49 23.4." · "4,49 €" oikealla.

## Pankki (pankki)

Valkoinen yläpalkki: "S-Pankki" keskellä (lihava), viestikupla oikealla. Kortit, kukin:
iso vihreä ääriviivakuvake vasemmalla · otsikko iso lihava vihreä · alateksti musta · nuoli ">" musta.
Säästäjä (pokaali €) · Sijoitukset (salkku + käyrä) · Lainat (asiakirja € + kynä) · Palkka ja eläke (kirjekuori + paperi)
· "Tee peruutuspyyntö" (musta, harmaa alateksti, nuoli).

## Minä (mina-yla, mina-ala)

Yläpalkki "Minä" + viestikupla. Iso vaaleanvihreä pallo, jossa iso tummanvihreä kirjain → NIMI ISOLLA lihavana.
Kortti "Omat tiedot" (henkilö + rivit -ikoni, alateksti, nuoli). "Tunnistaminen": kaksi korttia vierekkäin –
"Lue QR-koodi" (QR) ja "Hyväksy tapahtuma" (kilpi + ruksi), kuvake keskellä tekstin yllä.
"S-Pankin palvelut": Tunnistaminen (avain) · Tarkista verkkopankin käyttäjätunnus (henkilökortti) · Asiakastiedot (lomake) · Lapsen pankkipalvelut (kaksi hahmoa).
"Asiakasomistajan palvelut": S-Etukortti S-mobiilissa (puhelin) · Sähköiset kuitit (kuitti) · S-Etukortti / Tilaa itsellesi tai perheenjäsenille (kortti).
"Sovelluksen asetukset": Sovellusversio 2.41.5 (puhelin) · Ilmoitukset (megafoni).

## Alapalkki (päätetty käyttäjän kanssa)

**6 kohtaa, yhtä leveät sarakkeet:** Koti · S-Etukortti · (+) Maksu · **Tuki** · Pankki · Minä.
(+) ja Tuki vierekkäin keskellä samankokoisina pyöreinä nappeina (halkaisija 76, väri `#007842`, nousevat palkin yli).

- Valkoinen palkki, korkeus 95, pehmeä varjo ylöspäin.
- Kuvakkeet 29 px (keskikohta 30 px palkin yläreunasta), tekstit 15,5 px (keskikohta 64 px).
- Passiivinen: harmaa kuvake + harmaa teksti `#5F5F5F`.
- **Aktiivinen: täytetty vihreä kuvake `#00AE42` + LIHAVA MUSTA teksti** (Koti: talo + valkoinen ovi, S-Etukortti: vihreä S, Pankki: täytetty lompakko, Minä: täytetty hahmo).
- (+) avattuna: harmaa pallo, jossa × (plus kääntyy 45°).
- Tuki: valkoinen konduktöörin rintakuva vihreässä pallossa, teksti aina vihreä.

## Uudet näkymät (toteutettu)

- **S-Etukortti:** tummanvihreä kaista, jonka alareunaan kirkkaanvihreä kortti (yläkulmat pyöreät, alakulmat suorat): S-tunnus, "S-ETUKORTTI", valkoinen pallo + skannauskuvake. Kortit Bonus ja ostot (kassi + sydän), Kuitit. "Vahvista sähköpostisi" (minttuneliö + kirje/ruksi, × oikealla, "Vahvista >"). Etuja sinulle: vaakarulla, kirjanmerkki valkoisessa neliössä.
- **Pankki:** opiskelijakortti (×, vihreä lihava linkki, www.s-pankki.fi) → Tilit (tilikirja + S), Maksut ja e-laskut (€-lasku), Kortit (pystykortti + S), Säästäjä, Sijoitukset, Lainat, Palkka ja eläke, Tee peruutuspyyntö. Otsikot 36 px lihava vihreä, alateksti 23,5 px musta, kuvakkeet 62 px.
- **Kortti:** takaisin-nuoli, "Kortti", kortin nimi + ohut viiva, vihreä pystykortti (S-ETUKORTTI, VISA, iso S, PANKKI, siru, Debit), G Pay -rivi, Tilitapahtumat, Korttiturvallisuus-lista.
- **Minä:** valkoinen profiiliosa (vaaleanvihreä pallo 128, kirjain 74, nimi 36 px), sitten minttu. Omat tiedot (henkilö), Tunnistaminen (QR kehyksessä, kilpi + avaimenreikä), S-Pankin palvelut (avain, henkilökortti, asiakirja + henkilö, kolme hahmoa), Asiakasomistajan palvelut (pystykortti + S, sahalaitakuitti, kortti + plus "S-Etukortit"), Sovelluksen asetukset.
- **Maksu-paneeli:** tummanvihreä tausta, valkoinen paneeli, kahva (kaksi viivaa), "S-Tili", jättisaldo vihreänä pienellä €:llä, "Uusi maksu" (vihreä nuolipallo).
- **Saaja:** vihreä yläpalkki, segmenttivalitsin (musta valittu), keskitetyt kenttäotsikot, harmaat kentät, alleviivatut vihreät linkit, "Seuraava" harmaana kunnes tiedot on syötetty.
- **Koti alaosa:** artikkelikaruselli (nuolipallot + sivuviivat), Suosikkitoimipaikat (kuvakepallot), Mistä saat Bonusta? (8 pyöreää logoa, 4 per rivi).

## Ikonit (`src/icons/`) – AINA täältä

- `base.tsx` = S-mobiilin käyttöliittymäikonit, `app.tsx` = S-Pankin kuvitusikonit, `registry.tsx` = ikonit nimellä + kategoria → ikoni (`AppIcon`).
- Referenssit: `reference/ikonit/` (lukko ****, puhelin + ruksi, kättely, kädet ylös, QR-tunnistus, S-PANKKI-logo).
- Tyyli: ääriviiva `#00A945`, viiva 1,7 / 24, pyöristetyt päät ja kulmat, tummanvihreä korostus `#0B5E36` pienissä yksityiskohdissa (ruksi, huutomerkki, €, tähdet). Täytetyt juhlaikonit tummanvihreä + keltaiset säteet `#F0B84A`.
- Uusi ikoni: piirrä `app.tsx`:ään samaan tyyliin, lisää `registry.tsx`:ään → Per Tieeri voi käyttää sitä heti (`icon`-kenttä show_list/show_stat).
- Galleria: http://localhost:8101/?ikonit
- EI emojeja missään.

## Chatin kortit

Valkoinen kortti, pyöristys 16, otsikkorivillä ikoni minttupallossa (50), otsikko 23 px / 700, rivit 21 px / 500, summat 700 (vihreä `#126645` tai musta), alateksti 17,5 px harmaa. Kaavioiden SVG-tekstit `fontFamily="Figtree-500"`, luvut `eur0()` → "1 234 €", kuukaudet "loka / marras / joulu".
