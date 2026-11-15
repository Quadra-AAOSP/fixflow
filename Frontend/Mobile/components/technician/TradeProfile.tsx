import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Pressable, Text, View } from 'react-native';
import { Check, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Picker } from '@/components/ui/Picker';
import { StateView } from '@/components/ui/StateView';
import { TextField } from '@/components/ui/TextField';
import { themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import {
  SKILL_CATEGORY_MAX_LENGTH,
  SKILL_SPECIALTY_MAX_LENGTH,
  addTechnicianSkill,
  listMyTechnicianSkills,
} from '@/services/technician';
import { listAllSiteRules } from '@/services/siteRules';
import type { SiteRule } from '@/types';
import type { TechnicianSkill } from '@/types/technician';

/**
 * Trade profile form. Technicians declare category and optional specialty;
 * proficiency starts at 2.5 and is updated by the platform from ratings.
 */
export function TradeProfile() {
  const { t } = useTranslation('common');
  const palette = themeColors();
  const { user } = useAuth();
  const [category, setCategory] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trades, setTrades] = useState<TechnicianSkill[]>([]);
  const [loadingTrades, setLoadingTrades] = useState(true);
  const [tradeLoadError, setTradeLoadError] = useState('');
  const [adding, setAdding] = useState(false);
  const [savedId, setSavedId] = useState<number>();
  const tradeRequest = useRef<AbortController | null>(null);
  const [rules, setRules] = useState<SiteRule[]>([]);

  const categoryOptions = rules
    .map((rule) => rule.category)
    .filter((value, index, array) => array.indexOf(value) === index)
    .sort();

  const loadTrades = useCallback(async () => {
    tradeRequest.current?.abort();
    const request = new AbortController();
    tradeRequest.current = request;
    setLoadingTrades(true);
    setTradeLoadError('');
    try {
      const next = await listMyTechnicianSkills(request.signal);
      if (!request.signal.aborted) setTrades(next);
    } catch (err) {
      if (!request.signal.aborted) {
        setTradeLoadError(err instanceof ApiError ? err.message : t('components.tradeProfile.errors.loadFailed'));
      }
    } finally {
      if (!request.signal.aborted) setLoadingTrades(false);
    }
  }, [t]);

  useEffect(() => {
    if (user?.role !== 'technician') return;
    void loadTrades();
    return () => tradeRequest.current?.abort();
  }, [loadTrades, user?.id, user?.role]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await listAllSiteRules();
        if (!cancelled) setRules(next);
      } catch {
        // Free-text category remains acceptable if taxonomy fails to load.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit() {
    if (user?.role !== 'technician' || loadingTrades || tradeLoadError || submitting) return;
    if (category.trim().length === 0) {
      setError(t('components.tradeProfile.errors.categoryRequired'));
      return;
    }
    if (category.length > SKILL_CATEGORY_MAX_LENGTH) {
      setError(
        t('components.tradeProfile.errors.categoryTooLong', {
          max: SKILL_CATEGORY_MAX_LENGTH,
        }),
      );
      return;
    }
    if (specialty.length > SKILL_SPECIALTY_MAX_LENGTH) {
      setError(
        t('components.tradeProfile.errors.specialtyTooLong', {
          max: SKILL_SPECIALTY_MAX_LENGTH,
        }),
      );
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const result = await addTechnicianSkill({
        technicianId: user.id,
        category: category.trim(),
        specialty: specialty.trim() || undefined,
      });
      setTrades(current => [...current.filter(trade => trade.id !== result.id), result]);
      setSavedId(result.id);
      closeForm();
    } catch (err) {
      setError(
        (err instanceof ApiError
          ? err.message
          : t('components.tradeProfile.errors.saveFailed')) +
          t('components.tradeProfile.errors.duplicateSuffix'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  function closeForm() {
    setAdding(false);
    setError(null);
    setCategory('');
    setSpecialty('');
  }

  return (
    <Card className="mb-6">
      <View className="mb-3 flex-row items-center gap-2">
        <View className="rounded-lg bg-accent/20 p-2">
          <Plus color={palette.accentForeground} size={18} />
        </View>
        <Text className="text-base font-semibold text-ink">
          {t('components.tradeProfile.heading')}
        </Text>
      </View>
      <Text className="mb-4 text-xs leading-5 text-muted">
        {t('components.tradeProfile.intro')}
      </Text>

      {loadingTrades ? (
        <StateView variant="loading" title={t('components.tradeProfile.loading')} />
      ) : tradeLoadError ? (
        <StateView variant="error" description={tradeLoadError}
          actionLabel={t('workspace.retry')} onAction={() => void loadTrades()} />
      ) : (
        <>
          {trades.map(trade => (
            <View key={trade.id} className="mb-2 flex-row items-center gap-1.5">
              <Check color={palette.tone.success} size={14} />
              <Text className="flex-1 text-xs text-ink"
                accessibilityLiveRegion={trade.id === savedId ? 'polite' : undefined}>
                {t('components.tradeProfile.saved', {
                  category: trade.category,
                  specialty: trade.specialty ?? t('reports.detail.definition.notSpecified'),
                  proficiency: trade.proficiency,
                })}
              </Text>
            </View>
          ))}
          {!adding ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setAdding(true)}
              className="mt-2 self-start active:opacity-70"
            >
              <Text className="text-xs font-medium text-dashboard-teal underline">
                {t(trades.length ? 'components.tradeProfile.addAnother' : 'components.tradeProfile.addTrade')}
              </Text>
            </Pressable>
          ) : null}
          {adding ? (
            <ScrollView keyboardShouldPersistTaps="handled">
              {categoryOptions.length > 0 ? (
                <View className="mb-3">
                  <Picker
                    label={t('components.tradeProfile.primaryTrade')}
                    value={category}
                    onChange={setCategory}
                    options={categoryOptions.map((value) => ({
                      value,
                      label: value,
                    }))}
                    placeholder={t('components.tradeProfile.chooseCategory')}
                  />
                </View>
              ) : (
                <TextField
                  label={t('components.tradeProfile.primaryTrade')}
                  value={category}
                  onChangeText={setCategory}
                  placeholder={t('components.tradeProfile.categoryPlaceholder')}
                  maxLength={SKILL_CATEGORY_MAX_LENGTH}
                  autoCapitalize="none"
                  className="mb-3"
                />
              )}

              <TextField
                label={t('components.tradeProfile.specialtyLabel')}
                value={specialty}
                onChangeText={setSpecialty}
                placeholder={t('components.tradeProfile.specialtyPlaceholder')}
                maxLength={SKILL_SPECIALTY_MAX_LENGTH}
                autoCapitalize="none"
                className="mb-3"
              />

              <Text className="mb-3 text-xs leading-5 text-muted">
                {t('components.tradeProfile.proficiencyHint')}
              </Text>

              {error ? (
                <Text className="mt-3 text-xs leading-5 text-tone-danger">
                  {error}
                </Text>
              ) : null}

              <Button
                label={
                  submitting
                    ? t('components.tradeProfile.saving')
                    : t('components.tradeProfile.save')
                }
                loading={submitting}
                onPress={onSubmit}
                className="mt-4"
              />
              <Button label={t('components.tradeProfile.cancel')} variant="secondary"
                disabled={submitting} onPress={closeForm} className="mt-2" />
            </ScrollView>
          ) : null}
        </>
      )}
      <Text className="mt-3 text-[13px] font-semibold text-ink">
        {t('components.tradeProfile.beforeYouStart')}
      </Text>
      <Text className="mt-1 text-xs leading-5 text-muted">
        {t('components.tradeProfile.reviewBody')}
      </Text>
      <Text className="mt-2 text-xs leading-5 text-muted">
        {t('components.tradeProfile.evidenceNote')}
      </Text>
    </Card>
  );
}
