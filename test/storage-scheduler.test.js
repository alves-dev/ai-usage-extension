import test from 'node:test';
import assert from 'node:assert/strict';
import { alarmNameForProvider, providerIdFromAlarm, syncProviderAlarms } from '../src/services/scheduler.js';
import { createDefaultConfig, createDefaultState, getConfig, saveConfig } from '../src/services/storage.js';

test('creates complete default configuration and state', () => {
  const config = createDefaultConfig();
  const state = createDefaultState();
  assert.equal(config.homeAssistant.webhook, '');
  assert.deepEqual(Object.keys(config.providers).sort(), ['codex', 'ollama_cloud']);
  assert.equal(state.homeAssistant.lastStatus, 'unknown');
  assert.equal(state.providers.codex.lastCollectedAt, null);
});

test('maps provider alarm names in both directions', () => {
  const alarmName = alarmNameForProvider('codex');
  assert.equal(providerIdFromAlarm(alarmName), 'codex');
  assert.equal(providerIdFromAlarm('unrelated-alarm'), null);
});

test('reads and saves configuration through Chrome storage', async () => {
  const originalChrome = globalThis.chrome;
  let stored = {};
  globalThis.chrome = {
    runtime: { lastError: null },
    storage: { local: {
      get: (_key, callback) => callback(stored),
      set: (items, callback) => { stored = { ...stored, ...items }; callback(); },
    } },
  };
  try {
    const config = await saveConfig({ homeAssistant: { baseUrl: ' https://ha.example ', webhook: '/abc/' }, providers: { codex: { enabled: false, intervalMinutes: 0 } } });
    assert.equal(config.homeAssistant.baseUrl, 'https://ha.example');
    assert.equal(config.homeAssistant.webhook, 'abc');
    assert.equal(config.providers.codex.enabled, false);
    assert.equal(config.providers.codex.intervalMinutes, 1);
    assert.equal((await getConfig()).homeAssistant.webhook, 'abc');
  } finally {
    globalThis.chrome = originalChrome;
  }
});

test('synchronizes enabled, disabled, and stale alarms', async () => {
  const originalChrome = globalThis.chrome;
  const cleared = [];
  const created = [];
  globalThis.chrome = {
    runtime: { lastError: null },
    alarms: {
      getAll: (callback) => callback([
        { name: 'collect:codex', periodInMinutes: 15 },
        { name: 'collect:stale', periodInMinutes: 10 },
      ]),
      clear: (name, callback) => { cleared.push(name); callback(true); },
      create: (name, details) => created.push({ name, details }),
    },
  };
  try {
    const config = createDefaultConfig();
    config.providers.codex.intervalMinutes = 30;
    config.providers.ollama_cloud.enabled = false;
    await syncProviderAlarms(config, { forceReschedule: true });
    assert.equal(created.length, 1);
    assert.equal(created[0].name, 'collect:codex');
    assert.ok(cleared.includes('collect:ollama_cloud'));
    assert.ok(cleared.includes('collect:stale'));
  } finally {
    globalThis.chrome = originalChrome;
  }
});
