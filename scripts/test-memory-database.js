const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create schema auth; create role anon; create role authenticated; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
    insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');`);
  await db.exec(fs.readFileSync('supabase/migrations/202611150001_customer_memory.sql','utf8'));
  const user=async n=>{await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000${n}',false);`);};
  const save=state=>db.query('select public.pt_save_memory($1,$2::jsonb)',['CUST00171',JSON.stringify(state)]);
  const read=async()=> (await db.query('select state from public.pt_customer_memory')).rows;
  await user(1);await save({updatedAt:10,resetAt:0,messages:[{id:'a',ts:5,text:'One'}]});
  await save({updatedAt:20,resetAt:0,messages:[{id:'b',ts:15,text:'Two'}]});
  assert.equal((await read())[0].state.messages.length,2);
  await user(2);assert.equal((await read()).length,0);
  await assert.rejects(db.query("insert into public.pt_bank_snapshots(owner_id,customer_id,payload) values ($1,$2,$3::jsonb)",['00000000-0000-0000-0000-000000000001','CUST00171',JSON.stringify({customer:{id:'CUST00171'}})]));
  await save({updatedAt:30,resetAt:0,messages:[{id:'c',ts:25,text:'Private second user'}]});assert.equal((await read())[0].state.messages.length,1);
  await user(1);assert.equal((await read())[0].state.messages.length,2);
  await save({updatedAt:40,resetAt:40,profile:null,messages:[]});
  await save({updatedAt:80,resetAt:0,profile:{goal:'stale'},messages:[{id:'a',ts:5,text:'One'}]});
  assert.equal((await read())[0].state.messages.length,0);assert.equal((await read())[0].state.profile,null);
  await db.exec('reset role; set role anon;');
  await assert.rejects(read());await assert.rejects(save({messages:[]}));
  console.log('PASS PostgreSQL migration/RLS: owner-only reads/writes, blocked anonymous access, message union, cross-device reset protection');
 } finally {await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
