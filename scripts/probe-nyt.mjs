import { chromium } from 'playwright-core';
const b=await chromium.launch({executablePath:'C:/Users/张一/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe',proxy:{server:'http://127.0.0.1:7897'}});
const p=await b.newPage({viewport:{width:1200,height:900}});
for(const [name,url] of [['wordle','https://www.nytimes.com/games/wordle/index.html'],['connections','https://www.nytimes.com/games/connections'],['strands','https://www.nytimes.com/games/strands']]){
  try{
    await p.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
    await p.waitForTimeout(4000);
    const title=await p.title();
    console.log(name,'->',title);
    await p.screenshot({path:`_ref/ruler-${name}.png`});
  }catch(e){console.log(name,'FAIL',String(e).slice(0,120));}
}
await b.close();
