import { chromium } from 'playwright-core';
const b=await chromium.launch({executablePath:'C:/Users/张一/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe',proxy:{server:'http://127.0.0.1:7897'}});
const p=await b.newPage({viewport:{width:1200,height:900}});
await p.goto('https://www.reddit.com/r/Riddonkulous/',{waitUntil:'domcontentloaded',timeout:60000});
await p.waitForTimeout(6000);
console.log('title:', await p.title());
console.log('body:', (await p.locator('body').innerText()).slice(0,300).replace(/\s+/g,' '));
await p.screenshot({path:'_ref/probe-reddit.png'});
await b.close();
