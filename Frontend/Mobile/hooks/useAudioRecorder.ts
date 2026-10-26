import { useCallback, useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/lib/apiClient';
import { MAX_AUDIO_BYTES, transcribeAudio } from '@/services/transcribe';

type RecorderState = {
  isRecording: boolean;
  transcribing: boolean;
  error: string | null;
  /** Begin recording; returns false if permission was denied. */
  start: () => Promise<boolean>;
  /** Stop recording and transcribe; returns the transcribed text or null. */
  stop: () => Promise<string | null>;
};

/**
 * Records a short audio clip and transcribes it server-side. The audio file
 * never leaves the device as anything but an upload to the backend's
 * `/api/assistant/transcribe` endpoint — the API key is never on the device.
 */
export function useAudioRecorder(): RecorderState {
  const { t } = useTranslation('common');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  recordingRef.current = recording;

  useEffect(() => {
    return () => {
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    setError(null);
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      setError(t('voice.permissionDenied'));
      return false;
    }
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec);
      setIsRecording(true);
      await rec.startAsync();
      return true;
    } catch {
      setError(t('voice.failed'));
      return false;
    }
  }, [t]);

  const stop = useCallback(async (): Promise<string | null> => {
    const rec = recordingRef.current;
    setIsRecording(false);
    if (!rec) return null;
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      setRecording(null);
      if (!uri) return null;
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists && info.size != null && info.size > MAX_AUDIO_BYTES) {
        setError(t('voice.tooLarge'));
        return null;
      }
      const ext = (uri.split('.').pop() ?? 'm4a').toLowerCase();
      const mime =
        ext === 'mp3'
          ? 'audio/mpeg'
          : ext === 'wav'
            ? 'audio/wav'
            : ext === 'webm'
              ? 'audio/webm'
              : 'audio/mp4';
      setTranscribing(true);
      const result = await transcribeAudio(uri, `recording.${ext}`, mime);
      return result.text;
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        setError(t('voice.unavailable'));
      } else if (err instanceof ApiError && err.status === 413) {
        setError(t('voice.tooLarge'));
      } else {
        setError(t('voice.failed'));
      }
      return null;
    } finally {
      setTranscribing(false);
    }
  }, [t]);

  return { isRecording, transcribing, error, start, stop };
}
