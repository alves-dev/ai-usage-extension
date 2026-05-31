import { extractUsageFromJson } from '../utils/normalize.js';

export async function collectFromJsonEndpoints(endpoints) {
  const failures = [];

  for (const endpoint of endpoints) {
    const result = await collectJsonEndpoint(endpoint);

    if (result.status === 'ok' || result.status === 'not_authenticated' || result.status === 'rate_limited') {
      return result;
    }

    failures.push(result);
  }

  return {
    status: 'provider_unavailable',
    error: {
      code: 'no_endpoint_available',
      message: failures.map((failure) => failure.error?.message).filter(Boolean).join('; ') || 'No endpoint returned usage data',
    },
  };
}

async function collectJsonEndpoint(endpoint) {
  try {
    const response = await fetch(endpoint, {
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });

    if (response.status === 401 || response.status === 403) {
      return unauthenticated(`HTTP ${response.status} from ${endpoint}`);
    }

    if (response.status === 429) {
      return {
        status: 'rate_limited',
        error: {
          code: 'rate_limited',
          message: `Provider returned HTTP 429 for ${endpoint}`,
        },
      };
    }

    if (!response.ok) {
      return {
        status: 'provider_unavailable',
        error: {
          code: `http_${response.status}`,
          message: `HTTP ${response.status} from ${endpoint}`,
        },
      };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('json')) {
      const text = await response.text();
      if (looksLikeLoginPage(text)) {
        return unauthenticated(`Login page returned by ${endpoint}`);
      }

      return {
        status: 'parse_error',
        error: {
          code: 'non_json_response',
          message: `Expected JSON from ${endpoint}`,
        },
      };
    }

    const json = await response.json();
    const extracted = extractUsageFromJson(json);

    if (!extracted) {
      return {
        status: 'parse_error',
        error: {
          code: 'usage_not_found',
          message: `JSON did not contain recognizable usage fields at ${endpoint}`,
        },
      };
    }

    return {
      status: 'ok',
      account: extracted.account,
      usage: extracted.usage,
      endpoint,
      collectionMethod: 'direct_fetch',
    };
  } catch (error) {
    return {
      status: 'provider_unavailable',
      error: {
        code: 'request_failed',
        message: `${endpoint}: ${error.message}`,
      },
    };
  }
}

export function mapProbeResult(probeResult, collectionMethod) {
  if (!probeResult) {
    return {
      status: 'provider_unavailable',
      error: {
        code: 'page_probe_empty',
        message: 'Page probe returned no data',
      },
    };
  }

  if (probeResult.status !== 'ok') {
    return probeResult;
  }

  return {
    status: 'ok',
    account: probeResult.account || {},
    usage: probeResult.usage || {},
    collectionMethod,
  };
}

export function looksLikeLoginPage(text) {
  const lower = String(text || '').toLowerCase();
  return /sign in|log in|login|entrar|continue with|auth0|oauth/.test(lower);
}

export function unauthenticated(message = 'User is not logged in') {
  return {
    status: 'not_authenticated',
    error: {
      code: 'not_authenticated',
      message,
    },
  };
}
