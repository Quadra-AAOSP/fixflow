import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { dashboardColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import { listTechnicianInvitations } from '@/services/technician';
import { listSites } from '@/services/sites';
import type { Site } from '@/types';
import type { TechnicianInvitationInbox } from '@/types/technician';
import { formatDate, humanize } from '@/utils/format';

/**
 * Technician invitation inbox. Invitations are site/category based and never
 * create a contract or assignment — the technician reviews them and can
 * request a site contract from the contract-request screen.
 */
export default function TechnicianInvitationsScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user } = useAuth();

  const [inbox, setInbox] = useState<TechnicianInvitationInbox | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInvitations = useCallback(
    async (page = 0) => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const [next, directory] = await Promise.all([
          listTechnicianInvitations(page),
          listSites().catch(() => [] as Site[]),
        ]);
        setInbox(next);
        setSites(directory);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : t('technician.invitations.errors.couldNotLoad'),
        );
      } finally {
        setLoading(false);
      }
    },
    [user, t],
  );

  useEffect(() => {
    void loadInvitations(0);
  }, [loadInvitations]);

  const siteName = (siteId: number) =>
    sites.find((site) => site.id === siteId)?.name ??
    t('technician.invitations.siteFallback', { id: siteId });

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: t('technician.invitations.title'),
          headerLeft: () => (
            <Pressable onPress={() => router.back()} className="flex-row items-center">
              <ArrowLeft color={dashboardColors.teal} size={18} />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerClassName="px-5 pb-12 pt-4">
        <Text
          className="mb-2 text-2xl font-bold text-ink"
          style={{ letterSpacing: -0.5 }}
        >
          {t('technician.invitations.title')}
        </Text>
        <Text className="mb-4 text-[12px] leading-[1.7] text-dashboard-subtitle">
          {t('technician.invitations.intro')}
        </Text>

        {error ? (
          <Card className="mb-4">
            <Text className="p-4 text-center text-tone-danger">{error}</Text>
          </Card>
        ) : null}

        {loading ? (
          <Card className="mb-4">
            <Text className="p-4 text-center text-dashboard-subtitle">
              {t('technician.invitations.loading')}
            </Text>
          </Card>
        ) : inbox && inbox.items.length > 0 ? (
          <>
            <Card padded={false} className="mb-4">
              {inbox.items.map((invitation) => (
                <View
                  key={invitation.id}
                  className="border-b border-dashboard-card-line px-4 py-3"
                >
                  <Text className="text-[13px] font-semibold text-ink">
                    {siteName(invitation.siteId)}
                  </Text>
                  <Text className="mt-0.5 text-[11px] text-dashboard-subtitle">
                    {humanize(invitation.category)}
                    {invitation.specialty ? ` · ${humanize(invitation.specialty)}` : ''}
                  </Text>
                  <Text className="mt-1 text-[12px] leading-[1.7] text-ink">
                    {invitation.reason}
                  </Text>
                  <Text className="mt-1 text-[10px] text-dashboard-caption">
                    {t('technician.invitations.createdAt', {
                      date: formatDate(invitation.createdAt, true),
                    })}
                  </Text>
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => router.push('/technician/contract-requests')}
                    className="mt-2 flex-row items-center gap-1 self-start active:opacity-70"
                  >
                    <Text
                      className="text-[11px] font-semibold"
                      style={{ color: dashboardColors.teal }}
                    >
                      {t('technician.invitations.requestContract')}
                    </Text>
                    <ArrowRight color={dashboardColors.teal} size={13} />
                  </Pressable>
                </View>
              ))}
            </Card>

            <View className="flex-row items-center justify-between">
              <Pressable
                accessibilityRole="button"
                disabled={loading || inbox.page === 0}
                onPress={() => {
                  void loadInvitations(Math.max(inbox.page - 1, 0));
                }}
                className="rounded-md border border-dashboard-card-line px-3 py-1.5 active:opacity-70"
                style={{ opacity: inbox.page === 0 ? 0.45 : 1 }}
              >
                <Text className="text-[11px] font-semibold text-ink">
                  {t('technician.invitations.previous')}
                </Text>
              </Pressable>
              <Text className="text-[11px] text-dashboard-subtitle">
                {t('technician.invitations.page', { page: inbox.page + 1 })}
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={loading || !inbox.hasNext}
                onPress={() => {
                  void loadInvitations(inbox.page + 1);
                }}
                className="rounded-md border border-dashboard-card-line px-3 py-1.5 active:opacity-70"
                style={{ opacity: inbox.hasNext ? 1 : 0.45 }}
              >
                <Text className="text-[11px] font-semibold text-ink">
                  {t('technician.invitations.next')}
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Card className="mb-4">
            <Text className="p-4 text-center text-dashboard-subtitle">
              {t('technician.invitations.noInvitations')}
            </Text>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}
