import test from 'node:test';
import assert from 'node:assert/strict';
import { collectOllamaCloud, parseOllamaSettingsUsageFromHtml } from '../src/providers/ollama-cloud.js';

test('parses account, plan, and usage windows from the settings page HTML', () => {
  const html = `
    <main>
      <input name="username" value="igor">
      <input name="email" value="igor@example.com">
      <input name="plan" value="Pro">
      <section>
        <h2>Session usage</h2>
        <div aria-label="Session usage 42.5% used">
          <time data-time="2026-08-03T12:00:00Z"></time>
        </div>
      </section>
      <section>
        <h2>Weekly usage</h2>
        <div aria-label="Weekly usage 75% used">
          <time data-time="2026-08-10T12:00:00Z"></time>
        </div>
      </section>
    </main>
  `;

  assert.deepEqual(parseOllamaSettingsUsageFromHtml(html), {
    account: {
      username: 'igor',
      email: 'igor@example.com',
    },
    plan: {
      type: 'Pro',
    },
    session: {
      used_percent: 42.5,
      reset_at: '2026-08-03T12:00:00.000Z',
    },
    weekly: {
      used_percent: 75,
      reset_at: '2026-08-10T12:00:00.000Z',
    },
  });
});

test('parses the username from a profile link when no username input exists', () => {
  assert.deepEqual(parseOllamaSettingsUsageFromHtml('<a href="/igor">igor</a>').account, {
    username: 'igor',
    email: undefined,
  });
});

test('returns authentication and rate-limit statuses from Ollama', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 401 });
  try {
    assert.equal((await collectOllamaCloud({}, {})).status, 'not_authenticated');
    globalThis.fetch = async () => new Response('', { status: 429 });
    assert.equal((await collectOllamaCloud({}, {})).status, 'rate_limited');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('falls back to the Ollama page probe after a failed direct request', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 500 });
  try {
    const result = await collectOllamaCloud({}, {
      runPageProbe: async () => ({
        status: 'ok',
        html: '<input name="username" value="igor"><div>Session usage 10% used</div>',
      }),
    });
    assert.equal(result.status, 'parse_error');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
