import { Calendar, Clock, Edit3, Play } from 'lucide-react';
import { formatJalaliFullDate, getPersianWeekdayName } from '../../../services/domain/jalaliCalendar';
import { estimateWorkoutSessionCalories } from '../../../services/domain/workoutCalorieCalculator';
import { Button } from '../../../shared/components/ui/Button';
import { Sheet } from '../../../shared/components/ui/Overlays';
import { CARDIO_INTENSITY_LABELS, EXERCISE_TYPE_LABELS } from '../../../shared/constants/workout';
import {
  Exercise,
  ExerciseType,
  MetReferenceEntry,
  WorkoutSession,
  WorkoutSessionStatus,
} from '../../../shared/types/workout';
import { formatFaNumber, toPersianDigits } from '../../../shared/utils/cn';
import { WorkoutStatusLabel } from './WorkoutStatusLabel';

interface SessionDetailSheetProps {
  session: WorkoutSession | null;
  onClose: () => void;
  exercisesById: Record<string, Exercise>;
  metReferenceTable: MetReferenceEntry[];
  userWeightKg: number | null;
  onStartWorkout: (session: WorkoutSession) => void;
  onEditSession: (session: WorkoutSession) => void;
}

export function SessionDetailSheet({
  session,
  onClose,
  exercisesById,
  metReferenceTable,
  userWeightKg,
  onStartWorkout,
  onEditSession,
}: SessionDetailSheetProps) {
  if (!session) return null;

  const calEstimate = estimateWorkoutSessionCalories({
    weightKg: userWeightKg,
    totalDurationMinutes: session.estimatedDurationMinutes,
    exercises: session.exercises,
    exercisesById,
    metReferenceTable,
    sessionFallbackType: session.type,
  });

  return (
    <Sheet
      open={Boolean(session)}
      onClose={onClose}
      title={session.title}
      subtitle={`${getPersianWeekdayName(session.dayIndex)} ${formatJalaliFullDate(session.dateISO)} · ${toPersianDigits(session.startTime)} تا ${toPersianDigits(session.endTime)}`}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
            <WorkoutStatusLabel status={session.status} />
            <span aria-hidden="true">·</span>
            <span>{EXERCISE_TYPE_LABELS[session.type]}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {formatFaNumber(session.estimatedDurationMinutes)} دقیقه
            </span>
          </div>
        </div>

        {/* Estimated Calories Preview */}
        <div className="rounded-lg bg-[var(--bg-surface-muted)]/60 p-3.5 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-secondary)]">انرژی تخمینی کل فعالیت (بر اساس MET):</span>
            <span className="font-bold text-[var(--color-primary)] tabular-nums">
              {calEstimate.totalCalories !== null
                ? `${formatFaNumber(calEstimate.totalCalories)} کیلوکالری (تخمینی)`
                : 'نامشخص'}
            </span>
          </div>
          {calEstimate.missingReason ? (
            <p className="text-[11px] text-[var(--color-warning)]">{calEstimate.missingReason}</p>
          ) : (
            <p className="text-[11px] text-[var(--text-muted)]">
              بر مبنای وزن ثبت‌شده در پروفایل ({formatFaNumber(userWeightKg ?? 0)} کیلوگرم)؛ بدون تغییر خودکار هدف غذایی.
            </p>
          )}
        </div>

        {/* Exercises List */}
        <div className="space-y-2.5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            فهرست حرکات ({formatFaNumber(session.exercises.length)} حرکت)
          </h3>

          {session.exercises.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-4">
              برای این جلسه آزاد حرکتی ثبت نشده است؛ هنگام اجرا می‌توانید یادداشت و مدت واقعی را ثبت کنید.
            </p>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)] rounded-lg border border-[var(--border-subtle)]">
              {session.exercises.map((ex, idx) => {
                const meta = exercisesById[ex.exerciseId];
                return (
                  <div key={ex.id} className="p-3 space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--text-primary)]">
                        {formatFaNumber(idx + 1)}. {meta?.persianName ?? 'حرکت تمرینی'}
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {EXERCISE_TYPE_LABELS[ex.exerciseType]}
                      </span>
                    </div>
                    <div className="text-[var(--text-secondary)] tabular-nums">
                      {ex.exerciseType === ExerciseType.STRENGTH && (
                        <span>
                          {formatFaNumber(ex.sets.length)} ست ×{' '}
                          {formatFaNumber(ex.sets[0]?.targetReps ?? 10)} تکرار
                          {ex.sets[0]?.targetWeightKg
                            ? ` · وزنه هدف ${formatFaNumber(ex.sets[0].targetWeightKg)} کیلوگرم`
                            : ''}
                          {ex.restSeconds ? ` · استراحت ${formatFaNumber(ex.restSeconds)} ثانیه` : ''}
                        </span>
                      )}
                      {ex.exerciseType === ExerciseType.CARDIO && (
                        <span>
                          مدت {formatFaNumber(ex.targetDurationMinutes ?? 20)} دقیقه
                          {ex.targetIntensity ? ` · شدت ${CARDIO_INTENSITY_LABELS[ex.targetIntensity]}` : ''}
                          {ex.targetDistanceKm ? ` · ${formatFaNumber(ex.targetDistanceKm, 1)} کیلومتر` : ''}
                        </span>
                      )}
                      {ex.exerciseType !== ExerciseType.STRENGTH &&
                        ex.exerciseType !== ExerciseType.CARDIO && (
                          <span>
                            {formatFaNumber(ex.targetSetsCount ?? 2)} ست ×{' '}
                            {formatFaNumber(ex.targetRepsCount ?? 8)} تکرار · نگهداری{' '}
                            {formatFaNumber(ex.holdSeconds ?? 30)} ثانیه
                          </span>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {session.notes && (
          <div className="rounded-lg border border-[var(--border-subtle)] p-3 text-xs text-[var(--text-secondary)]">
            <span className="font-semibold">یادداشت: </span>
            {session.notes}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[var(--border-subtle)]">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Calendar className="h-3.5 w-3.5" />
            <span>{formatJalaliFullDate(session.dateISO)}</span>
            <Clock className="h-3.5 w-3.5 mr-2" />
            <span className="tabular-nums">{toPersianDigits(session.startTime)}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onClose();
                onEditSession(session);
              }}
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>ویرایش زمان/جزئیات</span>
            </Button>

            {session.status !== WorkoutSessionStatus.CANCELLED && (
              <Button
                size="sm"
                onClick={() => {
                  onClose();
                  onStartWorkout(session);
                }}
              >
                <Play className="h-3.5 w-3.5" />
                <span>
                  {session.status === WorkoutSessionStatus.IN_PROGRESS
                    ? 'ادامه تمرین'
                    : session.status === WorkoutSessionStatus.COMPLETED
                    ? 'مشاهده/اجرای مجدد'
                    : 'شروع تمرین'}
                </span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
