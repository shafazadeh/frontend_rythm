import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Pill,
} from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  formatDayHeaderTitle,
  getPersianWeekdayName,
} from '../../../services/domain/jalaliCalendar';
import {
  calculateDailyNutrition,
  NutritionContext,
} from '../../../services/domain/nutritionCalculator';
import { MEAL_SLOT_LABELS } from '../../../shared/constants/units';
import {
  DailyMealPlan,
  DailyPlanStatus,
  Meal,
  Recipe,
  RhythmAppData,
  WeeklyMealPlan,
} from '../../../shared/types/domain';
import { Button } from '../../../shared/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../shared/components/ui/Card';
import { Checkbox, Progress } from '../../../shared/components/ui/FormControls';
import { DailyStatusLabel } from '../../../shared/components/StatusText';
import { formatFaNumber, toPersianDigits } from '../../../shared/utils/cn';
import { MealCard } from './MealCard';
import { RecipeDetailDrawer } from './RecipeDetailDrawer';

interface DailyReviewViewProps {
  data: RhythmAppData;
  weeklyPlan: WeeklyMealPlan;
  activeDayIndex: number;
  onSelectDay: (dayIndex: number) => void;
  onUpdateDay: (updatedDay: DailyMealPlan) => Promise<void>;
  onConfirmDayAndAdvance: (day: DailyMealPlan) => Promise<void>;
  onGoToWeeklySummary: () => void;
}

export function DailyReviewView({
  data,
  weeklyPlan,
  activeDayIndex,
  onSelectDay,
  onUpdateDay,
  onConfirmDayAndAdvance,
  onGoToWeeklySummary,
}: DailyReviewViewProps) {
  const [drawerRecipe, setDrawerRecipe] = useState<Recipe | null>(null);

  const day = weeklyPlan.days[activeDayIndex] ?? weeklyPlan.days[0];

  const ingredientsById = useMemo(
    () => Object.fromEntries(data.ingredients.map((i) => [i.id, i])),
    [data.ingredients]
  );
  const recipesById = useMemo(
    () => Object.fromEntries(data.recipes.map((r) => [r.id, r])),
    [data.recipes]
  );
  const foodItemsById = useMemo(
    () => Object.fromEntries(data.foodItems.map((f) => [f.id, f])),
    [data.foodItems]
  );

  const nutritionContext: NutritionContext = {
    ingredientsById,
    recipesById,
    foodItemsById,
  };

  const dailySummary = calculateDailyNutrition(day, nutritionContext);
  const confirmedDaysCount = weeklyPlan.days.filter(
    (d) => d.status === DailyPlanStatus.CONFIRMED
  ).length;

  const macroChartData = [
    { name: 'پروتئین', value: Math.max(1, Math.round(dailySummary.protein * 4)), grams: Math.round(dailySummary.protein), color: 'var(--color-primary)' },
    { name: 'کربوهیدرات', value: Math.max(1, Math.round(dailySummary.carbs * 4)), grams: Math.round(dailySummary.carbs), color: 'var(--color-accent)' },
    { name: 'چربی', value: Math.max(1, Math.round(dailySummary.fat * 9)), grams: Math.round(dailySummary.fat), color: 'var(--color-warning)' },
  ];

  const handleMealChange = async (updatedMeal: Meal) => {
    const nextMeals = day.meals.map((m) => (m.id === updatedMeal.id ? updatedMeal : m));
    // Any modification puts confirmed day back into IN_REVIEW
    const nextStatus =
      day.status === DailyPlanStatus.CONFIRMED ? DailyPlanStatus.IN_REVIEW : day.status;
    await onUpdateDay({
      ...day,
      status: nextStatus,
      meals: nextMeals,
    });
  };

  const handleToggleSupplement = async (supplementId: string) => {
    const existing = day.supplementSchedules.find((s) => s.supplementId === supplementId);
    let nextSchedules = [...day.supplementSchedules];
    if (existing) {
      nextSchedules = nextSchedules.map((s) =>
        s.supplementId === supplementId
          ? { ...s, isTaken: !s.isTaken, takenAt: !s.isTaken ? new Date().toISOString() : undefined }
          : s
      );
    } else {
      nextSchedules.push({
        id: `supsch_${supplementId}_${day.dayIndex}`,
        supplementId,
        dayIndex: day.dayIndex,
        isTaken: true,
        takenAt: new Date().toISOString(),
      });
    }
    await onUpdateDay({
      ...day,
      supplementSchedules: nextSchedules,
    });
  };

  const activeDaySupplements = data.supplements.filter(
    (s) => s.isActive && s.activeDays.includes(day.dayIndex)
  );

  return (
    <div className="space-y-6">
      {/* Day Navigation Header */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
                {formatDayHeaderTitle(day.dayIndex, day.dateISO)}
              </h2>
              <DailyStatusLabel status={day.status} />
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={day.dayIndex === 0}
                onClick={() => onSelectDay(day.dayIndex - 1)}
              >
                <ArrowRight className="h-3.5 w-3.5" />
                <span>روز قبل</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={day.dayIndex === 6}
                onClick={() => onSelectDay(day.dayIndex + 1)}
              >
                <span>روز بعد</span>
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* 7-day quick pills + Progress */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[var(--border-subtle)]">
            <div className="flex flex-wrap items-center gap-1.5">
              {weeklyPlan.days.map((d) => {
                const isSelected = d.dayIndex === day.dayIndex;
                const isConf = d.status === DailyPlanStatus.CONFIRMED;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onSelectDay(d.dayIndex)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                        : isConf
                        ? 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]'
                        : 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {getPersianWeekdayName(d.dayIndex)}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2.5 text-xs text-[var(--text-secondary)] tabular-nums shrink-0">
              <span>{formatFaNumber(confirmedDaysCount)} از ۷ روز تأییدشده</span>
              <div className="w-24">
                <Progress value={confirmedDaysCount} max={7} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two-Column Desktop Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Column: Meals + Supplements */}
        <div className="lg:col-span-8 space-y-4">
          {day.meals.map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              nutritionContext={nutritionContext}
              allRecipes={data.recipes}
              recipeCategories={data.recipeCategories}
              allIngredients={data.ingredients}
              ingredientCategories={data.ingredientCategories}
              allFoodItems={data.foodItems}
              pantry={data.pantry}
              onChangeMeal={handleMealChange}
              onOpenRecipeDetail={setDrawerRecipe}
            />
          ))}

          {/* Supplements & Vitamins Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Pill className="h-4 w-4 text-[var(--color-primary)]" />
                  <CardTitle>مکمل‌ها و ویتامین‌های {getPersianWeekdayName(day.dayIndex)}</CardTitle>
                </div>
                <span className="text-xs text-[var(--text-muted)]">
                  مطابق تنظیمات ثبت‌شده کاربر
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {activeDaySupplements.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">
                  مکملی برای این روز تنظیم نشده است. می‌توانید از بخش تنظیمات مکمل‌ها اضافه کنید.
                </p>
              ) : (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {activeDaySupplements.map((sup) => {
                    const schedule = day.supplementSchedules.find(
                      (s) => s.supplementId === sup.id
                    );
                    const isTaken = schedule?.isTaken ?? false;
                    const needsInfo = !sup.dosageAmount || !sup.timeOfDay;

                    return (
                      <div
                        key={sup.id}
                        className="py-3 first:pt-0 last:pb-0 flex flex-wrap items-start justify-between gap-3"
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={isTaken}
                            onCheckedChange={() => handleToggleSupplement(sup.id)}
                            ariaLabel={`ثبت مصرف ${sup.name}`}
                          />
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`text-sm font-medium ${
                                  isTaken
                                    ? 'line-through text-[var(--text-muted)]'
                                    : 'text-[var(--text-primary)]'
                                }`}
                              >
                                {sup.name}
                              </span>
                              <span className="text-xs text-[var(--text-muted)]">
                                · {sup.form}
                              </span>
                            </div>

                            {needsInfo ? (
                              <div className="flex items-center gap-1.5 text-xs text-[var(--color-warning)]">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                <span>
                                  نیازمند تکمیل اطلاعات (مقدار یا ساعت مصرف توسط شما ثبت نشده است)
                                </span>
                              </div>
                            ) : (
                              <div className="text-xs text-[var(--text-secondary)] tabular-nums">
                                مقدار: {formatFaNumber(sup.dosageAmount ?? 0)} {sup.dosageUnit}
                                <span aria-hidden="true" className="mx-1.5">·</span>
                                ساعت {toPersianDigits(sup.timeOfDay ?? '')}
                                {sup.linkedMealSlot && (
                                  <>
                                    <span aria-hidden="true" className="mx-1.5">·</span>
                                    <span>همراه {MEAL_SLOT_LABELS[sup.linkedMealSlot]}</span>
                                  </>
                                )}
                              </div>
                            )}

                            {sup.doctorOrPharmacistNote && (
                              <div className="text-[11px] text-[var(--text-muted)]">
                                یادداشت پزشک/داروساز: {sup.doctorOrPharmacistNote}
                              </div>
                            )}
                          </div>
                        </div>

                        <span
                          className={`text-xs font-medium whitespace-nowrap ${
                            isTaken ? 'text-[var(--color-success)]' : 'text-[var(--text-muted)]'
                          }`}
                        >
                          {isTaken ? 'مصرف شد' : 'برنامه‌ریزی‌شده'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Side Column: Daily Nutrition Summary + Confirm CTA */}
        <aside className="lg:col-span-4 lg:sticky lg:top-20 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>خلاصه تغذیه روزانه</CardTitle>
                <DailyStatusLabel status={day.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Donut Chart */}
              <div className="h-44 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={macroChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={70}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {macroChartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: unknown, _name: unknown, props: { payload?: { name?: string; grams?: number } }) => [
                        `${formatFaNumber(props?.payload?.grams ?? 0)} گرم (${formatFaNumber(Number(val) || 0)} کالری)`,
                        props?.payload?.name ?? '',
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold tabular-nums text-[var(--text-primary)]">
                    {formatFaNumber(dailySummary.calories)}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">کیلوکالری</span>
                </div>
              </div>

              {/* Progress Bars */}
              <div className="space-y-3.5 text-xs">
                <div className="space-y-1.5">
                  <div className="flex justify-between tabular-nums">
                    <span className="text-[var(--text-secondary)]">کالری مصرفی</span>
                    <span className="font-semibold">
                      {formatFaNumber(dailySummary.calories)} / {formatFaNumber(data.target.dailyCalories)}
                    </span>
                  </div>
                  <Progress value={dailySummary.calories} max={data.target.dailyCalories} />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between tabular-nums">
                    <span className="text-[var(--text-secondary)]">پروتئین</span>
                    <span className="font-semibold text-[var(--color-primary)]">
                      {formatFaNumber(dailySummary.protein)} / {formatFaNumber(data.target.proteinGrams)} گرم
                    </span>
                  </div>
                  <Progress value={dailySummary.protein} max={data.target.proteinGrams} />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between tabular-nums">
                    <span className="text-[var(--text-secondary)]">کربوهیدرات</span>
                    <span className="font-semibold text-[var(--color-accent)]">
                      {formatFaNumber(dailySummary.carbs)} / {formatFaNumber(data.target.carbsGrams)} گرم
                    </span>
                  </div>
                  <Progress
                    value={dailySummary.carbs}
                    max={data.target.carbsGrams}
                    barClassName="bg-[var(--color-accent)]"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between tabular-nums">
                    <span className="text-[var(--text-secondary)]">چربی</span>
                    <span className="font-semibold text-[var(--color-warning)]">
                      {formatFaNumber(dailySummary.fat)} / {formatFaNumber(data.target.fatGrams)} گرم
                    </span>
                  </div>
                  <Progress
                    value={dailySummary.fat}
                    max={data.target.fatGrams}
                    barClassName="bg-[var(--color-warning)]"
                  />
                </div>

                <div className="flex justify-between pt-2 border-t border-[var(--border-subtle)] tabular-nums">
                  <span className="text-[var(--text-muted)]">فیبر برآوردی</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {formatFaNumber(dailySummary.fiber ?? 0)} گرم
                  </span>
                </div>
                <div className="flex justify-between tabular-nums">
                  <span className="text-[var(--text-muted)]">وعده‌های تأییدشده</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {formatFaNumber(dailySummary.confirmedMealsCount)} از{' '}
                    {formatFaNumber(dailySummary.totalMealsCount)}
                  </span>
                </div>
              </div>

              {/* Warnings */}
              {dailySummary.hasIncompleteData && (
                <div className="flex items-start gap-2 rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-warning-subtle)] p-3 text-xs text-[var(--color-warning)]">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    اطلاعات تغذیه‌ای کامل نیست: {dailySummary.incompleteReason}
                  </span>
                </div>
              )}

              {!dailySummary.hasIncompleteData &&
                dailySummary.calories < data.target.dailyCalories * 0.75 && (
                  <div className="flex items-start gap-2 rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-warning-subtle)] p-3 text-xs text-[var(--color-warning)]">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      مجموع کالری این روز به‌طور قابل‌توجهی پایین‌تر از هدف شماست. می‌توانید اندازه وعده‌ها را افزایش دهید.
                    </span>
                  </div>
                )}

              <div className="space-y-2.5 pt-2">
                <Button
                  className="w-full"
                  onClick={() => onConfirmDayAndAdvance(day)}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    {day.dayIndex === 6
                      ? 'تأیید روز هفتم و مرور نهایی هفته'
                      : 'تأیید برنامه این روز'}
                  </span>
                </Button>

                {confirmedDaysCount === 7 && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={onGoToWeeklySummary}
                  >
                    مشاهده مرور نهایی هفته
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Recipe Drawer */}
      <RecipeDetailDrawer
        recipe={drawerRecipe}
        ingredientsById={ingredientsById}
        onClose={() => setDrawerRecipe(null)}
      />
    </div>
  );
}
