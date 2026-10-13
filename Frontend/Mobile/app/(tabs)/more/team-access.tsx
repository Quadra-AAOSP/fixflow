import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Check, Plus } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Picker } from '@/components/ui/Picker';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { TextField } from '@/components/ui/TextField';
import {
  MAX_ADDRESS_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PHONE_LENGTH,
  PASSWORD_MAX_BYTES,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  canProvision,
  provisionableRoles,
  roleLabels,
} from '@/constants/access';
import { themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import { provisionUser } from '@/services/admin';
import { listSites } from '@/services/sites';
import type { ProvisionUserPayload, Site, UserRole } from '@/types';

/**
 * Team access. Admin and super_admin only. Mirrors `TeamAccessView.vue` on the
 * web build — the actor picks a role, a site, fills the new user's name /
 * work email / initial password, and the backend mints the account. The
 * backend returns the new user; the new person signs in themselves.
 */
export default function TeamAccessScreen() {
  const palette = themeColors();
  const { user } = useAuth();

  const [sites, setSites] = useState<Site[] | null>(null);
  const [loadingSites, setLoadingSites] = useState(false);
  const [sitesError, setSitesError] = useState<string | null>(null);

  const [role, setRole] = useState<Extract<UserRole, 'staff' | 'admin'> | null>(
    null,
  );
  const [siteId, setSiteId] = useState<number | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const roles = useMemo(
    () => (user ? provisionableRoles(user.role) : []),
    [user],
  );

  const loadSites = useCallback(async () => {
    setLoadingSites(true);
    setSitesError(null);
    try {
      const result = await listSites();
      setSites(result);
    } catch (err) {
      setSitesError(
        err instanceof ApiError ? err.message : 'Could not load sites.',
      );
    } finally {
      setLoadingSites(false);
    }
  }, []);

  useEffect(() => {
    void loadSites();
  }, [loadSites]);

  // Default the role to the first allowed role (so the picker doesn't open
  // with a null value), but only the first time the screen is opened.
  useEffect(() => {
    if (role === null && roles.length > 0) {
      setRole(roles[0] as Extract<UserRole, 'staff' | 'admin'>);
    }
  }, [role, roles]);

  // Pick a sensible default site once the list arrives.
  useEffect(() => {
    if (siteId === null && sites && sites.length > 0) {
      const userSite = sites.find((site) => site.id === user?.siteId);
      setSiteId(userSite?.id ?? sites[0].id);
    }
  }, [siteId, sites, user?.siteId]);

  if (!user || !canProvision(user.role)) {
    return (
      <Screen>
        <StateView
          variant="empty"
          title="Admins only"
          description="This screen is reserved for site administrators and super administrators."
        />
      </Screen>
    );
  }

  const siteOptions = (sites ?? []).map((site) => ({
    value: String(site.id),
    label: site.name,
  }));
  const roleOptions = roles.map((value) => ({
    value,
    label: roleLabels[value],
  }));

  async function onSubmit() {
    if (role === null) {
      setError('Choose a role for the new account.');
      return;
    }
    if (siteId === null) {
      setError('Choose a site for the new account.');
      return;
    }
    if (firstName.trim().length === 0 || lastName.trim().length === 0) {
      setError('First and last name are required.');
      return;
    }
    if (firstName.length > MAX_NAME_LENGTH || lastName.length > MAX_NAME_LENGTH) {
      setError(`Name fields must be ${MAX_NAME_LENGTH} characters or fewer.`);
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError('A valid work email is required.');
      return;
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (password.length > PASSWORD_MAX_LENGTH) {
      setError(`Password must be at most ${PASSWORD_MAX_LENGTH} characters.`);
      return;
    }
    if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
      setError(
        `Password must be at most ${PASSWORD_MAX_BYTES} bytes when encoded.`,
      );
      return;
    }
    if (phone.length > MAX_PHONE_LENGTH) {
      setError(`Phone must be ${MAX_PHONE_LENGTH} characters or fewer.`);
      return;
    }
    if (address.length > MAX_ADDRESS_LENGTH) {
      setError(`Address must be ${MAX_ADDRESS_LENGTH} characters or fewer.`);
      return;
    }

    const payload: ProvisionUserPayload = {
      role,
      siteId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      password,
      phone: phone.trim().length > 0 ? phone.trim() : undefined,
      address: address.trim().length > 0 ? address.trim() : undefined,
    };

    setSubmitting(true);
    setError(null);
    try {
      const created = await provisionUser(payload);
      setConfirmation(
        `${created.firstName} ${created.lastName} can now sign in.`,
      );
      setFirstName('');
      setLastName('');
      setEmail('');
      setPassword('');
      setPhone('');
      setAddress('');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not provision the account right now.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="px-5 pb-12 pt-4"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-5 flex-row items-center gap-3">
          <View className="rounded-xl bg-primary/15 p-3">
            <Plus color={palette.primary} size={24} />
          </View>
          <View className="flex-1">
            <Text className="text-xl font-bold text-ink">Provision account</Text>
            <Text className="mt-0.5 text-xs text-muted">
              Mint a staff or admin account. The new person signs in with the
              initial password you set.
            </Text>
          </View>
        </View>

        {sitesError ? (
          <StateView
            variant="error"
            title="Could not load sites"
            description={sitesError}
            actionLabel="Retry"
            onAction={() => {
              void loadSites();
            }}
            className="py-6"
          />
        ) : null}

        {loadingSites && sites === null ? (
          <Card>
            <Text className="text-sm text-muted">Loading sites…</Text>
          </Card>
        ) : null}

        {!loadingSites && (sites?.length ?? 0) === 0 ? (
          <StateView
            variant="empty"
            title="No sites available"
            description="Create a site before provisioning accounts."
          />
        ) : null}

        {(sites?.length ?? 0) > 0 ? (
          <Card>
            <Picker
              label="Role"
              value={role ?? roles[0]}
              onChange={(value) =>
                setRole(value as Extract<UserRole, 'staff' | 'admin'>)
              }
              options={roleOptions}
            />
            <Picker
              label="Site"
              value={siteId !== null ? String(siteId) : null}
              onChange={(value) => setSiteId(Number(value))}
              options={siteOptions}
            />

            <TextField
              label="First name"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              maxLength={MAX_NAME_LENGTH}
            />
            <TextField
              label="Last name"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              maxLength={MAX_NAME_LENGTH}
            />
            <TextField
              label="Work email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
            <TextField
              label="Initial password"
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
              maxLength={PASSWORD_MAX_LENGTH}
            />
            <TextField
              label="Phone"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={MAX_PHONE_LENGTH}
            />
            <TextField
              label="Address"
              value={address}
              onChangeText={setAddress}
              autoCapitalize="words"
              maxLength={MAX_ADDRESS_LENGTH}
            />

            {error ? (
              <Text className="mb-3 text-xs text-tone-danger">{error}</Text>
            ) : null}
            {confirmation ? (
              <View className="mb-3 flex-row items-center gap-1.5">
                <Check color={palette.tone.success} size={14} />
                <Text className="text-xs text-tone-success">
                  {confirmation}
                </Text>
              </View>
            ) : null}

            <Button
              label={submitting ? 'Creating…' : 'Create account'}
              loading={submitting}
              onPress={onSubmit}
            />
          </Card>
        ) : null}

        <Text className="mt-4 text-xs leading-5 text-muted">
          You can also dismiss a confirmation and the next account can be
          created in the same session. The initial password should be changed
          on first sign-in.
        </Text>
      </ScrollView>
    </Screen>
  );
}
