import {ORIGIN,paths,response,record,history} from './changelog.mjs';
const update=async event=>{
 if(event.httpMethod==='OPTIONS') return response(200,{});
 if(event.httpMethod!=='POST') return response(405,{error:'Method not allowed'});
 const origin=event.headers?.origin||event.headers?.Origin;
 if(origin&&origin!==ORIGIN) return response(403,{error:'Forbidden'});
 let body;
 try{body=JSON.parse(event.body||'{}');}catch{return response(400,{error:'Invalid JSON'});}
 const path=body?.path||'/';
 if(!paths.has(path)) return response(400,{error:'Unknown research artifact'});
 try{return response(200,await record(path));}
 catch(error){console.error('hash-update:',error.message);return response(503,{error:'Verification or persistent recording unavailable; retry later.'});}
};


const read=async event=>{
 if(event.httpMethod==='OPTIONS') return response(200,{});
 if(event.httpMethod!=='GET') return response(405,{error:'Method not allowed'});
 const path=event.queryStringParameters?.path||'/';
 if(!paths.has(path)) return response(400,{error:'Unknown research artifact'});
 try{return response(200,await history(path));}
 catch(error){console.error('hash-history:',error.message);return response(503,{error:'Persistent history unavailable; retry later.'});}
};

export {update,read};
