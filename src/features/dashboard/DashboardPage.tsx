import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Play,
  ShoppingBasket,
  Sparkles,
} from 'lucide-react';
import { useRhythmData, useRhythmMutations } from '../../services/api/useRhythmQueries';
import {
  formatJalaliDayMonth,
  formatJalaliWeekRangeLabel,
  getNextSaturdayToFridayWeekRange,
  getPersianWeekdayName,
  isPlanningReminderWindowActive,
} from '../../services/domain/jalaliCalendar';
import {
  calculateWeeklyNutritionSummary,
  NutritionContext,
} from '../../services/domain/nutritionCalculator';
import { Button } from '../../shared/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../shared/components/ui/Card';
import { Progress, Skeleton } from '../../shared/components/ui/FormControls';
import { DailyStatusLabel } from '../../shared/components/StatusText';
import { formatFaNumber } from '../../shared/utils/cn';
import { useAppStore } from '../../store/useAppStore';

export function DashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useRhythmData();
  const { startPlanningSession, updatePlanningSession } = useRhythmMutations();
  const { simulateThursday10AM } = useAppStore();

  const computed = useMemo(() => {
    if (!data) return null;

    const currentPlan = data.weeklyPlans[0];
    const ingredientsById = Object.fromEntries(data.ingredients.map((i) => [i.id, i]));
    const recipesById = Object.fromEntries(data.recipes.map((r) => [r.id, r]));
    const foodItemsById = Object.fromEntries(data.foodItems.map((f) => [f.id, f]));
    const context: NutritionContext = { ingredientsById, recipesById, foodItemsById };

    const weekSummary = currentPlan
      ? calculateWeeklyNutritionSummary(currentPlan.days, context, data.target)
      : null;

    const shoppingList =
      data.shoppingLists.find((l) => l.weeklyPlanId === currentPlan?.id) ?? data.shoppingLists[0];
    const totalShop = shoppingList?.items.length ?? 0;
    const boughtShop = shoppingList?.items.filter((i) => i.isChecked).length ?? 0;
    const remainingShop = Math.max(0, totalShop - boughtShop);

    const refNow = simulateThursday10AM
      ? new Date('2026-11-19T10:15:00+03:30')
      : new Date();
    const reminderWindow = isPlanningReminderWindowActive(
      refNow,
      data.profile.timezone,
      data.agentPreferences.reminderConfig.dayOfWeek,
      data.agentPreferences.reminderConfig.time24h
    );

    const nextWeekRange = getNextSaturdayToFridayWeekRange('2026-11-19');
    const nextWeekPlan = data.weeklyPlans.find(
      (p) => p.weekStartISO === nextWeekRange.weekStartISO
    );

    return {
      currentPlan,
      weekSummary,
      totalShop,
      boughtShop,
      remainingShop,
      reminderWindow,
      nextWeekRange,
      nextWeekPlan,
    };
  }, [data, simulateThursday10AM]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((k) => (
            <Skeleton key={k} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-44 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-52 w-full" />
          <Skeleton className="h-52 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !data || !computed) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-[var(--color-error)]">
          بارگذاری اطلاعات داشبورد با خطا مواجه شد. لطفاً صفحه را مجدداً بارگذاری کنید.
        </CardContent>
      </Card>
    );
  }

  const {
    currentPlan,
    weekSummary,
    totalShop,
    boughtShop,
    remainingShop,
    reminderWindow,
    nextWeekRange,
    nextWeekPlan,
  } = computed;

  const handleStartNextWeek = async () => {
    await startPlanningSession.mutateAsync('NEXT');
    navigate('/nutrition/planner');
  };

  const handleResumeDraft = async () => {
    if (data.planningSession) {
      navigate('/nutrition/planner');
    } else if (currentPlan) {
      await updatePlanningSession.mutateAsync({
        id: `psess_${Date.now()}`,
        targetWeekStartISO: currentPlan.weekStartISO,
        targetWeekEndISO: currentPlan.weekEndISO,
        currentStep: 3,
        activeDayIndex: Math.max(
          0,
          currentPlan.days.findIndex((d) => d.status !== 'CONFIRMED')
        ),
        weeklyPlanId: currentPlan.id,
        isActive: true,
        updatedAt: new Date().toISOString(),
      });
      navigate('/nutrition/planner');
    }
  };

  const handleJumpToDay = async (dayIndex: number) => {
    if (!currentPlan) return;
    await updatePlanningSession.mutateAsync({
      id: `psess_${Date.now()}`,
      targetWeekStartISO: currentPlan.weekStartISO,
      targetWeekEndISO: currentPlan.weekEndISO,
      currentStep: 3,
      activeDayIndex: dayIndex,
      weeklyPlanId: currentPlan.id,
      isActive: true,
      updatedAt: new Date().toISOString(),
    });
    navigate(`/nutrition/planner?day=${dayIndex}`);
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-balance text-[var(--text-primary)]">
            نمای کلی هفته
          </h1>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {currentPlan
              ? `هفته جاری: ${formatJalaliWeekRangeLabel(currentPlan.weekStartISO, currentPlan.weekEndISO)}`
              : 'هنوز برنامه‌ای برای هفته جاری ثبت نشده است'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/nutrition/recipes')}>
            بانک غذاها
          </Button>
          <Button size="sm" onClick={handleStartNextWeek}>
            <Sparkles className="h-3.5 w-3.5" />
            <span>شروع برنامه‌ریزی هفته آینده</span>
          </Button>
        </div>
      </div>

      {/* Section 1: Week Summary KPI Strip */}
      <section aria-label="خلاصه هفته" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-[var(--text-muted)]">بازه هفته جاری</div>
            <div className="mt-1.5 text-sm font-semibold text-[var(--text-primary)] tabular-nums">
              {currentPlan
                ? formatJalaliWeekRangeLabel(currentPlan.weekStartISO, currentPlan.weekEndISO)
                : '—'}
            </div>
            <div className="mt-2 text-xs text-[var(--text-secondary)] tabular-nums">
              {formatFaNumber(weekSummary?.plannedDaysCount ?? 0)} روز برنامه‌ریزی‌شده
              <span aria-hidden="true" className="mx-1.5">·</span>
              {formatFaNumber(weekSummary?.confirmedDaysCount ?? 0)} روز تأییدشده
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-[var(--text-muted)]">میانگین کالری برنامه‌ریزی‌شده</div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
                {formatFaNumber(weekSummary?.averageCalories ?? 0)}
              </span>
              <span className="text-xs text-[var(--text-muted)]">کیلوکالری / روز</span>
            </div>
            <div className="mt-2 text-xs text-[var(--text-secondary)] tabular-nums">
              هدف روزانه: {formatFaNumber(data.target.dailyCalories)} کیلوکالری
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-[var(--text-muted)]">میانگین درشت‌مغذی‌ها</div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-[var(--color-primary)] tabular-nums">
                {formatFaNumber(weekSummary?.averageProtein ?? 0)}
              </span>
              <span className="text-xs text-[var(--text-muted)]">گرم پروتئین</span>
            </div>
            <div className="mt-2 text-xs text-[var(--text-secondary)] tabular-nums">
              کربوهیدرات: {formatFaNumber(weekSummary?.averageCarbs ?? 0)} گ
              <span aria-hidden="true" className="mx-1.5">·</span>
              چربی: {formatFaNumber(weekSummary?.averageFat ?? 0)} گ
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-[var(--text-muted)]">اقلام باقیمانده لیست خرید</div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
                {formatFaNumber(remainingShop)}
              </span>
              <span className="text-xs text-[var(--text-muted)]">قلم در انتظار خرید</span>
            </div>
            <div className="mt-2 text-xs text-[var(--text-secondary)] tabular-nums">
              {formatFaNumber(boughtShop)} از {formatFaNumber(totalShop)} قلم خریداری شده
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Section 2: 7-Day Meal Plan Grid (Saturday to Friday) */}
      <section aria-label="وضعیت برنامه غذایی روزهای هفته">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>وضعیت برنامه غذایی هفتگی</CardTitle>
              <CardDescription>
                برای بررسی، جایگزینی مواد یا تأیید برنامه روی هر روز کلیک کنید.
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/nutrition/planner')}>
              <span>مشاهده برنامه‌ریز</span>
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {currentPlan ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
                {currentPlan.days.map((day, idx) => {
                  const breakdown = weekSummary?.dailyBreakdowns[idx];
                  const cal = Math.round(breakdown?.nutrition.calories ?? 0);
                  return (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => handleJumpToDay(day.dayIndex)}
                      className="flex flex-col justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3.5 text-right hover:border-[var(--color-primary)] hover:bg-[var(--bg-surface-muted)]/60 transition-colors cursor-pointer"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-[var(--text-primary)]">
                            {getPersianWeekdayName(day.dayIndex)}
                          </span>
                          <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                            {formatJalaliDayMonth(day.dateISO)}
                          </span>
                        </div>
                        <div className="mt-2.5">
                          <DailyStatusLabel status={day.status} />
                        </div>
                      </div>

                      <div className="mt-4 pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
                        <span className="text-[var(--text-muted)]">کالری</span>
                        <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                          {formatFaNumber(cal)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">برنامه فعالی برای نمایش وجود ندارد.</p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Section 3 & 4: Smart Assistant Card + Weekly Shopping */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Rhythm Smart Assistant */}
        <Card className="lg:col-span-7 flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
                <CardTitle>دستیار هوشمند ریتم</CardTitle>
              </div>
              <span className="text-xs text-[var(--text-muted)] tabular-nums">
                یادآور پنج‌شنبه‌ها ساعت ۱۰:۰۰
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between gap-5">
            <div className="rounded-lg bg-[var(--color-primary-subtle)]/70 border border-[var(--border-subtle)] p-4">
              <p className="text-sm font-medium text-[var(--text-primary)] leading-relaxed">
                {reminderWindow.isAfterTargetTime || simulateThursday10AM
                  ? `سلام ${data.profile.displayName.split(' ')[0]}! پنج‌شنبه است. آماده‌ای برنامه غذایی هفته آینده (${formatJalaliWeekRangeLabel(
                      nextWeekRange.weekStartISO,
                      nextWeekRange.weekEndISO
                    )}) را با هم تنظیم کنیم؟`
                  : `سلام ${data.profile.displayName.split(' ')[0]}! برنامه هفته جاری در جریان است و می‌توانید در هر زمان برنامه هفته آینده را نیز آماده کنید.`}
              </p>
              <p className="mt-2 text-xs text-[var(--text-secondary)]">
                پیشنهادها بر اساس بانک غذاهای شما، هدف {formatFaNumber(data.target.dailyCalories)} کیلوکالری و موجودی فعلی خانه آماده می‌شوند.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button onClick={handleStartNextWeek} disabled={startPlanningSession.isPending}>
                <Play className="h-4 w-4" />
                <span>شروع برنامه‌ریزی هفته آینده</span>
              </Button>

              {nextWeekPlan && (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await updatePlanningSession.mutateAsync({
                      id: `psess_${Date.now()}`,
                      targetWeekStartISO: nextWeekPlan.weekStartISO,
                      targetWeekEndISO: nextWeekPlan.weekEndISO,
                      currentStep: 3,
                      activeDayIndex: 0,
                      weeklyPlanId: nextWeekPlan.id,
                      isActive: true,
                      updatedAt: new Date().toISOString(),
                    });
                    navigate('/nutrition/planner');
                  }}
                >
                  <Calendar className="h-4 w-4" />
                  <span>مشاهده برنامه پیشنهادی</span>
                </Button>
              )}

              <Button variant="outline" onClick={handleResumeDraft}>
                <span>ادامه برنامه ناتمام</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Shopping Card */}
        <Card className="lg:col-span-5 flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShoppingBasket className="h-4 w-4 text-[var(--color-accent)]" />
                <CardTitle>خریدهای هفته</CardTitle>
              </div>
              <span className="text-xs text-[var(--text-muted)] tabular-nums">
                {formatFaNumber(boughtShop)} / {formatFaNumber(totalShop)}
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between gap-5">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-[var(--bg-surface-muted)] p-3">
                  <div className="text-lg font-bold text-[var(--text-primary)] tabular-nums">
                    {formatFaNumber(totalShop)}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5">کل اقلام</div>
                </div>
                <div className="rounded-lg bg-[var(--bg-surface-muted)] p-3">
                  <div className="text-lg font-bold text-[var(--color-success)] tabular-nums">
                    {formatFaNumber(boughtShop)}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5">خریداری‌شده</div>
                </div>
                <div className="rounded-lg bg-[var(--bg-surface-muted)] p-3">
                  <div className="text-lg font-bold text-[var(--color-warning)] tabular-nums">
                    {formatFaNumber(remainingShop)}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5">باقیمانده</div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <span>پیشرفت خرید هفته</span>
                  <span className="tabular-nums">
                    {totalShop > 0 ? formatFaNumber(Math.round((boughtShop / totalShop) * 100)) : '۰'}٪
                  </span>
                </div>
                <Progress value={boughtShop} max={Math.max(1, totalShop)} />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--border-subtle)]">
              <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                <span>با کسر خودکار موجودی خانه</span>
              </span>
              <Button variant="outline" size="sm" onClick={() => navigate('/shopping/list')}>
                <span>باز کردن لیست خرید</span>
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
