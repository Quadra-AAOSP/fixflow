import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowRight,
  Building2,
  FileSignature,
  Hash,
  LogOut,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  User as UserIcon,
  type LucideIcon,
} from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { SiteSwitcher } from '@/components/ui/SiteSwitcher';
import { roleLabels } from '@/constants/access';
import { dashboardColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentSite } from '@/stores/site';
import type { User, UserRole } from '@/types';

/**
 * Account & session screen. Everything the backend exposes on `/api/auth/me`
 * is surfaced here; the backend has no profile-update endpoint
 * (`AdminUserController` is POST /api/admin/users only — admin provisioning),
 * so there is deliberately no edit affordance.
 *
 * Layout mirrors `ProfileView.vue` and extends it with the polish of the
 * dashboard: a warm hero card with a role-toned initials avatar and badges,
 * grouped label/value detail cards (Account details · Working site), the
 * technician-only "contracts are optional" panel, and a Session card for the
 * sign-out action. Section eyebrows reuse the More menu's treatment so the
 * whole tab reads as one system.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { site, sites } = useCurrentSite();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function doLogout() {
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
    } catch {
      // Mirrors the web, which surfaces a failed sign-out instead of
      // leaving the user stuck with no feedback.
      setLogoutError('Sign out failed. Please try again.');
    } finally {
      setLoggingOut(false);
    }
  }

  function onLogout() {
    Alert.alert('Sign out', 'You will need to sign in again to continue.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void doLogout();
        },
      },
    ]);
  }

  const accountRows: RowConfig[] = [];
  if (user) {
    accountRows.push(
      { icon: ShieldCheck, label: 'Role', value: roleLabels[user.role] ?? user.role },
      { icon: Hash, label: 'Account ID', value: `#${user.id}`, mono: true },
      {
        icon: Building2,
        label: 'Site ID',
        value: user.siteId != null ? String(user.siteId) : '—',
        mono: true,
      },
    );
    if (user.phone) {
      accountRows.push({ icon: Phone, label: 'Phone', value: user.phone });
    }
    if (user.address) {
      accountRows.push({ icon: MapPin, label: 'Address', value: user.address });
    }
  }

  const siteRows: RowConfig[] = [];
  if (site) {
    siteRows.push(
      { icon: Building2, label: 'Type', value: capitalize(site.type) },
      { icon: FileSignature, label: 'Contract', value: capitalize(site.contractStatus) },
    );
    if (site.address) {
      siteRows.push({ icon: MapPin, label: 'Address', value: site.address });
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerClassName="px-5 pb-12 pt-4">
        {/* Hero — warm cream treatment matching the dashboard welcome banner,
            with a role-toned avatar so the account's standing is legible at a
            glance. */}
        <View
          className="mb-6 items-center rounded-2xl border bg-dashboard-banner-bg px-5 pb-6 pt-7"
          style={{ borderColor: dashboardColors.bannerBorder }}
        >
          {user ? (
            <ProfileAvatar user={user} />
          ) : (
            <View
              className="h-20 w-20 items-center justify-center rounded-full border-4 border-card"
              style={{ backgroundColor: dashboardColors.statMintSoft }}
            >
              <UserIcon color={dashboardColors.statMintDeep} size={34} />
            </View>
          )}

          <Text
            className="mt-4 text-[21px] font-semibold text-ink"
            style={{ letterSpacing: -0.5 }}
          >
            {user ? `${user.firstName} ${user.lastName}` : 'Profile'}
          </Text>

          {user ? (
            <View className="mt-1.5 flex-row items-center gap-1.5">
              <Mail color={dashboardColors.subtitle} size={13} strokeWidth={1.8} />
              <Text className="text-[13px] text-dashboard-subtitle">
                {user.email}
              </Text>
            </View>
          ) : null}

          {user ? (
            <View className="mt-4 flex-row items-center gap-2">
              <RolePill role={user.role} />
              <MetaChip label="Account" value={`#${user.id}`} />
            </View>
          ) : null}
        </View>

        {user ? (
          <>
            <SectionLabel>Account details</SectionLabel>
            <Card className="mb-6">
              <DetailList rows={accountRows} />
            </Card>
          </>
        ) : null}

        {/* Mobile-only: the web surfaces the active site through the sidebar's
            selector, but the bottom-bar layout has no dedicated slot, so the
            site context lives here. */}
        <SectionLabel>Working site</SectionLabel>
        <Card className="mb-6">
          <SiteSwitcher />
          {site ? (
            <View className="mt-3 border-t border-dashboard-card-line pt-1">
              <DetailList rows={siteRows} />
            </View>
          ) : null}
          {sites.length > 1 ? (
            <Text className="mt-3 text-[11px] leading-[1.7] text-dashboard-caption">
              Reports, categories, and the report list all follow the site
              selected here.
            </Text>
          ) : null}
        </Card>

        {/* Technician-only: mirrors the web's "Site contracts are optional"
            panel. Independent technicians don't have a site-scoped list of
            contracts, so the panel explains that and points to the contracts
            screen for the application flow. */}
        {user?.role === 'technician' ? (
          <Card className="mb-6">
            <View className="mb-2 flex-row items-center gap-2">
              <FileSignature color={dashboardColors.teal} size={18} />
              <Text
                className="text-[15px] font-semibold text-ink"
                style={{ letterSpacing: -0.3 }}
              >
                Site contracts are optional
              </Text>
            </View>
            <Text className="text-[12px] leading-[1.8] text-dashboard-subtitle">
              Your account ID is {user.id}. Share it with a site administrator
              when arranging a contract. A site ID does not represent your
              contract list.
            </Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push('/more/contracts')}
              className="mt-3 flex-row items-center gap-1 self-start active:opacity-70"
            >
              <Text
                className="text-[11px] font-semibold"
                style={{ color: dashboardColors.teal }}
              >
                View contract options
              </Text>
              <ArrowRight color={dashboardColors.teal} size={13} />
            </Pressable>
          </Card>
        ) : null}

        <SectionLabel>Session</SectionLabel>
        <Card className="mb-8">
          <View className="mb-4 flex-row items-center gap-3">
            <View
              className="h-9 w-9 items-center justify-center rounded-lg"
              style={{ backgroundColor: dashboardColors.statCoralSoft }}
            >
              <LogOut
                color={dashboardColors.statCoralDeep}
                size={18}
                strokeWidth={1.8}
              />
            </View>
            <View className="flex-1">
              <Text className="text-[13px] font-semibold text-ink">
                Current session
              </Text>
              <Text className="mt-0.5 text-[11px] text-dashboard-subtitle">
                End this session on this device.
              </Text>
            </View>
          </View>

          {logoutError ? (
            <Text className="mb-3 text-[11px] text-tone-danger">{logoutError}</Text>
          ) : null}

          <Button
            label="Sign out"
            variant="secondary"
            onPress={onLogout}
            loading={loggingOut}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

type RowConfig = {
  icon: LucideIcon;
  label: string;
  value: string;
  /** Renders the value with tabular figures — for IDs. */
  mono?: boolean;
};

/**
 * Role → tone. Reuses the dashboard's soft-icon-disc palette so a badge never
 * introduces a color the rest of the tab doesn't already use:
 *   reporter → coral · technician → mint · staff → citron · admin → teal.
 */
const ROLE_TONE: Record<UserRole, { bg: string; ink: string }> = {
  reporter: {
    bg: dashboardColors.statCoralSoft,
    ink: dashboardColors.statCoralDeep,
  },
  technician: {
    bg: dashboardColors.statMintSoft,
    ink: dashboardColors.statMintDeep,
  },
  staff: {
    bg: dashboardColors.statCitronSoft,
    ink: dashboardColors.statCitronDeep,
  },
  admin: { bg: dashboardColors.tealSoft, ink: dashboardColors.teal },
  super_admin: { bg: dashboardColors.tealSoft, ink: dashboardColors.teal },
};

/** First letter of each name part, falling back to the email's first letter. */
function initials(user: User): string {
  const first = user.firstName?.trim()?.[0] ?? '';
  const last = user.lastName?.trim()?.[0] ?? '';
  const combined = `${first}${last}`.toUpperCase();
  if (combined) return combined;
  return (user.email?.trim()?.[0] ?? '?').toUpperCase();
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function ProfileAvatar({ user }: { user: User }) {
  const tone = ROLE_TONE[user.role];
  return (
    <View
      className="h-20 w-20 items-center justify-center rounded-full border-4 border-card"
      style={{
        backgroundColor: tone.bg,
        boxShadow: '0 8px 20px rgba(21, 39, 66, 0.08)',
      }}
    >
      <Text
        className="text-[26px] font-bold"
        style={{ color: tone.ink, letterSpacing: 0.5 }}
      >
        {initials(user)}
      </Text>
    </View>
  );
}

function RolePill({ role }: { role: UserRole }) {
  const tone = ROLE_TONE[role];
  return (
    <View className="rounded-full px-3 py-1" style={{ backgroundColor: tone.bg }}>
      <Text className="text-[11px] font-semibold" style={{ color: tone.ink }}>
        {roleLabels[role] ?? role}
      </Text>
    </View>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center gap-1.5 rounded-full border border-dashboard-card-line bg-card px-3 py-1">
      <Text
        className="text-[10px] uppercase text-dashboard-caption"
        style={{ letterSpacing: 0.6 }}
      >
        {label}
      </Text>
      <Text
        className="text-[11px] font-semibold text-ink"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * Teal-tinted section eyebrow, identical to the More menu's treatment so the
 * two tabs share one visual system.
 */
function SectionLabel({ children }: { children: string }) {
  return (
    <View className="mb-2 mt-1 flex-row items-center gap-2 px-1">
      <View
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: dashboardColors.statCitronDeep }}
      />
      <Text
        className="text-[10px] font-semibold uppercase text-dashboard-subtitle"
        style={{ letterSpacing: 1.2 }}
      >
        {children}
      </Text>
    </View>
  );
}

/** Hairline-separated label/value rows, matching the web's detail rows. */
function DetailList({ rows }: { rows: RowConfig[] }) {
  return (
    <View>
      {rows.map((row, index) => (
        <View key={row.label}>
          {index > 0 ? (
            <View className="border-t border-dashboard-card-line" />
          ) : null}
          <DetailRow {...row} />
        </View>
      ))}
    </View>
  );
}

function DetailRow({ icon: Icon, label, value, mono }: RowConfig) {
  return (
    <View className="flex-row items-center gap-3 py-3">
      <View className="flex-row items-center gap-2">
        <Icon color={dashboardColors.subtitle} size={15} strokeWidth={1.8} />
        <Text className="text-[13px] text-dashboard-subtitle">{label}</Text>
      </View>
      <Text
        className="flex-1 text-right text-[13px] font-medium text-ink"
        style={mono ? { fontVariant: ['tabular-nums'] } : undefined}
      >
        {value}
      </Text>
    </View>
  );
}
