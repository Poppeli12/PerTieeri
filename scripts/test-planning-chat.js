const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch();
 try {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const turns=[];let active=null,resolveTurn;const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/agent',async route=>{
   const body=route.request().postDataJSON();
   if(body.input?.at(-1)?.content?.startsWith('[Sovellus:'))return route.fulfill({json:{output:[{type:'message',content:[{type:'output_text',text:'Tervetuloa suunnittelutestiin!'}]}]}});
   if(active){for(const item of body.input||[])if(item.type==='function_call_output')active.outputs.push(JSON.parse(item.output));}
   const response=await route.fetch({timeout:95000});const json=await response.json();
   if(active)for(const item of json.output||[])if(item.type==='function_call')active.calls.push({name:item.name,args:JSON.parse(item.arguments||'{}')});
   fs.writeFileSync('design/current/planning-chat-progress.json',JSON.stringify({turns,lastStatus:response.status(),errors},null,2));
   await route.fulfill({response});
   if((json.output||[]).some(o=>o.type==='message')&&!(json.output||[]).some(o=>o.type==='function_call')){
    const text=json.output.filter(o=>o.type==='message').flatMap(o=>o.content||[]).map(c=>c.text||'').join('\n');
    if(active){active.reply=text;resolveTurn();}
   }
  });
  const open=async()=>{await page.getByRole('tab',{name:/Tuki/}).locator('svg').click();await page.getByPlaceholder('Kirjoita viesti').waitFor();};
  const send=async question=>{
   active={question,calls:[],outputs:[],reply:''};turns.push(active);
   let timer;const done=new Promise((resolve,reject)=>{resolveTurn=resolve;timer=setTimeout(()=>reject(Error('Chat timeout')),110000);});
   await page.getByPlaceholder('Kirjoita viesti').fill(question);await page.getByPlaceholder('Kirjoita viesti').press('Enter');
   await done.catch(async e=>{await page.screenshot({path:'design/current/planning-chat-error.png'});fs.writeFileSync('design/current/planning-chat-error.txt',await page.locator('body').innerText());throw e;}).finally(()=>clearTimeout(timer));await page.waitForTimeout(500);
   assert(!active.outputs.some(o=>o?.virhe),'No tool error');
   console.log(JSON.stringify({turn:turns.length,tools:active.calls.map(c=>c.name),reply:active.reply}));
  };
  await page.goto(process.argv[2]||'http://localhost:8109',{timeout:90000});await open();await page.getByText('Tervetuloa suunnittelutestiin!',{exact:true}).waitFor();
  await send('Haluan säästää 150 euroa kuukaudessa. Liikuntaharrastuksista en tingi. Tutki omista tiedoistani useita erilaisia suunnitelmia ja näytä vaihtoehdot selkeästi. Kerro rehellisesti jos rahojen ajoitus estää tavoitteen.');
  assert(turns[0].calls.some(c=>c.name==='plan_goal'));
  assert(turns[0].outputs.some(o=>o?.suojatut?.some(s=>/Liikunta/i.test(s))));
  await send('Tee lisäksi erillinen kokeilu nimeltä Kone: ravintolat vähenevät 20 prosenttia ja ostan 500 euron tietokoneen 20. marraskuuta 2026. Näytä vaikutus.');
  assert(turns[1].calls.some(c=>c.name==='scenario'&&c.args.action==='set'));
  await page.reload();await open();
  await send('Siirrä samassa Kone-kokeilussa tuo tietokoneostos 20. joulukuuta 2026. Säilytä muu ennallaan ja näytä uusi graafi. Muistathan myös mistä en halua tinkiä?');
  assert(turns[2].calls.some(c=>c.name==='scenario'&&c.args.action==='set'));
  const state=await page.evaluate(()=>{const key=Object.keys(localStorage).find(k=>k.endsWith('device:CUST00171:memory'));const m=JSON.parse(localStorage.getItem(key));return JSON.parse(m.keys.map(k=>localStorage.getItem(k)).join(''));});
  const scenario=Object.values(state.scenarios).find(s=>s.purchases.some(p=>p.date==='2026-12-20'));
  assert(scenario&&scenario.changes.Restaurants===-20&&scenario.purchases.length===1,'Reschedule preserves earlier reduction without duplicate purchase');
  assert(state.prefs.protected.includes('Sport'),'Preference persisted through model turns and reload');
  assert.deepEqual(errors,[]);
  fs.writeFileSync('design/current/planning-chat.json',JSON.stringify({turns,passed:true},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

