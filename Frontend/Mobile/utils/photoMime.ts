export function extFromUri(uri: string): string {
  const match = uri.split('?')[0].match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : 'jpg';
}

/**
 * Resolve an allowlisted image mime for upload. Returns null for
 * unsupported types so callers can reject instead of coercing to JPEG.
 */
export function mimeForUri(uri: string, fallback?: string): string | null {
  const candidate = (fallback ?? '').toLowerCase();
  if (
    candidate === 'image/png' ||
    candidate === 'image/jpeg' ||
    candidate === 'image/jpg' ||
    candidate === 'image/webp'
  ) {
    return candidate === 'image/jpg' ? 'image/jpeg' : candidate;
  }
  const ext = extFromUri(uri);
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  return null;
}
