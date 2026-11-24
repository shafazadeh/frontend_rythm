import { BellRing, Clock, Dumbbell, Pill, Utensils } from 'lucide-react';
import {
  CALENDAR_ACTIVITY_KIND_LABELS,
  CALENDAR_EVENT_THEME,
} from '../../../shared/constants/calendar';
import { CalendarSourceModule, RhythmCalendarEvent } from '../../../shared/types/calendar';
import { cn, toPersianDigits } from '../../../shared/utils/cn';

export function CalendarModuleIcon({
  sourceModule,
  className = 'h-3.5 w-3.5 shrink-0',
}: {
  sourceModule: CalendarSourceModule;
  className?: string;
}) {
  if (sourceModule === 'workout') return <Dumbbell className={className} />;
  if (sourceModule === 'supplement') return <Pill className={className} />;
  if (sourceModule === 'system') return <BellRing className={className} />;
  return <Utensils className={className} />;
}

interface CalendarEventCardProps {
  event: RhythmCalendarEvent;
  onClick: (event: RhythmCalendarEvent) => void;
  compact?: boolean;
}

export function CalendarEventCard({
  event,
  onClick,
  compact = false,
}: CalendarEventCardProps) {
  const theme = CALENDAR_EVENT_THEME[event.sourceModule];
  const isMutedState = event.status === 'CANCELLED' || event.status === 'MISSED';
  const isDraftState = event.status === 'DRAFT' || event.status === 'IN_REVIEW';

  return (
    <button
      type="button"
      onClick={() => onClick(event)}
      className={cn(
        'w-full h-full text-right rounded-lg border transition-colors cursor-pointer flex flex-col justify-between overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
        compact ? 'px-2 py-1.5' : 'p-3',
        theme.surfaceClass,
        theme.borderClass,
        isMutedState && 'opacity-65 line-through decoration-[var(--text-muted)]',
        isDraftState && 'border-dashed'
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <CalendarModuleIcon
            sourceModule={event.sourceModule}
            className={cn('shrink-0', compact ? 'h-3 w-3' : 'h-3.5 w-3.5', theme.textClass)}
          />
          <span
            className={cn(
              'font-semibold truncate',
              compact ? 'text-[11px] leading-tight' : 'text-xs',
              theme.textClass
            )}
          >
            {event.title}
          </span>
        </div>

        {!compact && event.subtitle && (
          <div className="text-[11px] text-[var(--text-secondary)] truncate">
            {event.subtitle}
          </div>
        )}
      </div>

      <div
        className={cn(
          'flex flex-wrap items-center gap-x-1.5 gap-y-0.5 tabular-nums',
          compact ? 'text-[10px]' : 'text-[11px] mt-1.5',
          theme.subtleTextClass
        )}
      >
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          {event.isPointInTime ? (
            <span
              className={cn('inline-block h-1.5 w-1.5 rounded-full shrink-0', theme.markerClass)}
              aria-label="رویداد لحظه‌ای"
              title="رویداد لحظه‌ای"
            />
          ) : (
            <Clock className="h-2.5 w-2.5 shrink-0" />
          )}
          <span>
            {toPersianDigits(event.startTime)}
            {event.endTime ? `–${toPersianDigits(event.endTime)}` : ''}
          </span>
        </span>
        <span aria-hidden="true">·</span>
        <span className="truncate">{CALENDAR_ACTIVITY_KIND_LABELS[event.activityKind]}</span>
        <span aria-hidden="true">·</span>
        <span className="truncate font-medium">{event.statusLabel}</span>
      </div>
    </button>
  );
}
