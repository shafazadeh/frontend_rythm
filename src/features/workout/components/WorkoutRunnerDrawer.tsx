import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Flame,
  Pause,
  Play,
  Square,
  Timer,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatJalaliFullDate } from '../../../services/domain/jalaliCalendar';
import {
  estimateWorkoutSessionCalories,
  WORKOUT_CALORIE_DISCLAIMER,
} from '../../../services/domain/workoutCalorieCalculator';
import {
  computeActualDurationSeconds,
  formatDurationClock,
} from '../../../services/domain/workoutSessionDuration';
import { Button } from '../../../shared/components/ui/Button';
import { Checkbox, Input, Label, Progress, Textarea } from '../../../shared/components/ui/FormControls';
import { ConfirmDialog, Sheet } from '../../../shared/components/ui/Overlays';
import { EXERCISE_TYPE_LABELS } from '../../../shared/constants/workout';
import {
  Exercise,
  ExerciseType,
  MetReferenceEntry,
  WorkoutActivityLog,
  WorkoutPauseInterval,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSessionStatus,
} from '../../../shared/types/workout';
import { formatFaNumber, generateId, toPersianDigits } from '../../../shared/utils/cn';

interface WorkoutRunnerDrawerProps {
  session: WorkoutSession | null;
  existingLog?: WorkoutActivityLog | null;
  onClose: () => void;
  exercisesById: Record<string, Exercise>;
  metReferenceTable: MetReferenceEntry[];
  userWeightKg: number | null;
  onPersistLog: (params: {
    log: WorkoutActivityLog;
    nextSessionStatus: WorkoutSessionStatus;
    updatedExercises: WorkoutSessionExercise[];
  }) => Promise<unknown>;
}

export function WorkoutRunnerDrawer({
  session,
  existingLog,
  onClose,
  exercisesById,
  metReferenceTable,
  userWeightKg,
  onPersistLog,
}: WorkoutRunnerDrawerProps) {
  const [exercises, setExercises] = useState<WorkoutSessionExercise[]>([]);
  const [startedAtISO, setStartedAtISO] = useState<string | null>(null);
  const [endedAtISO, setEndedAtISO] = useState<string | undefined>(undefined);
  const [pauseIntervals, setPauseIntervals] = useState<WorkoutPauseInterval[]>([]);
  const [userNotes, setUserNotes] = useState<string>('');
  const [summaryLog, setSummaryLog] = useState<WorkoutActivityLog | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  // Initialize from existing persisted log (if session was interrupted/in-progress) or session plan
  useEffect(() => {
    if (!session) return;
    setSummaryLog(null);

    if (existingLog && existingLog.sessionId === session.id) {
      setExercises(structuredClone(existingLog.exercisesSnapshot));
      setStartedAtISO(existingLog.startedAtISO);
      setEndedAtISO(existingLog.endedAtISO);
      setPauseIntervals(structuredClone(existingLog.pauseIntervals));
      setUserNotes(existingLog.userNotes ?? '');
      if (existingLog.status === 'COMPLETED' || existingLog.status === 'PARTIAL') {
        setSummaryLog(existingLog);
      }
    } else {
      setExercises(structuredClone(session.exercises));
      setStartedAtISO(null);
      setEndedAtISO(undefined);
      setPauseIntervals([]);
      setUserNotes('');
    }
  }, [session?.id]);

  // Live ticker solely triggers re-render every second; elapsed duration always comes from timestamp math
  useEffect(() => {
    if (!session || !startedAtISO || endedAtISO) return;
    const id = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [session, startedAtISO, endedAtISO]);

  const durationState = useMemo(() => {
    if (!startedAtISO) {
      return { activeSeconds: 0, activeMinutes: 0, isCurrentlyPaused: false };
    }
    return computeActualDurationSeconds({
      startedAtISO,
      endedAtISO,
      pauseIntervals,
      nowMs: nowTick,
    });
  }, [startedAtISO, endedAtISO, pauseIntervals, nowTick]);

  const progressMetrics = useMemo(() => {
    let totalUnits = 0;
    let doneUnits = 0;
    let totalSets = 0;
    let completedSets = 0;
    let completedExercises = 0;

    for (const ex of exercises) {
      if (ex.exerciseType === ExerciseType.STRENGTH && ex.sets.length > 0) {
        totalSets += ex.sets.length;
        const done = ex.sets.filter((s) => s.isCompleted).length;
        completedSets += done;
        totalUnits += ex.sets.length;
        doneUnits += done;
        if (done === ex.sets.length) completedExercises += 1;
      } else {
        totalUnits += 1;
        if (ex.isCompleted) {
          doneUnits += 1;
          completedExercises += 1;
        }
      }
    }

    return {
      totalUnits: Math.max(1, totalUnits),
      doneUnits,
      totalSets,
      completedSets,
      completedExercises,
      totalExercises: exercises.length,
    };
  }, [exercises]);

  if (!session) return null;

  const buildLogPayload = (
    status: WorkoutActivityLog['status'],
    customStartedAt: string,
    customEndedAt: string | undefined,
    customPauses: WorkoutPauseInterval[],
    customExercises: WorkoutSessionExercise[]
  ): WorkoutActivityLog => {
    const computedDur = computeActualDurationSeconds({
      startedAtISO: customStartedAt,
      endedAtISO: customEndedAt,
      pauseIntervals: customPauses,
    });

    const effectiveMinutes =
      status === 'IN_PROGRESS'
        ? computedDur.activeMinutes
        : Math.max(1, computedDur.activeMinutes || session.estimatedDurationMinutes);

    const calEstimate = estimateWorkoutSessionCalories({
      weightKg: userWeightKg,
      totalDurationMinutes: effectiveMinutes,
      exercises: customExercises,
      exercisesById,
      metReferenceTable,
      sessionFallbackType: session.type,
    });

    const totalSets = customExercises.reduce((acc, ex) => acc + ex.sets.length, 0);
    const doneSets = customExercises.reduce(
      (acc, ex) => acc + ex.sets.filter((s) => s.isCompleted).length,
      0
    );
    const doneEx = customExercises.filter((ex) =>
      ex.exerciseType === ExerciseType.STRENGTH && ex.sets.length > 0
        ? ex.sets.some((s) => s.isCompleted)
        : ex.isCompleted
    ).length;

    return {
      id: existingLog?.id ?? generateId('wlog'),
      sessionId: session.id,
      programId: session.programId,
      templateId: session.templateId,
      title: session.title,
      type: session.type,
      dateISO: session.dateISO,
      startedAtISO: customStartedAt,
      endedAtISO: customEndedAt,
      pauseIntervals: customPauses,
      actualDurationMinutes: effectiveMinutes,
      estimatedCalories: calEstimate.totalCalories,
      caloriesFormulaNote: 'MET × 3.5 × وزن × مدت ÷ ۲۰۰',
      completedExercisesCount: doneEx,
      totalExercisesCount: customExercises.length,
      completedSetsCount: doneSets,
      totalSetsCount: totalSets,
      userNotes: userNotes || undefined,
      exercisesSnapshot: customExercises,
      status,
      updatedAt: new Date().toISOString(),
    };
  };

  const handleStart = async () => {
    const nowISO = new Date().toISOString();
    setStartedAtISO(nowISO);
    setEndedAtISO(undefined);
    setPauseIntervals([]);
    setSummaryLog(null);

    const log = buildLogPayload('IN_PROGRESS', nowISO, undefined, [], exercises);
    await onPersistLog({
      log,
      nextSessionStatus: WorkoutSessionStatus.IN_PROGRESS,
      updatedExercises: exercises,
    });
    toast.success('جلسه تمرینی آغاز شد.');
  };

  const handlePauseOrResume = async () => {
    if (!startedAtISO) return;
    const nowISO = new Date().toISOString();
    let nextPauses: WorkoutPauseInterval[];

    if (durationState.isCurrentlyPaused) {
      nextPauses = pauseIntervals.map((p, idx) =>
        idx === pauseIntervals.length - 1 && !p.resumedAtISO
          ? { ...p, resumedAtISO: nowISO }
          : p
      );
    } else {
      nextPauses = [...pauseIntervals, { startedAtISO: nowISO }];
    }

    setPauseIntervals(nextPauses);
    const log = buildLogPayload('IN_PROGRESS', startedAtISO, undefined, nextPauses, exercises);
    await onPersistLog({
      log,
      nextSessionStatus: WorkoutSessionStatus.IN_PROGRESS,
      updatedExercises: exercises,
    });
  };

  const syncInProgressExercises = async (nextExercises: WorkoutSessionExercise[]) => {
    setExercises(nextExercises);
    if (!startedAtISO || endedAtISO) return;
    const log = buildLogPayload('IN_PROGRESS', startedAtISO, undefined, pauseIntervals, nextExercises);
    await onPersistLog({
      log,
      nextSessionStatus: WorkoutSessionStatus.IN_PROGRESS,
      updatedExercises: nextExercises,
    });
  };

  const handleFinish = async (mode: 'COMPLETED' | 'PARTIAL') => {
    const start = startedAtISO ?? new Date().toISOString();
    const end = new Date().toISOString();
    // Close any open pause interval at finish time
    const closedPauses = pauseIntervals.map((p) =>
      !p.resumedAtISO ? { ...p, resumedAtISO: end } : p
    );

    setStartedAtISO(start);
    setEndedAtISO(end);
    setPauseIntervals(closedPauses);

    const finalExercises =
      mode === 'COMPLETED'
        ? exercises.map((ex) => ({
            ...ex,
            isCompleted:
              ex.exerciseType === ExerciseType.STRENGTH && ex.sets.length > 0
                ? ex.sets.some((s) => s.isCompleted) || ex.isCompleted
                : ex.isCompleted,
          }))
        : exercises;

    const log = buildLogPayload(mode, start, end, closedPauses, finalExercises);
    await onPersistLog({
      log,
      nextSessionStatus: WorkoutSessionStatus.COMPLETED,
      updatedExercises: finalExercises,
    });
    setSummaryLog(log);
    toast.success(
      mode === 'COMPLETED' ? 'تمرین با موفقیت به پایان رسید و در تاریخچه ثبت شد.' : 'تمرین ناقص ثبت و ذخیره شد.'
    );
  };

  const handleCancelWorkout = async () => {
    const start = startedAtISO ?? new Date().toISOString();
    const end = new Date().toISOString();
    const log = buildLogPayload('CANCELLED', start, end, pauseIntervals, exercises);
    await onPersistLog({
      log,
      nextSessionStatus: WorkoutSessionStatus.CANCELLED,
      updatedExercises: exercises,
    });
    toast.info('جلسه تمرینی لغو شد.');
    onClose();
  };

  return (
    <>
      <Sheet
        open={Boolean(session)}
        onClose={onClose}
        title={session.title}
        subtitle={`${EXERCISE_TYPE_LABELS[session.type]} · ${formatJalaliFullDate(session.dateISO)}`}
      >
        {summaryLog ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-[var(--color-success)]/35 bg-[var(--color-success-subtle)] p-5 text-center space-y-2">
              <CheckCircle2 className="h-9 w-9 text-[var(--color-success)] mx-auto" />
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                {summaryLog.status === 'PARTIAL' ? 'تمرین به‌صورت جزئی ثبت شد' : 'تمرین با موفقیت ثبت شد'}
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                اطلاعات اجرای واقعی در تاریخچه ذخیره شد و قالب اصلی برنامه بدون تغییر باقی ماند.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg bg-[var(--bg-surface-muted)] p-3.5">
                <div className="text-xs text-[var(--text-muted)]">زمان واقعی تمرین</div>
                <div className="mt-1 text-lg font-bold tabular-nums">
                  {formatFaNumber(summaryLog.actualDurationMinutes)} دقیقه
                </div>
              </div>
              <div className="rounded-lg bg-[var(--bg-surface-muted)] p-3.5">
                <div className="text-xs text-[var(--text-muted)]">کالری تخمینی</div>
                <div className="mt-1 text-lg font-bold text-[var(--color-primary)] tabular-nums">
                  {summaryLog.estimatedCalories !== null
                    ? `${formatFaNumber(summaryLog.estimatedCalories)} کیلوکالری`
                    : 'نامشخص'}
                </div>
              </div>
              <div className="rounded-lg bg-[var(--bg-surface-muted)] p-3.5">
                <div className="text-xs text-[var(--text-muted)]">حرکات انجام‌شده</div>
                <div className="mt-1 text-base font-bold tabular-nums">
                  {formatFaNumber(summaryLog.completedExercisesCount)} از{' '}
                  {formatFaNumber(summaryLog.totalExercisesCount)}
                </div>
              </div>
              <div className="rounded-lg bg-[var(--bg-surface-muted)] p-3.5">
                <div className="text-xs text-[var(--text-muted)]">ست‌های تکمیل‌شده</div>
                <div className="mt-1 text-base font-bold tabular-nums">
                  {formatFaNumber(summaryLog.completedSetsCount)} از{' '}
                  {formatFaNumber(summaryLog.totalSetsCount)}
                </div>
              </div>
            </div>

            {summaryLog.userNotes && (
              <div className="rounded-lg border border-[var(--border-subtle)] p-3 text-xs">
                <span className="font-semibold">یادداشت شما: </span>
                {summaryLog.userNotes}
              </div>
            )}

            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              {WORKOUT_CALORIE_DISCLAIMER}
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSummaryLog(null)}>
                ویرایش ثبت اجرا
              </Button>
              <Button onClick={onClose}>بستن</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Live Timer & Controls */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]/60 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Timer className="h-5 w-5 text-[var(--color-primary)]" />
                  <div>
                    <div className="text-xs text-[var(--text-muted)]">مدت سپری‌شده واقعی</div>
                    <div className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">
                      {startedAtISO
                        ? toPersianDigits(formatDurationClock(durationState.activeSeconds))
                        : '۰۰:۰۰'}
                    </div>
                  </div>
                </div>

                {!startedAtISO ? (
                  <Button onClick={handleStart}>
                    <Play className="h-4 w-4" />
                    <span>شروع تمرین</span>
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handlePauseOrResume}>
                      {durationState.isCurrentlyPaused ? (
                        <>
                          <Play className="h-3.5 w-3.5" />
                          <span>ادامه</span>
                        </>
                      ) : (
                        <>
                          <Pause className="h-3.5 w-3.5" />
                          <span>توقف موقت</span>
                        </>
                      )}
                    </Button>
                    <Button size="sm" onClick={() => handleFinish('COMPLETED')}>
                      <Square className="h-3.5 w-3.5" />
                      <span>پایان تمرین</span>
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs tabular-nums">
                  <span className="text-[var(--text-secondary)]">پیشرفت اجرای تمرین</span>
                  <span>
                    {formatFaNumber(progressMetrics.doneUnits)} از{' '}
                    {formatFaNumber(progressMetrics.totalUnits)} مورد
                  </span>
                </div>
                <Progress value={progressMetrics.doneUnits} max={progressMetrics.totalUnits} />
              </div>
            </div>

            {/* Exercises Execution List */}
            <div className="space-y-4">
              {exercises.map((ex, exIdx) => {
                const meta = exercisesById[ex.exerciseId];
                return (
                  <div
                    key={ex.id}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-[var(--text-primary)]">
                          {formatFaNumber(exIdx + 1)}. {meta?.persianName ?? 'حرکت تمرینی'}
                        </h4>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          {EXERCISE_TYPE_LABELS[ex.exerciseType]}
                          {ex.restSeconds ? ` · استراحت پیشنهادی ${formatFaNumber(ex.restSeconds)} ثانیه` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Strength Sets */}
                    {ex.exerciseType === ExerciseType.STRENGTH && ex.sets.length > 0 && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-12 gap-2 text-[11px] text-[var(--text-muted)] px-1">
                          <span className="col-span-2">ست</span>
                          <span className="col-span-4">تکرار واقعی</span>
                          <span className="col-span-4">وزنه (کیلوگرم)</span>
                          <span className="col-span-2 text-left">انجام</span>
                        </div>
                        {ex.sets.map((st, setIdx) => (
                          <div key={st.id} className="grid grid-cols-12 gap-2 items-center">
                            <span className="col-span-2 text-xs font-semibold tabular-nums">
                              #{formatFaNumber(st.setNumber)}
                            </span>
                            <div className="col-span-4">
                              <Input
                                type="number"
                                min={0}
                                value={st.actualReps ?? st.targetReps ?? 0}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0;
                                  const next = exercises.map((item, i) =>
                                    i === exIdx
                                      ? {
                                          ...item,
                                          sets: item.sets.map((s, si) =>
                                            si === setIdx ? { ...s, actualReps: val } : s
                                          ),
                                        }
                                      : item
                                  );
                                  setExercises(next);
                                }}
                                className="h-8 text-xs tabular-nums"
                              />
                            </div>
                            <div className="col-span-4">
                              <Input
                                type="number"
                                min={0}
                                step={0.5}
                                value={st.actualWeightKg ?? st.targetWeightKg ?? 0}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0;
                                  const next = exercises.map((item, i) =>
                                    i === exIdx
                                      ? {
                                          ...item,
                                          sets: item.sets.map((s, si) =>
                                            si === setIdx ? { ...s, actualWeightKg: val } : s
                                          ),
                                        }
                                      : item
                                  );
                                  setExercises(next);
                                }}
                                className="h-8 text-xs tabular-nums"
                              />
                            </div>
                            <div className="col-span-2 flex justify-end">
                              <Checkbox
                                checked={st.isCompleted}
                                ariaLabel={`تکمیل ست ${st.setNumber}`}
                                onCheckedChange={(checked) => {
                                  const next = exercises.map((item, i) =>
                                    i === exIdx
                                      ? {
                                          ...item,
                                          sets: item.sets.map((s, si) =>
                                            si === setIdx ? { ...s, isCompleted: checked } : s
                                          ),
                                        }
                                      : item
                                  );
                                  syncInProgressExercises(next);
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Cardio Execution */}
                    {ex.exerciseType === ExerciseType.CARDIO && (
                      <div className="space-y-2.5 text-xs">
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label>مدت واقعی (دقیقه)</Label>
                            <Input
                              type="number"
                              min={1}
                              value={ex.actualDurationMinutes ?? ex.targetDurationMinutes ?? 20}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                setExercises((prev) =>
                                  prev.map((item, i) =>
                                    i === exIdx ? { ...item, actualDurationMinutes: val } : item
                                  )
                                );
                              }}
                              className="h-8 text-xs tabular-nums"
                            />
                          </div>
                          <div>
                            <Label>مسافت (کیلومتر)</Label>
                            <Input
                              type="number"
                              min={0}
                              step={0.1}
                              value={ex.actualDistanceKm ?? ex.targetDistanceKm ?? 0}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                setExercises((prev) =>
                                  prev.map((item, i) =>
                                    i === exIdx ? { ...item, actualDistanceKm: val } : item
                                  )
                                );
                              }}
                              className="h-8 text-xs tabular-nums"
                            />
                          </div>
                          <div>
                            <Label>شدت حس‌شده (RPE 1-10)</Label>
                            <Input
                              type="number"
                              min={1}
                              max={10}
                              value={ex.perceivedRpe ?? 6}
                              onChange={(e) => {
                                const val = Math.min(10, Math.max(1, Number(e.target.value) || 6));
                                setExercises((prev) =>
                                  prev.map((item, i) =>
                                    i === exIdx ? { ...item, perceivedRpe: val } : item
                                  )
                                );
                              }}
                              className="h-8 text-xs tabular-nums"
                            />
                          </div>
                        </div>
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={ex.isCompleted}
                            onCheckedChange={(checked) => {
                              const next = exercises.map((item, i) =>
                                i === exIdx ? { ...item, isCompleted: checked } : item
                              );
                              syncInProgressExercises(next);
                            }}
                          />
                          <span>بخش هوازی تکمیل شد</span>
                        </label>
                      </div>
                    )}

                    {/* Stretching / Mobility / Balance */}
                    {ex.exerciseType !== ExerciseType.STRENGTH &&
                      ex.exerciseType !== ExerciseType.CARDIO && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[var(--text-secondary)] tabular-nums">
                            {formatFaNumber(ex.targetSetsCount ?? 2)} ست ×{' '}
                            {formatFaNumber(ex.targetRepsCount ?? 8)} تکرار · نگهداری{' '}
                            {formatFaNumber(ex.holdSeconds ?? 30)} ثانیه
                          </span>
                          <label className="inline-flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={ex.isCompleted}
                              onCheckedChange={(checked) => {
                                const next = exercises.map((item, i) =>
                                  i === exIdx ? { ...item, isCompleted: checked } : item
                                );
                                syncInProgressExercises(next);
                              }}
                            />
                            <span>انجام شد</span>
                          </label>
                        </div>
                      )}
                  </div>
                );
              })}
            </div>

            <div>
              <Label htmlFor="runner-notes">یادداشت کاربر پس از تمرین</Label>
              <Textarea
                id="runner-notes"
                rows={2}
                className="min-h-[60px]"
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                placeholder="احساس بدن، انرژی، یا نکته برای جلسه بعدی..."
              />
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[var(--border-subtle)]">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCancelConfirmOpen(true)}
                className="text-[var(--color-error)]"
              >
                <XCircle className="h-4 w-4" />
                <span>لغو تمرین</span>
              </Button>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => handleFinish('PARTIAL')}>
                  ثبت تمرین ناقص
                </Button>
                <Button size="sm" onClick={() => handleFinish('COMPLETED')}>
                  <Flame className="h-3.5 w-3.5" />
                  <span>پایان و ثبت تمرین</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        open={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        onConfirm={handleCancelWorkout}
        title="لغو جلسه تمرینی"
        message="آیا مطمئن هستید که می‌خواهید این جلسه تمرینی را لغو کنید؟"
        confirmLabel="بله، لغو شود"
        destructive
      />
    </>
  );
}
