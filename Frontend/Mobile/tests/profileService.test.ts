import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/apiClient', () => ({
  api: { put: vi.fn(), post: vi.fn(), del: vi.fn() },
}));

import { api } from '@/lib/apiClient';
import {
  deleteMyProfilePhoto,
  updateMyProfile,
  uploadMyProfilePhoto,
} from '../services/auth';

class MockFormData {
  fields: Array<[string, unknown]> = [];
  append(name: string, value: unknown) {
    this.fields.push([name, value]);
  }
}

describe('profile service', () => {
  beforeEach(() => {
    vi.stubGlobal('FormData', MockFormData);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('updates profile fields through the authenticated self endpoint', async () => {
    const updated = { id: 8, firstName: 'Alex', lastName: 'Ng' };
    const put = vi.spyOn(api, 'put').mockResolvedValue(updated as never);

    await expect(updateMyProfile({
      firstName: 'Alex',
      lastName: 'Ng',
      phone: null,
      address: '1 Test Street',
    })).resolves.toBe(updated);

    expect(put).toHaveBeenCalledWith('/api/auth/me', {
      firstName: 'Alex',
      lastName: 'Ng',
      phone: null,
      address: '1 Test Street',
    });
  });

  it('uploads the selected avatar as a multipart file without a public URL', async () => {
    const updated = { id: 8, profilePhotoPath: '/api/auth/me/photo' };
    const post = vi.spyOn(api, 'post').mockResolvedValue(updated as never);

    await expect(uploadMyProfilePhoto({
      uri: 'file:///avatar.png',
      fileName: 'avatar.png',
      mimeType: 'image/png',
    })).resolves.toBe(updated);

    const [path, body, options] = post.mock.calls[0]!;
    expect(path).toBe('/api/auth/me/photo');
    expect(body).toBeUndefined();
    expect(options?.body).toBeInstanceOf(MockFormData);
    expect((options?.body as unknown as MockFormData).fields).toEqual([
      ['file', { uri: 'file:///avatar.png', name: 'avatar.png', type: 'image/png' }],
    ]);
  });

  it('removes only the current user profile photo', async () => {
    const del = vi.spyOn(api, 'del').mockResolvedValue(undefined as never);
    await deleteMyProfilePhoto();
    expect(del).toHaveBeenCalledWith('/api/auth/me/photo');
  });
});
