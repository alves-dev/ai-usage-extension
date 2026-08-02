import { EXTENSION_SOURCE, PAYLOAD_SCHEMA_VERSION, PAYLOAD_STATUSES } from './constants.js';

const USED_KEYS = [
  'used',
  'usage',
  'usage_used',
  'used_tokens',
  'tokens_used',
  'total_tokens',
  'messages_used',
  'requests_used',
  'current_usage',
  'consumed',
  'spent',
];

const LIMIT_KEYS = [
  'limit',
  'usage_limit',
  'quota',
  'max',
  'maximum',
  'total',
  'allowance',
  'hard_limit',
  'hard_limit_usd',
  'messages_limit',
  'tokens_limit',
];

const REMAINING_KEYS = [
  'remaining',
  'left',
  'available',
  'balance',
  'credits',
  'credit_balance',
  'credits_remaining',
  'messages_remaining',
  'tokens_remaining',
];

const RESET_KEYS = [
  'reset_at',
  'resets_at',
  'reset',
  'renewal_at',
  'renews_at',
  'next_reset',
  'period_end',
  'billing_cycle_anchor',
];

export function nowIso() {
  return new Date().toISOString();
}

export function normalizeStatus(status) {
  return PAYLOAD_STATUSES.has(status) ? status : 'unknown_error';
}

export function normalizeSuccessPayload(providerId, result, extensionVersion) {
  const usage = normalizeUsage(result.usage || {});
  return {
    schema_version: PAYLOAD_SCHEMA_VERSION,
    source: EXTENSION_SOURCE,
    source_version: extensionVersion,
    collected_at: nowIso(),
    provider: providerId,
    status: 'ok',
    account_data: pruneEmpty({
      email: result.account?.email,
    }),
    plan_data: pruneEmpty({
      type: result.account?.plan,
    }),
    provider_data: pruneEmpty({
      usage,
      collection_method: result.collectionMethod || 'unknown',
      endpoint: result.endpoint,
    }),
    error: null,
  };
}

export function normalizeErrorPayload(providerId, status, error, extensionVersion) {
  const safeStatus = normalizeStatus(status);
  return {
    schema_version: PAYLOAD_SCHEMA_VERSION,
    source: EXTENSION_SOURCE,
    source_version: extensionVersion,
    collected_at: nowIso(),
    provider: providerId,
    status: safeStatus,
    account_data: {},
    plan_data: {},
    provider_data: {},
    error: {
      code: error?.code || safeStatus,
      message: error?.message || 'Unknown error',
    },
  };
}

export function normalizeCollectorResult(providerId, result, extensionVersion) {
  if (result?.status === 'ok' && result.payload && typeof result.payload === 'object') {
    const payload = result.payload;
    return {
      schema_version: PAYLOAD_SCHEMA_VERSION,
      source: EXTENSION_SOURCE,
      source_version: extensionVersion,
      collected_at: nowIso(),
      provider: providerId,
      status: 'ok',
      account_data: normalizeObject(payload.account_data),
      plan_data: normalizeObject(payload.plan_data),
      provider_data: normalizeObject(payload.provider_data),
      error: null,
    };
  }

  if (result?.status === 'ok') {
    return normalizeSuccessPayload(providerId, result, extensionVersion);
  }

  const status = result?.status || 'unknown_error';
  return normalizeErrorPayload(providerId, status, result?.error, extensionVersion);
}

export function normalizeUsage(usage) {
  const used = toNumber(usage.used);
  const limit = toNumber(usage.limit);
  const remaining = toNumber(usage.remaining);
  const normalized = pruneEmpty({
    used,
    limit,
    remaining: remaining ?? inferRemaining(used, limit),
    unit: usage.unit || inferUnitFromObject(usage) || 'unknown',
    reset_at: normalizeDateLike(usage.reset_at),
  });

  return normalized;
}

export function extractUsageFromJson(data) {
  const candidates = [];
  const account = {};

  walkObjects(data, (node, path) => {
    mergeAccount(account, extractAccount(node));

    const candidate = extractUsageCandidate(node, path);
    if (candidate.score > 0) {
      candidates.push(candidate);
    }
  });

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best) {
    return null;
  }

  const usage = normalizeUsage(best.usage);
  if (!hasUsageValue(usage)) {
    return null;
  }

  return {
    account: pruneEmpty(account),
    usage,
  };
}

export function extractUsageFromText(text) {
  const safeText = String(text || '').replaceAll(/\s+/g, ' ').trim();
  const usage = {};

  usage.remaining =
    findNumberNear(safeText, ['remaining', 'left', 'available', 'restante', 'disponivel', 'disponível']) ??
    findPercentNear(safeText, ['remaining', 'left', 'restante']);
  usage.used = findNumberNear(safeText, ['used', 'usage', 'consumed', 'usado', 'uso', 'utilizado']);
  usage.limit = findNumberNear(safeText, ['limit', 'quota', 'allowance', 'limite', 'cota']);
  usage.reset_at = findIsoDate(safeText);
  usage.unit = inferUnitFromText(safeText);

  const normalized = normalizeUsage(usage);
  if (!hasUsageValue(normalized)) {
    return null;
  }

  return {
    account: pruneEmpty({
      email: findEmail(safeText),
      plan: findPlan(safeText),
    }),
    usage: normalized,
  };
}

export function hasUsageValue(usage) {
  return ['used', 'limit', 'remaining'].some((key) => Number.isFinite(usage?.[key]));
}

export function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const match = /-?\d+(\.\d+)?/.exec(value.replaceAll(',', ''));
  if (!match) {
    return undefined;
  }

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function normalizeDateLike(value) {
  if (!value) {
    return undefined;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const milliseconds = value < 10_000_000_000 ? value * 1000 : value;
    return new Date(milliseconds).toISOString();
  }

  const timestamp = Date.parse(String(value));
  if (Number.isNaN(timestamp)) {
    return undefined;
  }

  return new Date(timestamp).toISOString();
}

function extractUsageCandidate(node, path) {
  const usage = {};
  let score = 0;
  let unitHint = '';

  for (const [key, value] of Object.entries(node)) {
    const field = extractUsageField(key, value);
    if (!field) {
      continue;
    }

    usage[field.name] = field.value;
    score += field.score;
    unitHint += field.unitHint || '';
  }

  const pathHint = path.join(' ');
  usage.unit ||= inferUnitFromText(`${unitHint} ${pathHint}`);

  if (hasUsageValue(usage)) {
    score += path.some((part) => /usage|quota|limit|billing|credit/i.test(part)) ? 3 : 0;
  }

  return { score, usage };
}

function extractUsageField(key, value) {
  const normalizedKey = normalizeKey(key);
  const numeric = toNumber(value);

  if (numeric !== undefined) {
    const numericFields = [
      ['used', USED_KEYS],
      ['limit', LIMIT_KEYS],
      ['remaining', REMAINING_KEYS],
    ];
    const match = numericFields.find(([, candidates]) => keyMatches(normalizedKey, candidates));
    if (match) {
      return {
        name: match[0],
        value: numeric,
        score: 4,
        unitHint: ` ${normalizedKey}`,
      };
    }
  }

  if (keyMatches(normalizedKey, RESET_KEYS)) {
    const resetAt = normalizeDateLike(value);
    if (resetAt) {
      return { name: 'reset_at', value: resetAt, score: 2 };
    }
  }

  if (normalizedKey === 'unit' && typeof value === 'string') {
    return { name: 'unit', value, score: 1 };
  }

  return null;
}

function extractAccount(node) {
  const account = {};

  for (const [key, value] of Object.entries(node)) {
    const normalizedKey = normalizeKey(key);
    if (!account.email && normalizedKey.includes('email') && typeof value === 'string') {
      account.email = findEmail(value);
    }

    if (!account.plan && /plan|tier|subscription/.test(normalizedKey) && typeof value === 'string') {
      account.plan = value.trim();
    }
  }

  return account;
}

function mergeAccount(target, source) {
  if (!target.email && source.email) {
    target.email = source.email;
  }
  if (!target.plan && source.plan) {
    target.plan = source.plan;
  }
}

function walkObjects(value, callback, path = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkObjects(item, callback, [...path, String(index)]));
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  callback(value, path);
  for (const [key, child] of Object.entries(value)) {
    walkObjects(child, callback, [...path, key]);
  }
}

function normalizeKey(key) {
  return String(key).replaceAll(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`).toLowerCase();
}

function keyMatches(key, candidates) {
  return candidates.some((candidate) => key === candidate || key.includes(candidate));
}

function inferRemaining(used, limit) {
  if (!Number.isFinite(used) || !Number.isFinite(limit)) {
    return undefined;
  }
  return Math.max(limit - used, 0);
}

function inferUnitFromObject(usage) {
  return inferUnitFromText(Object.keys(usage).join(' '));
}

function inferUnitFromText(text) {
  const lower = String(text || '').toLowerCase();
  if (/token/.test(lower)) {
    return 'tokens';
  }
  if (/message|mensage/.test(lower)) {
    return 'messages';
  }
  if (/credit|balance|saldo/.test(lower)) {
    return 'credits';
  }
  if (/request|requisi/.test(lower)) {
    return 'requests';
  }
  if (/usd|dollar|\$|cost|spend|spent/.test(lower)) {
    return 'usd';
  }
  if (/%|percent/.test(lower)) {
    return 'percent';
  }
  return undefined;
}

function findNumberNear(text, labels) {
  for (const label of labels) {
    const after = new RegExp(String.raw`${label}[^0-9$-]{0,40}([$]?\d[\d,.]*)`, 'i').exec(text);
    if (after) {
      return toNumber(after[1]);
    }

    const before = new RegExp(String.raw`([$]?\d[\d,.]*)[^a-zA-Z0-9]{0,20}${label}`, 'i').exec(text);
    if (before) {
      return toNumber(before[1]);
    }
  }

  return undefined;
}

function findPercentNear(text, labels) {
  for (const label of labels) {
    const pattern = new RegExp(String.raw`(\d+(?:\.\d+)?)\s*%[^a-zA-Z0-9]{0,20}${label}`, 'i');
    const match = pattern.exec(text);
    if (match) {
      return toNumber(match[1]);
    }
  }
  return undefined;
}

function findIsoDate(text) {
  const match = /\d{4}-\d{2}-\d{2}(?:[T ][0-9:.+-]+Z?)?/.exec(text);
  return normalizeDateLike(match?.[0]);
}

function findEmail(text) {
  const match = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.exec(text);
  return match?.[0];
}

function findPlan(text) {
  const match = /\b(free|go|plus|pro|business|enterprise|edu|team|basic|premium)\b/i.exec(text);
  return match?.[0]?.toLowerCase();
}

function pruneEmpty(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
}

function normalizeObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return pruneEmpty(value);
}
