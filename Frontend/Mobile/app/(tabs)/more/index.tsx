import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import {
  ArrowRight,
  Briefcase,
  Building2,
  FileText,
  Globe,
  Handshake,
  NotepadText,
  ShieldCheck,
  ShoppingBag,
  UserCheck,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';

import { Screen } from '@/components/ui/Screen';
import { SiteSwitcher } from '@/components/ui/SiteSwitcher';
import { roleLabels, canManageShop, canProvision } from '@/constants/access';
import {
  isMoreMenuItemVisible,
  type MoreMenuItemKey,
} from '@/constants/moreMenuVisibility';
import { dashboardColors } from '@/constants/theme';
import { useCurrentSite } from '@/stores/site';
import type { UserRole } from '@/types';

type TranslateFn = (key: string, vars?: Record<string, unknown>) => string;

type MenuSection = {
  key: string;
  labelKey: string;
  items: MenuItem[];
};

type MenuItem = {
  key: ItemKey;
  icon: LucideIcon;
  titleKey: string;
  subtitleKey: string | null;
  onPress: () => void;
};

type ItemKey = MoreMenuItemKey;

/** Item-specific capability checks beyond role membership. */
type ItemGuards = Partial<Record<ItemKey, () => boolean>>;

function itemVisible(key: ItemKey, role: UserRole, guards: ItemGuards): boolean {
  return isMoreMenuItemVisible(key, role, guards[key]);
}

export default function MoreScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user } = useAuth();
  const { site, sites } = useCurrentSite();

  const role: UserRole = user?.role ?? 'reporter';
  const canSwitchSites = role === 'super_admin' || sites.length > 1;

  const canProvisionUser = canProvision(user);
  const hasAdminApplication =
    role === 'reporter' && user?.adminApplication !== null;

  const guards: ItemGuards = {
    myAdminApplication: () => hasAdminApplication,
    teamAccess: () => canProvisionUser,
    shopManagement: () => canManageShop(user),
  };

  const allItems: Record<ItemKey, Omit<MenuItem, 'key'>> = {
    openJobs: {
      icon: Briefcase,
      titleKey: 'more.menu.openJobsTitle',
      subtitleKey: 'more.menu.openJobsSubtitle',
      onPress: () => router.push('/technician/open-jobs'),
    },
    jobOffers: {
      icon: Handshake,
      titleKey: 'jobOffers.title',
      subtitleKey: 'jobOffers.menuSubtitle',
      onPress: () => router.push('/technician/job-offers'),
    },
    myVerification: { icon: ShieldCheck, titleKey: 'review.myVerification', subtitleKey: null, onPress: () => router.push('/more/my-verification') },
    marketplace: { icon: Briefcase, titleKey: 'marketplace.title', subtitleKey: null, onPress: () => router.push('/more/marketplace') },
    siteApplications: { icon: Building2, titleKey: 'review.siteReviews', subtitleKey: null, onPress: () => router.push('/more/site-applications') },
    verificationReviews: { icon: UserCheck, titleKey: 'review.verificationReviews', subtitleKey: null, onPress: () => router.push('/more/technicians?tab=reviews') },
    allReports: {
      icon: Globe,
      titleKey: 'more.menu.allReportsTitle',
      subtitleKey: 'more.menu.allReportsSubtitle',
      onPress: () => router.push('/more/all-reports'),
    },
    myAdminApplication: {
      icon: ShieldCheck,
      titleKey: 'more.menu.myAdminApplicationTitle',
      subtitleKey: null,
      onPress: () => router.push('/more/admin-application'),
    },
    siteSetup: {
      icon: Building2,
      titleKey: 'more.menu.siteSetupTitle',
      subtitleKey: user?.siteOnboarding?.setupRequired
        ? site?.address
          ? 'more.menu.siteSetupSubtitleTerms'
          : 'more.menu.siteSetupSubtitleBuildings'
        : 'more.menu.siteSetupSubtitleDone',
      onPress: () => router.push('/more/site-setup'),
    },
    siteRules: { icon: FileText, titleKey: 'more.menu.siteRulesTitle', subtitleKey: null, onPress: () => router.push('/more/sites?tab=category') },
    sites: {
      icon: Users,
      titleKey: 'more.menu.sitesTitle',
      subtitleKey: 'more.menu.sitesSubtitleEdit',
      onPress: () => router.push('/more/sites'),
    },
    teamAccess: {
      icon: UserCheck,
      titleKey: 'more.menu.teamAccessTitle',
      subtitleKey: 'more.menu.teamAccessSubtitle',
      onPress: () => router.push('/more/team-access'),
    },
    technicians: {
      icon: Wrench,
      titleKey: 'more.menu.techniciansTitle',
      subtitleKey: 'more.menu.techniciansSubtitle',
      onPress: () => router.push('/more/technicians'),
    },
    contractsTechnician: {
      icon: FileText,
      titleKey: 'more.menu.siteContractsTitle',
      subtitleKey: 'more.menu.siteContractsSubtitleTechnician',
      onPress: () => router.push('/more/contracts'),
    },
    // Staff cannot open the Sites hub — keep a flat contracts entry for them.
    contractsAdmin: {
      icon: FileText,
      titleKey: 'more.menu.siteContractsTitle',
      subtitleKey: 'more.menu.siteContractsSubtitleAdmin',
      onPress: () => router.push('/more/contracts'),
    },
    shopManagement: {
      icon: NotepadText,
      titleKey: 'more.menu.shopManagementTitle',
      subtitleKey: 'more.menu.shopManagementSubtitle',
      onPress: () => router.push('/more/shop-management'),
    },
    shopOrders: { icon: NotepadText, titleKey: 'orderManagement.title', subtitleKey: null, onPress: () => router.push('/more/shop-orders') },
    shopCustomer: {
      icon: ShoppingBag,
      titleKey: 'more.menu.shopTitle',
      subtitleKey: 'more.menu.shopSubtitle',
      onPress: () => router.push('/more/shop'),
    },
  };

  const workspaceKeys: ItemKey[] = ['openJobs', 'jobOffers', 'contractsTechnician', 'myVerification', 'marketplace'];
  const applicationKeys: ItemKey[] = ['myAdminApplication'];
  // Category + contracts live as tabs on Sites; verification reviews as a tab
  // on Technicians. Staff still get a flat contracts row (no Sites hub).
  const adminKeys: ItemKey[] = [
    'allReports',
    'siteSetup',
    'sites',
    'teamAccess',
    'technicians',
    'siteApplications',
    ...(role === 'staff' ? (['contractsAdmin'] as const) : []),
  ];
  const shopKeys: ItemKey[] = ['shopManagement', 'shopOrders', 'shopCustomer'];

  const buildSection = (
    sectionKey: string,
    labelKey: string,
    keys: ItemKey[],
  ): MenuSection | null => {
    const items = keys
      .filter((key) => itemVisible(key, role, guards))
      .map((key) => ({ key, ...allItems[key] }));
    if (items.length === 0) return null;
    return { key: sectionKey, labelKey, items };
  };

  const sections: MenuSection[] = [
    buildSection('workspace', 'more.sections.workspace', workspaceKeys),
    buildSection('application', 'more.sections.application', applicationKeys),
    buildSection('administration', 'more.sections.administration', adminKeys),
    buildSection('shop', 'more.sections.shop', shopKeys),
  ].filter((s): s is MenuSection => s !== null);

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
            {t('more.signedInAs', { role: t(roleLabels[role]) })}
            {applicationStatusLabel ? ` · ${applicationStatusLabel}` : ''}
          </Text>
          {canSwitchSites ? (
            <View className="mt-2">
              <SiteSwitcher />
            </View>
          ) : null}
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
            key={item.key}
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
