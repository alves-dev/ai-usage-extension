import test from 'node:test';
import assert from 'node:assert/strict';
import {
  alarmsClear,
  alarmsGetAll,
  permissionsContains,
  permissionsRequest,
  storageGet,
  storageSet,
  tabsCreate,
} from '../src/utils/chrome-promises.js';

test('wraps Chrome callback APIs as promises', async () => {
  const originalChrome = globalThis.chrome;
  globalThis.chrome = {
    runtime: { lastError: null },
    storage: { local: {
      get: (_keys, callback) => callback({ config: { enabled: true } }),
      set: (_items, callback) => callback(),
    } },
    alarms: {
      getAll: (callback) => callback([{ name: 'a' }]),
      clear: (_name, callback) => callback(true),
    },
    tabs: { create: (properties, callback) => callback({ id: 1, ...properties }) },
    permissions: {
      contains: (_value, callback) => callback(true),
      request: (_value, callback) => callback(true),
    },
  };
  try {
    assert.deepEqual(await storageGet('config'), { config: { enabled: true } });
    assert.equal(await storageSet({ config: {} }), undefined);
    assert.deepEqual(await alarmsGetAll(), [{ name: 'a' }]);
    assert.equal(await alarmsClear('a'), true);
    assert.deepEqual(await tabsCreate({ url: 'https://example.test' }), { id: 1, url: 'https://example.test' });
    assert.equal(await permissionsContains({ origins: ['https://example.test/*'] }), true);
    assert.equal(await permissionsRequest({ origins: ['https://example.test/*'] }), true);
  } finally {
    globalThis.chrome = originalChrome;
  }
});

test('rejects when Chrome reports a runtime error', async () => {
  const originalChrome = globalThis.chrome;
  globalThis.chrome = {
    runtime: { lastError: { message: 'permission denied' } },
    permissions: { request: (_value, callback) => callback(false) },
  };
  try {
    await assert.rejects(permissionsRequest({ origins: [] }), /permission denied/);
  } finally {
    globalThis.chrome = originalChrome;
  }
});
