import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  ShoppingBasket,
  Sparkles,
} from 'lucide-react';
import { useRhythmData, useRhythmMutations } from '../../../services/api/useRhythmQueries';
import {
  formatJalaliWeekRangeLabel,
  getNextSaturdayToFridayWeekRange,
  getSaturdayToFridayWeekRange,
} from '../../../services/domain/jalaliCalendar';
import { ALLERGEN_LABELS } from '../../../shared/constants/units';
import { DailyMealPlan, DailyPlanStatus, WeeklyMealPlan } from '../../../shared/types/domain';
import { Button } from '../../../shared/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../shared/components/ui/Card';
import { Progress, Skeleton } from '../../../shared/components/ui/FormControls';
import { formatFaNumber } from '../../../shared/utils/cn';
import { DailyReviewView } from './DailyReviewView';
import { WeeklySummaryView } from './WeeklySummaryView';

const WIZARD_STEPS: Array<{ step: 1 | 2 | 3 | 4 | 5 | 6; label: string }> = [
  { step: 1, label: 'انتخاب هفته و هدف تغذیه' },
  { step: 2, label: 'تولید برنامه پیشنهادی' },
  { step: 3, label: 'بررسی و تأیید روزهای هفته' },
  { step: 4, label: 'مرور برنامه کامل' },
  { step: 5, label: 'تولید و بررسی لیست خرید' },
  { step: 6, label: 'تأیید نهایی' },
];

export function PlannerPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data, isLoading } = useRhythmData();
  const {
    generateWeeklyPlan,
    updateDailyPlan,
    confirmWeeklyPlan,
    updatePlanningSession,
    regenerateShoppingList,
  } = useRhythmMutations();

  const nextWeekRange = useMemo(() => getNextSaturdayToFridayWeekRange('2026-11-19'), []);
  const currentWeekRange = useMemo(() => getSaturdayToFridayWeekRange('2026-11-19'), []);

  const [selectedWeekType, setSelectedWeekType] = useState<'NEXT' | 'CURRENT'>('NEXT');
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [activeDayIndex, setActiveDayIndex] = useState<number>(0);

  // Sync local wizard state with persisted planningSession or query param
  useEffect(() => {
    if (!data) return;
    const dayParam = searchParams.get('day');
    if (dayParam !== null && !Number.isNaN(Number(dayParam))) {
      const idx = Math.min(6, Math.max(0, Number(dayParam)));
      setActiveDayIndex(idx);
      setStep(3);
      if (data.weeklyPlans[0]) {
        const isCurrent = data.weeklyPlans[0].weekStartISO === currentWeekRange.weekStartISO;
        setSelectedWeekType(isCurrent ? 'CURRENT' : 'NEXT');
      }
      return;
    }

    if (data.planningSession?.isActive) {
      setStep(data.planningSession.currentStep);
      setActiveDayIndex(data.planningSession.activeDayIndex);
      setSelectedWeekType(
        data.planningSession.targetWeekStartISO === nextWeekRange.weekStartISO
          ? 'NEXT'
          : 'CURRENT'
      );
    } else if (data.weeklyPlans.length > 0) {
      // Default to reviewing current week if no explicit session
      setSelectedWeekType('CURRENT');
      setStep(3);
    }
  }, [data?.planningSession?.id, searchParams]);

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const targetRange = selectedWeekType === 'NEXT' ? nextWeekRange : currentWeekRange;
  const activeWeeklyPlan: WeeklyMealPlan | undefined =
    data.weeklyPlans.find((p) => p.weekStartISO === targetRange.weekStartISO) ??
    (selectedWeekType === 'CURRENT' ? data.weeklyPlans[0] : undefined);

  const persistSession = async (
    nextStep: 1 | 2 | 3 | 4 | 5 | 6,
    nextDayIdx = activeDayIndex,
    planId = activeWeeklyPlan?.id
  ) => {
    setStep(nextStep);
    setActiveDayIndex(nextDayIdx);
    await updatePlanningSession.mutateAsync({
      id: data.planningSession?.id ?? `psess_${Date.now()}`,
      targetWeekStartISO: targetRange.weekStartISO,
      targetWeekEndISO: targetRange.weekEndISO,
      currentStep: nextStep,
      activeDayIndex: nextDayIdx,
      weeklyPlanId: planId,
      isActive: true,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleGeneratePlan = async () => {
    const plan = await generateWeeklyPlan.mutateAsync(targetRange.weekStartISO);
    await persistSession(3, 0, plan.id);
  };

  const handleUpdateDay = async (updatedDay: DailyMealPlan) => {
    if (!activeWeeklyPlan) return;
    await updateDailyPlan.mutateAsync({ planId: activeWeeklyPlan.id, day: updatedDay });
  };

  const handleConfirmDayAndAdvance = async (day: DailyMealPlan) => {
    if (!activeWeeklyPlan) return;
    const confirmedDay: DailyMealPlan = {
      ...day,
      status: DailyPlanStatus.CONFIRMED,
      meals: day.meals.map((m) => ({ ...m, isConfirmed: true })),
    };
    await updateDailyPlan.mutateAsync({ planId: activeWeeklyPlan.id, day: confirmedDay });

    if (day.dayIndex < 6) {
      await persistSession(3, day.dayIndex + 1, activeWeeklyPlan.id);
    } else {
      await persistSession(4, 6, activeWeeklyPlan.id);
    }
  };

  const handleConfirmWeek = async () => {
    if (!activeWeeklyPlan) return;
    await confirmWeeklyPlan.mutateAsync(activeWeeklyPlan.id);
    await persistSession(5, activeDayIndex, activeWeeklyPlan.id);
  };

  const activeShoppingList = data.shoppingLists.find(
    (l) => l.weeklyPlanId === activeWeeklyPlan?.id || l.weekStartISO === targetRange.weekStartISO
  );

  return (
    <div className="space-y-6">
      {/* Persistent Wizard Progress Header */}
      <Card>
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
                برنامه‌ریز هوشمند هفتگی
              </h1>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                هفته هدف: {formatJalaliWeekRangeLabel(targetRange.weekStartISO, targetRange.weekEndISO)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg bg-[var(--bg-surface-muted)] p-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedWeekType('CURRENT');
                    if (data.weeklyPlans.some((p) => p.weekStartISO === currentWeekRange.weekStartISO)) {
                      setStep(3);
                    } else {
                      setStep(1);
                    }
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    selectedWeekType === 'CURRENT'
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  هفته جاری
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedWeekType('NEXT');
                    const hasNext = data.weeklyPlans.some(
                      (p) => p.weekStartISO === nextWeekRange.weekStartISO
                    );
                    setStep(hasNext ? 3 : 1);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    selectedWeekType === 'NEXT'
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  هفته آینده
                </button>
              </div>
            </div>
          </div>

          {/* 6-step Progress Indicator */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {WIZARD_STEPS.map((ws) => {
                const isActive = step === ws.step;
                const isDone = step > ws.step;
                const canClick =
                  ws.step <= 2 ||
                  (activeWeeklyPlan !== undefined && ws.step <= 4) ||
                  (activeWeeklyPlan?.status === 'CONFIRMED' && ws.step >= 5);

                return (
                  <button
                    key={ws.step}
                    type="button"
                    disabled={!canClick}
                    onClick={() => persistSession(ws.step)}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-right text-xs transition-colors ${
                      isActive
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-semibold'
                        : isDone
                        ? 'border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]/60 text-[var(--text-primary)]'
                        : 'border-[var(--border-subtle)] text-[var(--text-muted)] opacity-75'
                    } ${canClick ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                  >
                    <span className="tabular-nums font-bold shrink-0">
                      {formatFaNumber(ws.step)}.
                    </span>
                    <span className="truncate">{ws.label}</span>
                  </button>
                );
              })}
            </div>
            <Progress value={step} max={6} className="h-1.5" />
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Select Week & Review Nutrition Targets */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>مرحله ۱: بررسی هفته هدف و اهداف تغذیه</CardTitle>
            <CardDescription>
              پیش از تولید برنامه غذایی، بازه هفته و محدودیت‌ها را مرور کنید.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-[var(--border-subtle)] p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Calendar className="h-4 w-4 text-[var(--color-primary)]" />
                  <span>بازه انتخابی (شنبه تا جمعه)</span>
                </div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {formatJalaliWeekRangeLabel(targetRange.weekStartISO, targetRange.weekEndISO)}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  منطقه زمانی: {data.profile.timezone} · یادآور هفتگی:{' '}
                  {data.agentPreferences.reminderConfig.enabled ? 'پنج‌شنبه‌ها ۱۰:۰۰' : 'غیرفعال'}
                </p>
              </div>

              <div className="rounded-lg border border-[var(--border-subtle)] p-4 space-y-2">
                <div className="text-sm font-semibold">اهداف تغذیه‌ای روزانه</div>
                <div className="grid grid-cols-2 gap-2 text-xs tabular-nums">
                  <span>کالری هدف: {formatFaNumber(data.target.dailyCalories)} کیلوکالری</span>
                  <span>پروتئین: {formatFaNumber(data.target.proteinGrams)} گرم</span>
                  <span>کربوهیدرات: {formatFaNumber(data.target.carbsGrams)} گرم</span>
                  <span>چربی: {formatFaNumber(data.target.fatGrams)} گرم</span>
                </div>
                <div className="pt-1 flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span>
                    حساسیت‌ها:{' '}
                    {data.preferences.allergies.length > 0
                      ? data.preferences.allergies.map((a) => ALLERGEN_LABELS[a]).join('، ')
                      : 'ثبت نشده'}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate('/settings/profile')}
                    className="text-[var(--color-primary)] hover:underline cursor-pointer"
                  >
                    ویرایش اهداف
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--border-subtle)]">
              <span className="text-xs text-[var(--text-muted)]">
                برنامه با توجه به {formatFaNumber(data.recipes.length)} دستور غذا و{' '}
                {formatFaNumber(data.pantry.length)} قلم موجودی خانه تنظیم می‌شود.
              </span>
              <Button onClick={() => persistSession(2)}>
                <span>ادامه به تولید برنامه</span>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Generate Proposed Weekly Meal Plan */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>مرحله ۲: تولید برنامه غذایی پیشنهادی</CardTitle>
            <CardDescription>
              دستیار ریتم یک برنامه متعادل ۷ روزه متناسب با موجودی خانه و ترجیحات شما آماده می‌کند.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-lg bg-[var(--bg-surface-muted)]/60 p-4 text-sm text-[var(--text-secondary)] space-y-2">
              <p>معیارهای فعال در تولید این برنامه:</p>
              <ul className="list-disc pr-5 text-xs space-y-1">
                <li>نزدیکی مجموع کالری و پروتئین روزانه به هدف ثبت‌شده شما</li>
                <li>حذف خودکار غذاهای دارای حساسیت یا مواد نامطلوب</li>
                <li>تنوع غذایی در طول ۷ روز و اولویت‌دهی به اقلام موجود در خانه</li>
                <li>درج میوه‌ها، میانوعده‌ها و مکمل‌های تعریف‌شده توسط شما</li>
              </ul>
            </div>

            <div className="flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={() => persistSession(1)}>
                بازگشت به مرحله قبل
              </Button>
              <Button
                size="lg"
                onClick={handleGeneratePlan}
                disabled={generateWeeklyPlan.isPending}
              >
                <Sparkles className="h-4 w-4" />
                <span>
                  {activeWeeklyPlan
                    ? 'تولید مجدد برنامه پیشنهادی'
                    : 'تولید برنامه غذایی هفته'}
                </span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Daily Review & Confirmation */}
      {step === 3 && activeWeeklyPlan && (
        <DailyReviewView
          data={data}
          weeklyPlan={activeWeeklyPlan}
          activeDayIndex={activeDayIndex}
          onSelectDay={(idx) => persistSession(3, idx, activeWeeklyPlan.id)}
          onUpdateDay={handleUpdateDay}
          onConfirmDayAndAdvance={handleConfirmDayAndAdvance}
          onGoToWeeklySummary={() => persistSession(4, activeDayIndex, activeWeeklyPlan.id)}
        />
      )}

      {step === 3 && !activeWeeklyPlan && (
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              برای این هفته هنوز برنامه‌ای تولید نشده است.
            </p>
            <Button onClick={() => persistSession(1)}>شروع تنظیم برنامه این هفته</Button>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Weekly Final Summary */}
      {step === 4 && activeWeeklyPlan && (
        <WeeklySummaryView
          data={data}
          weeklyPlan={activeWeeklyPlan}
          onEditDay={(dayIdx) => persistSession(3, dayIdx, activeWeeklyPlan.id)}
          onConfirmWeek={handleConfirmWeek}
          isConfirming={confirmWeeklyPlan.isPending}
        />
      )}

      {/* Step 5: Shopping List Generation & Review */}
      {step === 5 && activeWeeklyPlan && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>مرحله ۵: تولید و بررسی لیست خرید هفته</CardTitle>
                <CardDescription>
                  مواد اولیه همه ۷ روز تجمیع و موجودی فعلی خانه از آن کسر شده است.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  regenerateShoppingList.mutate({ planId: activeWeeklyPlan.id, includeUnconfirmed: false })
                }
              >
                بازمحاسبه لیست خرید
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {activeShoppingList ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                  <div className="rounded-lg bg-[var(--bg-surface-muted)] p-4">
                    <div className="text-2xl font-bold tabular-nums">
                      {formatFaNumber(activeShoppingList.items.length)}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">کل اقلام لیست خرید</div>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-surface-muted)] p-4">
                    <div className="text-2xl font-bold text-[var(--color-primary)] tabular-nums">
                      {formatFaNumber(
                        activeShoppingList.items.filter((i) => i.pantryQuantity > 0).length
                      )}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">اقلام دارای موجودی جزئی در خانه</div>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-surface-muted)] p-4">
                    <div className="text-2xl font-bold text-[var(--color-accent)] tabular-nums">
                      {formatFaNumber(
                        activeShoppingList.items.filter((i) => i.source === 'MANUAL').length
                      )}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">اقلام اضافه‌شده دستی</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--border-subtle)]">
                  <Button variant="outline" onClick={() => navigate('/shopping/list')}>
                    <ShoppingBasket className="h-4 w-4" />
                    <span>مشاهده و مدیریت کامل لیست خرید</span>
                  </Button>
                  <Button onClick={() => persistSession(6, activeDayIndex, activeWeeklyPlan.id)}>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>تکمیل و پایان برنامه‌ریزی</span>
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">
                لیست خرید در حال آماده‌سازی است...
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 6: Final Confirmation & Snapshot */}
      {step === 6 && activeWeeklyPlan && (
        <Card>
          <CardContent className="p-8 text-center space-y-5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-success-subtle)] text-[var(--color-success)]">
              <ClipboardCheck className="h-7 w-7" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                برنامه غذایی هفته با موفقیت نهایی شد
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                نسخه {formatFaNumber(activeWeeklyPlan.version)} برای بازه{' '}
                {formatJalaliWeekRangeLabel(activeWeeklyPlan.weekStartISO, activeWeeklyPlan.weekEndISO)}{' '}
                ثبت و لیست خرید هوشمند آماده استفاده است.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button onClick={() => navigate('/shopping/list')}>
                <ShoppingBasket className="h-4 w-4" />
                <span>رفتن به لیست خرید</span>
              </Button>
              <Button variant="outline" onClick={() => navigate('/dashboard')}>
                بازگشت به داشبورد
              </Button>
              <Button variant="ghost" onClick={() => persistSession(3, 0, activeWeeklyPlan.id)}>
                مشاهده مجدد برنامه روزانه
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
