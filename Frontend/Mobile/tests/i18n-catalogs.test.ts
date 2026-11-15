import fs from 'fs';
import { fileURLToPath } from 'url';

import { describe, expect, it } from 'vitest';

const EN_PATH = fileURLToPath(
  new URL('../constants/resources/en/common.json', import.meta.url),
);
const ZH_PATH = fileURLToPath(
  new URL('../constants/resources/zh/common.json', import.meta.url),
);

type Catalog = Record<string, unknown>;

function readCatalog(path: string): Catalog {
  return JSON.parse(fs.readFileSync(path, 'utf8')) as Catalog;
}

function flatten(node: Catalog, prefix = '', out: Record<string, string> = {}) {
  for (const [key, value] of Object.entries(node)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object') {
      flatten(value as Catalog, fullKey, out);
    } else {
      out[fullKey] = String(value);
    }
  }
  return out;
}

function placeholders(value: string): Set<string> {
  return new Set(
    [...value.matchAll(/\{(\w+)\}/g)]
      .map((match) => match[1])
      // `{plural}` is an English-only plural suffix marker, not a variable.
      .filter((name) => name !== 'plural'),
  );
}

const en = flatten(readCatalog(EN_PATH));
const zh = flatten(readCatalog(ZH_PATH));
const enKeys = new Set(Object.keys(en));
const zhKeys = new Set(Object.keys(zh));

describe('i18n catalogs', () => {
  it('has the same key set in both catalogs', () => {
    const missingInZh = [...enKeys].filter((key) => !zhKeys.has(key)).sort();
    const missingInEn = [...zhKeys].filter((key) => !enKeys.has(key)).sort();

    expect(missingInZh, `keys missing from zh: ${missingInZh.join(', ')}`).toEqual([]);
    expect(missingInEn, `keys missing from en: ${missingInEn.join(', ')}`).toEqual([]);
  });

  it('has no empty or whitespace-only values', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value.trim(), `en.${key}`).not.toBe('');
    }
    for (const [key, value] of Object.entries(zh)) {
      expect(value.trim(), `zh.${key}`).not.toBe('');
    }
  });

  it('does not use i18next double-brace placeholders', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value, `en.${key}`).not.toMatch(/\{\{.*?\}\}/);
    }
    for (const [key, value] of Object.entries(zh)) {
      expect(value, `zh.${key}`).not.toMatch(/\{\{.*?\}\}/);
    }
  });

  it('keeps every en placeholder in the matching zh value', () => {
    const mismatches: string[] = [];
    for (const key of enKeys) {
      const enVars = placeholders(en[key]);
      const zhVars = placeholders(zh[key] ?? '');
      const missing = [...enVars].filter((name) => !zhVars.has(name));
      if (missing.length > 0) {
        mismatches.push(`${key}: missing ${missing.join(', ')}`);
      }
    }
    expect(mismatches, mismatches.join('; ')).toEqual([]);
  });

  it('has more than 900 flattened keys', () => {
    expect(enKeys.size).toBeGreaterThan(900);
    expect(zhKeys.size).toBeGreaterThan(900);
  });

  it('labels site category and contracted job-offer copy', () => {
    expect(en['more.menu.siteRulesTitle']).toBe('Site category');
    expect(zh['more.menu.siteRulesTitle']).toBe('场地类别');
    expect(en['reports.new.photos.unsupportedType']).toContain('WebP');
    expect(en['reports.detail.definition.agreedAmount']).toBeTruthy();
    expect(en['marketplace.listingPay']).toContain('{amount}');
    expect(en['marketplace.proposedPay']).toContain('{amount}');
    expect(en['jobOffers.title']).toBeTruthy();
  });
});


