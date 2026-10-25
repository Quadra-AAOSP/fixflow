import { api } from '@/lib/apiClient';
import { endpoints } from '@/lib/endpoints';
import type {
  AssistantTurn,
  TriageReply,
} from '@/types';

const MAX_TURNS = 20;
const MAX_TURN_CHARS = 2000;

/** Client-side mirror of the backend caps (`ReportAssistantService`). */
export function canSendTriageTurn(turns: AssistantTurn[], next: string): boolean {
  return (
    turns.length < MAX_TURNS && next.trim().length > 0 && next.length <= MAX_TURN_CHARS
  );
}

/**
 * Pre-filing triage chat. The server uses the site's taxonomy to validate
 * `suggestedFields`; unknown categories/urgencies are dropped server-side,
 * so the caller only ever sees values that match the site's rules.
 */
export function askTriage(
  siteId: number,
  messages: AssistantTurn[],
): Promise<TriageReply> {
  return api.post<TriageReply>(endpoints.assistant.triage, { siteId, messages });
}
