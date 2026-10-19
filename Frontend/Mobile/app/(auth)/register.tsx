import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  ArrowLeft,
  ClipboardList,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react-native';

import { AuthButton } from '@/components/auth/AuthButton';
import { AuthField } from '@/components/auth/AuthField';
import { AuthHeading } from '@/components/auth/AuthHeading';
import { AuthShell } from '@/components/auth/AuthShell';
import { roleLabels } from '@/constants/access';
import { authColors, fontFamilies } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useAccountPolicy } from '@/hooks/useAccountPolicy';
import * as authApi from '@/services/auth';
import { ApiError } from '@/services/auth';
import type { UserRole } from '@/types';
import { buildRegistrationPayload } from '@/utils/registration';

/** Roles offered on the public signup screen, in the web's order. */
type PublicRole = 'reporter' | 'technician' | 'admin';
type ManagedRole = 'staff' | 'super_admin';

type Details = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  siteId: string;
  phone: string;
  address: string;
};

const EMPTY_DETAILS: Details = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  siteId: '',
  phone: '',
  address: '',
};

const PUBLIC_ROLE_CARDS: {
  role: PublicRole;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  technician?: boolean;
}[] = [
  {
    role: 'reporter',
    icon: ClipboardList,
    title: 'I’m a reporter',
    subtitle: 'Report and track issues at your site.',
  },
  {
    role: 'technician',
    icon: Wrench,
    title: 'I’m a technician',
    subtitle: 'Register independently. A site contract is optional.',
    technician: true,
  },
  {
    role: 'admin',
    icon: ShieldCheck,
    title: 'I’m a site administrator',
    subtitle: 'Apply to manage a site — a super admin approves your request.',
  },
];

const MANAGED_ROLES: ManagedRole[] = ['staff', 'super_admin'];

/**
 * Sign-up. Mirrors `Frontend/Web/src/views/auth/RegisterView.vue`, including
 * its two-step flow: pick a role, then complete the form (or, for the managed
 * roles, read why an administrator must create the account).
 *
 * The backend accepts `reporter` / `technician` / `admin` from this endpoint.
 * An `admin` submission is demoted to `reporter` server-side and files a
 * pending site-admin application (`AuthService.register`); the applicant
 * tracks it under More → My admin application. Staff and super_admin stay
 * informational — exactly as on the web.
 */
export default function RegisterScreen() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();

  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [details, setDetails] = useState<Details>(EMPTY_DETAILS);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);

  if (!isLoading && isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  function update<K extends keyof Details>(key: K, value: Details[K]) {
    setDetails((current) => ({ ...current, [key]: value }));
  }

  function chooseRole(role: UserRole) {
    setSelectedRole(role);
    setDetails((current) => ({ ...current, siteId: '' }));
    setError(null);
  }

  function describe(err: unknown): string {
    if (err instanceof ApiError) return err.message;
    if (err instanceof Error) return err.message;
    return 'Something went wrong. Please try again.';
  }

  async function submit() {
    if (submitting || accountCreated || !selectedRole) return;
    setError(null);

    let payload;
    try {
      payload = buildRegistrationPayload({ ...details, role: selectedRole });
    } catch (err) {
      setError(describe(err));
      return;
    }

    setSubmitting(true);
    try {
      await authApi.register(payload);
      setAccountCreated(true);
      try {
        await login({ email: payload.email, password: payload.password });
        setDetails(EMPTY_DETAILS);
      } catch {
        // The account exists but the session did not start — say so rather
        // than reporting a failed registration.
        setDetails((current) => ({ ...current, password: '' }));
        setError(
          'Your account was created, but automatic sign-in did not finish. Sign in with your new account.',
        );
      }
    } catch (err) {
      setError(describe(err));
    } finally {
      setSubmitting(false);
    }
  }

  const isPublicRole =
    selectedRole === 'reporter' ||
    selectedRole === 'technician' ||
    selectedRole === 'admin';
  const isTechnician = selectedRole === 'technician';

  if (accountCreated) {
    return (
      <AuthShell>
        <Text
          className="text-[26px] leading-8 text-auth-ink"
          style={{ fontFamily: fontFamilies.headBold, letterSpacing: -0.8 }}
        >
          Your account is ready
        </Text>
        <Text className="mt-3.5 text-[12px] leading-[21px] text-auth-body">
          {error ??
            (selectedRole === 'admin'
              ? 'You can sign in now — your account works as a reporter while a super administrator reviews your application. Track it under More → My admin application.'
              : 'You can now sign in.')}
        </Text>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.replace('/(auth)/login')}
          className="mt-2 self-start py-2.5 active:opacity-70"
        >
          <Text
            className="text-[11px] text-coral-link"
            style={{ fontFamily: fontFamilies.bodySemiBold }}
          >
            Continue to sign in →
          </Text>
        </Pressable>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthHeading
        kicker="FIND YOUR PLACE IN FIXFLOW"
        title="Join your community"
        titleAccent="."
        description="Choose how you’ll help keep things working."
      />

      {selectedRole === null ? (
        <View>
          <View className="gap-3">
            {PUBLIC_ROLE_CARDS.map((card) => (
              <RoleCard
                key={card.role}
                icon={card.icon}
                title={card.title}
                subtitle={card.subtitle}
                technician={card.technician}
                onPress={() => chooseRole(card.role)}
              />
            ))}
          </View>

          <View className="mt-2 border-t border-auth-divider pt-5">
            <View className="mb-2 flex-row items-center gap-2">
              <ShieldCheck color={authColors.note} size={16} />
              <Text className="text-[11px] text-auth-note">
                Joining a management team?
              </Text>
            </View>
            {MANAGED_ROLES.map((role) => (
              <Pressable
                key={role}
                accessibilityRole="button"
                onPress={() => chooseRole(role)}
                className="min-h-[30px] justify-center py-1.5 active:opacity-60"
              >
                <Text
                  className="text-[11px] text-auth-ghost-ink"
                  style={{ fontFamily: fontFamilies.bodyMedium }}
                >
                  {roleLabels[role]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <View>
          <View className="flex-row items-center">
            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={() => {
                setSelectedRole(null);
                setError(null);
              }}
              className="min-h-[30px] flex-row items-center gap-1.5 active:opacity-60"
            >
              <ArrowLeft color={authColors.note} size={14} />
              <Text className="text-[10px] text-auth-note">Change role</Text>
            </Pressable>
            <View className="ml-3 rounded-[7px] bg-auth-chip-bg px-2.5 py-1.5">
              <Text className="text-[10px] text-auth-chip-ink">
                {roleLabels[selectedRole]}
              </Text>
            </View>
          </View>

          {isPublicRole ? (
            <PublicRoleForm
              role={selectedRole}
              isTechnician={isTechnician}
              details={details}
              update={update}
              error={error}
              submitting={submitting}
              onSubmit={submit}
            />
          ) : (
            <ManagedRolePanel role={selectedRole as ManagedRole} />
          )}
        </View>
      )}

      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Sign in"
        onPress={() => router.push('/(auth)/login')}
        className="mt-4 min-h-[44px] items-center justify-center active:opacity-70"
      >
        <Text className="text-center text-[12px] text-auth-body">
          Already have an account?{' '}
          <Text
            className="text-coral-link"
            style={{ fontFamily: fontFamilies.bodySemiBold }}
          >
            Sign in
          </Text>
        </Text>
      </Pressable>
    </AuthShell>
  );
}

/** `.auth-form-panel .role-option` — the white picker card. */
function RoleCard({
  icon: Icon,
  title,
  subtitle,
  technician = false,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  technician?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
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

/** The reporter / technician form, matching RegisterView's field set. */
function PublicRoleForm({
  role,
  isTechnician,
  details,
  update,
  error,
  submitting,
  onSubmit,
}: {
  role: UserRole;
  isTechnician: boolean;
  details: Details;
  update: <K extends keyof Details>(key: K, value: Details[K]) => void;
  error: string | null;
  submitting: boolean;
  onSubmit: () => void;
}) {
  const policy = useAccountPolicy();
  return (
    <View className="mt-4">
      <Text className="mb-6 text-[11px] leading-[20px] text-auth-body">
        {isTechnician
          ? 'Start with no contracted sites. You can remain independent and arrange site contracts later.'
          : role === 'admin'
            ? 'You register as a reporter immediately. A super administrator reviews your application and activates the admin role — sign in again once it is approved.'
            : 'Your site administrator will provide the site ID to use when registering.'}
      </Text>

      <View className="flex-row gap-3">
        <AuthField
          label={isTechnician ? 'Legal first name' : 'First name'}
          value={details.firstName}
          onChangeText={(value) => update('firstName', value)}
          autoCapitalize="words"
          textContentType="givenName"
          className="flex-1"
          placeholder="Alex"
        />
        <AuthField
          label={isTechnician ? 'Legal last name' : 'Last name'}
          value={details.lastName}
          onChangeText={(value) => update('lastName', value)}
          autoCapitalize="words"
          textContentType="familyName"
          className="flex-1"
          placeholder="Ng"
        />
      </View>

      <AuthField
        label="Email"
        value={details.email}
        onChangeText={(value) => update('email', value)}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        placeholder="you@example.com"
      />

      <AuthField
        label="Password"
        value={details.password}
        onChangeText={(value) => update('password', value)}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="new-password"
        placeholder="At least 15 characters"
      />
      <FieldHint>
        Use at least {policy?.passwordMinLength ?? 'the required number of'} characters. A long, unique passphrase
        works well.
      </FieldHint>

      {role === 'reporter' || role === 'admin' ? (
        <>
          <AuthField
            label="Site ID"
            value={details.siteId}
            onChangeText={(value) => update('siteId', value)}
            keyboardType="number-pad"
            placeholder="e.g. 1"
          />
          <FieldHint>
            {role === 'admin'
              ? 'The ID of the site you are applying to administer.'
              : 'Use the actual ID from your site administrator.'}
          </FieldHint>
        </>
      ) : null}

      <AuthField
        label={isTechnician ? 'Contact phone' : 'Phone (optional)'}
        value={details.phone}
        onChangeText={(value) => update('phone', value)}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        placeholder="+65 …"
      />

      {isTechnician ? (
        <>
          <AuthField
            label="Business or correspondence address"
            value={details.address}
            onChangeText={(value) => update('address', value)}
            autoCapitalize="sentences"
            textContentType="fullStreetAddress"
            autoComplete="street-address"
            placeholder="Street, city, postcode"
          />
          <FieldHint>
            Next: add your trade and specialty. Registration creates an account;
            it does not verify your identity or qualifications.
          </FieldHint>
          <FieldHint>
            Before site work, arrange qualification, applicable licence,
            insurance, and reference checks with the site administrator. Secure
            document submission is not available yet. Do not put identity
            numbers or document links in these fields.
          </FieldHint>
        </>
      ) : null}

      {error ? (
        <Text className="my-2 text-[12px] leading-[20px] text-auth-danger">
          {error}
        </Text>
      ) : null}

      <View className="mt-1">
        <AuthButton
          label={
            isTechnician
              ? 'Create account & add trade →'
              : role === 'admin'
                ? 'Submit admin application →'
                : 'Create reporter account →'
          }
          loading={submitting}
          onPress={onSubmit}
        />
      </View>
    </View>
  );
}

/** `.field-hint` — pulled up under the preceding field. */
function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <Text className="-mt-3 mb-4 text-[10px] leading-[17px] text-auth-body">
      {children}
    </Text>
  );
}

/** `.managed-access-message` — why these roles cannot self-register. */
function ManagedRolePanel({ role }: { role: ManagedRole }) {
  const policy = useAccountPolicy();
  const heading =
    role === 'super_admin'
      ? 'Privileged access requires verification'
      : 'Your account is created by an administrator';

  const body =
    role === 'staff'
      ? 'Your site administrator or a super administrator must create your staff account for your site.'
      : policy?.managedRoleMessage ?? 'Ask an authorized administrator about managed access.';

  return (
    <View className="my-4 rounded-[13px] bg-auth-managed-bg p-5">
      <ShieldCheck color={authColors.managedIcon} size={28} />
      <Text
        className="mt-3 text-[17px] leading-6 text-auth-ink"
        style={{ fontFamily: fontFamilies.head }}
      >
        {heading}
      </Text>
      <Text className="mt-3 text-[12px] leading-[21px] text-auth-managed-ink">
        {body}
      </Text>
      {role === 'super_admin' ? (
        <Text className="text-[10px] leading-[17px] text-auth-managed-ink">
          Super-admin access is not available through public registration.
        </Text>
      ) : null}
    </View>
  );
}
