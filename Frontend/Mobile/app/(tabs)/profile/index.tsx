import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight, Settings } from 'lucide-react-native';

import { AuthButton } from '@/components/auth/AuthButton';
import { SiteSwitcher } from '@/components/ui/SiteSwitcher';
import { roleLabels } from '@/constants/access';
import { authColors, fontFamilies } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentSite } from '@/stores/site';
import type { User } from '@/types';

/**
 * Account & session screen. Everything the backend exposes on `/api/auth/me`
 * is surfaced here; the backend has no profile-update endpoint
 * (`AdminUserController` is POST /api/admin/users only — admin provisioning),
 * so there is deliberately no edit affordance.
 *
 * Visual language: the profile deliberately adopts the warmer editorial
 * treatment of the auth pages (cream shell, sage-dot kickers, Manrope
 * headlines with tight tracking, coral accents, the serif `✳` sign-off and the
 * coral submit button) so it reads as the "nicer", branded sibling of the
 * sign-in screen rather than a plain dashboard card.
 *
 * Content still mirrors `ProfileView.vue` and the mobile dashboard: avatar +
 * name + email + role, the Account details / Working site panels, the
 * technician-only "contracts are optional" note, and the Session sign-out.
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
      { label: 'Role', value: roleLabels[user.role] ?? user.role },
      { label: 'Account ID', value: `#${user.id}` },
      {
        label: 'Site ID',
        value: user.siteId != null ? String(user.siteId) : '—',
      },
    );
    if (user.phone) accountRows.push({ label: 'Phone', value: user.phone });
    if (user.address) accountRows.push({ label: 'Address', value: user.address });
  }

  const siteRows: RowConfig[] = [];
  if (site) {
    siteRows.push(
      { label: 'Type', value: capitalize(site.type) },
      { label: 'Contract', value: capitalize(site.contractStatus) },
    );
    if (site.address) siteRows.push({ label: 'Address', value: site.address });
  }

  return (
    <View className="flex-1 bg-auth-bg">
      <ScrollView contentContainerClassName="px-5 pb-12 pt-5">
        {/* Hero — mirrors the auth heading stack (kicker → symbol tile →
            headline → supporting line), personalised with the account's
            initials and role. */}
        <View className="rounded-[22px] bg-auth-panel px-5 pb-6 pt-6">
          <View className="flex-row items-center justify-between">
            <Kicker>Your account</Kicker>
            {/* Settings entry point — pushes the Settings screen (theme
                switch + app info) inside this Profile stack, so the back
                arrow returns here rather than jumping to another tab. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open settings"
              onPress={() => router.push('/profile/settings')}
              className="h-9 w-9 items-center justify-center rounded-full bg-auth-lime-soft active:opacity-70"
            >
              <Settings color={authColors.ink} size={18} />
            </Pressable>
          </View>

          <View
            className="mb-5 mt-5 h-16 w-16 items-center justify-center rounded-[20px] bg-auth-lime-soft"
            style={{ transform: [{ rotate: '-6deg' }] }}
          >
            <Text
              className="text-[24px] text-auth-ink"
              style={{ fontFamily: fontFamilies.headExtraBold }}
            >
              {user ? initials(user) : '?'}
            </Text>
          </View>

          <Text
            className="text-[30px] text-auth-ink"
            style={{ fontFamily: fontFamilies.headBold, letterSpacing: -1.3 }}
          >
            {user ? `${user.firstName} ${user.lastName}` : 'Profile'}
            <Text className="text-coral">.</Text>
          </Text>

          {user ? (
            <Text className="mt-2.5 text-[13px] leading-[22px] text-auth-body">
              {user.email}
            </Text>
          ) : null}

          {user ? (
            <View className="mt-4 flex-row items-center gap-2">
              <View className="rounded-full bg-coral px-3 py-1">
                <Text
                  className="text-[11px] text-auth-ink"
                  style={{ fontFamily: fontFamilies.bodySemiBold }}
                >
                  {roleLabels[user.role] ?? user.role}
                </Text>
              </View>
              <View className="rounded-full border border-auth-line px-3 py-1">
                <Text
                  className="text-[11px] text-auth-note"
                  style={{ fontFamily: fontFamilies.bodySemiBold }}
                >
                  ID #{user.id}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {user ? (
          <>
            <Kicker className="mt-6">Account details</Kicker>
            <Panel>
              <DetailList rows={accountRows} />
            </Panel>
          </>
        ) : null}

        {/* Mobile-only: the web surfaces the active site through the sidebar's
            selector, but the bottom-bar layout has no dedicated slot, so the
            site context lives here. */}
        <Kicker className="mt-6">Working site</Kicker>
        <Panel>
          <SiteSwitcher />
          {site ? (
            <View className="mt-2 border-t border-auth-divider">
              <DetailList rows={siteRows} />
            </View>
          ) : null}
          {sites.length > 1 ? (
            <Text className="mt-3 text-[11px] leading-[19px] text-auth-note">
              Reports, categories, and the report list all follow the site
              selected here.
            </Text>
          ) : null}
        </Panel>

        {/* Technician-only: mirrors the web's "Site contracts are optional"
            panel. Independent technicians don't have a site-scoped list of
            contracts, so the panel explains that and points to the contracts
            screen for the application flow. */}
        {user?.role === 'technician' ? (
          <>
            <Kicker className="mt-6">Contracts</Kicker>
            <Panel>
              <Text
                className="text-[15px] text-auth-ink"
                style={{ fontFamily: fontFamilies.headBold, letterSpacing: -0.3 }}
              >
                Site contracts are optional
              </Text>
              <Text className="mt-2 text-[12px] leading-[20px] text-auth-body">
                Your account ID is {user.id}. Share it with a site administrator
                when arranging a contract. A site ID does not represent your
                contract list.
              </Text>
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push('/more/contracts')}
                className="mt-3 flex-row items-center gap-1.5 self-start active:opacity-70"
              >
                <Text
                  className="text-[12px] text-coral-link"
                  style={{ fontFamily: fontFamilies.bodySemiBold }}
                >
                  View contract options
                </Text>
                <ArrowRight color={authColors.coralLink} size={14} />
              </Pressable>
            </Panel>
          </>
        ) : null}

        <Kicker className="mt-6">Session</Kicker>
        <Panel>
          <Text className="text-[12px] leading-[20px] text-auth-body">
            {user
              ? `Signed in as ${roleLabels[user.role] ?? user.role}${
                  site ? ` · ${site.name}` : ''
                }.`
              : 'End this session on this device.'}
          </Text>

          {logoutError ? (
            <Text className="mt-3 text-[12px] text-urgency-critical">
              {logoutError}
            </Text>
          ) : null}

          <View className="mt-4">
            <AuthButton
              label="Sign out →"
              loading={loggingOut}
              onPress={onLogout}
            />
          </View>
        </Panel>

        {/* Sign-off strip — the same serif asterisk + reassurance line the
            sign-in screen closes with. */}
        <View className="mt-8 flex-row items-center gap-2.5 border-t border-auth-line pt-6">
          <Text className="text-[22px] text-auth-sage-deep">✳</Text>
          <Text className="flex-1 text-[10px] text-auth-note">
            Your report. The right people. A little peace of mind.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

type RowConfig = { label: string; value: string };

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

/**
 * Section eyebrow: a sage dot plus an uppercase, letterspaced micro-label.
 * Identical to the auth story panel's kicker so the two surfaces share one
 * system.
 */
function Kicker({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <View className={`flex-row items-center gap-2 ${className ?? ''}`}>
      <View className="h-[7px] w-[7px] rounded-full bg-auth-sage" />
      <Text
        className="text-[10px] uppercase text-auth-note"
        style={{ fontFamily: fontFamilies.headBold, letterSpacing: 1.4 }}
      >
        {children}
      </Text>
    </View>
  );
}

/** Warm near-white panel used for every grouped block. */
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <View className="mt-2.5 rounded-[18px] border border-auth-card-line bg-auth-card-bg px-4 py-4">
      {children}
    </View>
  );
}

/** Hairline-separated label/value rows. */
function DetailList({ rows }: { rows: RowConfig[] }) {
  return (
    <View>
      {rows.map((row, index) => (
        <View key={row.label}>
          {index > 0 ? <View className="border-t border-auth-divider" /> : null}
          <DetailRow {...row} />
        </View>
      ))}
    </View>
  );
}

function DetailRow({ label, value }: RowConfig) {
  return (
    <View className="flex-row items-center justify-between gap-4 py-3.5">
      <Text
        className="text-[10px] uppercase text-auth-note"
        style={{ fontFamily: fontFamilies.headBold, letterSpacing: 0.8 }}
      >
        {label}
      </Text>
      <Text
        className="flex-1 text-right text-[13px] leading-[20px] text-auth-ink"
        style={{ fontFamily: fontFamilies.bodySemiBold }}
      >
        {value}
      </Text>
    </View>
  );
}
