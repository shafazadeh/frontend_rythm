import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, Lock, ShieldCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRhythmData, useRhythmMutations } from '../../../services/api/useRhythmQueries';
import { generateMockWeeklyPlan } from '../../../services/domain/mockPlannerEngine';
import { getNextSaturdayToFridayWeekRange, getPersianWeekdayName } from '../../../services/domain/jalaliCalendar';
import {
  BudgetLevel,
  PlanningStyle,
  VarietyLevel,
} from '../../../shared/types/domain';
import { agentPreferencesSchema } from '../../../shared/validation/schemas';
import { Button } from '../../../shared/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../shared/components/ui/Card';
import {
  Input,
  Label,
  Select,
  Skeleton,
  Switch,
  Textarea,
} from '../../../shared/components/ui/FormControls';
import { formatFaNumber } from '../../../shared/utils/cn';

type AgentPrefFormValues = z.infer<typeof agentPreferencesSchema>;

export function AgentPreferencesPage() {
  const { data, isLoading } = useRhythmData();
  const { updateAgentPreferences } = useRhythmMutations();

  const [previewSample, setPreviewSample] = useState<Array<{
    dayName: string;
    lunch: string;
    dinner: string;
  }> | null>(null);

  const form = useForm<AgentPrefFormValues>({
    resolver: zodResolver(agentPreferencesSchema),
  });

  useEffect(() => {
    if (!data) return;
    form.reset({
      planningStyle: data.agentPreferences.planningStyle,
      varietyLevel: data.agentPreferences.varietyLevel,
      preferQuickMeals: data.agentPreferences.preferQuickMeals,
      budgetLevel: data.agentPreferences.budgetLevel,
      prioritizePantry: data.agentPreferences.prioritizePantry,
      forbiddenFoodNotes: data.agentPreferences.forbiddenFoodNotes,
      maxRecipeRepeatsPerWeek: data.agentPreferences.maxRecipeRepeatsPerWeek,
      customInstructions: data.agentPreferences.customInstructions,
    });
  }, [data, form]);

  if (isLoading || !data) {
    return <Skeleton className="h-96 w-full" />;
  }

  const handleSave = form.handleSubmit(async (values) => {
    await updateAgentPreferences.mutateAsync({
      ...data.agentPreferences,
      ...values,
      updatedAt: new Date().toISOString(),
    });
  });

  const handlePreviewEffect = () => {
    const values = form.getValues();
    const range = getNextSaturdayToFridayWeekRange('2026-11-19');
    const simulatedPlan = generateMockWeeklyPlan({
      weekStartISO: range.weekStartISO,
      weekEndISO: range.weekEndISO,
      dayDatesISO: range.dayDatesISO,
      recipes: data.recipes,
      ingredients: data.ingredients,
      foodItems: data.foodItems,
      supplements: data.supplements,
      pantry: data.pantry,
      target: data.target,
      preferences: data.preferences,
      agentPreferences: {
        ...data.agentPreferences,
        ...values,
      },
    });

    const recipesById = Object.fromEntries(data.recipes.map((r) => [r.id, r]));
    const firstThreeDays = simulatedPlan.days.slice(0, 3).map((day) => {
      const lunchItem = day.meals.find((m) => m.slot === 'LUNCH')?.items[0];
      const dinnerItem = day.meals.find((m) => m.slot === 'DINNER')?.items[0];
      return {
        dayName: getPersianWeekdayName(day.dayIndex),
        lunch: lunchItem?.recipeId ? recipesById[lunchItem.recipeId]?.name ?? '—' : '—',
        dinner: dinnerItem?.recipeId ? recipesById[dinnerItem.recipeId]?.name ?? '—' : '—',
      };
    });

    setPreviewSample(firstThreeDays);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
          شخصی‌سازی دستیار هوشمند و مدیریت دستورالعمل‌ها
        </h1>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          جداسازی کامل سیاست‌های امنیتی سرور (لایه اول) از ترجیحات شخصی کاربر (لایه دوم)
        </p>
      </div>

      {/* Layer 1: System Policy (Architectural Read-only Notice, NO secret prompt in client bundle) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-[var(--text-muted)]" />
            <CardTitle>لایه اول: سیاست‌های ثابت سیستم (System Policy)</CardTitle>
          </div>
          <CardDescription>
            این لایه توسط توسعه‌دهنده و در سرور (Backend / LangGraph) نگهداری و اعمال می‌شود و در کلاینت قابل مشاهده یا تغییر نیست.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-[var(--bg-surface-muted)]/60 p-4 text-xs text-[var(--text-secondary)] space-y-2 leading-relaxed">
            <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
              <ShieldCheck className="h-4 w-4 text-[var(--color-primary)]" />
              <span>حوزه‌های تحت حفاظت سیاست سیستم:</span>
            </div>
            <ul className="list-disc pr-5 space-y-1">
              <li>منع ارائه توصیه‌ها یا دوزهای پزشکی و مکمل بدون ثبت و تأیید کاربر/پزشک</li>
              <li>عدم حذف وعده‌های اصلی برای رسیدن مصنوعی به عدد کالری هدف</li>
              <li>اجرای سخت‌گیرانه فیلتر آلرژن‌ها و محدودیت‌های ایمنی غذایی</li>
              <li>اعتبارسنجی دسترسی‌ها و جلوگیری از اجرای دستورهای خارج از مجوز</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Layer 2: User Preferences & Custom Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>لایه دوم: ترجیحات و دستورالعمل‌های شخصی شما</CardTitle>
          <CardDescription>
            این تنظیمات سبک پیشنهاد برنامه غذایی دستیار ریتم را متناسب با عادت‌های شما شکل می‌دهند.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="ag-style">سبک برنامه‌ریزی</Label>
                <Select id="ag-style" {...form.register('planningStyle')}>
                  <option value={PlanningStyle.BALANCED}>متعادل و روزمره</option>
                  <option value={PlanningStyle.HIGH_PROTEIN}>تمرکز بر پروتئین بالا</option>
                  <option value={PlanningStyle.BUDGET_FRIENDLY}>اقتصادی</option>
                  <option value={PlanningStyle.QUICK_PREP}>سریع و کم‌زحمت</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="ag-var">میزان تنوع غذا</Label>
                <Select id="ag-var" {...form.register('varietyLevel')}>
                  <option value={VarietyLevel.LOW}>تنوع کم (آشپزی ساده‌تر)</option>
                  <option value={VarietyLevel.MEDIUM}>تنوع متوسط</option>
                  <option value={VarietyLevel.HIGH}>تنوع بالا</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="ag-budget">بودجه خرید تقریبی</Label>
                <Select id="ag-budget" {...form.register('budgetLevel')}>
                  <option value={BudgetLevel.ECONOMIC}>اقتصادی</option>
                  <option value={BudgetLevel.MODERATE}>متعادل</option>
                  <option value={BudgetLevel.FLEXIBLE}>انعطاف‌پذیر</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="ag-rep">حداکثر تکرار هر غذا در هفته</Label>
                <Input
                  id="ag-rep"
                  type="number"
                  min={1}
                  max={7}
                  {...form.register('maxRecipeRepeatsPerWeek', { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] p-3.5">
                <div>
                  <div className="text-sm font-medium">ترجیح غذاهای سریع</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    اولویت به غذاهای زیر ۲۵ دقیقه
                  </div>
                </div>
                <Switch
                  checked={Boolean(form.watch('preferQuickMeals'))}
                  onCheckedChange={(v) => form.setValue('preferQuickMeals', v)}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] p-3.5">
                <div>
                  <div className="text-sm font-medium">اولویت استفاده از مواد موجود خانه</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    هماهنگ‌سازی پیشنهادها با موجودی منزل
                  </div>
                </div>
                <Switch
                  checked={Boolean(form.watch('prioritizePantry'))}
                  onCheckedChange={(v) => form.setValue('prioritizePantry', v)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="ag-forb">مواد یا غذاهای نامطلوب (با ویرگول جدا کنید)</Label>
              <Input
                id="ag-forb"
                {...form.register('forbiddenFoodNotes')}
                placeholder="مثلاً: بادمجان، ماهی"
              />
            </div>

            <div>
              <Label htmlFor="ag-custom">دستورالعمل‌های شخصی من برای دستیار</Label>
              <Textarea
                id="ag-custom"
                rows={4}
                {...form.register('customInstructions')}
                placeholder="نحوه ترجیح وعده‌ها، غذاهای سنتی، یا سبک شام‌های مورد علاقه خود را بنویسید..."
              />
              <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
                توجه: این دستورالعمل‌ها صرفاً در چارچوب ترجیحات غذایی اعمال می‌شوند و نمی‌توانند قوانین ایمنی، محدودیت‌های پزشکی یا مجوزهای سیستم را تغییر دهند.
              </p>
              {form.formState.errors.customInstructions && (
                <p className="mt-1 text-xs text-[var(--color-error)]">
                  {form.formState.errors.customInstructions.message}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--border-subtle)]">
              <Button type="button" variant="outline" onClick={handlePreviewEffect}>
                <Eye className="h-4 w-4" />
                <span>پیش‌نمایش تأثیر تنظیمات</span>
              </Button>
              <Button type="submit">ذخیره تنظیمات دستیار</Button>
            </div>
          </form>

          {/* Mock Preview Output */}
          {previewSample && (
            <div className="mt-6 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]/50 p-4 space-y-3">
              <div className="text-xs font-semibold text-[var(--text-primary)]">
                پیش‌نمایش نمونه خروجی برای ۳ روز ابتدای هفته (با حداکثر{' '}
                {formatFaNumber(form.watch('maxRecipeRepeatsPerWeek'))} بار تکرار و سبک{' '}
                {form.watch('preferQuickMeals') ? 'غذاهای سریع' : 'متعادل'}):
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {previewSample.map((d) => (
                  <div
                    key={d.dayName}
                    className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-3 space-y-1.5"
                  >
                    <div className="font-bold text-[var(--color-primary)]">{d.dayName}</div>
                    <div>
                      <span className="text-[var(--text-muted)]">ناهار: </span>
                      <span>{d.lunch}</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)]">شام: </span>
                      <span>{d.dinner}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
