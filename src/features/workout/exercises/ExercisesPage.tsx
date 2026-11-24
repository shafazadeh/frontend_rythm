import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { BookOpen, Dumbbell, Edit3, Plus, Search, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRhythmData, useRhythmMutations } from '../../../services/api/useRhythmQueries';
import { Button } from '../../../shared/components/ui/Button';
import { Card, CardContent } from '../../../shared/components/ui/Card';
import {
  Checkbox,
  Input,
  Label,
  Select,
  Skeleton,
  Switch,
  Textarea,
} from '../../../shared/components/ui/FormControls';
import { ConfirmDialog, Dialog, EmptyState, Sheet } from '../../../shared/components/ui/Overlays';
import {
  COMMON_EQUIPMENT_LIST,
  COMMON_MUSCLE_GROUPS,
  DIFFICULTY_LABELS,
  EXERCISE_TYPE_LABELS,
} from '../../../shared/constants/workout';
import { DifficultyLevel, Exercise, ExerciseType } from '../../../shared/types/workout';
import { formatFaNumber, generateId } from '../../../shared/utils/cn';
import { exerciseFormSchema } from '../../../shared/validation/workoutSchemas';

type ExerciseFormValues = z.infer<typeof exerciseFormSchema>;

export function ExercisesPage() {
  const { data, isLoading } = useRhythmData();
  const { upsertExercise, deleteExercise } = useRhythmMutations();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [muscleFilter, setMuscleFilter] = useState<string>('ALL');
  const [equipmentFilter, setEquipmentFilter] = useState<string>('ALL');

  const [detailExercise, setDetailExercise] = useState<Exercise | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Exercise | null>(null);

  const form = useForm<ExerciseFormValues>({
    resolver: zodResolver(exerciseFormSchema),
    defaultValues: {
      persianName: '',
      englishName: '',
      type: ExerciseType.STRENGTH,
      categoryId: 'ex_cat_strength',
      targetMuscleGroups: ['کل بدن'],
      difficulty: DifficultyLevel.BEGINNER,
      equipment: ['بدون وسیله (وزن بدن)'],
      instructions: '',
      safetyNotes: '',
      mediaUrl: '',
      defaultMet: 5.0,
      isActive: true,
    },
  });

  const allMuscles = useMemo(() => {
    const set = new Set<string>(COMMON_MUSCLE_GROUPS);
    data?.exercises.forEach((e) => e.targetMuscleGroups.forEach((m) => set.add(m)));
    return Array.from(set);
  }, [data?.exercises]);

  const allEquipments = useMemo(() => {
    const set = new Set<string>(COMMON_EQUIPMENT_LIST);
    data?.exercises.forEach((e) => e.equipment.forEach((eq) => set.add(eq)));
    return Array.from(set);
  }, [data?.exercises]);

  const filteredExercises = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.exercises
      .filter((e) => typeFilter === 'ALL' || e.type === typeFilter)
      .filter((e) => muscleFilter === 'ALL' || e.targetMuscleGroups.includes(muscleFilter))
      .filter((e) => equipmentFilter === 'ALL' || e.equipment.includes(equipmentFilter))
      .filter(
        (e) =>
          !q ||
          e.persianName.toLowerCase().includes(q) ||
          (e.englishName ?? '').toLowerCase().includes(q)
      );
  }, [data, search, typeFilter, muscleFilter, equipmentFilter]);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const openCreate = () => {
    setEditingExercise(null);
    form.reset({
      persianName: '',
      englishName: '',
      type: ExerciseType.STRENGTH,
      categoryId: data.exerciseCategories[0]?.id ?? 'ex_cat_strength',
      targetMuscleGroups: ['سینه'],
      difficulty: DifficultyLevel.BEGINNER,
      equipment: ['دمبل'],
      instructions: '',
      safetyNotes: '',
      mediaUrl: '',
      defaultMet: 5.0,
      isActive: true,
    });
    setEditorOpen(true);
  };

  const openEdit = (ex: Exercise) => {
    setEditingExercise(ex);
    form.reset({
      persianName: ex.persianName,
      englishName: ex.englishName ?? '',
      type: ex.type,
      categoryId: ex.categoryId,
      targetMuscleGroups: ex.targetMuscleGroups,
      difficulty: ex.difficulty,
      equipment: ex.equipment,
      instructions: ex.instructions,
      safetyNotes: ex.safetyNotes,
      mediaUrl: ex.mediaUrl ?? '',
      defaultMet: ex.defaultMet,
      isActive: ex.isActive,
    });
    setEditorOpen(true);
  };

  const toggleArrayValue = (field: 'targetMuscleGroups' | 'equipment', item: string) => {
    const current = form.getValues(field);
    const exists = current.includes(item);
    form.setValue(
      field,
      exists ? current.filter((v) => v !== item) : [...current, item],
      { shouldValidate: true }
    );
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    const now = new Date().toISOString();
    const matchedCat = data.exerciseCategories.find((c) => c.type === values.type);
    await upsertExercise.mutateAsync({
      id: editingExercise?.id ?? generateId('ex'),
      persianName: values.persianName,
      englishName: values.englishName?.trim() || undefined,
      type: values.type,
      categoryId: matchedCat?.id ?? values.categoryId,
      targetMuscleGroups: values.targetMuscleGroups,
      difficulty: values.difficulty,
      equipment: values.equipment,
      instructions: values.instructions,
      safetyNotes: values.safetyNotes,
      mediaUrl: values.mediaUrl?.trim() || undefined,
      defaultMet: values.defaultMet,
      isActive: values.isActive,
      createdAt: editingExercise?.createdAt ?? now,
      updatedAt: now,
    });
    setEditorOpen(false);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
            بانک حرکات ورزشی
          </h1>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            مدیریت حرکات قدرتی، هوازی، کششی، تحرک‌پذیری و تعادلی همراه با مقدار MET مرجع ({formatFaNumber(data.exercises.length)} حرکت)
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          <span>افزودن حرکت</span>
        </Button>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-4 relative">
            <Search className="h-4 w-4 text-[var(--text-muted)] absolute right-3 top-3 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جست‌وجوی نام فارسی یا انگلیسی حرکت..."
              className="pr-9"
            />
          </div>
          <div className="md:col-span-3">
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="ALL">همه انواع ورزش</option>
              {Object.values(ExerciseType).map((t) => (
                <option key={t} value={t}>
                  {EXERCISE_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-3">
            <Select value={muscleFilter} onChange={(e) => setMuscleFilter(e.target.value)}>
              <option value="ALL">همه گروه‌های عضلانی</option>
              {allMuscles.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-2">
            <Select value={equipmentFilter} onChange={(e) => setEquipmentFilter(e.target.value)}>
              <option value="ALL">همه تجهیزات</option>
              {allEquipments.map((eq) => (
                <option key={eq} value={eq}>
                  {eq}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Exercises Grid */}
      {filteredExercises.length === 0 ? (
        <EmptyState
          icon={<Dumbbell className="h-6 w-6" />}
          title="حرکتی با این فیلترها یافت نشد"
          description="فیلترهای جست‌وجو را تغییر دهید یا یک حرکت جدید به بانک اضافه کنید."
          action={
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              <span>افزودن حرکت</span>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExercises.map((ex) => (
            <Card key={ex.id} className="flex flex-col justify-between">
              <CardContent className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">
                      {ex.persianName}
                    </h3>
                    {ex.englishName && (
                      <div className="text-[11px] text-[var(--text-muted)]" dir="ltr">
                        {ex.englishName}
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-medium text-[var(--color-primary)] whitespace-nowrap">
                    {EXERCISE_TYPE_LABELS[ex.type]}
                  </span>
                </div>

                <div className="text-xs text-[var(--text-secondary)]">
                  <span>عضلات هدف: {ex.targetMuscleGroups.join('، ')}</span>
                </div>

                <div className="text-xs text-[var(--text-muted)] tabular-nums">
                  {DIFFICULTY_LABELS[ex.difficulty]} · {ex.equipment.join('، ')} · MET{' '}
                  {formatFaNumber(ex.defaultMet, 1)}
                </div>

                <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                  {ex.instructions}
                </p>
              </CardContent>

              <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--border-subtle)]">
                <Button size="sm" variant="ghost" onClick={() => setDetailExercise(ex)}>
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>روش اجرا و نکات</span>
                </Button>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="ویرایش حرکت"
                    onClick={() => openEdit(ex)}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="حذف حرکت"
                    onClick={() => setDeleteTarget(ex)}
                  >
                    <Trash2 className="h-4 w-4 text-[var(--text-muted)]" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Exercise Detail Drawer */}
      <Sheet
        open={Boolean(detailExercise)}
        onClose={() => setDetailExercise(null)}
        title={detailExercise?.persianName ?? ''}
        subtitle={
          detailExercise
            ? `${EXERCISE_TYPE_LABELS[detailExercise.type]} · ${DIFFICULTY_LABELS[detailExercise.difficulty]}`
            : ''
        }
      >
        {detailExercise && (
          <div className="space-y-4 text-xs leading-relaxed">
            {detailExercise.englishName && (
              <div className="text-[var(--text-muted)]" dir="ltr">
                {detailExercise.englishName}
              </div>
            )}
            <div className="rounded-lg bg-[var(--bg-surface-muted)]/60 p-3.5 space-y-1.5">
              <div>
                <span className="font-semibold">عضلات هدف: </span>
                <span>{detailExercise.targetMuscleGroups.join('، ')}</span>
              </div>
              <div>
                <span className="font-semibold">تجهیزات موردنیاز: </span>
                <span>{detailExercise.equipment.join('، ')}</span>
              </div>
              <div className="tabular-nums">
                <span className="font-semibold">مقدار MET مرجع: </span>
                <span>{formatFaNumber(detailExercise.defaultMet, 1)}</span>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                روش صحیح اجرا
              </h4>
              <p className="text-[var(--text-secondary)]">{detailExercise.instructions}</p>
            </div>

            <div className="rounded-lg border border-[var(--color-warning)]/35 bg-[var(--color-warning-subtle)] p-3 text-[var(--color-warning)]">
              <div className="font-semibold mb-1">نکات ایمنی</div>
              <p>{detailExercise.safetyNotes}</p>
            </div>

            {detailExercise.mediaUrl && (
              <div>
                <h4 className="font-semibold mb-1">لینک راهنمای آموزشی</h4>
                <a
                  href={detailExercise.mediaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--color-primary)] underline break-all"
                >
                  {detailExercise.mediaUrl}
                </a>
              </div>
            )}
          </div>
        )}
      </Sheet>

      {/* Exercise Editor Dialog */}
      <Dialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingExercise ? `ویرایش «${editingExercise.persianName}»` : 'افزودن حرکت ورزشی جدید'}
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ex-fa">نام فارسی حرکت</Label>
              <Input id="ex-fa" {...form.register('persianName')} />
              {form.formState.errors.persianName && (
                <p className="mt-1 text-xs text-[var(--color-error)]">
                  {form.formState.errors.persianName.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="ex-en">نام انگلیسی (اختیاری)</Label>
              <Input id="ex-en" {...form.register('englishName')} dir="ltr" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="ex-type">دسته‌بندی / نوع حرکت</Label>
              <Select id="ex-type" {...form.register('type')}>
                {Object.values(ExerciseType).map((t) => (
                  <option key={t} value={t}>
                    {EXERCISE_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="ex-diff">سطح دشواری</Label>
              <Select id="ex-diff" {...form.register('difficulty')}>
                {Object.values(DifficultyLevel).map((d) => (
                  <option key={d} value={d}>
                    {DIFFICULTY_LABELS[d]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="ex-met">مقدار MET مرجع</Label>
              <Input
                id="ex-met"
                type="number"
                step={0.1}
                {...form.register('defaultMet', { valueAsNumber: true })}
              />
            </div>
          </div>

          <div>
            <Label>گروه‌های عضلانی هدف</Label>
            <div className="flex flex-wrap gap-3 pt-1">
              {COMMON_MUSCLE_GROUPS.map((m) => (
                <label key={m} className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                  <Checkbox
                    checked={form.watch('targetMuscleGroups').includes(m)}
                    onCheckedChange={() => toggleArrayValue('targetMuscleGroups', m)}
                  />
                  <span>{m}</span>
                </label>
              ))}
            </div>
            {form.formState.errors.targetMuscleGroups && (
              <p className="mt-1 text-xs text-[var(--color-error)]">
                {form.formState.errors.targetMuscleGroups.message}
              </p>
            )}
          </div>

          <div>
            <Label>تجهیزات موردنیاز</Label>
            <div className="flex flex-wrap gap-3 pt-1">
              {COMMON_EQUIPMENT_LIST.map((eq) => (
                <label key={eq} className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                  <Checkbox
                    checked={form.watch('equipment').includes(eq)}
                    onCheckedChange={() => toggleArrayValue('equipment', eq)}
                  />
                  <span>{eq}</span>
                </label>
              ))}
            </div>
            {form.formState.errors.equipment && (
              <p className="mt-1 text-xs text-[var(--color-error)]">
                {form.formState.errors.equipment.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="ex-inst">توضیح و روش صحیح اجرا</Label>
            <Textarea id="ex-inst" rows={3} {...form.register('instructions')} />
            {form.formState.errors.instructions && (
              <p className="mt-1 text-xs text-[var(--color-error)]">
                {form.formState.errors.instructions.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="ex-safe">نکات ایمنی</Label>
            <Textarea id="ex-safe" rows={2} className="min-h-[60px]" {...form.register('safetyNotes')} />
            {form.formState.errors.safetyNotes && (
              <p className="mt-1 text-xs text-[var(--color-error)]">
                {form.formState.errors.safetyNotes.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="ex-media">لینک تصویر یا ویدیوی آموزشی (اختیاری)</Label>
            <Input id="ex-media" {...form.register('mediaUrl')} dir="ltr" placeholder="https://..." />
          </div>

          <div className="flex items-center justify-between">
            <Label className="mb-0">فعال در بانک حرکات</Label>
            <Switch
              checked={form.watch('isActive')}
              onCheckedChange={(v) => form.setValue('isActive', v)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>
              انصراف
            </Button>
            <Button type="submit">ذخیره حرکت</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteExercise.mutate(deleteTarget.id);
        }}
        title="حذف حرکت ورزشی"
        message={`آیا از حذف حرکت «${deleteTarget?.persianName ?? ''}» مطمئن هستید؟`}
        confirmLabel="حذف"
        destructive
      />
    </div>
  );
}
