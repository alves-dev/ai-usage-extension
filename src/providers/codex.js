const CODEX_USAGE_ENDPOINT = 'https://chatgpt.com/backend-api/wham/usage';
const CODEX_SESSION_ENDPOINT = 'https://chatgpt.com/api/auth/session';
const CODEX_USAGE_PAGE = 'https://chatgpt.com/codex/cloud/settings/analytics';

export async function collectCodex(_settings, context) {
  const directResult = await fetchCodexUsage(CODEX_USAGE_ENDPOINT);
  if (directResult.status === 'ok' || !context?.runPageProbe) {
    return directResult;
  }

  const pageResult = await context.runPageProbe(CODEX_USAGE_PAGE, fetchCodexUsageFromPage);
  return pageResult || directResult;
}

async function fetchCodexUsage(endpoint) {
  try {
    const tokenResult = await fetchChatGptAccessToken();
    if (tokenResult.status !== 'ok') {
      return tokenResult;
    }

    const response = await fetch(endpoint, {
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${tokenResult.accessToken}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      return {
        status: 'not_authenticated',
        error: {
          code: 'not_authenticated',
          message: `Codex returned HTTP ${response.status}`,
        },
      };
    }

    if (response.status === 429) {
      return {
        status: 'rate_limited',
        error: {
          code: 'rate_limited',
          message: 'Codex returned HTTP 429',
        },
      };
    }

    if (!response.ok) {
      return {
        status: 'provider_unavailable',
        error: {
          code: `http_${response.status}`,
          message: `Codex returned HTTP ${response.status}`,
        },
      };
    }

    const data = await response.json();
    if (!data?.email || !data?.plan_type) {
      return {
        status: 'parse_error',
        error: {
          code: 'missing_codex_account_fields',
          message: 'Codex usage response did not include email and plan_type',
        },
      };
    }

    return {
      status: 'ok',
      payload: {
        account_data: {
          email: data.email,
        },
        plan_data: {
          type: data.plan_type,
        },
        provider_data: {},
      },
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

async function fetchChatGptAccessToken() {
  try {
    const response = await fetch(CODEX_SESSION_ENDPOINT, {
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });

    if (response.status === 401 || response.status === 403) {
      return {
        status: 'not_authenticated',
        error: {
          code: 'not_authenticated',
          message: `ChatGPT session returned HTTP ${response.status}`,
        },
      };
    }

    if (!response.ok) {
      return {
        status: 'provider_unavailable',
        error: {
          code: `session_http_${response.status}`,
          message: `ChatGPT session returned HTTP ${response.status}`,
        },
      };
    }

    const session = await response.json();
    const accessToken = session?.accessToken || session?.access_token;
    if (!accessToken) {
      return {
        status: 'not_authenticated',
        error: {
          code: 'missing_access_token',
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
        code: 'session_request_failed',
        message: `${CODEX_SESSION_ENDPOINT}: ${error.message}`,
      },
    };
  }
}

async function fetchCodexUsageFromPage() {
  const endpoint = 'https://chatgpt.com/backend-api/wham/usage';
  const sessionEndpoint = 'https://chatgpt.com/api/auth/session';

  try {
    const tokenResult = await fetchAccessToken();
    if (tokenResult.status !== 'ok') {
      return tokenResult;
    }

    const response = await fetch(endpoint, {
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${tokenResult.accessToken}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      return {
        status: 'not_authenticated',
        error: {
          code: 'not_authenticated',
          message: `Codex returned HTTP ${response.status}`,
        },
      };
    }

    if (response.status === 429) {
      return {
        status: 'rate_limited',
        error: {
          code: 'rate_limited',
          message: 'Codex returned HTTP 429',
        },
      };
    }

    if (!response.ok) {
      return {
        status: 'provider_unavailable',
        error: {
          code: `http_${response.status}`,
          message: `Codex returned HTTP ${response.status}`,
        },
      };
    }

    const data = await response.json();
    if (!data?.email || !data?.plan_type) {
      return {
        status: 'parse_error',
        error: {
          code: 'missing_codex_account_fields',
          message: 'Codex usage response did not include email and plan_type',
        },
      };
    }

    return {
      status: 'ok',
      payload: {
        account_data: {
          email: data.email,
        },
        plan_data: {
          type: data.plan_type,
        },
        provider_data: {},
      },
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

  async function fetchAccessToken() {
    try {
      const response = await fetch(sessionEndpoint, {
        credentials: 'include',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
      });

      if (response.status === 401 || response.status === 403) {
        return {
          status: 'not_authenticated',
          error: {
            code: 'not_authenticated',
            message: `ChatGPT session returned HTTP ${response.status}`,
          },
        };
      }

      if (!response.ok) {
        return {
          status: 'provider_unavailable',
          error: {
            code: `session_http_${response.status}`,
            message: `ChatGPT session returned HTTP ${response.status}`,
          },
        };
      }

      const session = await response.json();
      const accessToken = session?.accessToken || session?.access_token;
      if (!accessToken) {
        return {
          status: 'not_authenticated',
          error: {
            code: 'missing_access_token',
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
          code: 'session_request_failed',
          message: `${sessionEndpoint}: ${error.message}`,
        },
      };
    }
  }
}
