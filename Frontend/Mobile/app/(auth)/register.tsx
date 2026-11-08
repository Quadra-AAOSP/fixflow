import { Redirect, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AuthHeading } from '@/components/auth/AuthHeading';
import { AuthShell } from '@/components/auth/AuthShell';
import { roleLabels } from '@/constants/access';
import { authColors, fontFamilies } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types';

/**
 * Role picker — the first step of sign-up. Backend policy (AuthService):
 *
 *   ✅ Self-register, instant approval:
 *     reporter   → lands as reporter immediately
 *     technician → lands as technician immediately
 *
 *   ⏳ Site administrator access starts with a separate site application.
 *     The designated admin sets up their account after super-admin approval.
 *
 *   🔒 Cannot self-register — created by existing admins only:
 *     staff, shop_manager, super_admin
 *
 * Managed roles section explains this clearly so a user doesn't waste
 * their time trying to pick a role that isn't open to self-signup.
 */
export default function RegisterScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  if (!isLoading && isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  function choose(role: UserRole) {
    if (role === 'reporter') router.push('/(auth)/register-reporter');
    else if (role === 'technician') router.push('/(auth)/register-technician');
    else if (role === 'admin') router.push('/(auth)/register-admin-apply');
    // staff / shop_manager / super_admin — informational, no navigation
  }

  return (
    <AuthShell>
      <AuthHeading
        kicker={t('auth.register.kicker')}
        title={t('auth.register.title')}
        titleAccent="."
        description={t('auth.register.description')}
      />

      {/* ── Self-service roles (3 tiles) ─────────────────────────────────── */}
      <View className="gap-3">
        <RoleCard
          icon={ClipboardList}
          title={t('auth.register.reporterTitle')}
          subtitle={t('auth.register.reporterSubtitle')}
          badge={{ icon: CheckCircle2, label: t('auth.register.instantApproval') }}
          onPress={() => choose('reporter')}
        />
        <RoleCard
          icon={Wrench}
          title={t('auth.register.technicianTitle')}
          subtitle={t('auth.register.technicianSubtitle')}
          technician
          badge={{ icon: CheckCircle2, label: t('auth.register.instantApproval') }}
          onPress={() => choose('technician')}
        />
        <RoleCard
          icon={ShieldCheck}
          title={t('auth.register.adminTitle')}
          subtitle={t('auth.register.adminSubtitle')}
          badge={{ icon: Clock, label: t('auth.register.pendingApproval') }}
          onPress={() => choose('admin')}
        />
      </View>

      {/* ── Managed roles (admin-only provisioning) ─────────────────────── */}
      <View className="mt-5 border-t border-auth-divider pt-5">
        <View className="mb-2 flex-row items-center gap-2">
          <ShieldCheck color={authColors.note} size={16} />
          <Text className="text-[11px] text-auth-note">
            {t('auth.register.joiningTeam')}
          </Text>
        </View>
        <ManagedRole role="staff" t={t} />
        <ManagedRole role="shop_manager" t={t} />
        <ManagedRole role="super_admin" t={t} />
      </View>

      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('auth.register.signIn')}
        onPress={() => router.push('/(auth)/login')}
        className="mt-4 min-h-[44px] items-center justify-center active:opacity-70"
      >
        <Text className="text-center text-[12px] text-auth-body">
          {t('auth.register.alreadyHaveAccount')}{' '}
          <Text
            className="text-coral-link"
            style={{ fontFamily: fontFamilies.bodySemiBold }}
          >
            {t('auth.register.signIn')}
          </Text>
        </Text>
      </Pressable>
    </AuthShell>
  );
}

type RoleBadge = { icon: LucideIcon; label: string };

function RoleCard({
  icon: Icon, title, subtitle, badge, technician, onPress,
}: {
  icon: LucideIcon; title: string; subtitle: string;
  badge?: RoleBadge;
  technician?: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      className="w-full flex-row items-center gap-3.5 rounded-[10px] border border-auth-card-line bg-auth-card-bg px-3.5 py-4 active:opacity-70"
    >
      <View
        className={`h-[39px] w-[39px] items-center justify-center rounded-[11px] ${
          technician ? 'bg-auth-mint-soft' : 'bg-auth-rose-soft'
        }`}
      >
        <Icon
          color={technician ? authColors.mintDeep : authColors.roseDeep}
          size={22}
        />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text
            className="text-[13px] text-auth-ink"
            style={{ fontFamily: fontFamilies.bodySemiBold }}
          >
            {title}
          </Text>
          {badge ? (
            <View className="flex-row items-center gap-1 rounded-full bg-auth-line px-1.5 py-0.5">
              <badge.icon />
              <Text className="text-[9px] text-auth-note" style={{ fontFamily: fontFamilies.bodyMedium }}>
                {badge.label}
              </Text>
            </View>
          ) : null}
        </View>
        <Text className="mt-1 text-[10px] leading-4 text-auth-body">
          {subtitle}
        </Text>
      </View>
      <Text className="text-[13px] text-auth-ink">→</Text>
    </Pressable>
  );
}

function ManagedRole({ role, t }: { role: 'staff' | 'shop_manager' | 'super_admin'; t: (key: string, vars?: Record<string, unknown>) => string }) {
  return (
    <Text
      className="text-[11px] text-auth-ghost-ink"
      style={{ fontFamily: fontFamilies.bodyMedium }}
    >
      {t('auth.register.managedRoleHint', { role: t(roleLabels[role]) })}
    </Text>
  );
}
