// @vitest-environment jsdom
import {beforeEach,expect,it,vi} from 'vitest';
import {mount,flushPromises} from '@vue/test-utils';
import Panel from '../src/components/technician/TechnicianVerificationPanel.vue';
import * as api from '../src/services/technicianVerification';
vi.mock('../src/services/technicianVerification',()=>({getVerification:vi.fn(),submitVerification:vi.fn()}));
beforeEach(()=>{vi.resetAllMocks();});
it('prefills saved details and leaves experience and qualifications for manual review',async()=>{
 vi.mocked(api.getVerification).mockResolvedValue({
   technicianId:1,status:'unverified',email:'tech@example.invalid',phone:'555-0100',trades:'plumbing',
 } as api.TechnicianVerification);
 const wrapper=mount(Panel);await flushPromises();
 expect(wrapper.text()).toContain('Do not submit identity document');
 expect(wrapper.find('input[type=file]').exists()).toBe(false);
 expect(wrapper.find('form').exists()).toBe(true);
 expect(wrapper.get<HTMLInputElement>('input[type=email]').element.value).toBe('tech@example.invalid');
 expect(wrapper.get<HTMLInputElement>('input:not([type])').element.value).toBe('555-0100');
 expect(wrapper.findAll('textarea').map(field=>field.element.value)).toEqual(['plumbing','','']);
});
it('suspended technicians cannot resubmit or self-approve',async()=>{
 vi.mocked(api.getVerification).mockResolvedValue({technicianId:1,status:'suspended',reason:'Review required'} as api.TechnicianVerification);
 const wrapper=mount(Panel);await flushPromises();
 expect(wrapper.text()).toContain('Review required');
 expect(wrapper.find('form').exists()).toBe(false);
 expect(api.submitVerification).not.toHaveBeenCalled();
});
