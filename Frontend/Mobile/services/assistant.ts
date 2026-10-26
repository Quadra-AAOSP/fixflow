import { api } from '@/lib/apiClient';
import { endpoints } from '@/lib/endpoints';

/**
 * Report assistant (AI chat) — server-side contract.
 *
 * The conversation is stateless on the backend: every request sends the
 * full client-side history and the server rebuilds its system prompt from
 * current report data. No conversation is persisted anywhere.
 */
export type AssistantRole = 'user' | 'assistant';

export interface AssistantTurn {
  role: AssistantRole;
  content: string;
}

export interface AssistantReply {
  /** Assistant text; null when the provider failed and `fallback` is set. */
  reply: string | null;
  /** True when the AI provider was unavailable — show the localized retry bubble. */
  fallback: boolean;
}

const MAX_TURNS = 20;
const MAX_TURN_CHARS = 2000;

/** Client-side mirror of the backend caps (`ReportAssistantService`). */
export function canSendTurn(turns: AssistantTurn[], next: string): boolean {
  return (
    turns.length < MAX_TURNS && next.trim().length > 0 && next.length <= MAX_TURN_CHARS
  );
}

export function askReportAssistant(
  reportId: number,
  messages: AssistantTurn[],
): Promise<AssistantReply> {
  return api.post<AssistantReply>(endpoints.reports.assistant(reportId), {
    messages,
  });
}
