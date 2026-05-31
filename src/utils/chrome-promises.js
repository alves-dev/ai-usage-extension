export function chromeCall(target, method, ...args) {
  return new Promise((resolve, reject) => {
    target[method](...args, (result) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(result);
    });
  });
}

export function storageGet(keys) {
  return chromeCall(chrome.storage.local, 'get', keys);
}

export function storageSet(items) {
  return chromeCall(chrome.storage.local, 'set', items);
}

export function alarmsGetAll() {
  return chromeCall(chrome.alarms, 'getAll');
}

export function alarmsClear(name) {
  return chromeCall(chrome.alarms, 'clear', name);
}

export function tabsCreate(properties) {
  return chromeCall(chrome.tabs, 'create', properties);
}

export function tabsGet(tabId) {
  return chromeCall(chrome.tabs, 'get', tabId);
}

export function tabsRemove(tabId) {
  return chromeCall(chrome.tabs, 'remove', tabId);
}

export function scriptingExecuteScript(details) {
  return chromeCall(chrome.scripting, 'executeScript', details);
}

export function permissionsContains(permissions) {
  return chromeCall(chrome.permissions, 'contains', permissions);
}

export function permissionsRequest(permissions) {
  return chromeCall(chrome.permissions, 'request', permissions);
}

export function runtimeSendMessage(message) {
  return chromeCall(chrome.runtime, 'sendMessage', message);
}
