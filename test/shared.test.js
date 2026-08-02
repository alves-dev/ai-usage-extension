import test from 'node:test';
import assert from 'node:assert/strict';
import { collectFromJsonEndpoints, looksLikeLoginPage, mapProbeResult, unauthenticated } from '../src/providers/shared.js';

test('handles probe and authentication helper results', () => {
  assert.deepEqual(mapProbeResult(null), {
    status: 'provider_unavailable',
    error: { code: 'page_probe_empty', message: 'Page probe returned no data' },
  });
  assert.deepEqual(mapProbeResult({ status: 'not_authenticated' }, 'page_probe'), { status: 'not_authenticated' });
  assert.deepEqual(mapProbeResult({ status: 'ok', account: { email: 'a@b.com' }, usage: { used: 1 } }, 'page_probe'), {
    status: 'ok', account: { email: 'a@b.com' }, usage: { used: 1 }, collectionMethod: 'page_probe',
  });
  assert.equal(looksLikeLoginPage('Please sign in'), true);
  assert.equal(looksLikeLoginPage('usage: 20 tokens'), false);
  assert.deepEqual(unauthenticated(), { status: 'not_authenticated', error: { code: 'not_authenticated', message: 'User is not logged in' } });
});

test('collects JSON usage from successful and fallback endpoints', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (endpoint) => ({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => ({ usage: { used: 2, limit: 10 }, account: { email: 'a@b.com' } }),
    text: async () => '',
    endpoint,
  });
  try {
    const result = await collectFromJsonEndpoints(['https://example.test/usage']);
    assert.equal(result.status, 'ok');
    assert.equal(result.usage.remaining, 8);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('returns a combined unavailable error when all endpoints fail', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('network down'); };
  try {
    const result = await collectFromJsonEndpoints(['https://one.test', 'https://two.test']);
    assert.equal(result.status, 'provider_unavailable');
    assert.match(result.error.message, /network down/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('classifies authentication, rate limiting, non-JSON, and parse failures', async () => {
  const originalFetch = globalThis.fetch;
  const responses = [
    new Response('', { status: 401 }),
    new Response('', { status: 429 }),
    new Response('Please login', { status: 200, headers: { 'content-type': 'text/html' } }),
    new Response('not usage', { status: 200, headers: { 'content-type': 'text/html' } }),
    new Response(JSON.stringify({ unrelated: true }), { status: 200, headers: { 'content-type': 'application/json' } }),
  ];
  globalThis.fetch = async () => responses.shift();
  try {
    assert.equal((await collectFromJsonEndpoints(['https://401.test'])).status, 'not_authenticated');
    assert.equal((await collectFromJsonEndpoints(['https://429.test'])).status, 'rate_limited');
    assert.equal((await collectFromJsonEndpoints(['https://login.test'])).status, 'not_authenticated');
    assert.equal((await collectFromJsonEndpoints(['https://html.test'])).status, 'provider_unavailable');
    assert.equal((await collectFromJsonEndpoints(['https://json.test'])).status, 'provider_unavailable');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
