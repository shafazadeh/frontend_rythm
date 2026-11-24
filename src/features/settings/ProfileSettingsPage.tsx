import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Calculator, CheckCircle2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useRhythmData, useRhythmMutations } from '../../services/api/useRhythmQueries';
import { estimateMifflinStJeor } from '../../services/domain/nutritionCalculator';
import {
  ACTIVITY_LEVEL_INFO,
  ALLERGEN_LABELS,
  COMMON_TIMEZONES,
} from '../../shared/constants/units';
import {
  ActivityLevel,
  AllergenType,
  SexForCalculation,
  VarietyLevel,
} from '../../shared/types/domain';
import { nutritionTargetSchema, profileSchema } from '../../shared/validation/schemas';
import { Button } from '../../shared/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../shared/components/ui/Card';
import {
  Checkbox,
  Input,
  Label,
  Select,
  Skeleton,
} from '../../shared/components/ui/FormControls';
import { ConfirmDialog } from '../../shared/components/ui/Overlays';
import { formatFaNumber } from '../../shared/utils/cn';

type ProfileFormValues = z.infer<typeof profileSchema>;
type TargetFormValues = z.infer<typeof nutritionTargetSchema>;

export function ProfileSettingsPage() {
  const { data, isLoading } = useRhythmData();
  const { updateProfile, updateTarget, updatePreferences } = useRhythmMutations();

  const [applyConfirmOpen, setApplyConfirmOpen] = useState(false);

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
  });

  const targetForm = useForm<TargetFormValues>({
    resolver: zodResolver(nutritionTargetSchema),
  });

  useEffect(() => {
    if (!data) return;
    profileForm.reset({
      displayName: data.profile.displayName,
      age: data.profile.age,
      heightCm: data.profile.heightCm,
      weightKg: data.profile.weightKg,
      sexForCalculation: data.profile.sexForCalculation,
      activityLevel: data.profile.activityLevel,
      timezone: data.profile.timezone,
      hasSpecialMedicalCondition: data.profile.hasSpecialMedicalCondition,
    });
    targetForm.reset({
      dailyCalories: data.target.dailyCalories,
      proteinGrams: data.target.proteinGrams,
      carbsGrams: data.target.carbsGrams,
      fatGrams: data.target.fatGrams,
      fiberGrams: data.target.fiberGrams ?? 28,
      mealsPerDay: data.target.mealsPerDay,
    });
  }, [data, profileForm, targetForm]);

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const watchedProfile = profileForm.watch();
  const estimate = estimateMifflinStJeor({
    age: Number(watchedProfile.age) || data.profile.age,
    heightCm: Number(watchedProfile.heightCm) || data.profile.heightCm,
    weightKg: Number(watchedProfile.weightKg) || data.profile.weightKg,
    sexForCalculation: watchedProfile.sexForCalculation || data.profile.sexForCalculation,
    activityLevel: watchedProfile.activityLevel || data.profile.activityLevel,
    hasSpecialMedicalCondition: Boolean(watchedProfile.hasSpecialMedicalCondition),
  });

  const handleSaveProfile = profileForm.handleSubmit(async (values) => {
    await updateProfile.mutateAsync({
      ...data.profile,
      ...values,
      updatedAt: new Date().toISOString(),
    });
  });

  const handleSaveTarget = targetForm.handleSubmit(async (values) => {
    await updateTarget.mutateAsync({
      ...values,
      updatedAt: new Date().toISOString(),
    });
  });

  const handleApplyEstimateToTarget = async () => {
    targetForm.setValue('dailyCalories', estimate.tdee);
    targetForm.setValue('proteinGrams', estimate.suggestedMacros.proteinGrams);
    targetForm.setValue('carbsGrams', estimate.suggestedMacros.carbsGrams);
    targetForm.setValue('fatGrams', estimate.suggestedMacros.fatGrams);
    await updateTarget.mutateAsync({
      dailyCalories: estimate.tdee,
      proteinGrams: estimate.suggestedMacros.proteinGrams,
      carbsGrams: estimate.suggestedMacros.carbsGrams,
      fatGrams: estimate.suggestedMacros.fatGrams,
      fiberGrams: targetForm.getValues('fiberGrams'),
      mealsPerDay: targetForm.getValues('mealsPerDay'),
      updatedAt: new Date().toISOString(),
    });
    toast.success('تخمین انرژی به هدف روزانه اعمال شد.');
  };

  const handleToggleAllergy = async (allergen: AllergenType) => {
    const exists = data.preferences.allergies.includes(allergen);
    const next = exists
      ? data.preferences.allergies.filter((a) => a !== allergen)
      : [...data.preferences.allergies, allergen];
    await updatePreferences.mutateAsync({
      ...data.preferences,
      allergies: next,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleChangeVariety = async (varietyPreference: VarietyLevel) => {
    await updatePreferences.mutateAsync({
      ...data.preferences,
      varietyPreference,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleToggleMealSlot = async (slotIndex: number) => {
    const nextTimings = data.preferences.mealTimings.map((mt, idx) =>
      idx === slotIndex ? { ...mt, enabled: !mt.enabled } : mt
    );
    await updatePreferences.mutateAsync({
      ...data.preferences,
      mealTimings: nextTimings,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleChangeMealTime = async (slotIndex: number, defaultTime: string) => {
    const nextTimings = data.preferences.mealTimings.map((mt, idx) =>
      idx === slotIndex ? { ...mt, defaultTime } : mt
    );
    await updatePreferences.mutateAsync({
      ...data.preferences,
      mealTimings: nextTimings,
      updatedAt: new Date().toISOString(),
    });
  };

  const watchedCalorieTarget = Number(targetForm.watch('dailyCalories')) || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
          پروفایل و اهداف تغذیه
        </h1>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          اطلاعات پایه، تخمین نیاز انرژی، اهداف درشت‌مغذی و حساسیت‌های غذایی
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Basic Profile */}
        <Card className="lg:col-span-6">
          <CardHeader>
            <CardTitle>اطلاعات پایه و سطح فعالیت</CardTitle>
            <CardDescription>
              این مشخصات برای تخمین انرژی روزانه (در صورت درخواست شما) استفاده می‌شوند.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="prof-name">نام نمایشی</Label>
                  <Input id="prof-name" {...profileForm.register('displayName')} />
                  {profileForm.formState.errors.displayName && (
                    <p className="mt-1 text-xs text-[var(--color-error)]">
                      {profileForm.formState.errors.displayName.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="prof-tz">منطقه زمانی</Label>
                  <Select id="prof-tz" {...profileForm.register('timezone')}>
                    {COMMON_TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="prof-age">سن (سال)</Label>
                  <Input id="prof-age" type="number" {...profileForm.register('age', { valueAsNumber: true })} />
                </div>
                <div>
                  <Label htmlFor="prof-height">قد (سانتی‌متر)</Label>
                  <Input id="prof-height" type="number" {...profileForm.register('heightCm', { valueAsNumber: true })} />
                </div>
                <div>
                  <Label htmlFor="prof-weight">وزن (کیلوگرم)</Label>
                  <Input id="prof-weight" type="number" {...profileForm.register('weightKg', { valueAsNumber: true })} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="prof-sex">جنس (برای فرمول محاسبه)</Label>
                  <Select id="prof-sex" {...profileForm.register('sexForCalculation')}>
                    <option value={SexForCalculation.FEMALE}>زن</option>
                    <option value={SexForCalculation.MALE}>مرد</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="prof-act">سطح فعالیت</Label>
                  <Select id="prof-act" {...profileForm.register('activityLevel')}>
                    {Object.entries(ACTIVITY_LEVEL_INFO).map(([key, info]) => (
                      <option key={key} value={key}>
                        {info.label} — {info.description}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-xs text-[var(--text-secondary)] cursor-pointer pt-1">
                <Checkbox
                  checked={Boolean(watchedProfile.hasSpecialMedicalCondition)}
                  onCheckedChange={(v) => profileForm.setValue('hasSpecialMedicalCondition', v)}
                />
                <span>دارای شرایط خاص پزشکی / نیازمند رژیم درمانی تخصصی هستم</span>
              </label>

              <div className="flex justify-end pt-2">
                <Button type="submit">ذخیره اطلاعات پایه</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Energy Estimator + Manual Target */}
        <div className="lg:col-span-6 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-[var(--color-primary)]" />
                <CardTitle>تخمین نیاز انرژی روزانه (Mifflin–St Jeor)</CardTitle>
              </div>
              <CardDescription>
                این عدد صرفاً یک تخمین آماری است و تجویز پزشکی محسوب نمی‌شود. بدون تأیید شما اعمال نخواهد شد.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-[var(--bg-surface-muted)]/60 p-3.5 text-center">
                <div>
                  <div className="text-xs text-[var(--text-muted)]">سوخت‌وساز پایه (BMR)</div>
                  <div className="mt-1 text-lg font-bold tabular-nums">
                    {formatFaNumber(estimate.bmr)} کیلوکالری
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[var(--text-muted)]">نیاز تخمینی کل (TDEE)</div>
                  <div className="mt-1 text-lg font-bold text-[var(--color-primary)] tabular-nums">
                    {formatFaNumber(estimate.tdee)} کیلوکالری
                  </div>
                </div>
              </div>

              {estimate.warnings.map((w) => (
                <div
                  key={w}
                  className="flex items-start gap-2 rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-warning-subtle)] p-3 text-xs text-[var(--color-warning)]"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-[var(--text-muted)] tabular-nums">
                  درشت‌مغذی پیشنهادی: پ {formatFaNumber(estimate.suggestedMacros.proteinGrams)}گ · ک{' '}
                  {formatFaNumber(estimate.suggestedMacros.carbsGrams)}گ · چ{' '}
                  {formatFaNumber(estimate.suggestedMacros.fatGrams)}گ
                </span>
                <Button size="sm" variant="outline" onClick={() => setApplyConfirmOpen(true)}>
                  اعمال تخمین به هدف
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>هدف تغذیه روزانه (تنظیم دستی)</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveTarget} className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="tgt-cal">کالری روزانه</Label>
                    <Input id="tgt-cal" type="number" {...targetForm.register('dailyCalories', { valueAsNumber: true })} />
                  </div>
                  <div>
                    <Label htmlFor="tgt-prot">پروتئین (گرم)</Label>
                    <Input id="tgt-prot" type="number" {...targetForm.register('proteinGrams', { valueAsNumber: true })} />
                  </div>
                  <div>
                    <Label htmlFor="tgt-carb">کربوهیدرات (گرم)</Label>
                    <Input id="tgt-carb" type="number" {...targetForm.register('carbsGrams', { valueAsNumber: true })} />
                  </div>
                  <div>
                    <Label htmlFor="tgt-fat">چربی (گرم)</Label>
                    <Input id="tgt-fat" type="number" {...targetForm.register('fatGrams', { valueAsNumber: true })} />
                  </div>
                  <div>
                    <Label htmlFor="tgt-fiber">فیبر (گرم)</Label>
                    <Input
                      id="tgt-fiber"
                      type="number"
                      {...targetForm.register('fiberGrams', {
                        setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="tgt-meals">تعداد وعده‌ها</Label>
                    <Input id="tgt-meals" type="number" {...targetForm.register('mealsPerDay', { valueAsNumber: true })} />
                  </div>
                </div>

                {watchedCalorieTarget > 0 && watchedCalorieTarget < 1200 && (
                  <div className="flex items-start gap-2 rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-warning-subtle)] p-3 text-xs text-[var(--color-warning)]">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      هدف کالری کمتر از ۱۲۰۰ کیلوکالری بسیار محدود است و بدون نظارت متخصص توصیه نمی‌شود.
                    </span>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button type="submit">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>ذخیره هدف تغذیه</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dietary Preferences & Meal Timings */}
      <Card>
        <CardHeader>
          <CardTitle>ترجیحات غذایی، حساسیت‌ها و زمان‌بندی وعده‌ها</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label>حساسیت‌ها و آلرژن‌های ممنوع (غذاهای دارای این موارد پیشنهاد نمی‌شوند)</Label>
            <div className="flex flex-wrap gap-4 pt-1.5">
              {Object.values(AllergenType).map((alg) => (
                <label key={alg} className="inline-flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={data.preferences.allergies.includes(alg)}
                    onCheckedChange={() => handleToggleAllergy(alg)}
                  />
                  <span>{ALLERGEN_LABELS[alg]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t border-[var(--border-subtle)]">
            <div>
              <Label htmlFor="pref-variety">ترجیح تنوع غذا در هفته</Label>
              <Select
                id="pref-variety"
                value={data.preferences.varietyPreference}
                onChange={(e) => handleChangeVariety(e.target.value as VarietyLevel)}
              >
                <option value={VarietyLevel.LOW}>تنوع کم (آسانی پخت‌وپز و تکرار بیشتر)</option>
                <option value={VarietyLevel.MEDIUM}>تنوع متعادل</option>
                <option value={VarietyLevel.HIGH}>تنوع بالا (حداقل تکرار غذا)</option>
              </Select>
            </div>

            <div>
              <Label>زمان‌بندی معمول وعده‌ها (۲۴ ساعته)</Label>
              <div className="space-y-2 mt-1.5">
                {data.preferences.mealTimings.map((mt, idx) => (
                  <div
                    key={mt.slot}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-xs"
                  >
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={mt.enabled}
                        onCheckedChange={() => handleToggleMealSlot(idx)}
                      />
                      <span className="font-medium">{mt.label}</span>
                    </label>
                    <Input
                      type="time"
                      value={mt.defaultTime}
                      onChange={(e) => handleChangeMealTime(idx, e.target.value)}
                      className="h-8 w-28 text-xs tabular-nums"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={applyConfirmOpen}
        onClose={() => setApplyConfirmOpen(false)}
        onConfirm={handleApplyEstimateToTarget}
        title="اعمال تخمین انرژی به هدف روزانه"
        message={`آیا مایلید مقدار تخمینی ${formatFaNumber(
          estimate.tdee
        )} کیلوکالری به عنوان هدف روزانه جدید شما ذخیره شود؟`}
        confirmLabel="بله، اعمال شود"
      />
    </div>
  );
}
