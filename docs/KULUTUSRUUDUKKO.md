# Kuukauden menot sadalla ruudulla

Tuki-näkymän **Katso kulujani ruudukkonäkymällä** lähettää tavallisen viestin agentille. Sama näkymä avautuu vapaalla pyynnöllä, esimerkiksi ”Näytä mihin rahani menivät sadalla ruudulla”. Agentti valitsee `show_monthly_spending_grid`-työkalun. Se voi ehdottaa näkymää kulujen jakaumaa koskevassa keskustelussa; ehdotusta ei lisätä automaattisesti joka vastauksen jälkeen.

Oletusjakso on sovelluksen tilitietojen viitepäivää edeltävä kokonainen kalenterikuukausi. Nykyinen viitepäivä `TODAY` on 30.9.2026, joten oletus on **elokuu 2026**, ei tietokoneen tämänhetkistä päivää edeltävä kuukausi. Pyydettäessä työkalu hyväksyy toisen päättyneen kuukauden (`month: YYYY-MM`). Kortti näyttää kuukauden ja viitepäivän.

Laskenta käyttää valitun asiakkaan tapahtumia. Mukana ovat negatiiviset `purchase`, `utilities_payment` ja `housing_payment`, kuten projektin `monthStatus`-laskennassa. Tulot, lainan nostot sekä omien tilien ja sijoitusten siirrot eivät kuulu kulutukseen. Sovelluksen erikseen luomat `demo`-lisätapahtumat jätetään pois. Eurot summataan sentteinä. Tuntemattoman kululuokan ostot näkyvät luokittelemattomina, eivät katoa summasta.

Ruudut jaetaan suurimman jakojäännöksen menetelmällä tasan sataan. Selitteen prosentit jaetaan samalla menetelmällä sadasosaprosentteihin, jolloin niiden summa on 100,00 %. Euromäärät eivät muutu pyöristyksessä. Alle yhden ruudun luokka voi saada nolla ruutua ja säilyy selitteessä. Värimääritys perustuu luokan tunnukseen eikä sen suuruusjärjestykseen.

Luokan painaminen korostaa sen ruudut ja avaa tapahtumat. Aluksi näkyy enintään viisi tapahtumaa, ja loput saa esiin painikkeesta. Kortti tallentaa laskennan tuloksen olemassa olevaan keskustelumuistiin, joten vanhan keskustelun luvut eivät vaihdu myöhempien tietojen mukana.

Tyhjästä kuukaudesta näytetään ilmoitus. Puutteelliset päivämäärät, summat tai maksutyypit estävät ruudukon. Tapahtumahistorian täytyy ulottua valitun kuukauden alun ja lopun yli: osittaista kuukautta ei venytetä kokonaisen kuukauden jakaumaksi. Tämä tarkistus ei yksin vahvista kaikkien kotitalouden tilien kattavuutta. Tietokantaan, Supabase-asetuksiin tai muiden kaavioiden toimintaan ei tehty muutoksia. Aiempi viimeisten 1 000 euron `show_money_blocks`-näkymä säilyy erillisenä.

## Tarkistukset

```bash
node scripts/test-spending-grid.js
node scripts/test-spending-grid-ui.js http://127.0.0.1:8113
npx tsc --noEmit
npx expo lint
```

Laskenta- ja käyttöliittymätestit käyttävät asiakkaita CUST00001, CUST00171 ja CUST02000. Elokuun 2026 kokonaismenot ovat vastaavasti 2 541,89 €, 1 922,52 € ja 4 015,33 €. Lisäksi testataan puuttuvat tiedot, nollamenot, pienet osuudet, tasatulokset, siirtojen poissulkeminen ja vuodenvaihde.

Käyttöliittymätesti käyttää oletuksena oikeaa asiakasdataa ja muistia mutta korvaa AI-vastaukset testivastauksilla. `--live` tekee oikean pilviagenttikutsun vapaalla tekstipyynnöllä. Se kuluttaa API-krediittejä ja luo uuden anonyymin testi-istunnon.
