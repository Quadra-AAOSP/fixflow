import { useEffect, useRef, useState } from 'react';
import { Check, Square } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { Pressable, Text, TextInput, View } from 'react-native';
import { api } from '@/lib/apiClient';

type Status = { status: string; review: { expiresAt: string | null } | null };
/** Expiry defaults a year out so recording an approval is one tap once the checks are ticked. */
function inAYear(): string { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function SiteVetting(props: { siteId: number; technicianId: number; admin: boolean }) {
 const { user } = useAuth();
 return <SiteVettingForm key={`${props.siteId}:${props.technicianId}:${props.admin}:${user?.id}:${user?.role}`} {...props} />;
}
function SiteVettingForm({ siteId, technicianId, admin }: { siteId: number; technicianId: number; admin: boolean }) {
 const active = useRef(true);
 const [result, setResult] = useState<Status | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
 const [identity, setIdentity] = useState(false); const [references, setReferences] = useState(false); const [qualifications, setQualifications] = useState(false);
 const [licence, setLicence] = useState<boolean | null>(null); const [licenceChecked, setLicenceChecked] = useState(false); const [insurance, setInsurance] = useState<boolean | null>(null); const [insuranceChecked, setInsuranceChecked] = useState(false);
 const [expiry, setExpiry] = useState(inAYear); const [licenceExpiry, setLicenceExpiry] = useState(inAYear); const [insuranceExpiry, setInsuranceExpiry] = useState(inAYear);
 const path = `/api/sites/${siteId}/technicians/${technicianId}/vetting`;
 async function load() { try { const value = await api.get<Status>(path); if (active.current) setResult(value); } catch (e) { if (active.current) setError(e instanceof Error ? e.message : 'Could not load vetting'); } }
 useEffect(() => { active.current = true; void load(); return () => { active.current = false; }; }, [path]);
 async function save(status: 'approved' | 'revoked') {
  const future = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s).getTime() > Date.now();
  if (licence === null || insurance === null || (status === 'approved' && (!identity || !references || !qualifications || !future(expiry) || (licence && (!licenceChecked || !future(licenceExpiry))) || (insurance && (!insuranceChecked || !future(insuranceExpiry)))))) { setError('Select applicability and complete all required checks with future dates (YYYY-MM-DD).'); return; }
  setBusy(true); setError(''); try { await api.post(path, {status, identityChecked: identity, referencesChecked: references, qualificationsChecked: qualifications, licenceApplicable: licence, licenceChecked, insuranceApplicable: insurance, insuranceChecked, expiresAt: expiry ? new Date(expiry).toISOString() : null, licenceExpiresAt: licenceExpiry ? new Date(licenceExpiry).toISOString() : null, insuranceExpiresAt: insuranceExpiry ? new Date(insuranceExpiry).toISOString() : null}); if (active.current) await load(); } catch(e) { if (active.current) setError(e instanceof Error ? e.message : 'Could not save review'); } finally { if (active.current) setBusy(false); }
 }
 const toggle = (label: string, value: boolean, change: (v:boolean)=>void) => <Pressable accessibilityRole="checkbox" accessibilityState={{checked:value}} onPress={() => change(!value)} className="min-h-[48px] flex-row items-center gap-2 py-2">{value ? <Check color="#184F3A" size={20} /> : <Square color="#184F3A" size={20} />}<Text className="text-base text-ink">{label}</Text></Pressable>;
 const date = (label:string, value:string, change:(v:string)=>void) => <View><Text className="text-ink">{label} (YYYY-MM-DD)</Text><TextInput accessibilityLabel={label} value={value} onChangeText={change} placeholder="YYYY-MM-DD" className="my-2 min-h-[48px] rounded border border-dashboard-card-line p-2 text-base text-ink" /></View>;
 return <View className="mt-3 rounded-lg border border-dashboard-card-line p-3"><Text className="font-semibold text-ink">Site vetting: {result?.status ?? 'loading'}</Text><Text className="my-2 text-dashboard-subtitle">{result?.review?.expiresAt ? `Review expires ${new Date(result.review.expiresAt).toLocaleDateString()}. ` : ''}{admin ? 'This approval covers one technician at this site. Tick the checks below, then Record approval.' : 'Site approval is required before work and is separate from platform verification, terms and contracts. Contact the site administrator to request review.'}</Text>{error ? <Text accessibilityRole="alert" className="text-tone-danger">{error}</Text> : null}{admin && result ? <>
 <Text className="text-dashboard-subtitle">Do not enter identity numbers or document links.</Text>{toggle('Identity checked', identity, setIdentity)}{toggle('Work history and references checked', references, setReferences)}{toggle('Qualifications checked', qualifications, setQualifications)}{date('Review expires', expiry, setExpiry)}
 <Text className="text-ink">Licence applicable?</Text><View className="flex-row gap-4">{toggle('Yes', licence === true, () => setLicence(true))}{toggle('No', licence === false, () => setLicence(false))}</View>{licence ? <>{toggle('Licence checked', licenceChecked, setLicenceChecked)}{date('Licence expires', licenceExpiry, setLicenceExpiry)}</> : null}
 <Text className="text-ink">Insurance applicable?</Text><View className="flex-row gap-4">{toggle('Yes', insurance === true, () => setInsurance(true))}{toggle('No', insurance === false, () => setInsurance(false))}</View>{insurance ? <>{toggle('Insurance checked', insuranceChecked, setInsuranceChecked)}{date('Insurance expires', insuranceExpiry, setInsuranceExpiry)}</> : null}
 <View className="flex-row gap-4"><Pressable disabled={busy} onPress={() => void save('approved')}><Text className="font-bold text-ink">Record approval</Text></Pressable><Pressable disabled={busy} onPress={() => void save('revoked')}><Text className="font-bold text-tone-danger">Revoke approval</Text></Pressable></View></> : null}</View>;
}
