import test from 'node:test';
import assert from 'node:assert/strict';
import { collectCodex, normalizeCodexWindows } from '../src/providers/codex.js';

const shortWindow = {
  used_percent: 10,
  limit_window_seconds: 18000,
  reset_after_seconds: 12000,
  reset_at: 1780434415,
};

const longWindow = {
  used_percent: 59,
  limit_window_seconds: 604800,
  reset_after_seconds: 69577,
  reset_at: 1780310621,
};

test('classifies Codex windows by duration and applies configured labels', () => {
  assert.deepEqual(normalizeCodexWindows({
    limit_reached: false,
    primary_window: longWindow,
    secondary_window: shortWindow,
  }, { short: 'Short limit', long: 'Long limit' }).map(({ id, label, duration_seconds }) => ({ id, label, duration_seconds })), [
    { id: 'long', label: 'Long limit', duration_seconds: 604800 },
    { id: 'short', label: 'Short limit', duration_seconds: 18000 },
  ]);
});

test('omits unknown and missing Codex windows', () => {
  assert.equal(normalizeCodexWindows({
    primary_window: { used_percent: 99, limit_window_seconds: 3600 },
    secondary_window: null,
  }).length, 0);
});

test('collects Codex usage in Payload Contract 2.0 shape', async () => {
  const originalFetch = globalThis.fetch;
  let request = 0;
  globalThis.fetch = async () => {
    request += 1;
    if (request === 1) {
      return new Response(JSON.stringify({ accessToken: 'token' }), { status: 200 });
    }
    return new Response(JSON.stringify({
      account_id: 'acct-codex-123',
      email: 'user@example.com',
      plan_type: 'pro',
      rate_limit: { limit_reached: false, primary_window: shortWindow, secondary_window: longWindow },
    }), { status: 200 });
  };
  try {
    const result = await collectCodex({ windowLabels: { short: 'Five hours', long: 'Week' } }, {});
    assert.equal(result.status, 'ok');
    assert.equal(result.payload.account_data.id, 'acct-codex-123');
    assert.deepEqual(result.payload.usage_data.windows.map((window) => window.label), ['Five hours', 'Week']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('returns parse errors for incomplete Codex responses', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ accessToken: 'token' }), { status: 200 });
  try {
    assert.equal((await collectCodex({}, {})).status, 'parse_error');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
