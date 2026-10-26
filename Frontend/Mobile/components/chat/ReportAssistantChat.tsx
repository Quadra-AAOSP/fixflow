import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { RotateCcw, Send, Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/Card';
import { dashboardColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import {
  askReportAssistant,
  canSendTurn,
  type AssistantTurn,
} from '@/services/assistant';

type ChatNotice = 'fallback' | 'rate' | 'error' | null;

/**
 * "Ask about this report" chat section on the report detail screen.
 *
 * The conversation lives entirely in component state — the backend is
 * stateless and receives the full history with every request. Only actors
 * with `policy.canSeeSensitive` reach this section (participants, assigned
 * technicians, staff/admin); the backend enforces the same audience.
 */
export function ReportAssistantChat({ reportId }: { reportId: number }) {
  const { t } = useTranslation('common');
  const { logout } = useAuth();
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<ChatNotice>(null);
  const listRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Keep the newest bubble in view as the conversation grows.
    listRef.current?.scrollToEnd({ animated: true });
  }, [turns, sending, notice]);

  async function ask(history: AssistantTurn[]) {
    setSending(true);
    setNotice(null);
    try {
      const reply = await askReportAssistant(reportId, history);
      if (reply.fallback) {
        setNotice('fallback');
      } else {
        setTurns([
          ...history,
          { role: 'assistant', content: reply.reply ?? '' },
        ]);
      }
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
    if (!canSendTurn(turns, trimmed) || sending) {
      return;
    }
    const history = [...turns, { role: 'user' as const, content: trimmed }];
    setTurns(history);
    setInput('');
    void ask(history);
  }

  /** Re-asks with the unchanged history (which ends with the user turn). */
  function onRetry() {
    if (sending || turns.length === 0) {
      return;
    }
    void ask(turns);
  }

  const disabled = !canSendTurn(turns, input);

  return (
    <Card className="mb-4">
      <View className="flex-row items-center gap-2">
        <View
          className="rounded-full p-1.5"
          style={{ backgroundColor: dashboardColors.statMintSoft }}
        >
          <Sparkles color={dashboardColors.statMintDeep} size={13} />
        </View>
        <Text
          className="text-[15px] font-semibold text-ink"
          style={{ letterSpacing: -0.3 }}
        >
          {t('reports.detail.chat.title')}
        </Text>
      </View>

      <ScrollView
        ref={listRef}
        className="mt-3"
        showsVerticalScrollIndicator={false}
        style={{ maxHeight: 320 }}
      >
        {turns.length === 0 && notice === null ? (
          <Text className="text-[12px] leading-[1.7] text-dashboard-subtitle">
            {t('reports.detail.chat.empty')}
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
              {t('reports.detail.chat.typing')}
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
                ? t('reports.detail.chat.tooMany')
                : t('reports.detail.chat.fallback')}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('reports.detail.chat.retry')}
              disabled={sending}
              onPress={onRetry}
              className="mt-1 flex-row items-center gap-1 active:opacity-70"
            >
              <RotateCcw
                color={dashboardColors.statCitronDeep}
                size={11}
              />
              <Text
                className="text-[11px] font-semibold"
                style={{ color: dashboardColors.statCitronDeep }}
              >
                {t('reports.detail.chat.retry')}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <View className="mt-2 flex-row items-center gap-2">
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={t('reports.detail.chat.placeholder')}
          placeholderTextColor={dashboardColors.subtitle}
          multiline
          editable={!sending}
          maxLength={2000}
          accessibilityLabel={t('reports.detail.chat.title')}
          className="min-h-[40px] flex-1 rounded-[11px] border border-border px-3 py-2 text-[12px] text-ink"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('reports.detail.chat.send')}
          disabled={disabled || sending}
          onPress={onSend}
          className="h-10 w-10 items-center justify-center rounded-full active:opacity-80"
          style={{
            backgroundColor:
              disabled || sending
                ? dashboardColors.cardLine
                : dashboardColors.teal,
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

      <Text className="mt-2 text-[10px] leading-[1.6] text-dashboard-subtitle">
        {t('reports.detail.chat.disclaimer')}
      </Text>
    </Card>
  );
}
