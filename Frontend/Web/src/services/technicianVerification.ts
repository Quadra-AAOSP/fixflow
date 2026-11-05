import { request } from './api';
export interface TechnicianVerification {
 technicianId:number; status:string; email:string|null; phone:string|null; trades:string|null;
 experience:string|null; qualifications:string|null; reason:string|null; version:number|null;
 identityChecked:boolean; emailChecked:boolean; phoneChecked:boolean; tradeChecked:boolean;
}
export const getVerification=()=>request<TechnicianVerification>('/api/technician-verification/me');
export const submitVerification=(body:{email:string;phone:string;trades:string;experience:string;qualifications:string})=>request<TechnicianVerification>('/api/technician-verification/me',{method:'POST',body:JSON.stringify(body)});
export const listVerifications=()=>request<TechnicianVerification[]>('/api/admin/technician-verifications');
export const decideVerification=(id:number,body:object)=>request<TechnicianVerification>(`/api/admin/technician-verifications/${id}/decision`,{method:'POST',body:JSON.stringify(body)});
