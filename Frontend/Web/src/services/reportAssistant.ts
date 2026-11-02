import { request } from './api';
export interface AssistantTurn { role: 'user' | 'assistant'; content: string }
export interface AssistantReply { reply: string | null; fallback: boolean }
export async function askReportAssistant(reportId: number, messages: AssistantTurn[]) {
  if (!Number.isSafeInteger(reportId) || reportId <= 0) throw new Error('Choose a valid report.');
  if (!messages.length || messages.length > 20 || messages.at(-1)?.role !== 'user' ||
      messages.some(turn => !['user', 'assistant'].includes(turn.role) || !turn.content.trim() || turn.content.length > 2000)) {
    throw new Error('Enter a question of up to 2,000 characters.');
  }
  const result = await request<AssistantReply>(`/api/reports/${reportId}/assistant`, {
    method: 'POST', body: JSON.stringify({ messages }),
  });
  if (typeof result?.fallback !== 'boolean' || (!result.fallback && (typeof result.reply !== 'string' || !result.reply.trim()))) {
    throw new Error('The assistant response is incomplete. Please try again.');
  }
  return result;
}
