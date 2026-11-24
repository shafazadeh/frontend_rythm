import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy, Dumbbell, Edit3, Plus, Power, Trash2 } from 'lucide-react';
import { useRhythmData, useRhythmMutations } from '../../../services/api/useRhythmQueries';
import { formatJalaliFullDate } from '../../../services/domain/jalaliCalendar';
import { Button } from '../../../shared/components/ui/Button';
import { Card, CardContent } from '../../../shared/components/ui/Card';
import { Skeleton } from '../../../shared/components/ui/FormControls';
import { ConfirmDialog, EmptyState } from '../../../shared/components/ui/Overlays';
import {
  DIFFICULTY_LABELS,
  EXERCISE_TYPE_LABELS,
  WORKOUT_GOAL_LABELS,
} from '../../../shared/constants/workout';
import { WorkoutProgram } from '../../../shared/types/workout';
import { formatFaNumber } from '../../../shared/utils/cn';
import { ProgramEditorDialog } from './ProgramEditorDialog';

export function WorkoutProgramsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isLoading } = useRhythmData();
  const {
    saveWorkoutProgram,
    duplicateWorkoutProgram,
    toggleWorkoutProgramActive,
    deleteWorkoutProgram,
  } = useRhythmMutations();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<WorkoutProgram | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkoutProgram | null>(null);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setEditingProgram(null);
      setEditorOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
            برنامه‌های ورزشی و قالب جلسات
          </h1>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            ساخت، ویرایش، کپی و مدیریت قالب‌های تمرینی مجزا از جلسات زمانبندی‌شده
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditingProgram(null);
            setEditorOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          <span>ساخت برنامه جدید</span>
        </Button>
      </div>

      {data.workoutPrograms.length === 0 ? (
        <EmptyState
          icon={<Dumbbell className="h-6 w-6" />}
          title="هنوز برنامه ورزشی ساخته نشده است"
          description="اولین برنامه تمرینی خود را همراه با قالب جلسات و حرکات انتخابی بسازید."
          action={
            <Button
              size="sm"
              onClick={() => {
                setEditingProgram(null);
                setEditorOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              <span>ساخت برنامه</span>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {data.workoutPrograms.map((prog) => {
            const progTemplates = data.workoutTemplates.filter((t) => t.programId === prog.id);
            return (
              <Card key={prog.id} className="flex flex-col justify-between">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-bold text-[var(--text-primary)]">
                        {prog.title}
                      </h2>
                      <div className="mt-1 text-xs text-[var(--text-muted)] tabular-nums">
                        {WORKOUT_GOAL_LABELS[prog.goal]} · {DIFFICULTY_LABELS[prog.difficulty]} ·{' '}
                        {formatFaNumber(prog.sessionsPerWeek)} جلسه در هفته
                      </div>
                    </div>
                    <span
                      className={`text-xs font-medium whitespace-nowrap ${
                        prog.isActive ? 'text-[var(--color-success)]' : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {prog.isActive ? 'فعال' : 'غیرفعال'}
                    </span>
                  </div>

                  {prog.description && (
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {prog.description}
                    </p>
                  )}

                  <div className="text-[11px] text-[var(--text-muted)] tabular-nums">
                    شروع: {formatJalaliFullDate(prog.startDateISO)}
                    {prog.endDateISO ? ` · پایان: ${formatJalaliFullDate(prog.endDateISO)}` : ''}
                  </div>

                  {/* Templates list inside program */}
                  <div className="divide-y divide-[var(--border-subtle)] rounded-lg border border-[var(--border-subtle)]">
                    {progTemplates.map((tpl) => (
                      <div
                        key={tpl.id}
                        className="flex items-center justify-between px-3 py-2 text-xs"
                      >
                        <span className="font-medium text-[var(--text-primary)]">{tpl.title}</span>
                        <span className="text-[var(--text-muted)] tabular-nums">
                          {EXERCISE_TYPE_LABELS[tpl.type]} · {formatFaNumber(tpl.exercises.length)} حرکت ·{' '}
                          {formatFaNumber(tpl.estimatedDurationMinutes)} دقیقه
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>

                <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-t border-[var(--border-subtle)]">
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        toggleWorkoutProgramActive.mutate({
                          programId: prog.id,
                          isActive: !prog.isActive,
                        })
                      }
                    >
                      <Power className="h-3.5 w-3.5" />
                      <span>{prog.isActive ? 'غیرفعالسازی' : 'فعالسازی'}</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => duplicateWorkoutProgram.mutate(prog.id)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>کپی</span>
                    </Button>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingProgram(prog);
                        setEditorOpen(true);
                      }}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>ویرایش</span>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="حذف برنامه"
                      onClick={() => setDeleteTarget(prog)}
                    >
                      <Trash2 className="h-4 w-4 text-[var(--text-muted)]" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ProgramEditorDialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        program={editingProgram}
        templates={data.workoutTemplates}
        exercises={data.exercises}
        hasScheduledSessions={
          editingProgram
            ? data.workoutSessions.some((s) => s.programId === editingProgram.id)
            : false
        }
        onSave={async (program, templates) => {
          await saveWorkoutProgram.mutateAsync({ program, templates });
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteWorkoutProgram.mutate(deleteTarget.id);
        }}
        title="حذف برنامه ورزشی"
        message={`آیا از حذف برنامه «${deleteTarget?.title ?? ''}» مطمئن هستید؟ جلسات زمانبندی‌شده قبلی در تقویم حفظ می‌شوند.`}
        confirmLabel="حذف برنامه"
        destructive
      />
    </div>
  );
}
