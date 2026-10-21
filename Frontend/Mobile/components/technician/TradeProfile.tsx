import { useEffect, useState } from 'react';
import { ScrollView, Pressable, Text, View } from 'react-native';
import { Check, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Picker } from '@/components/ui/Picker';
import { TextField } from '@/components/ui/TextField';
import { themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import {
  SKILL_CATEGORY_MAX_LENGTH,
  SKILL_PROFICIENCY_MAX,
  SKILL_PROFICIENCY_MIN,
  SKILL_SPECIALTY_MAX_LENGTH,
  addTechnicianSkill,
} from '@/services/technician';
import { listSiteRules } from '@/services/siteRules';
import type { SiteRule } from '@/types';
import type { TechnicianSkill } from '@/types/technician';
import { useCurrentSite } from '@/stores/site';

/** Proficiency level i18n keys — mirrors the <select> in `TradeProfile.vue`. */
const PROFICIENCY_LABELS: Record<number, string> = {
  1: 'beginner',
  2: 'basicExperience',
  3: 'independent',
  4: 'advanced',
  5: 'expert',
};

/**
 * Trade profile form. Lets a technician declare a category, a specialty, and a
 * self-assessed proficiency (1–5) for the site they're working at. Mirrors
 * the web `TradeProfile.vue`; the backend enforces the same length limits so
 * the inputs share the constants exported from `services/technician.ts`.
 */
export function TradeProfile() {
  const { t } = useTranslation('common');
  const palette = themeColors();
  const { user } = useAuth();
  const { site } = useCurrentSite();
  const PROFICIENCY_OPTIONS = Array.from(
    { length: SKILL_PROFICIENCY_MAX - SKILL_PROFICIENCY_MIN + 1 },
    (_, index) => {
      const value = SKILL_PROFICIENCY_MIN + index;
      return {
        value: String(value),
        label: `${value} — ${t(
          `components.tradeProfile.levels.${PROFICIENCY_LABELS[value]}`,
        )}`,
      };
    },
  );
  const [category, setCategory] = useState('');
  const [specialty, setSpecialty] = useState('');
  // Starts empty so an explicit choice is required — matches the web select's
  // disabled placeholder ("Choose a level") in `TradeProfile.vue`.
  const [proficiency, setProficiency] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<TechnicianSkill | null>(null);
  const [rules, setRules] = useState<SiteRule[]>([]);

  const categoryOptions = rules
    .map((rule) => rule.category)
    .filter((value, index, array) => array.indexOf(value) === index)
    .sort();

  useEffect(() => {
    if (!site) {
      setRules([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const next = await listSiteRules(site.type);
        if (!cancelled) setRules(next);
      } catch {
        // Failing to load rules shouldn't block the manual entry path —
        // a free-text category is still acceptable to the backend.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [site?.type]);

  async function onSubmit() {
    if (!user) return;
    if (category.trim().length === 0) {
      setError(t('components.tradeProfile.errors.categoryRequired'));
      return;
    }
    if (specialty.trim().length === 0) {
      setError(t('components.tradeProfile.errors.specialtyRequired'));
      return;
    }
    if (proficiency === '') {
      setError(t('components.tradeProfile.errors.chooseProficiency'));
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
    const proficiencyValue = Number(proficiency);
    if (
      !Number.isInteger(proficiencyValue) ||
      proficiencyValue < SKILL_PROFICIENCY_MIN ||
      proficiencyValue > SKILL_PROFICIENCY_MAX
    ) {
      setError(t('components.tradeProfile.errors.proficiencyRange'));
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const result = await addTechnicianSkill({
        technicianId: user.id,
        category: category.trim(),
        specialty: specialty.trim(),
        proficiency: proficiencyValue,
      });
      setSaved(result);
    } catch (err) {
      // Duplicate-submission warning — same suffix the web appends in
      // `TradeProfile.vue`.
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

  /** Resets the form after the saved-state panel — the web's
      "Add another trade →" button. */
  function onAddAnother() {
    setSaved(null);
    setCategory('');
    setSpecialty('');
    setProficiency('');
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

      {saved ? (
        <View className="mb-2">
          <View className="flex-row items-center gap-1.5">
            <Check color={palette.tone.success} size={14} />
            <Text className="text-xs text-tone-success">
              {t('components.tradeProfile.saved', {
                category: saved.category,
                specialty: saved.specialty,
                proficiency: saved.proficiency,
              })}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onAddAnother}
            className="mt-2 self-start active:opacity-70"
          >
            <Text className="text-xs font-medium text-dashboard-teal underline">
              {t('components.tradeProfile.addAnother')}
            </Text>
          </Pressable>
        </View>
      ) : (
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

        <Picker
          label={t('components.tradeProfile.proficiencyLabel')}
          value={proficiency}
          onChange={setProficiency}
          options={PROFICIENCY_OPTIONS}
          placeholder={t('components.tradeProfile.chooseLevel')}
        />

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
      </ScrollView>
      )}

      <Text className="mt-4 text-xs leading-5 text-muted">
        {t('components.tradeProfile.previousSkillsNote')}
      </Text>
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
