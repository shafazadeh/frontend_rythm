import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../../shared/components/ui/Button';
import { Input, Label, Select, Switch, Textarea } from '../../../shared/components/ui/FormControls';
import { Dialog } from '../../../shared/components/ui/Overlays';
import {
  CARDIO_INTENSITY_LABELS,
  DIFFICULTY_LABELS,
  EXERCISE_TYPE_LABELS,
  WORKOUT_GOAL_LABELS,
} from '../../../shared/constants/workout';
import {
  CardioIntensity,
  DifficultyLevel,
  Exercise,
  ExerciseType,
  WorkoutGoal,
  WorkoutProgram,
  WorkoutTemplate,
  WorkoutTemplateExercise,
} from '../../../shared/types/workout';
import { formatFaNumber, generateId } from '../../../shared/utils/cn';
import { workoutProgramFormSchema } from '../../../shared/validation/workoutSchemas';

type ProgramFormValues = z.infer<typeof workoutProgramFormSchema>;

interface ProgramEditorDialogProps {
  open: boolean;
  onClose: () => void;
  program: WorkoutProgram | null;
  templates: WorkoutTemplate[];
  exercises: Exercise[];
  hasScheduledSessions?: boolean;
  onSave: (program: WorkoutProgram, templates: WorkoutTemplate[]) => Promise<void>;
}

export function ProgramEditorDialog({
  open,
  onClose,
  program,
  templates,
  exercises,
  hasScheduledSessions = false,
  onSave,
}: ProgramEditorDialogProps) {
  const exercisesById = useMemo(
    () => Object.fromEntries(exercises.map((e) => [e.id, e])),
    [exercises]
  );

  const [activeTemplateIdx, setActiveTemplateIdx] = useState(0);
  const [addExerciseId, setAddExerciseId] = useState(exercises[0]?.id ?? '');

  const form = useForm<ProgramFormValues>({
    resolver: zodResolver(workoutProgramFormSchema),
    defaultValues: {
      title: '',
      goal: WorkoutGoal.MUSCLE_GAIN,
      difficulty: DifficultyLevel.INTERMEDIATE,
      sessionsPerWeek: 3,
      startDateISO: '2026-11-21',
      endDateISO: '',
      description: '',
      isActive: true,
      templates: [],
    },
  });

  const templateArray = useFieldArray({
    control: form.control,
    name: 'templates',
  });

  useEffect(() => {
    if (!open) return;
    setActiveTemplateIdx(0);
    setAddExerciseId(exercises[0]?.id ?? '');

    if (program) {
      const progTemplates = templates.filter((t) => t.programId === program.id);
      form.reset({
        title: program.title,
        goal: program.goal,
        difficulty: program.difficulty,
        sessionsPerWeek: program.sessionsPerWeek,
        startDateISO: program.startDateISO,
        endDateISO: program.endDateISO ?? '',
        description: program.description ?? '',
        isActive: program.isActive,
        templates: progTemplates.map((t) => ({
          id: t.id,
          title: t.title,
          type: t.type,
          estimatedDurationMinutes: t.estimatedDurationMinutes,
          difficulty: t.difficulty,
          exercises: t.exercises.map((ex) => ({ ...ex })),
          notes: t.notes ?? '',
        })),
      });
    } else {
      const defaultEx = exercises[0];
      form.reset({
        title: '',
        goal: WorkoutGoal.MUSCLE_GAIN,
        difficulty: DifficultyLevel.INTERMEDIATE,
        sessionsPerWeek: 3,
        startDateISO: '2026-11-21',
        endDateISO: '',
        description: '',
        isActive: true,
        templates: [
          {
            id: generateId('wtpl'),
            title: 'جلسه اول: بالاتنه',
            type: ExerciseType.STRENGTH,
            estimatedDurationMinutes: 45,
            difficulty: DifficultyLevel.INTERMEDIATE,
            exercises: defaultEx
              ? [
                  {
                    id: generateId('wte'),
                    exerciseId: defaultEx.id,
                    order: 1,
                    exerciseType: defaultEx.type,
                    sets: 3,
                    reps: 10,
                    targetWeightKg: 12,
                    restSeconds: 60,
                  },
                ]
              : [],
            notes: '',
          },
        ],
      });
    }
  }, [open, program, templates, exercises, form]);

  const watchedTemplates = form.watch('templates');
  const currentTpl = watchedTemplates[activeTemplateIdx];

  const handleAddTemplate = () => {
    const defaultEx = exercises[0];
    const nextIdx = watchedTemplates.length;
    const labels = ['بالاتنه', 'پایین‌تنه', 'هوازی', 'کل بدن'];
    templateArray.append({
      id: generateId('wtpl'),
      title: `جلسه ${formatFaNumber(nextIdx + 1)}: ${labels[nextIdx % labels.length]}`,
      type: ExerciseType.STRENGTH,
      estimatedDurationMinutes: 45,
      difficulty: form.getValues('difficulty'),
      exercises: defaultEx
        ? [
            {
              id: generateId('wte'),
              exerciseId: defaultEx.id,
              order: 1,
              exerciseType: defaultEx.type,
              sets: 3,
              reps: 10,
              targetWeightKg: 10,
              restSeconds: 60,
            },
          ]
        : [],
      notes: '',
    });
    setActiveTemplateIdx(nextIdx);
  };

  const handleAddExerciseToTemplate = () => {
    const ex = exercisesById[addExerciseId];
    if (!ex || !currentTpl) return;
    const list = form.getValues(`templates.${activeTemplateIdx}.exercises`);
    const newRow: WorkoutTemplateExercise =
      ex.type === ExerciseType.STRENGTH
        ? {
            id: generateId('wte'),
            exerciseId: ex.id,
            order: list.length + 1,
            exerciseType: ex.type,
            sets: 3,
            reps: 10,
            targetWeightKg: 10,
            restSeconds: 60,
          }
        : ex.type === ExerciseType.CARDIO
        ? {
            id: generateId('wte'),
            exerciseId: ex.id,
            order: list.length + 1,
            exerciseType: ex.type,
            durationMinutes: 25,
            intensity: CardioIntensity.MODERATE,
            targetDistanceKm: 3,
          }
        : {
            id: generateId('wte'),
            exerciseId: ex.id,
            order: list.length + 1,
            exerciseType: ex.type,
            holdSeconds: 30,
            sets: 2,
            reps: 8,
          };

    form.setValue(`templates.${activeTemplateIdx}.exercises`, [...list, newRow], {
      shouldValidate: true,
    });
  };

  const moveExerciseInTemplate = (idx: number, dir: -1 | 1) => {
    const list = [...form.getValues(`templates.${activeTemplateIdx}.exercises`)];
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const [moved] = list.splice(idx, 1);
    list.splice(targetIdx, 0, moved);
    form.setValue(
      `templates.${activeTemplateIdx}.exercises`,
      list.map((item, i) => ({ ...item, order: i + 1 }))
    );
  };

  const removeExerciseFromTemplate = (idx: number) => {
    const list = form
      .getValues(`templates.${activeTemplateIdx}.exercises`)
      .filter((_, i) => i !== idx)
      .map((item, i) => ({ ...item, order: i + 1 }));
    form.setValue(`templates.${activeTemplateIdx}.exercises`, list, { shouldValidate: true });
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    const now = new Date().toISOString();
    const programId = program?.id ?? generateId('wprog');

    const savedTemplates: WorkoutTemplate[] = values.templates.map((t) => ({
      id: t.id || generateId('wtpl'),
      programId,
      title: t.title,
      type: t.type,
      estimatedDurationMinutes: t.estimatedDurationMinutes,
      difficulty: t.difficulty,
      exercises: t.exercises.map((ex, i) => ({ ...ex, order: i + 1 })),
      notes: t.notes || undefined,
      createdAt: now,
      updatedAt: now,
    }));

    const savedProgram: WorkoutProgram = {
      id: programId,
      title: values.title,
      goal: values.goal,
      difficulty: values.difficulty,
      sessionsPerWeek: values.sessionsPerWeek,
      startDateISO: values.startDateISO,
      endDateISO: values.endDateISO?.trim() || undefined,
      description: values.description?.trim() || undefined,
      templateIds: savedTemplates.map((t) => t.id),
      isActive: values.isActive,
      createdAt: program?.createdAt ?? now,
      updatedAt: now,
    };

    await onSave(savedProgram, savedTemplates);
    onClose();
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={program ? `ویرایش برنامه «${program.title}»` : 'ساخت برنامه ورزشی جدید'}
      description="تعریف برنامه تمرینی و قالب جلسات آن. تغییر قالب‌ها بر جلسات زمانبندی‌شده قبلی اثر خودکار نمی‌گذارد."
      maxWidthClass="max-w-4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {hasScheduledSessions && (
          <div className="rounded-lg border border-[var(--color-accent)]/35 bg-[var(--color-accent-subtle)] px-3.5 py-2.5 text-xs text-[var(--color-accent)]">
            توجه: برای این برنامه جلساتی در تقویم زمانبندی شده است. تغییرات قالب‌ها فقط روی زمانبندی‌های جدید اعمال می‌شوند و جلسات قبلی بدون تأیید شما تغییر نمی‌کنند.
          </div>
        )}

        {/* Section 1: Program Info */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold border-b border-[var(--border-subtle)] pb-1.5">
            ۱. اطلاعات برنامه ورزشی
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="sm:col-span-2 lg:col-span-1">
              <Label htmlFor="wp-title">عنوان برنامه</Label>
              <Input
                id="wp-title"
                {...form.register('title')}
                placeholder="مثلاً: برنامه بدنسازی سه‌روزه"
              />
              {form.formState.errors.title && (
                <p className="mt-1 text-xs text-[var(--color-error)]">
                  {form.formState.errors.title.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="wp-goal">هدف ورزش</Label>
              <Select id="wp-goal" {...form.register('goal')}>
                {Object.values(WorkoutGoal).map((g) => (
                  <option key={g} value={g}>
                    {WORKOUT_GOAL_LABELS[g]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="wp-diff">سطح دشواری</Label>
              <Select id="wp-diff" {...form.register('difficulty')}>
                {Object.values(DifficultyLevel).map((d) => (
                  <option key={d} value={d}>
                    {DIFFICULTY_LABELS[d]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="wp-spw">تعداد جلسات در هفته</Label>
              <Input
                id="wp-spw"
                type="number"
                min={1}
                max={7}
                {...form.register('sessionsPerWeek', { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="wp-start">تاریخ شروع</Label>
              <Input id="wp-start" type="date" {...form.register('startDateISO')} />
            </div>
            <div>
              <Label htmlFor="wp-end">تاریخ پایان (اختیاری)</Label>
              <Input id="wp-end" type="date" {...form.register('endDateISO')} />
            </div>
          </div>

          <div>
            <Label htmlFor="wp-desc">توضیحات برنامه</Label>
            <Textarea id="wp-desc" rows={2} className="min-h-[60px]" {...form.register('description')} />
          </div>

          <div className="flex items-center justify-between">
            <Label className="mb-0">برنامه فعال است</Label>
            <Switch
              checked={form.watch('isActive')}
              onCheckedChange={(v) => form.setValue('isActive', v)}
            />
          </div>
        </section>

        {/* Section 2: Templates Builder */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-1.5">
            <h3 className="text-sm font-semibold">
              ۲. قالب جلسات تمرینی ({formatFaNumber(watchedTemplates.length)} جلسه)
            </h3>
            <Button type="button" size="sm" variant="outline" onClick={handleAddTemplate}>
              <Plus className="h-3.5 w-3.5" />
              <span>افزودن جلسه به برنامه</span>
            </Button>
          </div>

          {/* Template Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {templateArray.fields.map((tplField, idx) => (
              <button
                key={tplField.id}
                type="button"
                onClick={() => setActiveTemplateIdx(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  activeTemplateIdx === idx
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-subtle)] text-[var(--color-primary)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)]'
                }`}
              >
                {watchedTemplates[idx]?.title || `جلسه ${formatFaNumber(idx + 1)}`}
              </button>
            ))}
          </div>

          {currentTpl && (
            <div className="rounded-xl border border-[var(--border-subtle)] p-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[var(--text-muted)]">
                  تنظیمات قالب جلسه {formatFaNumber(activeTemplateIdx + 1)}
                </span>
                {templateArray.fields.length > 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-[var(--color-error)]"
                    onClick={() => {
                      templateArray.remove(activeTemplateIdx);
                      setActiveTemplateIdx(Math.max(0, activeTemplateIdx - 1));
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>حذف این جلسه</span>
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label>عنوان جلسه</Label>
                  <Input {...form.register(`templates.${activeTemplateIdx}.title`)} />
                </div>
                <div>
                  <Label>نوع غالب جلسه</Label>
                  <Select {...form.register(`templates.${activeTemplateIdx}.type`)}>
                    {Object.values(ExerciseType).map((t) => (
                      <option key={t} value={t}>
                        {EXERCISE_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>مدت تخمینی (دقیقه)</Label>
                  <Input
                    type="number"
                    min={5}
                    {...form.register(`templates.${activeTemplateIdx}.estimatedDurationMinutes`, {
                      valueAsNumber: true,
                    })}
                  />
                </div>
              </div>

              {/* Add Exercise to Current Template */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border-subtle)]">
                <Select
                  value={addExerciseId}
                  onChange={(e) => setAddExerciseId(e.target.value)}
                  className="flex-1 min-w-[200px]"
                >
                  {exercises.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.persianName} ({EXERCISE_TYPE_LABELS[ex.type]})
                    </option>
                  ))}
                </Select>
                <Button type="button" size="sm" variant="outline" onClick={handleAddExerciseToTemplate}>
                  <Plus className="h-3.5 w-3.5" />
                  <span>افزودن حرکت به جلسه</span>
                </Button>
              </div>

              {/* Template Exercise Rows with Dynamic Type-Specific Inputs */}
              <div className="space-y-2.5">
                {currentTpl.exercises.map((row, rIdx) => {
                  const meta = exercisesById[row.exerciseId];
                  const exType = row.exerciseType;

                  return (
                    <div
                      key={row.id}
                      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-[var(--text-primary)]">
                          {formatFaNumber(rIdx + 1)}. {meta?.persianName ?? 'حرکت'}{' '}
                          <span className="font-normal text-[var(--text-muted)]">
                            ({EXERCISE_TYPE_LABELS[exType]})
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={rIdx === 0}
                            onClick={() => moveExerciseInTemplate(rIdx, -1)}
                            className="p-1 rounded hover:bg-[var(--bg-surface-muted)] disabled:opacity-30 cursor-pointer"
                            aria-label="بالا"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={rIdx === currentTpl.exercises.length - 1}
                            onClick={() => moveExerciseInTemplate(rIdx, 1)}
                            className="p-1 rounded hover:bg-[var(--bg-surface-muted)] disabled:opacity-30 cursor-pointer"
                            aria-label="پایین"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeExerciseFromTemplate(rIdx)}
                            className="p-1 rounded hover:bg-[var(--bg-surface-muted)] text-[var(--text-muted)] cursor-pointer"
                            aria-label="حذف"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Strength Form */}
                      {exType === ExerciseType.STRENGTH && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div>
                            <Label>تعداد ست</Label>
                            <Input
                              type="number"
                              min={1}
                              className="h-8 text-xs tabular-nums"
                              {...form.register(
                                `templates.${activeTemplateIdx}.exercises.${rIdx}.sets`,
                                { valueAsNumber: true }
                              )}
                            />
                          </div>
                          <div>
                            <Label>تکرار در ست</Label>
                            <Input
                              type="number"
                              min={1}
                              className="h-8 text-xs tabular-nums"
                              {...form.register(
                                `templates.${activeTemplateIdx}.exercises.${rIdx}.reps`,
                                { valueAsNumber: true }
                              )}
                            />
                          </div>
                          <div>
                            <Label>وزن هدف (kg)</Label>
                            <Input
                              type="number"
                              min={0}
                              step={0.5}
                              className="h-8 text-xs tabular-nums"
                              {...form.register(
                                `templates.${activeTemplateIdx}.exercises.${rIdx}.targetWeightKg`,
                                {
                                  setValueAs: (v: string) =>
                                    v === '' ? undefined : Number(v),
                                }
                              )}
                            />
                          </div>
                          <div>
                            <Label>استراحت (ثانیه)</Label>
                            <Input
                              type="number"
                              min={0}
                              step={5}
                              className="h-8 text-xs tabular-nums"
                              {...form.register(
                                `templates.${activeTemplateIdx}.exercises.${rIdx}.restSeconds`,
                                { valueAsNumber: true }
                              )}
                            />
                          </div>
                        </div>
                      )}

                      {/* Cardio Form */}
                      {exType === ExerciseType.CARDIO && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div>
                            <Label>مدت (دقیقه)</Label>
                            <Input
                              type="number"
                              min={1}
                              className="h-8 text-xs tabular-nums"
                              {...form.register(
                                `templates.${activeTemplateIdx}.exercises.${rIdx}.durationMinutes`,
                                { valueAsNumber: true }
                              )}
                            />
                          </div>
                          <div>
                            <Label>شدت تمرین</Label>
                            <Select
                              className="h-8 text-xs"
                              {...form.register(
                                `templates.${activeTemplateIdx}.exercises.${rIdx}.intensity`
                              )}
                            >
                              {Object.values(CardioIntensity).map((ci) => (
                                <option key={ci} value={ci}>
                                  {CARDIO_INTENSITY_LABELS[ci]}
                                </option>
                              ))}
                            </Select>
                          </div>
                          <div>
                            <Label>مسافت اختیاری (km)</Label>
                            <Input
                              type="number"
                              min={0}
                              step={0.1}
                              className="h-8 text-xs tabular-nums"
                              {...form.register(
                                `templates.${activeTemplateIdx}.exercises.${rIdx}.targetDistanceKm`,
                                {
                                  setValueAs: (v: string) =>
                                    v === '' ? undefined : Number(v),
                                }
                              )}
                            />
                          </div>
                          <div>
                            <Label>سرعت اختیاری (km/h)</Label>
                            <Input
                              type="number"
                              min={0}
                              step={0.5}
                              className="h-8 text-xs tabular-nums"
                              {...form.register(
                                `templates.${activeTemplateIdx}.exercises.${rIdx}.targetSpeedKmh`,
                                {
                                  setValueAs: (v: string) =>
                                    v === '' ? undefined : Number(v),
                                }
                              )}
                            />
                          </div>
                        </div>
                      )}

                      {/* Stretching / Mobility / Balance Form */}
                      {exType !== ExerciseType.STRENGTH && exType !== ExerciseType.CARDIO && (
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label>مدت نگهداری (ثانیه)</Label>
                            <Input
                              type="number"
                              min={5}
                              className="h-8 text-xs tabular-nums"
                              {...form.register(
                                `templates.${activeTemplateIdx}.exercises.${rIdx}.holdSeconds`,
                                { valueAsNumber: true }
                              )}
                            />
                          </div>
                          <div>
                            <Label>تعداد ست</Label>
                            <Input
                              type="number"
                              min={1}
                              className="h-8 text-xs tabular-nums"
                              {...form.register(
                                `templates.${activeTemplateIdx}.exercises.${rIdx}.sets`,
                                { valueAsNumber: true }
                              )}
                            />
                          </div>
                          <div>
                            <Label>تعداد تکرار</Label>
                            <Input
                              type="number"
                              min={1}
                              className="h-8 text-xs tabular-nums"
                              {...form.register(
                                `templates.${activeTemplateIdx}.exercises.${rIdx}.reps`,
                                { valueAsNumber: true }
                              )}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {currentTpl.exercises.length === 0 && (
                  <p className="text-xs text-[var(--color-error)]">
                    حداقل یک حرکت برای این جلسه اضافه کنید.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
          <Button variant="ghost" onClick={onClose}>
            انصراف
          </Button>
          <Button type="submit">ذخیره برنامه و قالب جلسات</Button>
        </div>
      </form>
    </Dialog>
  );
}
