import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

type InfoRowProps = {
  label: string;
  /**
   * `null` / `undefined` / empty render the shared "Not available" text —
   * which is the honest state for the server-masked report fields.
   */
  value?: string | number | null;
  /** Renders a node instead of text (badges, chips). Wins over `value`. */
  children?: React.ReactNode;
  className?: string;
};

/** Label-above-value pair used by detail screens and profile cards. */
export function InfoRow({
  label,
  value,
  children,
  className,
}: InfoRowProps) {
  const { t } = useTranslation('common');
  const hasValue =
    children !== undefined &&
    children !== null &&
    value !== null &&
    value !== undefined &&
    String(value).trim() !== '';

  return (
    <View className={`mb-3 ${className ?? ''}`}>
      <Text className="text-xs uppercase tracking-wide text-muted">
        {label}
      </Text>
      {children ? (
        <View className="mt-1">{children}</View>
      ) : hasValue ? (
        <Text className="mt-0.5 text-sm text-ink">{String(value)}</Text>
      ) : (
        <Text className="mt-0.5 text-sm text-muted">
          {t('components.infoRow.notAvailable')}
        </Text>
      )}
    </View>
  );
}
