import { WorkoutPauseInterval } from '../../shared/types/workout';

/**
 * Computes true active workout duration from start timestamp, pause intervals, and end/reference timestamp.
 * Never relies solely on a JS interval counter so refreshing or closing the browser stays accurate.
 */
export function computeActualDurationSeconds(params: {
  startedAtISO: string;
  endedAtISO?: string;
  pauseIntervals: WorkoutPauseInterval[];
  nowMs?: number;
}): {
  activeSeconds: number;
  activeMinutes: number;
  isCurrentlyPaused: boolean;
} {
  const startMs = new Date(params.startedAtISO).getTime();
  const endMs = params.endedAtISO
    ? new Date(params.endedAtISO).getTime()
    : params.nowMs ?? Date.now();

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return { activeSeconds: 0, activeMinutes: 0, isCurrentlyPaused: false };
  }

  let pausedMs = 0;
  let isCurrentlyPaused = false;

  for (const interval of params.pauseIntervals) {
    const pStart = new Date(interval.startedAtISO).getTime();
    const pEnd = interval.resumedAtISO
      ? new Date(interval.resumedAtISO).getTime()
      : endMs;
    if (!interval.resumedAtISO && !params.endedAtISO) {
      isCurrentlyPaused = true;
    }
    if (Number.isFinite(pStart) && Number.isFinite(pEnd) && pEnd > pStart) {
      pausedMs += Math.min(pEnd, endMs) - Math.max(pStart, startMs);
    }
  }

  const activeMs = Math.max(0, endMs - startMs - pausedMs);
  const activeSeconds = Math.floor(activeMs / 1000);
  const activeMinutes = Math.max(1, Math.round(activeSeconds / 60));

  return {
    activeSeconds,
    activeMinutes,
    isCurrentlyPaused,
  };
}

export function formatDurationClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
