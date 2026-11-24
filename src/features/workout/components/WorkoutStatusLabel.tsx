import {
  CheckCircle2,
  Clock,
  PlayCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { WORKOUT_STATUS_LABELS } from '../../../shared/constants/workout';
import { WorkoutSessionStatus } from '../../../shared/types/workout';
import { cn } from '../../../shared/utils/cn';

export const WORKOUT_STATUS_META: Record<
  WorkoutSessionStatus,
  {
    label: string;
    textClass: string;
    surfaceClass: string;
    dotColorClass: string;
    Icon: typeof Clock;
  }
> = {
  [WorkoutSessionStatus.PLANNED]: {
    label: WORKOUT_STATUS_LABELS[WorkoutSessionStatus.PLANNED],
    textClass: 'text-[var(--color-accent)]',
    surfaceClass: 'bg-[var(--color-accent-subtle)] border-[var(--color-accent)]/30',
    dotColorClass: 'bg-[var(--color-accent)]',
    Icon: Clock,
  },
  [WorkoutSessionStatus.IN_PROGRESS]: {
    label: WORKOUT_STATUS_LABELS[WorkoutSessionStatus.IN_PROGRESS],
    textClass: 'text-[var(--color-primary)]',
    surfaceClass: 'bg-[var(--color-primary-subtle)] border-[var(--color-primary)]/35',
    dotColorClass: 'bg-[var(--color-primary)]',
    Icon: PlayCircle,
  },
  [WorkoutSessionStatus.COMPLETED]: {
    label: WORKOUT_STATUS_LABELS[WorkoutSessionStatus.COMPLETED],
    textClass: 'text-[var(--color-success)]',
    surfaceClass: 'bg-[var(--color-success-subtle)] border-[var(--color-success)]/35',
    dotColorClass: 'bg-[var(--color-success)]',
    Icon: CheckCircle2,
  },
  [WorkoutSessionStatus.MISSED]: {
    label: WORKOUT_STATUS_LABELS[WorkoutSessionStatus.MISSED],
    textClass: 'text-[var(--color-warning)]',
    surfaceClass: 'bg-[var(--color-warning-subtle)] border-[var(--color-warning)]/35',
    dotColorClass: 'bg-[var(--color-warning)]',
    Icon: AlertCircle,
  },
  [WorkoutSessionStatus.CANCELLED]: {
    label: WORKOUT_STATUS_LABELS[WorkoutSessionStatus.CANCELLED],
    textClass: 'text-[var(--text-muted)]',
    surfaceClass: 'bg-[var(--bg-surface-muted)] border-[var(--border-subtle)]',
    dotColorClass: 'bg-[var(--text-muted)]',
    Icon: XCircle,
  },
};

export function WorkoutStatusLabel({
  status,
  className,
}: {
  status: WorkoutSessionStatus;
  className?: string;
}) {
  const meta = WORKOUT_STATUS_META[status];
  const Icon = meta.Icon;

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', meta.textClass, className)}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{meta.label}</span>
    </span>
  );
}
