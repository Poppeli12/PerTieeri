# Keskustelumuisti, jatkuvat kokeilut ja optimointi

## Toiminta

Vapaa teksti menee kielimallille. Malli päättelee tarkoituksen, valitsee tietohaun ja laskentatyökalut sekä selittää tuloksen Per Tieerin alkuperäisellä persoonalla. Identiteettiä, teitittelyä ja huumorityyliä ei vaihdettu. Keskustelu saa sisältää small talkia, mutta varsinainen neuvonta keskittyy henkilökohtaisen talouden hallintaan.

Keskusteluhistoria kortteineen säilyy asiakas- ja kirjautumistilikohtaisesti. Malli saa enintään 60 viimeisintä viestiä noin 70 000 merkin rajalla sekä profiilin, suojatut menot ja tallennetut skenaariot. Suuret kortit lyhennetään kontekstiin, mutta koko kortti säilyy arkistossa. Vanhempaa keskustelua voi hakea `search_conversation`-työkalulla. Tämä on tekstiarkiston haku, ei semanttinen vektoritietokanta. Olennaiset käyttäjän vahvistamat tavoitteet, rajoitteet ja vastaustyylitoiveet tallennetaan profiiliin.

Muuttavat työkalut tallentavat välitilan jo työkalukierroksen aikana. Asiakkaan vaihtuminen keskeyttää vanhan asiakkaan vastauksen käsittelyn. Paikalliset kirjoitukset jonotetaan, pankkidata pilkotaan pieniin osiin ja uusi tallenne julkaistaan vasta kaikkien osien valmistuttua.

## Skenaariot

`scenario` osaa lukea, luoda, päivittää, kopioida, poistaa osan ja vertailla. Uusi muutos säilyttää muut prosenttimuutokset, ostokset, tulot, vuokran ja säästösiirron. Samanniminen ostos päivittää aiempaa ostosta, joten päivämäärän siirtäminen ei tuplaa menoa. Euromuutokset muunnetaan oman havaitun kulutuksen kautta; viikkomuutos käyttää 52/12-kerrointa. Havaitut menot ylittävä vähennys hylätään.

Liukusäätimet ja niiden 5 prosenttiyksikön painikkeet päivittävät samaa muistissa olevaa nimettyä skenaariota. Niissä ei enää ole kaikille yhteistä 2 000 euron tavoitetta tai kiinteää vuodenlopun oletusta. Tärkeiksi suojatuille menoille ei tarjota vähennyssäädintä. Skenaariot ovat laskennallisia eivätkä tee pankkisiirtoja tai sopimusmuutoksia.

## Optimointi

`plan_goal` erottaa uuden säästön ja käyttötilin loppusaldotavoitteen. Määräpäivällinen säästötavoite jaetaan jäljellä oleville arvioiduille palkkapäiville. Nykyinen kuukausivaje katetaan ennen uutta säästöä. Tulopohjana on havaittu palkka ja käyttäjän vahvistama tulomuutos; kertaluonteisia muita tuloja ei oleteta jatkuviksi.

Monivalintainen reppuongelma käy läpi asiakkaan omien menolajien vähennystasojen yhdistelmiä kolmella tavoitefunktiolla: maltilliset muutokset, harvemmat muutettavat menot ja muutosten jakaminen useampaan kohteeseen. Lisäksi tutkitaan vaihtoehtoja, joissa jokin suurista vähennyskohteista säilyy. Vahvistetut suojaukset ovat kovia rajoitteita. Synteettisen vertailuryhmän kulutus ei määrää henkilökohtaisen leikkauksen helppoutta.

Haku käyttää enintään noin 20 000 säästötilaa. Säästötila pyöristetään alaspäin; todellinen toteutettavuus tarkistetaan lopuksi alkuperäisistä euromääristä. Rajattu tarkkuus voi ohittaa hyvin lähellä tavoitetta olevan yhdistelmän, joten tämä ei ole lupaus kaikkien mahdollisten arjen ratkaisujen globaalista optimista. Vaivan painot ovat suunnitteluheuristiikkoja, eivät mitattua asiakkaan kokemusta.

Vaihtoehdoille tehdään päiväkohtainen kassavirtaennuste. Jos pelkkä kuukausitavoite ei läpäise tarkistusta, tutkitaan myös suurempaa menovähennystä 25 %, 50 % ja 100 % jäljellä olevasta mallinnetusta vähennysvarasta. Näytetään enintään kolme aidosti eri yhdistelmää. Suunnitelma läpäisee varovaisuustarkistuksen vain, kun rahamääräinen tavoite täyttyy, mediaanisaldo ei käy negatiivisena ja mallinnettu miinusriski on enintään 10 %. Raja on suunnitteluoletus, ei turvallisuustakuu. Jos sopivaa ratkaisua ei löydy, se ilmoitetaan.

Ennuste käyttää 200 toistettavaa otosta asiakkaan 180 päivän muuttuvista menoista, historiallista palkka- ja asumisrytmiä sekä omien laskujen havaittuja maksupäiviä. Tulevia eräpäiviä ei ole vahvistettu. Tilausten prosenttimuutos on laskennallinen ja vaatii todellisuudessa sopimusmuutoksen. Ennustejakso on enintään 730 päivää. Tämän päivän ostos vaikuttaa heti, ja tulevan ostoksen pitää kuulua vertailujaksoon.

## Testit

- `node scripts/test-optimization.js`: 43 tarkistusta, mm. todelliset euromäärät, suojatut menot, suuri mahdoton tavoite, puuttuva data, kolme tavoitefunktiota verrattuna pienen ongelman kaikkien haarojen läpikäyntiin, ketjut, ostoksen siirto, kopiointi, viikkoeurot, ennusteen ajoitus ja säästövaran riskiraja.
- `node scripts/test-memory.js`: koko paikallinen muisti, erilliset asiakkaat ja käyttäjät, paloiteltu pankkidata, keskeytynyt kirjoitus, kirjoitusjärjestys, muistin nollaus ja mallin historiakonteksti.
- `node scripts/test-memory-database.js`: todellinen SQL-migraatio paikallisessa PostgreSQL-moottorissa, RLS, anonyymin estäminen, toisen käyttäjän rivien estäminen, viestien yhdistäminen ja nollaus.
- `node scripts/test-memory-ui.js`: puhelimen levyinen käyttöliittymä; oikeat laskentatyökalut, mockattu kielimalli; vaihtoehtokortit, säätimen tallennus, luonnos, vieritys, asiakasvaihto, uudelleenlataus, historiakonteksti ja pankkidatan paikallinen varakopio.
- `node scripts/test-planning-chat.js`: oikea kielimalli ja työkalut; 150 €/kk tavoite, liikunnan suojaus, nimetty ravintola- ja tietokonekokeilu, uudelleenlataus ja saman ostoksen siirto seuraavaan kuukauteen ilman muiden muutosten katoamista.

Oikean Supabase-projektin ja kahden fyysisen laitteen pilvitesti edellyttää käyttäjän projektin luomista. Ohje on `docs/SUPABASE-KAYTTOONOTTO.md`.
