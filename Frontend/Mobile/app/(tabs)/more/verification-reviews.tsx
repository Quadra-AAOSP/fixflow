import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import {
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  RefreshCw,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { dashboardColors } from '@/constants/theme';
import { relativeTime } from '@/utils/format';
import { useAuth } from '@/hooks/useAuth';
import {
  listVerifications,
  decideVerification,
  verificationHistory,
  type Verification,
  type Audit,
} from '@/services/onboarding';

const CHECKS = ['identityChecked', 'emailChecked', 'phoneChecked', 'tradeChecked'] as const;

/** Decision buttons offered per current status — mirrors the backend's
 *  `TechnicianVerificationController.decide` transition rules. */
function nextStatuses(status: string): string[] {
  if (status === 'pending') return ['verified', 'rejected'];
  if (status === 'verified') return ['suspended'];
  if (status === 'suspended' || status === 'rejected') return ['pending'];
  return [];
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'rgb(254, 243, 199)', text: 'rgb(146, 64, 14)' },
  verified: { bg: dashboardColors.statMintSoft, text: dashboardColors.statMintDeep },
  rejected: { bg: 'rgb(254, 226, 226)', text: 'rgb(185, 28, 28)' },
  suspended: { bg: 'rgb(229, 231, 235)', text: 'rgb(55, 65, 81)' },
  unverified: { bg: 'rgb(229, 231, 235)', text: 'rgb(55, 65, 81)' },
};

function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation('common');
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.unverified;
  return (
    <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: style.bg }}>
      <Text
        className="text-[10px] font-semibold uppercase"
        style={{ color: style.text, letterSpacing: 0.6 }}
      >
        {t(`review.statuses.${status}`, { defaultValue: status })}
      </Text>
    </View>
  );
}

/** One timeline entry — the audit row with the snapshot parsed into a
 *  readable summary instead of the raw JSON blob. */
function HistoryEntry({ entry, isLast }: { entry: Audit; isLast: boolean }) {
  const { t } = useTranslation('common');
  let snapshot: Record<string, unknown> = {};
  try {
    snapshot = JSON.parse(entry.snapshot) as Record<string, unknown>;
  } catch {
    // Legacy rows may not be valid JSON — fall back to showing the status only.
  }
  const status = typeof snapshot.status === 'string' ? snapshot.status : '';
  const reason = typeof snapshot.reason === 'string' ? snapshot.reason : '';
  const actorId = typeof snapshot.reviewedBy === 'string' || typeof snapshot.reviewedBy === 'number'
    ? snapshot.reviewedBy
    : null;
  const dot = STATUS_STYLES[status]?.text ?? dashboardColors.statMintDeep;
  return (
    <View className="flex-row gap-3">
      <View className="items-center">
        <View className="mt-1.5 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dot }} />
        {!isLast ? <View className="mt-1 w-0.5 flex-1 bg-dashboard-card-line" /> : null}
      </View>
      <View className="flex-1 pb-4">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="text-[12.5px] font-semibold text-ink">
            {status ? t(`review.statuses.${status}`, { defaultValue: status }) : '—'}
          </Text>
          <Text className="text-[10.5px] text-dashboard-caption">
            {relativeTime(entry.createdAt)}
          </Text>
        </View>
        <Text className="mt-0.5 text-[10.5px] text-dashboard-caption">
          {new Date(entry.createdAt).toLocaleString()}
        </Text>
        {reason ? (
          <Text className="mt-1.5 text-[11.5px] leading-[1.6] text-dashboard-subtitle">
            {reason}
          </Text>
        ) : null}
        {actorId !== null ? (
          <Text className="mt-1 text-[10.5px] text-dashboard-caption">
            {t('review.actor')}: #{actorId}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Collapsible audit trail for one technician. Fetched on first expand. */
function HistorySection({
  technicianId,
  entries,
  loading,
  onToggle,
}: {
  technicianId: number;
  entries: Audit[] | undefined;
  loading: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation('common');
  const expanded = entries !== undefined || loading;
  return (
    <View className="mt-3 rounded-xl border border-dashboard-card-line bg-dashboard-banner-bg p-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(expanded ? 'review.hideHistory' : 'review.history')}
        onPress={onToggle}
        className="flex-row items-center justify-between active:opacity-70"
      >
        <View className="flex-row items-center gap-2">
          <BadgeCheck color={dashboardColors.statMintDeep} size={15} />
          <Text className="text-[12px] font-semibold text-ink">
            {t(expanded ? 'review.hideHistory' : 'review.history')}
          </Text>
        </View>
        {expanded ? (
          <ChevronUp color={dashboardColors.statMintDeep} size={15} />
        ) : (
          <ChevronDown color={dashboardColors.statMintDeep} size={15} />
        )}
      </Pressable>
      {loading ? (
        <Text className="mt-3 text-[11px] text-dashboard-caption">{t('review.loading')}</Text>
      ) : null}
      {entries !== undefined ? (
        entries.length === 0 ? (
          <Text className="mt-3 text-[11px] text-dashboard-caption">
            {t('review.historyEmpty')}
          </Text>
        ) : (
          <View className="mt-3">
            {entries.map((entry, index) => (
              <HistoryEntry
                key={entry.id}
                entry={entry}
                isLast={index === entries.length - 1}
              />
            ))}
          </View>
        )
      ) : null}
    </View>
  );
}

function ReviewCard({
  verification,
  reason,
  history,
  historyLoading,
  busy,
  onReasonChange,
  onCheckChange,
  onDecide,
  onToggleHistory,
}: {
  verification: Verification;
  reason: string;
  history: Audit[] | undefined;
  historyLoading: boolean;
  busy: boolean;
  onReasonChange: (value: string) => void;
  onCheckChange: (key: (typeof CHECKS)[number], value: boolean) => void;
  onDecide: (status: string) => void;
  onToggleHistory: () => void;
}) {
  const { t } = useTranslation('common');
  const details: { label: string; value: string }[] = [
    { label: t('review.trades'), value: verification.trades },
    { label: t('review.experience'), value: verification.experience },
    { label: t('review.qualifications'), value: verification.qualifications },
  ];
  const decisions = nextStatuses(verification.status);
  return (
    <Card className="mb-4">
      {/* Header — technician + current status. */}
      <View className="mb-3 flex-row items-center justify-between gap-2">
        <View className="flex-row items-center gap-2">
          <Text className="text-[15px] font-bold text-ink" style={{ letterSpacing: -0.2 }}>
            #{verification.technicianId}
          </Text>
          <StatusPill status={verification.status} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('review.refresh')}
          disabled={busy}
          onPress={onToggleHistory}
          className="h-8 w-8 items-center justify-center rounded-full active:opacity-70"
          style={{ backgroundColor: dashboardColors.statMintSoft }}
        >
          <RefreshCw color={dashboardColors.statMintDeep} size={14} />
        </Pressable>
      </View>

      {/* Contact rows. */}
      <View className="mb-3 gap-1.5">
        <View className="flex-row items-center gap-2">
          <Mail color={dashboardColors.statMintDeep} size={13} />
          <Text className="flex-1 text-[12px] text-ink" numberOfLines={1}>
            {verification.email}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Phone color={dashboardColors.statMintDeep} size={13} />
          <Text className="flex-1 text-[12px] text-ink">{verification.phone}</Text>
        </View>
      </View>

      {/* Submission details. */}
      <View className="mb-3 rounded-xl border border-dashboard-card-line p-3">
        {details.map((detail, index) => (
          <View key={detail.label} className={index > 0 ? 'mt-2.5' : ''}>
            <Text className="text-[10px] font-semibold uppercase text-dashboard-caption" style={{ letterSpacing: 0.6 }}>
              {detail.label}
            </Text>
            <Text className="mt-0.5 text-[11.5px] leading-[1.6] text-ink">{detail.value}</Text>
          </View>
        ))}
      </View>

      {/* Manual review checks. */}
      <View className="mb-3 rounded-xl border border-dashboard-card-line p-1">
        {CHECKS.map((key, index) => (
          <View
            key={key}
            className={`flex-row items-center justify-between px-2 py-2.5 ${index > 0 ? 'border-t border-dashboard-card-line' : ''}`}
          >
            <Text className="text-[12px] text-ink">{t(`review.${key}`)}</Text>
            <Switch
              accessibilityLabel={t(`review.${key}`)}
              value={verification[key]}
              onValueChange={value => onCheckChange(key, value)}
            />
          </View>
        ))}
      </View>

      <TextField
        label={t('review.reason')}
        value={reason}
        onChangeText={onReasonChange}
        maxLength={2000}
        multiline
        className="mb-3"
      />

      {/* Decisions — approve is the primary CTA, the rest outlined. */}
      {decisions.length > 0 ? (
        <View className="mb-1 flex-row gap-2">
          {decisions.map(status => {
            const checksOk = CHECKS.every(key => verification[key]);
            const blocked =
              busy || !reason.trim() || (status === 'verified' && !checksOk);
            return (
              <View key={status} className="flex-1">
                <Button
                  variant={status === 'verified' ? 'cta' : 'secondary'}
                  className="min-h-0 py-2"
                  label={t(
                    status === 'verified'
                      ? 'review.verified'
                      : status === 'rejected'
                        ? 'review.rejected'
                        : status === 'suspended'
                          ? 'review.suspended'
                          : 'review.pending',
                  )}
                  disabled={blocked}
                  onPress={() => onDecide(status)}
                />
              </View>
            );
          })}
        </View>
      ) : null}

      <HistorySection
        technicianId={verification.technicianId}
        entries={history}
        loading={historyLoading}
        onToggle={onToggleHistory}
      />
    </Card>
  );
}

export default function VerificationReviews() {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const [items, setItems] = useState<Verification[]>([]);
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [history, setHistory] = useState<Record<number, Audit[] | undefined>>({});
  const [historyLoading, setHistoryLoading] = useState<Record<number, boolean>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('review.error'));
    } finally {
      setBusy(false);
    }
  }

  async function load() {
    setItems(await listVerifications());
  }

  useEffect(() => {
    if (user?.role === 'super_admin') void run(load);
  }, [user?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  function update(id: number, patch: Partial<Verification>) {
    setItems(prev =>
      prev.map(item => (item.technicianId === id ? { ...item, ...patch } : item)),
    );
  }

  /** Expand/collapse the audit trail; fetches on first expand. */
  function toggleHistory(id: number) {
    if (history[id] !== undefined || historyLoading[id]) {
      setHistory(prev => ({ ...prev, [id]: undefined }));
      return;
    }
    setHistoryLoading(prev => ({ ...prev, [id]: true }));
    void verificationHistory(id)
      .then(entries => setHistory(prev => ({ ...prev, [id]: entries })))
      .catch(() => setError(t('review.error')))
      .finally(() =>
        setHistoryLoading(prev => ({ ...prev, [id]: false })),
      );
  }

  if (user?.role !== 'super_admin') {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('review.verificationReviews') }} />
        <View className="p-5">
          <Text className="text-sm text-ink">{t('review.denied')}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t('review.verificationReviews') }} />
      <ScrollView
        contentContainerClassName="p-5 pb-12"
        keyboardShouldPersistTaps="handled"
      >
        {error ? (
          <View className="mb-4 rounded-lg border border-dashboard-card-line bg-dashboard-card-bg p-3">
            <Text accessibilityRole="alert" className="mb-2 text-[11.5px] leading-[1.6] text-tone-danger">
              {error}
            </Text>
            {/terms/i.test(error) ? (
              <Text className="mb-2 text-[11px] leading-[1.6] text-dashboard-subtitle">
                {t('review.termsBlocked')}
              </Text>
            ) : null}
            <Button
              variant="secondary"
              className="min-h-0 py-2"
              label={t('review.retry')}
              onPress={() => void run(load)}
            />
          </View>
        ) : null}

        {items.length === 0 && !error ? (
          <Text className="mt-8 text-center text-[12px] text-dashboard-caption">
            {t('review.historyEmpty')}
          </Text>
        ) : null}

        {items.map(verification => (
          <ReviewCard
            key={verification.technicianId}
            verification={verification}
            reason={reasons[verification.technicianId] ?? ''}
            history={history[verification.technicianId]}
            historyLoading={historyLoading[verification.technicianId] ?? false}
            busy={busy}
            onReasonChange={value =>
              setReasons(prev => ({
                ...prev,
                [verification.technicianId]: value,
              }))
            }
            onCheckChange={(key, value) =>
              update(verification.technicianId, { [key]: value })
            }
            onDecide={status =>
              void run(async () => {
                await decideVerification(verification.technicianId, {
                  status,
                  version: verification.version,
                  reason: reasons[verification.technicianId] ?? '',
                  identityChecked: verification.identityChecked,
                  emailChecked: verification.emailChecked,
                  phoneChecked: verification.phoneChecked,
                  tradeChecked: verification.tradeChecked,
                });
                await load();
              })
            }
            onToggleHistory={() => toggleHistory(verification.technicianId)}
          />
        ))}

        <Button
          variant="secondary"
          label={t('review.refresh')}
          disabled={busy}
          onPress={() => void run(load)}
        />
      </ScrollView>
    </Screen>
  );
}
