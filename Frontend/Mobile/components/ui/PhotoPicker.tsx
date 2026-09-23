import { useState } from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';

import { ImagePlus, X } from 'lucide-react-native';

import { colors } from '@/constants/theme';
import {
  MAX_PHOTOS,
  createSelectedPhoto,
  selectPhoto,
  validatePhoto,
  type SelectedPhoto,
} from '@/lib/photos';

type PhotoPickerProps = {
  photos: SelectedPhoto[];
  onChange: (photos: SelectedPhoto[]) => void;
  /** Defaults to the backend limit (`report_photos.sort_order <= 4`). */
  max?: number;
  disabled?: boolean;
  className?: string;
};

/**
 * Photo *selection* UI — deliberately upload-agnostic.
 *
 * It returns local assets and renders nothing about transfer state, because the
 * backend has no photo endpoint yet. Connecting upload later means changing
 * `lib/photos.ts`, not this component.
 *
 * Covers the required states: nothing selected, verifying permission,
 * permission denied (with a route to Settings), picker open, selected with
 * preview, replace, remove, and a rejected selection that breaks the 5 MB
 * schema limit.
 */
export function PhotoPicker({
  photos,
  onChange,
  max = MAX_PHOTOS,
  disabled = false,
  className,
}: PhotoPickerProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [blockedBySettings, setBlockedBySettings] = useState(false);

  const remaining = Math.max(0, max - photos.length);
  const atLimit = remaining === 0;
  const addDisabled = disabled || busy || atLimit;

  async function handleAdd() {
    setMessage(null);
    setBlockedBySettings(false);
    setBusy(true);

    try {
      const result = await selectPhoto();

      switch (result.status) {
        case 'selected': {
          const problem = validatePhoto(result.asset);
          if (problem) {
            setMessage(problem);
            return;
          }
          onChange([...photos, createSelectedPhoto(result.asset)]);
          return;
        }
        case 'cancelled':
          return;
        case 'permission-denied':
          setMessage(
            result.canAskAgain
              ? 'Photo access is needed to attach an image.'
              : 'Photo access is off. Enable it in Settings to attach images.',
          );
          setBlockedBySettings(!result.canAskAgain);
          return;
        case 'failed':
          setMessage(`Could not open the photo library: ${result.reason}`);
          return;
      }
    } finally {
      setBusy(false);
    }
  }

  function handleRemove(id: string) {
    setMessage(null);
    onChange(photos.filter((photo) => photo.id !== id));
  }

  return (
    <View className={`mb-4 ${className ?? ''}`}>
      <Text className="mb-1.5 text-sm font-medium text-foreground">
        Photos
        {photos.length > 0 ? ` (${photos.length}/${max})` : ' (optional)'}
      </Text>

      <View className="flex-row flex-wrap gap-3">
        {photos.map((photo, index) => (
          <View key={photo.id} className="relative">
            <Image
              source={{ uri: photo.asset.uri }}
              className="h-24 w-24 rounded-lg border border-border bg-surface"
              resizeMode="cover"
              accessible
              accessibilityLabel={`Selected photo ${index + 1} of ${photos.length}`}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${index + 1}`}
              onPress={() => handleRemove(photo.id)}
              hitSlop={8}
              className="absolute -right-2 -top-2 h-7 w-7 items-center justify-center rounded-full bg-error"
            >
              <X color={colors.surface} size={16} />
            </Pressable>
          </View>
        ))}

        {!atLimit ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add photo"
            accessibilityHint={`Opens your photo library. ${remaining} more allowed.`}
            accessibilityState={{ disabled: addDisabled, busy }}
            disabled={addDisabled}
            onPress={() => {
              void handleAdd();
            }}
            className={`h-24 w-24 items-center justify-center rounded-lg border border-dashed border-border bg-surface active:opacity-80 ${
              addDisabled ? 'opacity-50' : ''
            }`}
          >
            <ImagePlus color={colors.mutedForeground} size={24} />
            <Text className="mt-1 text-xs text-muted-foreground">
              {busy ? 'Opening…' : 'Add'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {atLimit ? (
        <Text className="mt-2 text-xs text-muted-foreground">
          Maximum of {max} photos reached.
        </Text>
      ) : null}

      {message ? (
        <Text className="mt-2 text-xs text-error">{message}</Text>
      ) : null}

      {blockedBySettings ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open device settings"
          onPress={() => {
            void Linking.openSettings();
          }}
          className="mt-1 self-start py-1"
        >
          <Text className="text-xs font-semibold text-primary">
            Open Settings
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
