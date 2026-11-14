const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const db = new Map(); let failPublish = false;
const storage = {
  getItem: async k => db.get(k) ?? null,
  setItem: async (k, v) => { if (failPublish && k === 'large') throw Error('Disk full'); db.set(k, v); },
  multiGet: async keys => keys.map(k => [k, db.get(k) ?? null]),
  multiSet: async entries => entries.forEach(([k, v]) => db.set(k, v)),
  multiRemove: async keys => keys.forEach(k => db.delete(k)),
};
const originalLoad = Module._load;
Module._load = function(name, ...args) { if(name === '@react-native-async-storage/async-storage') return storage; return originalLoad.call(this, name, ...args); };
const { emptyMemory, mergeMemory } = require('../src/state/memoryModel.ts');
const local = require('../src/state/localMemory.ts');
const { conversationInput, searchConversation } = require('../src/agent/history.ts');
const { customerLetter } = require('../src/data/customerLetter.ts');
(async()=>{
  const state = { ...emptyMemory(), updatedAt: 100, messages: [{ id: 'one', ts: 10, from: 'user', text: 'Tavoitteeni on purjevene.' }, { id: 'two', ts: 20, from: 'bot', text: 'Aloitetaan.', cards: [{ kind:'stat', label:'Tavoite', value:'6000 €' }] }], draft: 'jatkan tästä', scrollY: 220, scenarios: { vene: { monthlySaving: 200 } } };
  await local.saveLocalMemory('device','CUST00001',state);
  assert.deepEqual(await local.loadLocalMemory('device','CUST00001'),state);
  assert.equal((await local.loadLocalMemory('device','CUST00002')).messages.length,0);
  assert.equal((await local.loadLocalMemory('someone-else','CUST00001')).messages.length,0);
  await local.writeRecord('large',{ text:'ä'.repeat(500000) });
  const original=await local.readRecord('large'); failPublish=true;
  await assert.rejects(local.writeRecord('large',{text:'new'})); failPublish=false;
  assert.deepEqual(await local.readRecord('large'),original,'Interrupted write retains previous manifest');
  await Promise.all([local.writeRecord('queue',{i:1}),local.writeRecord('queue',{i:2})]);
  assert.equal((await local.readRecord('queue')).i,2);
  const other = {...emptyMemory(),updatedAt:90,messages:[{id:'three',ts:15,from:'user',text:'Toinen laite'}]};
  const merged=mergeMemory(state,other);assert.equal(merged.messages.length,3);assert.equal(merged.draft,state.draft);
  const reset={...emptyMemory(),resetAt:200,updatedAt:200};
  const stale={...state,updatedAt:300};assert.equal(mergeMemory(reset,stale).messages.length,0);assert.equal(mergeMemory(reset,stale).draft,'');
  const input=conversationInput(state.messages,'Muistatko tavoitteeni?');assert.match(input[0].content,/purjevene/);assert.equal(input.at(-1).role,'user');assert.match(input[1].content,/6000/);
  assert.equal(searchConversation(state.messages,'purjevene').length,1);
  const bank=JSON.parse(fs.readFileSync('data/customers/CUST00171.json','utf8'));
  await local.saveLocalBank('device','CUST00171',bank);assert.deepEqual(await local.loadLocalBank('device','CUST00171'),bank);
  assert.equal(customerLetter('CUST00001'),'A');assert.equal(customerLetter('CUST00002'),'B');assert.equal([...customerLetter('CUST05100')].length,1);
  console.log('PASS local persistence: full history/cards/profile/scenarios/draft/scroll, bank snapshot, identity isolation, chunks, crash recovery, write order, deletion epoch, model replay and archive search, one-letter avatars');
})().catch(e=>{console.error(e);process.exitCode=1;});
