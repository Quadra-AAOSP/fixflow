import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Wrench } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { dashboardColors, themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import { listTechnicians } from '@/services/technicians';
import { useCurrentSite } from '@/stores/site';
import type { TechnicianAvailability, TechnicianSummary } from '@/types';
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

  const [technicians, setTechnicians] = useState<TechnicianSummary[] | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const atSite = useMemo(
    () =>
      site
        ? (technicians ?? []).filter((tech) =>
            tech.contracts.some((contract) => contract.siteId === site.id),
          )
        : [],
    [technicians, site],
  );

  const others = useMemo(
    () =>
      site
        ? (technicians ?? []).filter(
            (tech) =>
              !tech.contracts.some((contract) => contract.siteId === site.id),
          )
        : (technicians ?? []),
    [technicians, site],
  );

  if (!canView) {
    return (
      <Screen>
        <StateView
          variant="empty"
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
        <View className="mb-4 flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text
              className="text-2xl font-bold text-ink"
              style={{ letterSpacing: -0.5 }}
            >
              {t('more.technicians.title')}
            </Text>
            <Text className="mt-0.5 text-xs text-dashboard-subtitle">
              {technicians
                ? t('more.technicians.count', {
                    count: technicians.length,
                    plural: technicians.length === 1 ? '' : 's',
                  })
                : t('more.technicians.subtitleAll')}
            </Text>
            {site ? (
              <Text className="mt-0.5 text-xs text-dashboard-subtitle">
                {t('more.technicians.subtitleAtSite', { site: site.name })}
              </Text>
            ) : null}
          </View>
          <Wrench color={dashboardColors.teal} size={26} strokeWidth={1.8} />
        </View>

        {technicians === null && loading ? (
          <View className="py-12">
            <ActivityIndicator size="large" color={palette.primary} />
          </View>
        ) : technicians && technicians.length === 0 ? (
          <StateView
            variant="empty"
            icon={Wrench}
            title={t('more.technicians.emptyTitle')}
            description={t('more.technicians.emptyDesc')}
          />
        ) : (
          <ScrollView
            contentContainerClassName="pb-8"
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

            {site ? (
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
                      />
                    ))}
                  </>
                ) : null}
              </>
            ) : (
              (technicians ?? []).map((technician) => (
                <TechnicianRow
                  key={technician.id}
                  t={t}
                  technician={technician}
                />
              ))
            )}
          </ScrollView>
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
    <View className={`rounded-md px-2.5 py-1 ${tone.container}`}>
      <Text className={`text-[11px] font-semibold ${tone.text}`}>
        {t(tone.labelKey)}
      </Text>
    </View>
  );
}

/**
 * One technician card: name + availability chip, contact line, the declared
 * skills (category · specialty · level), and the contract sites.
 */
function TechnicianRow({
  t,
  technician,
}: {
  t: TranslateFn;
  technician: TechnicianSummary;
}) {
  const name = fullName(technician.firstName, technician.lastName);
  const contact = technician.phone
    ? `${technician.email} · ${technician.phone}`
    : technician.email;

  return (
    <Card className="mb-3">
      <View className="flex-row items-start justify-between gap-2">
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
            {contact}
          </Text>
        </View>
        <AvailabilityChip status={technician.availabilityStatus} t={t} />
      </View>

      <View className="mt-3">
        <Text className="mb-1 text-[10px] font-semibold uppercase tracking-[1px] text-dashboard-caption">
          {t('more.technicians.skillsLabel')}
        </Text>
        {technician.skills.length === 0 ? (
          <Text className="text-[11px] text-dashboard-caption">
            {t('more.technicians.noSkills')}
          </Text>
        ) : (
          technician.skills.map((skill) => (
            <Text
              key={skill.id}
              className="text-[12px] leading-[1.7] text-ink"
            >
              {skill.category} ·{' '}
              {skill.specialty ?? t('more.technicians.noSpecialty')} ·{' '}
              {t('more.technicians.level', { level: skill.proficiency })}
            </Text>
          ))
        )}
      </View>

      <View className="mt-3">
        <Text className="mb-1 text-[10px] font-semibold uppercase tracking-[1px] text-dashboard-caption">
          {t('more.technicians.contractsLabel')}
        </Text>
        {technician.contracts.length === 0 ? (
          <Text className="text-[11px] text-dashboard-caption">
            {t('more.technicians.noContracts')}
          </Text>
        ) : (
          technician.contracts.map((contract) => (
            <Text
              key={`${contract.siteId}-${contract.createdAt}`}
              className="text-[12px] leading-[1.7] text-ink"
            >
              {t('more.technicians.contractLine', {
                site: contract.siteName,
                date: formatDate(contract.createdAt),
              })}
            </Text>
          ))
        )}
      </View>
    </Card>
  );
}
