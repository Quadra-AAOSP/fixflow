import type { ReportStatus } from './report';
import type { Urgency } from './common';

/**
 * A single turn in a stateless AI conversation. The server injects the
 * system message; the client only ever sends `user`/`assistant` turns.
 */
export type AssistantRole = 'user' | 'assistant';

export interface AssistantTurn {
  role: AssistantRole;
  content: string;
}

/** `POST /api/assistant/triage` response. */
export interface TriageSuggestedFields {
  category?: string | null;
  urgency?: Urgency | null;
  descriptionDraft?: string | null;
}

export interface TriageReply {
  reply: string;
  /** True when the AI provider was unavailable — show the localized retry bubble. */
  fallback: boolean;
  /** Null when the model is not yet confident enough to pre-fill the form. */
  suggestedFields: TriageSuggestedFields | null;
}

/** `POST /api/reports/search/nl` response. Every filter field is optional. */
export interface NlSearchFilters {
  status?: ReportStatus | null;
  category?: string | null;
  urgency?: Urgency | null;
  from?: string | null;
  to?: string | null;
  text?: string | null;
}

export interface NlSearchResult {
  rawQuery: string;
  filters: NlSearchFilters;
  interpretation: string | null;
}

/** `POST /api/assistant/transcribe` response. */
export interface TranscribeResult {
  text: string;
}
