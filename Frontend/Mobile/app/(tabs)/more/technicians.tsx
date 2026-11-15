import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  Building2,
  ChevronDown,
  ChevronUp,
  SearchX,
  Wrench,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pill } from '@/components/ui/Pill';
import { Screen } from '@/components/ui/Screen';
import { SearchField } from '@/components/ui/SearchField';
import { StateView } from '@/components/ui/StateView';
import { dashboardColors, themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import { listTechnicians, getTechnicianTermsFor } from '@/services/technicians';
import { useCurrentSite } from '@/stores/site';
import type { TechnicianAvailability, TechnicianSummary } from '@/types';
import type { TechnicianTermsStatus } from '@/types/technician';
import { formatDate, fullName } from '@/utils/format';

type TranslateFn = (key: string, vars?: Record<string, unknown>) => string;

/**
 * Availability chip — mint for `available` (positive), citron for
 * `unavailable` (neutral), matching the `StatusBadge` / `UrgencyChip` tones.
 * Label keys are resolved against `t` at render time, never at module scope.
 */
const AVAILABILITY_TONE: Record<
  TechnicianAvailability,
  { container: string; text: string; labelKey: string }
> = {
  available: {
    container: 'bg-mint-bg',
    text: 'text-mint-ink',
    labelKey: 'more.technicians.availability.available',
  },
  unavailable: {
    container: 'bg-citron-bg',
    text: 'text-citron-ink',
    labelKey: 'more.technicians.availability.unavailable',
  },
};

function initials(technician: TechnicianSummary): string {
  const first = technician.firstName?.trim().charAt(0) ?? '';
  const last = technician.lastName?.trim().charAt(0) ?? '';
  return `${first}${last}`.toUpperCase() || '—';
}

/**
 * Technicians directory. Read-only list for `staff` and above. Mirrors the
 * read-only structure of `more/sites.tsx`: loading / error / empty via
 * `StateView`, pull-to-refresh, and a focus-driven load.
 *
 * When a current site is present the list is split in two — technicians
 * contracted at that site first, then everyone else — so the site-scoped view
 * is useful without hiding technicians who have no contract there.
 */
export default function TechniciansScreen() {
  const palette = themeColors();
  const { user, logout } = useAuth();
  const { t } = useTranslation('common');
  const { site } = useCurrentSite();

  const canView =
    user?.role === 'staff' ||
    user?.role === 'admin' ||
    user?.role === 'super_admin';
  const canViewTerms =
    user?.role === 'admin' || user?.role === 'super_admin';

  const [technicians, setTechnicians] = useState<TechnicianSummary[] | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!canView) return;
    setError(null);
    if (technicians === null) setLoading(true);
    try {
      const result = await listTechnicians();
      setTechnicians(result);
    } catch (err) {
      // A 401 means the session died under us — sign out rather than leave
      // the screen stuck on an error it can never clear.
      if (err instanceof ApiError && err.status === 401) {
        await logout().catch(() => {});
        return;
      }
      setError(
        err instanceof ApiError
          ? err.message
          : t('more.technicians.couldNotLoad'),
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, logout]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  const searched = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = technicians ?? [];
    if (!term) return list;
    return list.filter((tech) => {
      const haystack = [
        tech.firstName,
        tech.lastName,
        fullName(tech.firstName, tech.lastName),
        tech.email,
        tech.phone ?? '',
        ...tech.skills.map((skill) =>
          `${skill.category} ${skill.specialty ?? ''}`,
        ),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [technicians, query]);

  const atSite = useMemo(
    () =>
      site
        ? searched.filter((tech) =>
            tech.contracts.some((contract) => contract.siteId === site.id),
          )
        : [],
    [searched, site],
  );

  const others = useMemo(
    () =>
      site
        ? searched.filter(
            (tech) =>
              !tech.contracts.some((contract) => contract.siteId === site.id),
          )
        : searched,
    [searched, site],
  );

  if (!canView) {
    return (
      <Screen>
        <StateView
          variant="empty"
          icon={Wrench}
          title={t('more.technicians.notAllowedTitle')}
          description={t('more.technicians.notAllowedDesc')}
        />
      </Screen>
    );
  }

  if (error && technicians === null) {
    return (
      <Screen>
        <StateView
          variant="error"
          title={t('more.technicians.couldNotLoadTitle')}
          description={error}
          actionLabel={t('more.technicians.retry')}
          onAction={() => {
            void load();
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="flex-1 px-5 pt-4">
        <PageHeader
          kicker={t('more.technicians.sectionLegend')}
          title={t('more.technicians.title')}
          subtitle={
            site
              ? t('more.technicians.subtitleAtSite', { site: site.name })
              : t('more.technicians.subtitleAll')
          }
          icon={Wrench}
        >
          <View className="flex-row flex-wrap items-center gap-2">
            <Pill
              tone="mint"
              label={t('more.technicians.count', {
                count: technicians?.length ?? 0,
                plural: (technicians?.length ?? 0) === 1 ? '' : 's',
              })}
            />
            {site ? <Pill tone="neutral" label={site.name} /> : null}
          </View>
        </PageHeader>

        {technicians === null && loading ? (
          <StateView variant="loading" title={t('review.loading')} />
        ) : technicians && technicians.length === 0 ? (
          <StateView
            variant="empty"
            icon={Wrench}
            title={t('more.technicians.emptyTitle')}
            description={t('more.technicians.emptyDesc')}
          />
        ) : (
          <>
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder={t('more.technicians.searchPlaceholder')}
              className="mb-3"
            />
            <ScrollView
              contentContainerClassName="pb-8"
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={palette.primary}
                />
              }
            >
              {/* Non-blocking error: keeps the last good list visible. */}
              {error ? (
                <StateView
                  variant="error"
                  description={error}
                  actionLabel={t('more.technicians.retry')}
                  onAction={() => {
                    void load();
                  }}
                />
              ) : null}

              {searched.length === 0 ? (
                <StateView
                  variant="empty"
                  icon={SearchX}
                  title={t('more.technicians.searchEmptyTitle')}
                  description={t('more.technicians.searchEmptyDesc')}
                  actionLabel={t('more.technicians.clearSearch')}
                  onAction={() => setQuery('')}
                />
              ) : site ? (
                <>
                  <SectionLabel
                    label={t('more.technicians.sectionAtSite', {
                      site: site.name,
                    })}
                  />
                  {atSite.length === 0 ? (
                    <StateView
                      variant="empty"
                      title={t('more.technicians.noContractedTitle', {
                        site: site.name,
                      })}
                      description={t('more.technicians.noContractedDesc')}
                      className="py-6"
                    />
                  ) : (
                    atSite.map((technician) => (
                      <TechnicianRow
                        key={technician.id}
                        t={t}
                        technician={technician}
                        canViewTerms={canViewTerms}
                      />
                    ))
                  )}

                  {others.length > 0 ? (
                    <>
                      <SectionLabel
                        label={t('more.technicians.sectionOthers')}
                      />
                      {others.map((technician) => (
                        <TechnicianRow
                          key={technician.id}
                          t={t}
                          technician={technician}
                          canViewTerms={canViewTerms}
                        />
                      ))}
                    </>
                  ) : null}
                </>
              ) : (
                searched.map((technician) => (
                  <TechnicianRow
                    key={technician.id}
                    t={t}
                    technician={technician}
                    canViewTerms={canViewTerms}
                  />
                ))
              )}
            </ScrollView>
          </>
        )}
      </View>
    </Screen>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <Text className="mb-2 mt-1 text-[10px] font-semibold uppercase tracking-[1.2px] text-dashboard-caption">
      {label}
    </Text>
  );
}

function AvailabilityChip({
  status,
  t,
}: {
  status: TechnicianAvailability;
  t: TranslateFn;
}) {
  const tone = AVAILABILITY_TONE[status];
  return (
    <View className={`rounded-full px-2.5 py-1 ${tone.container}`}>
      <Text className={`text-[10px] font-semibold uppercase ${tone.text}`} style={{ letterSpacing: 0.5 }}>
        {t(tone.labelKey)}
      </Text>
    </View>
  );
}

/**
 * One technician card: identity, availability, declared skills as chips, the
 * contract sites, and an expandable terms status for admins.
 */
function TechnicianRow({
  t,
  technician,
  canViewTerms,
}: {
  t: TranslateFn;
  technician: TechnicianSummary;
  canViewTerms: boolean;
}) {
  const [terms, setTerms] = useState<TechnicianTermsStatus | null>(null);
  const [termsLoading, setTermsLoading] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);

  const loadTerms = useCallback(async () => {
    if (termsLoading) return;
    setTermsLoading(true);
    setTermsError(null);
    try {
      setTerms(await getTechnicianTermsFor(technician.id));
    } catch (err) {
      setTermsError(
        err instanceof ApiError
          ? err.message
          : t('more.technicians.termsLoadFailed'),
      );
    } finally {
      setTermsLoading(false);
    }
  }, [technician.id, termsLoading, t]);

  const name = fullName(technician.firstName, technician.lastName);
  const contractsCount = technician.contracts.length;
  const skillsCount = technician.skills.length;

  return (
    <Card className="mb-3">
      <View className="flex-row items-start gap-3">
        <View
          className="h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: dashboardColors.statMintSoft }}
        >
          <Text
            className="text-[13px] font-bold"
            style={{ color: dashboardColors.statMintDeep }}
          >
            {initials(technician)}
          </Text>
        </View>
        <View className="flex-1">
          <Text
            className="text-[15px] font-semibold text-ink"
            numberOfLines={1}
          >
            {name}
          </Text>
          <Text
            className="mt-0.5 text-[11px] text-dashboard-subtitle"
            numberOfLines={1}
          >
            {technician.email}
          </Text>
          {technician.phone ? (
            <Text className="mt-0.5 text-[11px] text-dashboard-caption">
              {technician.phone}
            </Text>
          ) : null}
        </View>
        <AvailabilityChip status={technician.availabilityStatus} t={t} />
      </View>

      <View className="mt-3 flex-row gap-2">
        <View className="flex-1 rounded-lg bg-surface px-2.5 py-2">
          <Text className="text-[9px] font-semibold uppercase tracking-[0.6px] text-dashboard-caption">
            {t('more.technicians.skillsLabel')}
          </Text>
          <Text className="mt-0.5 text-[12.5px] font-semibold text-ink">
            {t('more.technicians.skillsCount', {
              count: skillsCount,
              plural: skillsCount === 1 ? '' : 's',
            })}
          </Text>
        </View>
        <View className="flex-1 rounded-lg bg-surface px-2.5 py-2">
          <Text className="text-[9px] font-semibold uppercase tracking-[0.6px] text-dashboard-caption">
            {t('more.technicians.contractsLabel')}
          </Text>
          <Text className="mt-0.5 text-[12.5px] font-semibold text-ink">
            {t('more.technicians.contractsCount', {
              count: contractsCount,
              plural: contractsCount === 1 ? '' : 's',
            })}
          </Text>
        </View>
      </View>

      <View className="mt-3">
        <Text className="mb-1.5 text-[10px] font-semibold uppercase tracking-[1px] text-dashboard-caption">
          {t('more.technicians.skillsLabel')}
        </Text>
        {skillsCount === 0 ? (
          <Text className="text-[11px] text-dashboard-caption">
            {t('more.technicians.noSkills')}
          </Text>
        ) : (
          <View className="flex-row flex-wrap gap-1.5">
            {technician.skills.map((skill) => (
              <View
                key={skill.id}
                className="rounded-md border border-dashboard-card-line px-2 py-1"
              >
                <Text className="text-[10.5px] font-medium text-ink">
                  {skill.category}
                  {skill.specialty ? ` · ${skill.specialty}` : ''}
                  <Text className="text-dashboard-caption">
                    {' '}
                    L{skill.proficiency}
                  </Text>
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View className="mt-3">
        <Text className="mb-1.5 text-[10px] font-semibold uppercase tracking-[1px] text-dashboard-caption">
          {t('more.technicians.contractsLabel')}
        </Text>
        {contractsCount === 0 ? (
          <Text className="text-[11px] text-dashboard-caption">
            {t('more.technicians.noContracts')}
          </Text>
        ) : (
          <View className="gap-1">
            {technician.contracts.map((contract) => (
              <View
                key={`${contract.siteId}-${contract.createdAt}`}
                className="flex-row items-center gap-1.5"
              >
                <Building2 color={dashboardColors.statMintDeep} size={12} />
                <Text className="flex-1 text-[11.5px] text-ink">
                  {t('more.technicians.contractLine', {
                    site: contract.siteName,
                    date: formatDate(contract.createdAt),
                  })}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {canViewTerms ? (
        <View className="mt-3 border-t border-dashboard-card-line pt-2.5">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: terms !== null }}
            onPress={() => {
              if (terms) {
                setTerms(null);
                setTermsError(null);
              } else {
                void loadTerms();
              }
            }}
            className="flex-row items-center gap-1 self-start active:opacity-70"
          >
            <Text
              className="text-[11px] font-semibold"
              style={{ color: dashboardColors.teal }}
            >
              {terms
                ? t('more.technicians.hideTerms')
                : t('more.technicians.viewTerms')}
            </Text>
            {terms ? (
              <ChevronUp color={dashboardColors.teal} size={13} />
            ) : (
              <ChevronDown color={dashboardColors.teal} size={13} />
            )}
          </Pressable>
          {termsLoading ? (
            <Text className="mt-1 text-[10px] text-dashboard-caption">
              {t('technician.terms.loading')}
            </Text>
          ) : null}
          {termsError ? (
            <Text className="mt-1 text-[10px] leading-[1.7] text-tone-danger">
              {termsError}
            </Text>
          ) : null}
          {terms ? (
            terms.currentVersion ? (
              <View className="mt-1.5 flex-row items-center justify-between gap-2">
                <Text className="flex-1 text-[11px] text-ink">
                  {t('technician.terms.version', {
                    version: terms.currentVersion,
                  })}
                </Text>
                <Pill
                  tone={terms.acceptedCurrentVersion ? 'mint' : 'citron'}
                  label={t(
                    terms.acceptedCurrentVersion
                      ? 'technician.terms.accepted'
                      : 'technician.terms.notAccepted',
                  )}
                />
              </View>
            ) : (
              <Text className="mt-1 text-[10px] text-dashboard-caption">
                {t('technician.terms.noTerms')}
              </Text>
            )
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}
