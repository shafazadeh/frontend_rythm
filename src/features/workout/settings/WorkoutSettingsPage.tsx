import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Flame, Info, Save } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRhythmData, useRhythmMutations } from '../../../services/api/useRhythmQueries';
import { WORKOUT_CALORIE_DISCLAIMER } from '../../../services/domain/workoutCalorieCalculator';
import { rhythmNutritionAdapter } from '../../../services/repositories/workoutAdapters';
import { Button } from '../../../shared/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../shared/components/ui/Card';
import {
  Checkbox,
  Input,
  Label,
  Select,
  Skeleton,
  Textarea,
} from '../../../shared/components/ui/FormControls';
import { PERSIAN_WEEKDAY_NAMES } from '../../../shared/constants/units';
import {
  CARDIO_INTENSITY_LABELS,
  COMMON_EQUIPMENT_LIST,
  DIFFICULTY_LABELS,
  EXERCISE_TYPE_LABELS,
  WORKOUT_GOAL_LABELS,
} from '../../../shared/constants/workout';
import {
  DifficultyLevel,
  ExerciseType,
  MetReferenceEntry,
  WorkoutGoal,
} from '../../../shared/types/workout';
import { formatFaNumber } from '../../../shared/utils/cn';
import { workoutPreferencesSchema } from '../../../shared/validation/workoutSchemas';

type PrefsFormValues = z.infer<typeof workoutPreferencesSchema>;

export function WorkoutSettingsPage() {
  const { data, isLoading, isError } = useRhythmData();
  const { updateWorkoutPreferences, updateMetReferenceTable } = useRhythmMutations();

  const [metDrafts, setMetDrafts] = useState<MetReferenceEntry[]>([]);

  const form = useForm<PrefsFormValues>({
    resolver: zodResolver(workoutPreferencesSchema),
    defaultValues: {
      primaryGoal: WorkoutGoal.GENERAL_FITNESS,
      experienceLevel: DifficultyLevel.INTERMEDIATE,
      preferredSessionsPerWeek: 3,
      preferredDurationMinutes: 45,
      preferredDays: [0, 2, 4],
      preferredTimeStart: '17:30',
      preferredTimeEnd: '19:00',
      favoriteTypes: [ExerciseType.STRENGTH, ExerciseType.CARDIO],
      availableEquipment: ['دمبل'],
      movementLimitations: '',
      personalNotes: '',
    },
  });

  useEffect(() => {
    if (!data) return;
    const p = data.workoutPreferences;
    form.reset({
      primaryGoal: p.primaryGoal,
      experienceLevel: p.experienceLevel,
      preferredSessionsPerWeek: p.preferredSessionsPerWeek,
      preferredDurationMinutes: p.preferredDurationMinutes,
      preferredDays: p.preferredDays,
      preferredTimeStart: p.preferredTimeStart,
      preferredTimeEnd: p.preferredTimeEnd,
      favoriteTypes: p.favoriteTypes,
      availableEquipment: p.availableEquipment,
      movementLimitations: p.movementLimitations,
      personalNotes: p.personalNotes,
    });
    setMetDrafts(structuredClone(data.metReferenceTable));
  }, [data, form]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-[var(--color-error)]">
          بارگذاری تنظیمات ماژول ورزش با خطا مواجه شد.
        </CardContent>
      </Card>
    );
  }

  const nutritionContext = rhythmNutritionAdapter.extractSharedContext(data);
  const watchedDays = form.watch('preferredDays');
  const watchedFavTypes = form.watch('favoriteTypes');
  const watchedEquipment = form.watch('availableEquipment');

  const toggleNumberItem = (arr: number[], value: number) =>
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value].sort((a, b) => a - b);

  const toggleEnumItem = (arr: ExerciseType[], value: ExerciseType) =>
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

  const toggleStringItem = (arr: string[], value: string) =>
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

  const onSavePreferences = form.handleSubmit(async (values) => {
    await updateWorkoutPreferences.mutateAsync({
      ...values,
      updatedAt: new Date().toISOString(),
    });
  });

  const handleSaveMetTable = async () => {
    await updateMetReferenceTable.mutateAsync(metDrafts);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-balance text-[var(--text-primary)]">
          تنظیمات و ترجیحات ورزشی
        </h1>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          تنظیم اهداف ورزشی، روزهای تمرین، تجهیزات در دسترس و جدول مرجع ضرایب MET
        </p>
      </div>

      {/* Preferences Form */}
      <form onSubmit={onSavePreferences} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>اهداف و زمانبندی ترجیحی</CardTitle>
            <CardDescription>
              این ترجیحات هنگام ساخت خودکار جلسات هفتگی و فیلتر برنامه‌ها استفاده می‌شوند.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="wpref-goal">هدف اصلی ورزشی</Label>
                <Select id="wpref-goal" {...form.register('primaryGoal')}>
                  {Object.values(WorkoutGoal).map((g) => (
                    <option key={g} value={g}>
                      {WORKOUT_GOAL_LABELS[g]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="wpref-level">سطح تجربه</Label>
                <Select id="wpref-level" {...form.register('experienceLevel')}>
                  {Object.values(DifficultyLevel).map((d) => (
                    <option key={d} value={d}>
                      {DIFFICULTY_LABELS[d]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="wpref-sessions">تعداد جلسات ترجیحی در هفته</Label>
                <Input
                  id="wpref-sessions"
                  type="number"
                  min={1}
                  max={7}
                  {...form.register('preferredSessionsPerWeek', { valueAsNumber: true })}
                  className="tabular-nums"
                />
              </div>
              <div>
                <Label htmlFor="wpref-dur">مدت هر جلسه (دقیقه)</Label>
                <Input
                  id="wpref-dur"
                  type="number"
                  min={10}
                  max={240}
                  {...form.register('preferredDurationMinutes', { valueAsNumber: true })}
                  className="tabular-nums"
                />
              </div>
            </div>

            <div>
              <Label>روزهای ترجیحی ورزش (شنبه تا جمعه)</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-1">
                {PERSIAN_WEEKDAY_NAMES.map((dayName, idx) => (
                  <label
                    key={dayName}
                    className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-xs cursor-pointer"
                  >
                    <Checkbox
                      checked={watchedDays.includes(idx)}
                      onCheckedChange={() =>
                        form.setValue('preferredDays', toggleNumberItem(watchedDays, idx))
                      }
                    />
                    <span>{dayName}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="wpref-tstart">شروع بازه ساعتی ترجیحی</Label>
                <Input
                  id="wpref-tstart"
                  type="time"
                  {...form.register('preferredTimeStart')}
                  className="tabular-nums"
                />
              </div>
              <div>
                <Label htmlFor="wpref-tend">پایان بازه ساعتی ترجیحی</Label>
                <Input
                  id="wpref-tend"
                  type="time"
                  {...form.register('preferredTimeEnd')}
                  className="tabular-nums"
                />
              </div>
            </div>

            <div>
              <Label>انواع تمرین مورد علاقه</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-1">
                {Object.values(ExerciseType).map((t) => (
                  <label
                    key={t}
                    className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-xs cursor-pointer"
                  >
                    <Checkbox
                      checked={watchedFavTypes.includes(t)}
                      onCheckedChange={() =>
                        form.setValue('favoriteTypes', toggleEnumItem(watchedFavTypes, t))
                      }
                    />
                    <span>{EXERCISE_TYPE_LABELS[t]}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label>تجهیزات در دسترس شما</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 pt-1">
                {COMMON_EQUIPMENT_LIST.map((eq) => (
                  <label
                    key={eq}
                    className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-xs cursor-pointer"
                  >
                    <Checkbox
                      checked={watchedEquipment.includes(eq)}
                      onCheckedChange={() =>
                        form.setValue('availableEquipment', toggleStringItem(watchedEquipment, eq))
                      }
                    />
                    <span>{eq}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="wpref-limits">محدودیت‌های حرکتی (فقط برای یادآوری شخصی)</Label>
                <Textarea
                  id="wpref-limits"
                  rows={3}
                  {...form.register('movementLimitations')}
                  placeholder="مثلاً پرش شدید برای زانو مناسب نیست..."
                />
                <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-[var(--text-muted)]">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    این یادداشت صرفاً جهت اطلاع‌رسانی شخصی ثبت می‌شود و هیچ توصیه پزشکی یا توان‌بخشی تولید نمی‌گردد.
                  </span>
                </p>
              </div>
              <div>
                <Label htmlFor="wpref-notes">یادداشت‌های شخصی ورزشی</Label>
                <Textarea
                  id="wpref-notes"
                  rows={3}
                  {...form.register('personalNotes')}
                  placeholder="نکات انگیزشی یا عادت‌های تمرینی شما..."
                />
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[var(--border-subtle)]">
              <Button type="submit" disabled={updateWorkoutPreferences.isPending}>
                <Save className="h-4 w-4" />
                <span>ذخیره تنظیمات ورزشی</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Editable MET Reference Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-[var(--color-accent)]" />
            <CardTitle>جدول مرجع MET و فرمول تخمین انرژی</CardTitle>
          </div>
          <CardDescription>
            کالری تخمینی با فرمول استاندارد MET × 3.5 × وزن (کیلوگرم) ÷ ۲۰۰ × مدت (دقیقه) محاسبه می‌شود.
            وزن فعلی خوانده‌شده از پروفایل شما:{' '}
            <strong className="tabular-nums">
              {nutritionContext.userWeightKg
                ? `${formatFaNumber(nutritionContext.userWeightKg)} کیلوگرم`
                : 'ثبت نشده'}
            </strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {WORKOUT_CALORIE_DISCLAIMER}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                  <th className="py-2.5 px-2 font-medium">عنوان رده فعالیت</th>
                  <th className="py-2.5 px-2 font-medium">نوع تمرین</th>
                  <th className="py-2.5 px-2 font-medium">شدت</th>
                  <th className="py-2.5 px-2 font-medium w-32">ضریب MET</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {metDrafts.map((entry, idx) => (
                  <tr key={entry.id}>
                    <td className="py-2.5 px-2 font-medium text-[var(--text-primary)]">
                      {entry.label}
                    </td>
                    <td className="py-2.5 px-2 text-[var(--text-secondary)]">
                      {EXERCISE_TYPE_LABELS[entry.exerciseType]}
                    </td>
                    <td className="py-2.5 px-2 text-[var(--text-muted)]">
                      {entry.intensity ? CARDIO_INTENSITY_LABELS[entry.intensity] : 'استاندارد'}
                    </td>
                    <td className="py-2.5 px-2">
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        step={0.1}
                        value={entry.metValue}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 1;
                          setMetDrafts((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, metValue: val } : item))
                          );
                        }}
                        className="h-8 text-xs tabular-nums"
                        aria-label={`ضریب MET برای ${entry.label}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-2 border-t border-[var(--border-subtle)]">
            <Button
              variant="outline"
              onClick={handleSaveMetTable}
              disabled={updateMetReferenceTable.isPending}
            >
              <Save className="h-4 w-4" />
              <span>ذخیره جدول MET</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
