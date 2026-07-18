// docs/16 gap 6 (last item): JOINED-GAME command storm — A50 item 4 fairness.
// F legitimately-joined players flood AUTHENTICATED commands (valid token, real
// seat, enters engine.apply) while a co-player canary measures its OWN command
// -> ack latency, baseline (no flood) vs under-storm. Reads reply frames (the
// #806 lesson): matches each canary cmd to its {applied|rejected, commandId}.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const REPO='/mnt/c/GIT/RetroMultiCiv-hardening';
const _wm=await import(pathToFileURL(REPO+'/node_modules/ws/index.js'));
const WS=_wm.WebSocket||_wm.default;
const F=Number(process.argv[2]||6), SECONDS=Number(process.argv[3]||12), SEATS=Number(process.argv[4]||8), PORT=Number(process.argv[5]||8803);
function rss(pid){try{const s=readFileSync(`/proc/${pid}/status`,'utf8');const m=s.match(/VmRSS:\s+(\d+)/);return m?Math.round(+m[1]/1024):null;}catch{return null;}}
const srv=spawn('node',['server/index.js','--port',String(PORT),'--no-save','--civs',String(SEATS),'--humans',String(SEATS),'--no-spectators'],{cwd:REPO,stdio:['ignore','pipe','pipe']});
let ready=false,crashed=false,stopping=false,serr='';
srv.stdout.on('data',d=>{if(String(d).includes('WebSocket: ws://'))ready=true;});
srv.stderr.on('data',d=>{serr+=String(d);});
srv.on('exit',()=>{if(!stopping)crashed=true;});
const t0=Date.now();while(!ready&&Date.now()-t0<8000){await new Promise(r=>setTimeout(r,100));if(crashed)break;}
if(!ready){console.log(JSON.stringify({error:'server-not-ready',crashed,stderr:serr.slice(0,300)}));srv.kill('SIGKILL');process.exit(1);}
// join a seat, return {ws, token}
function join(name){return new Promise(res=>{const ws=new WS(`ws://127.0.0.1:${PORT}/ws`);let done=false;
  ws.on('message',raw=>{if(done)return;try{const m=JSON.parse(raw);if(m.t==='joined'){done=true;res({ws,token:m.token,pid:m.playerId});}else if(m.t==='rejected'){done=true;res({ws,token:null,code:m.code});}}catch{}});
  ws.on('open',()=>ws.send(JSON.stringify({t:'join',name})));
  setTimeout(()=>{if(!done){done=true;res({ws,token:null,code:'timeout'});}},1500);});}
// CANARY first so it holds a stable seat
const canary=await join('CANARY');
if(!canary.token){console.log(JSON.stringify({error:'canary-no-seat',code:canary.code}));srv.kill('SIGKILL');process.exit(1);}
// canary latency probe: send an authenticated cmd, time until its commandId echoes back
let cid=1;const pending={};const lat=[];
canary.ws.on('message',raw=>{try{const m=JSON.parse(raw);
  if((m.t==='applied'||m.t==='rejected')&&pending[m.commandId]!==undefined){lat.push(Date.now()-pending[m.commandId]);delete pending[m.commandId];}}catch{}});
function probe(){if(canary.ws.readyState!==1)return;const c=cid++;pending[c]=Date.now();
  try{canary.ws.send(JSON.stringify({t:'cmd',token:canary.token,commandId:c,cmd:{type:'moveUnit',unitId:'zzz',dir:'N'}}));}catch{}}
// BASELINE: canary alone, NO flooders yet, 3s
const pr=setInterval(probe,50);await new Promise(r=>setTimeout(r,3000));clearInterval(pr);
const baseN=lat.splice(0);
// STORM: spawn F flooders as SEPARATE PROCESSES so they cannot starve the
// canary's own event loop — any canary starvation is then SERVER-side.
const floodProcs=[];for(let i=0;i<F;i++){floodProcs.push(spawn('node',['flood-worker.mjs',String(PORT),'F'+i],{cwd:REPO+'/hardening',stdio:'ignore'}));}
await new Promise(r=>setTimeout(r,800)); // let flooders join + spin up
const rssTrace=[rss(srv.pid)];const rt=setInterval(()=>{const v=rss(srv.pid);if(v)rssTrace.push(v);},1000);
const pr2=setInterval(probe,50);
await new Promise(r=>setTimeout(r,SECONDS*1000));
clearInterval(pr2);clearInterval(rt);
await new Promise(r=>setTimeout(r,400)); // drain
const stormLat=lat.splice(0);
for(const p of floodProcs)try{p.kill('SIGKILL');}catch{}
function stats(a){if(!a.length)return{n:0};a.sort((x,y)=>x-y);return{n:a.length,p50:a[Math.floor(a.length*0.5)],p99:a[Math.min(a.length-1,Math.floor(a.length*0.99))],max:a[a.length-1]};}
stopping=true;const alive=!crashed&&srv.exitCode===null;srv.kill('SIGKILL');
console.log(JSON.stringify({mode:'joined-cmd-storm',flooders:floodProcs.length,seatsRequested:SEATS,seconds:SECONDS,
  canarySentBaseline:baseN.length,canaryBaseline:stats(baseN),
  canaryRepliesUnderStorm:stormLat.length,canaryUnderStorm:stats(stormLat),
  rssStartMB:rssTrace[0],rssPeakMB:Math.max(...rssTrace),serverAliveAtEnd:alive,serverCrashed:crashed}));
