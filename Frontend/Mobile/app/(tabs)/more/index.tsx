import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import {
  ArrowRight,
  Building2,
  ClipboardList,
  FileText,
  Moon,
  NotepadText,
  ShieldCheck,
  ShoppingCart,
  ShoppingBag,
  Store,
  UserCheck,
  Users,
  Wrench,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';

import { Screen } from '@/components/ui/Screen';
import { roleLabels } from '@/constants/access';
import { dashboardColors } from '@/constants/theme';

type TranslateFn = (key: string, vars?: Record<string, unknown>) => string;

type MenuSection = {
  key: string;
  labelKey: string;
  items: MenuItem[];
};

type MenuItem = {
  icon: typeof ArrowRight;
  titleKey: string;
  subtitleKey: string | null;
  onPress: () => void;
};
export default function MoreScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user } = useAuth();

  const role = user?.role ?? 'reporter';
  const canManageSite =
    user?.role === 'admin' || user?.role === 'super_admin';
  const canProvisionUser = canProvision(user);
  const canViewAdminApplications = user?.role === 'super_admin';

  // A reporter who applied to be a site admin sees this entry until the
  // super-admin decision lands — even if no site exists yet.
  const hasAdminApplication = user?.adminApplication !== null;

  const sections: MenuSection[] = [
    {
      key: 'workspace',
      labelKey: 'more.sections.workspace',
      items: [
        {
          icon: ClipboardList,
          titleKey: 'more.menu.reportsTitle',
          subtitleKey: 'more.menu.reportsSubtitle',
          onPress: () => router.push('/reports'),
        },
        {
          icon: Moon,
          titleKey: 'more.menu.notificationsTitle',
          subtitleKey: 'more.menu.notificationsSubtitle',
          onPress: () => router.push('/notifications'),
        },
      ],
    },
  ];

  if (canManageSite || hasAdminApplication) {
    sections.push({
      key: 'administration',
      labelKey: 'more.sections.administration',
      items: [
        hasAdminApplication
          ? {
              icon: ShieldCheck,
              titleKey: 'more.menu.myAdminApplicationTitle',
              subtitleKey: null,
              onPress: () => router.push('/more/admin-application'),
            }
          : null,
        canManageSite
          ? {
              icon: Building2,
              titleKey: 'more.menu.siteSetupTitle',
              subtitleKey: 'more.menu.siteSetupSubtitleRequired',
              onPress: () => router.push('/more/site-setup'),
            }
          : null,
        canManageSite
          ? {
              icon: Users,
              titleKey: 'more.menu.sitesTitle',
              subtitleKey: 'more.menu.sitesSubtitleEdit',
              onPress: () => router.push('/more/sites'),
            }
          : null,
        canProvisionUser
          ? {
              icon: UserCheck,
              titleKey: 'more.menu.teamAccessTitle',
              subtitleKey: 'more.menu.teamAccessSubtitle',
              onPress: () => router.push('/more/team-access'),
            }
          : null,
        canViewAdminApplications
          ? {
              icon: ShieldCheck,
              titleKey: 'more.menu.adminApplicationsTitle',
              subtitleKey: 'more.menu.adminApplicationsSubtitle',
              onPress: () => router.push('/more/admin-applications'),
            }
          : null,
        role === 'technician' || canManageSite
          ? {
              icon: FileText,
              titleKey: 'more.menu.siteContractsTitle',
              subtitleKey:
                role === 'technician'
                  ? 'more.menu.siteContractsSubtitleTechnician'
                  : 'more.menu.siteContractsSubtitleAdmin',
              onPress: () => router.push('/more/site-contracts'),
            }
          : null,
      ].filter((item): item is MenuItem => item !== null),
    });
  }

  sections.push({
    key: 'shop',
    labelKey: 'more.sections.shop',
    items: [
      canManageSite
        ? {
            icon: NotepadText,
            titleKey: 'more.menu.shopManagementTitle',
            subtitleKey: 'more.menu.shopManagementSubtitle',
            onPress: () => router.push('/more/shop-management'),
          }
        : null,
      {
        icon: ShoppingBag,
        titleKey: 'more.menu.shopTitle',
        subtitleKey: canManageSite ? 'more.menu.shopSubtitleManager' : 'more.menu.shopSubtitle',
        onPress: () => router.push('/more/shop'),
      },
    ].filter((item): item is MenuItem => item !== null),
  });

  const siteCount = 0; // `me` payload currently omits this — use 0 until Phase 6 backfill.
  const sitesLabel =
    siteCount > 0
      ? ` · ${siteCount}`
      : '';

  const applicationStatusLabel =
    user?.adminApplication?.status === 'pending'
      ? t('more.menu.myAdminApplicationPending')
      : user?.adminApplication
        ? t('more.menu.myAdminApplicationStatus', { status: user.adminApplication.status })
        : null;

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="px-5 pb-8 pt-4"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-5">
          <Text
            className="text-2xl font-bold text-ink"
            style={{ letterSpacing: -0.6 }}
          >
            {t('more.title')}
          </Text>
          <Text className="mt-0.5 text-[11px] text-dashboard-caption">
            {t('more.signedInAs', { role: roleLabels[role] })}
            {sitesLabel}
            {applicationStatusLabel ? ` · ${applicationStatusLabel}` : ''}
          </Text>
        </View>

        {sections.map((section) => (
          <MenuSection
            key={section.key}
            t={t}
            label={t(section.labelKey)}
            items={section.items}
          />
        ))}
      </ScrollView>
    </Screen>
  );
}

function MenuSection({
  t, label, items,
}: {
  t: TranslateFn;
  label: string;
  items: MenuItem[];
}) {
  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-[10px] font-semibold uppercase tracking-[1.2px] text-dashboard-caption">
        {label}
      </Text>
      <View className="overflow-hidden rounded-xl border border-dashboard-card-line bg-dashboard-card-bg">
        {items.map((item, idx) => (
          <Pressable
            key={item.titleKey}
            accessibilityRole="button"
            accessibilityLabel={t(item.titleKey)}
            onPress={item.onPress}
            className={`flex-row items-center gap-3 px-3 py-3 active:opacity-70 ${
              idx > 0 ? 'border-t border-dashboard-card-line' : ''
            }`}
          >
            <View className="h-9 w-9 items-center justify-center rounded-full bg-dashboard-pill-bg">
              <item.icon
                color={dashboardColors.teal}
                size={18}
                strokeWidth={1.8}
              />
            </View>
            <View className="flex-1">
              <Text className="text-[13px] font-semibold text-ink">
                {t(item.titleKey)}
              </Text>
              {item.subtitleKey ? (
                <Text className="mt-0.5 text-[10px] text-dashboard-subtitle">
                  {t(item.subtitleKey)}
                </Text>
              ) : null}
            </View>
            <ArrowRight
              color={dashboardColors.subtitle}
              size={15}
              strokeWidth={1.7}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
