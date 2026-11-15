import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { CheckCircle2, User, Wrench } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { SearchField } from '@/components/ui/SearchField';
import { StateView } from '@/components/ui/StateView';
import { dashboardColors } from '@/constants/theme';
import { toErrorMessage } from '@/lib/apiClient';
import { assignTechnician } from '@/services/reports';
import { listTechnicianPool } from '@/services/technicians';
import type { Report, TechnicianPoolMember } from '@/types';

type Props = {
  visible: boolean;
  report: Report;
  onClose: () => void;
  /** Called with the updated report after a successful assignment. */
  onAssigned: (updated: Report) => void;
};

function AvailabilityDot({ available }: { available: boolean }) {
  return (
    <View
      className="h-2 w-2 rounded-full"
      style={{
        backgroundColor: available
          ? dashboardColors.statMintDeep
          : dashboardColors.statCitronDeep,
      }}
    />
  );
}

/**
 * Bottom sheet that lets a site admin pick a contracted technician from their
 * site and assign them to the given report.
 *
 * Data source: `GET /api/sites/{siteId}/technician-pool` — returns only
 * technicians with an active contract at the site. The admin sees all of
 * them (available + unavailable) but unavailable ones are visually dimmed and
 * listed last.
 */
export function AssignTechnicianSheet({ visible, report, onClose, onAssigned }: Props) {
  const { t } = useTranslation('common');

  const [pool, setPool] = useState<TechnicianPoolMember[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Load the pool each time the sheet opens.
  const load = useCallback(async () => {
    if (!report.siteId) return;
    setLoading(true);
    setLoadError(null);
    setPool(null);
    setSelectedId(null);
    setAssignError(null);
    try {
      const result = await listTechnicianPool(report.siteId);
      setPool(result);
    } catch (err) {
      setLoadError(
        toErrorMessage(err, {
          fallback: t('reports.assignSheet.loadError'),
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [report.siteId, t]);

  // Load the pool and reset search state each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setQuery('');
      void load();
    }
  // `load` is stable (useCallback with siteId + t deps); re-running on
  // `visible` changes is exactly what we want.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = pool ?? [];
    const matched = term
      ? list.filter((m) => {
          const name = `${m.firstName} ${m.lastName}`.toLowerCase();
          return name.includes(term) || m.email.toLowerCase().includes(term);
        })
      : list;
    // Available first, then unavailable.
    return [...matched].sort((a, b) => {
      if (a.availability === b.availability) return 0;
      return a.availability === 'available' ? -1 : 1;
    });
  }, [pool, query]);

  async function onConfirmAssign() {
    if (selectedId === null) return;
    setAssigning(true);
    setAssignError(null);
    try {
      const updated = await assignTechnician(report.id, { technicianId: selectedId });
      onAssigned(updated);
      onClose();
    } catch (err) {
      setAssignError(
        toErrorMessage(err, {
          fallback: t('reports.assignSheet.assignError'),
        }),
      );
    } finally {
      setAssigning(false);
    }
  }

  const selectedMember = pool?.find((m) => m.technicianId === selectedId);

  return (
    <ModalSheet
      visible={visible}
      title={
        report.assignedTechnicianId !== null
          ? t('reports.assignSheet.titleReassign')
          : t('reports.assignSheet.title')
      }
      onClose={onClose}
      busy={assigning}
      footer={
        <View className="px-5 pb-5 pt-3">
          {assignError ? (
            <View className="mb-3 rounded-md bg-dashboard-error-bg px-3 py-2">
              <Text className="text-[11px] leading-[1.7] text-dashboard-error-text">
                {assignError}
              </Text>
            </View>
          ) : null}
          {selectedMember ? (
            <View className="mb-3 flex-row items-center gap-2 rounded-lg px-3 py-2.5"
              style={{ backgroundColor: dashboardColors.statMintSoft }}>
              <CheckCircle2 color={dashboardColors.statMintDeep} size={15} />
              <Text className="flex-1 text-[12px] font-medium"
                style={{ color: dashboardColors.statMintDeep }}
                numberOfLines={1}>
                {`${selectedMember.firstName} ${selectedMember.lastName}`.trim()}
                {selectedMember.availability === 'unavailable'
                  ? ` · ${t('reports.assignSheet.unavailableNote')}`
                  : ''}
              </Text>
            </View>
          ) : null}
          <Button
            label={
              assigning
                ? t('reports.assignSheet.assigning')
                : report.assignedTechnicianId !== null
                  ? t('reports.assignSheet.reassign')
                  : t('reports.assignSheet.assign')
            }
            variant="cta"
            onPress={onConfirmAssign}
            loading={assigning}
            disabled={selectedId === null || assigning}
          />
        </View>
      }
    >
      <View className="flex-1 px-5 pt-2">
        {/* Context banner */}
        <View className="mb-4 rounded-lg px-3 py-2.5"
          style={{ backgroundColor: dashboardColors.cardBg }}>
          <Text className="text-[11px] leading-[1.7] text-dashboard-subtitle">
            {t('reports.assignSheet.context', {
              reportId: report.id,
              category: report.category,
            })}
          </Text>
        </View>

        {loading ? (
          <StateView variant="loading" title={t('reports.assignSheet.loadingPool')} />
        ) : loadError ? (
          <StateView
            variant="error"
            title={t('reports.assignSheet.loadErrorTitle')}
            description={loadError}
            actionLabel={t('reports.assignSheet.retry')}
            onAction={() => void load()}
          />
        ) : pool !== null && pool.length === 0 ? (
          <StateView
            variant="empty"
            icon={Wrench}
            title={t('reports.assignSheet.emptyTitle')}
            description={t('reports.assignSheet.emptyDesc')}
          />
        ) : pool !== null ? (
          <>
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder={t('reports.assignSheet.searchPlaceholder')}
              className="mb-3"
            />

            {/* Summary row */}
            <View className="mb-3 flex-row items-center gap-3">
              <View className="flex-row items-center gap-1.5">
                <AvailabilityDot available={true} />
                <Text className="text-[11px] text-dashboard-subtitle">
                  {t('reports.assignSheet.availableCount', {
                    count: pool.filter((m) => m.availability === 'available').length,
                  })}
                </Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <AvailabilityDot available={false} />
                <Text className="text-[11px] text-dashboard-subtitle">
                  {t('reports.assignSheet.unavailableCount', {
                    count: pool.filter((m) => m.availability === 'unavailable').length,
                  })}
                </Text>
              </View>
            </View>

            <ScrollView
              className="flex-1"
              contentContainerClassName="pb-4"
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {filtered.length === 0 ? (
                <StateView
                  variant="empty"
                  icon={User}
                  title={t('reports.assignSheet.noMatchTitle')}
                  description={t('reports.assignSheet.noMatchDesc')}
                />
              ) : (
                <View className="overflow-hidden rounded-xl border border-dashboard-card-line">
                  {filtered.map((member, index) => {
                    const active = selectedId === member.technicianId;
                    const available = member.availability === 'available';
                    const isCurrentAssignee =
                      report.assignedTechnicianId === member.technicianId;

                    return (
                      <Pressable
                        key={member.technicianId}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        onPress={() => {
                          setSelectedId(
                            active ? null : member.technicianId,
                          );
                          setAssignError(null);
                        }}
                        className={`flex-row items-center gap-3 px-4 py-3 active:opacity-80 ${
                          index > 0 ? 'border-t border-dashboard-card-line' : ''
                        }`}
                        style={{
                          backgroundColor: active
                            ? dashboardColors.statMintSoft
                            : 'transparent',
                          opacity: !available && !active ? 0.65 : 1,
                        }}
                      >
                        {/* Avatar initials */}
                        <View
                          className="h-9 w-9 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: active
                              ? dashboardColors.statMintDeep
                              : dashboardColors.cardBg,
                          }}
                        >
                          <Text
                            className="text-[11px] font-bold"
                            style={{
                              color: active
                                ? '#fff'
                                : dashboardColors.subtitle,
                            }}
                          >
                            {`${member.firstName.charAt(0)}${member.lastName.charAt(0)}`.toUpperCase()}
                          </Text>
                        </View>

                        {/* Name + availability */}
                        <View className="flex-1">
                          <View className="flex-row items-center gap-2">
                            <Text
                              className="text-[13px] font-semibold text-ink"
                              numberOfLines={1}
                            >
                              {`${member.firstName} ${member.lastName}`.trim()}
                            </Text>
                            {isCurrentAssignee ? (
                              <View
                                className="rounded-full px-1.5 py-0.5"
                                style={{ backgroundColor: dashboardColors.statCitronSoft }}
                              >
                                <Text
                                  className="text-[9px] font-semibold uppercase"
                                  style={{
                                    color: dashboardColors.statCitronDeep,
                                    letterSpacing: 0.5,
                                  }}
                                >
                                  {t('reports.assignSheet.currentBadge')}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          <View className="mt-0.5 flex-row items-center gap-1.5">
                            <AvailabilityDot available={available} />
                            <Text className="text-[11px] text-dashboard-caption">
                              {available
                                ? t('reports.assignSheet.available')
                                : t('reports.assignSheet.unavailable')}
                              {' · '}
                              {member.email}
                            </Text>
                          </View>
                        </View>

                        {/* Selection indicator */}
                        {active ? (
                          <CheckCircle2
                            color={dashboardColors.statMintDeep}
                            size={18}
                          />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          </>
        ) : null}
      </View>
    </ModalSheet>
  );
}
