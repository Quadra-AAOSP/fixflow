import type { Report, ReportStatus } from '@/types/maintenance';

// Labels and state groups mirror the backend's ReportStatus and Urgency contract.
export const statusLabels: Record<ReportStatus, string> = {
  open: 'Open', routed: 'Routed', assigned: 'Assigned', in_progress: 'In progress',
  resolved_pending_confirmation: 'Awaiting confirmation', confirmed: 'Confirmed', reopened: 'Reopened', escalated: 'Escalated',
};
export const urgencyLabels = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' } as const;
export type StatusGroup = 'open' | 'progress' | 'resolved';
export type ReportFilter = 'all' | StatusGroup | 'urgent';
export function statusGroup(status: ReportStatus): StatusGroup {
  if (status === 'confirmed' || status === 'resolved_pending_confirmation') return 'resolved';
  if (status === 'assigned' || status === 'in_progress') return 'progress';
  return 'open';
}
export const statusTone = (status: ReportStatus) => ({ open: 'coral', progress: 'mint', resolved: 'citron' })[statusGroup(status)];
export const effectiveUrgency = (report: Report) => report.finalUrgency ?? report.reporterUrgency;
export const isUrgent = (report: Report) => statusGroup(report.status) !== 'resolved' && ['high', 'critical'].includes(effectiveUrgency(report));
export function matchesFilter(report: Report, filter: ReportFilter) {
  return filter === 'all' || (filter === 'urgent' ? isUrgent(report) : statusGroup(report.status) === filter);
}
export function searchReports(reports: Report[], query: string, siteName: (id: number | null) => string, filter: ReportFilter = 'all') {
  const needle = query.trim().toLocaleLowerCase();
  return reports.filter(report => matchesFilter(report, filter) && [report.id, report.description, report.category, report.createdByName, siteName(report.siteId), report.assignedTechnicianId, statusLabels[report.status]].filter(value => value != null).join(' ').toLocaleLowerCase().includes(needle));
}
export function summarize(reports: Report[]) {
  return { open: reports.filter(report => statusGroup(report.status) === 'open').length,
    progress: reports.filter(report => statusGroup(report.status) === 'progress').length,
    resolved: reports.filter(report => statusGroup(report.status) === 'resolved').length,
    urgent: reports.filter(isUrgent).length };
}
export function weeklyChart(reports: Report[], weekOffset: number, now = new Date()) {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7 + weekOffset * 7);
  return Array.from({ length: 7 }, (_, index) => {
    const start = new Date(monday); start.setDate(start.getDate() + index);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const counts = summarize(reports.filter(report => new Date(report.createdAt) >= start && new Date(report.createdAt) < end));
    return { date: start, label: start.toLocaleDateString(undefined, { weekday: 'short' }), values: [counts.open, counts.progress, counts.resolved] };
  });
}
export function formatDate(value: string | null | undefined, includeTime = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Not available';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', ...(includeTime ? { timeStyle: 'short' as const } : {}) }).format(new Date(value));
}
export const humanize = (value: string) => value.replaceAll('_', ' ').replace(/^./, char => char.toUpperCase());
export const initials = (name: string) => name.trim().split(/\s+/).map(part => part.charAt(0)).slice(0, 2).join('').toUpperCase();
