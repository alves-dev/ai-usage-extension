import { ALARM_PREFIX, PROVIDER_ORDER } from '../utils/constants.js';
import { alarmsClear, alarmsGetAll } from '../utils/chrome-promises.js';

export async function syncProviderAlarms(config, options = {}) {
  const { forceReschedule = false } = options;
  const desiredAlarmNames = new Set();
  const existingAlarms = await alarmsGetAll();
  const existingByName = new Map(existingAlarms.map((alarm) => [alarm.name, alarm]));

  for (const providerId of PROVIDER_ORDER) {
    const providerConfig = config.providers[providerId];
    const alarmName = alarmNameForProvider(providerId);

    if (!providerConfig?.enabled) {
      await alarmsClear(alarmName);
      continue;
    }

    desiredAlarmNames.add(alarmName);
    const periodInMinutes = Math.max(1, Number(providerConfig.intervalMinutes) || 30);
    const existingAlarm = existingByName.get(alarmName);

    if (!forceReschedule && existingAlarm?.periodInMinutes === periodInMinutes) {
      continue;
    }

    chrome.alarms.create(alarmName, {
      delayInMinutes: periodInMinutes,
      periodInMinutes,
    });
  }

  await Promise.all(
    existingAlarms
      .filter((alarm) => alarm.name.startsWith(ALARM_PREFIX) && !desiredAlarmNames.has(alarm.name))
      .map((alarm) => alarmsClear(alarm.name)),
  );
}

export function alarmNameForProvider(providerId) {
  return `${ALARM_PREFIX}${providerId}`;
}

export function providerIdFromAlarm(alarmName) {
  if (!alarmName.startsWith(ALARM_PREFIX)) {
    return null;
  }
  return alarmName.slice(ALARM_PREFIX.length);
}
