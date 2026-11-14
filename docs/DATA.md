# Per Tieeri – tietolähteet ja vertailut

## 1. S-Pankin synteettinen aineisto (Junction 2026)

Lähde: https://github.com/hackjunction/Junction-2026-S-pankki

| Tiedosto | Sisältö (tarkistettu) |
|---|---|
| `tx_junction_transactions.csv` | 3 626 755 tapahtumaa, 5 100 asiakasta, 1 tili / asiakas, 1.10.2024–30.9.2026 |
| `tx_customers_junction.csv` | asiakas, postinumero, ikä (18–90 v, mediaani 44) |
| `mtg_tx_customer_link_and_final_mtg_infio.csv` | 200 asuntolainahakemusta linkitettynä asiakkaisiin: päätös (150 hyväksytty / 50 hylätty), hylkäyssyy, hinta, laina, omarahoitus, vakuudet, vaadittu tulo, LTV |
| `mtg_negotiation_history.csv` | 3 452 hakemustapahtumaa (kohteet, hinnanmuutokset, kulut, vakuusarviot, päätökset) |

Rakennus: `python scripts/build-data.py [polku-repoon]` → `data/customers/<ID>.json` (kaikki tapahtumat),
`data/index.json` (asiakaslista), `data/metrics.json` (vertailumittarit).
Lainat: `python scripts/build-mortgage.py` lisää asiakkaille `mortgage`-kentän ja tekee `data/mortgage.json` (hakijoiden mediaanit ja hylkäyssyyt). `data/customers/` ei ole gitissä (~430 Mt).

### Asiakkaiden välinen vertailu (`/api/peers`)
- Jakso kaikille sama: **1.10.2025–30.9.2026 (12 kk)** – jokaisen asiakkaan havaintojakso kattaa sen (tarkistettu).
- Ryhmä: sama ikäryhmä (18–24, 25–34, 35–49, 50–64, 65–74, 75+ – samat rajat kuin Tilastokeskuksen tulotilastossa) tai kaikki.
- Tunnusluvut: **mediaani**, kvartiilit 25 % / 75 %, keskiarvo, ryhmän koko, asiakkaan persentiili. Alle 30 asiakkaan ryhmä → "ei luotettava".
- Mittarit: tulot, kulutus, säästöön/sijoituksiin, säästöaste, saldon muutos, taksit (MCC 4121), kategoriat.
- Tämä on **synteettinen aineisto, ei Suomen väestö**.

## 2. Tilastokeskus (StatFin, PxWeb-rajapinta)

Rajapinta: `https://pxdata.stat.fi/PxWeb/api/v1/fi/StatFin/` – haetaan palvelimella (`server/api.js`),
välimuisti `data/statfin/` (7 pv; jos rajapinta ei vastaa, käytetään viimeisintä hakua). Esilataus: `node scripts/prefetch-statfin.js`.

| Taulukko | Mitä | Tunnusluku | Vuosi |
|---|---|---|---|
| ktutk/14ph | Kotitalouksien kulutusmenot kotitaloustyypin mukaan | **keskiarvo** / kotitalous tai kulutusyksikkö, €/kk | 2022 (uusin) |
| tjt/11py | Käytettävissä olevat rahatulot henkilön iän mukaan | **mediaani** ja keskiarvo / henkilö | 2024 (uusin) |
| khi/11xt | Kuluttajahintaindeksi 2015=100 | indeksi | 2021–2025 (hintatason muutoksen kertomiseen) |
| ktutk/14q4 | Kulutus viitehenkilön iän mukaan | keskiarvo / kotitalous | 2022 – erillinen taustatilasto, ei yksilön kulutusvertailu |
| ktutk/14pg | Kulutus tuloviidenneksittäin | keskiarvo / kotitalous | 2022 – erillinen taustatilasto, asiakkaan tuloviidennestä ei arvata |

### Vertailukelpoisuus (päätökset)
- Kulutustutkimus = **kotitalouden** kulutus. Suuntaa antava rinnakkainen vertailu vain alle 65-vuotiaalle, joka on vahvistanut asuvansa yksin **ja** tilin kattavan kotitalouden kaikki menot. Yli 64-vuotiaiden ryhmä sisältää erikokoisia talouksia eikä ole yksin asuvien ryhmä. Muut ryhmät näytetään vain taustatilastona.
- Iän ja kotitaloustyypin yhdistelmää ei ole taulukoissa → ei yhdistetä.
- Suuntaa antavat luokat: Ravintolat ↔ 11.1, Ruokakauppa ↔ 01, Liikkuminen ↔ 07.2+07.3, Terveys ↔ 06. Kauppiaan toimiala ei takaa ostoskorin sisältöä; rajaukset näkyvät kortissa.
- **Ei rinnakkaista vertailua:** vuokra, laskut, viihde, koti ja tekniikka, shoppailu ja matkailu. Niiden pankkiluokat eivät kata samaa sisältöä kuin valitut COICOP-luokat.
- Tulot: `hkturaha_med` ja `hkturaha_mean` ovat henkilökohtaisia rahatuloja, **kotitalouskohtaisia tuloeriä ei jaettu henkilöille**. Vuositulot jaetaan 12:lla. Tililukujen rinnastaminen edellyttää asiakkaan vahvistusta henkilökohtaisten nettotulojen kattavuudesta ja on silloinkin suuntaa antava.
- Tilastovuosi ja oma 12 kk jakso näytetään erikseen. Kulutusluvuissa ei tehdä yleisellä KHI:llä näennäistä nykyhintakorjausta. KHI-rajapinta säilyy, mutta sitä ei tarvita kulutusvertailun avaamiseen.
- `compare_finland` on ensisijainen väestövertailu. Synteettinen `compare_peers` on erillinen, asiakkaan pyytämä vertailu. Ks. [vertailujen toteutus ja testaus](COMPARISONS.md).

## 3. Mitä ei ole aineistossa
- S-Bonus / S-ryhmän ketjutieto → bonusta ei lasketa eikä kauppiastunnuksesta keksitä myymälän nimeä.
- Asuntolainatiedot on vain 200 asiakkaalla; muille Per Tieeri kertoo yleisesti, mihin aineiston hakemuksissa katsottiin.
- Kotitalouden koko, elämäntilanne, asumismuoto → kysytään asiakkaalta (save_profile), ei päätellä.
