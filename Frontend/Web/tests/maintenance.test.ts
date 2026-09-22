import { describe, expect, it } from 'vitest';
import { report } from './fixtures';
import { summarize, weeklyChart, searchReports, effectiveUrgency } from '../src/utils/maintenance';

describe('live dashboard aggregation', () => {
  it('groups every backend lifecycle state, excluding resolved high urgency from active urgent reports', () => {
    const reports = ['open','routed','reopened','escalated','assigned','in_progress','resolved_pending_confirmation','confirmed'].map(status => report({ status: status as ReturnType<typeof report>['status'], reporterUrgency: 'high' }));
    expect(summarize(reports)).toEqual({ open: 4, progress: 2, resolved: 2, urgent: 6 });
  });
  it('uses final urgency when available and reporter urgency while routing is pending', () => {
    expect(effectiveUrgency(report({ reporterUrgency: 'critical', finalUrgency: 'low' }))).toBe('low');
    expect(summarize([report({ reporterUrgency: 'critical', finalUrgency: 'low' }), report({ reporterUrgency: 'critical' })]).urgent).toBe(1);
  });
  it('has actual zero counts for an empty successful response', () => {
    expect(summarize([])).toEqual({ open: 0, progress: 0, resolved: 0, urgent: 0 });
  });
  it('separates local week boundaries and does not invent completion dates', () => {
    const monday = new Date(2026, 8, 21, 0, 0, 0);
    const previousSunday = new Date(2026, 8, 20, 23, 59, 59);
    const nextMonday = new Date(2026, 8, 28, 0, 0, 0);
    const rows = [report({ createdAt: monday.toISOString(), status: 'confirmed' }), report({ createdAt: previousSunday.toISOString() }), report({ createdAt: nextMonday.toISOString() })];
    const current = weeklyChart(rows, 0, new Date(2026, 8, 23));
    expect(current[0]?.values).toEqual([0, 0, 1]);
    expect(current.flatMap(day => day.values).reduce((a,b) => a+b,0)).toBe(1);
    expect(weeklyChart(rows, -1, new Date(2026, 8, 23))[6]?.values).toEqual([1,0,0]);
  });
  it('searches server-provided fields and handles masked identities', () => {
    expect(searchReports([report()], 'null', () => 'North')).toHaveLength(0);
    expect(searchReports([report()], 'north', () => 'North')).toHaveLength(1);
    expect(searchReports([report({ status: 'assigned' })], '', () => '', 'progress')).toHaveLength(1);
  });
});
