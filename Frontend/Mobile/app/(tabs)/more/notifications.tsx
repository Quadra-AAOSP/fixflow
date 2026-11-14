import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Bell,
  BellRing,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileSignature,
  FileText,
  Mail,
  ShieldCheck,
  Wrench,
  XCircle,
} from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { colors, dashboardColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { listShopNotifications } from '@/services/shop';
import type { ShopNotification } from '@/types/shop';
import { toErrorMessage } from '@/lib/apiClient';
import { listNotifications, type NoticeType, type ReportNotice } from '@/services/notifications';
import { markNoticesSeen } from '@/lib/notificationSeen';
import { formatDate, relativeTime } from '@/utils/format';

type NoticeMeta = {
  titleKey: string;
  bodyKey: string;
  Icon: typeof Bell;
  tint: string;
  color: string;
};

/**
 * Accent pairs are read inside `noticeMeta` (called during render) rather
 * than captured at module load: the palette values are getters, and eager
 * evaluation here used to freeze the light-mode values into dark mode.
 */
function noticeMeta(type: NoticeType): NoticeMeta {
  const MINT = { tint: colors.mintBg, color: colors.mintInk };
  const AMBER = { tint: colors.warningSoft, color: colors.warningInk };
  const RED = { tint: colors.dangerSoft, color: colors.dangerInk };
  const SLATE = { tint: colors.neutralSoft, color: colors.neutralInk };
  switch (type) {
    case 'report_assigned':
      return { ...MINT, Icon: Wrench, titleKey: 'more.notifications.reportAssigned', bodyKey: 'more.notifications.reportAssignedBody' };
    case 'report_unattended':
      return { ...AMBER, Icon: BellRing, titleKey: 'more.notifications.unattendedTitle', bodyKey: 'more.notifications.unattendedBody' };
    case 'technician_assigned':
      return { ...MINT, Icon: Wrench, titleKey: 'more.notifications.technicianAssigned', bodyKey: 'more.notifications.technicianAssignedBody' };
    case 'work_completed':
      return { ...MINT, Icon: CheckCircle2, titleKey: 'more.notifications.workCompletedTitle', bodyKey: 'more.notifications.workCompleted' };
    case 'verification_verified':
      return { ...MINT, Icon: ShieldCheck, titleKey: 'more.notifications.verificationVerified', bodyKey: 'more.notifications.verificationVerifiedBody' };
    case 'verification_rejected':
      return { ...RED, Icon: XCircle, titleKey: 'more.notifications.verificationRejected', bodyKey: 'more.notifications.verificationRejectedBody' };
    case 'verification_suspended':
      return { ...RED, Icon: AlertTriangle, titleKey: 'more.notifications.verificationSuspended', bodyKey: 'more.notifications.verificationSuspendedBody' };
    case 'verification_submitted':
      return { ...AMBER, Icon: ClipboardList, titleKey: 'more.notifications.verificationSubmitted', bodyKey: 'more.notifications.verificationSubmittedBody' };
    case 'terms_required':
      return { ...AMBER, Icon: FileSignature, titleKey: 'more.notifications.termsRequired', bodyKey: 'more.notifications.termsRequiredBody' };
    case 'contract_submitted':
      return { ...AMBER, Icon: ClipboardList, titleKey: 'more.notifications.contractSubmitted', bodyKey: 'more.notifications.contractSubmittedBody' };
    case 'contract_approved':
      return { ...MINT, Icon: ShieldCheck, titleKey: 'more.notifications.contractApproved', bodyKey: 'more.notifications.contractApprovedBody' };
    case 'contract_rejected':
      return { ...RED, Icon: XCircle, titleKey: 'more.notifications.contractRejected', bodyKey: 'more.notifications.contractRejectedBody' };
    case 'job_posted':
      return { ...MINT, Icon: Briefcase, titleKey: 'more.notifications.jobPosted', bodyKey: 'more.notifications.jobPostedBody' };
    case 'vetting_approved':
      return { ...MINT, Icon: ShieldCheck, titleKey: 'more.notifications.vettingApproved', bodyKey: 'more.notifications.vettingApprovedBody' };
    case 'vetting_revoked':
      return { ...RED, Icon: AlertTriangle, titleKey: 'more.notifications.vettingRevoked', bodyKey: 'more.notifications.vettingRevokedBody' };
    case 'site_invitation':
      return { ...MINT, Icon: Mail, titleKey: 'more.notifications.invitationTitle', bodyKey: 'more.notifications.invitationBody' };
    case 'report_edited':
      return { ...SLATE, Icon: FileText, titleKey: 'more.notifications.editedTitle', bodyKey: 'more.notifications.edited' };
    case 'report_deleted':
      return { ...SLATE, Icon: FileText, titleKey: 'more.notifications.archivedTitle', bodyKey: 'more.notifications.archived' };
    default:
      return { ...SLATE, Icon: Bell, titleKey: 'more.notifications.title', bodyKey: 'more.notifications.emptyTitle' };
  }
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  return <NotificationFeeds key={`${user?.id ?? ''}:${user?.role ?? ''}`} />;
}

function NotificationFeeds() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation('common');
  const [notices, setNotices] = useState<ReportNotice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const requestVersion = useRef(0);

  const load = useCallback(async (nextPage: number) => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError('');
    try {
      const result = await listNotifications(nextPage);
      if (version !== requestVersion.current) return;
      setNotices(current => nextPage === 0 ? result.content
        : [...current, ...result.content.filter(item => !current.some(notice => notice.id === item.id))]);
      if (user?.id != null) void markNoticesSeen(user.id, 'reports', result.content);
      setHasMore(result.hasMore);
      setPage(nextPage);
    } catch (err) {
      if (version === requestVersion.current) {
        setError(toErrorMessage(err, { fallback: t('more.notifications.loadError') }));
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [t, user?.id]);

  useFocusEffect(useCallback(() => {
    void load(0);
    return () => { requestVersion.current++; };
  }, [load]));

  /** Every notice type has a destination; unknown/legacy rows stay inert. */
  function openNotice(notice: ReportNotice) {
    switch (notice.type) {
      case 'site_invitation':
        router.push({ pathname: '/technician/invitations', params: { invitationId: String(notice.invitationId ?? '') } });
        return;
      case 'verification_submitted':
        router.push('/more/verification-reviews');
        return;
      case 'verification_verified':
      case 'verification_rejected':
      case 'verification_suspended':
      case 'terms_required':
        router.push('/more/my-verification');
        return;
      case 'job_posted':
        router.push('/more/marketplace');
        return;
      case 'contract_submitted':
      case 'vetting_approved':
      case 'vetting_revoked':
        router.push('/more/contracts');
        return;
      case 'contract_approved':
      case 'contract_rejected':
        router.push('/technician/contract-requests');
        return;
      default:
        if (notice.reportId != null) router.push(`/reports/${notice.reportId}`);
    }
  }

  return (
    <Screen>
      <FlatList data={notices} keyExtractor={notice => String(notice.id)}
        contentContainerClassName="gap-3 px-5 py-4"
        onRefresh={() => load(0)} refreshing={loading && page === 0}
        ListHeaderComponent={<View className="gap-3"><Text className="text-2xl font-bold text-ink">{t('more.notifications.title')}</Text>{user?.role !== 'reporter' && <ShopNotices />}</View>}
        ListEmptyComponent={!loading && !error ? (
          <StateView variant="empty" title={t('more.notifications.emptyTitle')} />
        ) : null}
        renderItem={({ item }) => {
          const meta = noticeMeta(item.type);
          const params = { id: item.reportId ?? item.referenceId ?? '' };
          const interactive = item.reportId != null || !['report_edited', 'report_deleted'].includes(item.type);
          return (
            <Pressable
              disabled={!interactive}
              accessibilityRole="button"
              accessibilityLabel={`${t(meta.titleKey, params)}. ${t(meta.bodyKey, params)}`}
              onPress={() => openNotice(item)}
            >
              <Card className="flex-row items-start gap-3 active:opacity-80">
                <View
                  className="mt-0.5 h-9 w-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: meta.tint }}
                >
                  <meta.Icon color={meta.color} size={17} />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-start justify-between gap-2">
                    <Text className="flex-1 text-[13px] font-semibold leading-[1.4] text-ink">
                      {t(meta.titleKey, params)}
                    </Text>
                    <Text className="text-[10px] text-dashboard-caption">
                      {relativeTime(item.createdAt)}
                    </Text>
                  </View>
                  <Text className="mt-1 text-[11.5px] leading-[1.55] text-dashboard-subtitle">
                    {t(meta.bodyKey, params)}
                  </Text>
                  <Text className="mt-1.5 text-[10px] text-dashboard-caption">
                    {formatDate(item.createdAt, true)}
                  </Text>
                </View>
                {interactive ? (
                  <ChevronRight color={dashboardColors.statMintDeep} size={15} />
                ) : null}
              </Card>
            </Pressable>
          );
        }}
        ListFooterComponent={error ? (
          <StateView variant="error" description={error} actionLabel={t('more.notifications.retry')} onAction={() => load(0)} />
        ) : hasMore ? (
          <Button variant="secondary" label={t('more.notifications.loadMore')} loading={loading} onPress={() => load(page + 1)} />
        ) : null}
      />
    </Screen>
  );
}

function ShopNotices() {
  const { user } = useAuth();
  const { t } = useTranslation('common');
  const router = useRouter();
  const [notices, setNotices] = useState<ShopNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const version = useRef(0);
  const load = useCallback(async (next: number) => {
    const token = ++version.current;
    setLoading(true); setError(false);
    try {
      const result = await listShopNotifications(next);
      if (token !== version.current) return;
      setNotices(current => next === 0 ? result.content : [...current, ...result.content.filter(item => !current.some(old => old.id === item.id))]);
      if (user?.id != null) void markNoticesSeen(user.id, 'shop', result.content);
      setPage(next); setHasMore(result.hasMore);
    } catch {
      if (token === version.current) { setNotices([]); setHasMore(false); setError(true); }
    } finally { if (token === version.current) setLoading(false); }
  }, [user?.id]);
  useFocusEffect(useCallback(() => {
    setNotices([]); setHasMore(false); setPage(0); void load(0);
    return () => { version.current++; };
  }, [load]));
  return <View className="gap-3">
    <Text className="text-lg font-semibold text-ink">{t('shopNotices.title')}</Text>
    {notices.map(item => <Pressable key={item.id} accessibilityRole="button" className="min-h-[44px]" onPress={() => item.type === 'order_placed' ? router.push({ pathname: '/more/shop-orders', params: { orderId: item.orderId } }) : router.push(`/more/shop/${encodeURIComponent(item.orderId)}`)}>
      <Card><Text className="text-sm font-semibold text-ink">{t(item.type === 'order_placed' ? 'shopNotices.placed' : 'shopNotices.shipped', { id: item.orderId })}</Text>
      <Text className="mt-1 text-xs text-ink">{formatDate(item.createdAt, true)}</Text></Card>
    </Pressable>)}
    {loading && <StateView variant="loading" title={t('shopNotices.loading')} />}
    {!loading && !error && notices.length === 0 && <Text className="text-ink">{t('shopNotices.empty')}</Text>}
    {error && <><Text className="text-ink">{t('shopNotices.error')}</Text><Button variant="secondary" label={t('more.notifications.retry')} onPress={() => void load(0)} /></>}
    {hasMore && <Button variant="secondary" label={t('more.notifications.loadMore')} loading={loading} onPress={() => void load(page + 1)} />}
    <Text className="text-lg font-semibold text-ink">{t('shopNotices.reports')}</Text>
  </View>;
}
