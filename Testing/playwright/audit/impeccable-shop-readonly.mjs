import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const output='/tmp/impeccable-authenticated-audit.json';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const sql=await fs.readFile(new URL('../../../Backend/src/main/resources/db/demo-data.sql',import.meta.url),'utf8');
const credentials={};for(const line of sql.split('\n')){if(!line.startsWith('INSERT INTO users'))continue;const email=line.match(/SELECT '([^']+)'/)[1];const role=line.match(/, '(reporter|staff|admin|technician|super_admin|shop_manager)',/)[1];credentials[role]??=email;}
const results=[];
for(const [path,role] of [['/shop','technician'],['/shop/dashboard','shop_manager'],['/shop/manage','shop_manager'],['/shop/orders-management','shop_manager'],['/site-application','admin'],['/setup-site-admin','admin']]){
 const page=await browser.newPage({viewport:{width:390,height:844}});if(role){await page.goto('http://localhost:5173/login',{waitUntil:'domcontentloaded'});await page.getByLabel('Email',{exact:true}).fill(credentials[role]);await page.getByLabel('Password',{exact:true}).fill(credentials[role]);await page.getByRole('button',{name:/sign in/i}).click();await page.waitForURL(u=>!u.pathname.endsWith('/login'));}await page.goto('http://localhost:5173'+path,{waitUntil:'domcontentloaded'});await page.waitForTimeout(500);
 const data=await page.evaluate(()=>{
 function rgb(s){const a=s.match(/[\d.]+/g)?.map(Number);return a&&a.length>=3?a:null;}
 function lum(c){return c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0)}
 const text=[];for(const e of document.querySelectorAll('body *')){if(e.children.length||!e.textContent.trim())continue;const s=getComputedStyle(e);if(s.visibility==='hidden'||s.display==='none'||e.getBoundingClientRect().height===0)continue;const fg=rgb(s.color);let bg=null;let p=e;while(p&&!bg){const c=rgb(getComputedStyle(p).backgroundColor);if(c&&(!c[3]&&c.length<4||c[3]===1))bg=c;p=p.parentElement}if(!fg||!bg)continue;const ratio=(Math.max(lum(fg),lum(bg))+.05)/(Math.min(lum(fg),lum(bg))+.05);const large=parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.66&&parseFloat(s.fontWeight)>=700);if(ratio<(large?3:4.5))text.push({text:e.textContent.trim().slice(0,90),ratio:+ratio.toFixed(2),fg:s.color,bg,fontSize:s.fontSize,weight:s.fontWeight,tag:e.tagName,cls:e.className});}
 const controls=[...document.querySelectorAll('a,button,input,select,summary')].filter(e=>e.getBoundingClientRect().width&&getComputedStyle(e).visibility!=='hidden').map(e=>{const r=e.getBoundingClientRect();return {text:(e.textContent||e.getAttribute('aria-label')||'').trim().slice(0,60),tag:e.tagName,width:+r.width.toFixed(1),height:+r.height.toFixed(1)}}).filter(e=>e.width<24||e.height<24);
 return {contrast:text,smallControls:controls,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,mainCount:document.querySelectorAll('main').length};});
 await page.setViewportSize({width:1280,height:900});await page.evaluate(()=>document.documentElement.style.zoom='2');await page.waitForTimeout(150);data.zoom2={scrollWidth:await page.evaluate(()=>document.documentElement.scrollWidth),clientWidth:1280};results.push({path,...data});await page.close();
}
await fs.writeFile(output,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));await browser.close();
