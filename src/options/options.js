import { PROVIDER_ORDER, PROVIDERS } from '../utils/constants.js';
import { getConfig, getState } from '../services/storage.js';
import { normalizeWebhookId, requestWebhookPermission } from '../services/ha-client.js';
import { runtimeSendMessage } from '../utils/chrome-promises.js';

let currentConfig;
let currentState;

const elements = {
  extensionVersion: document.querySelector('#extensionVersion'),
  saveButton: document.querySelector('#saveButton'),
  haBaseUrl: document.querySelector('#haBaseUrl'),
  haWebhook: document.querySelector('#haWebhook'),
  haStatus: document.querySelector('#haStatus'),
  haLastTest: document.querySelector('#haLastTest'),
  haError: document.querySelector('#haError'),
  testHaButton: document.querySelector('#testHaButton'),
  providersList: document.querySelector('#providersList'),
  providerTemplate: document.querySelector('#providerTemplate'),
};

elements.extensionVersion.textContent = `Version ${chrome.runtime.getManifest().version}`;
elements.saveButton.addEventListener('click', saveOptions);
elements.testHaButton.addEventListener('click', testHomeAssistant);

loadAndRender().catch((error) => {
  elements.haError.textContent = error.message;
});

async function loadAndRender() {
  currentConfig = await getConfig();
  currentState = await getState();
  renderHomeAssistant();
  renderProviders();
}

function renderHomeAssistant() {
  elements.haBaseUrl.value = currentConfig.homeAssistant.baseUrl || '';
  elements.haWebhook.value = normalizeWebhookId(currentConfig.homeAssistant.webhook || '');

  setStatusPill(elements.haStatus, currentState.homeAssistant.lastStatus);
  elements.haLastTest.textContent = currentState.homeAssistant.lastTestedAt
    ? `Last tested: ${formatDate(currentState.homeAssistant.lastTestedAt)}`
    : '';
  elements.haError.textContent = currentState.homeAssistant.lastError || '';
}

function renderProviders() {
  elements.providersList.replaceChildren();

  for (const providerId of PROVIDER_ORDER) {
    const provider = PROVIDERS[providerId];
    const providerConfig = currentConfig.providers[providerId];
    const providerState = currentState.providers[providerId];
    const fragment = elements.providerTemplate.content.cloneNode(true);
    const card = fragment.querySelector('.provider-card');
    const enabledInput = fragment.querySelector('.provider-enabled');
    const testButton = fragment.querySelector('.provider-test');

    card.dataset.providerId = providerId;
    card.classList.toggle('is-disabled', !providerConfig.enabled);
    renderProviderLogo(fragment, provider);
    fragment.querySelector('.provider-name').textContent = provider.name;
    fragment.querySelector('.provider-description').textContent = provider.description || '';
    enabledInput.checked = providerConfig.enabled;
    fragment.querySelector('.provider-interval').value = providerConfig.intervalMinutes;
    fragment.querySelector('.provider-last-run').textContent = formatDate(providerState.lastCollectedAt);
    fragment.querySelector('.provider-last-sent').textContent = formatDate(providerState.lastSentAt);
    fragment.querySelector('.provider-error').textContent = providerState.lastError || '';
    setStatusPill(fragment.querySelector('.provider-status'), providerState.lastStatus);
    testButton.disabled = !providerConfig.enabled;

    enabledInput.addEventListener('change', () => {
      card.classList.toggle('is-disabled', !enabledInput.checked);
      testButton.disabled = !enabledInput.checked;
    });
    testButton.addEventListener('click', () => runProviderNow(providerId));
    elements.providersList.append(fragment);
  }
}

function renderProviderLogo(fragment, provider) {
  const logo = fragment.querySelector('.provider-logo');
  const fallback = fragment.querySelector('.provider-logo-fallback');

  fallback.textContent = provider.logoText || provider.name.slice(0, 2).toUpperCase();
  if (!provider.logoUrl) {
    logo.removeAttribute('src');
    logo.classList.remove('has-logo');
    return;
  }

  logo.src = provider.logoUrl;
  logo.alt = `${provider.name} logo`;
  logo.classList.add('has-logo');
}

async function saveOptions() {
  setBusy(elements.saveButton, true);
  try {
    const config = readConfigFromForm();
    await requestPermissionIfWebhookConfigured(config);
    const response = await runtimeSendMessage({ type: 'SAVE_CONFIG', config });
    if (!response.ok) {
      throw new Error(response.error || 'Failed to save settings');
    }
    await loadAndRender();
  } catch (error) {
    elements.haError.textContent = error.message;
  } finally {
    setBusy(elements.saveButton, false);
  }
}

async function testHomeAssistant() {
  setBusy(elements.testHaButton, true);
  try {
    const config = readConfigFromForm();
    await requestPermissionIfWebhookConfigured(config);
    const saveResponse = await runtimeSendMessage({ type: 'SAVE_CONFIG', config });
    if (!saveResponse.ok) {
      throw new Error(saveResponse.error || 'Failed to save settings');
    }

    const response = await runtimeSendMessage({ type: 'TEST_HA_CONNECTION' });
    if (!response.ok) {
      throw new Error(response.delivery?.error?.message || response.error || 'Connection test failed');
    }
    await loadAndRender();
  } catch (error) {
    elements.haError.textContent = error.message;
    await loadAndRender();
  } finally {
    setBusy(elements.testHaButton, false);
  }
}

async function runProviderNow(providerId) {
  const card = elements.providersList.querySelector(`[data-provider-id="${providerId}"]`);
  const button = card.querySelector('.provider-test');
  const errorElement = card.querySelector('.provider-error');

  setBusy(button, true);
  errorElement.textContent = '';
  try {
    const config = readConfigFromForm();
    await requestPermissionIfWebhookConfigured(config);
    const saveResponse = await runtimeSendMessage({ type: 'SAVE_CONFIG', config });
    if (!saveResponse.ok) {
      throw new Error(saveResponse.error || 'Failed to save settings');
    }

    const response = await runtimeSendMessage({ type: 'RUN_PROVIDER_NOW', providerId });
    if (!response.ok) {
      throw new Error(response.delivery?.error?.message || response.error || 'Collection failed');
    }
    await loadAndRender();
  } catch (error) {
    errorElement.textContent = error.message;
    await loadAndRender();
  } finally {
    setBusy(button, false);
  }
}

function readConfigFromForm() {
  const providers = {};

  for (const providerId of PROVIDER_ORDER) {
    const card = elements.providersList.querySelector(`[data-provider-id="${providerId}"]`);
    providers[providerId] = {
      enabled: card.querySelector('.provider-enabled').checked,
      intervalMinutes: Number(card.querySelector('.provider-interval').value || PROVIDERS[providerId].defaultIntervalMinutes),
    };
  }

  return {
    homeAssistant: {
      baseUrl: elements.haBaseUrl.value.trim(),
      webhook: normalizeWebhookId(elements.haWebhook.value),
    },
    providers,
  };
}

async function requestPermissionIfWebhookConfigured(config) {
  if (!config.homeAssistant.webhook) {
    return;
  }
  await requestWebhookPermission(config.homeAssistant);
}

function setStatusPill(element, status) {
  element.textContent = statusLabel(status);
  element.classList.remove('status-ok', 'status-warn', 'status-error', 'status-unknown');
  element.classList.add(statusClass(status));
}

function statusLabel(status) {
  return {
    ok: 'OK',
    not_authenticated: 'Not authenticated',
    provider_unavailable: 'Unavailable',
    parse_error: 'Parse error',
    rate_limited: 'Rate limited',
    ha_unavailable: 'HA unavailable',
    unknown_error: 'Error',
    unknown: 'Waiting',
  }[status] || 'Waiting';
}

function statusClass(status) {
  if (status === 'ok') {
    return 'status-ok';
  }
  if (status === 'not_authenticated' || status === 'rate_limited') {
    return 'status-warn';
  }
  if (status && status !== 'unknown') {
    return 'status-error';
  }
  return 'status-unknown';
}

function formatDate(value) {
  if (!value) {
    return '-';
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function setBusy(button, busy) {
  button.disabled = busy;
}
