import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
const PORT=4326;
const srv=spawn(process.execPath,['scripts/dev-server.mjs','--port',String(PORT),'--seed'],{stdio:['ignore','pipe','pipe'],env:{...process.env,KILN_NOW:'2026-11-14T09:00:00Z'}});
await new Promise(r=>setTimeout(r,2600));
const b=await chromium.launch({executablePath:'C:/Users/张一/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'});
const p=await b.newPage({viewport:{width:1280,height:820},deviceScaleFactor:1});
await p.goto(`http://127.0.0.1:${PORT}/game.html`,{waitUntil:'networkidle'});
await p.waitForTimeout(800);
const out = await p.evaluate(() => {
  const c=document.querySelector('canvas');
  const g=c.getContext('2d');
  const w=c.width,h=c.height;
  const col=Math.round(w*0.515);
  const rows=[];
  let prev=null;
  for(let y=0;y<h;y+=1){
    const d=g.getImageData(col,y,1,1).data;
    const key=`${d[0]},${d[1]},${d[2]}`;
    if(prev!==null && key!==prev && rows.length<40) rows.push([y,key]);
    prev=key;
  }
  return {w,h,col,rows:rows.slice(0,30)};
});
console.log(JSON.stringify(out,null,1).slice(0,2000));
await b.close(); srv.kill();
