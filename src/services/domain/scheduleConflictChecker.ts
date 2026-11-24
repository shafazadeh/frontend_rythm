import { WorkoutSession, WorkoutSessionStatus } from '../../shared/types/workout';

export interface ScheduledTimeSlot {
  id: string;
  title: string;
  dateISO: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  sourceModule: 'WORKOUT' | 'CALENDAR' | 'TASKS' | 'NUTRITION';
}

export interface TimeConflictResult {
  hasConflict: boolean;
  conflicts: ScheduledTimeSlot[];
  checkedScopeNote: string;
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

export function minutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMinutes)));
  const hh = String(Math.floor(clamped / 60)).padStart(2, '0');
  const mm = String(clamped % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function computeDurationMinutesBetweenTimes(startTime: string, endTime: string): number {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return Math.max(0, end - start);
}

export function doTimeRangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const a0 = timeToMinutes(startA);
  const a1 = timeToMinutes(endA);
  const b0 = timeToMinutes(startB);
  const b1 = timeToMinutes(endB);
  if (a1 <= a0 || b1 <= b0) return false;
  return a0 < b1 && b0 < a1;
}

/**
 * Shared conflict detector extensible for future unified Rhythm Calendar & Tasks.
 */
export function detectTimeRangeConflicts(
  candidate: ScheduledTimeSlot,
  existingSlots: ScheduledTimeSlot[],
  checkedScopeNote = 'فعلاً فقط تداخل بین جلسات برنامه ورزشی بررسی می‌شود.'
): TimeConflictResult {
  const conflicts = existingSlots.filter(
    (slot) =>
      slot.id !== candidate.id &&
      slot.dateISO === candidate.dateISO &&
      doTimeRangesOverlap(candidate.startTime, candidate.endTime, slot.startTime, slot.endTime)
  );

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
    checkedScopeNote,
  };
}

/**
 * Checks conflicts specifically against non-cancelled workout sessions on the same date.
 */
export function checkWorkoutSessionConflicts(
  candidate: {
    id?: string;
    title: string;
    dateISO: string;
    startTime: string;
    endTime: string;
  },
  allWorkoutSessions: WorkoutSession[]
): TimeConflictResult {
  const activeSlots: ScheduledTimeSlot[] = allWorkoutSessions
    .filter((s) => s.status !== WorkoutSessionStatus.CANCELLED)
    .map((s) => ({
      id: s.id,
      title: s.title,
      dateISO: s.dateISO,
      startTime: s.startTime,
      endTime: s.endTime,
      sourceModule: 'WORKOUT',
    }));

  return detectTimeRangeConflicts(
    {
      id: candidate.id ?? '__candidate__',
      title: candidate.title,
      dateISO: candidate.dateISO,
      startTime: candidate.startTime,
      endTime: candidate.endTime,
      sourceModule: 'WORKOUT',
    },
    activeSlots,
    'در نسخه فعلی، فقط تداخل زمانی بین جلسات ورزشی بررسی می‌شود (سایر ماژول‌ها در نسخه بعدی متصل می‌شوند).'
  );
}
