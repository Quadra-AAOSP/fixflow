import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BellRing,
  Building2,
  ClipboardList,
  House,
  LayoutGrid,
  Plug,
  ScanSearch,
  ShieldCheck,
  Store,
  Users,
  type LucideIcon,
} from 'lucide-react-native';

import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { ListRow } from '@/components/ui/ListRow';
import { dashboardColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import {
  canCreateSite,
  canEditSite,
  canManageShop,
  canManageSubsites,
  canProvision,
  canDecideContracts,
  roleLabels,
} from '@/constants/access';

type MenuRow = {
  key: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  /** Omit for a static, non-navigating row. */
  href?: string;
};

/**
 * "More" tab — the index route of the nested More stack. Surfaces every
 * secondary destination that doesn't justify a permanent bottom-bar slot.
 *
 * There is no direct web counterpart (the web app has a sidebar with all
 * sections visible at once). The mobile app collapses the sidebar's overflow
 * area into this menu so the bottom bar stays at four items.
 *
 * Items are role-aware so the screen stays useful without becoming cluttered
 * for any given account: admins get Site setup + Team access, super_admins
 * additionally get the admin-application queue, applicants see their own
 * application status, and shop managers see catalog-management guidance
 * instead of the customer shop.
 */
export default function MoreScreen() {
  const router = useRouter();
  const { user } = useAuth();
  // This route is the only screen in the app with no navigation header at all
  // (the Tabs bar *and* the More stack both hide theirs), so nothing pads for
  // the status bar / notch — the view has to do it itself.
  const insets = useSafeAreaInsets();

  if (!user) return null;

  const workspaceRows: MenuRow[] = [
    {
      key: 'reports',
      title: 'Reports',
      subtitle: 'Every report at this site.',
      icon: ClipboardList,
      href: '/reports',
    },
    {
      key: 'notifications',
      title: 'Notifications',
      subtitle: 'No notifications yet — coming soon.',
      icon: BellRing,
      href: '/more/notifications',
    },
  ];
  if (user.adminApplication != null) {
    workspaceRows.push({
      key: 'admin-application',
      title: 'My admin application',
      subtitle:
        user.adminApplication.status === 'pending'
          ? 'Awaiting super-admin review.'
          : `Application ${user.adminApplication.status}.`,
      icon: ShieldCheck,
      href: '/more/admin-application',
    });
  }

  const adminRows: MenuRow[] = [];
  if (canManageSubsites(user)) {
    adminRows.push({
      key: 'site-setup',
      title: 'Site setup',
      subtitle: user.siteOnboarding?.setupRequired
        ? 'Required — add your first building.'
        : 'Manage buildings and reporting readiness.',
      icon: Building2,
      href: '/more/site-setup',
    });
  }
  if (canCreateSite(user) || canEditSite(user)) {
    adminRows.push({
      key: 'sites',
      title: 'Sites',
      subtitle: canCreateSite(user)
        ? 'Create and edit sites.'
        : 'Edit sites assigned to you.',
      icon: House,
      href: '/more/sites',
    });
  }
  if (canProvision(user)) {
    adminRows.push({
      key: 'team-access',
      title: 'Team access',
      subtitle: 'Provision staff or admin accounts.',
      icon: Users,
      href: '/more/team-access',
    });
  }
  if (user.role === 'super_admin') {
    adminRows.push({
      key: 'admin-applications',
      title: 'Admin applications',
      subtitle: 'Review site-admin requests.',
      icon: ShieldCheck,
      href: '/more/admin-applications',
    });
  }
  if (canDecideContracts(user) || user.role === 'technician') {
    adminRows.push({
      key: 'contracts',
      title: 'Site contracts',
      subtitle:
        user.role === 'technician'
          ? 'Apply or review contracts.'
          : 'Record site contracts.',
      icon: Plug,
      href: '/more/contracts',
    });
  }

  // Shop managers administer the catalog (web console) rather than purchase
  // from it, so they get guidance instead of the customer storefront.
  const shopRows: MenuRow[] =
    user.role === 'shop_manager'
      ? [
          {
            key: 'shop-admin',
            title: 'Shop management',
            subtitle:
              'Catalog management lives in the web admin console.',
            icon: Store,
          },
        ]
      : [
          {
            key: 'shop',
            title: 'Shop',
            subtitle: canManageShop(user)
              ? 'Browse supplies · you also manage the catalog (web).'
              : 'Browse and order maintenance supplies.',
            icon: ScanSearch,
            href: '/more/shop',
          },
        ];

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="px-5"
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: Math.max(insets.bottom, 48),
        }}
      >
        {/* Header — mirrors the dashboard's welcome banner treatment, but
            compressed. The web's sidebar already shows the user's name in
            the topbar, so the mobile puts it here. */}
        <View className="mb-5 flex-row items-center gap-3">
          <View
            className="rounded-xl p-3"
            style={{ backgroundColor: dashboardColors.statMintSoft }}
          >
            <LayoutGrid color={dashboardColors.statMintDeep} size={26} />
          </View>
          <View className="flex-1">
            <Text
              className="text-2xl font-bold text-ink"
              style={{ letterSpacing: -0.5 }}
            >
              More
            </Text>
            <Text className="mt-0.5 text-xs text-dashboard-subtitle">
              Signed in as {roleLabels[user.role]}
            </Text>
          </View>
        </View>

        <SectionLabel>Workspace</SectionLabel>
        <MenuCard rows={workspaceRows} onPress={(href) => router.push(href)} />

        {adminRows.length > 0 ? (
          <>
            <SectionLabel>Administration</SectionLabel>
            <MenuCard
              rows={adminRows}
              onPress={(href) => router.push(href)}
            />
          </>
        ) : null}

        <SectionLabel>Shop</SectionLabel>
        <MenuCard rows={shopRows} onPress={(href) => router.push(href)} />
      </ScrollView>
    </Screen>
  );
}

/** Card containing the rows of one section, with hairline dividers. */
function MenuCard({
  rows,
  onPress,
}: {
  rows: MenuRow[];
  onPress: (href: string) => void;
}) {
  return (
    <Card padded={false} className="mb-6">
      {rows.map((row, index) => (
        <View key={row.key}>
          {index > 0 ? (
            <View className="mx-4 border-t border-dashboard-card-line" />
          ) : null}
          <ListRow
            title={row.title}
            subtitle={row.subtitle}
            icon={row.icon}
            className="px-4 py-3"
            onPress={row.href ? () => onPress(row.href as string) : undefined}
          />
        </View>
      ))}
    </Card>
  );
}

/**
 * Small teal-tinted section label used above each card on the More menu.
 * Mirrors the section-eyebrow treatment on the web dashboard.
 */
function SectionLabel({ children }: { children: string }) {
  return (
    <View className="mb-2 mt-1 flex-row items-center gap-2 px-1">
      <View
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: dashboardColors.statCitronDeep }}
      />
      <Text
        className="text-[10px] font-semibold uppercase tracking-[1.2px] text-dashboard-subtitle"
        style={{ letterSpacing: 1.2 }}
      >
        {children}
      </Text>
    </View>
  );
}
