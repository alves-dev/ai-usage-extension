import { scriptingExecuteScript, tabsCreate, tabsGet, tabsRemove } from '../utils/chrome-promises.js';

const DEFAULT_TIMEOUT_MS = 20_000;

export async function runPageProbe(url, scraperFunction) {
  let tab;
  try {
    tab = await tabsCreate({ url, active: false });
    await waitForTabComplete(tab.id, DEFAULT_TIMEOUT_MS);

    let loadedTab = await tabsGet(tab.id);
    if (looksLikeAuthenticationUrl(loadedTab.url)) {
      return {
        status: 'not_authenticated',
        error: {
          code: 'not_authenticated',
          message: 'Provider redirected to an authentication page',
        },
      };
    }

    let results;
    try {
      results = await scriptingExecuteScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: scraperFunction,
      });
    } catch (error) {
      loadedTab = await tabsGet(tab.id);
      if (looksLikeAuthenticationUrl(loadedTab.url)) {
        return {
          status: 'not_authenticated',
          error: {
            code: 'not_authenticated',
            message: 'Provider redirected to an authentication page',
          },
        };
      }
      return {
        status: 'provider_unavailable',
        error: {
          code: 'page_probe_failed',
          message: error.message,
        },
      };
    }

    return results?.[0]?.result || null;
  } finally {
    if (tab?.id !== undefined) {
      try {
        await tabsRemove(tab.id);
      } catch (_error) {
        // The user may have closed the tab before the probe finished.
      }
    }
  }
}

async function waitForTabComplete(tabId, timeoutMs) {
  const current = await tabsGet(tabId);
  if (current.status === 'complete') {
    return;
  }

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Timed out waiting for provider page to load'));
    }, timeoutMs);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId !== tabId || changeInfo.status !== 'complete') {
        return;
      }
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

function looksLikeAuthenticationUrl(url) {
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    const haystack = `${parsed.hostname}${parsed.pathname}`.toLowerCase();
    return /auth|oauth|login|signin|sign-in/.test(haystack);
  } catch (_error) {
    return false;
  }
}
