import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { formatJalaliFullDate, getPersianDayIndexFromISO, getPersianWeekdayName } from '../../../services/domain/jalaliCalendar';
import {
  checkWorkoutSessionConflicts,
  computeDurationMinutesBetweenTimes,
  minutesToTime,
  timeToMinutes,
} from '../../../services/domain/scheduleConflictChecker';
import { templateExercisesToSessionExercises } from '../../../services/mock/mockWorkouts';
import { Button } from '../../../shared/components/ui/Button';
import { Input, Label, Select, Switch, Textarea } from '../../../shared/components/ui/FormControls';
import { Dialog } from '../../../shared/components/ui/Overlays';
import { CARDIO_INTENSITY_LABELS, EXERCISE_TYPE_LABELS, WORKOUT_STATUS_LABELS } from '../../../shared/constants/workout';
import {
  CardioIntensity,
  Exercise,
  ExerciseType,
  WorkoutProgram,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSessionStatus,
  WorkoutTemplate,
} from '../../../shared/types/workout';
import { generateId, toPersianDigits } from '../../../shared/utils/cn';
import { workoutSessionFormSchema } from '../../../shared/validation/workoutSchemas';

type SessionFormValues = z.infer<typeof workoutSessionFormSchema>;

interface SessionFormDialogProps {
  open: boolean;
  onClose: () => void;
  initialSession?: WorkoutSession | null;
  defaultDateISO?: string;
  programs: WorkoutProgram[];
  templates: WorkoutTemplate[];
  exercises: Exercise[];
  allSessions: WorkoutSession[];
  onSave: (session: WorkoutSession) => Promise<void>;
}

export function SessionFormDialog({
  open,
  onClose,
  initialSession,
  defaultDateISO = '2026-11-19',
  programs,
  templates,
  exercises,
  allSessions,
  onSave,
}: SessionFormDialogProps) {
  const [mode, setMode] = useState<'TEMPLATE' | 'FREE'>('TEMPLATE');
  const [freeExercises, setFreeExercises] = useState<WorkoutSessionExercise[]>([]);
  const [selectedAddExerciseId, setSelectedAddExerciseId] = useState<string>(exercises[0]?.id ?? '');
  const [editStatus, setEditStatus] = useState<WorkoutSessionStatus>(WorkoutSessionStatus.PLANNED);

  const exercisesById = useMemo(
    () => Object.fromEntries(exercises.map((e) => [e.id, e])),
    [exercises]
  );

  const form = useForm<SessionFormValues>({
    resolver: zodResolver(workoutSessionFormSchema),
    defaultValues: {
      title: '',
      type: ExerciseType.STRENGTH,
      dateISO: defaultDateISO,
      startTime: '17:30',
      endTime: '18:15',
      programId: programs[0]?.id ?? '',
      templateId: templates[0]?.id ?? '',
      reminderEnabled: true,
      notes: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    if (initialSession) {
      setMode(initialSession.templateId ? 'TEMPLATE' : 'FREE');
      setFreeExercises(structuredClone(initialSession.exercises));
      setEditStatus(initialSession.status);
      form.reset({
        title: initialSession.title,
        type: initialSession.type,
        dateISO: initialSession.dateISO,
        startTime: initialSession.startTime,
        endTime: initialSession.endTime,
        programId: initialSession.programId ?? '',
        templateId: initialSession.templateId ?? '',
        reminderEnabled: initialSession.reminderEnabled,
        notes: initialSession.notes ?? '',
      });
    } else {
      const firstProg = programs.find((p) => p.isActive) ?? programs[0];
      const firstTpl =
        templates.find((t) => t.programId === firstProg?.id) ?? templates[0];
      const dur = firstTpl?.estimatedDurationMinutes ?? 45;
      setMode(firstTpl ? 'TEMPLATE' : 'FREE');
      setFreeExercises([]);
      setEditStatus(WorkoutSessionStatus.PLANNED);
      form.reset({
        title: firstTpl?.title ?? 'تمرین آزاد',
        type: firstTpl?.type ?? ExerciseType.STRENGTH,
        dateISO: defaultDateISO,
        startTime: '17:30',
        endTime: minutesToTime(timeToMinutes('17:30') + dur),
        programId: firstProg?.id ?? '',
        templateId: firstTpl?.id ?? '',
        reminderEnabled: true,
        notes: '',
      });
    }
    setSelectedAddExerciseId(exercises[0]?.id ?? '');
  }, [open, initialSession, defaultDateISO, programs, templates, exercises, form]);

  const watchedProgramId = form.watch('programId');
  const watchedTemplateId = form.watch('templateId');
  const watchedDateISO = form.watch('dateISO');
  const watchedStart = form.watch('startTime');
  const watchedEnd = form.watch('endTime');
  const watchedTitle = form.watch('title');

  const programTemplates = useMemo(() => {
    if (!watchedProgramId) return templates;
    return templates.filter((t) => t.programId === watchedProgramId);
  }, [templates, watchedProgramId]);

  const conflictResult = useMemo(() => {
    if (!watchedDateISO || !watchedStart || !watchedEnd) {
      return { hasConflict: false, conflicts: [], checkedScopeNote: '' };
    }
    return checkWorkoutSessionConflicts(
      {
        id: initialSession?.id,
        title: watchedTitle || 'جلسه جدید',
        dateISO: watchedDateISO,
        startTime: watchedStart,
        endTime: watchedEnd,
      },
      allSessions
    );
  }, [initialSession?.id, watchedTitle, watchedDateISO, watchedStart, watchedEnd, allSessions]);

  const handleSelectProgram = (progId: string) => {
    form.setValue('programId', progId);
    const matching = templates.filter((t) => t.programId === progId);
    if (matching[0]) {
      handleSelectTemplate(matching[0].id);
    } else {
      form.setValue('templateId', '');
    }
  };

  const handleSelectTemplate = (tplId: string) => {
    form.setValue('templateId', tplId);
    const tpl = templates.find((t) => t.id === tplId);
    if (tpl) {
      form.setValue('title', tpl.title);
      form.setValue('type', tpl.type);
      const startM = timeToMinutes(form.getValues('startTime'));
      form.setValue('endTime', minutesToTime(startM + tpl.estimatedDurationMinutes));
    }
  };

  const handleAddFreeExercise = () => {
    const ex = exercisesById[selectedAddExerciseId];
    if (!ex) return;
    const item: WorkoutSessionExercise =
      ex.type === ExerciseType.STRENGTH
        ? {
            id: generateId('sex'),
            exerciseId: ex.id,
            order: freeExercises.length + 1,
            exerciseType: ex.type,
            restSeconds: 60,
            sets: [1, 2, 3].map((n) => ({
              id: generateId('set'),
              setNumber: n,
              targetReps: 10,
              targetWeightKg: 10,
              actualReps: 10,
              actualWeightKg: 10,
              isCompleted: false,
            })),
            isCompleted: false,
          }
        : ex.type === ExerciseType.CARDIO
        ? {
            id: generateId('sex'),
            exerciseId: ex.id,
            order: freeExercises.length + 1,
            exerciseType: ex.type,
            sets: [],
            targetDurationMinutes: 20,
            actualDurationMinutes: 20,
            targetIntensity: CardioIntensity.MODERATE,
            isCompleted: false,
          }
        : {
            id: generateId('sex'),
            exerciseId: ex.id,
            order: freeExercises.length + 1,
            exerciseType: ex.type,
            sets: [],
            targetSetsCount: 2,
            targetRepsCount: 8,
            holdSeconds: 30,
            isCompleted: false,
          };
    setFreeExercises((prev) => [...prev, item]);
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    const dur = computeDurationMinutesBetweenTimes(values.startTime, values.endTime);
    if (dur <= 0) {
      toast.error('ساعت پایان باید بعد از ساعت شروع باشد.');
      return;
    }

    const now = new Date().toISOString();
    let sessionExercises: WorkoutSessionExercise[] = [];

    if (initialSession && (mode === 'FREE' || values.templateId === initialSession.templateId)) {
      sessionExercises =
        freeExercises.length > 0
          ? freeExercises
          : initialSession.exercises;
    } else if (mode === 'TEMPLATE' && values.templateId) {
      const tpl = templates.find((t) => t.id === values.templateId);
      sessionExercises = tpl ? templateExercisesToSessionExercises(tpl.exercises) : [];
    } else {
      sessionExercises = freeExercises;
    }

    const payload: WorkoutSession = {
      id: initialSession?.id ?? generateId('ws'),
      programId: mode === 'TEMPLATE' && values.programId ? values.programId : undefined,
      templateId: mode === 'TEMPLATE' && values.templateId ? values.templateId : undefined,
      title: values.title,
      type: values.type,
      dateISO: values.dateISO,
      dayIndex: getPersianDayIndexFromISO(values.dateISO),
      startTime: values.startTime,
      endTime: values.endTime,
      estimatedDurationMinutes: dur,
      status: initialSession ? editStatus : WorkoutSessionStatus.PLANNED,
      reminderEnabled: values.reminderEnabled,
      notes: values.notes || undefined,
      exercises: sessionExercises,
      createdAt: initialSession?.createdAt ?? now,
      updatedAt: now,
    };

    await onSave(payload);
    toast.success(initialSession ? 'جلسه تمرینی ویرایش شد.' : 'جلسه تمرینی زمانبندی شد.');
    onClose();
  });

  const dayLabel = watchedDateISO
    ? `${getPersianWeekdayName(getPersianDayIndexFromISO(watchedDateISO))} ${formatJalaliFullDate(watchedDateISO)}`
    : '';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initialSession ? 'ویرایش جلسه تمرینی' : 'افزودن جلسه ورزشی جدید'}
      description="تغییر این جلسه فقط روی همین زمانبندی اعمال می‌شود و قالب اصلی برنامه ورزشی تغییر نمی‌کند."
      maxWidthClass="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-1 rounded-lg bg-[var(--bg-surface-muted)] p-1 w-fit">
          <button
            type="button"
            onClick={() => setMode('TEMPLATE')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              mode === 'TEMPLATE'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            از قالب برنامه
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('FREE');
              form.setValue('programId', '');
              form.setValue('templateId', '');
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              mode === 'FREE'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            جلسه آزاد
          </button>
        </div>

        {mode === 'TEMPLATE' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ws-prog">برنامه تمرینی</Label>
              <Select
                id="ws-prog"
                value={watchedProgramId ?? ''}
                onChange={(e) => handleSelectProgram(e.target.value)}
              >
                <option value="">همه قالب‌ها</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} {!p.isActive ? '(غیرفعال)' : ''}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="ws-tpl">قالب جلسه</Label>
              <Select
                id="ws-tpl"
                value={watchedTemplateId ?? ''}
                onChange={(e) => handleSelectTemplate(e.target.value)}
              >
                <option value="">انتخاب قالب...</option>
                {programTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.estimatedDurationMinutes} دقیقه)
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ws-title">عنوان جلسه</Label>
            <Input id="ws-title" {...form.register('title')} />
            {form.formState.errors.title && (
              <p className="mt-1 text-xs text-[var(--color-error)]">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="ws-type">نوع تمرین</Label>
            <Select id="ws-type" {...form.register('type')}>
              {Object.values(ExerciseType).map((t) => (
                <option key={t} value={t}>
                  {EXERCISE_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label htmlFor="ws-date">تاریخ (نمایش شمسی)</Label>
            <Input id="ws-date" type="date" {...form.register('dateISO')} className="tabular-nums" />
            {dayLabel && (
              <p className="mt-1 text-[11px] text-[var(--color-primary)]">{dayLabel}</p>
            )}
          </div>
          <div>
            <Label htmlFor="ws-start">ساعت شروع (۲۴ ساعته)</Label>
            <Input id="ws-start" type="time" {...form.register('startTime')} className="tabular-nums" />
          </div>
          <div>
            <Label htmlFor="ws-end">ساعت پایان (۲۴ ساعته)</Label>
            <Input id="ws-end" type="time" {...form.register('endTime')} className="tabular-nums" />
          </div>
        </div>

        {conflictResult.hasConflict && (
          <div className="flex items-start gap-2.5 rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-warning-subtle)] p-3 text-xs text-[var(--color-warning)]">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold">
                هشدار تداخل زمانی با {toPersianDigits(conflictResult.conflicts.length)} جلسه دیگر در همین روز:
              </div>
              <ul className="list-disc pr-4 space-y-0.5">
                {conflictResult.conflicts.map((c) => (
                  <li key={c.id}>
                    {c.title} ({toPersianDigits(c.startTime)} تا {toPersianDigits(c.endTime)})
                  </li>
                ))}
              </ul>
              <p className="text-[11px] opacity-90">{conflictResult.checkedScopeNote}</p>
            </div>
          </div>
        )}

        {initialSession && (
          <div>
            <Label htmlFor="ws-status">وضعیت جلسه</Label>
            <Select
              id="ws-status"
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as WorkoutSessionStatus)}
            >
              {Object.values(WorkoutSessionStatus).map((st) => (
                <option key={st} value={st}>
                  {WORKOUT_STATUS_LABELS[st]}
                </option>
              ))}
            </Select>
          </div>
        )}

        {mode === 'FREE' && (
          <div className="space-y-2.5 rounded-lg border border-[var(--border-subtle)] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="mb-0">حرکات جلسه آزاد (اختیاری)</Label>
            </div>
            <div className="flex gap-2">
              <Select
                value={selectedAddExerciseId}
                onChange={(e) => setSelectedAddExerciseId(e.target.value)}
                className="flex-1"
              >
                {exercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.persianName} ({EXERCISE_TYPE_LABELS[ex.type]})
                  </option>
                ))}
              </Select>
              <Button type="button" size="sm" variant="outline" onClick={handleAddFreeExercise}>
                <Plus className="h-3.5 w-3.5" />
                <span>افزودن</span>
              </Button>
            </div>
            {freeExercises.length > 0 && (
              <div className="divide-y divide-[var(--border-subtle)] pt-1">
                {freeExercises.map((fe, idx) => (
                  <div key={fe.id} className="flex items-center justify-between py-2 text-xs">
                    <span>
                      {exercisesById[fe.exerciseId]?.persianName ?? 'حرکت'}
                      {fe.targetIntensity ? ` · ${CARDIO_INTENSITY_LABELS[fe.targetIntensity]}` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFreeExercises((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-[var(--text-muted)] hover:text-[var(--color-error)] cursor-pointer p-1"
                      aria-label="حذف حرکت"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <Label htmlFor="ws-notes">یادداشت جلسه</Label>
          <Textarea id="ws-notes" rows={2} className="min-h-[60px]" {...form.register('notes')} />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] px-3.5 py-2.5">
          <div>
            <div className="text-xs font-medium text-[var(--text-primary)]">
              فعالسازی یادآور جلسه (نمایشی)
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              در نسخه اول اعلان پوش واقعی ارسال نمی‌شود.
            </div>
          </div>
          <Switch
            checked={Boolean(form.watch('reminderEnabled'))}
            onCheckedChange={(v) => form.setValue('reminderEnabled', v)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
          <Button variant="ghost" onClick={onClose}>
            انصراف
          </Button>
          <Button type="submit">{initialSession ? 'ذخیره تغییرات' : 'ثبت جلسه'}</Button>
        </div>
      </form>
    </Dialog>
  );
}
