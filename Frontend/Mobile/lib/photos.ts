import * as ImagePicker from 'expo-image-picker';

/**
 * Photo limits, taken from the backend DDL — not chosen by the UI.
 *
 * Source of truth: `Backend/src/main/resources/db/schema.sql` → `report_photos`
 *   CONSTRAINT chk_report_photos_sort  CHECK (sort_order <= 4)
 *   CONSTRAINT chk_report_photos_size  CHECK (file_size_bytes > 0
 *                                             AND file_size_bytes <= 5242880)
 *
 * Do not relax these here; they mirror what the server will reject.
 */
export const MAX_PHOTOS = 5;
export const MAX_PHOTO_BYTES = 5242880;

/** A picked image identified by its local URI. */
export type PhotoAsset = {
  uri: string;
  width: number;
  height: number;
  fileName?: string;
  mimeType?: string;
  /** Absent where the platform does not report it (notably web). */
  fileSize?: number;
};

/**
 * Transfer lifecycle for a selected photo.
 *
 * Nothing here talks to the network. The backend exposes no photo endpoint at
 * all (there is no `POST /api/reports/{id}/photos`), so every photo stays
 * `pending`. Phase 8 replaces that default with a real upload; because the UI
 * only reads this shape, it will not need to change.
 */
export type PhotoUploadState =
  | { status: 'pending' }
  | { status: 'uploading'; progress: number }
  | { status: 'uploaded'; photoId: number; url: string | null }
  | { status: 'failed'; message: string };

export type SelectedPhoto = {
  /** Local-only list identity. Never sent to the backend. */
  id: string;
  asset: PhotoAsset;
  upload: PhotoUploadState;
};

/** Outcome of one selection attempt. */
export type PhotoSelection =
  | { status: 'selected'; asset: PhotoAsset }
  | { status: 'cancelled' }
  | { status: 'permission-denied'; canAskAgain: boolean }
  | { status: 'failed'; reason: string };

let photoSequence = 0;

export function createSelectedPhoto(asset: PhotoAsset): SelectedPhoto {
  photoSequence += 1;
  return {
    id: `local-photo-${Date.now()}-${photoSequence}`,
    asset,
    upload: { status: 'pending' },
  };
}

/**
 * Returns a user-facing message when the asset cannot satisfy the backend
 * `report_photos` constraints, otherwise `null`.
 *
 * `fileSize` is optional, so an asset with unknown size passes validation here
 * and must be re-checked by the Phase 8 upload implementation.
 */
export function validatePhoto(asset: PhotoAsset): string | null {
  if (asset.fileSize === undefined) return null;
  if (asset.fileSize <= 0) return 'That image appears to be empty.';
  if (asset.fileSize > MAX_PHOTO_BYTES) {
    return `Images must be ${MAX_PHOTO_BYTES / (1024 * 1024)} MB or smaller.`;
  }
  return null;
}

/**
 * Requests media-library permission and opens the system picker.
 *
 * This is the only module that imports `expo-image-picker`, so the selection
 * mechanism can be swapped — or stubbed in tests — without touching any UI.
 * Upload is out of scope by design; see `PhotoUploadState`.
 */
export async function selectPhoto(): Promise<PhotoSelection> {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return {
        status: 'permission-denied',
        canAskAgain: permission.canAskAgain,
      };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.8,
    });

    // `canceled` is discriminated on the result: when true, `assets` is null.
    if (result.canceled) return { status: 'cancelled' };

    const asset = result.assets[0];
    if (!asset) return { status: 'cancelled' };

    return {
      status: 'selected',
      asset: {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        fileName: asset.fileName ?? undefined,
        mimeType: asset.mimeType,
        fileSize: asset.fileSize,
      },
    };
  } catch (error) {
    return {
      status: 'failed',
      reason: error instanceof Error ? error.message : 'Unknown picker error',
    };
  }
}
