const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const root=path.join(__dirname,'..');
const seed=require('../research/history.json');
function harness(){
 const entries=new Map();let unavailable=false;let requests=0;
 const db={
  async get(key){if(unavailable)throw Error('storage offline');return entries.get(key)||null;},
  async list(){if(unavailable)throw Error('storage offline');return {blobs:[...entries.keys()].filter(k=>k.startsWith('records/')).map(key=>({key}))};},
  async setJSON(key,value,options){if(unavailable)throw Error('storage offline');assert.equal(options.onlyIfNew,true);if(!entries.has(key))entries.set(key,value);}
 };
 const context={module:{exports:{}},Buffer,AbortSignal,console,
  require(name){if(name==='@netlify/blobs')return {getStore(options){assert.equal(options.consistency,'strong');return db;}};if(name==='../research/history.json')return seed;return require(name);},
  async fetch(url){requests++;return {ok:true,arrayBuffer:async()=>Buffer.from(url)};}
 };
 vm.runInNewContext(fs.readFileSync(path.join(root,'lib/changelog.js'),'utf8'),context);
 const helper=context.module.exports;
 function handler(name){const c={module:{exports:{}},exports:{},console,require:()=>helper};c.exports=c.module.exports;vm.runInNewContext(fs.readFileSync(path.join(root,'lib/hash-handlers.js'),'utf8'),c);return c.module.exports[name==='hash-update'?'update':'read'];}
 return {entries,helper,update:handler('hash-update'),history:handler('hash-history'),useBytes(bytes){context.fetch=async()=>({ok:true,arrayBuffer:async()=>bytes});},fail(){unavailable=true;},get requests(){return requests;}};
}
test('preserves seed and legacy history across new records and reloads',async()=>{
 const h=harness(),legacy={hash:'a'.repeat(64),date:'2026-07-01',note:'Existing persisted entry'};
 h.entries.set('history',[legacy]);
 const first=await h.helper.record('/');
 assert.ok(first.history.some(e=>e.hash===legacy.hash));
 for(const e of seed.filter(e=>e.path==='/'))assert.ok(first.history.some(x=>x.hash===e.hash));
 const second=await h.helper.record('/');
 assert.equal(second.status,'unchanged');assert.equal(h.entries.size,2);
 const result=JSON.parse((await h.history({httpMethod:'GET'})).body);
 assert.ok(result.some(e=>e.hash===first.hash));
});
test('concurrent artifact changes are independent and duplicate hashes deduplicate',async()=>{
 const h=harness();
 await Promise.all([h.helper.record('/'),h.helper.record('/one-table-globe.html'),h.helper.record('/one-table-globe.html')]);
 assert.equal(h.entries.size,2);
 assert.equal((await h.helper.history('/one-table-globe.html')).filter(e=>e.note.startsWith('New live')).length,1);
});
test('rejects unsupported paths, methods, origins and malformed JSON before fetching',async()=>{
 const h=harness();
 for(const [event,status] of [
  [{httpMethod:'GET'},405],
  [{httpMethod:'POST',body:'{'},400],
  [{httpMethod:'POST',body:'{"path":"https://example.com"}'},400],
  [{httpMethod:'POST',headers:{origin:'https://example.com'}},403]
 ])assert.equal((await h.update(event)).statusCode,status);
 assert.equal(h.requests,0);
});
test('does not claim persistent success during storage outage',async()=>{
 const h=harness();h.fail();
 assert.equal((await h.update({httpMethod:'POST',body:'{}'})).statusCode,503);
 assert.equal((await h.history({httpMethod:'GET'})).statusCode,503);
 assert.equal(h.entries.size,0);
});
test('ignores caller-supplied hashes and notes; computes hash from live bytes',async()=>{
 const h=harness();
 const r=JSON.parse((await h.update({httpMethod:'POST',body:JSON.stringify({path:'/one-table-globe.html',hash:'b'.repeat(64),note:'<script>bad</script>'})})).body);
 assert.equal(r.hash,crypto.createHash('sha256').update('https://the-claude-manifesto.haawke.com/one-table-globe.html').digest('hex'));
 assert.ok(!r.history.some(e=>e.note.includes('<script>')));
});
test('persists a known release record without changing its date or note',async()=>{
 const h=harness(),artifact='/one-table-globe.html';
 h.useBytes(fs.readFileSync(path.join(root,artifact)));
 const result=await h.helper.record(artifact);
 assert.equal(result.status,'unchanged');assert.equal(h.entries.size,1);
 const entry=[...h.entries.values()][0],expected=seed.find(e=>e.path===artifact);
 assert.equal(entry.date,expected.date);assert.equal(entry.note,expected.note);
});
test('release manifest matches exact published page, archive and texture bytes',()=>{
 for(const artifact of ['/one-table-hologram.html','/one-table-globe.html','/assets/textures/earth_atmos_2048.jpg','/assets/textures/earth_clouds_1024.png','/research/one-table-globe-original.html','/bg-circuit.png']){
  const bytes=fs.readFileSync(path.join(root,artifact));
  const digest=crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(seed.filter(e=>e.path===artifact).at(-1).hash,digest,artifact);
 }
});
test('all inline page scripts parse and repaired pages contain no dead texture host',()=>{
 for(const name of ['one-table-hologram.html','one-table-globe.html','bts.html']){
  const html=fs.readFileSync(path.join(root,name),'utf8');
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
   if(match[1].includes('application/ld+json'))JSON.parse(match[2]);
   else new vm.Script(match[2],{filename:name});
  }
  if(name!=='bts.html')assert.ok(!html.includes('s.cdpn.io'));
 }
});
