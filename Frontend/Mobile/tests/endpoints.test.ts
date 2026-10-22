import { describe, expect, it } from 'vitest';

import { endpoints } from '../lib/endpoints';

type Leaf = { key: string; path: string };

function flatten(node: unknown, prefix: string, out: Leaf[]): Leaf[] {
  if (typeof node === 'string') {
    out.push({ key: prefix, path: node });
    return out;
  }
  if (typeof node === 'function') {
    const fn = node as (...args: unknown[]) => string;
    out.push({ key: prefix, path: fn('1', 'approve') });
    return out;
  }
  if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      flatten(value, prefix ? `${prefix}.${key}` : key, out);
    }
  }
  return out;
}

const leaves = flatten(endpoints, '', []);

/** Removes path-template placeholders and collapses slash runs. */
function normalize(path: string): string {
  return path.replace(/\{[^}]*\}/g, '').replace(/\/+/g, '/');
}

describe('endpoint registry', () => {
  it('contains only absolute paths', () => {
    expect(leaves.length).toBeGreaterThan(0);
    for (const leaf of leaves) {
      expect(leaf.path.startsWith('/'), leaf.key).toBe(true);
    }
  });

  it('has no unexpected duplicate paths', () => {
    const byPath = new Map<string, string[]>();
    for (const leaf of leaves) {
      const keys = byPath.get(leaf.path) ?? [];
      keys.push(leaf.key);
      byPath.set(leaf.path, keys);
    }

    // These paths are intentionally shared by different HTTP methods on the
    // same resource (list/upload, delete/get-url, and list/create).
    const expected: Record<string, string[]> = {
      '/api/reports/{id}/photos': ['reports.photos.list', 'reports.photos.upload'],
      '/api/reports/{id}/photos/{photoId}': [
        'reports.photos.delete',
        'reports.photos.getUrl',
      ],
      '/api/technician-contract-requests': [
        'contractRequests.create',
        'contractRequests.list',
      ],
    };

    const duplicates = [...byPath.entries()]
      .filter(([, keys]) => keys.length > 1)
      .map(([path, keys]) => [path, [...keys].sort()] as const)
      .sort(([a], [b]) => a.localeCompare(b));

    expect(duplicates).toEqual(
      Object.entries(expected).sort(([a], [b]) => a.localeCompare(b)),
    );
  });

  it('does not expose endpoints the backend does not implement', () => {
    const livePaths = new Set(leaves.map((leaf) => normalize(leaf.path)));

    // The banned block in lib/endpoints.ts also lists GET
    // /api/technician-skills and GET /api/technician-contracts. Those paths are
    // legitimately live as POST create endpoints, so they are asserted below
    // rather than treated as absent.
    const banned = [
      '/api/reports/{id}/status',
      '/api/reports/{id}/urgency',
      '/api/reports/{id}/reassign',
      '/api/technicians/me/availability',
      '/api/reports/assigned-to-me',
      '/api/reports/claimable',
    ];

    for (const path of banned) {
      expect(livePaths.has(normalize(path)), path).toBe(false);
    }

    expect(endpoints.technicianSkills.create).toBe('/api/technician-skills');
    expect(endpoints.technicianContracts.create).toBe('/api/technician-contracts');
  });

  it('keeps the Phase 4–5 report lifecycle endpoints wired', () => {
    expect(endpoints.reports.confirm).toBe('/api/reports/{id}/confirm');
    expect(endpoints.reports.reopen).toBe('/api/reports/{id}/reopen');
    expect(endpoints.reports.photos.list).toBe('/api/reports/{id}/photos');
    expect(endpoints.reports.photos.upload).toBe('/api/reports/{id}/photos');
    expect(endpoints.reports.photos.delete).toBe('/api/reports/{id}/photos/{photoId}');
    expect(endpoints.reports.photos.getUrl).toBe('/api/reports/{id}/photos/{photoId}');
  });
});
