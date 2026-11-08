const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
function service() {
 const calls = []; const api = Object.fromEntries(['get','post','put'].map(method => [method, (...args) => calls.push([method,...args])]));
 const exports = {}; const source = fs.readFileSync(path.join(__dirname,'../services/onboarding.ts'),'utf8');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:name=>{assert.equal(name,'@/lib/apiClient');return {api};}});
 return {api:exports,calls};
}
test('tracking and setup secrets travel in headers, never URLs',()=>{
 const {api,calls}=service(); api.trackSite(' tracking-secret '); api.setupAdmin(' setup-secret ','new-password');
 assert.equal(calls[0][1],'/api/site-applications/status'); assert.equal(calls[0][2].headers['X-Application-Token'],'tracking-secret');
 assert.equal(calls[1][1],'/api/site-applications/setup'); assert.equal(calls[1][3].headers['X-Setup-Token'],'setup-secret');
});
test('review decisions retain reason, version and manual checks',()=>{
 const {api,calls}=service(); const decision={status:'verified',reason:'checked',version:3,identityChecked:true,emailChecked:true,phoneChecked:true,tradeChecked:true};
 api.decideVerification(42,decision); assert.equal(calls[0][0],'post'); assert.equal(calls[0][1],'/api/admin/technician-verifications/42/decision'); assert.equal(calls[0][2],decision);
 api.decideSite(7,'request_information','more detail'); assert.equal(calls[1][1],'/api/admin/site-applications/7/decision'); assert.equal(calls[1][2].decision,'request_information'); assert.equal(calls[1][2].reason,'more detail');
});
