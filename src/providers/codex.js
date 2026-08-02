const CODEX_USAGE_ENDPOINT = 'https://chatgpt.com/backend-api/wham/usage';
const CODEX_SESSION_ENDPOINT = 'https://chatgpt.com/api/auth/session';
const CODEX_USAGE_PAGE = 'https://chatgpt.com/codex/cloud/settings/analytics';
const FIVE_HOUR_WINDOW_SECONDS = 18_000;
const WEEKLY_WINDOW_SECONDS = 604_800;

export async function collectCodex(_settings, context) {
  const directResult = await fetchCodexUsage({
    usageEndpoint: CODEX_USAGE_ENDPOINT,
    sessionEndpoint: CODEX_SESSION_ENDPOINT,
  });
  if (directResult.status === 'ok' || !context?.runPageProbe) {
    return directResult;
  }

  const pageResult = await context.runPageProbe(CODEX_USAGE_PAGE, fetchCodexUsageFromPage);
  if (pageResult?.status === 'ok' && pageResult.data) {
    return buildCodexResult(pageResult.data);
  }
  return pageResult || directResult;
}

async function fetchCodexUsage({ usageEndpoint, sessionEndpoint }) {
  try {
    const tokenResult = await fetchChatGptAccessToken(sessionEndpoint);
    if (tokenResult.status !== 'ok') {
      return tokenResult;
    }

    const response = await fetch(usageEndpoint, {
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${tokenResult.accessToken}`,
      },
    });

    if (!response.ok) {
      return mapCodexHttpError(response.status, 'Codex usage');
    }

    const data = await response.json();
    return buildCodexResult(data);
  } catch (error) {
    return {
      status: 'provider_unavailable',
      error: {
        code: 'provider_unavailable',
        message: `${usageEndpoint}: ${error.message}`,
      },
    };
  }
}

async function fetchChatGptAccessToken(sessionEndpoint) {
  try {
    const response = await fetch(sessionEndpoint, {
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return mapCodexHttpError(response.status, 'ChatGPT session');
    }

    const session = await response.json();
    const accessToken = session?.accessToken || session?.access_token;
    if (!accessToken) {
      return {
        status: 'not_authenticated',
        error: {
          code: 'not_authenticated',
          message: 'ChatGPT session did not include an access token',
        },
      };
    }

    return {
      status: 'ok',
      accessToken,
    };
  } catch (error) {
    return {
      status: 'provider_unavailable',
      error: {
        code: 'provider_unavailable',
        message: `${sessionEndpoint}: ${error.message}`,
      },
    };
  }
}

async function fetchCodexUsageFromPage() {
  const usageEndpoint = 'https://chatgpt.com/backend-api/wham/usage';
  const sessionEndpoint = 'https://chatgpt.com/api/auth/session';

  try {
    const sessionResponse = await fetch(sessionEndpoint, {
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });
    if (!sessionResponse.ok) {
      return mapPageHttpError(sessionResponse.status, 'ChatGPT session');
    }

    const session = await sessionResponse.json();
    const accessToken = session?.accessToken || session?.access_token;
    if (!accessToken) {
      return {
        status: 'not_authenticated',
        error: {
          code: 'not_authenticated',
          message: 'ChatGPT session did not include an access token',
        },
      };
    }

    const response = await fetch(usageEndpoint, {
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return mapPageHttpError(response.status, 'Codex usage');
    }

    const data = await response.json();
    return { status: 'ok', data };
  } catch (error) {
    return {
      status: 'provider_unavailable',
      error: {
        code: 'provider_unavailable',
        message: `${usageEndpoint}: ${error.message}`,
      },
    };
  }

}

function mapPageHttpError(status, resourceName) {
  const statusMap = {
    401: 'not_authenticated',
    403: 'not_authenticated',
    429: 'rate_limited',
  };
  const resultStatus = statusMap[status] || 'provider_unavailable';
  return {
    status: resultStatus,
    error: {
      code: resultStatus,
      message: `${resourceName} returned HTTP ${status}`,
    },
  };
}

function buildCodexResult(data) {
  const missingFields = [];
  if (!data?.email) {
    missingFields.push('email');
  }
  if (!data?.plan_type) {
    missingFields.push('plan_type');
  }
  if (!isPlainObject(data?.rate_limit)) {
    missingFields.push('rate_limit');
  }

  if (missingFields.length) {
    return {
      status: 'parse_error',
      error: {
        code: 'parse_error',
        message: `Codex usage response did not include ${missingFields.join(', ')}`,
      },
    };
  }

  return {
    status: 'ok',
    payload: {
      account_data: pruneEmpty({
        user_id: data.user_id,
        account_id: data.account_id,
        email: data.email,
      }),
      plan_data: {
        type: data.plan_type,
      },
      provider_data: {
        rate_limit: normalizeCodexRateLimit(data.rate_limit),
      },
    },
  };
}

export function normalizeCodexRateLimit(rateLimit) {
  const normalized = {
    allowed: rateLimit.allowed,
    limit_reached: rateLimit.limit_reached,
    five_hour_window: null,
    weekly_window: null,
  };

  for (const window of [rateLimit.primary_window, rateLimit.secondary_window]) {
    if (!window) {
      continue;
    }

    if (window.limit_window_seconds === FIVE_HOUR_WINDOW_SECONDS) {
      normalized.five_hour_window = window;
    } else if (window.limit_window_seconds === WEEKLY_WINDOW_SECONDS) {
      normalized.weekly_window = window;
    } else {
      console.warn('Codex returned an unknown rate-limit window duration', window.limit_window_seconds);
    }
  }

  return normalized;
}

function mapCodexHttpError(status, resourceName) {
  if (status === 401 || status === 403) {
    return {
      status: 'not_authenticated',
      error: {
        code: 'not_authenticated',
        message: `${resourceName} returned HTTP ${status}`,
      },
    };
  }

  if (status === 429) {
    return {
      status: 'rate_limited',
      error: {
        code: 'rate_limited',
        message: `${resourceName} returned HTTP 429`,
      },
    };
  }

  return {
    status: 'provider_unavailable',
    error: {
      code: 'provider_unavailable',
      message: `${resourceName} returned HTTP ${status}`,
    },
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function pruneEmpty(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
}
