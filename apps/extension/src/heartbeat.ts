export const CONNECTION_ALARM = 'liubai-connection-heartbeat';
/** Alarms wake MV3 workers, unlike setInterval or a background tab's timers. */
export function registerBrowserHeartbeat(send: () => Promise<void>, api: Pick<typeof chrome, 'alarms' | 'runtime'> = chrome) {
  let pending: Promise<void> | undefined;
  const ping = () => {
    if (!pending) pending = send().catch(() => {}).finally(() => { pending = undefined; });
    return pending;
  };
  const initialize = async () => {
    const alarm = await api.alarms.get(CONNECTION_ALARM);
    if (!alarm || alarm.periodInMinutes !== 0.5) {
      await api.alarms.create(CONNECTION_ALARM, { periodInMinutes: 0.5 });
    }
    await ping();
  };
  const start = () => { void initialize().catch(() => {}); };
  api.alarms.onAlarm.addListener(alarm => { if (alarm.name === CONNECTION_ALARM) void ping(); });
  api.runtime.onStartup.addListener(start);
  api.runtime.onInstalled.addListener(start);
  start();
}
