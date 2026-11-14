# Henkilökohtainen asiakasymmärrys – tarkistus 14.11.2026

## Lähdedata ja korjatut puutteet

GitHubin Junction 2026 / S-Pankki-aineisto tarkistettiin README:stä ja paikallisista alkuperäisistä CSV-tiedostoista. Aineistossa on 5 100 asiakasta ja jokaisella yksi tili. Tapahtumissa on asiakastunnus, tilitunnus, päivä, kellonaika, kategoria, summa, saldo tapahtuman jälkeen, maksutyyppi, kauppiastunnus ja MCC. Kauppiastunnus on koodi, ei kaupan nimi. Tuoterivejä, sopimuksia, laskun eräpäiviä tai toistuvan korttiveloituksen lippua ei ole.

- Tuonti säilyttää nyt myös `bank_account_id`-kentän (`Tx.account`). `scripts/backfill-accounts.py` palautti sen kaikille 5 100 asiakkaalle ja paketoituun esimerkkiasiakkaaseen alkuperäisestä CSV:stä. Lainahakemukset säilytettiin.
- Toteutuneisiin kuukausituloihin kuuluvat palkka ja muut tulot. Ennusteen palkka käyttää erillistä `salaryMonthly`-funktiota, joten kertatulot eivät muutu automaattisesti tulevaksi palkaksi. Sijoitusnostot ja säästösiirrot erotetaan tuloista ja kulutuksesta.
- Rahakoreihin ei lisätä puuttuvia asumismaksuja oletuksena. Havaittu puuttuminen voidaan kysyä asiakkaalta; tulevaan menoon varautuminen on erillinen arvio.
- Palkkaviikon havainto käyttää toteutuneita palkkapäiviä ja toimii kuukauden vaihteen yli. Tulkinnan rajaus (joustaviksi luokitellut ostokset) välitetään agentille.
- Kotinäkymä ei laske bonusta ilman ketju- ja bonustietoja eikä nimeä anonyymiä ruokakauppatunnusta oikeaksi myymäläksi.
- Asiakkaan vaihto mitätöi vanhat mallipyynnöt ennen työkalujen ajoa ja myöhäiset keskusteluviestit. Epäonnistunutta latausta ei korvata edellisen asiakkaan tiedoilla; käyttöliittymä näyttää uudelleenyrityksen.

## Toistuvuus ja maksujen luonne

`paymentPatterns.ts` ryhmittelee tilin, maksutyypin, kategorian, MCC:n ja kauppiastunnuksen avulla. Tarkastelu erottaa toistuvan rytmin, toistuvan asiointitavan, mahdollisen kertamenon ja epävarman havainnon. Se tarkastaa viikko-, kuukausi-, neljännesvuosi- ja vuosirytmiä; puuttuva saaja ei yhdistä tavallisia ostoksia kuvitteelliseksi sopimukseksi.

Maksutyyppi tunnistaa esimerkiksi asumisen, laskut, tulot ja sijoitussiirrot. Laskuryhmä voi sisältää useita tuntemattomia saajia. Sama hinta ei tunnista tilausta. Palveluun viittaava MCC tai luokka ja rytmi voivat tuottaa tilausehdokkaan, mutta sopimusta ei vahvisteta ilman lisätietoa. Vaihteleva sähkölasku ei ole automaattisesti hinnankorotus; hinnanmuutos vaatii kaksi havaintoa kummallakin hintatasolla palveluehdokkaassa.

Jokainen kuvio sisältää perustelut, varmuuden, havaintojakson, tapahtumamäärän, kuukausikeskiarvon ja tiedon viimeaikaisista havainnoista. Aineistossa ei ole varsinaisia tilausvahvistuksia. Yksi ostohavainto ei todista, ettei maksu joskus toistuisi. Rahakorin välttämättömyys on alustava; asiakkaan kertoma tarve huomioidaan neuvoissa ja tallennetaan muistiin.

`get_customer_understanding` antaa kokonaiskuvan, tilit ja päivämäärälliset saldot, rahavirrat, lainahakemuksen ja maksukuviot. `get_transactions` antaa myös alkuperäiset metatiedot. Työkalu kertoo puuttuvat tiedot: muut pankit, kokonaisvarallisuus, kotitalouden kattavuus, nykyiset lainasaldot ja korot. Hakemuspäätös ei todista nykyistä velkaa eikä puuttuva hakemus velattomuutta.

## Vertailulähteet

1. [GitHub / S-Pankki](https://github.com/hackjunction/Junction-2026-S-pankki): asiakkaan oma synteettinen data ja erillinen synteettinen vertaisvertailu.
2. Tilastokeskuksen StatFin: todelliset väestötilastot. Aiemmat kulutus- ja tulovertaillut säilyvät, kattavuus- ja kotitalousrajaukset tarkistetaan. Katso `COMPARISONS.md`.
3. [Takuusäätiö / Martat / Kuluttajatutkimuskeskus](https://www.takuusaatio.fi/hallitserahojasi/omien-tulojen-ja-menojen-seuranta/mita-elaminen-maksaa/): vuoden 2025 ruoan viitebudjetit 14 esimerkkitaloudelle, omilla alkuperäisillä PDF-linkeillä. Kohtuullisen minimin laskelma EI ole keskiarvo tai henkilökohtainen tavoite. `get_reference_budget` näyttää taustaluvun; suuntaa antava rinnastus ruokakauppaostoihin sallitaan vain asiakkaan vahvistamalle sopivalle yksinasujan esimerkkiryhmälle ja vahvistetulle menokattavuudelle. Ruokakauppa ei vastaa täsmälleen ruoan käsitettä. Muut menolajit ovat saatavilla lähdelinkeissä, niitä ei tuotu numeerisiksi vertailuiksi.

Myös Suomen Pankin lainakorkotilastot löytyivät. Niitä ei rinnasteta asiakkaan lainakorkoon, koska aineisto ei sisällä nykyistä korkoa tai lainasaldoa. Ei rakennettu näennäistä korkovertailua hakemuksen lainasummasta.

Viitebudjetit ovat päivämäärällä merkitty paikallinen 2025-versio, eivät automaattisesti päivittyvä tietosyöte. Ryhmänimet luettiin PDF:istä: sivuston laskurin JavaScriptin yksinasujan ikärajat poikkeavat PDF:n esimerkkien nimistä.

## Pedagogiikka ja testaus

Agentin ohje on: oma havainto ja jakso → ilmiön mekanismi → vaikutus omiin rahoihin → yksi kokeilu ja seuranta. Termi selitetään tarvittaessa; tilastollista yhteyttä ei väitetä syyksi. Per Tieerin teitittely, lämmin arvokkuus, tavoitteet ja asiakkaan suojaamat menot säilyvät.

`node scripts/test-customer-understanding.js` testaa metatiedot, hintasattumat, muuttuvat laskut, puuttuvat saajat, tilien erottelun, kertamenon epävarmuuden, tulot, korien toteutumat, palkkaviikon, oikeat asiakkaat, viitebudjettien rajaukset ja kesken mallipyynnön vaihtuvan asiakkaan. `node scripts/test-comparisons.js` tarkistaa 12 StatFin-testikokonaisuutta oikeilla välimuistitiedoilla. `node scripts/test-understanding-chat.js` kokeilee oikeaa mallia mobiilin web-näkymässä; vastaukset tallentuvat `design/current/understanding-*.json`.

Mallin sanamuodot ja työkalun valinta voivat vaihdella. Alkuperäinen aineisto on synteettinen ja rajallinen; toteutus ei väitä tuntevansa tietoja, joita siinä ei ole.

Tarkistukset läpäisivät: laskenta- ja eristystestit, 12 StatFin-kokonaisuutta, kolme oikean mallin keskustelukoetta, latausvirheen ja uudelleenyrityksen mobiiliweb-koe, kotinäkymän puuttuvat bonustiedot, TypeScript sekä Android-bundlen lataus Expo-tunnelista. Koko projektin lintissä on edelleen 49 aiempaa virhettä ja 3 varoitusta; uudet analyysimoduulit ja agenttimuutokset läpäisevät lintin. Fyysistä puhelinta ei ohjattu testissä.
