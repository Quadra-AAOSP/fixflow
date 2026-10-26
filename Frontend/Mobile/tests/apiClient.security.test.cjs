const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

function load(file, imports, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, require: (name) => imports[name], process: { env: {} },
    __DEV__: true, console, AbortController, setTimeout, clearTimeout, ...globals });
  return exports;
}

test('explicit HTTPS URL never adds HTTP fallback candidates', () => {
  const config = load('constants/config.ts', {
    'react-native': { Platform: { OS: 'android' } }, 'expo-constants': { default: {} },
  }, { process: { env: { EXPO_PUBLIC_API_URL: 'https://api.example.com' } } });
  assert.deepEqual(Array.from(config.API_BASE_URL_CANDIDATES), ['https://api.example.com']);
});

test('development discovery omits credentials and a failed login is never replayed', async () => {
  const calls = [];
  const config = { API_BASE_URL: 'http://lan:8080',
    API_BASE_URL_CANDIDATES: ['http://lan:8080', 'http://10.0.2.2:8080'] };
  const client = load('lib/apiClient.ts', { '@/constants/config': config }, {
    fetch: async (url, init) => {
      calls.push({ url, init });
      if (url === 'http://lan:8080/api/auth/policy') throw Error('unreachable');
      if (url.endsWith('/api/auth/policy')) return { ok: true };
      if (url.endsWith('/api/auth/csrf')) return { ok: true, json: async () => ({ headerName: 'X-CSRF-TOKEN', token: 'test-token' }) };
      throw Error('timeout after server received login');
    },
  });
  await assert.rejects(client.api.post('/api/auth/login', { password: 'secret' }));
  assert.equal(calls.length, 4);
  for (const call of calls.slice(0, 2)) {
    assert.equal(call.init.credentials, 'omit');
    assert.equal(call.init.body, undefined);
  }
  assert.equal(calls[2].init.credentials, 'include');
  assert.equal(calls[2].url, 'http://10.0.2.2:8080/api/auth/csrf');
  assert.equal(calls[3].url, 'http://10.0.2.2:8080/api/auth/login');
  assert.equal(calls[3].init.headers['X-CSRF-TOKEN'], 'test-token');
  await assert.rejects(client.api.post('/api/auth/login', { password: 'secret' }));
  assert.equal(calls.length, 6);
  assert.equal(calls[5].url, calls[3].url);
});

test('release requires an explicit URL and does not infer development hosts', () => {
  const imports = { 'react-native': { Platform: { OS: 'android' } },
    'expo-constants': { default: {} } };
  assert.throws(() => load('constants/config.ts', imports, { __DEV__: false }),
    /EXPO_PUBLIC_API_URL is required/);
  const config = load('constants/config.ts', imports, { __DEV__: false,
    process: { env: { EXPO_PUBLIC_API_URL: 'https://api.example.com' } } });
  assert.equal(config.API_BASE_URL_CANDIDATES.length, 1);
});

test('unreachable explicit HTTPS server receives one attempt without downgrade', async () => {
  const calls = [];
  const client = load('lib/apiClient.ts', { '@/constants/config': {
    API_BASE_URL: 'https://api.example.com',
    API_BASE_URL_CANDIDATES: ['https://api.example.com'],
  } }, { fetch: async (url) => { calls.push(url); throw Error('unreachable'); } });
  await assert.rejects(client.api.post('/api/auth/register', { password: 'secret' }));
  assert.deepEqual(calls, ['https://api.example.com/api/auth/csrf']);
});

test('token rotation is respected and multipart bodies survive without a JSON content type', async () => {
  const calls = [];
  let token = 0;
  class TestFormData {}
  const client = load('lib/apiClient.ts', { '@/constants/config': {
    API_BASE_URL: 'https://api.example.com', API_BASE_URL_CANDIDATES: ['https://api.example.com'],
  } }, { FormData: TestFormData, fetch: async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, json: async () => url.endsWith('/csrf')
      ? { headerName: 'X-CSRF-TOKEN', token: `token-${++token}` } : { id: 1 } };
  } });
  await client.api.post('/api/auth/login', { password: 'secret' });
  const form = new TestFormData();
  await client.api.post('/api/reports/1/photos', undefined, { body: form });
  assert.equal(calls[1].init.headers['X-CSRF-TOKEN'], 'token-1');
  assert.equal(calls[3].init.headers['X-CSRF-TOKEN'], 'token-2');
  assert.equal(calls[3].init.headers['Content-Type'], undefined);
  assert.equal(calls[3].init.body, form);
  assert.equal(calls[2].init.credentials, 'include');
});

test('CSRF rejection does not retry the write or switch API origins', async () => {
  const calls = [];
  const client = load('lib/apiClient.ts', { '@/constants/config': {
    API_BASE_URL: 'https://api.example.com', API_BASE_URL_CANDIDATES: ['https://api.example.com'],
  } }, { fetch: async (url, init) => {
    calls.push({ url, init });
    return url.endsWith('/csrf')
      ? { ok: true, json: async () => ({ headerName: 'X-CSRF-TOKEN', token: 'token' }) }
      : { ok: false, status: 403, json: async () => ({ message: 'CSRF token invalid' }) };
  } });
  await assert.rejects(client.api.post('/api/reports', { description: 'sample' }), error => error.status === 403);
  assert.equal(calls.length, 2);
});
