import { useState } from 'react';
import { Link } from 'expo-router';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AuthShell } from './AuthShell';
import { AuthField } from './AuthField';
import { AuthButton } from './AuthButton';
import * as service from '@/services/onboarding';

const fields = [ ['organization','Organization','机构'], ['siteName','Site name','场所名称'], ['address','Address','地址'], ['contactEmail','Requester email','申请人邮箱'], ['contactPhone','Requester phone','申请人电话'], ['relationship','Requester relationship and authority','申请人与场所的关系及权限'], ['adminFirstName','Intended administrator first name','拟任管理员名字'], ['adminLastName','Intended administrator last name','拟任管理员姓氏'], ['adminEmail','Intended administrator email','拟任管理员邮箱'], ['adminPhone','Intended administrator phone','拟任管理员电话'] ] as const;
const initial: service.SiteRequest = { organization:'',siteName:'',siteType:'school',address:'',contactEmail:'',contactPhone:'',relationship:'',adminFirstName:'',adminLastName:'',adminEmail:'',adminPhone:'' };
export function SiteOnboarding({mode}:{mode:'request'|'track'|'setup'}) {
 const {i18n}=useTranslation('common');
 const tr=(en:string,zh:string)=>i18n.language.startsWith('zh')?zh:en;
 const [form,setForm]=useState(initial),[token,setToken]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
 const [status,setStatus]=useState<service.ApplicationStatus>(),[receipt,setReceipt]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const correction=mode==='track'&&status?.status==='information_requested';
 async function run(action:()=>Promise<void>){if(busy)return;setBusy(true);setMessage('');try{await action();}catch{setMessage(tr('Unable to complete this action. Check details and connection, then retry.','无法完成操作。请检查信息和网络后重试。'));}finally{setBusy(false);}}
 async function submit(){if(fields.some(([key])=>!form[key].trim())||!['school','hostel','hotel'].includes(form.siteType)){setMessage(tr('Complete all fields and choose school, hostel or hotel.','请填写所有字段，并选择 school、hostel 或 hotel。'));return;}await run(async()=>{if(correction){setStatus(await service.correctSite(token,form));setMessage(tr('Corrected information submitted.','更正信息已提交。'));}else{const result=await service.submitSite(form);setReceipt(result.trackingToken);setForm(initial);}});}
 return <AuthShell>
 <Text className="mb-4 text-[26px] text-auth-ink">{mode==='request'?tr('Request a site','申请场所'):mode==='track'?tr('Track your application','查询申请'):tr('Set administrator password','设置管理员密码')}</Text>
 <Text className="mb-6 text-[14px] leading-6 text-auth-body">{mode==='request'?tr('No account needed. Provide organization details and nominate the administrator separately. Authority is reviewed before approval.','无需账户。请提供机构信息，并单独指定拟任管理员。批准前将审核申请权限。'):tr('Enter your private token manually. Keep it secure; never share it publicly.','请手动输入私人令牌，妥善保管，勿公开分享。')}</Text>
 {receipt?<><Text selectable className="my-4 text-auth-ink">{tr('Save this private tracking token now. It is shown once:','请立即保存私人查询令牌，仅显示一次：')}{'\n'}{receipt}</Text><AuthButton label={tr('I saved my token','已保存令牌')} onPress={()=>setReceipt('')}/></>:null}
 {mode!=='request'&&<AuthField label={tr('Private token','私人令牌')} value={token} secureTextEntry autoCapitalize="none" autoCorrect={false} onChangeText={value=>{setToken(value);setStatus(undefined);}}/>}
 {mode==='track'&&<AuthButton label={tr('Check status','查询状态')} loading={busy} disabled={!token.trim()} onPress={()=>run(async()=>{setStatus(await service.trackSite(token));})}/>}
 {status&&<Text className="my-5 text-auth-ink">{status.status}{status.message?'\n'+status.message:''}{status.setupComplete?tr('\nSetup complete. Sign in and add labelled buildings.','\n设置完成，请登录并添加有名称的楼宇。'):''}</Text>}
 {correction&&<Text className="my-4 text-auth-body">{tr('For privacy, earlier details are not retrieved. Enter the complete corrected application.','为保护隐私，不读取之前的个人信息。请填写完整的更正申请。')}</Text>}
 {((mode==='request'&&!receipt)||correction)&&<>{fields.map(([key,en,zh])=><AuthField key={key} label={tr(en,zh)} value={form[key]} maxLength={key==='relationship'?1000:key==='address'?512:key.includes('Phone')?64:key.includes('Name')?128:255} autoCapitalize={key.toLowerCase().includes('email')?'none':'sentences'} keyboardType={key.toLowerCase().includes('email')?'email-address':'default'} onChangeText={value=>setForm(prev=>({...prev,[key]:value}))}/>)}<AuthField label={tr('Site type: school / hostel / hotel','场所类型：school / hostel / hotel')} value={form.siteType} autoCapitalize="none" onChangeText={siteType=>setForm(prev=>({...prev,siteType}))}/><AuthButton label={correction?tr('Submit corrected information','提交更正信息'):tr('Submit site request','提交场所申请')} loading={busy} onPress={submit}/></>}
 {mode==='setup'&&<><AuthField label={tr('New password (at least 15 characters)','新密码（至少15个字符）')} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" maxLength={100}/><AuthField label={tr('Confirm password','确认密码')} value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" maxLength={100}/><AuthButton label={tr('Set password','设置密码')} loading={busy} disabled={!token.trim()||password.length<15||password!==confirm} onPress={()=>run(async()=>{await service.setupAdmin(token,password);setToken('');setPassword('');setConfirm('');setMessage(tr('Password set. Sign in and add labelled buildings to enable reporting.','密码已设置。请登录并添加有名称的楼宇，以启用报修。'));})}/></>}
 {!!message&&<Text accessibilityRole="alert" className="my-4 text-auth-ink">{message}</Text>}
 <Link className="mt-5 py-3 text-coral-link" href="/(auth)/track-site">{tr('Track application','查询申请')}</Link>
 <Link className="py-3 text-coral-link" href="/(auth)/setup-site-admin">{tr('Have a setup token?','已有设置令牌？')}</Link>
 <Link className="py-3 text-coral-link" href="/(auth)/login">{tr('Back to sign in','返回登录')}</Link>
 </AuthShell>;
}
