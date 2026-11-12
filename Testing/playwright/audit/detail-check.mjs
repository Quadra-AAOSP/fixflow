import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const output='/tmp/fixflow-hci-live'; await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const screens=[['/reports/42','admin']];
const site={id:1,name:'Demo Site',type:'school',contractStatus:'contracted',description:'Shared community space',address:'10 Garden Road',imageUrl:null};
const report={id:42,siteId:1,subsiteId:3,createdByUserId:22,createdByName:'Rae Tester',description:'Leaking tap in the main hallway',category:'plumbing',specialty:null,aiUrgency:null,reporterUrgency:'medium',reporterReason:null,finalUrgency:null,status:'open',assignedTechnicianId:null,editable:true,reopenCount:0,createdAt:'2026-11-10T10:00:00Z',updatedAt:'2026-11-10T10:00:00Z'};
const sql=await fs.readFile(new URL('../../../Backend/src/main/resources/db/demo-data.sql',import.meta.url),'utf8');
const credentials={};for(const line of sql.split('\n')){if(!line.startsWith('INSERT INTO users'))continue;const email=line.match(/SELECT '([^']+)'/)[1];const role=line.match(/, '(reporter|staff|admin|technician|super_admin|shop_manager)',/)[1];credentials[role]??=email;}
const results=[];
for(const [originalPath,role] of screens){if(results.some(x=>x.path===originalPath && !originalPath.includes('/42') && !originalPath.includes('test-order') && !originalPath.startsWith('/sites/') && originalPath!='/profile'))continue;let path=originalPath;const context=await browser.newContext();const page=await context.newPage();const failures=new Set();const runtimeErrors=[];page.on('pageerror',e=>runtimeErrors.push(e.message));
page.on('response',response=>{if(response.status()>=400&&response.url().includes('/api/'))failures.add(`${response.status()} ${new URL(response.url()).pathname}`);});
let loginResult='guest';
if(role && role!=='application'){
await page.goto('http://localhost:5173/login');
await page.getByLabel('Email',{exact:true}).fill(credentials[role]);await page.getByLabel('Password',{exact:true}).fill(credentials[role]);
await page.getByRole('button',{name:/sign in/i}).click();
await page.waitForURL(u=>!u.pathname.endsWith('/login'),{timeout:15000}).catch(()=>{});
loginResult=new URL(page.url()).pathname==='/login'?'failed':'passed';
}
const siteResponse=role?await context.request.get('http://localhost:8080/api/sites'):null;const accessibleSites=siteResponse?.ok()?await siteResponse.json():[];const actualSiteId=accessibleSites[0]?.id;if(path.startsWith('/sites/1')&&actualSiteId)path=path.replace('/sites/1','/sites/'+actualSiteId);
if(path.includes('/reports/42')){const response=await context.request.get('http://localhost:8080/api/reports?siteId='+actualSiteId+'&page=0&size=100');if(response.ok()){const payload=await response.json();if(payload.content?.[0])path='/reports/'+payload.content[0].id;}}
if(path.includes('test-order')){const managed=path.includes('orders-management');const response=await context.request.get('http://localhost:8080/api/'+(managed?'admin/shop/orders':'shop/orders'));if(response.ok()){const payload=await response.json();const items=Array.isArray(payload)?payload:payload.content??payload.orders??[];if(items[0])path=path.replace('test-order',items[0].orderId);}}
const variants=[];
for(const width of [1365,390]){await page.setViewportSize({width,height:900});await page.goto('http://localhost:5173'+path,{waitUntil:'domcontentloaded'}).catch(async()=>{await page.waitForTimeout(300);await page.goto('http://localhost:5173'+path,{waitUntil:'domcontentloaded'});});await page.waitForTimeout(650);const slug=(path==='/'?'dashboard':path.slice(1).replaceAll('/','-'));await page.screenshot({path:`${output}/${slug}-${width}.png`,fullPage:true});variants.push(await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,headings:[...document.querySelectorAll('h1')].map(x=>x.textContent?.trim()),alerts:[...document.querySelectorAll('[role=alert]')].map(x=>x.textContent?.trim()),unlabelled:[...document.querySelectorAll('input:not([type=hidden]),textarea,select')].filter(x=>!x.labels?.length&&!x.getAttribute('aria-label')&&!x.getAttribute('aria-labelledby')).map(x=>x.outerHTML.slice(0,180))})));}
let logoutResult=null;if(originalPath==='/profile'){await page.getByRole('button',{name:/sign out/i}).click();await page.waitForURL('**/login',{timeout:10000}).catch(()=>{});logoutResult=new URL(page.url()).pathname==='/login';}
results.push({logoutResult,path,requestedPath:originalPath,role,actualPath:logoutResult===null?new URL(page.url()).pathname:'/profile',variants,loginResult,httpErrors:[...failures],runtimeErrors});await context.close();console.log(path,variants.map(v=>`${v.width}:${v.scrollWidth}`).join(' '));await fs.writeFile(`${output}/detail-recheck.json`,JSON.stringify(results,null,2));}
await browser.close();
