import { EXTENSION_SOURCE, PAYLOAD_SCHEMA_VERSION } from '../utils/constants.js';
import { nowIso } from '../utils/normalize.js';
import { permissionsContains, permissionsRequest } from '../utils/chrome-promises.js';

const TOKEN_HEADER = 'X-AI-Usage-Token';

export function buildWebhookUrl(homeAssistantConfig) {
  const webhook = String(homeAssistantConfig?.webhook || '').trim();
  const baseUrl = String(homeAssistantConfig?.baseUrl || '').trim();

  if (!webhook) {
    throw new Error('Webhook is not configured');
  }

  if (/^https?:\/\//i.test(webhook)) {
    return webhook;
  }

  if (!baseUrl) {
    throw new Error('Home Assistant URL is not configured');
  }

  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedWebhook = webhook.replace(/^\/+/, '');
  const path = normalizedWebhook.startsWith('api/webhook/')
    ? normalizedWebhook
    : `api/webhook/${normalizedWebhook}`;

  return `${normalizedBase}/${path}`;
}

export function permissionForWebhook(homeAssistantConfig) {
  const webhookUrl = buildWebhookUrl(homeAssistantConfig);
  const url = new URL(webhookUrl);
  return `${url.origin}/*`;
}

export async function hasWebhookPermission(homeAssistantConfig) {
  const origin = permissionForWebhook(homeAssistantConfig);
  return permissionsContains({ origins: [origin] });
}

export async function requestWebhookPermission(homeAssistantConfig) {
  const origin = permissionForWebhook(homeAssistantConfig);
  const granted = await permissionsRequest({ origins: [origin] });
  if (!granted) {
    throw new Error(`Permission denied for ${origin}`);
  }
  return origin;
}

export async function sendPayloadToHomeAssistant(homeAssistantConfig, payload) {
  const webhookUrl = buildWebhookUrl(homeAssistantConfig);
  const hasPermission = await hasWebhookPermission(homeAssistantConfig);

  if (!hasPermission) {
    return {
      ok: false,
      status: 'ha_unavailable',
      error: {
        code: 'missing_ha_permission',
        message: `Missing extension permission for ${new URL(webhookUrl).origin}`,
      },
    };
  }

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (homeAssistantConfig.token) {
    headers[TOKEN_HEADER] = homeAssistantConfig.token;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        ok: false,
        status: 'ha_unavailable',
        error: {
          code: `ha_http_${response.status}`,
          message: `Home Assistant returned HTTP ${response.status}`,
        },
      };
    }

    return {
      ok: true,
      status: 'ok',
      httpStatus: response.status,
    };
  } catch (error) {
    return {
      ok: false,
      status: 'ha_unavailable',
      error: {
        code: 'ha_request_failed',
        message: error.message,
      },
    };
  }
}

export function createConnectionTestPayload(extensionVersion) {
  return {
    schema_version: PAYLOAD_SCHEMA_VERSION,
    source: EXTENSION_SOURCE,
    source_version: extensionVersion,
    collected_at: nowIso(),
    provider: 'extension',
    status: 'ok',
    account_data: {},
    plan_data: {},
    provider_data: {
      collection_method: 'connection_test',
    },
    error: null,
  };
}
