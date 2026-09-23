import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Wrench } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Picker } from '@/components/ui/Picker';
import { Screen } from '@/components/ui/Screen';
import {
  SegmentedControl,
  type SegmentedOption,
} from '@/components/ui/SegmentedControl';
import { StateView } from '@/components/ui/StateView';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import { listAllSiteRules } from '@/services/siteRules';
import { createTechnicianSkill } from '@/services/technicians';
import type { SiteRule, TechnicianSkill } from '@/types';

type ProficiencyLevel = '1' | '2' | '3' | '4' | '5';

const PROFICIENCY_OPTIONS: SegmentedOption<ProficiencyLevel>[] = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
];

/**
 * Declare a technician's trades.
 *
 * Why this screen looks the way it does — three backend constraints, all
 * verified against the Java source rather than assumed:
 *
 * 1. There is no READ endpoint for technician skills (`TechnicianSkillController`
 *    is POST-only). The form therefore cannot show, diff, or delete what is
 *    already recorded. Rather than imply otherwise, it says so, and the list
 *    below is explicitly scoped to "this session".
 *
 * 2. The trade list is drawn from `site_rules`, not invented. The routing
 *    metric matches a report's `category` against a technician's skill
 *    `category`, and a report's category must itself come from `site_rules`
 *    (`CategoryTaxonomyService.requireAllowedCategory`). Free-text trades would
 *    therefore produce skills that can never match a report. `listAllSiteRules`
 *    (no `siteType` filter) is used because a marketplace-eligible technician
 *    has `siteId = null` and so has no site type to filter by.
 *
 * 3. A duplicate (technicianId, category, specialty) violates `uq_tech_skill`.
 *    Unlike `TechnicianContractService`, the skill service has no pre-check, so
 *    the violation escapes `GlobalExceptionHandler` (which does not map
 *    DataIntegrityViolationException) and surfaces as a bare 500. That case is
 *    called out specifically below instead of being shown as "server error".
 *
 * `specialty` intentionally stays free text: the schema states specialties are
 * "not in site_rules", so there is no taxonomy to pick from.
 */
export default function TechnicianSkillsScreen() {
  const { user } = useAuth();

  const [rules, setRules] = useState<SiteRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState<string | null>(null);

  const [category, setCategory] = useState<string | null>(null);
  const [specialty, setSpecialty] = useState('');
  const [proficiency, setProficiency] = useState<ProficiencyLevel>('3');
  const [technicianIdInput, setTechnicianIdInput] = useState('');

  const [added, setAdded] = useState<TechnicianSkill[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isTechnician = user?.role === 'technician';
  const canManageOthers =
    user?.role === 'admin' || user?.role === 'super_admin';
  const allowed = isTechnician || canManageOthers;

  useEffect(() => {
    let cancelled = false;
    setRulesLoading(true);
    setRulesError(null);

    (async () => {
      try {
        const result = await listAllSiteRules();
        if (!cancelled) setRules(result);
      } catch (err) {
        if (!cancelled) {
          setRulesError(
            err instanceof ApiError
              ? err.message
              : 'Could not load the trade list.',
          );
        }
      } finally {
        if (!cancelled) setRulesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Dedupe across site types: several site types can legitimately share a
  // trade (e.g. `plumbing`), and the picker must offer each trade once.
  const categoryOptions = useMemo(() => {
    const byNormalized = new Map<string, string>();
    for (const rule of rules) {
      const key = rule.category.trim().toLowerCase();
      if (key && !byNormalized.has(key)) {
        byNormalized.set(key, rule.category);
      }
    }
    return Array.from(byNormalized, ([value, label]) => ({ value, label })).sort(
      (a, b) => a.label.localeCompare(b.label),
    );
  }, [rules]);

  /** The technician a submission targets, or null if the input is unusable. */
  function resolveTargetTechnicianId(): number | null {
    if (!canManageOthers) {
      return user?.id ?? null;
    }
    const parsed = Number(technicianIdInput.trim());
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  function onSubmit() {
    setError(null);
    setSuccess(null);

    const targetTechnicianId = resolveTargetTechnicianId();
    if (targetTechnicianId === null) {
      setError(
        canManageOthers
          ? 'Enter the numeric ID of the technician to add this trade for.'
          : 'Your account is not available. Try signing in again.',
      );
      return;
    }
    if (!category) {
      setError('Pick a trade.');
      return;
    }

    // Cheap guard against the one duplicate we *can* detect: something added
    // earlier in this session. Anything older is invisible to us (constraint 1).
    const normalizedCategory = category.trim().toLowerCase();
    const normalizedSpecialty = specialty.trim().toLowerCase() || null;
    const alreadyAdded = added.some(
      (skill) =>
        skill.technicianId === targetTechnicianId &&
        skill.category === normalizedCategory &&
        skill.specialty === normalizedSpecialty,
    );
    if (alreadyAdded) {
      setError('You already added this trade in this session.');
      return;
    }

    void (async () => {
      setSubmitting(true);
      try {
        const created = await createTechnicianSkill({
          technicianId: targetTechnicianId,
          category,
          // Omit rather than send "" so the backend stores NULL (= generalist)
          // instead of an empty string, which would be a distinct unique key.
          specialty: normalizedSpecialty ?? undefined,
          proficiency: Number(proficiency),
        });
        setAdded((previous) => [created, ...previous]);
        setCategory(null);
        setSpecialty('');
        setProficiency('3');
        setSuccess(`Saved “${created.category}”.`);
      } catch (err) {
        setError(describeCreateError(err));
      } finally {
        setSubmitting(false);
      }
    })();
  }

  if (!allowed) {
    return (
      <Screen>
        <StateView
          variant="empty"
          icon={Wrench}
          title="Not available for your role"
          description="Only technicians declare their own trades. Staff and reporters cannot record skills."
        />
      </Screen>
    );
  }

  if (rulesLoading) {
    return (
      <Screen>
        <StateView variant="loading" title="Loading trades…" />
      </Screen>
    );
  }

  if (rulesError) {
    return (
      <Screen>
        <StateView
          variant="error"
          title="Could not load trades"
          description={rulesError}
          actionLabel="Retry"
          onAction={() => {
            setRulesLoading(true);
            setRulesError(null);
            listAllSiteRules()
              .then(setRules)
              .catch((err: unknown) => {
                setRulesError(
                  err instanceof ApiError
                    ? err.message
                    : 'Could not load the trade list.',
                );
              })
              .finally(() => {
                setRulesLoading(false);
              });
          }}
        />
      </Screen>
    );
  }

  if (categoryOptions.length === 0) {
    return (
      <Screen>
        <StateView
          variant="empty"
          icon={Wrench}
          title="No trades configured"
          description="No site rules exist yet, so there is no trade taxonomy to declare against. An admin must add site rules first."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="px-5 py-6"
          keyboardShouldPersistTaps="handled"
        >
          <Text className="mb-5 text-sm text-muted-foreground">
            Declare the trades you work on. Routing uses these to match you to
            reports at your sites.
          </Text>

          {canManageOthers ? (
            <TextField
              label="Technician ID"
              value={technicianIdInput}
              onChangeText={setTechnicianIdInput}
              keyboardType="number-pad"
              placeholder="e.g. 12"
            />
          ) : null}

          <Picker
            label="Trade"
            value={category}
            options={categoryOptions}
            onChange={setCategory}
            placeholder="Pick a trade"
          />

          <TextField
            label="Specialty (optional)"
            value={specialty}
            onChangeText={setSpecialty}
            autoCapitalize="none"
            placeholder="e.g. waste_plumbing"
          />
          <Text className="-mt-2 mb-4 text-xs text-muted-foreground">
            Leave blank to be a generalist in this trade. Specialties are not a
            fixed list, so match whatever wording your reports use — a
            specialist outranks a generalist for a report with the same
            specialty.
          </Text>

          <Text className="mb-2 text-sm font-medium text-foreground">
            Proficiency
          </Text>
          <SegmentedControl
            options={PROFICIENCY_OPTIONS}
            value={proficiency}
            onChange={setProficiency}
            className="mb-2"
          />
          <Text className="mb-5 text-xs text-muted-foreground">
            1 = just starting, 5 = expert. Depth is scored within a trade.
          </Text>

          {error ? (
            <Text className="mb-3 text-sm text-error">{error}</Text>
          ) : null}
          {success ? (
            <Text className="mb-3 text-sm text-success">{success}</Text>
          ) : null}

          <Button
            label="Add trade"
            loading={submitting}
            onPress={onSubmit}
          />

          {added.length > 0 ? (
            <View className="mt-6 rounded-xl border border-border bg-surface p-4">
              <Text className="mb-1 text-sm font-medium text-muted-foreground">
                Added in this session ({added.length})
              </Text>
              <Text className="mb-3 text-xs text-muted-foreground">
                This list is kept by the app, not the server. It disappears when
                you leave the screen.
              </Text>
              {added.map((skill) => (
                <View
                  key={skill.id}
                  className="flex-row items-center justify-between py-1"
                >
                  <Text className="text-sm text-foreground">
                    {skill.category}
                    {skill.specialty ? ` · ${skill.specialty}` : ' · generalist'}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Level {skill.proficiency}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <Text className="mt-6 text-xs text-muted-foreground">
            Trades cannot be listed back from the server yet, so this screen
            cannot show or remove what you have already saved. Adding the same
            trade twice is rejected.
          </Text>

          <View className="h-12" />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/**
 * Maps a failed create onto an explanation the user can act on.
 *
 * The 500 branch is not hand-waving: `TechnicianSkillService` performs no
 * duplicate check before insert, so a repeat of an existing
 * (technicianId, category, specialty) trips the `uq_tech_skill` unique key and
 * escapes `GlobalExceptionHandler` as an unmapped 500. The message states it as
 * a possibility rather than a certainty, because a genuine server fault would
 * look identical from here.
 */
function describeCreateError(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return 'Unable to reach the server.';
  }

  switch (err.status) {
    case 403:
      return 'You do not have permission to record skills for that technician.';
    case 409:
      return 'That trade is already recorded.';
    case 500:
      return 'The server rejected that. If you already recorded this trade, that is the likely cause — duplicates cannot be checked in advance yet.';
    case 400:
      return err.message;
    default:
      return err.message;
  }
}
