import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { House } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Picker } from '@/components/ui/Picker';
import { Screen } from '@/components/ui/Screen';
import {
  SegmentedControl,
  type SegmentedOption,
} from '@/components/ui/SegmentedControl';
import { StateView } from '@/components/ui/StateView';
import { TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/apiClient';
import { createReport } from '@/services/reports';
import { listSiteRules } from '@/services/siteRules';
import type { SiteRule, Urgency } from '@/types';
import { useCurrentSite } from '@/stores/site';

const URGENCY_OPTIONS: SegmentedOption<Urgency>[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export default function NewReportScreen() {
  const router = useRouter();
  const {
    site,
    loading: siteLoading,
    error: siteError,
    refresh: refreshSite,
  } = useCurrentSite();

  const [rules, setRules] = useState<SiteRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState<string | null>(null);

  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [urgency, setUrgency] = useState<Urgency>('medium');
  const [reason, setReason] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Load the category / urgency taxonomy for this site's site type. We
  // re-load on site change so the picker stays in sync if the user swaps
  // sites (Phase 9 super_admin switcher) or logs in as a different actor.
  useEffect(() => {
    const siteType = site?.type;
    if (!siteType) return;

    let cancelled = false;
    setRulesLoading(true);
    setRulesError(null);
    setRules([]);
    setCategory(null);

    (async () => {
      try {
        const result = await listSiteRules(siteType);
        if (!cancelled) setRules(result);
      } catch (err) {
        if (!cancelled) {
          setRulesError(
            err instanceof ApiError
              ? err.message
              : 'Could not load the category list.',
          );
        }
      } finally {
        if (!cancelled) setRulesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [site?.type, site?.id]);

  async function onSubmit() {
    setError(null);
    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      setError('Please describe the issue.');
      return;
    }
    if (!category) {
      setError('Please pick a category.');
      return;
    }
    if (!site) {
      setError('Site is not loaded yet. Please try again in a moment.');
      return;
    }

    setSubmitting(true);
    try {
      await createReport({
        description: trimmedDescription,
        address: address.trim() || undefined,
        category,
        reporterUrgency: urgency,
        reporterReason: reason.trim() || undefined,
        // Always send the active site. `ReportService.resolveSiteForCreate`
        // *requires* siteId from super_admin, and for every other role it
        // only validates that the value matches the actor's own site — which
        // it always does here, since their site list has exactly one entry.
        siteId: site.id,
      });
      // Hand off to the reports list so the user immediately sees the
      // new entry. `replace` (not `back`) avoids leaving a stale form on
      // the stack.
      router.replace('/reports');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unable to reach the server.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Home gates this route behind a linked site, but a deep link or a stale
  // selection can still land here — handle all three states rather than
  // rendering a form that cannot submit.
  if (!site) {
    if (siteLoading) {
      return (
        <Screen>
          <StateView variant="loading" title="Loading site…" />
        </Screen>
      );
    }
    if (siteError) {
      return (
        <Screen>
          <StateView
            variant="error"
            title="Could not load site"
            description={siteError.message}
            actionLabel="Retry"
            onAction={() => {
              void refreshSite();
            }}
          />
        </Screen>
      );
    }
    return (
      <Screen>
        <StateView
          variant="empty"
          icon={House}
          title="No site linked"
          description="A site must be linked before you can file a report."
        />
      </Screen>
    );
  }

  const categoryOptions = rules.map((r) => ({
    value: r.category,
    label: r.category,
  }));

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
          <Text className="mb-6 text-sm text-muted">
            Filing against {site.name} · {site.type}
          </Text>

          <TextField
            label="Description"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            placeholder="What's wrong and where?"
          />
          <TextField
            label="Address (optional)"
            value={address}
            onChangeText={setAddress}
            placeholder="e.g. Block B, Room 204"
          />

          <Picker
            label="Category"
            value={category}
            options={categoryOptions}
            onChange={setCategory}
            placeholder={
              rulesLoading ? 'Loading categories…' : 'Pick a category'
            }
            emptyMessage={
              rulesError ?? 'No categories available for this site type.'
            }
            disabled={rulesLoading || rules.length === 0}
          />

          <Text className="mb-2 text-sm font-medium text-ink">Urgency</Text>
          <SegmentedControl
            options={URGENCY_OPTIONS}
            value={urgency}
            onChange={setUrgency}
            className="mb-5"
          />

          <TextField
            label="Why this urgency? (optional)"
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={2}
            placeholder="Add context for the technician."
          />

          {error ? (
            <Text className="mb-3 text-sm text-tone-danger">{error}</Text>
          ) : null}

          <Button
            label="Submit report"
            loading={submitting}
            onPress={onSubmit}
          />
          <View className="h-12" />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}