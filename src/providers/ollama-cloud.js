const OLLAMA_SETTINGS_URL = 'https://ollama.com/settings';

export async function collectOllamaCloud(_settings, context) {
  const directResult = await fetchOllamaSettingsUsage();
  if (directResult.status === 'ok' || !context?.runPageProbe) {
    return directResult;
  }

  const probeResult = await context.runPageProbe(OLLAMA_SETTINGS_URL, scrapeOllamaSettingsPage);
  return probeResult || directResult;
}

async function fetchOllamaSettingsUsage() {
  try {
    const response = await fetch(OLLAMA_SETTINGS_URL, {
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'text/html',
      },
    });

    if (response.status === 401 || response.status === 403) {
      return unauthenticated(`Ollama settings returned HTTP ${response.status}`);
    }

    if (response.status === 429) {
      return {
        status: 'rate_limited',
        error: {
          code: 'rate_limited',
          message: 'Ollama settings returned HTTP 429',
        },
      };
    }

    if (!response.ok) {
      return {
        status: 'provider_unavailable',
        error: {
          code: `http_${response.status}`,
          message: `Ollama settings returned HTTP ${response.status}`,
        },
      };
    }

    const html = await response.text();
    if (looksLikeLoginPage(html)) {
      return unauthenticated('Ollama settings page requires login');
    }

    return buildResultFromParsedUsage(parseOllamaSettingsUsageFromHtml(html), 'settings_html_fetch');
  } catch (error) {
    return {
      status: 'provider_unavailable',
      error: {
        code: 'request_failed',
        message: `${OLLAMA_SETTINGS_URL}: ${error.message}`,
      },
    };
  }
}

function scrapeOllamaSettingsPage() {
  const text = document.body?.innerText || '';
  const lower = text.toLowerCase();

  if (location.pathname.includes('/signin') || /\b(sign in|log in|login)\b/.test(lower) && !/session usage|weekly usage/.test(lower)) {
    return {
      status: 'not_authenticated',
      error: {
        code: 'not_authenticated',
        message: 'Ollama settings page requires login',
      },
    };
  }

  const usage = {
    session: readUsageFromDocument('Session usage'),
    weekly: readUsageFromDocument('Weekly usage'),
  };

  return buildResultFromParsedUsage(usage);

  function readUsageFromDocument(label) {
    const track = Array.from(document.querySelectorAll('[data-usage-track]'))
      .find((element) => (element.getAttribute('aria-label') || '').toLowerCase().startsWith(label.toLowerCase()));
    if (!track) {
      return null;
    }

    const root = track.closest('div[data-usage-meter]')?.parentElement || track.parentElement;
    const ariaLabel = track.getAttribute('aria-label') || '';
    const resetElement = root?.querySelector('[data-time]');

    return {
      used_percent: extractPercent(ariaLabel),
      reset_at: normalizeDate(resetElement?.getAttribute('data-time')),
    };
  }

  function extractPercent(value) {
    const match = /(\d+(?:[,.]\d+)?)\s*%\s*used/i.exec(String(value || ''));
    if (!match) {
      return undefined;
    }
    return toNumber(match[1]);
  }

  function toNumber(value) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const parsed = Number(String(value || '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  function normalizeDate(value) {
    if (!value) {
      return undefined;
    }

    const timestamp = Date.parse(String(value));
    return Number.isNaN(timestamp) ? undefined : new Date(timestamp).toISOString();
  }

  function buildResultFromParsedUsage(parsedUsage) {
    const sessionUsage = normalizeUsageWindow(parsedUsage?.session);
    const weeklyUsage = normalizeUsageWindow(parsedUsage?.weekly);

    if (!sessionUsage || !weeklyUsage) {
      return {
        status: 'parse_error',
        error: {
          code: 'usage_not_found',
          message: 'Ollama settings page did not include both session and weekly usage windows',
        },
      };
    }

    return {
      status: 'ok',
      payload: {
        account_data: {},
        plan_data: {},
        provider_data: {
          collection_method: 'settings_page_probe',
          session_usage: sessionUsage,
          weekly_usage: weeklyUsage,
        },
      },
    };
  }

  function normalizeUsageWindow(windowUsage) {
    const usedPercent = toNumber(windowUsage?.used_percent);
    const resetAt = normalizeDate(windowUsage?.reset_at);

    if (!Number.isFinite(usedPercent) || !resetAt) {
      return null;
    }

    return {
      used_percent: usedPercent,
      reset_at: resetAt,
    };
  }
}

export function parseOllamaSettingsUsageFromHtml(html) {
  return {
    session: parseUsageBlock(html, 'Session usage'),
    weekly: parseUsageBlock(html, 'Weekly usage'),
  };
}

function parseUsageBlock(html, label) {
  const blockStart = html.search(new RegExp(escapeRegExp(label), 'i'));
  if (blockStart === -1) {
    return null;
  }

  const block = html.slice(blockStart, blockStart + 4_000);
  return {
    used_percent: findUsedPercent(block, label),
    reset_at: findResetAt(block),
  };
}

function findUsedPercent(block, label) {
  const ariaPattern = new RegExp(`aria-label=["']${escapeRegExp(label)}\\s+(\\d+(?:[,.]\\d+)?)%\\s+used["']`, 'i');
  const ariaMatch = ariaPattern.exec(block);
  if (ariaMatch) {
    return toNumber(ariaMatch[1]);
  }

  const textMatch = /(\d+(?:[,.]\d+)?)\s*%\s*used/i.exec(block);
  return toNumber(textMatch?.[1]);
}

function findResetAt(block) {
  const dataTimeMatch = /data-time=["']([^"']+)["']/i.exec(block);
  return normalizeDate(dataTimeMatch?.[1]);
}

function buildResultFromParsedUsage(parsedUsage, collectionMethod) {
  const sessionUsage = normalizeUsageWindow(parsedUsage?.session);
  const weeklyUsage = normalizeUsageWindow(parsedUsage?.weekly);

  if (!sessionUsage || !weeklyUsage) {
    return {
      status: 'parse_error',
      error: {
        code: 'usage_not_found',
        message: 'Ollama settings page did not include both session and weekly usage windows',
      },
    };
  }

  return {
    status: 'ok',
    payload: {
      account_data: {},
      plan_data: {},
      provider_data: {
        collection_method: collectionMethod,
        session_usage: sessionUsage,
        weekly_usage: weeklyUsage,
      },
    },
  };
}

function normalizeUsageWindow(windowUsage) {
  const usedPercent = toNumber(windowUsage?.used_percent);
  const resetAt = normalizeDate(windowUsage?.reset_at);

  if (!Number.isFinite(usedPercent) || !resetAt) {
    return null;
  }

  return {
    used_percent: usedPercent,
    reset_at: resetAt,
  };
}

function looksLikeLoginPage(html) {
  const lower = String(html || '').toLowerCase();
  return /sign in|log in|login|continue with|oauth/.test(lower) && !/session usage|weekly usage/.test(lower);
}

function unauthenticated(message) {
  return {
    status: 'not_authenticated',
    error: {
      code: 'not_authenticated',
      message,
    },
  };
}

function normalizeDate(value) {
  if (!value) {
    return undefined;
  }

  const timestamp = Date.parse(String(value));
  return Number.isNaN(timestamp) ? undefined : new Date(timestamp).toISOString();
}

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(String(value || '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
