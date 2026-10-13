import { useEffect, useState } from 'react';
import { ScrollView, Pressable, Text, View } from 'react-native';
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
import type { TechnicianSkill } from '@/types/technician';
import { useCurrentSite } from '@/stores/site';

/** Proficiency option copy — mirrors the <select> in `TradeProfile.vue`. */
const PROFICIENCY_LABELS: Record<number, string> = {
  1: 'Beginner',
  2: 'Basic practical experience',
  3: 'Independent routine work',
  4: 'Advanced work',
  5: 'Expert',
};

const PROFICIENCY_OPTIONS = Array.from(
  { length: SKILL_PROFICIENCY_MAX - SKILL_PROFICIENCY_MIN + 1 },
  (_, index) => {
    const value = SKILL_PROFICIENCY_MIN + index;
    return { value: String(value), label: `${value} — ${PROFICIENCY_LABELS[value]}` };
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
      setError('Category is required.');
      return;
    }
    if (specialty.trim().length === 0) {
      setError('Specialty is required.');
      return;
    }
    if (proficiency === '') {
      setError('Choose a proficiency level.');
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
          : 'Could not save the trade right now.'
        ) +
          ' If the connection was interrupted, confirm with an administrator before submitting again to avoid a duplicate skill.',
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
          Your trade profile
        </Text>
      </View>
      <Text className="mb-4 text-xs leading-5 text-muted">
        Add your trade after creating your account. These details are
        self-reported, not verified qualifications.
      </Text>

      {saved ? (
        <View className="mb-2">
          <View className="flex-row items-center gap-1.5">
            <Check color={palette.tone.success} size={14} />
            <Text className="text-xs text-tone-success">
              Saved: {saved.category} · {saved.specialty} · proficiency{' '}
              {saved.proficiency}/5.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onAddAnother}
            className="mt-2 self-start active:opacity-70"
          >
            <Text className="text-xs font-medium text-dashboard-teal underline">
              Add another trade →
            </Text>
          </Pressable>
        </View>
      ) : (
      <ScrollView keyboardShouldPersistTaps="handled">
        {categoryOptions.length > 0 ? (
          <View className="mb-3">
            <Picker
              label="Primary trade"
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
            label="Primary trade"
            value={category}
            onChangeText={setCategory}
            placeholder="e.g. electrical"
            maxLength={SKILL_CATEGORY_MAX_LENGTH}
            autoCapitalize="none"
            className="mb-3"
          />
        )}

        <TextField
          label="Specialty and work you are qualified to undertake"
          value={specialty}
          onChangeText={setSpecialty}
          placeholder="e.g. low-voltage wiring"
          maxLength={SKILL_SPECIALTY_MAX_LENGTH}
          autoCapitalize="none"
          className="mb-3"
        />

        <Picker
          label="Self-assessed proficiency"
          value={proficiency}
          onChange={setProficiency}
          options={PROFICIENCY_OPTIONS}
          placeholder="Choose a level"
        />

        {error ? (
          <Text className="mt-3 text-xs leading-5 text-tone-danger">
            {error}
          </Text>
        ) : null}

        <Button
          label={submitting ? 'Saving…' : 'Save trade details'}
          loading={submitting}
          onPress={onSubmit}
          className="mt-4"
        />
      </ScrollView>
      )}

      <Text className="mt-4 text-xs leading-5 text-muted">
        Previously saved skills cannot be displayed yet. Only add a trade you
        have not already submitted.
      </Text>
      <Text className="mt-3 text-[13px] font-semibold text-ink">
        Before you start work at a site
      </Text>
      <Text className="mt-1 text-xs leading-5 text-muted">
        Arrange a review with the site administrator covering your identity,
        relevant work history and references, qualifications, applicable trade
        licences and expiry dates, and insurance appropriate to the work.
        Requirements depend on the trade and location.
      </Text>
      <Text className="mt-2 text-xs leading-5 text-muted">
        Secure evidence uploads and approval tracking are not available yet. Do
        not enter identity numbers or document links here. A saved trade or
        site contract is not proof of vetting.
      </Text>
    </Card>
  );
}
