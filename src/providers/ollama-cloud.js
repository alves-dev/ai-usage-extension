const OLLAMA_SETTINGS_URL = 'https://ollama.com/settings';

export async function collectOllamaCloud(_settings, context) {
  const directResult = await fetchOllamaSettingsUsage();
  if (directResult.status === 'ok' || !context?.runPageProbe) {
    return directResult;
  }

  const probeResult = await context.runPageProbe(OLLAMA_SETTINGS_URL, scrapeOllamaSettingsPage);
  if (probeResult?.status === 'ok' && probeResult.html) {
    return buildResultFromParsedUsage(parseOllamaSettingsUsageFromHtml(probeResult.html));
  }
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

    return buildResultFromParsedUsage(parseOllamaSettingsUsageFromHtml(html));
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

  const page = document.documentElement?.cloneNode(true);
  if (!page) {
    return {
      status: 'parse_error',
      error: {
        code: 'page_html_unavailable',
        message: 'Ollama settings page HTML was unavailable',
      },
    };
  }

  const sourceControls = Array.from(document.querySelectorAll('input, textarea, select'));
  const serializedControls = Array.from(page.querySelectorAll('input, textarea, select'));
  sourceControls.forEach((control, index) => {
    const serializedControl = serializedControls[index];
    if (!serializedControl || !('value' in control)) {
      return;
    }

    serializedControl.setAttribute('value', control.value);
    if (serializedControl.tagName === 'TEXTAREA') {
      serializedControl.textContent = control.value;
    }
  });

  return {
    status: 'ok',
    html: page.outerHTML,
  };
}

export function parseOllamaSettingsUsageFromHtml(html) {
  const text = htmlToText(html);
  return {
    account: parseOllamaAccountFromHtml(html, text),
    plan: parseOllamaPlanFromHtml(html, text),
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
  const ariaPattern = new RegExp(String.raw`aria-label=["']${escapeRegExp(label)}\s+(\d+(?:[,.]\d+)?)%\s+used["']`, 'i');
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

function buildResultFromParsedUsage(parsedUsage) {
  const sessionUsage = normalizeUsageWindow(parsedUsage?.session);
  const weeklyUsage = normalizeUsageWindow(parsedUsage?.weekly);
  const accountData = normalizeAccountData(parsedUsage?.account);
  const planData = normalizePlanData(parsedUsage?.plan);

  if (!sessionUsage || !weeklyUsage) {
    return {
      status: 'parse_error',
      error: {
        code: 'usage_not_found',
        message: 'Ollama settings page did not include both session and weekly usage windows',
      },
    };
  }

  const missingFields = [];
  if (!accountData.username) {
    missingFields.push('account_data.username');
  }
  if (!accountData.email) {
    missingFields.push('account_data.email');
  }
  if (!planData.type) {
    missingFields.push('plan_data.type');
  }

  if (missingFields.length) {
    return {
      status: 'parse_error',
      error: {
        code: 'profile_fields_not_found',
        message: `Ollama settings page did not include ${missingFields.join(', ')}`,
      },
    };
  }

  return {
    status: 'ok',
    payload: {
      account_data: accountData,
      plan_data: planData,
      provider_data: {
        session_usage: sessionUsage,
        weekly_usage: weeklyUsage,
      },
    },
  };
}

function parseOllamaAccountFromHtml(html, text) {
  const decodedHtml = decodeHtmlEntities(html);
  return {
    username:
      findInputValue(html, ['username', 'user name', 'handle']) ||
      findJsonValue(html, ['username', 'handle']) ||
      findOllamaUsernameFromHtml(decodedHtml) ||
      findValueNearLabel(text, ['username', 'user name', 'handle']),
    email:
      findInputValue(html, ['email']) ||
      findJsonValue(html, ['email']) ||
      findEmail(text),
  };
}

function findOllamaUsernameFromHtml(html) {
  const decoded = decodeHtmlEntities(html);
  const anchorPattern = /<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorPattern.exec(decoded))) {
    const href = cleanTextValue(match[2]);
    const text = cleanTextValue(stripHtml(match[3]));
    const pathMatch = /^\/([a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?)$/i.exec(href);

    if (isReservedOllamaPath(pathMatch?.[1])) {
      continue;
    }

    const username = normalizeUsername(text || pathMatch?.[1]);
    const normalizedPathUsername = pathMatch?.[1]?.toLowerCase();

    if (normalizedPathUsername && username?.toLowerCase() === normalizedPathUsername) {
      return username;
    }
  }

  return undefined;
}

function isReservedOllamaPath(value) {
  return /^(api|blog|docs|download|library|pricing|search|settings|signin|signout)$/i.test(value || '');
}

function parseOllamaPlanFromHtml(html, text) {
  return {
    type:
      findInputValue(html, ['plan', 'current plan', 'subscription']) ||
      findJsonValue(html, ['plan', 'plan_type', 'subscription', 'subscription_plan']) ||
      findValueNearLabel(text, ['plan', 'current plan', 'subscription']) ||
      findPlan(text),
  };
}

function normalizeAccountData(account) {
  return pruneEmpty({
    username: normalizeUsername(account?.username),
    email: findEmail(account?.email),
  });
}

function normalizePlanData(plan) {
  return pruneEmpty({
    type: normalizePlanType(plan?.type),
  });
}

function normalizeUsername(value) {
  const cleaned = cleanTextValue(value).replace(/^@/, '');
  if (!cleaned || cleaned.includes('@')) {
    return undefined;
  }

  const match = /[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?/i.exec(cleaned);
  const username = match?.[0];
  return /^(change|edit|save|update|delete|settings|profile|account)$/i.test(username || '') ? undefined : username;
}

function normalizePlanType(value) {
  const match = /\b(free|pro|team|enterprise)\b/i.exec(cleanTextValue(value));
  return match?.[1]?.toLowerCase();
}

function findInputValue(html, labels) {
  const tags = String(html || '').match(/<(?:input|textarea|select)\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const decodedTag = decodeHtmlEntities(tag);
    const metadata = [
      getAttributeFromTag(decodedTag, 'name'),
      getAttributeFromTag(decodedTag, 'id'),
      getAttributeFromTag(decodedTag, 'autocomplete'),
      getAttributeFromTag(decodedTag, 'placeholder'),
      getAttributeFromTag(decodedTag, 'aria-label'),
    ].join(' ');

    if (!labels.some((label) => normalizeLoose(metadata).includes(normalizeLoose(label)))) {
      continue;
    }

    const value = getAttributeFromTag(decodedTag, 'value');
    if (value) {
      return value;
    }
  }

  return undefined;
}

function findJsonValue(html, keys) {
  const decoded = decodeHtmlEntities(html);
  for (const key of keys) {
    const pattern = new RegExp(String.raw`["']${escapeRegExp(key)}["']\s*:\s*["']([^"']+)["']`, 'i');
    const match = pattern.exec(decoded);
    if (match?.[1]) {
      return match[1];
    }
  }

  return undefined;
}

function findValueNearLabel(value, labels) {
  const lines = String(value || '')
    .split(/\n+/)
    .map((line) => cleanTextValue(line))
    .filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const label of labels) {
      const pattern = new RegExp(String.raw`^${escapeRegExp(label)}\s*:?\s*(.*)$`, 'i');
      const match = pattern.exec(line);
      if (!match) {
        continue;
      }

      if (match[1] && !isGenericLabel(match[1])) {
        return match[1];
      }

      const candidate = findValueAfterLabel(lines, index);
      if (candidate) {
        return candidate;
      }
    }
  }

  return undefined;
}

function findValueAfterLabel(lines, index) {
  for (let offset = 1; offset <= 3; offset += 1) {
    const candidate = lines[index + offset];
    if (candidate && !isGenericLabel(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function findEmail(value) {
  const match = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.exec(String(value || ''));
  return match?.[0];
}

function findPlan(value) {
  const labeledPlan = findValueNearLabel(value, ['plan', 'current plan', 'subscription']);
  return labeledPlan || /\b(free|pro|team|enterprise)\b/i.exec(String(value || ''))?.[1];
}

function htmlToText(html) {
  return decodeHtmlEntities(String(html || '')
    .replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '\n')
    .replaceAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '\n')
    .replaceAll(/<[^>]+>/g, '\n'))
    .replaceAll(/\n{2,}/g, '\n')
    .trim();
}

function stripHtml(value) {
  return String(value || '').replaceAll(/<[^>]+>/g, ' ');
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replaceAll('&quot;', '"')
    .replaceAll('&#34;', '"')
    .replaceAll(/&#x22;/gi, '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&#39;', "'")
    .replaceAll(/&#x27;/gi, "'")
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replaceAll(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function getAttributeFromTag(tag, name) {
  const pattern = new RegExp(String.raw`\b${escapeRegExp(name)}\s*=\s*(["'])(.*?)\1`, 'i');
  return pattern.exec(tag)?.[2];
}

function cleanTextValue(value) {
  return String(value || '').replaceAll(/\s+/g, ' ').trim();
}

function isGenericLabel(value) {
  return /^(username|user name|handle|email|plan|current plan|subscription|session usage|weekly usage)$/i.test(cleanTextValue(value));
}

function normalizeLoose(value) {
  return String(value || '').toLowerCase().replaceAll(/[^a-z0-9]+/g, '');
}

function pruneEmpty(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
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
  return String(value).replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}
