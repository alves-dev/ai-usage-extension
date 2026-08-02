import test from 'node:test';
import assert from 'node:assert/strict';
import { collectCodex, normalizeCodexRateLimit } from '../src/providers/codex.js';

const fiveHourWindow = {
  used_percent: 10,
  limit_window_seconds: 18000,
  reset_after_seconds: 12000,
  reset_at: 1780434415,
};

const weeklyWindow = {
  used_percent: 59,
  limit_window_seconds: 604800,
  reset_after_seconds: 69577,
  reset_at: 1780310621,
};

function rateLimit(primary_window, secondary_window) {
  return {
    allowed: true,
    limit_reached: false,
    primary_window,
    secondary_window,
  };
}

test('classifies primary five-hour and secondary weekly windows by duration', () => {
  assert.deepEqual(normalizeCodexRateLimit(rateLimit(fiveHourWindow, weeklyWindow)), {
    allowed: true,
    limit_reached: false,
    five_hour_window: fiveHourWindow,
    weekly_window: weeklyWindow,
  });
});

test('classifies a weekly primary window and preserves a missing secondary window', () => {
  assert.deepEqual(normalizeCodexRateLimit(rateLimit(weeklyWindow, null)), {
    allowed: true,
    limit_reached: false,
    five_hour_window: null,
    weekly_window: weeklyWindow,
  });
});

test('preserves a weekly secondary window when primary is missing', () => {
  assert.deepEqual(normalizeCodexRateLimit(rateLimit(null, weeklyWindow)), {
    allowed: true,
    limit_reached: false,
    five_hour_window: null,
    weekly_window: weeklyWindow,
  });
});

test('returns both semantic windows as null when Codex provides neither', () => {
  assert.deepEqual(normalizeCodexRateLimit(rateLimit(null, null)), {
    allowed: true,
    limit_reached: false,
    five_hour_window: null,
    weekly_window: null,
  });
});

test('ignores unknown window durations without inventing semantics', () => {
  const unknownWindow = { used_percent: 99, limit_window_seconds: 3600 };

  assert.deepEqual(normalizeCodexRateLimit(rateLimit(unknownWindow, null)), {
    allowed: true,
    limit_reached: false,
    five_hour_window: null,
    weekly_window: null,
  });
});

test('preserves usage and reset values', () => {
  const result = normalizeCodexRateLimit(rateLimit(fiveHourWindow, weeklyWindow));

  assert.equal(result.five_hour_window.used_percent, 10);
  assert.equal(result.five_hour_window.reset_after_seconds, 12000);
  assert.equal(result.five_hour_window.reset_at, 1780434415);
  assert.equal(result.weekly_window.used_percent, 59);
  assert.equal(result.weekly_window.reset_after_seconds, 69577);
  assert.equal(result.weekly_window.reset_at, 1780310621);
});

test('collects Codex usage directly with an access token', async () => {
  const originalFetch = globalThis.fetch;
  let request = 0;
  globalThis.fetch = async () => {
    request += 1;
    if (request === 1) {
      return new Response(JSON.stringify({ accessToken: 'token' }), { status: 200 });
    }
    return new Response(JSON.stringify({
      email: 'user@example.com',
      plan_type: 'pro',
      rate_limit: rateLimit(fiveHourWindow, weeklyWindow),
    }), { status: 200 });
  };
  try {
    const result = await collectCodex({}, {});
    assert.equal(result.status, 'ok');
    assert.equal(result.payload.account_data.email, 'user@example.com');
    assert.equal(result.payload.provider_data.rate_limit.five_hour_window.used_percent, 10);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('falls back to the page probe when direct Codex access is unavailable', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('unauthorized', { status: 401 });
  try {
    const result = await collectCodex({}, {
      runPageProbe: async (_url, callback) => callback(),
    });
    assert.equal(result.status, 'not_authenticated');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('returns parse errors for incomplete Codex responses and maps HTTP errors', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ accessToken: 'token' }), { status: 200 });
  try {
    const result = await collectCodex({}, {});
    assert.equal(result.status, 'parse_error');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
