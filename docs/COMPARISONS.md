# Väestövertailut

## Miksi sovellus tarjosi synteettistä vertailua?

Tilastokeskus-yhteys oli jo olemassa. `get_spending` ja `show_category_bars` lupasivat kuitenkin yleisesti ”vertailua samanikäisiin”; jälkimmäinen käytti vain synteettisen aineiston mediaaneja. Agentin ohjeessa ei ollut väestölähteen ensisijaisuutta. Vanha `compare_finland` tunsi vain kotitaloustyypin, vaati siitä tiedon ja näytti rinnakkaisen kaavion vain yksin asuville. Siten olemassa oleva StatFin-yhteys ei yksin ohjannut tavallisia vertailukysymyksiä oikeaan lähteeseen.

Korjauksessa väestökysymykset ohjataan ensisijaisesti `compare_finland`-työkaluun. Synteettinen vertailu nimetään ja pyydetään erikseen. Tilastotaustaa voi näyttää myös silloin, kun asiakkaaseen rinnastaminen ei onnistu.

## Viralliset lähteet

Tilastokeskuksen [PxWeb-rajapintaohje](https://stat.fi/fi/palvelut/tilastodatapalvelut/avoin-data-ja-rajapinnat/tietokantojen-rajapintakaytto).
Taulukkojen metatiedot ja aidot JSON-stat2-vastaukset säilytetään `data/statfin/`-hakemistossa. Jokaisessa vastauksessa on alkuperäinen API-osoite ja hakuaika. Uudet ikä- ja tuloviidennestaulukot haettiin 14.11.2026.

| Taulukko | Käyttö | Tuorein välimuistissa oleva tilastovuosi |
| --- | --- | --- |
| [14ph](https://pxdata.stat.fi/PxWeb/api/v1/fi/StatFin/ktutk/14ph.px) | Kulutuksen keskiarvo kotitaloustyypeittäin, €/kotitalous/kk | 2022 |
| [14q4](https://pxdata.stat.fi/PxWeb/api/v1/fi/StatFin/ktutk/14q4.px) | Kulutuksen tausta kotitalouden viitehenkilön iän mukaan | 2022 |
| [14pg](https://pxdata.stat.fi/PxWeb/api/v1/fi/StatFin/ktutk/14pg.px) | Kulutuksen tausta nimetyssä tuloviidenneksessä | 2022 |
| [11py](https://pxdata.stat.fi/PxWeb/api/v1/fi/StatFin/tjt/11py.px) | Henkilökohtaisen käytettävissä olevan rahatulon mediaani ja keskiarvo iän mukaan | 2024 |

Synteettinen [Junction/S-Pankki-aineisto](https://github.com/hackjunction/Junction-2026-S-pankki) sisältää yhden asiakkaan tilitapahtumat, iän ja postinumeron. Se ei vahvista kotitalouden kokoa, menojen kattavuutta tai tuloviidennestä.

## Mitkä vertailut ovat mahdollisia?

- Ruokakauppa, ravintolat, liikkuminen ja terveys: suuntaa antava rinnakkainen kaavio alle 65-vuotiaalle yksin asuvalle, kun asiakas vahvistaa tilin kattavan kotitalouden kaikki menot. Kaaviossa näkyvät luokkakohtaiset erot, keskiarvo, lähde, ryhmä, tilastovuosi, oman aineiston jakso ja hakuaika. Keskiarvon ylitys ei yksin värjää väestövertailua varoitukseksi.
- Henkilökohtaiset tulot: suuntaa antava rinnakkainen vertailu vain asiakkaan vahvistaessa nettotulojen kattavuuden. Tilaston kotitalouskohtaisia tuloeriä ei ole jaettu henkilöille; rajaus kerrotaan. Kyseessä ei ole palkkatilasto.
- Kotitalous-, ikä- ja tuloviidennestilastot: erillisiä taustatietokortteja, jos suora vertailu ei onnistu. Ikä on viitehenkilön ikä; tuloviidennestä ei päätellä yhden tilin tuloista.
- Synteettiset asiakkaat: aikaisempi 12 kk mediaani- ja kvartiilivertailu säilyy omana toimintona.

Vuokraa tai asumisen kokonaismenoja ei rinnasteta sekaryhmän keskiarvoon. Viihde, shoppailu, koti/tekniikka ja matkailu on rajattu pois, koska nykyinen luokkakartoitus vertasi eri sisältöjä. Yli 64-vuotiaiden kotitalousryhmä ei ole yksin asuvien ryhmä. Eri taulukoiden ikä- ja kotitalousryhmiä ei yhdistetä kuvitteelliseksi ryhmäksi. Tuloksia ei esitetä nykyvuoden havaintoina tai inflaatiokorjattuina lukuina.

## Keskustelu ja toteutus

`src/agent/finland.ts` tarkistaa edellytykset ja tuottaa valmiin vertailu- tai taustakortin. `compare_finland` hyväksyy menoluokkarajauksen ja ryhmävalinnan. Puuttuva tieto palauttaa täsmällisen lisäkysymyksen; käyttäjältä ei vaadita pitkää lomaketta. Kieltäytyessä voidaan näyttää kaikkien kotitalouksien tausta tai oman kulutuksen kehitys. Puuttuvia lukuja ei korvata nollalla eikä synteettisellä vertailulla.

Profiiliin tallennetaan vain asiakkaan vahvistamat `household`, `expensesComplete`, `incomeComplete` sek? tarvittaessa `partnerAge`, `dependentChildrenUnder25` ja `allMembers65Plus`. Kotitaloustyypin muutos mitätöi aiemman menokattavuuden ja viitehenkilön iän. Työkalut suoritetaan mallin antamassa järjestyksessä ja profiili päivitetään seuraavan mallikierroksen ohjeeseen; tallennus ja vertailu eivät kilpaile rinnakkain.

Tietopalvelu käyttää viikon välimuistia sekä metatiedoille että luvuille. Kyselyllä on kahdeksan sekunnin aikaraja. Päivityksen epäonnistuessa vanha vastaus merkitään vanhentuneeksi. Jos kelvollista vastausta ei ole, näytetään saatavuusvirhe, ei tilastolukua. JSON-stat2:n harvat arvot ja puuttuvat solut käsitellään erikseen nollista.

## Ajo ja tarkistukset

```sh
node scripts/prefetch-statfin.js
node scripts/test-comparisons.js
npx expo start --web --port 8109
node scripts/test-comparison-chat.js http://localhost:8109
npx expo lint
npx tsc --noEmit
```

Esilataus hakee seitsemän kotitalousryhmää, kahdeksan ikäryhmää, viisi tuloviidennestä ja kuusi tulotilaston ikäryhmää. Varsinainen käyttö ei tarvitse aina uutta ulkoista hakua.

Automaattitesti käyttää oikeita välimuistivastauksia verkko estettynä ja oikeita synteettisiä asiakkaita iältään 22, 34, 64, 65 ja 90. Se tarkistaa oman summan riippumattomasti tapahtumista, asiakkaan vaihtumisen, 65 vuoden rajan, kotitalouden ja kattavuuden puuttumisen, jaetun talouden, kategoriafiltterin, taustatilastot, puuttuvan solun, vanhan välimuistin, verkkovirheen, JSON-stat2:n harvat arvot sekä profiilin tallennuksen ennen vertailua. Keskustelutesti käyttää oikeaa mallia ja tarkistaa neljän luonnollisen kysymyksen työkalunvalinnat.

## Jatkokehitys

### Tarkistustulos 14.11.2026

- 12 automaattista testikokonaisuutta läpäisi ilman verkkoyhteyttä.
- Oikean agentin neljä keskustelukoetta läpäisivät: puuttuva kotitalous, vahvistettu yksinasuja, 65-vuotiaan ikäryhmätausta ja nimenomaan synteettisestä aineistosta pyydetty vertailu. Ikäryhmäkoe ajettiin uudelleen ryhmän nimen ja jatkoehdotusten täsmennyksen jälkeen.
- Vertailukaavio ja taustatietokortti tarkistettiin 390 px:n web-mobiilinäkymässä. Natiivilaitteita ei testattu.
- TypeScript-tarkistus läpäisi. Muutetuissa tiedostoissa ei lint-huomautuksia. Koko projektissa on edelleen 76 aiempaa lint-virhettä ja 8 varoitusta muissa tiedostoissa.

### Seuraavat laajennukset

Tarkempi asumisvertailu vaatii asumismuodon, menojen sisällön ja yhteensopivan tilastoryhmän. Koko kotitalouden vertailu edellyttää useiden tilien ja henkilöiden koottua dataa. Tuotantoon tarvitaan erillinen tietopalvelu ja ajastettu tilastopäivitys; nykyinen palvelu toimii Metro-kehityspalvelimessa. Kielimallin työkalunvalinta on todennäköisyyspohjainen, joten luonnollisen kielen regressiotestejä kannattaa laajentaa.
