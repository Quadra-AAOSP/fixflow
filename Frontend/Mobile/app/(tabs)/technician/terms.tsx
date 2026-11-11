import { StateView } from '@/components/ui/StateView';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Check, FileSignature, ShieldCheck } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { API_BASE_URL } from '@/constants/config';
import { dashboardColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import {
  acceptTechnicianTerms,
  getTechnicianTerms,
} from '@/services/technicians';
import type { TechnicianTermsStatus } from '@/types/technician';
import { formatDate } from '@/utils/format';

/** Section numbers rendered from `technician.terms.sections.*`. */
const SECTIONS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

/**
 * Technician terms screen. Reads `GET /api/technician-terms/me` and accepts
 * the exact current version (`POST /api/technician-terms/accept`).
 *
 * The clauses are rendered natively so the technician can read and accept
 * without leaving the app; the published document link stays available for the
 * canonical copy.
 */
export default function TechnicianTermsScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user } = useAuth();

  const [terms, setTerms] = useState<TechnicianTermsStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const loadTerms = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      setTerms(await getTechnicianTerms());
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t('technician.terms.errors.couldNotLoad'),
      );
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  const handleAcceptTerms = useCallback(async () => {
    if (!terms?.currentVersion) return;
    setAccepting(true);
    setError(null);
    try {
      setTerms(await acceptTechnicianTerms(terms.currentVersion));
      setAcknowledged(false);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t('technician.terms.errors.couldNotAccept'),
      );
    } finally {
      setAccepting(false);
    }
  }, [terms?.currentVersion, t]);

  useEffect(() => {
    void loadTerms();
  }, [loadTerms]);

  const hasPublishedTerms = Boolean(terms?.currentVersion && terms?.documentUrl);
  const accepted = Boolean(terms?.acceptedCurrentVersion);
  const needsAcceptance = Boolean(terms?.enforcementRequired) && !accepted;

  /** The backend may publish a relative path (its own terms page) instead of an
   *  absolute URL; open it on the same host the app talks to. */
  const documentLink = terms?.documentUrl
    ? /^https?:\/\//i.test(terms.documentUrl)
      ? terms.documentUrl
      : `${API_BASE_URL}${terms.documentUrl.startsWith('/') ? '' : '/'}${terms.documentUrl}`
    : null;

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: t('technician.terms.title'),
          headerLeft: () => (
            <Pressable
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/more');
              }}
              className="flex-row items-center"
            >
              <ArrowLeft color={dashboardColors.teal} size={18} />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerClassName="px-5 pb-12 pt-4">
        {/* Title + status pill. */}
        <View className="mb-4 flex-row items-start gap-3">
          <View
            className="h-11 w-11 items-center justify-center rounded-full"
            style={{ backgroundColor: dashboardColors.statMintSoft }}
          >
            <FileSignature color={dashboardColors.statMintDeep} size={19} />
          </View>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-ink" style={{ letterSpacing: -0.5 }}>
              {t('technician.terms.title')}
            </Text>
            <Text className="mt-1 text-[11.5px] leading-[1.6] text-dashboard-subtitle">
              {t('technician.terms.intro')}
            </Text>
          </View>
        </View>

        {error ? (
          <Card className="mb-4">
            <Text accessibilityRole="alert" className="p-4 text-center text-[12px] text-tone-danger">
              {error}
            </Text>
          </Card>
        ) : null}

        {loading ? (
          <Card className="mb-4">
            <StateView variant="loading" title={t('technician.terms.loading')} />
          </Card>
        ) : terms && hasPublishedTerms ? (
          <>
            {/* Status banner. */}
            <View
              className="mb-4 flex-row items-center gap-2.5 rounded-xl border px-3.5 py-3"
              style={{
                borderColor: accepted ? 'rgb(198, 231, 222)' : 'rgb(238, 226, 179)',
                backgroundColor: accepted ? dashboardColors.statMintSoft : 'rgb(253, 248, 231)',
              }}
            >
              <ShieldCheck
                color={accepted ? dashboardColors.statMintDeep : dashboardColors.statCitronDeep}
                size={16}
              />
              <View className="flex-1">
                <Text
                  className="text-[12px] font-semibold"
                  style={{
                    color: accepted ? dashboardColors.statMintDeep : 'rgb(146, 108, 14)',
                  }}
                >
                  {t(
                    accepted
                      ? 'technician.terms.accepted'
                      : 'technician.terms.notAccepted',
                  )}
                </Text>
                <Text className="mt-0.5 text-[10.5px] text-dashboard-subtitle">
                  {t('technician.terms.version', { version: terms.currentVersion })}
                </Text>
              </View>
            </View>

            {/* The clauses, readable in-app. */}
            <Card padded={false} className="mb-4 overflow-hidden">
              <View className="border-b border-dashboard-card-line px-4 py-3">
                <Text className="text-[12.5px] font-semibold text-ink">
                  {t('technician.terms.documentTitle')}
                </Text>
                <Text className="mt-0.5 text-[10.5px] text-dashboard-caption">
                  {t('technician.terms.updated', { version: terms.currentVersion })}
                </Text>
              </View>
              <View className="px-4 py-3">
                {SECTIONS.map((section, index) => (
                  <View key={section} className={index > 0 ? 'mt-4' : ''}>
                    <Text className="text-[11.5px] font-semibold text-ink">
                      {`${section}. ${t(`technician.terms.sections.${section}.title`)}`}
                    </Text>
                    <Text className="mt-1 text-[11px] leading-[1.7] text-dashboard-subtitle">
                      {t(`technician.terms.sections.${section}.body`)}
                    </Text>
                  </View>
                ))}
              </View>
              {documentLink ? (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => {
                    void Linking.openURL(documentLink);
                  }}
                  className="border-t border-dashboard-card-line px-4 py-3 active:opacity-70"
                >
                  <Text className="text-[11.5px] font-semibold" style={{ color: dashboardColors.teal }}>
                    {t('technician.terms.openDocument')}
                  </Text>
                </Pressable>
              ) : null}
            </Card>

            {/* Acceptance. */}
            {needsAcceptance ? (
              <Card className="mb-4">
                <Text className="mb-1 text-[12.5px] font-semibold text-ink">
                  {t('technician.terms.acceptTitle')}
                </Text>
                <Text className="mb-3 text-[11px] leading-[1.6] text-dashboard-subtitle">
                  {t('technician.terms.acceptHint')}
                </Text>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: acknowledged }}
                  onPress={() => setAcknowledged(value => !value)}
                  className="mb-3 flex-row items-start gap-2.5 rounded-lg border border-dashboard-card-line p-3 active:opacity-80"
                >
                  <View
                    className="mt-0.5 h-[18px] w-[18px] items-center justify-center rounded-[5px] border"
                    style={{
                      borderColor: acknowledged ? dashboardColors.teal : dashboardColors.cardLine,
                      backgroundColor: acknowledged ? dashboardColors.teal : 'transparent',
                    }}
                  >
                    {acknowledged ? <Check color="#fff" size={12} /> : null}
                  </View>
                  <Text className="flex-1 text-[11.5px] leading-[1.6] text-ink">
                    {t('technician.terms.acknowledge', {
                      version: terms.currentVersion,
                    })}
                  </Text>
                </Pressable>
                <Button
                  label={t('technician.terms.accept')}
                  loading={accepting}
                  disabled={!acknowledged || accepting}
                  onPress={handleAcceptTerms}
                />
              </Card>
            ) : accepted ? (
              <Card className="mb-4">
                <Text className="text-[11.5px] leading-[1.6] text-dashboard-subtitle">
                  {t('technician.terms.acceptedHint')}
                </Text>
              </Card>
            ) : null}

            {terms.acceptances.length > 0 ? (
              <Card padded={false} className="mb-4 overflow-hidden">
                <Text className="border-b border-dashboard-card-line px-4 py-3 text-[10px] font-semibold uppercase text-dashboard-caption" style={{ letterSpacing: 0.6 }}>
                  {t('technician.terms.history')}
                </Text>
                {terms.acceptances.map((acceptance, index) => (
                  <View
                    key={`${acceptance.version}-${acceptance.acceptedAt}`}
                    className={`px-4 py-2.5 ${index > 0 ? 'border-t border-dashboard-card-line' : ''}`}
                  >
                    <Text className="text-[11px] leading-[1.6] text-dashboard-subtitle">
                      {t('technician.terms.acceptedOn', {
                        version: acceptance.version,
                        date: formatDate(acceptance.acceptedAt, true),
                      })}
                    </Text>
                  </View>
                ))}
              </Card>
            ) : null}
          </>
        ) : (
          <Card className="mb-4">
            <Text className="p-4 text-center text-[12px] text-dashboard-subtitle">
              {t('technician.terms.noTerms')}
            </Text>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}
