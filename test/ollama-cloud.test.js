import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOllamaSettingsUsageFromHtml } from '../src/providers/ollama-cloud.js';

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
