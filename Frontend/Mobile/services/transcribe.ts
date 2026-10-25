import { api } from '@/lib/apiClient';
import { endpoints } from '@/lib/endpoints';
import type { TranscribeResult } from '@/types';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB server cap
const SUPPORTED_MIME = ['audio/m4a', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/webm'];

export { MAX_AUDIO_BYTES, SUPPORTED_MIME };

/**
 * Uploads an audio clip for transcription. The backend returns 503 when
 * transcription is not configured (`openrouter.audio.enabled=false`) — the
 * caller should surface that as a "voice unavailable" state.
 */
export function transcribeAudio(
  fileUri: string,
  filename: string,
  mimeType: string,
): Promise<TranscribeResult> {
  const form = new FormData();
  // React Native FormData expects `uri`, `type`, `name` on the file blob.
  // We use any because React Native's FormData typing differs from the web
  // (mirrors services/photos.ts).
  const fileBlob: any = {
    uri: fileUri,
    name: filename,
    type: mimeType,
  };
  form.append('audio', fileBlob);
  return api.post<TranscribeResult>(endpoints.assistant.transcribe, undefined, {
    body: form,
  });
}
