import { describe, expect, it } from 'vitest';

import type { Report, ReportStatus } from '../types';
import {
  canEditReport,
  canReporterConfirm,
  canReporterReopen,
  canTechnicianResolve,
  canTechnicianStart,
  isAssignedToMe,
} from '../utils/reportActions';

const TECHNICIAN_ID = 9;

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
    editable: true,
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

const assignedToTech = (status: ReportStatus) =>
  makeReport({ status, assignedTechnicianId: TECHNICIAN_ID });

describe('technician two-step resolution', () => {
  it('only recognises the assigned technician', () => {
    expect(isAssignedToMe(assignedToTech('assigned'), TECHNICIAN_ID)).toBe(true);
    expect(isAssignedToMe(assignedToTech('assigned'), null)).toBe(false);
    expect(isAssignedToMe(assignedToTech('assigned'), 12)).toBe(false);
  });

  it('allows start from assigned, reopened and escalated only', () => {
    expect(canTechnicianStart(assignedToTech('assigned'), TECHNICIAN_ID)).toBe(true);
    expect(canTechnicianStart(assignedToTech('reopened'), TECHNICIAN_ID)).toBe(true);
    expect(canTechnicianStart(assignedToTech('escalated'), TECHNICIAN_ID)).toBe(true);
    expect(canTechnicianStart(assignedToTech('open'), TECHNICIAN_ID)).toBe(false);
    expect(canTechnicianStart(assignedToTech('in_progress'), TECHNICIAN_ID)).toBe(false);
    expect(
      canTechnicianStart(assignedToTech('resolved_pending_confirmation'), TECHNICIAN_ID),
    ).toBe(false);
  });

  it('allows resolve only while work is in progress', () => {
    expect(canTechnicianResolve(assignedToTech('in_progress'), TECHNICIAN_ID)).toBe(true);
    expect(canTechnicianResolve(assignedToTech('assigned'), TECHNICIAN_ID)).toBe(false);
    expect(canTechnicianResolve(assignedToTech('reopened'), TECHNICIAN_ID)).toBe(false);
    expect(canTechnicianResolve(assignedToTech('in_progress'), 12)).toBe(false);
    expect(canTechnicianResolve(assignedToTech('in_progress'), null)).toBe(false);
  });
});

describe('reporter confirmation', () => {
  it('requires pending-confirmation plus participation', () => {
    const pending = makeReport({
      status: 'resolved_pending_confirmation',
      policy: { participant: true },
    });
    expect(canReporterConfirm(pending)).toBe(true);
    expect(canReporterConfirm({ ...pending, status: 'confirmed' })).toBe(false);
    expect(
      canReporterConfirm(
        makeReport({ status: 'resolved_pending_confirmation', policy: { participant: false } }),
      ),
    ).toBe(false);
  });

  it('lets site operations confirm', () => {
    expect(
      canReporterConfirm(
        makeReport({
          status: 'resolved_pending_confirmation',
          policy: { canAssign: true },
        }),
      ),
    ).toBe(true);
  });

  it('allows reopen from confirmed or pending, never while work is open', () => {
    const base = makeReport({ policy: { participant: true } });
    expect(canReporterReopen({ ...base, status: 'confirmed' })).toBe(true);
    expect(canReporterReopen({ ...base, status: 'resolved_pending_confirmation' })).toBe(true);
    expect(canReporterReopen({ ...base, status: 'open' })).toBe(false);
    expect(
      canReporterReopen(
        makeReport({ status: 'confirmed', policy: { participant: false } }),
      ),
    ).toBe(false);
  });
});

describe('edit gating', () => {
  it('allows the creator while the report is editable and unresolved', () => {
    expect(
      canEditReport(
        makeReport({ policy: { participant: true } }),
        3,
      ),
    ).toBe(true);
  });

  it('rejects joined reporters who are not the creator', () => {
    expect(
      canEditReport(makeReport({ policy: { participant: true } }), 44),
    ).toBe(false);
  });

  it('allows site operations regardless of creator', () => {
    expect(
      canEditReport(makeReport({ policy: { participant: false, canAssign: true } }), 44),
    ).toBe(true);
  });

  it('rejects non-editable or already-started reports', () => {
    expect(canEditReport(makeReport({ editable: false, policy: { canAssign: true } }), 44)).toBe(
      false,
    );
    expect(
      canEditReport(
        makeReport({ status: 'in_progress', policy: { canAssign: true } }),
        44,
      ),
    ).toBe(false);
  });
});
