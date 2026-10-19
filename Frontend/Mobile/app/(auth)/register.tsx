import { Redirect, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import {
  ClipboardList,
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
 * Role picker — the first step of sign-up. Navigates to one of the two
 * distinct form screens below (reporter or technician), each with its own
 * validation rules and field set. Admin applications and managed roles stay
 * informational here, matching the existing public-signup contract.
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
    // staff / super_admin — informational card, no navigation
  }

  return (
    <AuthShell>
      <AuthHeading
        kicker={t('auth.register.kicker')}
        title={t('auth.register.title')}
        titleAccent="."
        description={t('auth.register.description')}
      />

      <View className="gap-3">
        <RoleCard
          icon={ClipboardList}
          title={t('auth.register.reporterTitle')}
          subtitle={t('auth.register.reporterSubtitle')}
          onPress={() => choose('reporter')}
        />
        <RoleCard
          icon={Wrench}
          title={t('auth.register.technicianTitle')}
          subtitle={t('auth.register.technicianSubtitle')}
          technician
          onPress={() => choose('technician')}
        />
        <RoleCard
          icon={ShieldCheck}
          title={t('auth.register.adminTitle')}
          subtitle={t('auth.register.adminSubtitle')}
          onPress={() => choose('admin')}
        />
      </View>

      <View className="mt-5 border-t border-auth-divider pt-5">
        <View className="mb-2 flex-row items-center gap-2">
          <ShieldCheck color={authColors.note} size={16} />
          <Text className="text-[11px] text-auth-note">
            {t('auth.register.joiningTeam')}
          </Text>
        </View>
        <ManagedRoleHint role="staff" t={t} />
        <ManagedRoleHint role="super_admin" t={t} />
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

function RoleCard({
  icon: Icon, title, subtitle, technician, onPress,
}: {
  icon: LucideIcon; title: string; subtitle: string;
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
        <Text
          className="text-[13px] text-auth-ink"
          style={{ fontFamily: fontFamilies.bodySemiBold }}
        >
          {title}
        </Text>
        <Text className="mt-1 text-[10px] leading-4 text-auth-body">
          {subtitle}
        </Text>
      </View>
      <Text className="text-[13px] text-auth-ink">→</Text>
    </Pressable>
  );
}

function ManagedRoleHint({ role, t }: { role: 'staff' | 'super_admin'; t: (key: string, vars?: Record<string, unknown>) => string }) {
  return (
    <Text
      className="text-[11px] text-auth-ghost-ink"
      style={{ fontFamily: fontFamilies.bodyMedium }}
    >
      {t('auth.register.managedRoleHint', { role: roleLabels[role] })}
    </Text>
  );
}
