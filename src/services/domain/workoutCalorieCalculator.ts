import {
  CardioIntensity,
  Exercise,
  ExerciseType,
  MetReferenceEntry,
  WorkoutSession,
  WorkoutSessionExercise,
} from '../../shared/types/workout';

export interface CalorieSegmentEstimate {
  label: string;
  exerciseType: ExerciseType;
  met: number;
  durationMinutes: number;
  calories: number;
}

export interface WorkoutCalorieEstimateResult {
  totalCalories: number | null;
  isEstimated: true;
  missingReason?: string;
  segments: CalorieSegmentEstimate[];
  disclaimer: string;
}

export const WORKOUT_CALORIE_DISCLAIMER =
  'این مقدار صرفاً تخمین آماری مبتنی بر میانگین MET و انرژی کل فعالیت (نه خالص اضافه بر استراحت) است، اندازهگیری پزشکی یا فیزیولوژیک دقیق نیست و به‌صورت خودکار هدف کالری غذایی را تغییر نمی‌دهد.';

/**
 * Pure MET formula:
 * Calories = MET × 3.5 × Weight(kg) ÷ 200 × Duration(minutes)
 */
export function calculateMetSegmentCalories(
  met: number,
  weightKg: number,
  durationMinutes: number
): number {
  if (!Number.isFinite(met) || met <= 0) return 0;
  if (!Number.isFinite(weightKg) || weightKg <= 0) return 0;
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return 0;
  return Math.round(((met * 3.5 * weightKg) / 200) * durationMinutes);
}

/**
 * Resolves MET from editable reference table or exercise default, accounting for intensity/RPE.
 */
export function resolveMetForExerciseSegment(params: {
  exerciseType: ExerciseType;
  exercise?: Exercise;
  intensity?: CardioIntensity;
  perceivedRpe?: number;
  metReferenceTable: MetReferenceEntry[];
}): number {
  const { exerciseType, exercise, intensity, perceivedRpe, metReferenceTable } = params;

  let resolvedIntensity = intensity ?? CardioIntensity.MODERATE;
  if (!intensity && perceivedRpe !== undefined) {
    if (perceivedRpe <= 4) resolvedIntensity = CardioIntensity.LIGHT;
    else if (perceivedRpe >= 8) resolvedIntensity = CardioIntensity.VIGOROUS;
    else resolvedIntensity = CardioIntensity.MODERATE;
  }

  const refMatch = metReferenceTable.find(
    (entry) => entry.exerciseType === exerciseType && entry.intensity === resolvedIntensity
  );

  if (exercise?.defaultMet && exercise.defaultMet > 0) {
    if (resolvedIntensity === CardioIntensity.LIGHT) {
      return Number(Math.max(1.8, exercise.defaultMet * 0.85).toFixed(1));
    }
    if (resolvedIntensity === CardioIntensity.VIGOROUS) {
      return Number((exercise.defaultMet * 1.15).toFixed(1));
    }
    return exercise.defaultMet;
  }

  if (refMatch) return refMatch.metValue;

  const fallbackByType: Record<ExerciseType, number> = {
    [ExerciseType.STRENGTH]: 5.0,
    [ExerciseType.CARDIO]: 7.0,
    [ExerciseType.STRETCHING]: 2.3,
    [ExerciseType.MOBILITY]: 2.8,
    [ExerciseType.BALANCE]: 2.5,
  };
  return fallbackByType[exerciseType];
}

function estimateSingleExerciseDuration(
  ex: WorkoutSessionExercise,
  fallbackMinutesPerExercise: number
): number {
  if (ex.actualDurationMinutes && ex.actualDurationMinutes > 0) {
    return ex.actualDurationMinutes;
  }
  if (ex.targetDurationMinutes && ex.targetDurationMinutes > 0) {
    return ex.targetDurationMinutes;
  }
  if (ex.exerciseType === ExerciseType.STRENGTH && ex.sets.length > 0) {
    const restSec = ex.restSeconds ?? 60;
    const setWorkSec = 40;
    return Math.max(2, Math.round((ex.sets.length * (setWorkSec + restSec)) / 60));
  }
  if (ex.holdSeconds && ex.targetSetsCount) {
    return Math.max(1, Math.round((ex.holdSeconds * ex.targetSetsCount * 1.5) / 60));
  }
  return Math.max(1, fallbackMinutesPerExercise);
}

/**
 * Estimates total workout calories across multi-segment exercises using MET and actual/planned duration.
 * Never returns a fabricated number if weight or duration is missing.
 */
export function estimateWorkoutSessionCalories(params: {
  weightKg?: number | null;
  totalDurationMinutes?: number | null;
  exercises: WorkoutSessionExercise[];
  exercisesById: Record<string, Exercise>;
  metReferenceTable: MetReferenceEntry[];
  sessionFallbackType: ExerciseType;
}): WorkoutCalorieEstimateResult {
  const {
    weightKg,
    totalDurationMinutes,
    exercises,
    exercisesById,
    metReferenceTable,
    sessionFallbackType,
  } = params;

  if (!weightKg || !Number.isFinite(weightKg) || weightKg <= 0) {
    return {
      totalCalories: null,
      isEstimated: true,
      missingReason: 'وزن کاربر در پروفایل مشخص نیست؛ محاسبه تخمینی کالری امکان‌پذیر نیست.',
      segments: [],
      disclaimer: WORKOUT_CALORIE_DISCLAIMER,
    };
  }

  if (!totalDurationMinutes || !Number.isFinite(totalDurationMinutes) || totalDurationMinutes <= 0) {
    return {
      totalCalories: null,
      isEstimated: true,
      missingReason: 'مدت واقعی یا تخمینی تمرین مشخص نیست.',
      segments: [],
      disclaimer: WORKOUT_CALORIE_DISCLAIMER,
    };
  }

  if (exercises.length === 0) {
    const met = resolveMetForExerciseSegment({
      exerciseType: sessionFallbackType,
      metReferenceTable,
    });
    const calories = calculateMetSegmentCalories(met, weightKg, totalDurationMinutes);
    return {
      totalCalories: calories,
      isEstimated: true,
      segments: [
        {
          label: 'کل جلسه تمرینی',
          exerciseType: sessionFallbackType,
          met,
          durationMinutes: totalDurationMinutes,
          calories,
        },
      ],
      disclaimer: WORKOUT_CALORIE_DISCLAIMER,
    };
  }

  const avgPerExercise = totalDurationMinutes / exercises.length;
  const rawWeights = exercises.map((ex) => estimateSingleExerciseDuration(ex, avgPerExercise));
  const rawSum = rawWeights.reduce((acc, v) => acc + v, 0) || totalDurationMinutes;

  const segments: CalorieSegmentEstimate[] = exercises.map((ex, idx) => {
    const exerciseMeta = exercisesById[ex.exerciseId];
    // Scale segment minutes proportionally so the sum matches actual/planned session duration
    const allocatedMinutes = Number(((rawWeights[idx] / rawSum) * totalDurationMinutes).toFixed(2));
    const met = resolveMetForExerciseSegment({
      exerciseType: ex.exerciseType,
      exercise: exerciseMeta,
      intensity: ex.targetIntensity,
      perceivedRpe: ex.perceivedRpe,
      metReferenceTable,
    });
    const calories = calculateMetSegmentCalories(met, weightKg, allocatedMinutes);

    return {
      label: exerciseMeta?.persianName ?? 'حرکت تمرینی',
      exerciseType: ex.exerciseType,
      met,
      durationMinutes: Number(allocatedMinutes.toFixed(1)),
      calories,
    };
  });

  const totalCalories = segments.reduce((sum, seg) => sum + seg.calories, 0);

  return {
    totalCalories,
    isEstimated: true,
    segments,
    disclaimer: WORKOUT_CALORIE_DISCLAIMER,
  };
}

export function getEffectiveSessionDuration(session: WorkoutSession): number {
  if (session.estimatedDurationMinutes > 0) return session.estimatedDurationMinutes;
  const [sh, sm] = session.startTime.split(':').map(Number);
  const [eh, em] = session.endTime.split(':').map(Number);
  const startM = (sh || 0) * 60 + (sm || 0);
  const endM = (eh || 0) * 60 + (em || 0);
  return Math.max(0, endM - startM);
}
