import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Check, ShieldCheck, UserCheck, X } from 'lucide-react-native';

import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { dashboardColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import {
  decideSiteAdminApplication,
  listSiteAdminApplications,
} from '@/services/admin';
import type { SiteAdminApplication } from '@/types';
import { relativeTime } from '@/utils/format';

/**
 * Admin applications — the super_admin's approval queue for site-admin
 * self-applications filed through public registration.
 *
 * Approval promotes the applicant from reporter to admin for their requested
 * site; it takes effect on their next sign-in. The list only carries ids
 * (the backend response has no names), so identity verification stays an
 * out-of-band step — the reminder card says so explicitly.
 */
export default function AdminApplicationsScreen() {
  const { user } = useAuth();

  const [applications, setApplications] = useState<SiteAdminApplication[] | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setApplications(await listSiteAdminApplications());
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not load the pending applications.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function decide(id: number, approve: boolean) {
    setDecidingId(id);
    setNotice(null);
    try {
      await decideSiteAdminApplication(id, approve);
      setApplications((current) =>
        (current ?? []).filter((item) => item.id !== id),
      );
      setNotice(
        approve
          ? 'Application approved. The applicant becomes a site administrator on their next sign-in.'
          : 'Application rejected. The applicant remains a reporter.',
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Already decided elsewhere — drop the row by reloading.
        setNotice('That application was already decided. The list was refreshed.');
        await load();
      } else {
        setNotice(
          err instanceof ApiError
            ? err.message
            : 'Could not record the decision.',
        );
      }
    } finally {
      setDecidingId(null);
    }
  }

  if (!user || user.role !== 'super_admin') {
    return (
      <Screen>
        <StateView
          variant="empty"
          icon={ShieldCheck}
          title="Super administrators only"
          description="Site-admin applications are reviewed by a super administrator."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerClassName="px-5 pb-12 pt-4">
        <View className="mb-4">
          <Text
            className="text-2xl font-bold text-ink"
            style={{ letterSpacing: -0.5 }}
          >
            Admin applications
          </Text>
          <Text className="mt-1 text-[13px] leading-[1.7] text-dashboard-subtitle">
            Reporters who asked to administer a site. Verify the applicant and
            their authority over the site before approving — submitting the
            form is not verification.
          </Text>
        </View>

        {error ? (
          <StateView
            variant="error"
            description={error}
            actionLabel="Retry"
            onAction={() => {
              void load();
            }}
          />
        ) : null}

        {notice ? (
          <View
            className="mb-4 rounded-md px-3 py-2"
            style={{ backgroundColor: dashboardColors.statMintSoft }}
          >
            <Text
              className="text-[11px] leading-[1.6]"
              style={{ color: dashboardColors.statMintDeep }}
            >
              {notice}
            </Text>
          </View>
        ) : null}

        {loading && applications === null ? (
          <StateView variant="loading" title="Loading applications…" />
        ) : null}

        {applications !== null && applications.length === 0 ? (
          <StateView
            variant="empty"
            icon={UserCheck}
            title="No pending applications"
            description="Site-admin applications filed through public signup appear here."
          />
        ) : null}

        {(applications ?? []).map((application) => (
          <Card key={application.id} className="mb-3">
            <View className="flex-row items-center gap-3">
              <View
                className="h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: dashboardColors.statCitronSoft }}
              >
                <ShieldCheck
                  color={dashboardColors.statCitronDeep}
                  size={19}
                  strokeWidth={1.8}
                />
              </View>
              <View className="flex-1">
                <Text className="text-[13px] font-semibold text-ink">
                  User #{application.userId} → Site #{application.siteId}
                </Text>
                <Text className="mt-0.5 text-[10px] text-dashboard-subtitle">
                  Application #{application.id} · submitted{' '}
                  {relativeTime(application.createdAt)}
                </Text>
              </View>
            </View>
            <View className="mt-3 flex-row gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Approve application #${application.id}`}
                accessibilityState={{ disabled: decidingId !== null, busy: decidingId === application.id }}
                disabled={decidingId !== null}
                onPress={() => {
                  void decide(application.id, true);
                }}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-[10px] border px-3 py-2.5 active:opacity-90"
                style={{
                  backgroundColor: dashboardColors.ctaBg,
                  borderColor: dashboardColors.ctaBorder,
                  opacity: decidingId !== null ? 0.55 : 1,
                }}
              >
                <Check color={dashboardColors.ctaText} size={15} strokeWidth={2.4} />
                <Text
                  className="text-[12px] font-semibold"
                  style={{ color: dashboardColors.ctaText }}
                >
                  {decidingId === application.id ? 'Working…' : 'Approve'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Reject application #${application.id}`}
                accessibilityState={{ disabled: decidingId !== null, busy: decidingId === application.id }}
                disabled={decidingId !== null}
                onPress={() => {
                  void decide(application.id, false);
                }}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-[10px] border border-dashboard-card-line bg-dashboard-card-bg px-3 py-2.5 active:opacity-90"
                style={{ opacity: decidingId !== null ? 0.55 : 1 }}
              >
                <X
                  color={dashboardColors.statCoralDeep}
                  size={15}
                  strokeWidth={2.4}
                />
                <Text
                  className="text-[12px] font-semibold"
                  style={{ color: dashboardColors.statCoralDeep }}
                >
                  Reject
                </Text>
              </Pressable>
            </View>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
