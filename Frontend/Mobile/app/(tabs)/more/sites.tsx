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
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('common');
  const { setActiveSite } = useCurrentSite();
  const canCreate = user ? canCreateSite(user) : false;
  const canEdit = user ? canEditSite(user) : false;

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
        err instanceof ApiError ? err.message : t('more.sites.couldNotLoad'),
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
          title={t('more.sites.couldNotLoadTitle')}
          description={error}
          actionLabel={t('more.sites.retry')}
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
              {t('more.sites.title')}
            </Text>
            <Text className="mt-0.5 text-xs text-dashboard-subtitle">
              {sites
                ? t('more.sites.count', {
                    count: sites.length,
                    plural: sites.length === 1 ? '' : 's',
                  })
                : t('more.sites.available')}
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
                {t('more.sites.addSite')}
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
            title={t('more.sites.emptyTitle')}
            description={
              canCreate
                ? t('more.sites.emptyDescCreate')
                : t('more.sites.emptyDesc')
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
                    t={t}
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
        t={t}
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
          Alert.alert(t('more.sites.couldNotSaveSite'), message, [
            { text: t('more.sites.ok') },
          ])
        }
      />
    </Screen>
  );
}

type TranslateFn = (key: string, vars?: Record<string, unknown>) => string;

function SiteHero({
  url,
  name,
  onPress,
  t,
}: {
  url: string;
  name: string;
  onPress: () => void;
  t: TranslateFn;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="image"
      accessibilityLabel={t('more.sites.coverImageA11y', { name })}
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
  t: TranslateFn;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
};

function SiteEditor({ visible, initial, t, onClose, onSaved, onError }: SiteEditorProps) {
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
      setError(t('more.sites.errors.nameRequired'));
      return;
    }
    const trimmedImage = imageUrl.trim();
    if (trimmedImage.length > 0 && !/^https?:\/\//.test(trimmedImage)) {
      setError(t('more.sites.errors.imageUrl'));
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
        err instanceof ApiError
          ? err.message
          : t('more.sites.errors.couldNotSave');
      setError(message);
      onError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalSheet
      visible={visible}
      title={initial ? t('more.sites.editSite') : t('more.sites.addSite')}
      onClose={onClose}
      busy={submitting}
      footer={
        <Button
          label={
            submitting
              ? t('more.sites.saving')
              : initial
                ? t('more.sites.saveChanges')
                : t('more.sites.createSite')
          }
          loading={submitting}
          onPress={onSubmit}
        />
      }
    >
      <TextField
        label={t('more.sites.nameLabel')}
        value={name}
        onChangeText={setName}
        placeholder={t('more.sites.namePlaceholder')}
        autoCapitalize="words"
      />
      <Picker
        label={t('more.sites.typeLabel')}
        value={type}
        onChange={(value) => setType(value as SiteType)}
        options={SITE_TYPES}
      />
      <Picker
        label={t('more.sites.contractStatusLabel')}
        value={contractStatus}
        onChange={(value) => setContractStatus(value as ContractStatus)}
        options={CONTRACT_STATUSES}
      />
      <TextField
        label={t('more.sites.addressLabel')}
        value={address}
        onChangeText={setAddress}
        placeholder={t('more.sites.optionalPlaceholder')}
        autoCapitalize="words"
      />
      <TextField
        label={t('more.sites.descriptionLabel')}
        value={description}
        onChangeText={setDescription}
        placeholder={t('more.sites.optionalPlaceholder')}
        multiline
        numberOfLines={3}
      />
      <TextField
        label={t('more.sites.imageUrlLabel')}
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
