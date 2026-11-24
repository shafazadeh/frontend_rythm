import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Dumbbell,
  Eye,
  Flame,
  Play,
  Plus,
} from 'lucide-react';
import { useRhythmData, useRhythmMutations } from '../../../services/api/useRhythmQueries';
import {
  formatJalaliDayMonth,
  formatJalaliFullDate,
  formatJalaliWeekRangeLabel,
  getPersianWeekdayName,
  getSaturdayToFridayWeekRange,
} from '../../../services/domain/jalaliCalendar';
import { estimateWorkoutSessionCalories } from '../../../services/domain/workoutCalorieCalculator';
import { computeWorkoutSummaryForSessions } from '../../../services/domain/workoutProgressCalculator';
import { rhythmNutritionAdapter } from '../../../services/repositories/workoutAdapters';
import { Button } from '../../../shared/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../shared/components/ui/Card';
import { Progress, Skeleton } from '../../../shared/components/ui/FormControls';
import { EXERCISE_TYPE_LABELS } from '../../../shared/constants/workout';
import { WorkoutSession, WorkoutSessionStatus } from '../../../shared/types/workout';
import { formatFaNumber, toPersianDigits } from '../../../shared/utils/cn';
import { SessionDetailSheet } from '../components/SessionDetailSheet';
import { SessionFormDialog } from '../components/SessionFormDialog';
import { WorkoutRunnerDrawer } from '../components/WorkoutRunnerDrawer';
import { WorkoutStatusLabel } from '../components/WorkoutStatusLabel';

export function WorkoutDashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useRhythmData();
  const { upsertWorkoutSession, saveWorkoutActivityLog } = useRhythmMutations();

  const currentWeek = useMemo(() => getSaturdayToFridayWeekRange('2026-11-19'), []);
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(5); // Default Thursday 2026-11-19
  const [detailSession, setDetailSession] = useState<WorkoutSession | null>(null);
  const [runnerSession, setRunnerSession] = useState<WorkoutSession | null>(null);
  const [editSession, setEditSession] = useState<WorkoutSession | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const computed = useMemo(() => {
    if (!data) return null;

    const exercisesById = Object.fromEntries(data.exercises.map((e) => [e.id, e]));
    const nutritionContext = rhythmNutritionAdapter.extractSharedContext(data);

    const weekSessions = data.workoutSessions.filter((s) =>
      currentWeek.dayDatesISO.includes(s.dateISO)
    );

    const summary = computeWorkoutSummaryForSessions(weekSessions, data.workoutActivityLogs);

    const scheduledCount = weekSessions.filter(
      (s) => s.status !== WorkoutSessionStatus.CANCELLED
    ).length;

    const nextWorkout =
      [...data.workoutSessions]
        .filter(
          (s) =>
            (s.status === WorkoutSessionStatus.PLANNED ||
              s.status === WorkoutSessionStatus.IN_PROGRESS) &&
            s.dateISO >= '2026-11-19'
        )
        .sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.startTime.localeCompare(b.startTime))[0] ??
      null;

    const sessionsByDay = currentWeek.dayDatesISO.map((dateISO) =>
      weekSessions
        .filter((s) => s.dateISO === dateISO)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
    );

    const logsBySessionId = Object.fromEntries(
      data.workoutActivityLogs.map((l) => [l.sessionId, l])
    );

    return {
      exercisesById,
      nutritionContext,
      weekSessions,
      summary,
      scheduledCount,
      nextWorkout,
      sessionsByDay,
      logsBySessionId,
    };
  }, [data, currentWeek]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((k) => (
            <Skeleton key={k} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-52 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !data || !computed) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-[var(--color-error)]">
          بارگذاری اطلاعات برنامه ورزشی با خطا مواجه شد.
        </CardContent>
      </Card>
    );
  }

  const {
    exercisesById,
    nutritionContext,
    summary,
    scheduledCount,
    nextWorkout,
    sessionsByDay,
    logsBySessionId,
  } = computed;

  const selectedDaySessions = sessionsByDay[selectedDayIdx] ?? [];
  const selectedDayISO = currentWeek.dayDatesISO[selectedDayIdx];

  const nextWorkoutEstimate = nextWorkout
    ? estimateWorkoutSessionCalories({
        weightKg: nutritionContext.userWeightKg,
        totalDurationMinutes: nextWorkout.estimatedDurationMinutes,
        exercises: nextWorkout.exercises,
        exercisesById,
        metReferenceTable: data.metReferenceTable,
        sessionFallbackType: nextWorkout.type,
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-balance text-[var(--text-primary)]">
            داشبورد برنامه ورزشی
          </h1>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            هفته جاری: {formatJalaliWeekRangeLabel(currentWeek.weekStartISO, currentWeek.weekEndISO)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/workout/exercises')}>
            <Dumbbell className="h-3.5 w-3.5" />
            <span>بانک حرکات</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/workout/planner')}>
            <Calendar className="h-3.5 w-3.5" />
            <span>برنامه‌ریز هفتگی</span>
          </Button>
          <Button size="sm" onClick={() => navigate('/workout/programs?new=1')}>
            <Plus className="h-3.5 w-3.5" />
            <span>ساخت برنامه</span>
          </Button>
        </div>
      </div>

      {/* 5 Summary KPI Cards */}
      <section aria-label="خلاصه وضعیت ورزش هفته" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-[var(--text-muted)]">جلسات برنامه‌ریزی‌شده هفته</div>
            <div className="mt-1.5 text-2xl font-bold text-[var(--text-primary)] tabular-nums">
              {formatFaNumber(scheduledCount)} جلسه
            </div>
            <div className="mt-2 text-xs text-[var(--text-secondary)] tabular-nums">
              {formatFaNumber(summary.plannedCount)} جلسه در پیش
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-[var(--text-muted)]">جلسات انجام‌شده</div>
            <div className="mt-1.5 text-2xl font-bold text-[var(--color-success)] tabular-nums">
              {formatFaNumber(summary.completedCount)} جلسه
            </div>
            <div className="mt-2 text-xs text-[var(--text-secondary)] tabular-nums">
              انجام‌نشده: {formatFaNumber(summary.missedCount)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-[var(--text-muted)]">مجموع زمان تمرین</div>
            <div className="mt-1.5 text-2xl font-bold text-[var(--text-primary)] tabular-nums">
              {formatFaNumber(summary.totalDurationMinutes)} دقیقه
            </div>
            <div className="mt-2 text-xs text-[var(--text-secondary)]">
              زمان واقعی ثبت‌شده هفته
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-[var(--text-muted)]">کالری تخمینی سوزانده‌شده</div>
            <div className="mt-1.5 text-2xl font-bold text-[var(--color-primary)] tabular-nums">
              {nutritionContext.userWeightKg
                ? `${formatFaNumber(summary.totalEstimatedCalories)} کیلوکالری`
                : '—'}
            </div>
            <div className="mt-2 text-xs text-[var(--text-muted)]">
              تخمینی بر اساس MET کل فعالیت
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="text-xs text-[var(--text-muted)]">درصد پایبندی به برنامه</div>
            <div className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
              {formatFaNumber(summary.adherencePercent)}٪
            </div>
            <Progress value={summary.adherencePercent} max={100} className="h-1.5" />
          </CardContent>
        </Card>
      </section>

      {/* Next Workout Card + Nutrition Summary Bridge */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <Card className="lg:col-span-8 flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle>تمرین بعدی شما</CardTitle>
                <CardDescription>آماده برای اجرا و ثبت رکوردهای واقعی</CardDescription>
              </div>
              {nextWorkout && <WorkoutStatusLabel status={nextWorkout.status} />}
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between gap-5">
            {nextWorkout ? (
              <>
                <div className="rounded-lg bg-[var(--color-primary-subtle)]/65 border border-[var(--border-subtle)] p-4 space-y-2.5">
                  <div className="text-lg font-bold text-[var(--text-primary)]">
                    {nextWorkout.title}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)] tabular-nums">
                    <span>
                      {getPersianWeekdayName(nextWorkout.dayIndex)} {formatJalaliFullDate(nextWorkout.dateISO)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>ساعت شروع: {toPersianDigits(nextWorkout.startTime)}</span>
                    <span aria-hidden="true">·</span>
                    <span>مدت تخمینی: {formatFaNumber(nextWorkout.estimatedDurationMinutes)} دقیقه</span>
                    <span aria-hidden="true">·</span>
                    <span>نوع: {EXERCISE_TYPE_LABELS[nextWorkout.type]}</span>
                  </div>
                  {nextWorkoutEstimate?.totalCalories !== null && nextWorkoutEstimate && (
                    <div className="text-xs text-[var(--color-primary)] tabular-nums">
                      مصرف انرژی تخمینی: حدود {formatFaNumber(nextWorkoutEstimate.totalCalories)} کیلوکالری
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={() => setRunnerSession(nextWorkout)}>
                    <Play className="h-4 w-4" />
                    <span>
                      {nextWorkout.status === WorkoutSessionStatus.IN_PROGRESS
                        ? 'ادامه تمرین'
                        : 'شروع تمرین'}
                    </span>
                  </Button>
                  <Button variant="outline" onClick={() => setDetailSession(nextWorkout)}>
                    <Eye className="h-4 w-4" />
                    <span>مشاهده تمرین</span>
                  </Button>
                </div>
              </>
            ) : (
              <div className="py-6 text-center space-y-3">
                <p className="text-sm text-[var(--text-secondary)]">
                  تمرین برنامه‌ریزی‌شده جدیدی در پیش نیست.
                </p>
                <Button size="sm" variant="outline" onClick={() => navigate('/workout/planner')}>
                  زمانبندی جلسه در برنامه‌ریز هفتگی
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 10: Read-only Nutrition & Workout Context Bridge */}
        <Card className="lg:col-span-4 flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-[var(--color-accent)]" />
              <CardTitle>نمای خلاصه ورزش و تغذیه</CardTitle>
            </div>
            <CardDescription>
              اتصال خواندنی با پروفایل مشترک (بدون تغییر خودکار اهداف غذایی)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
              <span className="text-[var(--text-secondary)]">وزن مبنا (از پروفایل)</span>
              <span className="font-semibold tabular-nums">
                {nutritionContext.userWeightKg
                  ? `${formatFaNumber(nutritionContext.userWeightKg)} کیلوگرم`
                  : 'ثبت نشده'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
              <span className="text-[var(--text-secondary)]">هدف کالری روزانه تغذیه</span>
              <span className="font-semibold tabular-nums">
                {nutritionContext.dailyCalorieTarget
                  ? `${formatFaNumber(nutritionContext.dailyCalorieTarget)} کیلوکالری`
                  : 'ثبت نشده'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
              <span className="text-[var(--text-secondary)]">کالری تخمینی ورزش این هفته</span>
              <span className="font-semibold text-[var(--color-primary)] tabular-nums">
                {formatFaNumber(summary.totalEstimatedCalories)} کیلوکالری
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed pt-1">
              کالری ورزشی به‌صورت خودکار با هدف تغذیه جمع یا تفریق نمی‌شود و تنها برای آگاهی در این نما کنار هم نمایش داده می‌شوند.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Sat-Fri Strip + Selected Day Sessions */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>برنامه هفتگی ورزش (شنبه تا جمعه)</CardTitle>
            <CardDescription>
              روی هر روز کلیک کنید تا جلسات تمرینی آن روز و جزئیات وضعیت نمایش داده شوند.
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/workout/planner')}>
            <span>مدیریت کامل هفته</span>
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
            {currentWeek.dayDatesISO.map((dateISO, idx) => {
              const dayList = sessionsByDay[idx] ?? [];
              const isSelected = selectedDayIdx === idx;
              const primaryStatus = dayList[0]?.status;
              return (
                <button
                  key={dateISO}
                  type="button"
                  onClick={() => setSelectedDayIdx(idx)}
                  className={`flex flex-col justify-between rounded-lg border p-3.5 text-right transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-subtle)]/70'
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
                    <div className="mt-2">
                      {primaryStatus ? (
                        <WorkoutStatusLabel status={primaryStatus} />
                      ) : (
                        <span className="text-xs text-[var(--text-muted)]">روز استراحت</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)] tabular-nums">
                    {dayList.length > 0
                      ? `${formatFaNumber(dayList.length)} جلسه`
                      : 'بدون جلسه'}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Day Sessions List */}
          <div className="pt-2 border-t border-[var(--border-subtle)] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                جلسات {getPersianWeekdayName(selectedDayIdx)} ({formatJalaliFullDate(selectedDayISO)})
              </h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditSession(null);
                  setEditOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>افزودن جلسه به این روز</span>
              </Button>
            </div>

            {selectedDaySessions.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-3">
                برای این روز جلسه ورزشی ثبت نشده است.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedDaySessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-col justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-[var(--text-primary)]">
                          {s.title}
                        </div>
                        <div className="mt-1 text-xs text-[var(--text-muted)] tabular-nums">
                          {EXERCISE_TYPE_LABELS[s.type]} · {toPersianDigits(s.startTime)} تا{' '}
                          {toPersianDigits(s.endTime)} ({formatFaNumber(s.estimatedDurationMinutes)} دقیقه)
                        </div>
                      </div>
                      <WorkoutStatusLabel status={s.status} />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setDetailSession(s)}>
                        جزئیات
                      </Button>
                      {s.status !== WorkoutSessionStatus.CANCELLED && (
                        <Button size="sm" onClick={() => setRunnerSession(s)}>
                          <Play className="h-3.5 w-3.5" />
                          <span>
                            {s.status === WorkoutSessionStatus.COMPLETED
                              ? 'مشاهده/اجرا'
                              : 'شروع تمرین'}
                          </span>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modals & Drawers */}
      <SessionDetailSheet
        session={detailSession}
        onClose={() => setDetailSession(null)}
        exercisesById={exercisesById}
        metReferenceTable={data.metReferenceTable}
        userWeightKg={nutritionContext.userWeightKg}
        onStartWorkout={(s) => setRunnerSession(s)}
        onEditSession={(s) => {
          setEditSession(s);
          setEditOpen(true);
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

      <SessionFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initialSession={editSession}
        defaultDateISO={selectedDayISO}
        programs={data.workoutPrograms}
        templates={data.workoutTemplates}
        exercises={data.exercises}
        allSessions={data.workoutSessions}
        onSave={async (session) => {
          await upsertWorkoutSession.mutateAsync(session);
        }}
      />
    </div>
  );
}
