// one flooder: join a seat, spam authenticated cmds until killed. Separate proc
// so it cannot starve the canary's event loop (server-side fairness only).
import { pathToFileURL } from 'node:url';
const REPO='/mnt/c/GIT/RetroMultiCiv-hardening';
const _wm=await import(pathToFileURL(REPO+'/node_modules/ws/index.js'));const WS=_wm.WebSocket||_wm.default;
const PORT=Number(process.argv[2]), NAME=process.argv[3];
const ws=new WS(`ws://127.0.0.1:${PORT}/ws`);let token=null,cid=0;
ws.on('open',()=>ws.send(JSON.stringify({t:'join',name:NAME})));
ws.on('message',raw=>{try{const m=JSON.parse(raw);if(m.t==='joined'&&!token){token=m.token;storm();}}catch{}});
function storm(){if(ws.readyState!==1)return;try{ws.send(JSON.stringify({t:'cmd',token,commandId:++cid,cmd:{type:'moveUnit',unitId:'zzz',dir:'N'}}));}catch{}setImmediate(storm);}
