import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Edit3 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  formatJalaliDayMonth,
  formatJalaliWeekRangeLabel,
  getPersianWeekdayName,
} from '../../../services/domain/jalaliCalendar';
import {
  calculateWeeklyNutritionSummary,
  NutritionContext,
} from '../../../services/domain/nutritionCalculator';
import { generateShoppingListFromPlan } from '../../../services/domain/shoppingAggregator';
import {
  DailyPlanStatus,
  RhythmAppData,
  WeeklyMealPlan,
} from '../../../shared/types/domain';
import { Button } from '../../../shared/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/components/ui/Card';
import { DailyStatusLabel } from '../../../shared/components/StatusText';
import { formatFaNumber } from '../../../shared/utils/cn';

interface WeeklySummaryViewProps {
  data: RhythmAppData;
  weeklyPlan: WeeklyMealPlan;
  onEditDay: (dayIndex: number) => void;
  onConfirmWeek: () => Promise<void>;
  isConfirming: boolean;
}

export function WeeklySummaryView({
  data,
  weeklyPlan,
  onEditDay,
  onConfirmWeek,
  isConfirming,
}: WeeklySummaryViewProps) {
  const { summary, totalMealsCount, deficitItemsCount, chartData } = useMemo(() => {
    const ingredientsById = Object.fromEntries(data.ingredients.map((i) => [i.id, i]));
    const recipesById = Object.fromEntries(data.recipes.map((r) => [r.id, r]));
    const foodItemsById = Object.fromEntries(data.foodItems.map((f) => [f.id, f]));
    const ctx: NutritionContext = { ingredientsById, recipesById, foodItemsById };

    const sum = calculateWeeklyNutritionSummary(weeklyPlan.days, ctx, data.target);
    const totalMeals = weeklyPlan.days.reduce((acc, d) => acc + d.meals.length, 0);

    const previewShop = generateShoppingListFromPlan({
      weeklyPlan,
      recipesById,
      ingredientsById,
      pantry: data.pantry,
      includeUnconfirmedDays: true,
    });

    const chart = sum.dailyBreakdowns.map((d) => ({
      name: getPersianWeekdayName(d.dayIndex),
      calories: Math.round(d.nutrition.calories),
      protein: Math.round(d.nutrition.protein),
    }));

    return {
      summary: sum,
      totalMealsCount: totalMeals,
      deficitItemsCount: previewShop.items.filter((i) => i.suggestedBuyQuantity > 0).length,
      chartData: chart,
    };
  }, [data, weeklyPlan]);

  const allConfirmed = summary.confirmedDaysCount === 7;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>مرور و تأیید نهایی برنامه هفته</CardTitle>
              <CardDescription>
                بازه هفته: {formatJalaliWeekRangeLabel(weeklyPlan.weekStartISO, weeklyPlan.weekEndISO)}
              </CardDescription>
            </div>
            <div className="text-xs text-[var(--text-secondary)] tabular-nums">
              نسخه فعلی: {formatFaNumber(weeklyPlan.version)}
              <span aria-hidden="true" className="mx-1.5">·</span>
              {formatFaNumber(summary.confirmedDaysCount)} از ۷ روز تأییدشده
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-lg bg-[var(--bg-surface-muted)]/70 p-4">
              <div className="text-xs text-[var(--text-muted)]">میانگین کالری هفته</div>
              <div className="mt-1 text-xl font-bold tabular-nums">
                {formatFaNumber(summary.averageCalories)}
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] tabular-nums mt-0.5">
                هدف: {formatFaNumber(data.target.dailyCalories)} کیلوکالری
              </div>
            </div>

            <div className="rounded-lg bg-[var(--bg-surface-muted)]/70 p-4">
              <div className="text-xs text-[var(--text-muted)]">میانگین پروتئین روزانه</div>
              <div className="mt-1 text-xl font-bold text-[var(--color-primary)] tabular-nums">
                {formatFaNumber(summary.averageProtein)} گرم
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] tabular-nums mt-0.5">
                هدف: {formatFaNumber(data.target.proteinGrams)} گرم
              </div>
            </div>

            <div className="rounded-lg bg-[var(--bg-surface-muted)]/70 p-4">
              <div className="text-xs text-[var(--text-muted)]">تعداد وعده‌های هفته</div>
              <div className="mt-1 text-xl font-bold tabular-nums">
                {formatFaNumber(totalMealsCount)} وعده
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                در ۷ روز هفته
              </div>
            </div>

            <div className="rounded-lg bg-[var(--bg-surface-muted)]/70 p-4">
              <div className="text-xs text-[var(--text-muted)]">مواد اولیه نیازمند خرید</div>
              <div className="mt-1 text-xl font-bold text-[var(--color-accent)] tabular-nums">
                {formatFaNumber(deficitItemsCount)} قلم
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                پس از کسر موجودی خانه
              </div>
            </div>
          </div>

          {/* Daily Calorie Chart */}
          <div className="rounded-lg border border-[var(--border-subtle)] p-4">
            <h4 className="text-xs font-semibold text-[var(--text-secondary)] mb-4">
              مقایسه کالری روزهای هفته با هدف روزانه
            </h4>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <Tooltip
                    formatter={(val: unknown) => [`${formatFaNumber(Number(val) || 0)} کیلوکالری`, 'کالری']}
                  />
                  <ReferenceLine
                    y={data.target.dailyCalories}
                    stroke="var(--color-accent)"
                    strokeDasharray="4 4"
                  />
                  <Bar dataKey="calories" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Warnings */}
          {summary.warnings.length > 0 && (
            <div className="space-y-2">
              {summary.warnings.map((w) => (
                <div
                  key={w}
                  className="flex items-start gap-2 rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-warning-subtle)] p-3 text-xs text-[var(--color-warning)]"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Day-by-day summary table */}
          <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
            <table className="w-full text-right text-xs">
              <thead className="bg-[var(--bg-surface-muted)]/70 border-b border-[var(--border-subtle)] text-[var(--text-secondary)]">
                <tr>
                  <th className="py-3 px-4 font-medium">روز</th>
                  <th className="py-3 px-4 font-medium">وضعیت</th>
                  <th className="py-3 px-4 font-medium">وعده‌ها</th>
                  <th className="py-3 px-4 font-medium">کالری</th>
                  <th className="py-3 px-4 font-medium">پروتئین</th>
                  <th className="py-3 px-4 font-medium text-left">اصلاح</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {weeklyPlan.days.map((day, idx) => {
                  const brk = summary.dailyBreakdowns[idx];
                  const mealNames = day.meals
                    .flatMap((m) =>
                      m.items.map((it) =>
                        it.kind === 'RECIPE'
                          ? data.recipes.find((r) => r.id === it.recipeId)?.name
                          : data.foodItems.find((f) => f.id === it.foodItemId)?.name
                      )
                    )
                    .filter(Boolean)
                    .slice(0, 3)
                    .join(' · ');

                  return (
                    <tr key={day.id} className="hover:bg-[var(--bg-surface-muted)]/40">
                      <td className="py-3 px-4 font-medium text-[var(--text-primary)] whitespace-nowrap">
                        {getPersianWeekdayName(day.dayIndex)}{' '}
                        <span className="text-[var(--text-muted)] tabular-nums">
                          ({formatJalaliDayMonth(day.dateISO)})
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <DailyStatusLabel status={day.status} />
                      </td>
                      <td className="py-3 px-4 text-[var(--text-secondary)] max-w-xs truncate">
                        {mealNames}
                      </td>
                      <td className="py-3 px-4 tabular-nums font-semibold">
                        {formatFaNumber(brk?.nutrition.calories ?? 0)}
                      </td>
                      <td className="py-3 px-4 tabular-nums">
                        {formatFaNumber(brk?.nutrition.protein ?? 0)} گ
                      </td>
                      <td className="py-3 px-4 text-left">
                        <Button size="sm" variant="ghost" onClick={() => onEditDay(day.dayIndex)}>
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>ویرایش</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Final Confirm Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-[var(--border-subtle)]">
            {!allConfirmed ? (
              <div className="flex items-center gap-2 text-xs text-[var(--color-warning)]">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  برای تأیید نهایی، همه ۷ روز هفته باید تأیید شده باشند (روزهای تأییدنشده:{' '}
                  {weeklyPlan.days
                    .filter((d) => d.status !== DailyPlanStatus.CONFIRMED)
                    .map((d) => getPersianWeekdayName(d.dayIndex))
                    .join('، ')}
                  ).
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-[var(--color-success)]">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  همه ۷ روز تأیید شده‌اند. با تأیید نهایی، نسخه جدید ذخیره و لیست خرید هفته محاسبه می‌شود.
                </span>
              </div>
            )}

            <Button
              size="lg"
              disabled={!allConfirmed || isConfirming}
              onClick={onConfirmWeek}
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>تأیید نهایی برنامه هفته</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
