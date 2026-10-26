import i18n from '@/constants/i18n';
import type { NlSearchFilters, Report, ReportStatus, Urgency } from '@/types';

import { weekdayLabel } from './format';

/**
 * Labels and state groupings mirror the backend `ReportStatus` / `Urgency`
 * contract. Screens must not invent their own wording — this is the single
 * source of user-facing status text. The values are i18n keys resolved with
 * `t` at render time (or `i18n.t` in this non-component module).
 */
export const statusLabels: Record<ReportStatus, string> = {
  open: 'labels.status.open',
  routed: 'labels.status.routed',
  assigned: 'labels.status.assigned',
  in_progress: 'labels.status.in_progress',
  resolved_pending_confirmation: 'labels.status.resolved_pending_confirmation',
  confirmed: 'labels.status.confirmed',
  reopened: 'labels.status.reopened',
  escalated: 'labels.status.escalated',
};

export const urgencyLabels: Record<Urgency, string> = {
  low: 'labels.urgency.low',
  medium: 'labels.urgency.medium',
  high: 'labels.urgency.high',
  critical: 'labels.urgency.critical',
};

/**
 * The eight backend statuses collapse into three buckets for dashboards and
 * filters, so counts stay meaningful instead of fragmenting across states
 * the user does not distinguish.
 */
export type StatusGroup = 'open' | 'progress' | 'resolved';

export type ReportFilter = 'all' | StatusGroup | 'urgent' | 'confirmation' | 'unassigned';

export const REPORT_FILTERS: { value: ReportFilter; labelKey: string }[] = [
  { value: 'all', labelKey: 'labels.filter.all' },
  { value: 'open', labelKey: 'labels.filter.open' },
  { value: 'progress', labelKey: 'labels.filter.progress' },
  { value: 'resolved', labelKey: 'labels.filter.resolved' },
  { value: 'urgent', labelKey: 'labels.filter.urgent' },
  { value: 'confirmation', labelKey: 'labels.filter.confirmation' },
  { value: 'unassigned', labelKey: 'labels.filter.unassigned' },
];

export const groupLabels: Record<StatusGroup, string> = {
  open: 'labels.group.open',
  progress: 'labels.group.progress',
  resolved: 'labels.group.resolved',
};

export function statusGroup(status: ReportStatus): StatusGroup {
  if (status === 'confirmed' || status === 'resolved_pending_confirmation') {
    return 'resolved';
  }
  if (status === 'assigned' || status === 'in_progress') return 'progress';
  return 'open';
}

/**
 * Design-token name for a status bucket. Components map these to bg/text
 * classes so the palette stays in `global.css` rather than in logic.
 */
export const statusTone = (status: ReportStatus): 'primary' | 'accent' | 'lime' =>
  ({ open: 'primary', progress: 'accent', resolved: 'lime' })[
    statusGroup(status)
  ] as 'primary' | 'accent' | 'lime';

/**
 * The urgency the user should act on: the server's adjudicated value when
 * present, otherwise the reporter's own declaration.
 */
export const effectiveUrgency = (report: Report): Urgency =>
  report.policy.effectiveUrgency;

/** Urgent means high/critical *and* not already resolved. */
export const isUrgent = (report: Report): boolean => report.policy.urgent;

export function matchesFilter(report: Report, filter: ReportFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'urgent') return isUrgent(report);
  if (filter === 'confirmation') return report.status === 'resolved_pending_confirmation';
  if (filter === 'unassigned') {
    return report.policy.statusGroup !== 'resolved' && report.assignedTechnicianId === null;
  }
  return report.policy.statusGroup === filter;
}

/**
 * Matches a report against the structured filters produced by the NL search
 * endpoint. Every field is optional; only present filters narrow the set.
 */
export function matchesNlFilters(report: Report, nl: NlSearchFilters | null): boolean {
  if (!nl) return true;
  if (nl.status && report.status !== nl.status) return false;
  if (nl.category && report.category !== nl.category) return false;
  if (nl.urgency && effectiveUrgency(report) !== nl.urgency) return false;
  const created = report.createdAt ? Date.parse(report.createdAt) : NaN;
  if (nl.from && !Number.isNaN(created) && created < Date.parse(nl.from)) return false;
  if (nl.to && !Number.isNaN(created) && created > Date.parse(nl.to) + 86_400_000 - 1) {
    return false;
  }
  return true;
}

/**
 * Free-text search across the fields a user can actually see. Server-masked
 * fields arrive as `null` and are filtered out rather than matched as the
 * string "null".
 */
export function searchReports(
  reports: Report[],
  query: string,
  siteName: (id: number | null) => string,
  filter: ReportFilter = 'all',
  nlFilters: NlSearchFilters | null = null,
): Report[] {
  const needle = query.trim().toLocaleLowerCase();
  return reports.filter((report) => {
    if (!matchesFilter(report, filter)) return false;
    if (!matchesNlFilters(report, nlFilters)) return false;
    if (!needle) return true;
    const haystack = [
      report.id,
      report.description,
      report.category,
      report.createdByName,
      siteName(report.siteId),
      report.assignedTechnicianId,
      i18n.t(statusLabels[report.status]),
    ]
      .filter((value) => value !== null && value !== undefined)
      .join(' ')
      .toLocaleLowerCase();
    return haystack.includes(needle);
  });
}

export type ReportSummary = {
  open: number;
  progress: number;
  resolved: number;
  urgent: number;
};

export function summarize(reports: Report[]): ReportSummary {
  let open = 0;
  let progress = 0;
  let resolved = 0;
  let urgent = 0;

  for (const report of reports) {
    const group = report.policy.statusGroup;
    if (group === 'open') open += 1;
    else if (group === 'progress') progress += 1;
    else resolved += 1;
    if (isUrgent(report)) urgent += 1;
  }

  return { open, progress, resolved, urgent };
}

export type WeekBucket = {
  date: Date;
  label: string;
  /** `[open, progress, resolved]`, matching `StatusGroup` order. */
  values: [number, number, number];
};

/**
 * Monday-start week buckets for the dashboard chart. `weekOffset` is 0 for
 * the current week and -1 for the previous one.
 */
export function weeklyChart(
  reports: Report[],
  weekOffset: number,
  now: Date = new Date(),
): WeekBucket[] {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + weekOffset * 7);

  return Array.from({ length: 7 }, (_, index) => {
    const start = new Date(monday);
    start.setDate(start.getDate() + index);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const inDay = reports.filter((report) => {
      const created = new Date(report.createdAt);
      return created >= start && created < end;
    });
    const counts = summarize(inDay);

    return {
      date: start,
      label: weekdayLabel(start),
      values: [counts.open, counts.progress, counts.resolved] as [
        number,
        number,
        number,
      ],
    };
  });
}
