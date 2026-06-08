import { useCallback, useEffect, useRef, useState } from 'react';
import { attendanceApi } from '../services/api';
import { useApp } from '../contexts/AppContext';

const HEARTBEAT_INTERVAL_MS = 30 * 1000;
const REFRESH_TODAY_MS = 60 * 1000;
const DEFAULT_WORKDAY_LIMIT_MINUTES = 8 * 60;

export type WorkClock = {
  minutesToday: number;
  workdayLimitMinutes: number;
  sessionStartedAt: string | null;
  isWorking: boolean;
  dailyLimitReached: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  startWork: () => Promise<void>;
};

export function useWorkClock(): WorkClock {
  const { token } = useApp();
  const [minutesToday, setMinutesToday] = useState(0);
  const [workdayLimitMinutes, setWorkdayLimitMinutes] = useState(DEFAULT_WORKDAY_LIMIT_MINUTES);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [loading, setLoading] = useState(false);
  const startedByThisPageRef = useRef(false);
  const heartbeatTimerRef = useRef<number | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const data = await attendanceApi.today(token);
      const limit = data.workdayLimitMinutes ?? DEFAULT_WORKDAY_LIMIT_MINUTES;
      const cappedMinutes = Math.min(data.minutesWorked, limit);
      const canKeepRunning = Boolean(data.openSession) && startedByThisPageRef.current && cappedMinutes < limit;

      setWorkdayLimitMinutes(limit);
      setMinutesToday(cappedMinutes);
      setIsWorking(canKeepRunning);
      setSessionStartedAt(canKeepRunning ? data.openSession?.startedAt ?? null : null);
      if (!canKeepRunning && (!data.openSession || cappedMinutes >= limit)) {
        startedByThisPageRef.current = false;
      }
    } catch {
      // Keep the previous display if the network blips.
    }
  }, [token]);

  const sendHeartbeat = useCallback(async (intent: 'start' | 'heartbeat' = 'heartbeat') => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await attendanceApi.heartbeat(token, { intent });
      if (data.active === false) {
        startedByThisPageRef.current = false;
        setIsWorking(false);
      }
      await refresh();
    } catch {
      // Try again on the next tick.
    } finally {
      setLoading(false);
    }
  }, [token, refresh]);

  const startWork = useCallback(async () => {
    if (minutesToday >= workdayLimitMinutes) return;
    startedByThisPageRef.current = true;
    await sendHeartbeat('start');
  }, [minutesToday, sendHeartbeat, workdayLimitMinutes]);

  useEffect(() => {
    if (!token || !isWorking) return;
    heartbeatTimerRef.current = window.setInterval(() => void sendHeartbeat(), HEARTBEAT_INTERVAL_MS);
    return () => {
      if (heartbeatTimerRef.current !== null) {
        window.clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };
  }, [token, isWorking, sendHeartbeat]);

  useEffect(() => {
    if (!token) return;
    void refresh();
    // The "today" total is display-only — pause its poll while the tab is hidden
    // (the heartbeat above keeps the session alive regardless), and refresh once
    // on return so the badge is correct the instant the user looks again.
    refreshTimerRef.current = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, REFRESH_TODAY_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [token, refresh]);

  useEffect(() => {
    if (token) return;
    startedByThisPageRef.current = false;
    setMinutesToday(0);
    setWorkdayLimitMinutes(DEFAULT_WORKDAY_LIMIT_MINUTES);
    setSessionStartedAt(null);
    setIsWorking(false);
  }, [token]);

  return {
    minutesToday,
    workdayLimitMinutes,
    sessionStartedAt,
    isWorking,
    dailyLimitReached: minutesToday >= workdayLimitMinutes,
    loading,
    refresh,
    startWork,
  };
}
