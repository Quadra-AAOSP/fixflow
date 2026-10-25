import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Mic, Send, Sparkles, Square, Wand2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/Card';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { dashboardColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { ApiError } from '@/lib/apiClient';
import {
  askTriage,
  canSendTriageTurn,
} from '@/services/triage';
import type { AssistantTurn, TriageSuggestedFields } from '@/types';
import { humanize } from '@/utils/format';
import { urgencyLabels } from '@/utils/maintenance';

type TriageChatProps = {
  visible: boolean;
  siteId: number;
  onClose: () => void;
  /**
   * Called when the user taps "Use these details". The parent applies the
   * fields only to inputs the reporter has not already filled in, so
   * reporter-entered values are never overwritten silently.
   */
  onApply: (fields: TriageSuggestedFields) => void;
};

type Notice = 'fallback' | 'rate' | 'error' | null;

/**
 * Pre-filing triage assistant. Asks clarifying questions and, once the model
 * is confident, offers a "Use these details" button that pre-fills category,
 * urgency and a description draft on the report form.
 */
export function TriageChat({ visible, siteId, onClose, onApply }: TriageChatProps) {
  const { t } = useTranslation('common');
  const { logout } = useAuth();
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [suggested, setSuggested] = useState<TriageSuggestedFields | null>(null);
  const listRef = useRef<ScrollView>(null);
  const recorder = useAudioRecorder();

  useEffect(() => {
    // Reset the conversation each time the sheet opens.
    if (visible) {
      setTurns([]);
      setInput('');
      setSuggested(null);
      setNotice(null);
    }
  }, [visible]);

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [turns, sending, notice, suggested]);

  async function ask(history: AssistantTurn[]) {
    setSending(true);
    setNotice(null);
    try {
      const reply = await askTriage(siteId, history);
      setTurns([...history, { role: 'assistant', content: reply.reply }]);
      setSuggested(reply.suggestedFields);
      if (reply.fallback) setNotice('fallback');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await logout().catch(() => {});
        return;
      }
      setNotice(err instanceof ApiError && err.status === 429 ? 'rate' : 'error');
    } finally {
      setSending(false);
    }
  }

  function onSend() {
    const trimmed = input.trim();
    if (!canSendTriageTurn(turns, trimmed) || sending) return;
    const history = [...turns, { role: 'user' as const, content: trimmed }];
    setTurns(history);
    setInput('');
    void ask(history);
  }

  function onRetry() {
    if (sending || turns.length === 0) return;
    void ask(turns);
  }

  async function onMic() {
    if (recorder.isRecording) {
      const text = await recorder.stop();
      if (text) setInput((prev) => (prev ? `${prev} ${text}` : text));
    } else {
      const ok = await recorder.start();
      if (!ok && !recorder.error) {
        // permission denied handled inside the hook via error state
      }
    }
  }

  const disabled = !canSendTriageTurn(turns, input);

  return (
    <ModalSheet
      visible={visible}
      title={t('reports.new.triage.title')}
      onClose={onClose}
      busy={sending}
    >
      <View className="flex-row items-center gap-2">
        <View
          className="rounded-full p-1.5"
          style={{ backgroundColor: dashboardColors.statMintSoft }}
        >
          <Sparkles color={dashboardColors.statMintDeep} size={13} />
        </View>
        <Text className="text-[12px] leading-[1.7] text-dashboard-subtitle">
          {t('reports.new.triage.intro')}
        </Text>
      </View>

      <ScrollView
        ref={listRef}
        className="mt-3"
        showsVerticalScrollIndicator={false}
        style={{ maxHeight: 360 }}
      >
        {turns.length === 0 && notice === null ? (
          <Text className="text-[12px] leading-[1.7] text-dashboard-subtitle">
            {t('reports.new.triage.empty')}
          </Text>
        ) : null}
        {turns.map((turn, index) => (
          <View
            key={index}
            className={`mb-2 max-w-[85%] rounded-[11px] px-3 py-2 ${
              turn.role === 'user' ? 'self-end' : 'self-start'
            }`}
            style={
              turn.role === 'user'
                ? { backgroundColor: dashboardColors.teal }
                : { backgroundColor: dashboardColors.statMintSoft }
            }
          >
            <Text
              className={`text-[12px] leading-[1.6] ${
                turn.role === 'user' ? 'text-white' : 'text-ink'
              }`}
            >
              {turn.content}
            </Text>
          </View>
        ))}
        {sending ? (
          <View
            className="mb-2 max-w-[85%] self-start rounded-[11px] px-3 py-2"
            style={{ backgroundColor: dashboardColors.statMintSoft }}
          >
            <Text
              className="text-[12px] italic leading-[1.6]"
              style={{ color: dashboardColors.subtitle }}
            >
              {t('reports.new.triage.typing')}
            </Text>
          </View>
        ) : null}
        {notice !== null ? (
          <View
            className="mb-2 self-start rounded-[11px] px-3 py-2"
            style={{ backgroundColor: dashboardColors.statCitronSoft }}
          >
            <Text
              className="text-[12px] leading-[1.6]"
              style={{ color: dashboardColors.statCitronDeep }}
            >
              {notice === 'rate'
                ? t('reports.new.triage.tooMany')
                : t('reports.new.triage.fallback')}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {suggested ? (
        <Card className="mb-3" style={{ borderColor: dashboardColors.statMintDeep }}>
          <View className="flex-row items-center gap-1.5">
            <Wand2 color={dashboardColors.statMintDeep} size={13} />
            <Text
              className="text-[12px] font-semibold"
              style={{ color: dashboardColors.statMintDeep }}
            >
              {t('reports.new.triage.suggested.title')}
            </Text>
          </View>
          {suggested.category ? (
            <Text className="mt-1.5 text-[12px] text-ink">
              {t('reports.new.triage.suggested.category')}: {humanize(suggested.category)}
            </Text>
          ) : null}
          {suggested.urgency ? (
            <Text className="text-[12px] text-ink">
              {t('reports.new.triage.suggested.urgency')}: {t(urgencyLabels[suggested.urgency])}
            </Text>
          ) : null}
          {suggested.descriptionDraft ? (
            <Text className="mt-1 text-[12px] leading-[1.6] text-ink">
              {suggested.descriptionDraft}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('reports.new.triage.suggested.use')}
            onPress={() => {
              onApply(suggested);
              onClose();
            }}
            className="mt-3 flex-row items-center justify-center gap-1.5 rounded-[9px] px-3 py-2 active:opacity-80"
            style={{ backgroundColor: dashboardColors.ctaBg }}
          >
            <Text
              className="text-[12px] font-semibold"
              style={{ color: dashboardColors.ctaText }}
            >
              {t('reports.new.triage.suggested.use')}
            </Text>
          </Pressable>
        </Card>
      ) : null}

      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            recorder.isRecording
              ? t('reports.new.triage.voice.stop')
              : t('reports.new.triage.voice.start')
          }
          onPress={onMic}
          className="h-10 w-10 items-center justify-center rounded-full active:opacity-80"
          style={{
            backgroundColor: recorder.isRecording
              ? dashboardColors.statCoralSoft
              : dashboardColors.cardLine,
          }}
        >
          {recorder.isRecording ? (
            <Square color={dashboardColors.statCoralDeep} size={14} fill={dashboardColors.statCoralDeep} />
          ) : (
            <Mic
              color={recorder.transcribing ? dashboardColors.subtitle : dashboardColors.teal}
              size={16}
            />
          )}
        </Pressable>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={t('reports.new.triage.placeholder')}
          placeholderTextColor={dashboardColors.subtitle}
          multiline
          editable={!sending}
          maxLength={2000}
          accessibilityLabel={t('reports.new.triage.title')}
          className="min-h-[40px] flex-1 rounded-[11px] border border-border px-3 py-2 text-[12px] text-ink"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('reports.new.triage.send')}
          disabled={disabled || sending}
          onPress={onSend}
          className="h-10 w-10 items-center justify-center rounded-full active:opacity-80"
          style={{
            backgroundColor:
              disabled || sending ? dashboardColors.cardLine : dashboardColors.teal,
          }}
        >
          <Send
            color={
              disabled || sending
                ? dashboardColors.subtitle
                : 'rgb(255, 255, 255)'
            }
            size={16}
          />
        </Pressable>
      </View>

      {recorder.error ? (
        <Text className="mt-2 text-[11px] leading-[1.6] text-tone-danger">
          {recorder.error}
        </Text>
      ) : null}
      {recorder.transcribing ? (
        <Text className="mt-1 text-[11px] italic text-dashboard-subtitle">
          {t('reports.new.triage.voice.transcribing')}
        </Text>
      ) : null}

      <Text className="mt-2 text-[10px] leading-[1.6] text-dashboard-subtitle">
        {t('reports.new.triage.disclaimer')}
      </Text>
    </ModalSheet>
  );
}
