import { AlertTriangle, CheckCircle2, Clock, CircleDashed } from 'lucide-react';
import { DAILY_STATUS_LABELS } from '../constants/units';
import { DailyPlanStatus } from '../types/domain';
import { cn } from '../utils/cn';

/**
 * Unboxed semantic status indicator with icon + explicit Persian text label (no pill capsules, no hue-only signaling).
 */
export function DailyStatusLabel({
  status,
  className,
}: {
  status: DailyPlanStatus;
  className?: string;
}) {
  const config: Record<
    DailyPlanStatus,
    { colorClass: string; Icon: typeof CheckCircle2 }
  > = {
    [DailyPlanStatus.CONFIRMED]: {
      colorClass: 'text-[var(--color-success)]',
      Icon: CheckCircle2,
    },
    [DailyPlanStatus.IN_REVIEW]: {
      colorClass: 'text-[var(--color-accent)]',
      Icon: Clock,
    },
    [DailyPlanStatus.DRAFT]: {
      colorClass: 'text-[var(--color-warning)]',
      Icon: AlertTriangle,
    },
    [DailyPlanStatus.UNPLANNED]: {
      colorClass: 'text-[var(--text-muted)]',
      Icon: CircleDashed,
    },
  };

  const { colorClass, Icon } = config[status];

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap', colorClass, className)}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{DAILY_STATUS_LABELS[status]}</span>
    </span>
  );
}
