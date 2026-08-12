import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWebhookUrl, createConnectionTestPayload, hasWebhookPermission, normalizeWebhookId, permissionForWebhook, requestWebhookPermission, sendPayloadToHomeAssistant } from '../src/services/ha-client.js';

test('normalizes webhook IDs and builds Home Assistant URLs', () => {
  assert.equal(normalizeWebhookId(' https://ha.example/api/webhook/abc/ '), 'abc');
  assert.equal(normalizeWebhookId('/abc/'), 'abc');
  assert.equal(normalizeWebhookId(''), '');
  assert.equal(buildWebhookUrl({ baseUrl: 'https://ha.example/', webhook: 'abc' }), 'https://ha.example/api/webhook/abc');
  assert.equal(buildWebhookUrl({ baseUrl: 'https://ha.example', webhook: 'https://other.example/hook' }), 'https://ha.example/api/webhook/hook');
  assert.equal(permissionForWebhook({ baseUrl: 'https://ha.example', webhook: 'abc' }), 'https://ha.example/*');
});

test('rejects incomplete Home Assistant configuration', () => {
  assert.throws(() => buildWebhookUrl({ baseUrl: '', webhook: '' }), /Webhook is not configured/);
  assert.throws(() => buildWebhookUrl({ baseUrl: '', webhook: 'abc' }), /Home Assistant URL is not configured/);
});

test('uses Chrome permissions and sends payloads to Home Assistant', async () => {
  const originalChrome = globalThis.chrome;
  globalThis.chrome = {
    runtime: { lastError: null },
    permissions: {
      contains: (_permissions, callback) => callback(true),
      request: (_permissions, callback) => callback(true),
    },
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 200 });
  try {
    const config = { baseUrl: 'https://ha.example', webhook: 'abc' };
    assert.equal(await hasWebhookPermission(config), true);
    assert.equal(await requestWebhookPermission(config), 'https://ha.example/*');
    const result = await sendPayloadToHomeAssistant(config, { hello: 'world' });
    assert.equal(result.ok, true);
    assert.equal(result.status, 'ok');
    assert.equal(result.httpStatus, 200);
  } finally {
    globalThis.chrome = originalChrome;
    globalThis.fetch = originalFetch;
  }
});

test('handles missing permissions, accepted errors, HTTP errors, and network failures', async () => {
  const originalChrome = globalThis.chrome;
  const originalFetch = globalThis.fetch;
  globalThis.chrome = {
    runtime: { lastError: null },
    permissions: { contains: (_value, callback) => callback(false) },
  };
  try {
    const config = { baseUrl: 'https://ha.example', webhook: 'abc' };
    assert.equal((await sendPayloadToHomeAssistant(config, {})).error.code, 'missing_ha_permission');

    globalThis.chrome.permissions.contains = (_value, callback) => callback(true);
    globalThis.fetch = async () => new Response('', { status: 400 });
    assert.equal((await sendPayloadToHomeAssistant(config, {}, { acceptedErrorStatuses: [400] })).ok, true);
    globalThis.fetch = async () => new Response('', { status: 500 });
    assert.equal((await sendPayloadToHomeAssistant(config, {})).error.code, 'ha_http_500');
    globalThis.fetch = async () => { throw new Error('offline'); };
    assert.equal((await sendPayloadToHomeAssistant(config, {})).error.code, 'ha_request_failed');
    assert.equal(createConnectionTestPayload('2026.8.0').collector_data.version, '2026.8.0');
  } finally {
    globalThis.chrome = originalChrome;
    globalThis.fetch = originalFetch;
  }
});
