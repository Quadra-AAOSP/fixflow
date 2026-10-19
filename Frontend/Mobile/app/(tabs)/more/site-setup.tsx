import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  Archive,
  Building2,
  CheckCircle2,
  Pencil,
  Plus,
  TriangleAlert,
  X,
} from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { TextField } from '@/components/ui/TextField';
import { canManageSubsites } from '@/constants/access';
import { dashboardColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import {
  archiveSubsite,
  createSubsite,
  getReportingSetup,
  listSubsites,
  updateSubsite,
} from '@/services/sites';
import { useCurrentSite } from '@/stores/site';
import type { ReportingSetup, Subsite } from '@/types';

/**
 * Site setup — the admin's subsite (building/area) manager, driven by the
 * backend's live readiness check (`GET reporting-setup`). A site is ready for
 * reporting while it has at least one non-archived subsite; archiving the
 * last one flips the site back to "setup required".
 *
 * There is no web counterpart screen — on the web this lives inside the site
 * editor. Mobile gives it a dedicated route so the Home setup banner has
 * somewhere to deep-link.
 */
export default function SiteSetupScreen() {
  const { user, refresh: refreshAuth } = useAuth();
  const { site } = useCurrentSite();
  const siteId = site?.id ?? user?.siteOnboarding?.siteId ?? user?.siteId ?? null;

  const [setup, setSetup] = useState<ReportingSetup | null>(null);
  const [subsites, setSubsites] = useState<Subsite[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state — `editing` non-null switches the form into update mode.
  const [editing, setEditing] = useState<Subsite | null>(null);
  const [label, setLabel] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (siteId === null) return;
    setLoading(true);
    setError(null);
    try {
      const [nextSetup, nextSubsites] = await Promise.all([
        getReportingSetup(siteId),
        listSubsites(siteId),
      ]);
      setSetup(nextSetup);
      setSubsites(nextSubsites);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not load site setup.',
      );
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function resetForm() {
    setEditing(null);
    setLabel('');
    setName('');
    setDescription('');
    setFormError(null);
  }

  function startEdit(subsite: Subsite) {
    setEditing(subsite);
    setLabel(subsite.label);
    setName(subsite.name);
    setDescription(subsite.description ?? '');
    setFormError(null);
  }

  async function onSubmit() {
    if (siteId === null) return;
    const trimmedLabel = label.trim();
    const trimmedName = name.trim();
    if (!trimmedLabel || !trimmedName) {
      setFormError('A label and a name are required (e.g. E5, Classroom building).');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const payload = {
        label: trimmedLabel,
        name: trimmedName,
        description: description.trim() || undefined,
      };
      if (editing) {
        await updateSubsite(siteId, editing.id, payload);
      } else {
        await createSubsite(siteId, payload);
      }
      resetForm();
      await load();
      // The Home setup banner reads `user.siteOnboarding.setupRequired` —
      // refresh /me so it clears as soon as the first building lands.
      await refreshAuth().catch(() => {});
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : 'Could not save the building.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function confirmArchive(subsite: Subsite) {
    Alert.alert(
      `Archive ${subsite.label}?`,
      'Reporters will no longer be able to select this building. Existing reports keep their location.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              if (siteId === null) return;
              try {
                await archiveSubsite(siteId, subsite.id);
                if (editing?.id === subsite.id) resetForm();
                await load();
                await refreshAuth().catch(() => {});
              } catch (err) {
                setError(
                  err instanceof ApiError
                    ? err.message
                    : 'Could not archive the building.',
                );
              }
            })();
          },
        },
      ],
    );
  }

  if (!user || !canManageSubsites(user)) {
    return (
      <Screen>
        <StateView
          variant="empty"
          icon={Building2}
          title="Site administrators only"
          description="Only the administrator of a site can manage its buildings and areas."
        />
      </Screen>
    );
  }

  if (siteId === null) {
    return (
      <Screen>
        <StateView
          variant="empty"
          icon={Building2}
          title="No site linked"
          description="A site must be linked to your account before buildings can be set up."
        />
      </Screen>
    );
  }

  const activeSubsites = (subsites ?? []).filter((s) => s.archivedAt === null);
  const archivedSubsites = (subsites ?? []).filter((s) => s.archivedAt !== null);

  return (
    <Screen>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="px-5 pb-12 pt-4"
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-4">
            <Text
              className="text-2xl font-bold text-ink"
              style={{ letterSpacing: -0.5 }}
            >
              Site setup
            </Text>
            <Text className="mt-1 text-[13px] leading-[1.7] text-dashboard-subtitle">
              Add the labelled buildings and areas reporters pick from when
              filing a report, for example E5 / Classroom building.
            </Text>
          </View>

          {error ? (
            <StateView
              variant="error"
              description={error}
              actionLabel="Retry"
              onAction={() => {
                void load();
              }}
            />
          ) : null}

          {/* Readiness header — recalculated by the backend on every load. */}
          {setup ? (
            <Card className="mb-4">
              <View className="flex-row items-center gap-3">
                <View
                  className="h-10 w-10 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: setup.reportingReady
                      ? dashboardColors.statMintSoft
                      : dashboardColors.statCoralSoft,
                  }}
                >
                  {setup.reportingReady ? (
                    <CheckCircle2
                      color={dashboardColors.statMintDeep}
                      size={20}
                      strokeWidth={1.9}
                    />
                  ) : (
                    <TriangleAlert
                      color={dashboardColors.statCoralDeep}
                      size={20}
                      strokeWidth={1.9}
                    />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-[14px] font-semibold text-ink">
                    {setup.reportingReady
                      ? 'Reporting is ready'
                      : 'Setup required'}
                  </Text>
                  <Text className="mt-0.5 text-[11px] leading-[1.6] text-dashboard-subtitle">
                    {setup.reportingReady
                      ? `${setup.activeSubsiteCount} active building${
                          setup.activeSubsiteCount === 1 ? '' : 's'
                        } — reporters can file reports.`
                      : 'Add at least one building before reporters can file reports.'}
                  </Text>
                </View>
              </View>
            </Card>
          ) : null}

          {loading && subsites === null ? (
            <StateView variant="loading" title="Loading buildings…" />
          ) : null}

          {/* Add / edit form. */}
          <Card className="mb-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text
                className="text-[15px] font-semibold text-ink"
                style={{ letterSpacing: -0.3 }}
              >
                {editing ? `Edit ${editing.label}` : 'Add a building'}
              </Text>
              {editing ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cancel edit"
                  onPress={resetForm}
                  className="flex-row items-center gap-1 active:opacity-70"
                >
                  <X color={dashboardColors.subtitle} size={13} />
                  <Text className="text-[11px] font-medium text-dashboard-subtitle">
                    Cancel edit
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <View className="flex-row gap-3">
              <View className="w-24">
                <TextField
                  label="Label"
                  value={label}
                  onChangeText={setLabel}
                  maxLength={64}
                  placeholder="E5"
                  autoCapitalize="characters"
                />
              </View>
              <View className="flex-1">
                <TextField
                  label="Name"
                  value={name}
                  onChangeText={setName}
                  maxLength={255}
                  placeholder="Classroom building"
                  autoCapitalize="words"
                />
              </View>
            </View>
            <TextField
              label="Description (optional)"
              value={description}
              onChangeText={setDescription}
              maxLength={2000}
              placeholder="Floors, wings, or access notes"
            />
            {formError ? (
              <View className="mb-3 rounded-md bg-dashboard-error-bg px-3 py-2">
                <Text className="text-[11px] leading-[1.7] text-dashboard-error-text">
                  {formError}
                </Text>
              </View>
            ) : null}
            <Button
              label={
                submitting
                  ? editing
                    ? 'Saving…'
                    : 'Adding…'
                  : editing
                    ? 'Save changes'
                    : 'Add building'
              }
              loading={submitting}
              onPress={() => {
                void onSubmit();
              }}
            />
          </Card>

          {/* Building list. */}
          {subsites !== null ? (
            <Card padded={false} className="mb-4">
              <View className="px-4 pb-2 pt-4">
                <Text
                  className="text-[15px] font-semibold text-ink"
                  style={{ letterSpacing: -0.3 }}
                >
                  Buildings &amp; areas
                </Text>
                <Text className="mt-0.5 text-[10px] text-dashboard-caption">
                  {activeSubsites.length} active
                  {archivedSubsites.length > 0
                    ? ` · ${archivedSubsites.length} archived`
                    : ''}
                </Text>
              </View>

              {subsites.length === 0 ? (
                <Text className="px-4 pb-4 text-center text-[11px] text-dashboard-empty">
                  No buildings yet — add the first one above.
                </Text>
              ) : (
                subsites.map((subsite, index) => {
                  const archived = subsite.archivedAt !== null;
                  return (
                    <View key={subsite.id}>
                      {index > 0 ? (
                        <View className="mx-4 border-t border-dashboard-card-line" />
                      ) : null}
                      <View
                        className={`flex-row items-center gap-3 px-4 py-3 ${
                          archived ? 'opacity-50' : ''
                        }`}
                      >
                        <View
                          className="rounded-md px-2 py-1"
                          style={{
                            backgroundColor: dashboardColors.statMintSoft,
                          }}
                        >
                          <Text
                            className="text-[11px] font-bold"
                            style={{ color: dashboardColors.statMintDeep }}
                          >
                            {subsite.label}
                          </Text>
                        </View>
                        <View className="flex-1">
                          <Text
                            className="text-[12px] font-semibold text-ink"
                            numberOfLines={1}
                          >
                            {subsite.name}
                            {archived ? ' · Archived' : ''}
                          </Text>
                          {subsite.description ? (
                            <Text
                              className="mt-0.5 text-[10px] text-dashboard-subtitle"
                              numberOfLines={1}
                            >
                              {subsite.description}
                            </Text>
                          ) : null}
                        </View>
                        {!archived ? (
                          <>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Edit ${subsite.label}`}
                              onPress={() => startEdit(subsite)}
                              className="p-1.5 active:opacity-60"
                            >
                              <Pencil
                                color={dashboardColors.teal}
                                size={16}
                                strokeWidth={1.8}
                              />
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Archive ${subsite.label}`}
                              onPress={() => confirmArchive(subsite)}
                              className="p-1.5 active:opacity-60"
                            >
                              <Archive
                                color={dashboardColors.statCoralDeep}
                                size={16}
                                strokeWidth={1.8}
                              />
                            </Pressable>
                          </>
                        ) : null}
                      </View>
                    </View>
                  );
                })
              )}
            </Card>
          ) : null}

          {subsites !== null && subsites.length === 0 ? (
            <View className="flex-row items-start gap-2 px-1">
              <Plus color={dashboardColors.teal} size={14} />
              <Text className="flex-1 text-[10px] leading-[1.7] text-dashboard-caption">
                Buildings appear in the reporter&apos;s location picker as soon
                as they are added. The backend cannot know whether every real
                building has been entered — add each one your reporters need.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
