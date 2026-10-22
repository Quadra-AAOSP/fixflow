import { describe, expect, it } from 'vitest';

import type { Report, ReportStatus, Urgency } from '../types';
import {
  effectiveUrgency,
  matchesFilter,
  searchReports,
  statusGroup,
  statusLabels,
  urgencyLabels,
  type StatusGroup,
} from '../utils/maintenance';

const ALL_STATUSES: ReportStatus[] = [
  'open',
  'routed',
  'assigned',
  'in_progress',
  'resolved_pending_confirmation',
  'confirmed',
  'reopened',
  'escalated',
];

const ALL_URGENCIES: Urgency[] = ['low', 'medium', 'high', 'critical'];

type ReportOverrides = Omit<Partial<Report>, 'policy'> & {
  policy?: Partial<Report['policy']>;
};

function makeReport(overrides: ReportOverrides = {}): Report {
  const { policy: policyOverrides, ...rest } = overrides;
  return {
    id: 1,
    siteId: 7,
    subsiteId: null,
    createdByUserId: 3,
    createdByName: 'Ada Lovelace',
    description: 'Leaking pipe in the basement',
    address: '5 Main Street',
    category: 'plumbing',
    specialty: null,
    aiUrgency: 'medium',
    reporterUrgency: 'medium',
    reporterReason: null,
    finalUrgency: null,
    status: 'open',
    assignedTechnicianId: null,
    editable: false,
    reopenCount: 0,
    confirmedByUserId: null,
    confirmedByName: null,
    confirmedAt: null,
    reopenReason: null,
    visibility: 'public',
    photos: [],
    createdAt: '2026-01-10T09:00:00.000Z',
    updatedAt: '2026-01-10T09:00:00.000Z',
    ...rest,
    policy: {
      statusGroup: 'open',
      effectiveUrgency: 'medium',
      urgent: false,
      inAssignmentQueue: false,
      participant: false,
      canSeeSensitive: false,
      canAssign: false,
      canJoin: false,
      ...policyOverrides,
    },
  };
}

const siteName = (id: number | null) => (id === 7 ? 'Harbour Site' : 'Unknown Site');

describe('label maps', () => {
  it('covers all eight report statuses', () => {
    expect(Object.keys(statusLabels).sort()).toEqual([...ALL_STATUSES].sort());
  });

  it('covers all four urgency values', () => {
    expect(Object.keys(urgencyLabels).sort()).toEqual([...ALL_URGENCIES].sort());
  });

  it('stores i18n keys, which the stub resolves verbatim', () => {
    expect(statusLabels.open).toBe('labels.status.open');
    expect(urgencyLabels.critical).toBe('labels.urgency.critical');
  });
});

describe('statusGroup', () => {
  const expected: Record<ReportStatus, StatusGroup> = {
    open: 'open',
    routed: 'open',
    assigned: 'progress',
    in_progress: 'progress',
    resolved_pending_confirmation: 'resolved',
    confirmed: 'resolved',
    reopened: 'open',
    escalated: 'open',
  };

  it('maps every status to its dashboard bucket', () => {
    for (const status of ALL_STATUSES) {
      expect(statusGroup(status), status).toBe(expected[status]);
    }
  });
});

describe('matchesFilter', () => {
  const openReport = makeReport({
    status: 'open',
    policy: { statusGroup: 'open', urgent: false },
  });

  it('returns every report for "all"', () => {
    expect(matchesFilter(openReport, 'all')).toBe(true);
  });

  it('matches the policy status group', () => {
    expect(matchesFilter(openReport, 'open')).toBe(true);
    expect(matchesFilter(openReport, 'progress')).toBe(false);
    expect(matchesFilter(openReport, 'resolved')).toBe(false);
  });

  it('matches urgent reports only when policy marks them urgent', () => {
    expect(matchesFilter(openReport, 'urgent')).toBe(false);
    expect(matchesFilter(makeReport({ policy: { urgent: true } }), 'urgent')).toBe(true);
  });

  it('matches the confirmation filter only for resolved_pending_confirmation', () => {
    expect(
      matchesFilter(makeReport({ status: 'resolved_pending_confirmation' }), 'confirmation'),
    ).toBe(true);
    expect(matchesFilter(makeReport({ status: 'confirmed' }), 'confirmation')).toBe(false);
  });
});

describe('effectiveUrgency', () => {
  it('returns the server-adjudicated policy.effectiveUrgency', () => {
    const report = makeReport({
      reporterUrgency: 'low',
      aiUrgency: 'critical',
      policy: { effectiveUrgency: 'high' },
    });
    expect(effectiveUrgency(report)).toBe('high');
  });

  it('does not re-derive the value from the reporter or AI fields', () => {
    const report = makeReport({
      reporterUrgency: 'critical',
      aiUrgency: 'low',
      policy: { effectiveUrgency: 'medium' },
    });
    expect(effectiveUrgency(report)).toBe('medium');
  });
});

describe('searchReports', () => {
  const pipe = makeReport({ id: 1 });
  const light = makeReport({
    id: 2,
    description: 'Broken light in the corridor',
    address: '12 Side Lane',
    category: 'electrical',
    createdByName: 'Grace Hopper',
    siteId: 9,
  });

  it('matches description, category, reporter name, and site name case-insensitively', () => {
    expect(searchReports([pipe, light], 'LEAKING', siteName)).toEqual([pipe]);
    expect(searchReports([pipe, light], 'Plumbing', siteName)).toEqual([pipe]);
    expect(searchReports([pipe, light], 'grace', siteName)).toEqual([light]);
    expect(searchReports([pipe, light], 'harbour', siteName)).toEqual([pipe]);
  });

  it('returns every report for an empty query', () => {
    expect(searchReports([pipe, light], '   ', siteName)).toEqual([pipe, light]);
  });

  it('respects the active filter even when the text matches', () => {
    const urgentPipe = makeReport({ id: 3, policy: { urgent: true } });
    const reports = [makeReport({ id: 4, policy: { urgent: false } }), urgentPipe];
    expect(searchReports(reports, 'leak', siteName, 'urgent')).toEqual([urgentPipe]);
  });

  it('filters without a query as well', () => {
    const urgentPipe = makeReport({ id: 5, policy: { urgent: true } });
    const reports = [makeReport({ id: 6, policy: { urgent: false } }), urgentPipe];
    expect(searchReports(reports, '', siteName, 'urgent')).toEqual([urgentPipe]);
  });

  // The current haystack covers id, description, category, reporter name, site
  // name, assignee, and the status label — address is not included. This pins
  // the implementation's actual behavior.
  it('does not search the address field', () => {
    expect(searchReports([pipe, light], 'main street', siteName)).toEqual([]);
  });
});
