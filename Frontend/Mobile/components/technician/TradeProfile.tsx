import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Check, Plus } from 'lucide-react-native';

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
import { useCurrentSite } from '@/stores/site';

const PROFICIENCY_LABELS: Record<number, string> = {
  1: 'Novice',
  2: 'Developing',
  3: 'Competent',
  4: 'Proficient',
  5: 'Expert',
};

const PROFICIENCY_OPTIONS = Array.from(
  { length: SKILL_PROFICIENCY_MAX - SKILL_PROFICIENCY_MIN + 1 },
  (_, index) => {
    const value = SKILL_PROFICIENCY_MIN + index;
    return { value: String(value), label: `${value} · ${PROFICIENCY_LABELS[value]}` };
  },
);

/**
 * Trade profile form. Lets a technician declare a category, a specialty, and a
 * self-assessed proficiency (1–5) for the site they're working at. Mirrors
 * the web `TradeProfile.vue`; the backend enforces the same length limits so
 * the inputs share the constants exported from `services/technician.ts`.
 */
export function TradeProfile() {
  const palette = themeColors();
  const { user } = useAuth();
  const { site } = useCurrentSite();
  const [category, setCategory] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [proficiency, setProficiency] = useState<string>('3');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
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
      setError('Category is required.');
      return;
    }
    if (specialty.trim().length === 0) {
      setError('Specialty is required.');
      return;
    }
    if (category.length > SKILL_CATEGORY_MAX_LENGTH) {
      setError(
        `Category must be ${SKILL_CATEGORY_MAX_LENGTH} characters or fewer.`,
      );
      return;
    }
    if (specialty.length > SKILL_SPECIALTY_MAX_LENGTH) {
      setError(
        `Specialty must be ${SKILL_SPECIALTY_MAX_LENGTH} characters or fewer.`,
      );
      return;
    }
    const proficiencyValue = Number(proficiency);
    if (
      !Number.isInteger(proficiencyValue) ||
      proficiencyValue < SKILL_PROFICIENCY_MIN ||
      proficiencyValue > SKILL_PROFICIENCY_MAX
    ) {
      setError('Proficiency must be between 1 and 5.');
      return;
    }

    setError(null);
    setConfirm(null);
    setSubmitting(true);
    try {
      await addTechnicianSkill({
        technicianId: user.id,
        category: category.trim(),
        specialty: specialty.trim(),
        proficiency: proficiencyValue,
      });
      setConfirm('Trade added to your profile.');
      setCategory('');
      setSpecialty('');
      setProficiency('3');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not save the trade right now.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mb-6">
      <View className="mb-3 flex-row items-center gap-2">
        <View className="rounded-lg bg-accent/20 p-2">
          <Plus color={palette.accentForeground} size={18} />
        </View>
        <Text className="text-base font-semibold text-ink">
          Add a trade
        </Text>
      </View>
      <Text className="mb-4 text-xs leading-5 text-muted">
        Trades are independently verified. Self-assessed proficiency on this
        form is informational and not a substitute for a formal qualification.
      </Text>

      <ScrollView keyboardShouldPersistTaps="handled">
        {categoryOptions.length > 0 ? (
          <View className="mb-3">
            <Picker
              label="Category"
              value={category}
              onChange={setCategory}
              options={categoryOptions.map((value) => ({
                value,
                label: value,
              }))}
              placeholder="Choose a category…"
            />
          </View>
        ) : (
          <TextField
            label="Category"
            value={category}
            onChangeText={setCategory}
            placeholder="e.g. electrical"
            maxLength={SKILL_CATEGORY_MAX_LENGTH}
            autoCapitalize="none"
            className="mb-3"
          />
        )}

        <TextField
          label="Specialty"
          value={specialty}
          onChangeText={setSpecialty}
          placeholder="e.g. low-voltage wiring"
          maxLength={SKILL_SPECIALTY_MAX_LENGTH}
          autoCapitalize="none"
          className="mb-3"
        />

        <Picker
          label="Proficiency"
          value={proficiency}
          onChange={setProficiency}
          options={PROFICIENCY_OPTIONS}
          placeholder="Proficiency"
        />

        {error ? (
          <Text className="mt-3 text-xs text-tone-danger">{error}</Text>
        ) : null}
        {confirm ? (
          <View className="mt-3 flex-row items-center gap-1.5">
            <Check color={palette.tone.success} size={14} />
            <Text className="text-xs text-tone-success">{confirm}</Text>
          </View>
        ) : null}

        <Button
          label={submitting ? 'Saving…' : 'Save trade'}
          loading={submitting}
          onPress={onSubmit}
          className="mt-4"
        />
      </ScrollView>
    </Card>
  );
}
