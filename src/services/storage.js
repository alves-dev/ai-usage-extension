import { PROVIDER_ORDER, PROVIDERS } from '../utils/constants.js';
import { storageGet, storageSet } from '../utils/chrome-promises.js';
import { normalizeWebhookId } from './ha-client.js';

const CONFIG_KEY = 'config';
const STATE_KEY = 'state';

export function createDefaultConfig() {
  return {
    homeAssistant: {
      baseUrl: '',
      webhook: '',
    },
    providers: Object.fromEntries(
      PROVIDER_ORDER.map((providerId) => [
        providerId,
        {
          enabled: true,
          intervalMinutes: PROVIDERS[providerId].defaultIntervalMinutes,
        },
      ]),
    ),
  };
}

export function createDefaultState() {
  return {
    homeAssistant: {
      lastStatus: 'unknown',
      lastTestedAt: null,
      lastError: '',
    },
    providers: Object.fromEntries(
      PROVIDER_ORDER.map((providerId) => [
        providerId,
        {
          lastCollectedAt: null,
          lastStatus: 'unknown',
          lastError: '',
          lastSentAt: null,
        },
      ]),
    ),
  };
}

export async function getConfig() {
  const stored = await storageGet(CONFIG_KEY);
  return mergeConfig(stored[CONFIG_KEY]);
}

export async function saveConfig(config) {
  const normalized = mergeConfig(config);
  await storageSet({ [CONFIG_KEY]: normalized });
  return normalized;
}

export async function getState() {
  const stored = await storageGet(STATE_KEY);
  return mergeState(stored[STATE_KEY]);
}

export async function updateProviderState(providerId, patch) {
  const state = await getState();
  state.providers[providerId] = {
    ...state.providers[providerId],
    ...patch,
  };
  await storageSet({ [STATE_KEY]: state });
  return state.providers[providerId];
}

export async function updateHomeAssistantState(patch) {
  const state = await getState();
  state.homeAssistant = {
    ...state.homeAssistant,
    ...patch,
  };
  await storageSet({ [STATE_KEY]: state });
  return state.homeAssistant;
}

function mergeConfig(storedConfig) {
  const defaults = createDefaultConfig();
  const config = {
    ...defaults,
    ...(storedConfig || {}),
    homeAssistant: {
      ...defaults.homeAssistant,
      ...(storedConfig?.homeAssistant || {}),
    },
    providers: {
      ...defaults.providers,
      ...(storedConfig?.providers || {}),
    },
  };

  config.homeAssistant = {
    baseUrl: String(config.homeAssistant.baseUrl || '').trim(),
    webhook: normalizeWebhookId(config.homeAssistant.webhook),
  };

  for (const providerId of PROVIDER_ORDER) {
    config.providers[providerId] = {
      ...defaults.providers[providerId],
      ...(storedConfig?.providers?.[providerId] || {}),
    };
    config.providers[providerId].intervalMinutes = clampInterval(
      config.providers[providerId].intervalMinutes,
      defaults.providers[providerId].intervalMinutes,
    );
    config.providers[providerId].enabled = Boolean(config.providers[providerId].enabled);
  }

  return config;
}

function mergeState(storedState) {
  const defaults = createDefaultState();
  return {
    ...defaults,
    ...(storedState || {}),
    homeAssistant: {
      ...defaults.homeAssistant,
      ...(storedState?.homeAssistant || {}),
    },
    providers: Object.fromEntries(
      PROVIDER_ORDER.map((providerId) => [
        providerId,
        {
          ...defaults.providers[providerId],
          ...(storedState?.providers?.[providerId] || {}),
        },
      ]),
    ),
  };
}

function clampInterval(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(1, Math.round(numeric));
}
