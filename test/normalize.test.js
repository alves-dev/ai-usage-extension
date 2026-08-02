import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractUsageFromJson,
  extractUsageFromText,
  hasUsageValue,
  normalizeCollectorResult,
  normalizeDateLike,
  normalizeStatus,
  normalizeUsage,
  toNumber,
} from '../src/utils/normalize.js';

test('normalizes usage values and infers remaining values', () => {
  assert.deepEqual(normalizeUsage({ used: '25', limit: '100', unit: 'requests' }), {
    used: 25,
    limit: 100,
    remaining: 75,
    unit: 'requests',
  });
  assert.equal(hasUsageValue({ remaining: 2 }), true);
  assert.equal(hasUsageValue({}), false);
});

test('normalizes numeric and date-like values safely', () => {
  assert.equal(toNumber('1,234.50 tokens'), 1234.5);
  assert.equal(toNumber('no number'), undefined);
  assert.equal(toNumber(4), 4);
  assert.equal(toNumber(null), undefined);
  assert.equal(normalizeDateLike('2026-08-03T12:00:00Z'), '2026-08-03T12:00:00.000Z');
  assert.equal(normalizeDateLike('not a date'), undefined);
  assert.equal(normalizeStatus('ok'), 'ok');
  assert.equal(normalizeStatus('bad'), 'unknown_error');
});

test('extracts usage and account fields from nested JSON', () => {
  assert.deepEqual(extractUsageFromJson({
    account: { email: 'user@example.com', plan: 'Pro' },
    usage: { used: 20, limit: 100, reset_at: '2026-08-03' },
  }), {
    account: { email: 'user@example.com', plan: 'Pro' },
    usage: {
      used: 20,
      limit: 100,
      remaining: 80,
      unit: 'unknown',
      reset_at: '2026-08-03T00:00:00.000Z',
    },
  });
  assert.equal(extractUsageFromJson({ message: 'nothing useful' }), null);
});

test('extracts usage and account fields from text', () => {
  assert.deepEqual(extractUsageFromText('Plan: Pro. Used 20 tokens. Limit 100 tokens. Reset 2026-08-03T12:00:00Z. user@example.com'), {
    account: { email: 'user@example.com', plan: 'pro' },
    usage: {
      used: 20,
      limit: 100,
      remaining: 80,
      unit: 'tokens',
      reset_at: '2026-08-03T12:00:00.000Z',
    },
  });
  assert.equal(extractUsageFromText('no usage here'), null);
});

test('normalizes successful and failed collector results into payloads', () => {
  const success = normalizeCollectorResult('codex', {
    status: 'ok',
    account: { email: 'user@example.com', plan: 'Pro' },
    usage: { used: 3, limit: 10 },
    collectionMethod: 'direct_fetch',
  }, '1.2.3');
  assert.equal(success.status, 'ok');
  assert.equal(success.provider, 'codex');
  assert.equal(success.account_data.email, 'user@example.com');

  const error = normalizeCollectorResult('ollama_cloud', {
    status: 'not_authenticated',
    error: { code: 'not_authenticated', message: 'login required' },
  }, '1.2.3');
  assert.deepEqual(error.error, { code: 'not_authenticated', message: 'login required' });
});
