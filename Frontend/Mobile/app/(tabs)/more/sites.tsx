import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { MapPin, Plus } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { Picker } from '@/components/ui/Picker';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { SiteCard } from '@/components/ui/SiteCard';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/hooks/useAuth';
import { canCreateSite, canEditSite } from '@/constants/access';
import { dashboardColors, themeColors } from '@/constants/theme';
import { ApiError } from '@/lib/apiClient';
import { createSite, listSites, updateSite } from '@/services/sites';
import { useCurrentSite } from '@/stores/site';
import type { ContractStatus, Site, SiteType } from '@/types';
import type { SitePayload } from '@/services/sites';
import { humanize } from '@/utils/format';

const SITE_TYPES: { value: SiteType; label: string }[] = [
  { value: 'school', label: 'School' },
  { value: 'hostel', label: 'Hostel' },
  { value: 'hotel', label: 'Hotel' },
];

const CONTRACT_STATUSES: { value: ContractStatus; label: string }[] = [
  { value: 'contracted', label: 'Contracted' },
  { value: 'uncontracted', label: 'Uncontracted' },
];

/**
 * Sites management. Visible to `admin` and `super_admin`; only `super_admin`
 * sees the "Add site" CTA. Mirrors `SitesView.vue` on the web build — the
 * card heading has a mint "Add site" CTA, the body shows a grid of
 * `SiteCard`s with image / placeholder, and the editor is a `ModalSheet`.
 */
export default function SitesScreen() {
  const router = useRouter();
  const palette = themeColors();
  const { user } = useAuth();
  const { setActiveSite } = useCurrentSite();
  const canCreate = user ? canCreateSite(user.role) : false;
  const canEdit = user ? canEditSite(user.role) : false;

  const [sites, setSites] = useState<Site[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Site | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    if (sites === null) setLoading(true);
    try {
      const result = await listSites();
      setSites(result);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not load sites.',
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  /** Selects the tapped site before navigating — the web calls
      `data.selectSite(id)` first (`SitesView.vue`), so "View reports"
      is scoped to that site. */
  function viewReports(siteId: number) {
    setActiveSite(siteId);
    router.push('/reports');
  }

  if (error && sites === null) {
    return (
      <Screen>
        <StateView
          variant="error"
          title="Could not load sites"
          description={error}
          actionLabel="Retry"
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
        {/* Card heading — mirrors the web's `.card-heading`: title on the
            left, "Add site" mint CTA on the right when the actor is
            super_admin. */}
        <View className="mb-4 flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text
              className="text-2xl font-bold text-ink"
              style={{ letterSpacing: -0.5 }}
            >
              Your sites
            </Text>
            <Text className="mt-0.5 text-xs text-dashboard-subtitle">
              {sites
                ? `${sites.length} ${sites.length === 1 ? 'site' : 'sites'} available to your account`
                : 'Sites available to your account'}
            </Text>
          </View>
          {canCreate ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setCreating(true)}
              className="flex-row items-center gap-1.5 rounded-[11px] border px-3.5 py-2 active:opacity-90"
              style={{
                backgroundColor: dashboardColors.ctaBg,
                borderColor: dashboardColors.ctaBorder,
              }}
            >
              <Plus color={dashboardColors.ctaText} size={16} strokeWidth={2.4} />
              <Text
                className="text-[13px] font-semibold"
                style={{ color: dashboardColors.ctaText }}
              >
                Add site
              </Text>
            </Pressable>
          ) : null}
        </View>

        {sites === null && loading ? (
          <View className="py-12">
            <ActivityIndicator size="large" color={palette.primary} />
          </View>
        ) : sites && sites.length === 0 ? (
          <StateView
            variant="empty"
            icon={MapPin}
            title="No sites yet"
            description={
              canCreate
                ? 'Add your first site to start collecting maintenance reports.'
                : 'No sites have been created yet.'
            }
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
            {sites?.map((site) => (
              <View key={site.id} className="mb-3">
                {site.imageUrl ? (
                  <SiteHero
                    url={site.imageUrl}
                    name={site.name}
                    onPress={() => viewReports(site.id)}
                  />
                ) : null}
                <SiteCard
                  site={site}
                  onPress={() => viewReports(site.id)}
                  onEdit={canEdit ? () => setEditing(site) : undefined}
                />
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      <SiteEditor
        visible={creating || editing !== null}
        initial={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => {
          setCreating(false);
          setEditing(null);
          void load();
        }}
        onError={(message) =>
          Alert.alert('Could not save site', message, [{ text: 'OK' }])
        }
      />
    </Screen>
  );
}

function SiteHero({
  url,
  name,
  onPress,
}: {
  url: string;
  name: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="image"
      accessibilityLabel={`${name} cover image`}
      className="mb-2 h-32 overflow-hidden rounded-xl"
    >
      <Image
        source={{ uri: url }}
        resizeMode="cover"
        style={{ width: '100%', height: '100%' }}
      />
    </Pressable>
  );
}

type SiteEditorProps = {
  visible: boolean;
  initial: Site | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
};

function SiteEditor({ visible, initial, onClose, onSaved, onError }: SiteEditorProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<SiteType>(initial?.type ?? 'school');
  const [contractStatus, setContractStatus] = useState<ContractStatus>(
    initial?.contractStatus ?? 'uncontracted',
  );
  const [address, setAddress] = useState(initial?.address ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed the form whenever the target changes (different site, or a
  // closed-and-reopened modal pointing at nothing).
  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setType(initial.type);
      setContractStatus(initial.contractStatus);
      setAddress(initial.address ?? '');
      setDescription(initial.description ?? '');
      setImageUrl(initial.imageUrl ?? '');
    } else {
      setName('');
      setType('school');
      setContractStatus('uncontracted');
      setAddress('');
      setDescription('');
      setImageUrl('');
    }
    setError(null);
  }, [initial, visible]);

  async function onSubmit() {
    if (name.trim().length === 0) {
      setError('Name is required.');
      return;
    }
    const trimmedImage = imageUrl.trim();
    if (trimmedImage.length > 0 && !/^https?:\/\//.test(trimmedImage)) {
      setError('Image URL must start with http:// or https://');
      return;
    }
    const payload: SitePayload = {
      name: name.trim(),
      type,
      contractStatus,
      address: address.trim().length > 0 ? address.trim() : undefined,
      description:
        description.trim().length > 0 ? description.trim() : undefined,
      imageUrl: trimmedImage.length > 0 ? trimmedImage : undefined,
    };
    setSubmitting(true);
    setError(null);
    try {
      if (initial) {
        await updateSite(initial.id, payload);
      } else {
        await createSite(payload);
      }
      onSaved();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Could not save the site.';
      setError(message);
      onError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalSheet
      visible={visible}
      title={initial ? 'Edit site' : 'Add site'}
      onClose={onClose}
      busy={submitting}
      footer={
        <Button
          label={submitting ? 'Saving…' : initial ? 'Save changes' : 'Create site'}
          loading={submitting}
          onPress={onSubmit}
        />
      }
    >
      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Main Campus"
        autoCapitalize="words"
      />
      <Picker
        label="Type"
        value={type}
        onChange={(value) => setType(value as SiteType)}
        options={SITE_TYPES}
      />
      <Picker
        label="Contract status"
        value={contractStatus}
        onChange={(value) => setContractStatus(value as ContractStatus)}
        options={CONTRACT_STATUSES}
      />
      <TextField
        label="Address"
        value={address}
        onChangeText={setAddress}
        placeholder="Optional"
        autoCapitalize="words"
      />
      <TextField
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Optional"
        multiline
        numberOfLines={3}
      />
      <TextField
        label="Image URL"
        value={imageUrl}
        onChangeText={setImageUrl}
        placeholder="https://"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      {error ? <Text className="text-xs text-tone-danger">{error}</Text> : null}
    </ModalSheet>
  );
}
