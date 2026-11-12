import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const output='/tmp/fixflow-hci-audit'; await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const screens=[['/welcome',null],['/for/reporters',null],['/for/site-admins',null],['/for/technicians',null],['/login',null],['/register',null],['/access-policy','reporter'],['/request-site','admin'],['/site-application','admin'],['/setup-site-admin','admin'],['/agreements/technician/2026-11-03','technician'],['/application-access','application'],['/','admin'],['/reporter','reporter'],['/reports','admin'],['/reports/new','reporter'],['/reports/42','admin'],['/sites','admin'],['/sites/1','admin'],['/sites/1/subsites','admin'],['/assignments','admin'],['/technician','technician'],['/technician/marketplace','technician'],['/building-suggestions','reporter'],['/marketplace','technician'],['/technician/invitations','technician'],['/site-rules','admin'],['/team-access','admin'],['/contracts','admin'],['/profile','reporter'],['/admin-application','reporter'],['/site-applications','super_admin'],['/technician-verifications','super_admin'],['/shop','technician'],['/shop/orders/test-order','technician'],['/shop/dashboard','shop_manager'],['/shop/orders-management','shop_manager'],['/shop/orders-management/test-order','shop_manager'],['/shop/manage','shop_manager']];
const site={id:1,name:'Demo Site',type:'school',contractStatus:'contracted',description:'Shared community space',address:'10 Garden Road',imageUrl:null};
const report={id:42,siteId:1,subsiteId:3,createdByUserId:22,createdByName:'Rae Tester',description:'Leaking tap in the main hallway',category:'plumbing',specialty:null,aiUrgency:null,reporterUrgency:'medium',reporterReason:null,finalUrgency:null,status:'open',assignedTechnicianId:null,editable:true,reopenCount:0,createdAt:'2026-11-10T10:00:00Z',updatedAt:'2026-11-10T10:00:00Z'};
const results=[];
for(const [path,role] of screens){const context=await browser.newContext();const page=await context.newPage();const failures=new Set();const runtimeErrors=[];page.on('pageerror',e=>runtimeErrors.push(e.message));
await page.route('**/api/**',async route=>{const p=new URL(route.request().url()).pathname;let body;let status=200;
if(p==='/api/auth/me'){body=role?{id:22,firstName:'Rae',lastName:'Tester',email:'rae@example.test',role:role==='application'?'reporter':role,siteId:1,applicationOnly:role==='application'}:{message:'No test session'};status=role?200:401;}
else if(p==='/api/auth/csrf')body={token:'audit-token'};
else if(p==='/api/sites')body=[site];else if(p==='/api/sites/1')body=site;
else if(p==='/api/reports')body={content:[report],page:0,size:20,totalPages:1,totalElements:1};else if(p==='/api/reports/42')body=report;
else if(p==='/api/site-rules'||p==='/api/sites/1/taxonomy')body=[{id:1,siteType:'school',category:'plumbing',urgencyWeight:2,sortOrder:1}];
else if(p==='/api/sites/1/subsites')body=[{id:3,siteId:1,label:'A',name:'Main building',archivedAt:null}];
else if(p==='/api/sites/1/reporting-setup')body={siteId:1,reportingReady:true,activeSubsiteCount:1};
else if(p==='/api/sites/1/technician-pool')body=[];
else if(p.includes('notifications'))body={content:[],hasMore:false};
else{status=503;body={message:'Audit fixture: this service is unavailable. Try again.'};failures.add(p);}
await route.fulfill({status,json:body});});
const variants=[];
for(const width of [1365,390]){await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:5174'+path,{waitUntil:'domcontentloaded'});await page.waitForTimeout(180);const slug=(path==='/'?'dashboard':path.slice(1).replaceAll('/','-'));await page.screenshot({path:`${output}/${slug}-${width}.png`,fullPage:true});variants.push(await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,headings:[...document.querySelectorAll('h1')].map(x=>x.textContent?.trim()),alerts:[...document.querySelectorAll('[role=alert]')].map(x=>x.textContent?.trim()),unlabelled:[...document.querySelectorAll('input:not([type=hidden]),textarea,select')].filter(x=>!x.labels?.length&&!x.getAttribute('aria-label')&&!x.getAttribute('aria-labelledby')).map(x=>x.outerHTML.slice(0,180))})));}
results.push({path,role,actualPath:new URL(page.url()).pathname,variants,unmockedRequests:[...failures],runtimeErrors});await context.close();console.log(path,variants.map(v=>`${v.width}:${v.scrollWidth}`).join(' '));await fs.writeFile(`${output}/results.json`,JSON.stringify(results,null,2));}
await browser.close();
