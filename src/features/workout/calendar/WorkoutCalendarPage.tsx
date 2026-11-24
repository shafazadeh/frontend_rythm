import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  Info,
  Play,
  Plus,
} from 'lucide-react';
import { useRhythmData, useRhythmMutations } from '../../../services/api/useRhythmQueries';
import {
  addDaysToISO,
  formatJalaliDayMonth,
  formatJalaliFullDate,
  formatJalaliWeekRangeLabel,
  getJalaliMonthCalendarGrid,
  getJalaliNumericParts,
  getPersianDayIndexFromISO,
  getPersianWeekdayName,
  getSaturdayToFridayWeekRange,
  shiftJalaliMonthISO,
} from '../../../services/domain/jalaliCalendar';
import { checkWorkoutSessionConflicts } from '../../../services/domain/scheduleConflictChecker';
import {
  calendarIntegrationAdapter,
  rhythmNutritionAdapter,
} from '../../../services/repositories/workoutAdapters';
import { Button } from '../../../shared/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../shared/components/ui/Card';
import { Skeleton } from '../../../shared/components/ui/FormControls';
import { PERSIAN_WEEKDAY_NAMES } from '../../../shared/constants/units';
import { EXERCISE_TYPE_LABELS } from '../../../shared/constants/workout';
import { WorkoutSession, WorkoutSessionStatus } from '../../../shared/types/workout';
import { formatFaNumber, toPersianDigits } from '../../../shared/utils/cn';
import { SessionDetailSheet } from '../components/SessionDetailSheet';
import { SessionFormDialog } from '../components/SessionFormDialog';
import { WorkoutRunnerDrawer } from '../components/WorkoutRunnerDrawer';
import { WORKOUT_STATUS_META, WorkoutStatusLabel } from '../components/WorkoutStatusLabel';

const DEMO_TODAY_ISO = '2026-11-19';

export function WorkoutCalendarPage() {
  const { data, isLoading, isError } = useRhythmData();
  const { upsertWorkoutSession, saveWorkoutActivityLog } = useRhythmMutations();

  const [viewMode, setViewMode] = useState<'MONTH' | 'WEEK'>('MONTH');
  const [anchorISO, setAnchorISO] = useState<string>(DEMO_TODAY_ISO);
  const [selectedDateISO, setSelectedDateISO] = useState<string>(DEMO_TODAY_ISO);
  const [formOpen, setFormOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<WorkoutSession | null>(null);
  const [detailSession, setDetailSession] = useState<WorkoutSession | null>(null);
  const [runnerSession, setRunnerSession] = useState<WorkoutSession | null>(null);

  const monthGrid = useMemo(() => getJalaliMonthCalendarGrid(anchorISO), [anchorISO]);
  const weekRange = useMemo(() => getSaturdayToFridayWeekRange(anchorISO), [anchorISO]);
  const anchorParts = useMemo(() => getJalaliNumericParts(anchorISO), [anchorISO]);

  const computed = useMemo(() => {
    if (!data) return null;

    const exercisesById = Object.fromEntries(data.exercises.map((e) => [e.id, e]));
    const logsBySessionId = Object.fromEntries(data.workoutActivityLogs.map((l) => [l.sessionId, l]));
    const nutritionContext = rhythmNutritionAdapter.extractSharedContext(data);

    const sessionsByDate = new Map<string, WorkoutSession[]>();
    for (const s of data.workoutSessions) {
      const list = sessionsByDate.get(s.dateISO) ?? [];
      list.push(s);
      sessionsByDate.set(s.dateISO, list);
    }
    for (const [, list] of sessionsByDate) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }

    return {
      exercisesById,
      logsBySessionId,
      nutritionContext,
      sessionsByDate,
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-[440px] w-full" />
      </div>
    );
  }

  if (isError || !data || !computed) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-[var(--color-error)]">
          بارگذاری تقویم تمرینی با خطا مواجه شد.
        </CardContent>
      </Card>
    );
  }

  const { exercisesById, logsBySessionId, nutritionContext, sessionsByDate } = computed;
  const selectedDaySessions = sessionsByDate.get(selectedDateISO) ?? [];
  const selectedDayIndex = getPersianDayIndexFromISO(selectedDateISO);

  const handleNavigatePrev = () => {
    setAnchorISO((prev) =>
      viewMode === 'MONTH' ? shiftJalaliMonthISO(prev, -1) : addDaysToISO(prev, -7)
    );
  };

  const handleNavigateNext = () => {
    setAnchorISO((prev) =>
      viewMode === 'MONTH' ? shiftJalaliMonthISO(prev, 1) : addDaysToISO(prev, 7)
    );
  };

  const handleJumpToday = () => {
    setAnchorISO(DEMO_TODAY_ISO);
    setSelectedDateISO(DEMO_TODAY_ISO);
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-balance text-[var(--text-primary)]">
            تقویم تمرین‌ها
          </h1>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            مشاهده، جابه‌جایی زمان جلسات و ثبت مستقیم اجرای تمرین روی تقویم شمسی
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex rounded-lg bg-[var(--bg-surface-muted)] p-1">
            <button
              type="button"
              onClick={() => setViewMode('MONTH')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                viewMode === 'MONTH'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              نمایش ماهانه
            </button>
            <button
              type="button"
              onClick={() => setViewMode('WEEK')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                viewMode === 'WEEK'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              نمایش هفتگی
            </button>
          </div>

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

      {/* Calendar Grid + Selected Day Drawer Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <Card className="xl:col-span-8">
          <CardHeader className="flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-[var(--color-primary)]" />
              <CardTitle className="tabular-nums">
                {viewMode === 'MONTH'
                  ? `${anchorParts.monthName} ${toPersianDigits(anchorParts.year)}`
                  : formatJalaliWeekRangeLabel(weekRange.weekStartISO, weekRange.weekEndISO)}
              </CardTitle>
            </div>

            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={handleNavigatePrev} aria-label="بازه قبلی">
                <ChevronRight className="h-4 w-4" />
                <span>{viewMode === 'MONTH' ? 'ماه قبل' : 'هفته قبل'}</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleJumpToday}>
                امروز
              </Button>
              <Button variant="outline" size="sm" onClick={handleNavigateNext} aria-label="بازه بعدی">
                <span>{viewMode === 'MONTH' ? 'ماه بعد' : 'هفته بعد'}</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Weekday Headers (Saturday -> Friday) */}
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-[var(--text-secondary)] pb-1 border-b border-[var(--border-subtle)]">
              {PERSIAN_WEEKDAY_NAMES.map((dayName) => (
                <div key={dayName} className="py-1 truncate">
                  {dayName}
                </div>
              ))}
            </div>

            {viewMode === 'MONTH' ? (
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {monthGrid.cells.map((cell) => {
                  const daySessions = sessionsByDate.get(cell.isoDate) ?? [];
                  const isSelected = selectedDateISO === cell.isoDate;
                  const isToday = cell.isoDate === DEMO_TODAY_ISO;

                  return (
                    <button
                      key={cell.isoDate}
                      type="button"
                      onClick={() => setSelectedDateISO(cell.isoDate)}
                      className={`min-h-[82px] sm:min-h-[96px] flex flex-col justify-between rounded-lg border p-2 text-right transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary-subtle)]/70'
                          : isToday
                          ? 'border-[var(--color-accent)]/60 bg-[var(--bg-canvas)]'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)] hover:border-[var(--color-primary)]/50'
                      } ${!cell.isCurrentMonth ? 'opacity-45' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-xs font-bold tabular-nums ${
                            isToday ? 'text-[var(--color-accent)]' : 'text-[var(--text-primary)]'
                          }`}
                        >
                          {toPersianDigits(cell.persianDay)}
                        </span>
                        {daySessions.length > 0 && (
                          <span className="text-[10px] text-[var(--text-muted)] tabular-nums">
                            {formatFaNumber(daySessions.length)}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 mt-1.5 overflow-hidden">
                        {daySessions.slice(0, 2).map((s) => {
                          const meta = WORKOUT_STATUS_META[s.status];
                          return (
                            <div
                              key={s.id}
                              className={`rounded border px-1.5 py-0.5 text-[10px] font-medium truncate ${meta.surfaceClass} ${meta.textClass}`}
                              title={`${s.title} (${meta.label})`}
                            >
                              {s.title}
                            </div>
                          );
                        })}
                        {daySessions.length > 2 && (
                          <div className="text-[10px] text-[var(--text-muted)] tabular-nums">
                            +{formatFaNumber(daySessions.length - 2)} مورد دیگر
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
                {weekRange.dayDatesISO.map((iso, idx) => {
                  const daySessions = sessionsByDate.get(iso) ?? [];
                  const isSelected = selectedDateISO === iso;
                  const isToday = iso === DEMO_TODAY_ISO;

                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => setSelectedDateISO(iso)}
                      className={`min-h-[170px] flex flex-col justify-between rounded-lg border p-2.5 text-right transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary-subtle)]/70'
                          : isToday
                          ? 'border-[var(--color-accent)]/60 bg-[var(--bg-canvas)]'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)] hover:border-[var(--color-primary)]/50'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs pb-1.5 border-b border-[var(--border-subtle)]">
                          <span className="font-semibold text-[var(--text-primary)]">
                            {getPersianWeekdayName(idx)}
                          </span>
                          <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                            {formatJalaliDayMonth(iso)}
                          </span>
                        </div>

                        {daySessions.length === 0 ? (
                          <div className="text-[11px] text-[var(--text-muted)] py-3">
                            روز استراحت
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {daySessions.map((s) => {
                              const meta = WORKOUT_STATUS_META[s.status];
                              return (
                                <div
                                  key={s.id}
                                  className={`rounded-md border p-1.5 text-[11px] space-y-0.5 ${meta.surfaceClass}`}
                                >
                                  <div className={`font-semibold truncate ${meta.textClass}`}>
                                    {s.title}
                                  </div>
                                  <div className="text-[10px] text-[var(--text-secondary)] tabular-nums">
                                    {toPersianDigits(s.startTime)} · {meta.label}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Status Legend (Text + Color) */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-3 border-t border-[var(--border-subtle)] text-xs">
              {Object.values(WorkoutSessionStatus).map((st) => (
                <WorkoutStatusLabel key={st} status={st} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Selected Day Details Panel */}
        <Card className="xl:col-span-4">
          <CardHeader>
            <CardTitle>
              {getPersianWeekdayName(selectedDayIndex)} {formatJalaliFullDate(selectedDateISO)}
            </CardTitle>
            <CardDescription>
              جلسات ثبت‌شده برای این تاریخ و مدیریت سریع زمانبندی
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                setEditingSession(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>افزودن جلسه در این روز</span>
            </Button>

            {selectedDaySessions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--border-subtle)] py-8 px-4 text-center text-xs text-[var(--text-muted)]">
                هیچ جلسه تمرینی برای این تاریخ ثبت نشده است.
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDaySessions.map((s) => {
                  const conflicts = checkWorkoutSessionConflicts(s, data.workoutSessions);
                  return (
                    <div
                      key={s.id}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3.5 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-bold text-[var(--text-primary)]">
                            {s.title}
                          </div>
                          <div className="mt-1 text-xs text-[var(--text-secondary)] tabular-nums">
                            {toPersianDigits(s.startTime)} تا {toPersianDigits(s.endTime)} ·{' '}
                            {formatFaNumber(s.estimatedDurationMinutes)} دقیقه
                          </div>
                          <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                            {EXERCISE_TYPE_LABELS[s.type]}
                          </div>
                        </div>
                        <WorkoutStatusLabel status={s.status} />
                      </div>

                      {conflicts.hasConflict && (
                        <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-warning)]">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span>دارای تداخل زمانی با جلسه دیگر</span>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border-subtle)]">
                        {s.status !== WorkoutSessionStatus.CANCELLED && (
                          <Button size="sm" onClick={() => setRunnerSession(s)}>
                            <Play className="h-3.5 w-3.5" />
                            <span>
                              {s.status === WorkoutSessionStatus.COMPLETED ? 'مشاهده اجرا' : 'شروع'}
                            </span>
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setDetailSession(s)}>
                          <Eye className="h-3.5 w-3.5" />
                          <span>جزئیات</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingSession(s);
                            setFormOpen(true);
                          }}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>جابه‌جایی/ویرایش</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Extensible Calendar Integration Adapter Note */}
            <div className="flex items-start gap-2 rounded-lg bg-[var(--bg-surface-muted)]/60 p-3 text-[11px] text-[var(--text-muted)] leading-relaxed">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                وضعیت اتصال تقویم خارجی: {calendarIntegrationAdapter.providerName} — معماری آداپتور تقویم برای اتصال آینده آماده است.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modals & Drawers */}
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
    </div>
  );
}
