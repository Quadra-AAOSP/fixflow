import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AuthButton } from '@/components/auth/AuthButton';
import { AuthField } from '@/components/auth/AuthField';
import { AuthHeading } from '@/components/auth/AuthHeading';
import { AuthShell } from '@/components/auth/AuthShell';
import { fontFamilies } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import * as authApi from '@/services/auth';
import { ApiError } from '@/services/auth';
import {
  TECHNICIAN_SKILL_CATEGORIES,
  buildRegistrationPayload,
  validateRegistration,
} from '@/utils/registration';
import type { RegistrationFieldErrors } from '@/utils/registration';
import type { RegisterSkill } from '@/types';
import { BackToRoles } from './register-reporter';

type Details = {
  firstName: string; lastName: string; email: string;
  password: string; phone: string; address: string;
  trades: string; experience: string; qualifications: string;
  acceptTechnicianTerms: boolean;
};

/**
 * Dedicated technician registration form. Collects verification evidence,
 * structured skills, and terms acceptance. Site contracts are requested later.
 */
export default function RegisterTechnicianScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();

  const [details, setDetails] = useState<Details>({
    firstName: '', lastName: '', email: '', password: '', phone: '', address: '',
    trades: '', experience: '', qualifications: '',
    acceptTechnicianTerms: false,
  });
  const [skills, setSkills] = useState<RegisterSkill[]>([
    { category: 'plumbing', specialty: '', proficiency: 3 },
  ]);
  const [termsVersion, setTermsVersion] = useState<string | null>(null);
  const [termsUrl, setTermsUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<RegistrationFieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);

  useEffect(() => {
    void authApi.getCurrentTechnicianTerms()
      .then((terms) => {
        setTermsVersion(terms.currentVersion);
        setTermsUrl(terms.documentUrl);
      })
      .catch(() => {
        setTermsVersion(null);
        setTermsUrl(null);
      });
  }, []);

  if (!isLoading && isAuthenticated) return <Redirect href="/(tabs)" />;

  function update<K extends keyof Details>(key: K, value: Details[K]) {
    setDetails((d) => ({ ...d, [key]: value }));
    setErrors((e) => {
      if (!e[key as keyof RegistrationFieldErrors]) return e;
      const copy = { ...e };
      delete copy[key as keyof RegistrationFieldErrors];
      return copy;
    });
    setServerError(null);
  }

  function validateAll(): RegistrationFieldErrors {
    return validateRegistration({
      ...details,
      role: 'technician',
      siteId: '',
      technicianTermsVersion: termsVersion ?? '',
      skills,
    });
  }

  async function submit() {
    if (submitting || accountCreated) return;
    const all = validateAll();
    setErrors(all);
    setServerError(null);
    if (Object.keys(all).length > 0) return;

    let payload;
    try {
      payload = buildRegistrationPayload({
        ...details,
        role: 'technician',
        siteId: '',
        technicianTermsVersion: termsVersion ?? '',
        skills,
      });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : t('auth.registerTechnician.errors.prepareForm'));
      return;
    }

    setSubmitting(true);
    try {
      await authApi.register(payload);
      setAccountCreated(true);
      try {
        await login({ email: payload.email, password: payload.password });
      } catch {
        setServerError(t('auth.registerTechnician.errors.accountCreatedButAutoSignInFailed'));
      }
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : t('auth.registerTechnician.errors.generic'));
    } finally {
      setSubmitting(false);
    }
  }

  if (accountCreated) {
    return (
      <AuthShell>
        <AuthHeading
          kicker={t('auth.registerTechnician.kicker')}
          title={t('auth.registerTechnician.accountReadyTitle')}
        />
        <Text className="mb-4 text-[12px] leading-[20px] text-auth-body">
          {serverError ?? t('auth.registerTechnician.accountReadyBody')}
        </Text>
        <AuthButton
          label={t('auth.registerTechnician.continueSignIn')}
          accessibilityLabel={t('auth.registerTechnician.continueSignIn')}
          onPress={() => router.replace('/(auth)/login')}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <BackToRoles />
      <AuthHeading
        kicker={t('auth.registerTechnician.kicker')}
        title={t('auth.registerTechnician.title')}
        description={t('auth.registerTechnician.description')}
      />
      <Text className="mb-4 text-[11px] leading-[17px] text-auth-body">
        {t('auth.registerTechnician.independentNote')}
      </Text>

      <AuthField
        label={t('auth.registerTechnician.firstName')}
        value={details.firstName}
        onChangeText={(v) => update('firstName', v)}
        error={errors.firstName}
        autoCapitalize="words"
        placeholder={t('auth.registerTechnician.firstNamePlaceholder')}
      />
      <AuthField
        label={t('auth.registerTechnician.lastName')}
        value={details.lastName}
        onChangeText={(v) => update('lastName', v)}
        error={errors.lastName}
        autoCapitalize="words"
        placeholder={t('auth.registerTechnician.lastNamePlaceholder')}
      />
      <AuthField
        label={t('auth.registerTechnician.email')}
        value={details.email}
        onChangeText={(v) => update('email', v)}
        error={errors.email}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder={t('auth.registerTechnician.emailPlaceholder')}
      />
      <AuthField
        label={t('auth.registerTechnician.password')}
        value={details.password}
        onChangeText={(v) => update('password', v)}
        error={errors.password}
        secureTextEntry
        placeholder={t('auth.registerTechnician.passwordPlaceholder')}
      />
      <AuthField
        label={t('auth.registerTechnician.contactPhone')}
        value={details.phone}
        onChangeText={(v) => update('phone', v)}
        error={errors.phone}
        keyboardType="phone-pad"
        placeholder={t('auth.registerTechnician.phonePlaceholder')}
      />
      <AuthField
        label={t('auth.registerTechnician.address')}
        value={details.address}
        onChangeText={(v) => update('address', v)}
        error={errors.address}
        placeholder={t('auth.registerTechnician.addressPlaceholder')}
      />
      <AuthField
        label={t('auth.registerTechnician.trades')}
        value={details.trades}
        onChangeText={(v) => update('trades', v)}
        error={errors.trades}
        placeholder={t('auth.registerTechnician.tradesPlaceholder')}
      />
      <AuthField
        label={t('auth.registerTechnician.experience')}
        value={details.experience}
        onChangeText={(v) => update('experience', v)}
        error={errors.experience}
        placeholder={t('auth.registerTechnician.experiencePlaceholder')}
        multiline
      />
      <AuthField
        label={t('auth.registerTechnician.qualifications')}
        value={details.qualifications}
        onChangeText={(v) => update('qualifications', v)}
        error={errors.qualifications}
        placeholder={t('auth.registerTechnician.qualificationsPlaceholder')}
        multiline
      />

      <Text className="mb-2 text-[11px] text-auth-ink" style={{ fontFamily: fontFamilies.bodySemiBold }}>
        Skills (ranking / marketplace)
      </Text>
      {skills.map((skill, index) => (
        <View key={index} className="mb-3 gap-2 rounded-xl border border-auth-line bg-auth-field p-3">
          <Text className="text-[10px] text-auth-body">Category</Text>
          <View className="mb-1 flex-row flex-wrap gap-2">
            {TECHNICIAN_SKILL_CATEGORIES.map((category) => {
              const selected = skill.category === category;
              return (
                <Pressable
                  key={category}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setSkills((rows) => rows.map((row, i) => (i === index ? { ...row, category } : row)));
                    setErrors((e) => {
                      if (!e.skills) return e;
                      const copy = { ...e };
                      delete copy.skills;
                      return copy;
                    });
                  }}
                  className={`rounded-lg border px-2 py-1 ${selected ? 'border-coral-link bg-white' : 'border-auth-line'}`}
                >
                  <Text className="text-[11px] text-auth-ink">{category}</Text>
                </Pressable>
              );
            })}
          </View>
          <AuthField
            label="Specialty (optional)"
            value={skill.specialty ?? ''}
            onChangeText={(v) => setSkills((rows) => rows.map((row, i) => (i === index ? { ...row, specialty: v } : row)))}
          />
          <Text className="text-[10px] text-auth-body">Proficiency</Text>
          <View className="mb-1 flex-row gap-2">
            {[1, 2, 3, 4, 5].map((level) => {
              const selected = skill.proficiency === level;
              return (
                <Pressable
                  key={level}
                  onPress={() => setSkills((rows) => rows.map((row, i) => (i === index ? { ...row, proficiency: level } : row)))}
                  className={`h-8 w-8 items-center justify-center rounded-lg border ${selected ? 'border-coral-link bg-white' : 'border-auth-line'}`}
                >
                  <Text className="text-[12px] text-auth-ink">{level}</Text>
                </Pressable>
              );
            })}
          </View>
          {skills.length > 1 ? (
            <Pressable onPress={() => setSkills((rows) => rows.filter((_, i) => i !== index))}>
              <Text className="text-[11px] text-coral-link">Remove skill</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      {skills.length < 20 ? (
        <Pressable
          className="mb-3"
          onPress={() => setSkills((rows) => [...rows, { category: 'general', specialty: '', proficiency: 3 }])}
        >
          <Text className="text-[11px] text-coral-link">Add another skill</Text>
        </Pressable>
      ) : null}
      {errors.skills ? (
        <Text className="-mt-1 mb-3 text-[11px] text-auth-danger">{errors.skills}</Text>
      ) : null}

      <Text className="-mt-1 mb-3 text-[10px] leading-[17px] text-auth-body">
        {t('auth.registerTechnician.qualificationNotice')}
      </Text>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: details.acceptTechnicianTerms }}
        onPress={() => update('acceptTechnicianTerms', !details.acceptTechnicianTerms)}
        className="mb-2 flex-row items-start gap-2"
      >
        <View className={`mt-0.5 h-4 w-4 rounded border ${details.acceptTechnicianTerms ? 'border-coral-link bg-coral-link' : 'border-auth-line bg-white'}`} />
        <Text className="flex-1 text-[11px] leading-[18px] text-auth-body">
          {t('auth.registerTechnician.acceptTermsPrefix')}{' '}
          <Text
            className="text-coral-link"
            onPress={() => {
              if (termsUrl) void Linking.openURL(termsUrl);
            }}
          >
            {t('auth.registerTechnician.acceptTermsLink')}
          </Text>
          {termsVersion ? ` (${termsVersion})` : ''}.
        </Text>
      </Pressable>
      {errors.acceptTechnicianTerms ? (
        <Text className="mb-3 text-[11px] text-auth-danger">{errors.acceptTechnicianTerms}</Text>
      ) : null}

      {serverError ? (
        <Text className="my-2 text-[12px] leading-[20px] text-auth-danger">
          {serverError}
        </Text>
      ) : null}

      <AuthButton
        label={t('auth.registerTechnician.submit')}
        loading={submitting}
        onPress={submit}
      />
    </AuthShell>
  );
}
