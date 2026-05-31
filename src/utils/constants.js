export const EXTENSION_SOURCE = 'browser_extension';
export const PAYLOAD_SCHEMA_VERSION = '1.0';

export const PROVIDER_ORDER = ['codex', 'ollama_cloud'];

export const PROVIDERS = {
  codex: {
    id: 'codex',
    name: 'Codex',
    description: 'ChatGPT Codex cloud usage and plan data.',
    logoUrl: 'https://unpkg.com/@lobehub/icons-static-svg@1.91.0/icons/codex.svg',
    logoText: 'CX',
    defaultIntervalMinutes: 5,
    usagePageUrl: 'https://chatgpt.com/codex/cloud/settings/analytics',
  },
  ollama_cloud: {
    id: 'ollama_cloud',
    name: 'Ollama Cloud',
    description: 'Ollama Cloud session and weekly usage limits.',
    logoUrl: 'https://ollama.com/public/ollama.png',
    logoText: 'OC',
    defaultIntervalMinutes: 5,
    usagePageUrl: 'https://ollama.com/settings',
  },
};

export const PAYLOAD_STATUSES = new Set([
  'ok',
  'not_authenticated',
  'provider_unavailable',
  'parse_error',
  'rate_limited',
  'ha_unavailable',
  'unknown_error',
]);

export const ALARM_PREFIX = 'collect:';
