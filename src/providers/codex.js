const CODEX_USAGE_ENDPOINT = 'https://chatgpt.com/backend-api/wham/usage';
const CODEX_SESSION_ENDPOINT = 'https://chatgpt.com/api/auth/session';
const CODEX_USAGE_PAGE = 'https://chatgpt.com/codex/cloud/settings/analytics';

export async function collectCodex(_settings, context) {
  const directResult = await fetchCodexUsage({
    usageEndpoint: CODEX_USAGE_ENDPOINT,
    sessionEndpoint: CODEX_SESSION_ENDPOINT,
  });
  if (directResult.status === 'ok' || !context?.runPageProbe) {
    return directResult;
  }

  const pageResult = await context.runPageProbe(CODEX_USAGE_PAGE, fetchCodexUsageFromPage);
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
    const tokenResult = await fetchAccessToken();
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
      return mapHttpError(response.status, 'Codex usage');
    }

    const data = await response.json();
    return buildResult(data);
  } catch (error) {
    return {
      status: 'provider_unavailable',
      error: {
        code: 'provider_unavailable',
        message: `${usageEndpoint}: ${error.message}`,
      },
    };
  }

  async function fetchAccessToken() {
    try {
      const response = await fetch(sessionEndpoint, {
        credentials: 'include',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        return mapHttpError(response.status, 'ChatGPT session');
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

  function buildResult(data) {
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
          rate_limit: data.rate_limit,
        },
      },
    };
  }

  function mapHttpError(status, resourceName) {
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
      provider_data: pruneEmpty({
        rate_limit: data.rate_limit,
      }),
    },
  };
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
