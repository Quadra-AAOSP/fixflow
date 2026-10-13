import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Check, ClipboardList, Plug, ShieldCheck } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Picker } from '@/components/ui/Picker';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { TextField } from '@/components/ui/TextField';
import { canDecideContracts, roleLabels } from '@/constants/access';
import { themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import { createTechnicianContract } from '@/services/technician';
import { listSites } from '@/services/sites';
import type {
  ContractApplication,
  ContractApplicationStatus,
  Site,
} from '@/types';
import { formatDate, humanize } from '@/utils/format';

/**
 * Site contracts. Mirrors `ContractsView.vue`. Two faces:
 *
 *   - `technician`                              → "Online requests unavailable"
 *                                                + a list of their own
 *                                                applications (read-only)
 *   - `admin | super_admin`                     → record form to bind a
 *                                                technician to a site, plus a
 *                                                pending-applications queue
 *
 * The technician is currently identified by numeric user ID because the
 * backend doesn't expose a public technician directory yet (see
 * `lib/endpoints.ts` trailing comment).
 */
export default function ContractsScreen() {
  const palette = themeColors();
  const { user } = useAuth();
  const isAdmin =
    user !== null && canDecideContracts(user.role);
  const isTechnician = user?.role === 'technician';

  const [applications, setApplications] = useState<ContractApplication[] | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await listContractApplicationsSafe();
      setApplications(result);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not load contract applications.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user) return null;

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="px-5 pb-12 pt-4"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-5 flex-row items-center gap-3">
          <View className="rounded-xl bg-accent/20 p-3">
            <Plug color={palette.accentForeground} size={26} />
          </View>
          <View className="flex-1">
            <Text className="text-xl font-bold text-ink">Site contracts</Text>
            <Text className="mt-0.5 text-xs text-muted">
              {isAdmin
                ? 'Bind technicians to your site once they consent.'
                : isTechnician
                  ? 'Apply for site contracts and track approvals.'
                  : roleLabels[user.role]}
            </Text>
          </View>
        </View>

        {error ? (
          <StateView
            variant="error"
            title="Could not load contracts"
            description={error}
            actionLabel="Retry"
            onAction={() => {
              void load();
            }}
            className="py-6"
          />
        ) : null}

        {isTechnician ? <TechnicianView applications={applications} loading={loading} /> : null}
        {isAdmin ? <AdminView onCreated={load} /> : null}

        {applications && applications.length > 0 ? (
          <View className="mt-6">
            <Text className="mb-2 text-base font-semibold text-ink">
              Recent applications
            </Text>
            {applications.slice(0, 5).map((app) => (
              <ApplicationRow key={app.id} application={app} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function ApplicationRow({ application }: { application: ContractApplication }) {
  const palette = themeColors();
  return (
    <View className="mb-2 rounded-xl border border-border bg-card p-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-ink">
          Application #{application.id}
        </Text>
        <StatusPill status={application.status} />
      </View>
      <Text className="mt-1 text-xs text-muted">
        Submitted {formatDate(application.createdAt, true)}
      </Text>
      {application.note ? (
        <Text className="mt-2 text-xs text-ink" numberOfLines={2}>
          {application.note}
        </Text>
      ) : null}
    </View>
  );
}

const PILL_BG: Record<ContractApplicationStatus, string> = {
  pending: 'bg-tone-warning/15',
  approved: 'bg-tone-success/15',
  rejected: 'bg-tone-danger/15',
};

const PILL_TEXT: Record<ContractApplicationStatus, string> = {
  pending: 'text-tone-warning',
  approved: 'text-tone-success',
  rejected: 'text-tone-danger',
};

function StatusPill({ status }: { status: ContractApplicationStatus }) {
  return (
    <View className={`rounded-md px-2.5 py-1 ${PILL_BG[status]}`}>
      <Text
        className={`text-xs font-semibold ${PILL_TEXT[status]}`}
      >
        {humanize(status)}
      </Text>
    </View>
  );
}

function TechnicianView({
  applications,
  loading,
}: {
  applications: ContractApplication[] | null;
  loading: boolean;
}) {
  const palette = themeColors();
  return (
    <>
      <Card className="mb-4">
        <View className="flex-row items-start gap-3">
          <View className="rounded-lg bg-primary/15 p-2">
            <ShieldCheck color={palette.primary} size={20} />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-ink">
              Online contract requests aren't available yet
            </Text>
            <Text className="mt-1 text-xs leading-5 text-muted">
              Until the marketplace launches, contracts are negotiated with a
              site manager directly. Your existing applications are listed
              below.
            </Text>
          </View>
        </View>
      </Card>
      <Card padded={false} className="mb-4">
        <Pressable
          disabled
          accessibilityRole="button"
          className="px-4 py-3 opacity-50"
        >
          <Text className="text-sm font-semibold text-ink">
            Apply for a contract
          </Text>
          <Text className="mt-0.5 text-xs text-muted">
            Coming soon.
          </Text>
        </Pressable>
      </Card>
      {loading ? (
        <View className="py-6">
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      ) : null}
    </>
  );
}

function AdminView({ onCreated }: { onCreated: () => void }) {
  const palette = themeColors();
  const [sites, setSites] = useState<Site[] | null>(null);
  const [loadingSites, setLoadingSites] = useState(false);
  const [sitesError, setSitesError] = useState<string | null>(null);
  const [siteId, setSiteId] = useState<number | null>(null);
  const [technicianIdText, setTechnicianIdText] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingSites(true);
      setSitesError(null);
      try {
        const result = await listSites();
        if (!cancelled) {
          setSites(result);
          if (result.length > 0 && siteId === null) {
            setSiteId(result[0].id);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setSitesError(
            err instanceof ApiError ? err.message : 'Could not load sites.',
          );
        }
      } finally {
        if (!cancelled) setLoadingSites(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const siteOptions = useMemo(
    () => (sites ?? []).map((site) => ({ value: String(site.id), label: site.name })),
    [sites],
  );

  async function onSubmit() {
    if (siteId === null) {
      setError('Choose a site.');
      return;
    }
    const parsedTechnicianId = Number(technicianIdText);
    if (
      technicianIdText.length === 0 ||
      !Number.isInteger(parsedTechnicianId) ||
      parsedTechnicianId <= 0
    ) {
      setError('Technician ID must be a positive integer.');
      return;
    }
    if (!consent) {
      setError('Confirm consent before recording a contract.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createTechnicianContract({
        technicianId: parsedTechnicianId,
        siteId,
      });
      setConfirmation('Contract recorded.');
      setConsent(false);
      setTechnicianIdText('');
      onCreated();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not record the contract.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingSites && sites === null) {
    return (
      <View className="py-6">
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  if (sitesError) {
    return (
      <StateView
        variant="error"
        title="Could not load sites"
        description={sitesError}
      />
    );
  }

  return (
    <Card>
      <View className="mb-3 flex-row items-center gap-2">
        <ClipboardList color={palette.muted} size={18} />
        <Text className="text-base font-semibold text-ink">Record contract</Text>
      </View>
      <Text className="mb-3 text-xs leading-5 text-muted">
        Bind a technician to one of your sites after they consent. The backend
        does not expose a technician directory yet, so the technician is
        identified by their numeric user ID.
      </Text>

      <Picker
        label="Site"
        value={siteId !== null ? String(siteId) : null}
        onChange={(value) => setSiteId(Number(value))}
        options={siteOptions}
      />

      <TextField
        label="Technician user ID"
        value={technicianIdText}
        onChangeText={setTechnicianIdText}
        placeholder="e.g. 42"
        keyboardType="number-pad"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Pressable
        onPress={() => setConsent(!consent)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: consent }}
        className="mb-3 flex-row items-start gap-3 rounded-lg border border-border bg-card p-3 active:opacity-70"
      >
        <View
          className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${
            consent ? 'border-primary bg-primary' : 'border-border bg-card'
          }`}
        >
          {consent ? <Check color={palette.primaryForeground} size={14} /> : null}
        </View>
        <Text className="flex-1 text-xs leading-5 text-ink">
          The technician has explicitly consented to this contract. Do not
          record a contract without consent.
        </Text>
      </Pressable>

      {error ? <Text className="mb-3 text-xs text-tone-danger">{error}</Text> : null}
      {confirmation ? (
        <View className="mb-3 flex-row items-center gap-1.5">
          <Check color={palette.tone.success} size={14} />
          <Text className="text-xs text-tone-success">{confirmation}</Text>
        </View>
      ) : null}

      <Button
        label={submitting ? 'Recording…' : 'Record contract'}
        loading={submitting}
        onPress={onSubmit}
      />
    </Card>
  );
}

/**
 * Wraps the contract-applications list with graceful failure when the
 * endpoint isn't available — the inventory notes that GET
 * /api/technician-contracts is unimplemented, so the technician view is
 * effectively read-only and an empty list is the safe default.
 */
async function listContractApplicationsSafe(): Promise<ContractApplication[]> {
  // The technician-facing call is intentionally scoped to "my applications"
  // server-side; if the endpoint returns 404, treat the queue as empty.
  const { listContractApplications } = await import('@/services/technician');
  try {
    return await listContractApplications();
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return [];
    }
    throw err;
  }
}
