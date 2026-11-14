const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.argv[2] || 'http://localhost:8109';
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({viewport:{width:390,height:844}});
    const errors = []; let replayChecked = false;
    page.on('pageerror', e => errors.push(e.message));
    const reply = text => ({id:'test-response',output:[{type:'message',content:[{type:'output_text',text}]}]});
    await page.route('**/api/agent', async route => {
      const body = route.request().postDataJSON();
      if (body.input?.[0]?.type === 'function_call_output') {
        for (const out of body.input) assert(!JSON.parse(out.output).virhe, out.output);
        return route.fulfill({json:reply('Muisti tallennettu. Kokeilun tiedot ovat alla.')});
      }
      const text = body.input.at(-1).content;
      if (text.startsWith('[Sovellus:')) return route.fulfill({json:reply('Hei muistitesti!')});
      if (text === 'Jatka muistista') {
        assert(body.input.some(x=>x.content?.includes('Tietokonetavoite')),'Durable history replayed to model');
        assert(body.instructions.includes('Sport'),'Protected expense in context');
        assert(body.instructions.includes('Muistikokeilu'),'Scenario in context');
        replayChecked=true;
        return route.fulfill({json:reply('Jatketaan tallennetusta kokeilusta.')});
      }
      const calls = [
        ['save_profile',{goal:'Tietokonetavoite',protect:['Sport'],note:'Tietokone on tärkeä, liikunnasta ei tingitä.'}],
        ['scenario',{action:'set',name:'Muistikokeilu',changes:{Restaurants:-20},purchase:{label:'Tietokone',amount:500,date:'2026-11-20'}}],
        ['plan_goal',{monthly:150}],
        ['show_whatif',{name:'Muistikokeilu'}],
      ];
      return route.fulfill({json:{id:'test-tools',output:calls.map(([name,args],i)=>({type:'function_call',name,call_id:`c${i}`,arguments:JSON.stringify(args)}))}});
    });
    const open = async()=>{await page.getByRole('tab',{name:/Tuki/}).locator('svg').click();await page.getByPlaceholder('Kirjoita viesti').waitFor();};
    const snapshot = ()=>page.evaluate(()=>{
      const key=Object.keys(localStorage).find(k=>k.endsWith('device:CUST00171:memory'));
      if(!key)return null;
      const manifest=JSON.parse(localStorage.getItem(key));
      return JSON.parse(manifest.keys.map(k=>localStorage.getItem(k)).join(''));
    });
    const waitSaved = async predicate => { for(let i=0;i<40;i++){const state=await snapshot();if(state&&predicate(state))return state;await page.waitForTimeout(100);}throw Error('Memory did not persist');};
    await page.goto(base,{timeout:90000});await open();
    await page.getByText('Hei muistitesti!',{exact:true}).waitFor();
    await page.getByPlaceholder('Kirjoita viesti').fill('Tietokonetavoite ja pysyvä muistikokeilu');
    await page.getByPlaceholder('Kirjoita viesti').press('Enter');
    await page.getByTestId('goal-plans').waitFor({timeout:40000});
    await page.getByTestId('goal-plans').scrollIntoViewIfNeeded();
    await page.screenshot({path:'design/current/goal-plans-mobile.png'});
    const whatif=page.getByTestId('persistent-whatif');
    await whatif.getByRole('button',{name:'Ravintolat ja kahvilat: Vähennä 5 %',exact:true}).click();
    await waitSaved(s=>s.scenarios.Muistikokeilu.changes.Restaurants===-25);
    assert.equal(await whatif.getByRole('button',{name:/Liikunta ja kuntosali/}).count(),0,'Protected slider cannot cut sport');
    await page.getByPlaceholder('Kirjoita viesti').fill('Kesken jäänyt luonnos');
    const before=await waitSaved(s=>s.draft==='Kesken jäänyt luonnos');
    assert(before.messages.length>=3 && before.prefs.protected.includes('Sport'));
    assert.equal(before.scenarios.Muistikokeilu.purchases.length,1);
    await page.reload();await open();
    assert.equal(await page.getByPlaceholder('Kirjoita viesti').inputValue(),'Kesken jäänyt luonnos');
    await page.getByText('Muisti tallennettu. Kokeilun tiedot ovat alla.',{exact:true}).waitFor({state:'attached'});
    const after=await snapshot();assert.equal(after.messages.length,before.messages.length);
    await page.waitForTimeout(300);
    const restoredY=await page.getByTestId('chat-scroll').evaluate(el=>el.scrollTop);
    assert(Math.abs(restoredY-before.scrollY)<80,`Scroll position restored: ${restoredY} vs ${before.scrollY}`);
    assert.equal(after.scenarios.Muistikokeilu.changes.Restaurants,-25);
    await page.getByPlaceholder('Kirjoita viesti').fill('Jatka muistista');
    await page.getByPlaceholder('Kirjoita viesti').press('Enter');
    await page.getByText('Jatketaan tallennetusta kokeilusta.',{exact:true}).waitFor();
    assert(replayChecked);
    await waitSaved(s=>s.messages.some(m=>m.text==='Jatketaan tallennetusta kokeilusta.'));
    const choose=async id=>{
      await page.getByRole('tab',{name:/Minä/}).locator('svg').click();
      await page.getByText('Vaihda asiakasta',{exact:true}).click();
      await page.getByPlaceholder('Hae asiakastunnuksella tai postinumerolla').fill(id);
      await page.getByText(id,{exact:true}).click();
      await page.getByText('Valitse asiakas',{exact:true}).waitFor({state:'hidden'});
      await open();
    };
    await choose('CUST00002');
    assert.equal(await page.getByText('Muisti tallennettu. Kokeilun tiedot ovat alla.',{exact:true}).count(),0,'Other customer does not see messages');
    await page.getByText('Hei muistitesti!',{exact:true}).waitFor();
    await choose('CUST00171');
    await page.getByText('Jatketaan tallennetusta kokeilusta.',{exact:true}).waitFor({state:'attached'});
    await page.route('**/api/customer?**',route=>route.abort());
    await page.reload();await open();
    await page.getByText('Jatketaan tallennetusta kokeilusta.',{exact:true}).waitFor({state:'attached'});
    assert.deepEqual(errors,[]);
    fs.writeFileSync('design/current/memory-ui.json',JSON.stringify({passed:true,history:after.messages.length,protected:after.prefs.protected,scenario:after.scenarios.Muistikokeilu,offlineBankRestored:true,replayChecked},null,2));
    console.log('PASS browser: goal alternatives, persistent slider, protected expense, chat/cards/draft reload, model context, offline bank restore, no JS errors');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
