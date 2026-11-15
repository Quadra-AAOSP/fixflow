import { expect, it } from 'vitest';
import { noticeCopy, noticePath, type NoticeType } from '../src/services/notifications';

it('labels assignment notices instead of falling through to archived', () => {
  expect(noticeCopy('report_assigned')).toEqual({
    title: 'Job assigned',
    detail: 'Report #{id} was assigned to you.',
  });
  expect(noticeCopy('technician_assigned').title).toBe('Technician assigned');
  expect(noticeCopy('report_deleted').title).toBe('Report archived');
  expect(noticeCopy('work_completed').title).toBe('Work completed');
});

it.each([
  ['report_assigned', 4, '/reports/4'],
  ['technician_assigned', 4, '/reports/4'],
  ['work_completed', 9, '/reports/9'],
  ['report_deleted', 9, undefined],
  ['job_posted', null, '/marketplace'],
  ['contract_submitted', null, '/team?tab=contracts'],
  ['terms_required', null, '/technician'],
] as const)('routes %s notices to the right place', (type: NoticeType, reportId, path) => {
  expect(noticePath({ type, reportId })).toBe(path);
});
