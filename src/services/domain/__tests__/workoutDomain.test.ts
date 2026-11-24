import { describe, expect, it } from 'vitest';
import {
  CardioIntensity,
  DifficultyLevel,
  Exercise,
  ExerciseType,
  WorkoutActivityLog,
  WorkoutSession,
  WorkoutSessionStatus,
} from '../../../shared/types/workout';
import { buildInitialMockData } from '../../mock/mockInitialState';
import { DEFAULT_MET_REFERENCE_TABLE } from '../../mock/mockWorkouts';
import { rhythmNutritionAdapter } from '../../repositories/workoutAdapters';
import { checkWorkoutSessionConflicts } from '../scheduleConflictChecker';
import {
  calculateMetSegmentCalories,
  estimateWorkoutSessionCalories,
} from '../workoutCalorieCalculator';
import {
  buildExerciseStrengthTrend,
  computeWorkoutSummaryForSessions,
} from '../workoutProgressCalculator';
import {
  computeActualDurationSeconds,
  formatDurationClock,
} from '../workoutSessionDuration';

const sampleStrengthExercise: Exercise = {
  id: 'ex_test_squat',
  persianName: 'اسکات',
  type: ExerciseType.STRENGTH,
  categoryId: 'excat_strength',
  targetMuscleGroups: ['چهارسر ران'],
  difficulty: DifficultyLevel.INTERMEDIATE,
  equipment: ['هالتر'],
  instructions: 'اجرای صحیح اسکات',
  safetyNotes: 'حفظ قوس کمر',
  defaultMet: 5.5,
  isActive: true,
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
};

const sampleCardioExercise: Exercise = {
  id: 'ex_test_run',
  persianName: 'دویدن',
  type: ExerciseType.CARDIO,
  categoryId: 'excat_cardio',
  targetMuscleGroups: ['کل بدن'],
  difficulty: DifficultyLevel.INTERMEDIATE,
  equipment: ['تردمیل'],
  instructions: 'دویدن با ریتم یکنواخت',
  safetyNotes: 'گرم کردن مفاصل قبل از شروع',
  defaultMet: 8.0,
  isActive: true,
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
};

describe('Workout MET Calorie Calculator', () => {
  it('computes exact MET formula: MET × 3.5 × Weight(kg) ÷ 200 × Duration(min)', () => {
    // 6 * 3.5 * 80 / 200 * 30 = 252
    expect(calculateMetSegmentCalories(6, 80, 30)).toBe(252);
    // 8 * 3.5 * 70 / 200 * 45 = 441
    expect(calculateMetSegmentCalories(8, 70, 45)).toBe(441);
  });

  it('returns null (no fabricated estimate) when weight or duration is missing', () => {
    const missingWeight = estimateWorkoutSessionCalories({
      weightKg: null,
      totalDurationMinutes: 45,
      exercises: [],
      exercisesById: {},
      metReferenceTable: DEFAULT_MET_REFERENCE_TABLE,
      sessionFallbackType: ExerciseType.STRENGTH,
    });
    expect(missingWeight.totalCalories).toBeNull();
    expect(missingWeight.missingReason).toBeTruthy();

    const missingDuration = estimateWorkoutSessionCalories({
      weightKg: 75,
      totalDurationMinutes: 0,
      exercises: [],
      exercisesById: {},
      metReferenceTable: DEFAULT_MET_REFERENCE_TABLE,
      sessionFallbackType: ExerciseType.STRENGTH,
    });
    expect(missingDuration.totalCalories).toBeNull();
  });

  it('sums multi-segment estimates proportionally to total session duration', () => {
    const exercisesById = {
      [sampleStrengthExercise.id]: sampleStrengthExercise,
      [sampleCardioExercise.id]: sampleCardioExercise,
    };

    const result = estimateWorkoutSessionCalories({
      weightKg: 70,
      totalDurationMinutes: 40,
      exercises: [
        {
          id: 's1',
          exerciseId: sampleStrengthExercise.id,
          order: 1,
          exerciseType: ExerciseType.STRENGTH,
          sets: [
            { id: 'st1', setNumber: 1, targetReps: 10, isCompleted: true },
            { id: 'st2', setNumber: 2, targetReps: 10, isCompleted: true },
          ],
          restSeconds: 60,
          isCompleted: true,
        },
        {
          id: 's2',
          exerciseId: sampleCardioExercise.id,
          order: 2,
          exerciseType: ExerciseType.CARDIO,
          sets: [],
          targetDurationMinutes: 20,
          targetIntensity: CardioIntensity.MODERATE,
          isCompleted: true,
        },
      ],
      exercisesById,
      metReferenceTable: DEFAULT_MET_REFERENCE_TABLE,
      sessionFallbackType: ExerciseType.STRENGTH,
    });

    expect(result.totalCalories).not.toBeNull();
    expect(result.segments).toHaveLength(2);
    expect(result.totalCalories).toBe(
      result.segments.reduce((acc, seg) => acc + seg.calories, 0)
    );
  });
});

describe('Workout Schedule Conflict Checker', () => {
  const existingSessions: WorkoutSession[] = [
    {
      id: 'ws_1',
      title: 'تمرین بالاتنه',
      type: ExerciseType.STRENGTH,
      dateISO: '2026-11-19',
      dayIndex: 5,
      startTime: '17:00',
      endTime: '18:00',
      estimatedDurationMinutes: 60,
      status: WorkoutSessionStatus.PLANNED,
      reminderEnabled: true,
      exercises: [],
      createdAt: '2026-11-14T00:00:00Z',
      updatedAt: '2026-11-14T00:00:00Z',
    },
    {
      id: 'ws_cancelled',
      title: 'تمرین لغوشده',
      type: ExerciseType.CARDIO,
      dateISO: '2026-11-19',
      dayIndex: 5,
      startTime: '19:00',
      endTime: '19:45',
      estimatedDurationMinutes: 45,
      status: WorkoutSessionStatus.CANCELLED,
      reminderEnabled: false,
      exercises: [],
      createdAt: '2026-11-14T00:00:00Z',
      updatedAt: '2026-11-14T00:00:00Z',
    },
  ];

  it('detects overlapping workout sessions on the same date', () => {
    const res = checkWorkoutSessionConflicts(
      {
        title: 'کاردیو عصر',
        dateISO: '2026-11-19',
        startTime: '17:30',
        endTime: '18:15',
      },
      existingSessions
    );
    expect(res.hasConflict).toBe(true);
    expect(res.conflicts).toHaveLength(1);
    expect(res.conflicts[0].id).toBe('ws_1');
  });

  it('ignores non-overlapping slots, self edits, and cancelled sessions', () => {
    const adjacent = checkWorkoutSessionConflicts(
      {
        title: 'کشش بعد تمرین',
        dateISO: '2026-11-19',
        startTime: '18:00',
        endTime: '18:30',
      },
      existingSessions
    );
    expect(adjacent.hasConflict).toBe(false);

    const overCancelled = checkWorkoutSessionConflicts(
      {
        title: 'دویدن عصر',
        dateISO: '2026-11-19',
        startTime: '19:00',
        endTime: '19:30',
      },
      existingSessions
    );
    expect(overCancelled.hasConflict).toBe(false);

    const selfEdit = checkWorkoutSessionConflicts(
      {
        id: 'ws_1',
        title: 'تمرین بالاتنه',
        dateISO: '2026-11-19',
        startTime: '17:00',
        endTime: '18:00',
      },
      existingSessions
    );
    expect(selfEdit.hasConflict).toBe(false);
  });
});

describe('Timestamp-Based Workout Duration & Progress Logic', () => {
  it('subtracts pause intervals accurately from start/end timestamps', () => {
    const dur = computeActualDurationSeconds({
      startedAtISO: '2026-11-19T17:00:00.000Z',
      endedAtISO: '2026-11-19T17:45:00.000Z',
      pauseIntervals: [
        {
          startedAtISO: '2026-11-19T17:15:00.000Z',
          resumedAtISO: '2026-11-19T17:20:00.000Z',
        },
      ],
    });
    expect(dur.activeSeconds).toBe(40 * 60);
    expect(dur.activeMinutes).toBe(40);
    expect(dur.isCurrentlyPaused).toBe(false);
    expect(formatDurationClock(dur.activeSeconds)).toBe('40:00');
  });

  it('computes workout adherence summary and strength progression trend', () => {
    const sessions: WorkoutSession[] = [
      {
        id: 's_done',
        title: 'تمرین ۱',
        type: ExerciseType.STRENGTH,
        dateISO: '2026-11-14',
        dayIndex: 0,
        startTime: '17:00',
        endTime: '17:45',
        estimatedDurationMinutes: 45,
        status: WorkoutSessionStatus.COMPLETED,
        reminderEnabled: true,
        exercises: [],
        createdAt: '2026-11-14T00:00:00Z',
        updatedAt: '2026-11-14T00:00:00Z',
      },
      {
        id: 's_miss',
        title: 'تمرین ۲',
        type: ExerciseType.CARDIO,
        dateISO: '2026-11-16',
        dayIndex: 2,
        startTime: '17:00',
        endTime: '17:30',
        estimatedDurationMinutes: 30,
        status: WorkoutSessionStatus.MISSED,
        reminderEnabled: true,
        exercises: [],
        createdAt: '2026-11-14T00:00:00Z',
        updatedAt: '2026-11-14T00:00:00Z',
      },
    ];

    const logs: WorkoutActivityLog[] = [
      {
        id: 'l_done',
        sessionId: 's_done',
        title: 'تمرین ۱',
        type: ExerciseType.STRENGTH,
        dateISO: '2026-11-14',
        startedAtISO: '2026-11-14T17:00:00Z',
        endedAtISO: '2026-11-14T17:42:00Z',
        pauseIntervals: [],
        actualDurationMinutes: 42,
        estimatedCalories: 260,
        caloriesFormulaNote: 'MET',
        completedExercisesCount: 1,
        totalExercisesCount: 1,
        completedSetsCount: 2,
        totalSetsCount: 2,
        status: 'COMPLETED',
        updatedAt: '2026-11-14T17:42:00Z',
        exercisesSnapshot: [
          {
            id: 'se_1',
            exerciseId: sampleStrengthExercise.id,
            order: 1,
            exerciseType: ExerciseType.STRENGTH,
            isCompleted: true,
            sets: [
              {
                id: 'set_1',
                setNumber: 1,
                targetReps: 10,
                actualReps: 10,
                targetWeightKg: 50,
                actualWeightKg: 55,
                isCompleted: true,
              },
              {
                id: 'set_2',
                setNumber: 2,
                targetReps: 10,
                actualReps: 8,
                targetWeightKg: 55,
                actualWeightKg: 60,
                isCompleted: true,
              },
            ],
          },
        ],
      },
    ];

    const summary = computeWorkoutSummaryForSessions(sessions, logs);
    expect(summary.completedCount).toBe(1);
    expect(summary.missedCount).toBe(1);
    expect(summary.totalDurationMinutes).toBe(42);
    expect(summary.totalEstimatedCalories).toBe(260);
    expect(summary.adherencePercent).toBe(50);

    const trend = buildExerciseStrengthTrend(sampleStrengthExercise.id, logs);
    expect(trend).toHaveLength(1);
    expect(trend[0].maxWeightKg).toBe(60);
    expect(trend[0].maxReps).toBe(10);
  });

  it('extracts shared profile and nutrition context read-only without mutating nutrition data', () => {
    const mockData = buildInitialMockData();
    const targetBefore = structuredClone(mockData.target);
    const shared = rhythmNutritionAdapter.extractSharedContext(mockData);

    expect(shared.userWeightKg).toBe(mockData.profile.weightKg);
    expect(shared.dailyCalorieTarget).toBe(mockData.target.dailyCalories);
    expect(mockData.target).toEqual(targetBefore);
  });
});
