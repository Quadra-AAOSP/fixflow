import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Check, Camera } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Action, Field } from '@/components/ReviewControls';
import { ReportWorkProgress, reportWorkTracked } from '@/components/reports/ReportWorkProgress';
import { themeColors } from '@/constants/theme';
import { toErrorMessage } from '@/lib/apiClient';
import {
  escalateReportWork, listReportRatings, listResolutions, rateReportWork, resolveReportWork, startReportWork,
  uploadReportPhoto,
  type ReportResolution, type ReportRating,
} from '@/services/reports';
import type { Report } from '@/types';

type Props = {
  report: Report;
  isAssignedTechnician: boolean;
  canRate: boolean;
  isOperator: boolean;
  canReadWork: boolean;
  currentUserId: number | undefined;
  onReportChanged: (report: Report) => void;
};

export function ReportWorkActions({ report, isAssignedTechnician, canRate, isOperator, canReadWork, currentUserId, onReportChanged }: Props) {
  const { t } = useTranslation('common');
  const palette = themeColors();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('');
  // Completion evidence: the technician attaches a photo of the finished
  // work before resolving; the site admin sees it alongside the resolution
  // description when confirming the report.
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [resolutions, setResolutions] = useState<ReportResolution[]>([]);
  const [selected, setSelected] = useState<number>();
  const [ratings, setRatings] = useState<ReportRating[]>([]);
  const canStart = isAssignedTechnician && ['assigned', 'reopened', 'escalated'].includes(report.status);
  const canResolve = isAssignedTechnician && report.status === 'in_progress';
  const canEscalate = (isAssignedTechnician || (isOperator && report.assignedTechnicianId != null)) && ['assigned', 'reopened', 'in_progress'].includes(report.status);
  const canReadResolution = canReadWork && ['resolved_pending_confirmation', 'confirmed'].includes(report.status);

  useEffect(() => {
    setResolutions([]);
    setRatings([]);
    setSelected(undefined);
    if (!canReadResolution) return;
    let active = true;
    Promise.all([listResolutions(report.id), listReportRatings(report.id)]).then(([items, ratings]) => {
      if (active) {
        setResolutions(items);
        setSelected(items[items.length - 1]?.id);
        setRatings(ratings);
      }
    }).catch(err => {
      if (active) setError(toErrorMessage(err, { fallback: t('marketplace.error') }));
    });
    return () => { active = false; };
  }, [canRate, canReadResolution, currentUserId, report.id, report.status, t]);

  async function run(operation: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await operation();
    } catch (err) {
      setError(toErrorMessage(err, { fallback: t('marketplace.error') }));
    } finally {
      setBusy(false);
    }
  }

  async function attachPhoto() {
    if (photoUploading) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
    });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    setPhotoUploading(true);
    setError('');
    try {
      await uploadReportPhoto(report.id, {
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: asset.mimeType ?? 'image/jpeg',
      });
      setPhotoCount(count => count + 1);
    } catch (err) {
      setError(toErrorMessage(err, { fallback: t('marketplace.error') }));
    } finally {
      setPhotoUploading(false);
    }
  }

  // The tracker is status-only information (already visible on the page), so
  // the card renders for tracked statuses even when this viewer has no
  // actions — technician, site admin, and reporter all see the same pipeline.
  const showProgress = reportWorkTracked(report.status);
  if (!showProgress && !canStart && !canResolve && !canEscalate && !canReadResolution) return null;

  return (
    <View className="mb-4 rounded-xl border border-dashboard-card-line bg-dashboard-card-bg p-4">
      <Text className="mb-2 font-bold text-ink">{t('marketplace.work.title')}</Text>
      {showProgress ? <ReportWorkProgress status={report.status} /> : null}
      {error ? <Text accessibilityRole="alert" className="mb-2 text-red-700">{error}</Text> : null}
      {canStart ? <Action label={t('marketplace.work.start')} disabled={busy}
        onPress={() => void run(async () => onReportChanged(await startReportWork(report.id)))} /> : null}
      {canResolve ? <View className="my-2">
        <Field label={t('marketplace.work.resolution')} value={description} onChangeText={setDescription} maxLength={10000} multiline />
        {/* Completion photo — uploaded straight to the report so the site
            admin can visually confirm the fix when reviewing the resolution. */}
        <Pressable
          accessibilityRole="button"
          disabled={photoUploading || photoCount >= 5}
          onPress={() => void attachPhoto()}
          className="mb-2 flex-row items-center gap-2 self-start rounded-lg border border-dashboard-card-line px-3 py-2 active:opacity-70"
        >
          <Camera color={palette.accentForeground} size={16} />
          <Text className="text-xs font-medium text-ink">
            {photoUploading
              ? t('marketplace.work.photoUploading')
              : photoCount >= 5
                ? t('marketplace.work.photoLimit')
                : t('marketplace.work.attachPhoto')}
          </Text>
          {photoCount > 0 && !photoUploading ? (
            <View className="flex-row items-center gap-1">
              <Check color={palette.tone.success} size={14} />
              <Text className="text-xs text-ink">{photoCount}</Text>
            </View>
          ) : null}
        </Pressable>
        {photoCount > 0 ? (
          <Text className="mb-2 text-[11px] leading-[1.6] text-muted">
            {t('marketplace.work.photoHint')}
          </Text>
        ) : null}
        <Action label={t('marketplace.work.resolve')} disabled={busy || !description.trim()}
          onPress={() => void run(async () => {
            onReportChanged(await resolveReportWork(report.id, description.trim()));
            setDescription('');
          })} />
      </View> : null}
      {canEscalate ? <View className="my-2">
        <Field label={t('marketplace.work.escalationReason')} value={reason} onChangeText={setReason} maxLength={2000} multiline />
        <Action label={t('marketplace.work.escalate')} disabled={busy || !reason.trim()}
          onPress={() => void run(async () => {
            onReportChanged(await escalateReportWork(report.id, reason.trim()));
            setReason('');
          })} />
      </View> : null}
      {canReadResolution ? resolutions.map(resolution => (
        <View key={resolution.id} className="my-2">
          <Text className="font-semibold text-ink">{t('marketplace.work.resolutionDate', {
            date: new Date(resolution.createdAt).toLocaleString(),
          })}</Text>
          <Text className="text-ink">{resolution.description}</Text>
          {ratings.filter(rating => rating.resolutionId === resolution.id).map(rating => (
            <Text key={rating.id} className="text-ink">{rating.score}/5{rating.feedback ? ` · ${rating.feedback}` : ''}</Text>
          ))}
          {canRate && resolutions.length > 1 ? <Action label={t(
            selected === resolution.id ? 'marketplace.work.selected' : 'marketplace.work.choose',
          )} disabled={busy || selected === resolution.id} onPress={() => setSelected(resolution.id)} /> : null}
        </View>
      )) : null}
      {canRate && selected !== undefined && resolutions.find(item => item.id === selected)?.technicianId !== currentUserId ? ratings.some(rating => rating.ratedByCurrentUser && rating.resolutionId === selected)
        ? <Text accessibilityLiveRegion="polite">{t('marketplace.work.rated')}</Text>
        : <View className="my-2">
          <Field label={t('marketplace.work.score')} value={score} maxLength={1} onChangeText={setScore} />
          <Field label={t('marketplace.work.feedback')} value={feedback} maxLength={2000} onChangeText={setFeedback} multiline />
          <Action label={t('marketplace.work.rate')} disabled={busy || !/^[1-5]$/.test(score)}
            onPress={() => void run(async () => {
              const rating = await rateReportWork(report.id, selected, Number(score), feedback.trim());
              setRatings(items => [...items, rating]);
              setScore('');
              setFeedback('');
            })} />
        </View> : null}
    </View>
  );
}
