import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, Eye, Flame, History, Timer, TrendingUp } from 'lucide-react';
import { useRhythmData } from '../../../services/api/useRhythmQueries';
import { addDaysToISO, formatJalaliFullDate } from '../../../services/domain/jalaliCalendar';
import { WORKOUT_CALORIE_DISCLAIMER } from '../../../services/domain/workoutCalorieCalculator';
import {
  buildExerciseStrengthTrend,
  buildMonthlyCompletedSeries,
  buildWeeklyProgressSeries,
  computeWorkoutSummaryForSessions,
} from '../../../services/domain/workoutProgressCalculator';
import { Button } from '../../../shared/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../shared/components/ui/Card';
import { Label, Select, Skeleton } from '../../../shared/components/ui/FormControls';
import { EmptyState, Sheet } from '../../../shared/components/ui/Overlays';
import { EXERCISE_TYPE_LABELS, WORKOUT_STATUS_LABELS } from '../../../shared/constants/workout';
import {
  ExerciseType,
  WorkoutActivityLog,
  WorkoutSession,
  WorkoutSessionStatus,
} from '../../../shared/types/workout';
import { formatFaNumber } from '../../../shared/utils/cn';
import { WorkoutStatusLabel } from '../components/WorkoutStatusLabel';

const DEMO_TODAY_ISO = '2026-11-19';

type DateRangeFilter = 'ALL' | '7D' | '30D';
type StatusFilter = 'ALL' | 'COMPLETED' | 'PARTIAL' | 'MISSED' | 'CANCELLED';

interface HistoryRow {
  id: string;
  dateISO: string;
  title: string;
  type: ExerciseType;
  durationMinutes: number;
  estimatedCalories: number | null;
  statusLabel: string;
  sessionStatus: WorkoutSessionStatus;
  completedExercisesCount: number;
  totalExercisesCount: number;
  log?: WorkoutActivityLog;
  session?: WorkoutSession;
}

export function WorkoutHistoryPage() {
  const { data, isLoading, isError } = useRhythmData();

  const [dateRange, setDateRange] = useState<DateRangeFilter>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | ExerciseType>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [selectedStrengthExerciseId, setSelectedStrengthExerciseId] = useState<string>('');
  const [selectedLogSheet, setSelectedLogSheet] = useState<WorkoutActivityLog | null>(null);

  const strengthExercises = useMemo(() => {
    if (!data) return [];
    return data.exercises.filter((e) => e.type === ExerciseType.STRENGTH);
  }, [data]);

  useEffect(() => {
    if (!selectedStrengthExerciseId && strengthExercises.length > 0 && data) {
      // Pick the first strength exercise that actually has progression data if available
      const withTrend = strengthExercises.find(
        (ex) => buildExerciseStrengthTrend(ex.id, data.workoutActivityLogs).length > 0
      );
      setSelectedStrengthExerciseId(withTrend?.id ?? strengthExercises[0].id);
    }
  }, [selectedStrengthExerciseId, strengthExercises, data]);

  const computed = useMemo(() => {
    if (!data) return null;

    const exercisesById = Object.fromEntries(data.exercises.map((e) => [e.id, e]));
    const logsBySessionId = new Map(data.workoutActivityLogs.map((l) => [l.sessionId, l]));

    const minDateISO =
      dateRange === '7D'
        ? addDaysToISO(DEMO_TODAY_ISO, -7)
        : dateRange === '30D'
        ? addDaysToISO(DEMO_TODAY_ISO, -30)
        : '0000-01-01';

    const filteredSessions = data.workoutSessions.filter((s) => {
      if (s.dateISO < minDateISO) return false;
      if (typeFilter !== 'ALL' && s.type !== typeFilter) return false;
      if (statusFilter === 'ALL') return true;
      const log = logsBySessionId.get(s.id);
      if (statusFilter === 'PARTIAL') return log?.status === 'PARTIAL';
      if (statusFilter === 'COMPLETED') {
        return s.status === WorkoutSessionStatus.COMPLETED && log?.status !== 'PARTIAL';
      }
      if (statusFilter === 'MISSED') return s.status === WorkoutSessionStatus.MISSED;
      if (statusFilter === 'CANCELLED') return s.status === WorkoutSessionStatus.CANCELLED;
      return true;
    });

    const filteredLogs = data.workoutActivityLogs.filter((l) => {
      if (l.dateISO < minDateISO) return false;
      if (typeFilter !== 'ALL' && l.type !== typeFilter) return false;
      if (statusFilter !== 'ALL' && l.status !== statusFilter) return false;
      return true;
    });

    const summary = computeWorkoutSummaryForSessions(filteredSessions, filteredLogs);
    const weeklySeries = buildWeeklyProgressSeries(filteredSessions, filteredLogs);
    const monthlySeries = buildMonthlyCompletedSeries(filteredLogs);
    const strengthTrend = selectedStrengthExerciseId
      ? buildExerciseStrengthTrend(selectedStrengthExerciseId, data.workoutActivityLogs)
      : [];

    const historyRows: HistoryRow[] = [...filteredSessions]
      .filter((s) => s.status !== WorkoutSessionStatus.PLANNED)
      .sort((a, b) => b.dateISO.localeCompare(a.dateISO) || b.startTime.localeCompare(a.startTime))
      .map((s) => {
        const log = logsBySessionId.get(s.id);
        return {
          id: s.id,
          dateISO: s.dateISO,
          title: s.title,
          type: s.type,
          durationMinutes: log ? log.actualDurationMinutes : s.estimatedDurationMinutes,
          estimatedCalories: log?.estimatedCalories ?? null,
          statusLabel:
            log?.status === 'PARTIAL'
              ? 'ناقص (ثبت‌شده)'
              : WORKOUT_STATUS_LABELS[s.status],
          sessionStatus: s.status,
          completedExercisesCount: log?.completedExercisesCount ?? 0,
          totalExercisesCount: log?.totalExercisesCount ?? s.exercises.length,
          log,
          session: s,
        };
      });

    return {
      exercisesById,
      summary,
      weeklySeries,
      monthlySeries,
      strengthTrend,
      historyRows,
    };
  }, [data, dateRange, typeFilter, statusFilter, selectedStrengthExerciseId]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !data || !computed) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-[var(--color-error)]">
          بارگذاری تاریخچه و آمار پیشرفت با خطا مواجه شد.
        </CardContent>
      </Card>
    );
  }

  const { exercisesById, summary, weeklySeries, monthlySeries, strengthTrend, historyRows } =
    computed;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-balance text-[var(--text-primary)]">
            تاریخچه و روند پیشرفت ورزش
          </h1>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            بررسی سوابق تمرین‌های انجام‌شده، کالری تخمینی و پیشرفت رکوردهای قدرتی
          </p>
        </div>
      </div>

      {/* Filters Card */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="hist-range">بازه زمانی</Label>
              <Select
                id="hist-range"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRangeFilter)}
              >
                <option value="ALL">همه زمان‌ها</option>
                <option value="7D">۷ روز اخیر</option>
                <option value="30D">۳۰ روز اخیر</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="hist-type">نوع تمرین</Label>
              <Select
                id="hist-type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as 'ALL' | ExerciseType)}
              >
                <option value="ALL">همه انواع</option>
                {Object.values(ExerciseType).map((t) => (
                  <option key={t} value={t}>
                    {EXERCISE_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="hist-status">وضعیت</Label>
              <Select
                id="hist-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              >
                <option value="ALL">همه وضعیت‌ها</option>
                <option value="COMPLETED">تکمیل‌شده</option>
                <option value="PARTIAL">ثبت ناقص (جزئی)</option>
                <option value="MISSED">انجام‌نشده</option>
                <option value="CANCELLED">لغوشده</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <Activity className="h-3.5 w-3.5 text-[var(--color-success)]" />
              <span>جلسات تکمیل‌شده</span>
            </div>
            <div className="mt-1.5 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
              {formatFaNumber(summary.completedCount)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <Timer className="h-3.5 w-3.5 text-[var(--color-primary)]" />
              <span>مجموع زمان واقعی</span>
            </div>
            <div className="mt-1.5 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
              {formatFaNumber(summary.totalDurationMinutes)} دقیقه
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <Flame className="h-3.5 w-3.5 text-[var(--color-accent)]" />
              <span>کالری تخمینی کل</span>
            </div>
            <div className="mt-1.5 text-2xl font-bold tabular-nums text-[var(--color-primary)]">
              {formatFaNumber(summary.totalEstimatedCalories)} کیلوکالری
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <TrendingUp className="h-3.5 w-3.5 text-[var(--color-primary)]" />
              <span>نرخ پایبندی</span>
            </div>
            <div className="mt-1.5 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
              {formatFaNumber(summary.adherencePercent)}٪
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4 Recharts Analytics Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Weekly Duration */}
        <Card>
          <CardHeader>
            <CardTitle>مجموع زمان ورزش در هفته (دقیقه)</CardTitle>
            <CardDescription>روند هفتگی دقایق فعالیت ثبت‌شده</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {weeklySeries.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-[var(--text-muted)]">
                داده‌ای در این فیلتر وجود ندارد.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklySeries} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="weekLabel" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <Tooltip
                    formatter={(val) => [`${formatFaNumber(Number(val))} دقیقه`, 'زمان تمرین']}
                    contentStyle={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-subtle)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="totalMinutes" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Chart 2: Weekly Estimated Calories */}
        <Card>
          <CardHeader>
            <CardTitle>کالری تخمینی در هفته (کیلوکالری)</CardTitle>
            <CardDescription>محاسبه تخمینی بر اساس جدول MET و وزن پروفایل</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {weeklySeries.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-[var(--text-muted)]">
                داده‌ای در این فیلتر وجود ندارد.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklySeries} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="weekLabel" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <Tooltip
                    formatter={(val) => [`${formatFaNumber(Number(val))} کیلوکالری`, 'کالری تخمینی']}
                    contentStyle={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-subtle)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="totalCalories" fill="var(--color-accent)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Chart 3: Monthly Completed Sessions + Weekly Adherence */}
        <Card>
          <CardHeader>
            <CardTitle>تعداد جلسات انجام‌شده در ماه</CardTitle>
            <CardDescription>تعداد جلسات تکمیل‌شده یا جزئی در هر ماه شمسی</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {monthlySeries.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-[var(--text-muted)]">
                هنوز جلسه ثبت‌شده‌ای در این بازه وجود ندارد.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlySeries} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <Tooltip
                    formatter={(val) => [`${formatFaNumber(Number(val))} جلسه`, 'تکمیل‌شده']}
                    contentStyle={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-subtle)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="completedCount" fill="var(--color-success)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Chart 4: Weekly Adherence % + Strength Weight Progression */}
        <Card>
          <CardHeader className="flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle>روند وزنه و پایبندی</CardTitle>
              <CardDescription>بیشینه وزنه و تکرار ثبت‌شده برای حرکت قدرتی انتخابی</CardDescription>
            </div>
            <div className="w-full sm:w-52">
              <Select
                aria-label="انتخاب حرکت قدرتی"
                value={selectedStrengthExerciseId}
                onChange={(e) => setSelectedStrengthExerciseId(e.target.value)}
                className="h-9 text-xs"
              >
                {strengthExercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.persianName}
                  </option>
                ))}
              </Select>
            </div>
          </CardHeader>
          <CardContent className="h-64">
            {strengthTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={strengthTrend} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <Tooltip
                    formatter={(val, name) => [
                      name === 'maxWeightKg'
                        ? `${formatFaNumber(Number(val))} کیلوگرم`
                        : `${formatFaNumber(Number(val))} تکرار`,
                      name === 'maxWeightKg' ? 'بیشینه وزنه' : 'بیشینه تکرار',
                    ]}
                    contentStyle={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-subtle)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="maxWeightKg"
                    stroke="var(--color-primary)"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="maxReps"
                    stroke="var(--color-accent)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : weeklySeries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklySeries} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="weekLabel" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <Tooltip
                    formatter={(val) => [`${formatFaNumber(Number(val))}٪`, 'درصد پایبندی']}
                    contentStyle={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-subtle)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="adherencePercent"
                    stroke="var(--color-primary)"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[var(--text-muted)]">
                رکوردی برای این حرکت ثبت نشده است.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* History Log Table */}
      <Card>
        <CardHeader>
          <CardTitle>سوابق جلسات تمرینی</CardTitle>
          <CardDescription>
            {WORKOUT_CALORIE_DISCLAIMER}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historyRows.length === 0 ? (
            <EmptyState
              icon={<History className="h-5 w-5" />}
              title="سابقه‌ای با فیلتر فعلی یافت نشد"
              description="تنظیمات فیلتر تاریخ، نوع یا وضعیت را تغییر دهید یا یک جلسه تمرینی را اجرا و ثبت نمایید."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                    <th className="py-3 px-2 font-medium">تاریخ</th>
                    <th className="py-3 px-2 font-medium">عنوان تمرین</th>
                    <th className="py-3 px-2 font-medium">نوع</th>
                    <th className="py-3 px-2 font-medium">مدت</th>
                    <th className="py-3 px-2 font-medium">کالری (تخمینی)</th>
                    <th className="py-3 px-2 font-medium">وضعیت</th>
                    <th className="py-3 px-2 font-medium">حرکات</th>
                    <th className="py-3 px-2 font-medium text-left">جزئیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {historyRows.map((row) => (
                    <tr key={row.id} className="hover:bg-[var(--bg-surface-muted)]/40">
                      <td className="py-3 px-2 tabular-nums whitespace-nowrap">
                        {formatJalaliFullDate(row.dateISO)}
                      </td>
                      <td className="py-3 px-2 font-semibold text-[var(--text-primary)]">
                        {row.title}
                      </td>
                      <td className="py-3 px-2 text-[var(--text-secondary)]">
                        {EXERCISE_TYPE_LABELS[row.type]}
                      </td>
                      <td className="py-3 px-2 tabular-nums whitespace-nowrap">
                        {formatFaNumber(row.durationMinutes)} دقیقه
                      </td>
                      <td className="py-3 px-2 tabular-nums whitespace-nowrap text-[var(--color-primary)]">
                        {row.estimatedCalories !== null
                          ? `${formatFaNumber(row.estimatedCalories)} کیلوکالری`
                          : 'نامشخص'}
                      </td>
                      <td className="py-3 px-2 whitespace-nowrap">
                        {row.log?.status === 'PARTIAL' ? (
                          <span className="text-[var(--color-warning)] font-medium">
                            {row.statusLabel}
                          </span>
                        ) : (
                          <WorkoutStatusLabel status={row.sessionStatus} />
                        )}
                      </td>
                      <td className="py-3 px-2 tabular-nums whitespace-nowrap">
                        {formatFaNumber(row.completedExercisesCount)} از{' '}
                        {formatFaNumber(row.totalExercisesCount)}
                      </td>
                      <td className="py-3 px-2 text-left">
                        {row.log ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedLogSheet(row.log ?? null)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>رکوردها</span>
                          </Button>
                        ) : (
                          <span className="text-[11px] text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recorded Execution Snapshot Sheet */}
      <Sheet
        open={Boolean(selectedLogSheet)}
        onClose={() => setSelectedLogSheet(null)}
        title={selectedLogSheet?.title ?? 'جزئیات رکورد تمرین'}
        subtitle={
          selectedLogSheet
            ? `${formatJalaliFullDate(selectedLogSheet.dateISO)} · ${formatFaNumber(
                selectedLogSheet.actualDurationMinutes
              )} دقیقه واقعی`
            : ''
        }
      >
        {selectedLogSheet && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-[var(--bg-surface-muted)] p-3">
                <div className="text-[var(--text-muted)]">کالری تخمینی</div>
                <div className="mt-1 font-bold text-sm text-[var(--color-primary)] tabular-nums">
                  {selectedLogSheet.estimatedCalories !== null
                    ? `${formatFaNumber(selectedLogSheet.estimatedCalories)} کیلوکالری`
                    : 'نامشخص'}
                </div>
              </div>
              <div className="rounded-lg bg-[var(--bg-surface-muted)] p-3">
                <div className="text-[var(--text-muted)]">ست‌های انجام‌شده</div>
                <div className="mt-1 font-bold text-sm tabular-nums">
                  {formatFaNumber(selectedLogSheet.completedSetsCount)} از{' '}
                  {formatFaNumber(selectedLogSheet.totalSetsCount)}
                </div>
              </div>
            </div>

            {selectedLogSheet.userNotes && (
              <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                <span className="font-semibold">یادداشت کاربر: </span>
                {selectedLogSheet.userNotes}
              </div>
            )}

            <div className="space-y-2.5">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                رکوردهای ثبت‌شده حرکات
              </h3>
              {selectedLogSheet.exercisesSnapshot.map((ex, idx) => {
                const meta = exercisesById[ex.exerciseId];
                return (
                  <div
                    key={ex.id}
                    className="rounded-lg border border-[var(--border-subtle)] p-3 space-y-1.5"
                  >
                    <div className="font-semibold text-[var(--text-primary)]">
                      {formatFaNumber(idx + 1)}. {meta?.persianName ?? 'حرکت'}
                    </div>
                    {ex.exerciseType === ExerciseType.STRENGTH && ex.sets.length > 0 ? (
                      <div className="space-y-1 tabular-nums text-[var(--text-secondary)]">
                        {ex.sets.map((st) => (
                          <div key={st.id} className="flex items-center justify-between">
                            <span>
                              ست {formatFaNumber(st.setNumber)}:{' '}
                              {formatFaNumber(st.actualReps ?? st.targetReps ?? 0)} تکرار ×{' '}
                              {formatFaNumber(st.actualWeightKg ?? st.targetWeightKg ?? 0)} کیلوگرم
                            </span>
                            <span
                              className={
                                st.isCompleted ? 'text-[var(--color-success)]' : 'text-[var(--text-muted)]'
                              }
                            >
                              {st.isCompleted ? 'تکمیل‌شده' : 'انجام‌نشده'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : ex.exerciseType === ExerciseType.CARDIO ? (
                      <div className="text-[var(--text-secondary)] tabular-nums">
                        مدت واقعی: {formatFaNumber(ex.actualDurationMinutes ?? ex.targetDurationMinutes ?? 0)} دقیقه
                        {ex.actualDistanceKm ? ` · مسافت ${formatFaNumber(ex.actualDistanceKm, 1)} کیلومتر` : ''}
                        {ex.perceivedRpe ? ` · RPE ${formatFaNumber(ex.perceivedRpe)}/۱۰` : ''}
                      </div>
                    ) : (
                      <div className="text-[var(--text-secondary)]">
                        وضعیت: {ex.isCompleted ? 'انجام شد' : 'ثبت‌نشده'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
