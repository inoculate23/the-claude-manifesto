import { getStore } from '@netlify/blobs';
import { createHash } from 'node:crypto';
import seed from '../research/history.json' with { type: 'json' };
const ORIGIN = 'https://the-claude-manifesto.haawke.com';
const paths = new Set(seed.map(e => e.path));
const store = () => getStore({ name: 'manifesto-changelog', consistency: 'strong' });
const response = (statusCode, data) => ({ statusCode, headers: { 'Content-Type':'application/json', 'Cache-Control':'no-store', 'Access-Control-Allow-Origin':ORIGIN }, body:JSON.stringify(data) });
function merge(entries) {
 const unique = new Map();
 for (const e of entries) {
  if (!e || !/^[a-f0-9]{64}$/.test(e.hash)) continue;
  const path = e.path || '/';
  if (paths.has(path) && !unique.has(path+e.hash)) unique.set(path+e.hash,{...e,path});
 }
 return [...unique.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
async function history(path) {
 const db=store(), legacy=await db.get('history',{type:'json'});
 const {blobs}=await db.list({prefix:'records/'});
 const records=await Promise.all(blobs.map(b=>db.get(b.key,{type:'json'})));
 return merge([...seed,...(Array.isArray(legacy)?legacy:[]),...records]).filter(e=>e.path===path);
}
async function record(path) {
 const res=await fetch(ORIGIN+path,{cache:'no-store',signal:AbortSignal.timeout(8000)});
 if(!res.ok) throw new Error('Artifact fetch: '+res.status);
 const hash=createHash('sha256').update(Buffer.from(await res.arrayBuffer())).digest('hex');
 const previous=await history(path);
 const known=previous.find(e=>e.hash===hash);
 if(known){
  await store().setJSON('records/'+encodeURIComponent(path)+'/'+hash,known,{onlyIfNew:true});
  return {status:'unchanged',hash,history:previous};
 }
 const entry={path,hash,date:new Date().toISOString().slice(0,10),note:'New live version observed: '+path};
 await store().setJSON('records/'+encodeURIComponent(path)+'/'+hash,entry,{onlyIfNew:true});
 return {status:'updated',hash,history:merge([...previous,entry])};
}
export {ORIGIN,paths,response,history,record,merge};
