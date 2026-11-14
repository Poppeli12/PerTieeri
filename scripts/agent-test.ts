import { greeting, respond } from '../src/agent/engine';
import { DEFAULT_PROFILE } from '../src/state/store';
const ctx:any = { profile: { ...DEFAULT_PROFILE }, prefs: { protected: [], rejections: {}, accepted: {} }, answers: {} };
const qs = [
 '__greet',
 'Paljonko käytin takseihin viime kuussa?',
 'Millainen rahankäyttäjä olen?',
 'Paljonko minulla todennäköisesti on rahaa jäljellä joulukuun lopussa?',
 'Voinko ostaa 700 € tietokoneen ensi viikolla?',
 'Tee minulle budjetti niin, että pystyn säästämään 200 € kuussa.',
 'Miksi käytän kuun alussa enemmän rahaa kuin lopussa?',
 'Haluan säästää 2 000 € ensi kesään mennessä. Miten onnistun?',
 'Mitä tapahtuu, jos vähennän ravintoloita 30 % ja takseja 50 %?',
 'Miksi 1 500 € tilillä ei tarkoita, että voin käyttää 1 500 €?',
 'Mistä kaikista palveluista maksan kuukausittain?',
 'Selitä hätärahasto ja näytä, mitä se tarkoittaisi minun taloudessani.',
 'Miten saan säästettyä 150 €/kk luopumatta kuntosalista?',
 'Älä ehdota enää liikuntaharrastuksista säästämistä.',
 'Miten varaudun auton huoltoihin ja yllättäviin laskuihin?',
 'Jos muutan yksin asumaan ja vuokrani nousee 250 €, riittävätkö rahani?',
 'Viikkokatsaus','Kuukausikatsaus','Mihin rahani menevät?','Onko tililläni huijauksia?','Paljonko voin käyttää tällä viikolla?','§ans|rent-2026-08|Jäi maksamatta','Mitä on korkoa korolle','asdf qwerty'];
for (const q of qs) {
  try {
    const r = q==='__greet' ? { msgs: greeting(ctx) } : respond(q, ctx);
    if (r.prefs) ctx.prefs = r.prefs; if (r.answers) ctx.answers = r.answers;
    console.log('\n### '+q);
    for (const m of r.msgs) {
      if (m.text) console.log('  > '+m.text.replace(/\n+/g,' ⏎ ').slice(0,420));
      for (const c of m.cards??[]) {
        const extra = c.kind==='plan' ? ' '+c.plan.items.map((i:any)=>`${i.key}-${i.pct}%=${Math.round(i.saving)}`).join(',')+' tot='+Math.round(c.plan.total)+' feas='+c.plan.feasible
          : c.kind==='stat' ? ' '+c.value : c.kind==='forecast' ? ` end50=${Math.round(c.sim.end.p50)} neg=${c.sim.probNegative}` : c.kind==='list' ? ' '+c.items.map((i:any)=>i.label+':'+i.value).join(' | ').slice(0,300) : '';
        console.log('  [card '+c.kind+']'+extra);
      }
    }
  } catch (e:any) { console.log('\n### '+q+'\n  !! ERROR '+e.stack); }
}
