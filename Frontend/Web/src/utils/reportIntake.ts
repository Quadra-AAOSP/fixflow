import type { CreateReportPayload } from '@/types/maintenance';

/** Mirror CreateReportRequest for both JSON and multipart web submission. */
export function reportIntakePayload(input: CreateReportPayload): CreateReportPayload {
  const payload = { ...input, description: input.description.trim(), category: input.category.trim(),
    address: input.address?.trim() || undefined, specialty: input.specialty?.trim() || undefined,
    reporterReason: input.reporterReason?.trim() || undefined };
  if (!payload.description || payload.description.length > 10000 || !payload.category || payload.category.length > 128 ||
      (payload.address?.length ?? 0) > 512 || (payload.specialty?.length ?? 0) > 128 || (payload.reporterReason?.length ?? 0) > 2000) {
    throw new Error('Check the report field lengths and complete the required description and category.');
  }
  if (!Number.isSafeInteger(payload.siteId) || payload.siteId <= 0 ||
      payload.subsiteId != null && (!Number.isSafeInteger(payload.subsiteId) || payload.subsiteId <= 0) ||
      !['low', 'medium', 'high', 'critical'].includes(payload.reporterUrgency) ||
      payload.visibility != null && !['public', 'private'].includes(payload.visibility)) {
    throw new Error('Choose a valid site, building, urgency and visibility.');
  }
  return payload;
}
