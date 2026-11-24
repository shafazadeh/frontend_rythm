import {
  WorkoutActivityLog,
  WorkoutProgressSummary,
  WorkoutSession,
  WorkoutSessionStatus,
} from '../../shared/types/workout';
import {
  formatJalaliDayMonth,
  getJalaliNumericParts,
  getSaturdayToFridayWeekRange,
} from './jalaliCalendar';

export function computeWorkoutSummaryForSessions(
  sessions: WorkoutSession[],
  logs: WorkoutActivityLog[]
): WorkoutProgressSummary {
  const logsBySessionId = new Map(logs.map((l) => [l.sessionId, l]));

  let plannedCount = 0;
  let completedCount = 0;
  let missedCount = 0;
  let cancelledCount = 0;
  let inProgressCount = 0;
  let totalDurationMinutes = 0;
  let totalEstimatedCalories = 0;

  for (const s of sessions) {
    if (s.status === WorkoutSessionStatus.PLANNED) plannedCount += 1;
    else if (s.status === WorkoutSessionStatus.IN_PROGRESS) inProgressCount += 1;
    else if (s.status === WorkoutSessionStatus.COMPLETED) completedCount += 1;
    else if (s.status === WorkoutSessionStatus.MISSED) missedCount += 1;
    else if (s.status === WorkoutSessionStatus.CANCELLED) cancelledCount += 1;

    if (s.status === WorkoutSessionStatus.COMPLETED) {
      const log = logsBySessionId.get(s.id);
      totalDurationMinutes += log ? log.actualDurationMinutes : s.estimatedDurationMinutes;
      totalEstimatedCalories += log?.estimatedCalories ?? 0;
    }
  }

  const actionableDenominator = completedCount + missedCount + plannedCount + inProgressCount;
  const adherencePercent =
    actionableDenominator > 0
      ? Math.round((completedCount / actionableDenominator) * 100)
      : 0;

  return {
    plannedCount,
    completedCount,
    missedCount,
    cancelledCount,
    inProgressCount,
    totalDurationMinutes,
    totalEstimatedCalories,
    adherencePercent,
  };
}

export interface WeeklyWorkoutChartPoint {
  weekKey: string;
  weekLabel: string;
  totalMinutes: number;
  totalCalories: number;
  completedCount: number;
  adherencePercent: number;
}

export function buildWeeklyProgressSeries(
  sessions: WorkoutSession[],
  logs: WorkoutActivityLog[]
): WeeklyWorkoutChartPoint[] {
  const groups = new Map<string, WorkoutSession[]>();

  for (const s of sessions) {
    const range = getSaturdayToFridayWeekRange(s.dateISO);
    const list = groups.get(range.weekStartISO) ?? [];
    list.push(s);
    groups.set(range.weekStartISO, list);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStartISO, weekSessions]) => {
      const summary = computeWorkoutSummaryForSessions(weekSessions, logs);
      return {
        weekKey: weekStartISO,
        weekLabel: formatJalaliDayMonth(weekStartISO),
        totalMinutes: summary.totalDurationMinutes,
        totalCalories: summary.totalEstimatedCalories,
        completedCount: summary.completedCount,
        adherencePercent: summary.adherencePercent,
      };
    });
}

export interface MonthlyWorkoutChartPoint {
  monthKey: string;
  monthLabel: string;
  completedCount: number;
  totalMinutes: number;
}

export function buildMonthlyCompletedSeries(
  logs: WorkoutActivityLog[]
): MonthlyWorkoutChartPoint[] {
  const groups = new Map<string, MonthlyWorkoutChartPoint>();

  for (const log of logs) {
    if (log.status !== 'COMPLETED' && log.status !== 'PARTIAL') continue;
    const p = getJalaliNumericParts(log.dateISO);
    const key = `${p.year}-${String(p.month).padStart(2, '0')}`;
    const existing = groups.get(key) ?? {
      monthKey: key,
      monthLabel: `${p.monthName} ${p.year}`,
      completedCount: 0,
      totalMinutes: 0,
    };
    existing.completedCount += 1;
    existing.totalMinutes += log.actualDurationMinutes;
    groups.set(key, existing);
  }

  return Array.from(groups.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

export interface StrengthProgressionPoint {
  dateISO: string;
  dateLabel: string;
  maxWeightKg: number;
  maxReps: number;
  totalVolume: number;
}

export function buildExerciseStrengthTrend(
  exerciseId: string,
  logs: WorkoutActivityLog[]
): StrengthProgressionPoint[] {
  const points: StrengthProgressionPoint[] = [];

  const sortedLogs = [...logs]
    .filter((l) => l.status === 'COMPLETED' || l.status === 'PARTIAL')
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO));

  for (const log of sortedLogs) {
    for (const ex of log.exercisesSnapshot) {
      if (ex.exerciseId !== exerciseId) continue;
      const completedSets = ex.sets.filter((s) => s.isCompleted);
      if (completedSets.length === 0) continue;

      let maxWeightKg = 0;
      let maxReps = 0;
      let totalVolume = 0;

      for (const s of completedSets) {
        const w = s.actualWeightKg ?? s.targetWeightKg ?? 0;
        const r = s.actualReps ?? s.targetReps ?? 0;
        if (w > maxWeightKg) maxWeightKg = w;
        if (r > maxReps) maxReps = r;
        totalVolume += (w > 0 ? w : 1) * r;
      }

      points.push({
        dateISO: log.dateISO,
        dateLabel: formatJalaliDayMonth(log.dateISO),
        maxWeightKg,
        maxReps,
        totalVolume: Math.round(totalVolume),
      });
    }
  }

  return points;
}
