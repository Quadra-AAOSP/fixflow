import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import {
  ArrowRight,
  Building2,
  FileText,
  Moon,
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
import { roleLabels, canManageShop, canProvision } from '@/constants/access';
import { dashboardColors } from '@/constants/theme';
import type { UserRole } from '@/types';

type TranslateFn = (key: string, vars?: Record<string, unknown>) => string;

type MenuSection = {
  key: string;
  labelKey: string;
  items: MenuItem[];
};

type MenuItem = {
  icon: LucideIcon;
  titleKey: string;
  subtitleKey: string | null;
  onPress: () => void;
};

/**
 * Every item that ever appears in the More menu, keyed by a stable slug.
 * The per-role visibility tables below decide which keys to include — no
 * scattered role-ifs in the render path, so future additions can't leak.
 */
type ItemKey =
  | 'notifications'
  | 'myAdminApplication'
  | 'siteSetup'
  | 'sites'
  | 'teamAccess'
  | 'technicians'
  | 'adminApplications'
  | 'contractsTechnician'
  | 'contractsAdmin'
  | 'shopManagement'
  | 'shopCustomer';

/** Which roles may see which item keys. An item key is visible to a role iff
 *  that role appears in the key's allowlist, AND any additional capability
 *  check the item defines below passes. */
const ROLE_VISIBILITY: Record<ItemKey, UserRole[]> = {
  notifications: ['reporter', 'technician', 'staff', 'admin', 'super_admin', 'shop_manager'],
  // A reporter who applied to be site admin may track the status — see the
  // "additional guard" check below for hasAdminApplication.
  myAdminApplication: ['reporter'],
  siteSetup: ['admin', 'super_admin'],
  sites: ['admin', 'super_admin'],
  teamAccess: ['admin', 'super_admin'],
  technicians: ['staff', 'admin', 'super_admin'],
  adminApplications: ['super_admin'],
  contractsTechnician: ['technician'],
  contractsAdmin: ['admin', 'super_admin'],
  shopManagement: ['admin', 'super_admin', 'shop_manager'],
  shopCustomer: ['reporter', 'technician', 'staff', 'admin', 'super_admin', 'shop_manager'],
};

function itemVisible(key: ItemKey, role: UserRole, guards: ItemGuards): boolean {
  if (!ROLE_VISIBILITY[key].includes(role)) return false;
  const guard = guards[key];
  if (guard === undefined) return true;
  return guard();
}

/** Item-specific capability checks beyond role membership. */
type ItemGuards = Partial<Record<ItemKey, () => boolean>>;

export default function MoreScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user } = useAuth();

  const role: UserRole = user?.role ?? 'reporter';

  const canManageSite = role === 'admin' || role === 'super_admin';
  const canProvisionUser = canProvision(user);
  const hasAdminApplication =
    role === 'reporter' && user?.adminApplication !== null;

  // Role → item-guard map. Anything that needs a second check after the role
  // allowlist (e.g. capability flags, application presence) lives here.
  const guards: ItemGuards = {
    myAdminApplication: () => hasAdminApplication,
    teamAccess: () => canProvisionUser,
    shopManagement: () => canManageShop(user),
  };

  const allItems: Record<ItemKey, MenuItem> = {
    notifications: {
      icon: Moon,
      titleKey: 'more.menu.notificationsTitle',
      subtitleKey: 'more.menu.notificationsSubtitle',
      onPress: () => router.push('/more/notifications'),
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
      subtitleKey: 'more.menu.siteSetupSubtitleRequired',
      onPress: () => router.push('/more/site-setup'),
    },
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
    adminApplications: {
      icon: ShieldCheck,
      titleKey: 'more.menu.adminApplicationsTitle',
      subtitleKey: 'more.menu.adminApplicationsSubtitle',
      onPress: () => router.push('/more/admin-applications'),
    },
    contractsTechnician: {
      icon: FileText,
      titleKey: 'more.menu.siteContractsTitle',
      subtitleKey: 'more.menu.siteContractsSubtitleTechnician',
      onPress: () => router.push('/more/contracts'),
    },
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
    shopCustomer: {
      icon: ShoppingBag,
      titleKey: 'more.menu.shopTitle',
      subtitleKey: 'more.menu.shopSubtitle',
      onPress: () => router.push('/more/shop'),
    },
  };

  // Group keys into their sections, then filter each by itemVisible.
  // Each section drops out entirely when it has zero visible items.
  const workspaceKeys: ItemKey[] = ['notifications', 'contractsTechnician'];
  const applicationKeys: ItemKey[] = ['myAdminApplication'];
  const adminKeys: ItemKey[] = [
    'siteSetup',
    'sites',
    'teamAccess',
    'technicians',
    'adminApplications',
    'contractsAdmin',
  ];
  const shopKeys: ItemKey[] = ['shopManagement', 'shopCustomer'];

  const buildSection = (
    sectionKey: string,
    labelKey: string,
    keys: ItemKey[],
  ): MenuSection | null => {
    const items = keys
      .filter((key) => itemVisible(key, role, guards))
      .map((key) => allItems[key]);
    if (items.length === 0) return null;
    return { key: sectionKey, labelKey, items };
  };

  const sections: MenuSection[] = [
    buildSection('workspace', 'more.sections.workspace', workspaceKeys),
    // Reporters who applied for admin get a dedicated section — not buried
    // under "Administration" which is otherwise an admin-only concept.
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
