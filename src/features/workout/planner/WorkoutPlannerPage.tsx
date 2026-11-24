import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarPlus,
  Edit3,
  Eye,
  Flame,
  Play,
  Plus,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRhythmData, useRhythmMutations } from '../../../services/api/useRhythmQueries';
import {
  formatJalaliDayMonth,
  formatJalaliFullDate,
  formatJalaliWeekRangeLabel,
  getNextSaturdayToFridayWeekRange,
  getPersianWeekdayName,
  getSaturdayToFridayWeekRange,
} from '../../../services/domain/jalaliCalendar';
import { checkWorkoutSessionConflicts } from '../../../services/domain/scheduleConflictChecker';
import { estimateWorkoutSessionCalories } from '../../../services/domain/workoutCalorieCalculator';
import { rhythmNutritionAdapter } from '../../../services/repositories/workoutAdapters';
import { Button } from '../../../shared/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../shared/components/ui/Card';
import { Checkbox, Input, Label, Select, Skeleton } from '../../../shared/components/ui/FormControls';
import { ConfirmDialog, Dialog, EmptyState } from '../../../shared/components/ui/Overlays';
import { PERSIAN_WEEKDAY_NAMES } from '../../../shared/constants/units';
import { EXERCISE_TYPE_LABELS } from '../../../shared/constants/workout';
import { WorkoutSession, WorkoutSessionStatus } from '../../../shared/types/workout';
import { formatFaNumber, toPersianDigits } from '../../../shared/utils/cn';
import { SessionDetailSheet } from '../components/SessionDetailSheet';
import { SessionFormDialog } from '../components/SessionFormDialog';
import { WorkoutRunnerDrawer } from '../components/WorkoutRunnerDrawer';
import { WorkoutStatusLabel } from '../components/WorkoutStatusLabel';

export function WorkoutPlannerPage() {
  const { data, isLoading, isError } = useRhythmData();
  const {
    upsertWorkoutSession,
    deleteWorkoutSession,
    generateWeeklyWorkoutSessions,
    saveWorkoutActivityLog,
  } = useRhythmMutations();

  const [weekMode, setWeekMode] = useState<'CURRENT' | 'NEXT'>('CURRENT');
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(5); // Thursday 2026-11-19
  const [formOpen, setFormOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<WorkoutSession | null>(null);
  const [detailSession, setDetailSession] = useState<WorkoutSession | null>(null);
  const [runnerSession, setRunnerSession] = useState<WorkoutSession | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkoutSession | null>(null);

  // Weekly generation modal state
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [preferredDays, setPreferredDays] = useState<number[]>([0, 2, 4]);
  const [defaultStartTime, setDefaultStartTime] = useState<string>('17:30');

  const weekRange = useMemo(() => {
    return weekMode === 'CURRENT'
      ? getSaturdayToFridayWeekRange('2026-11-19')
      : getNextSaturdayToFridayWeekRange('2026-11-19');
  }, [weekMode]);

  useEffect(() => {
    if (!data) return;
    if (!selectedProgramId) {
      const activeProg = data.workoutPrograms.find((p) => p.isActive) ?? data.workoutPrograms[0];
      if (activeProg) setSelectedProgramId(activeProg.id);
    }
    if (data.workoutPreferences.preferredDays.length > 0) {
      setPreferredDays(data.workoutPreferences.preferredDays);
    }
    if (data.workoutPreferences.preferredTimeStart) {
      setDefaultStartTime(data.workoutPreferences.preferredTimeStart);
    }
  }, [data, selectedProgramId]);

  const computed = useMemo(() => {
    if (!data) return null;

    const exercisesById = Object.fromEntries(data.exercises.map((e) => [e.id, e]));
    const logsBySessionId = Object.fromEntries(data.workoutActivityLogs.map((l) => [l.sessionId, l]));
    const nutritionContext = rhythmNutritionAdapter.extractSharedContext(data);

    const weekSessions = data.workoutSessions.filter((s) =>
      weekRange.dayDatesISO.includes(s.dateISO)
    );

    const sessionsByDay = weekRange.dayDatesISO.map((iso) =>
      weekSessions
        .filter((s) => s.dateISO === iso)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
    );

    return {
      exercisesById,
      logsBySessionId,
      nutritionContext,
      weekSessions,
      sessionsByDay,
    };
  }, [data, weekRange]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !data || !computed) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-[var(--color-error)]">
          بارگذاری برنامه‌ریز هفتگی ورزش با خطا مواجه شد.
        </CardContent>
      </Card>
    );
  }

  const { exercisesById, logsBySessionId, nutritionContext, sessionsByDay } = computed;
  const selectedDateISO = weekRange.dayDatesISO[selectedDayIdx];
  const selectedDaySessions = sessionsByDay[selectedDayIdx] ?? [];
  const activePrograms = data.workoutPrograms.filter((p) => p.isActive);

  const handleToggleDaySelection = (dayIdx: number) => {
    setPreferredDays((prev) =>
      prev.includes(dayIdx) ? prev.filter((d) => d !== dayIdx) : [...prev, dayIdx].sort((a, b) => a - b)
    );
  };

  const handleGenerateWeek = async () => {
    if (!selectedProgramId) {
      toast.error('لطفاً ابتدا یک برنامه ورزشی انتخاب کنید.');
      return;
    }
    await generateWeeklyWorkoutSessions.mutateAsync({
      weekStartISO: weekRange.weekStartISO,
      programId: selectedProgramId,
      preferredDays: preferredDays.length > 0 ? preferredDays : [0, 2, 4],
      defaultStartTime,
    });
    setGenerateDialogOpen(false);
  };

  const handleQuickStatusChange = async (session: WorkoutSession, nextStatus: WorkoutSessionStatus) => {
    await upsertWorkoutSession.mutateAsync({
      ...session,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    });
    toast.success(
      nextStatus === WorkoutSessionStatus.MISSED
        ? 'جلسه به عنوان انجام‌نشده ثبت شد.'
        : 'وضعیت جلسه به‌روزرسانی شد.'
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Week Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-balance text-[var(--text-primary)]">
            برنامه‌ریز هفتگی ورزش
          </h1>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            بازه هفته: {formatJalaliWeekRangeLabel(weekRange.weekStartISO, weekRange.weekEndISO)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex rounded-lg bg-[var(--bg-surface-muted)] p-1">
            <button
              type="button"
              onClick={() => {
                setWeekMode('CURRENT');
                setSelectedDayIdx(5);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                weekMode === 'CURRENT'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              هفته جاری
            </button>
            <button
              type="button"
              onClick={() => {
                setWeekMode('NEXT');
                setSelectedDayIdx(0);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                weekMode === 'NEXT'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              هفته آینده
            </button>
          </div>

          <Button variant="outline" size="sm" onClick={() => setGenerateDialogOpen(true)}>
            <Sparkles className="h-3.5 w-3.5" />
            <span>ساخت برنامه هفته</span>
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setEditingSession(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>افزودن جلسه</span>
          </Button>
        </div>
      </div>

      {/* 7-Day Selector Grid */}
      <Card>
        <CardHeader>
          <CardTitle>نمای شنبه تا جمعه</CardTitle>
          <CardDescription>
            هر روز را انتخاب کنید تا جلسات زمانبندی‌شده، تداخل‌های زمانی و وضعیت اجرا را مدیریت کنید.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
            {weekRange.dayDatesISO.map((dateISO, idx) => {
              const dayList = sessionsByDay[idx] ?? [];
              const isSelected = selectedDayIdx === idx;
              const completedInDay = dayList.filter(
                (s) => s.status === WorkoutSessionStatus.COMPLETED
              ).length;

              return (
                <button
                  key={dateISO}
                  type="button"
                  onClick={() => setSelectedDayIdx(idx)}
                  className={`flex flex-col justify-between rounded-lg border p-3.5 text-right transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-subtle)]/75'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)] hover:border-[var(--color-primary)]/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[var(--text-primary)]">
                        {getPersianWeekdayName(idx)}
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                        {formatJalaliDayMonth(dateISO)}
                      </span>
                    </div>
                    <div className="mt-2.5 text-xs">
                      {dayList.length > 0 ? (
                        <WorkoutStatusLabel status={dayList[0].status} />
                      ) : (
                        <span className="text-[var(--text-muted)]">روز استراحت</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-muted)] tabular-nums">
                    <span>{formatFaNumber(dayList.length)} جلسه</span>
                    {completedInDay > 0 && (
                      <span className="text-[var(--color-success)]">
                        {formatFaNumber(completedInDay)} انجام‌شده
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected Day Sessions Detail */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>
              جلسات {getPersianWeekdayName(selectedDayIdx)} ({formatJalaliFullDate(selectedDateISO)})
            </CardTitle>
            <CardDescription>
              تغییر زمان یا جزئیات یک جلسه، قالب اصلی برنامه ورزشی شما را دست‌کاری نمی‌کند.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingSession(null);
              setFormOpen(true);
            }}
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            <span>جلسه جدید در این روز</span>
          </Button>
        </CardHeader>
        <CardContent>
          {selectedDaySessions.length === 0 ? (
            <EmptyState
              icon={<CalendarPlus className="h-5 w-5" />}
              title="جلسه‌ای برای این روز زمانبندی نشده است"
              description="می‌توانید یک جلسه تمرینی جدید از قالب‌های برنامه یا به‌صورت آزاد اضافه کنید، یا از دکمه «ساخت برنامه هفته» استفاده نمایید."
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingSession(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>افزودن جلسه به {getPersianWeekdayName(selectedDayIdx)}</span>
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              {selectedDaySessions.map((session) => {
                const calEstimate = estimateWorkoutSessionCalories({
                  weightKg: nutritionContext.userWeightKg,
                  totalDurationMinutes: session.estimatedDurationMinutes,
                  exercises: session.exercises,
                  exercisesById,
                  metReferenceTable: data.metReferenceTable,
                  sessionFallbackType: session.type,
                });

                const conflicts = checkWorkoutSessionConflicts(session, data.workoutSessions);
                const log = logsBySessionId[session.id];

                return (
                  <div
                    key={session.id}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-4 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h3 className="text-base font-bold text-[var(--text-primary)]">
                            {session.title}
                          </h3>
                          <WorkoutStatusLabel status={session.status} />
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)] tabular-nums">
                          <span>
                            ساعت {toPersianDigits(session.startTime)} تا {toPersianDigits(session.endTime)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>مدت تخمینی: {formatFaNumber(session.estimatedDurationMinutes)} دقیقه</span>
                          <span aria-hidden="true">·</span>
                          <span>نوع: {EXERCISE_TYPE_LABELS[session.type]}</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatFaNumber(session.exercises.length)} حرکت</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-primary)] tabular-nums shrink-0">
                        <Flame className="h-3.5 w-3.5" />
                        <span>
                          {calEstimate.totalCalories !== null
                            ? `${formatFaNumber(calEstimate.totalCalories)} کیلوکالری (تخمینی)`
                            : 'کالری نامشخص'}
                        </span>
                      </div>
                    </div>

                    {log && (
                      <div className="rounded-lg bg-[var(--bg-surface-muted)]/60 px-3 py-2 text-xs text-[var(--text-secondary)] tabular-nums">
                        ثبت واقعی: {formatFaNumber(log.actualDurationMinutes)} دقیقه ·{' '}
                        {formatFaNumber(log.completedExercisesCount)} از{' '}
                        {formatFaNumber(log.totalExercisesCount)} حرکت انجام‌شده
                      </div>
                    )}

                    {conflicts.hasConflict && (
                      <div className="flex items-start gap-2 rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-warning-subtle)] px-3 py-2 text-xs text-[var(--color-warning)]">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold">
                            تداخل زمانی با{' '}
                            {conflicts.conflicts
                              .map((c) => `${c.title} (${toPersianDigits(c.startTime)}-${toPersianDigits(c.endTime)})`)
                              .join('، ')}
                          </span>
                          <span className="block text-[11px] opacity-90">{conflicts.checkedScopeNote}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)]">
                      <div className="flex flex-wrap items-center gap-2">
                        {session.status !== WorkoutSessionStatus.CANCELLED && (
                          <Button size="sm" onClick={() => setRunnerSession(session)}>
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
                        <Button size="sm" variant="outline" onClick={() => setDetailSession(session)}>
                          <Eye className="h-3.5 w-3.5" />
                          <span>مشاهده</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingSession(session);
                            setFormOpen(true);
                          }}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>ویرایش</span>
                        </Button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {session.status === WorkoutSessionStatus.PLANNED && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleQuickStatusChange(session, WorkoutSessionStatus.MISSED)}
                          >
                            <XCircle className="h-3.5 w-3.5 text-[var(--color-warning)]" />
                            <span>ثبت انجام‌نشده</span>
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[var(--color-error)]"
                          onClick={() => setDeleteTarget(session)}
                          aria-label="حذف جلسه"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>حذف</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Weekly Sessions Dialog */}
      <Dialog
        open={generateDialogOpen}
        onClose={() => setGenerateDialogOpen(false)}
        title="ساخت خودکار برنامه هفتگی"
        description={`قالب‌های برنامه انتخابی به‌عنوان جلسات مستقل در هفته ${formatJalaliWeekRangeLabel(
          weekRange.weekStartISO,
          weekRange.weekEndISO
        )} زمانبندی می‌شوند.`}
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="gen-prog">انتخاب برنامه ورزشی</Label>
            <Select
              id="gen-prog"
              value={selectedProgramId}
              onChange={(e) => setSelectedProgramId(e.target.value)}
            >
              {(activePrograms.length > 0 ? activePrograms : data.workoutPrograms).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({formatFaNumber(p.sessionsPerWeek)} جلسه در هفته)
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>روزهای ترجیحی تمرین</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {PERSIAN_WEEKDAY_NAMES.map((dayName, idx) => (
                <label
                  key={dayName}
                  className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-2.5 py-2 text-xs cursor-pointer"
                >
                  <Checkbox
                    checked={preferredDays.includes(idx)}
                    onCheckedChange={() => handleToggleDaySelection(idx)}
                  />
                  <span>{dayName}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="gen-start-time">ساعت شروع پیش‌فرض</Label>
            <Input
              id="gen-start-time"
              type="time"
              value={defaultStartTime}
              onChange={(e) => setDefaultStartTime(e.target.value)}
              className="tabular-nums"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
            <Button variant="ghost" onClick={() => setGenerateDialogOpen(false)}>
              انصراف
            </Button>
            <Button
              onClick={handleGenerateWeek}
              disabled={generateWeeklyWorkoutSessions.isPending}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>تولید جلسات هفته</span>
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Shared Dialogs & Drawers */}
      <SessionFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initialSession={editingSession}
        defaultDateISO={selectedDateISO}
        programs={data.workoutPrograms}
        templates={data.workoutTemplates}
        exercises={data.exercises}
        allSessions={data.workoutSessions}
        onSave={async (session) => {
          await upsertWorkoutSession.mutateAsync(session);
        }}
      />

      <SessionDetailSheet
        session={detailSession}
        onClose={() => setDetailSession(null)}
        exercisesById={exercisesById}
        metReferenceTable={data.metReferenceTable}
        userWeightKg={nutritionContext.userWeightKg}
        onStartWorkout={(s) => setRunnerSession(s)}
        onEditSession={(s) => {
          setEditingSession(s);
          setFormOpen(true);
        }}
      />

      <WorkoutRunnerDrawer
        session={runnerSession}
        existingLog={runnerSession ? logsBySessionId[runnerSession.id] : null}
        onClose={() => setRunnerSession(null)}
        exercisesById={exercisesById}
        metReferenceTable={data.metReferenceTable}
        userWeightKg={nutritionContext.userWeightKg}
        onPersistLog={async (params) => saveWorkoutActivityLog.mutateAsync(params)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteWorkoutSession.mutate(deleteTarget.id);
        }}
        title="حذف جلسه تمرینی"
        message={`آیا از حذف جلسه «${deleteTarget?.title ?? ''}» مطمئن هستید؟ قالب اصلی برنامه ورزشی دست‌نخورده باقی می‌ماند.`}
        confirmLabel="حذف جلسه"
        destructive
      />
    </div>
  );
}
