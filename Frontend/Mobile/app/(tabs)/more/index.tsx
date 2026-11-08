import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import {
  ArrowRight,
  Briefcase,
  Building2,
  FileText,
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
  | 'myVerification' | 'siteApplications' | 'verificationReviews' | 'marketplace'
  | 'myAdminApplication'
  | 'siteSetup'
  | 'siteRules'
  | 'sites'
  | 'teamAccess'
  | 'technicians'
  | 'adminApplications'
  | 'contractsTechnician'
  | 'contractsAdmin'
  | 'shopManagement'
  | 'shopCustomer' | 'shopOrders';

/** Which roles may see which item keys. Matches backend source of truth:
 *
 *  Backend SecurityConfig:
 *    /api/admin/**       → ADMIN, SUPER_ADMIN only
 *    /api/admin/shop/**  → SUPER_ADMIN, SHOP_MANAGER only
 *    /api/sites/**       → authenticated, scoped by actor's siteId
 *
 *  Backend SiteService:
 *    createSite          → assertSuperAdmin   (super_admin ONLY)
 *    editSite            → assertCanManage    (admin at that site OR super_admin)
 *    deleteSite          → assertSuperAdmin   (super_admin ONLY)
 *
 *  Backend UserCapabilities.forRole():
 *    createSite          → super_admin only
 *    editSite            → admin + super_admin
 *    assignTechnician    → admin + super_admin + staff
 *
 *  Anything that needs both a role match AND a capability flag (e.g. user
 *  has an admin application pending) also has an ItemGuard below. */
const ROLE_VISIBILITY: Record<ItemKey, UserRole[]> = {
  myVerification: ['technician'],
  marketplace: ['admin', 'technician'],
  siteApplications: ['super_admin'],
  verificationReviews: ['super_admin'],

  // A reporter who applied to be site admin may track the status — guard
  // below requires user.adminApplication !== null.
  myAdminApplication: ['reporter'],

  // SiteSetup = CREATE site → super_admin only (SiteService.create asserts super_admin).
  siteSetup: ['super_admin'],
  // Sites = edit / manage existing sites → admin (theirs) + super_admin (all).
  sites: ['admin', 'super_admin'],
  siteRules: ['admin', 'super_admin'],

  // TeamAccess = provision users via /api/admin/users → admin + super_admin.
  // Admin can only provision staff at their own site (backend enforces scope).
  // Super_admin can provision staff/admin/shop_manager/super_admin anywhere.
  teamAccess: ['admin', 'super_admin'],

  // Technicians directory — staff views their site's technicians, admin +
  // super_admin view the full directory. staff manages contracts at site level.
  technicians: ['staff', 'admin', 'super_admin'],

  // Approve pending site admins — super_admin exclusive.
  adminApplications: ['super_admin'],

  contractsTechnician: ['technician'],
  // Site-level contract management — staff can assign technicians at their site too.
  contractsAdmin: ['staff', 'admin', 'super_admin'],

  // /api/admin/shop/** → SUPER_ADMIN, SHOP_MANAGER only.
  shopManagement: ['super_admin', 'shop_manager'],
  shopOrders: ['super_admin', 'shop_manager'],

  // Everyone can browse and buy from the shop.
  shopCustomer: ['reporter', 'technician', 'staff', 'admin', 'super_admin'],
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
    myVerification: { icon: ShieldCheck, titleKey: 'review.myVerification', subtitleKey: null, onPress: () => router.push('/more/my-verification') },
    marketplace: { icon: Briefcase, titleKey: 'marketplace.title', subtitleKey: null, onPress: () => router.push('/more/marketplace') },
    siteApplications: { icon: Building2, titleKey: 'review.siteReviews', subtitleKey: null, onPress: () => router.push('/more/site-applications') },
    verificationReviews: { icon: UserCheck, titleKey: 'review.verificationReviews', subtitleKey: null, onPress: () => router.push('/more/verification-reviews') },
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
    siteRules: { icon: FileText, titleKey: 'more.menu.siteRulesTitle', subtitleKey: null, onPress: () => router.push('/more/site-rules') },
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
    shopOrders: { icon: NotepadText, titleKey: 'orderManagement.title', subtitleKey: null, onPress: () => router.push('/more/shop-orders') },
    shopCustomer: {
      icon: ShoppingBag,
      titleKey: 'more.menu.shopTitle',
      subtitleKey: 'more.menu.shopSubtitle',
      onPress: () => router.push('/more/shop'),
    },
  };

  // Group keys into their sections, then filter each by itemVisible.
  // Each section drops out entirely when it has zero visible items.
  const workspaceKeys: ItemKey[] = ['contractsTechnician', 'myVerification', 'marketplace'];
  const applicationKeys: ItemKey[] = ['myAdminApplication'];
  const adminKeys: ItemKey[] = [
    'siteSetup',
    'sites',
    'siteRules',
    'teamAccess',
    'technicians',
    'adminApplications',
    'siteApplications',
    'verificationReviews',
    'contractsAdmin',
  ];
  const shopKeys: ItemKey[] = ['shopManagement', 'shopOrders', 'shopCustomer'];

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
