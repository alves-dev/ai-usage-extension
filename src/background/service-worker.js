import { PROVIDER_ORDER } from '../utils/constants.js';
import { normalizeCollectorResult, nowIso } from '../utils/normalize.js';
import { getConfig, saveConfig, updateHomeAssistantState, updateProviderState } from '../services/storage.js';
import { createConnectionTestPayload, sendPayloadToHomeAssistant } from '../services/ha-client.js';
import { providerIdFromAlarm, syncProviderAlarms } from '../services/scheduler.js';
import { collectProvider } from '../providers/index.js';
import { runPageProbe } from './page-probe.js';

const extensionVersion = chrome.runtime.getManifest().version;

chrome.runtime.onInstalled.addListener((details) => {
  initialize({ forceReschedule: details.reason === 'install' || details.reason === 'update' }).catch(console.error);
});

chrome.runtime.onStartup.addListener(() => {
  initialize().catch(console.error);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  const providerId = providerIdFromAlarm(alarm.name);
  if (!providerId) {
    return;
  }

  runProviderAndSend(providerId).catch((error) => {
    updateProviderState(providerId, {
      lastCollectedAt: nowIso(),
      lastStatus: 'unknown_error',
      lastError: error.message,
    }).catch(console.error);
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then((response) => sendResponse(response))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

async function initialize(options = {}) {
  const config = await getConfig();
  await syncProviderAlarms(config, options);
}

async function handleMessage(message) {
  switch (message?.type) {
    case 'CONFIG_UPDATED': {
      const config = await getConfig();
      await syncProviderAlarms(config, { forceReschedule: true });
      return { ok: true };
    }

    case 'SAVE_CONFIG': {
      const config = await saveConfig(message.config);
      await syncProviderAlarms(config, { forceReschedule: true });
      return { ok: true, config };
    }

    case 'RUN_PROVIDER_NOW':
      return runProviderAndSend(message.providerId);

    case 'TEST_HA_CONNECTION':
      return testHomeAssistantConnection();

    default:
      return { ok: false, error: 'Unknown message type' };
  }
}

async function runProviderAndSend(providerId) {
  if (!PROVIDER_ORDER.includes(providerId)) {
    return { ok: false, error: `Unknown provider ${providerId}` };
  }

  const config = await getConfig();
  const providerConfig = config.providers[providerId];

  if (!providerConfig?.enabled) {
    return { ok: false, error: `${providerId} is disabled` };
  }

  let collectorResult;
  try {
    collectorResult = await collectProvider(providerId, providerConfig, {
      runPageProbe,
    });
  } catch (error) {
    collectorResult = {
      status: 'unknown_error',
      error: {
        code: 'collector_failed',
        message: error.message,
      },
    };
  }

  const payload = normalizeCollectorResult(providerId, collectorResult, extensionVersion);
  const delivery = await maybeSendPayload(config.homeAssistant, payload);
  const lastStatus = delivery.ok ? payload.status : delivery.status;
  const lastError = delivery.ok ? payload.error?.message || '' : delivery.error?.message || 'Failed to send to Home Assistant';

  const statePatch = {
    lastCollectedAt: payload.collected_at,
    lastStatus,
    lastError,
  };

  if (delivery.ok) {
    statePatch.lastSentAt = nowIso();
  }

  await updateProviderState(providerId, statePatch);

  return {
    ok: delivery.ok,
    provider: providerId,
    payload,
    delivery,
  };
}

async function maybeSendPayload(homeAssistantConfig, payload, options = {}) {
  if (!homeAssistantConfig?.webhook) {
    return {
      ok: false,
      status: 'ha_unavailable',
      error: {
        code: 'ha_not_configured',
        message: 'Home Assistant webhook is not configured',
      },
    };
  }

  return sendPayloadToHomeAssistant(homeAssistantConfig, payload, options);
}

async function testHomeAssistantConnection() {
  const config = await getConfig();
  const payload = createConnectionTestPayload(extensionVersion);
  const delivery = await maybeSendPayload(config.homeAssistant, payload, {
    acceptedErrorStatuses: [400],
  });

  await updateHomeAssistantState({
    lastStatus: delivery.ok ? 'ok' : delivery.status,
    lastTestedAt: nowIso(),
    lastError: delivery.ok ? '' : delivery.error?.message || 'Failed to reach Home Assistant',
  });

  return {
    ok: delivery.ok,
    delivery,
  };
}

initialize().catch(console.error);
