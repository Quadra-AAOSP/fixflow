import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const out='/tmp/fixflow-hci-live';const sql=await fs.readFile(new URL('../../../Backend/src/main/resources/db/demo-data.sql',import.meta.url),'utf8');const accounts={};for(const l of sql.split('\n')){if(!l.startsWith('INSERT INTO users'))continue;const email=l.match(/SELECT '([^']+)'/)[1];const role=l.match(/, '(reporter|staff|admin|technician|super_admin|shop_manager)',/)[1];accounts[role]??=email;}
const b=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});const evidence=[];
async function login(role){const c=await b.newContext({viewport:{width:390,height:844}});const p=await c.newPage();await p.goto('http://localhost:5173/login',{waitUntil:'domcontentloaded'});await p.getByLabel('Email',{exact:true}).fill(accounts[role]);await p.getByLabel('Password',{exact:true}).fill(accounts[role]);await p.getByRole('button',{name:/sign in/i}).click();await p.waitForURL(u=>u.pathname!='/login');await p.waitForTimeout(350);return {c,p};}

const {c,p}=await login('admin');
for(const route of ['/','/reports','/reports/new','/sites','/shop']){
await p.setViewportSize({width:1365,height:900});await p.goto('http://localhost:5173'+route,{waitUntil:'domcontentloaded'});await p.locator('h1').first().waitFor();await p.waitForTimeout(250);
const contrast=await p.evaluate(()=>{
const rgb=c=>{const a=c.match(/[\d.]+/g)?.map(Number);return a?.length>=3&&(a.length<4||a[3]===1)?a.slice(0,3):null};
const lum=a=>a.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4}).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
const findings=[];for(const e of document.querySelectorAll('body *')){if(e.closest('svg,button:disabled,fieldset:disabled,[aria-hidden=true]'))continue;const text=e.getAttribute('placeholder')||'';if(!text||!e.getClientRects().length)continue;const st=getComputedStyle(e,'::placeholder');if(st.visibility==='hidden'||Number(st.opacity)<1)continue;let parent=e,bg=null;while(parent){const ps=getComputedStyle(parent);bg=rgb(ps.backgroundColor);if(bg)break;parent=parent.parentElement;}const fg=rgb(st.color);if(!fg||!bg)continue;const a=lum(fg),b=lum(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);const fs=parseFloat(st.fontSize),large=fs>=24||(fs>=18.66&&parseInt(st.fontWeight)>=700);if(ratio<(large?3:4.5))findings.push({text:text.slice(0,90),tag:e.tagName,cls:typeof e.className==='string'?e.className:'',fg:st.color,bg:bg.join(','),fontSize:fs,ratio:Number(ratio.toFixed(2)),threshold:large?3:4.5});}return findings;
});
await p.setViewportSize({width:320,height:900});await p.waitForTimeout(100);const narrow=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));await p.screenshot({path:out+'/impeccable-'+(route==='/'?'dashboard':route.slice(1).replaceAll('/','-'))+'-320.png',fullPage:true});
evidence.push({route,contrast,narrow});await fs.writeFile(out+'/impeccable-placeholders-after.json',JSON.stringify(evidence,null,2));console.log(route,contrast.length,narrow);
}
await c.close();await b.close();
