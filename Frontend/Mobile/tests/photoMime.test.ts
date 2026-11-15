import { describe, expect, it } from 'vitest';

import { mimeForUri } from '../utils/photoMime';

describe('mimeForUri', () => {
  it('allows jpeg, png, and webp from mime or extension', () => {
    expect(mimeForUri('file:///a.webp', 'image/webp')).toBe('image/webp');
    expect(mimeForUri('file:///a.png')).toBe('image/png');
    expect(mimeForUri('file:///a.jpg', 'image/jpg')).toBe('image/jpeg');
  });

  it('rejects unsupported types instead of coercing to jpeg', () => {
    expect(mimeForUri('file:///a.gif', 'image/gif')).toBeNull();
    expect(mimeForUri('file:///a.heic')).toBeNull();
    expect(mimeForUri('file:///a.bmp', 'image/bmp')).toBeNull();
  });
});
