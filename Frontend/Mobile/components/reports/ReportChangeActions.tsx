import { useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { Picker } from '@/components/ui/Picker';
import { StateView } from '@/components/ui/StateView';
import { TextField } from '@/components/ui/TextField';
import { toErrorMessage } from '@/lib/apiClient';
import { deleteReport, updateReport, type ReportEdit } from '@/services/reports';
import type { Report, Urgency } from '@/types';
import { urgencyLabels } from '@/utils/maintenance';

export function ReportChangeActions({ report, onSaved, onDeleted }: {
  report: Report;
  onSaved: (report: Report) => void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation('common');
  const [edit, setEdit] = useState<ReportEdit | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!report.policy.canEdit && !report.policy.canDelete) return null;

  function close() {
    setEdit(null);
    setConfirming(false);
    setError('');
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (edit) {
        const saved = await updateReport(report.id, edit);
        close();
        onSaved(saved);
      } else if (confirming) {
        await deleteReport(report.id);
        close();
        onDeleted();
      }
    } catch (err) {
      setError(toErrorMessage(err, { fallback: t('reportChanges.saveError') }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="gap-2">
      {report.policy.canEdit ? (
        <Button variant="secondary" label={t('reportChanges.edit')} onPress={() => {
          const { description, address, reporterUrgency, reporterReason } = report;
          setEdit({ description, address, reporterUrgency, reporterReason });
        }} />
      ) : null}
      {report.policy.canDelete ? (
        <Button variant="secondary" label={t('reportChanges.delete')} onPress={() => setConfirming(true)} />
      ) : null}
      <ModalSheet visible={edit !== null || confirming} onClose={close} busy={busy}
        title={t(edit ? 'reportChanges.edit' : 'reportChanges.delete')}
        footer={<Button label={t(edit ? 'reportChanges.save' : 'reportChanges.confirmDelete')}
          loading={busy} disabled={edit !== null && !edit.description.trim()} onPress={save} />}>
        {error ? <StateView variant="error" description={error} /> : null}
        {edit ? (
          <View className="gap-3">
            <TextField label={t('reportChanges.description')} value={edit.description} maxLength={10000}
              editable={!busy} multiline onChangeText={description => setEdit({ ...edit, description })} />
            <TextField label={t('reportChanges.address')} value={edit.address ?? ''} maxLength={512}
              editable={!busy} onChangeText={address => setEdit({ ...edit, address })} />
            <Picker label={t('reportChanges.urgency')} value={edit.reporterUrgency}
              options={Object.entries(urgencyLabels).map(([value, label]) => ({ value, label: t(label) }))}
              disabled={busy} onChange={reporterUrgency => setEdit({ ...edit, reporterUrgency: reporterUrgency as Urgency })} />
            <TextField label={t('reportChanges.reason')} value={edit.reporterReason ?? ''} maxLength={2000}
              editable={!busy} multiline onChangeText={reporterReason => setEdit({ ...edit, reporterReason })} />
          </View>
        ) : <Text className="text-ink">{t('reportChanges.archiveExplanation')}</Text>}
      </ModalSheet>
    </View>
  );
}
