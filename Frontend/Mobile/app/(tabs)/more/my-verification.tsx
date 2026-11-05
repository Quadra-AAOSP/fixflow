import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/ui/Screen';
import { Action, Field } from '@/components/ReviewControls';
import { useAuth } from '@/hooks/useAuth';
import { ownVerification, submitVerification, type VerificationInput } from '@/services/onboarding';

const empty: VerificationInput = { email:'', phone:'', trades:'', experience:'', qualifications:'' };
export default function MyVerification() {
 const {t}=useTranslation('common'); const {user}=useAuth(); const [data,setData]=useState(empty); const [status,setStatus]=useState(''); const [reason,setReason]=useState(''); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
 async function load(){setBusy(true); try {const v=await ownVerification(); setStatus(v.status); setReason(v.reason ?? ''); setData({email:v.email ?? '',phone:v.phone ?? '',trades:v.trades ?? '',experience:v.experience ?? '',qualifications:v.qualifications ?? ''});} catch(e){setError(e instanceof Error?e.message:t('review.error'));} finally {setBusy(false);}}
 useEffect(()=>{if(user?.role==='technician') void load();},[user?.role]);
 async function submit(){setBusy(true);setError('');try {await submitVerification(data);await load();}catch(e){setError(e instanceof Error?e.message:t('review.error'));}finally{setBusy(false);}}
 const editable=['unverified','rejected'].includes(status);
 return <Screen><Stack.Screen options={{title:t('review.myVerification')}}/><ScrollView contentContainerClassName="p-5 pb-10" keyboardShouldPersistTaps="handled">{user?.role!=='technician'?<Text>{t('review.denied')}</Text>:<><Text className="mb-3 text-lg font-bold text-ink">{t('review.status')}: {status || t('review.loading')}</Text>{reason?<Text className="mb-3 text-ink">{reason}</Text>:null}{error?<Text accessibilityRole="alert" className="mb-3 text-red-700">{error}</Text>:null}{editable?(Object.keys(empty) as (keyof VerificationInput)[]).map(k=><Field key={k} label={t('review.'+k)} value={data[k]} onChangeText={v=>setData({...data,[k]:v})} multiline={['trades','experience','qualifications'].includes(k)}/>):null}{editable?<Action label={t('review.submit')} disabled={busy || Object.values(data).some(v=>!v.trim())} onPress={()=>void submit()}/>:null}<Action label={t('review.refresh')} disabled={busy} onPress={()=>void load()}/></>}</ScrollView></Screen>;
}
