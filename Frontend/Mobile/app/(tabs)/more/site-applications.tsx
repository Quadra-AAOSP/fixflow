import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import {
  Building2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Copy,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pill, type PillTone } from '@/components/ui/Pill';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { TextField } from '@/components/ui/TextField';
import { dashboardColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import {
  listSites,
  decideSite,
  issueSetup,
  siteHistory,
  type SiteReview,
  type Audit,
} from '@/services/onboarding';
import { relativeTime } from '@/utils/format';

const STATUS_TONE: Record<string, PillTone> = {
  pending: 'citron',
  approved: 'mint',
  rejected: 'coral',
  information_requested: 'citron',
  request_information: 'citron',
};

/** Compact label/value row with an optional leading glyph. */
function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-start gap-2 py-0.5">
      <Icon color={dashboardColors.statMintDeep} size={12} strokeWidth={1.8} />
      <Text className="w-16 text-[10px] font-semibold uppercase tracking-[0.6px] text-dashboard-caption">
        {label}
      </Text>
      <Text className="flex-1 text-[11.5px] leading-[1.6] text-ink" numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function HistoryEntry({ entry, isLast }: { entry: Audit; isLast: boolean }) {
  const { t } = useTranslation('common');
  let reason = '';
  try {
    const snapshot = JSON.parse(entry.snapshot) as Record<string, unknown>;
    reason = typeof snapshot.reason === 'string' ? snapshot.reason : '';
  } catch {
    // Legacy rows may not be valid JSON — show the action and timestamp only.
  }
  return (
    <View className="flex-row gap-2.5">
      <View className="items-center">
        <View
          className="mt-1.5 h-2 w-2 rounded-full"
          style={{ backgroundColor: dashboardColors.statMintDeep }}
        />
        {!isLast ? (
          <View className="mt-1 w-0.5 flex-1 bg-dashboard-card-line" />
        ) : null}
      </View>
      <View className="flex-1 pb-3">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="text-[11px] font-semibold text-ink">
            {entry.action ?? t('review.history')}
          </Text>
          <Text className="text-[9.5px] text-dashboard-caption">
            {relativeTime(entry.createdAt)}
          </Text>
        </View>
        {reason ? (
          <Text className="mt-0.5 text-[10.5px] leading-[1.6] text-dashboard-subtitle">
            {reason}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Super-admin review of public site-admin applications. Each card carries the
 * site, its contacts, the proposed administrator, and the decision controls
 * that the backend enforces (`/api/admin/site-applications`).
 */
export default function SiteReviews() {
  const { t } = useTranslation('common');
  const { user } = useAuth();

  const [items, setItems] = useState<SiteReview[] | null>(null);
  const [reason, setReason] = useState<Record<number, string>>({});
  const [history, setHistory] = useState<Record<number, Audit[]>>({});
  const [openHistory, setOpenHistory] = useState<Record<number, boolean>>({});
  const [token, setToken] = useState<{
    id: number;
    value: string;
    expires: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('review.error'));
    } finally {
      setBusy(false);
    }
  }

  async function load() {
    setItems(await listSites());
  }

  useEffect(() => {
    if (user?.role === 'super_admin') void run(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  if (user?.role !== 'super_admin') {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('review.siteReviews') }} />
        <StateView
          variant="empty"
          icon={ShieldCheck}
          title={t('review.siteAppsDeniedTitle')}
          description={t('review.denied')}
        />
      </Screen>
    );
  }

  const pendingCount = (items ?? []).filter((item) => item.status === 'pending').length;

  return (
    <Screen>
      <Stack.Screen options={{ title: t('review.siteReviews') }} />
      <ScrollView
        contentContainerClassName="px-5 pb-12 pt-4"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <PageHeader
          kicker={t('review.reviewQueue')}
          title={t('review.siteReviews')}
          subtitle={t('review.siteAppsIntro')}
          icon={Building2}
        >
          <View className="flex-row flex-wrap items-center gap-2">
            <Pill
              tone={pendingCount > 0 ? 'citron' : 'mint'}
              label={t('review.siteAppsPendingCount', { count: pendingCount })}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('review.refresh')}
              disabled={busy}
              onPress={() => void run(load)}
              className="flex-row items-center gap-1.5 rounded-full border border-dashboard-card-line px-2.5 py-1 active:opacity-70"
              style={{ opacity: busy ? 0.5 : 1 }}
            >
              <RefreshCw color={dashboardColors.teal} size={11} />
              <Text className="text-[10px] font-semibold text-dashboard-teal">
                {t('review.refresh')}
              </Text>
            </Pressable>
          </View>
        </PageHeader>

        {error ? (
          <View className="mb-3 rounded-lg bg-dashboard-error-bg px-3 py-2">
            <Text
              accessibilityRole="alert"
              className="text-[11px] leading-[1.7] text-dashboard-error-text"
            >
              {error}
            </Text>
          </View>
        ) : null}

        {items === null ? (
          <StateView variant="loading" title={t('review.loading')} />
        ) : items.length === 0 ? (
          <StateView
            variant="empty"
            icon={ClipboardCheck}
            title={t('review.siteAppsEmptyTitle')}
            description={t('review.siteAppsEmptyDesc')}
            actionLabel={t('review.refresh')}
            onAction={() => void run(load)}
          />
        ) : (
          <View className="gap-3">
            {items.map((application) => {
              const statusTone = STATUS_TONE[application.status] ?? 'neutral';
              const reasonValue = reason[application.id] ?? '';
              const canDecide = reasonValue.trim().length > 0;
              const ownToken = token?.id === application.id;
              const showHistory = openHistory[application.id] ?? false;

              return (
                <Card key={application.id}>
                  {/* Title row */}
                  <View className="flex-row items-start justify-between gap-2">
                    <View className="flex-1">
                      <Text className="text-[15px] font-semibold text-ink" numberOfLines={2}>
                        {application.siteName}
                      </Text>
                      <Text className="mt-0.5 text-[10.5px] text-dashboard-caption">
                        {application.organization} ·{' '}
                        {t(`more.sites.types.${application.siteType}`, {
                          defaultValue: application.siteType,
                        })}
                      </Text>
                    </View>
                    <View className="items-end gap-1">
                      <Pill
                        tone={statusTone}
                        label={t(`review.siteStatus.${application.status}`, {
                          defaultValue: application.status,
                        })}
                      />
                      <Text className="text-[9.5px] text-dashboard-caption">
                        {relativeTime(application.createdAt)}
                      </Text>
                    </View>
                  </View>

                  {/* Site facts */}
                  <View className="mt-2.5 rounded-lg bg-surface px-2.5 py-2">
                    <DetailRow
                      icon={MapPin}
                      label={t('review.addressLabel')}
                      value={application.address}
                    />
                    <DetailRow
                      icon={Mail}
                      label={t('review.email')}
                      value={application.contactEmail}
                    />
                    <DetailRow
                      icon={Phone}
                      label={t('review.phone')}
                      value={application.contactPhone}
                    />
                  </View>

                  {/* Proposed administrator */}
                  <View className="mt-2 flex-row items-center gap-1.5">
                    <UserRound
                      color={dashboardColors.statMintDeep}
                      size={12}
                    />
                    <Text className="text-[10px] font-semibold uppercase tracking-[0.6px] text-dashboard-caption">
                      {t('review.proposedAdmin')}
                    </Text>
                  </View>
                  <Text className="mt-1 text-[12.5px] font-medium text-ink">
                    {application.adminFirstName} {application.adminLastName}
                  </Text>
                  <Text className="text-[10.5px] leading-[1.6] text-dashboard-subtitle">
                    {application.adminEmail} · {application.adminPhone}
                  </Text>

                  <View className="mt-2 flex-row items-center gap-2">
                    <Pill tone="neutral" label={application.relationship} />
                  </View>

                  {application.message ? (
                    <View
                      className="mt-2.5 rounded-lg px-2.5 py-2"
                      style={{ backgroundColor: dashboardColors.statMintSoft }}
                    >
                      <Text className="text-[10.5px] leading-[1.7] text-ink">
                        “{application.message}”
                      </Text>
                    </View>
                  ) : null}

                  {/* Decisions */}
                  {application.status === 'pending' ? (
                    <View className="mt-3 border-t border-dashboard-card-line pt-3">
                      <TextField
                        label={t('review.reason')}
                        value={reasonValue}
                        onChangeText={(value) =>
                          setReason((old) => ({ ...old, [application.id]: value }))
                        }
                        placeholder={t('review.reasonPlaceholder')}
                        multiline
                        editable={!busy}
                        className="mb-2"
                      />
                      {!canDecide ? (
                        <Text className="mb-2 text-[10px] leading-[1.6] text-dashboard-caption">
                          {t('review.reasonRequired')}
                        </Text>
                      ) : null}

                      <Button
                        label={t('review.approve')}
                        loading={busy}
                        disabled={busy || !canDecide}
                        onPress={() =>
                          void run(async () => {
                            await decideSite(application.id, 'approve', reasonValue);
                            await load();
                          })
                        }
                      />
                      <Button
                        className="mt-2"
                        variant="secondary"
                        label={t('review.request_information')}
                        disabled={busy || !canDecide}
                        onPress={() =>
                          void run(async () => {
                            await decideSite(
                              application.id,
                              'request_information',
                              reasonValue,
                            );
                            await load();
                          })
                        }
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ disabled: busy || !canDecide }}
                        disabled={busy || !canDecide}
                        onPress={() =>
                          void run(async () => {
                            await decideSite(application.id, 'reject', reasonValue);
                            await load();
                          })
                        }
                        className="mt-2 flex-row items-center justify-center rounded-[11px] border py-3 active:opacity-80"
                        style={{
                          borderColor: dashboardColors.statCoralDeep,
                          backgroundColor: dashboardColors.statCoralSoft,
                          opacity: busy || !canDecide ? 0.5 : 1,
                        }}
                      >
                        <Text
                          className="text-[13px] font-semibold"
                          style={{ color: dashboardColors.statCoralDeep }}
                        >
                          {t('review.reject')}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {/* Setup handoff */}
                  {application.status === 'approved' ? (
                    <View className="mt-3 border-t border-dashboard-card-line pt-3">
                      <Button
                        label={t('review.issueSetup')}
                        variant="secondary"
                        disabled={busy}
                        onPress={() =>
                          void run(async () => {
                            const issued = await issueSetup(application.id);
                            setToken({
                              id: application.id,
                              value: issued.setupToken,
                              expires: issued.expiresAt,
                            });
                          })
                        }
                      />
                    </View>
                  ) : null}

                  {ownToken ? (
                    <View
                      className="mt-2.5 rounded-lg px-3 py-2.5"
                      style={{ backgroundColor: dashboardColors.statMintSoft }}
                    >
                      <View className="flex-row items-center gap-1.5">
                        <Copy color={dashboardColors.statMintDeep} size={12} />
                        <Text
                          className="flex-1 text-[10px] font-semibold uppercase tracking-[0.6px]"
                          style={{ color: dashboardColors.statMintDeep }}
                        >
                          {t('review.setupToken')}
                        </Text>
                      </View>
                      <Text
                        selectable
                        className="mt-1 text-[12px] font-semibold text-ink"
                      >
                        {token.value}
                      </Text>
                      <Text className="mt-1 text-[10px] leading-[1.6] text-dashboard-caption">
                        {t('review.expires')}: {token.expires}
                      </Text>
                      <Text className="mt-1 text-[10px] leading-[1.6] text-dashboard-subtitle">
                        {t('review.privateHandoff')}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setToken(null)}
                        className="mt-1.5 self-start active:opacity-70"
                      >
                        <Text
                          className="text-[10.5px] font-semibold"
                          style={{ color: dashboardColors.statMintDeep }}
                        >
                          {t('review.dismiss')}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {/* History */}
                  <View className="mt-3 border-t border-dashboard-card-line pt-2.5">
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: showHistory }}
                      disabled={busy}
                      onPress={() => {
                        const next = !showHistory;
                        setOpenHistory((old) => ({
                          ...old,
                          [application.id]: next,
                        }));
                        if (next && !history[application.id]) {
                          void run(async () => {
                            const entries = await siteHistory(application.id);
                            setHistory((old) => ({
                              ...old,
                              [application.id]: entries,
                            }));
                          });
                        }
                      }}
                      className="flex-row items-center gap-1 self-start active:opacity-70"
                    >
                      <Text
                        className="text-[11px] font-semibold"
                        style={{ color: dashboardColors.teal }}
                      >
                        {showHistory ? t('review.hideHistory') : t('review.history')}
                      </Text>
                      {showHistory ? (
                        <ChevronUp color={dashboardColors.teal} size={13} />
                      ) : (
                        <ChevronDown color={dashboardColors.teal} size={13} />
                      )}
                    </Pressable>

                    {showHistory ? (
                      <View className="mt-2">
                        {(history[application.id] ?? []).length === 0 ? (
                          <Text className="text-[10.5px] text-dashboard-caption">
                            {t('review.historyEmpty')}
                          </Text>
                        ) : (
                          (history[application.id] ?? []).map((entry, index, all) => (
                            <HistoryEntry
                              key={entry.id}
                              entry={entry}
                              isLast={index === all.length - 1}
                            />
                          ))
                        )}
                      </View>
                    ) : null}
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
