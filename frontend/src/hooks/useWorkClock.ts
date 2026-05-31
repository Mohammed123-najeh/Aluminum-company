import { useCallback, useEffect, useRef, useState } from 'react';
import { attendanceApi } from '../services/api';
import { useApp } from '../contexts/AppContext';

const IDLE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes of no input → idle
const HEARTBEAT_INTERVAL_MS = 30 * 1000;   // 30s between pings while active
const REFRESH_TODAY_MS = 60 * 1000;        // pull /attendance/today every minute for accuracy

/** Listened-for input events that prove the user is at the keyboard/mouse. */
const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'mousemove',
  'mousedown',
  'keydown',
  'wheel',
  'touchstart',
  'scroll',
  'focus',
];

export type WorkClock = {
  /** Minutes worked today (closed sessions + currently-open session, idle-trimmed). */
  minutesToday: number;
  /** True when the user is currently active (last input within IDLE_THRESHOLD_MS). */
  isActive: boolean;
  /** True while a heartbeat or today-poll request is in flight. */
  loading: boolean;
  /** Force a refresh of `minutesToday` from the server. */
  refresh: () => Promise<void>;
};

/**
 * Activity-driven attendance tracker.
 *
 * - Watches mouse/keyboard/touch/focus events to know whether the user is active.
 * - Pings POST /attendance/heartbeat every 30s while active. The backend stitches
 *   consecutive heartbeats into a single attendance session.
 * - When the user goes idle (10 min of no input), stops pinging. The backend
 *   closes the session at the last heartbeat, so idle time doesn't accumulate.
 * - Exposes minutesWorked today for the top-bar timer.
 *
 * Intentionally a no-op when there's no auth token (the user is on the login
 * screen) — clocking only makes sense once the user is signed in.
 */
export function useWorkClock(): WorkClock {
  const { token } = useApp();
  const [minutesToday, setMinutesToday] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);

  // Refs for the latest activity timestamp and timers — refs avoid re-renders
  // on every mouse move (which would be catastrophic for performance).
  const lastActivityRef = useRef<number>(Date.now());
  const heartbeatTimerRef = useRef<number | null>(null);
  const refreshTimerRef = useRef<number | null>(null);
  const idleCheckTimerRef = useRef<number | null>(null);

  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    // Don't setState on every event — the idleCheckTimer flips isActive when needed.
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const data = await attendanceApi.today(token);
      setMinutesToday(data.minutesWorked);
    } catch {
      // Swallow — the timer keeps showing the last known value.
    }
  }, [token]);

  const sendHeartbeat = useCallback(async () => {
    if (!token) return;
    const idle = Date.now() - lastActivityRef.current > IDLE_THRESHOLD_MS;
    if (idle) return;
    setLoading(true);
    try {
      await attendanceApi.heartbeat(token);
      // Re-pull today's total so the displayed counter rolls forward in step.
      await refresh();
    } catch {
      // Network blip — try again next interval.
    } finally {
      setLoading(false);
    }
  }, [token, refresh]);

  // Wire up DOM activity listeners (passive for perf; we never preventDefault).
  useEffect(() => {
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, markActivity, { passive: true }));
    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, markActivity));
    };
  }, [markActivity]);

  // Heartbeat loop — only runs while we have a token. Also fires immediately
  // on mount so a fresh login starts a session right away.
  useEffect(() => {
    if (!token) return;
    void sendHeartbeat();
    heartbeatTimerRef.current = window.setInterval(() => void sendHeartbeat(), HEARTBEAT_INTERVAL_MS);
    return () => {
      if (heartbeatTimerRef.current !== null) {
        window.clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };
  }, [token, sendHeartbeat]);

  // Independent refresh loop so the counter stays current even when the user is
  // idle (handy for showing "you worked 4h 12m today" on a stale tab).
  useEffect(() => {
    if (!token) return;
    void refresh();
    refreshTimerRef.current = window.setInterval(() => void refresh(), REFRESH_TODAY_MS);
    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [token, refresh]);

  // Idle detector — checks once per second, flips `isActive` when the gap since
  // last activity crosses the threshold (either direction). Cheap and reliable.
  useEffect(() => {
    idleCheckTimerRef.current = window.setInterval(() => {
      const idleNow = Date.now() - lastActivityRef.current > IDLE_THRESHOLD_MS;
      setIsActive((prev) => (prev === !idleNow ? prev : !idleNow));
    }, 1000);
    return () => {
      if (idleCheckTimerRef.current !== null) {
        window.clearInterval(idleCheckTimerRef.current);
        idleCheckTimerRef.current = null;
      }
    };
  }, []);

  return { minutesToday, isActive, loading, refresh };
}
