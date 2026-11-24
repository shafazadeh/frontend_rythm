import { useMemo, useState } from 'react';
import { CalendarDays, Info } from 'lucide-react';
import {
  layoutOverlappingDayEvents,
  PositionedCalendarEvent,
} from '../../../services/domain/calendarOverlapLayout';
import {
  formatJalaliDayMonth,
  formatJalaliFullDate,
  getPersianWeekdayName,
} from '../../../services/domain/jalaliCalendar';
import { Card, CardContent } from '../../../shared/components/ui/Card';
import { EmptyState } from '../../../shared/components/ui/Overlays';
import { CalendarDisplayPreferences, RhythmCalendarEvent } from '../../../shared/types/calendar';
import { cn, formatFaNumber, toPersianDigits } from '../../../shared/utils/cn';
import { CalendarEventCard } from './CalendarEventCard';

interface WeeklyCalendarGridProps {
  dayDatesISO: string[];
  events: RhythmCalendarEvent[];
  displayRange: CalendarDisplayPreferences;
  todayISO: string;
  onSelectEvent: (event: RhythmCalendarEvent) => void;
}

const HOUR_ROW_HEIGHT_PX = 64;

export function WeeklyCalendarGrid({
  dayDatesISO,
  events,
  displayRange,
  todayISO,
  onSelectEvent,
}: WeeklyCalendarGridProps) {
  const todayIdx = Math.max(0, dayDatesISO.indexOf(todayISO));
  const [mobileDayIdx, setMobileDayIdx] = useState<number>(todayIdx >= 0 ? todayIdx : 0);

  const startHour = Math.min(22, Math.max(0, displayRange.startHour));
  const endHour = Math.min(23, Math.max(startHour + 1, displayRange.endHour));
  const hours = useMemo(() => {
    const list: number[] = [];
    for (let h = startHour; h <= endHour; h += 1) {
      list.push(h);
    }
    return list;
  }, [startHour, endHour]);

  const totalMinutesSpan = (endHour - startHour + 1) * 60;
  const gridHeightPx = hours.length * HOUR_ROW_HEIGHT_PX;

  const eventsByDay = useMemo(() => {
    return dayDatesISO.map((dateISO) =>
      events.filter((e) => e.dateISO === dateISO)
    );
  }, [dayDatesISO, events]);

  const positionedByDay: PositionedCalendarEvent[][] = useMemo(() => {
    return eventsByDay.map((dayEvents) =>
      layoutOverlappingDayEvents(dayEvents, startHour, endHour)
    );
  }, [eventsByDay, startHour, endHour]);

  // Identify events outside configured visible hour range so none are silently hidden
  const outOfRangeEvents = useMemo(() => {
    const positionedIds = new Set(
      positionedByDay.flat().map((p) => p.event.id)
    );
    return events.filter((e) => !positionedIds.has(e.id));
  }, [events, positionedByDay]);

  const mobileSelectedDateISO = dayDatesISO[mobileDayIdx] ?? dayDatesISO[0];
  const mobileDayEvents = eventsByDay[mobileDayIdx] ?? [];

  return (
    <div className="space-y-4">
      {/* Desktop 7-Column Hourly Time Grid */}
      <Card className="hidden lg:block overflow-hidden">
        <CardContent className="p-0">
          {/* Weekday Column Headers */}
          <div className="grid grid-cols-[68px_repeat(7,minmax(0,1fr))] border-b border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]/60">
            <div className="py-3 px-2 text-center text-[11px] font-medium text-[var(--text-muted)] border-l border-[var(--border-subtle)]">
              ساعت
            </div>
            {dayDatesISO.map((dateISO, idx) => {
              const isToday = dateISO === todayISO;
              const dayCount = eventsByDay[idx]?.length ?? 0;
              return (
                <div
                  key={dateISO}
                  className={cn(
                    'py-2.5 px-2 text-center border-l last:border-l-0 border-[var(--border-subtle)]',
                    isToday && 'bg-[var(--color-primary-subtle)]/55'
                  )}
                >
                  <div className="text-xs font-bold text-[var(--text-primary)]">
                    {getPersianWeekdayName(idx)}
                  </div>
                  <div
                    className={cn(
                      'mt-0.5 text-[11px] tabular-nums',
                      isToday ? 'text-[var(--color-primary)] font-semibold' : 'text-[var(--text-muted)]'
                    )}
                  >
                    {formatJalaliDayMonth(dateISO)} · {formatFaNumber(dayCount)} مورد
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scrollable Hourly Body */}
          <div className="overflow-y-auto max-h-[700px]">
            <div
              className="grid grid-cols-[68px_repeat(7,minmax(0,1fr))] relative"
              style={{ height: `${gridHeightPx}px` }}
            >
              {/* Time Gutter */}
              <div className="border-l border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                {hours.map((h) => (
                  <div
                    key={h}
                    className="border-b border-[var(--border-subtle)] px-2 pt-1.5 text-[11px] text-[var(--text-muted)] tabular-nums text-center"
                    style={{ height: `${HOUR_ROW_HEIGHT_PX}px` }}
                  >
                    {toPersianDigits(`${String(h).padStart(2, '0')}:00`)}
                  </div>
                ))}
              </div>

              {/* 7 Day Columns (Saturday to Friday) */}
              {dayDatesISO.map((dateISO, dayIdx) => {
                const positioned = positionedByDay[dayIdx] ?? [];
                const isToday = dateISO === todayISO;

                return (
                  <div
                    key={dateISO}
                    className={cn(
                      'relative border-l last:border-l-0 border-[var(--border-subtle)]',
                      isToday && 'bg-[var(--color-primary-subtle)]/20'
                    )}
                  >
                    {/* Background Hour Lines */}
                    {hours.map((h) => (
                      <div
                        key={h}
                        className="border-b border-[var(--border-subtle)]/75"
                        style={{ height: `${HOUR_ROW_HEIGHT_PX}px` }}
                      />
                    ))}

                    {/* Positioned Events Layer */}
                    {positioned.map((item) => {
                      const startOffsetMin = Math.max(0, item.startMinutes - startHour * 60);
                      const endOffsetMin = Math.min(
                        totalMinutesSpan,
                        item.visualEndMinutes - startHour * 60
                      );
                      const durationMin = Math.max(32, endOffsetMin - startOffsetMin);

                      const topPct = (startOffsetMin / totalMinutesSpan) * 100;
                      const heightPct = (durationMin / totalMinutesSpan) * 100;
                      const laneWidthPct = 100 / item.totalLanes;
                      const laneStartPct = item.laneIndex * laneWidthPct;

                      return (
                        <div
                          key={item.event.id}
                          className="absolute p-0.5 z-10"
                          style={{
                            top: `${topPct}%`,
                            height: `${heightPct}%`,
                            minHeight: '42px',
                            insetInlineStart: `${laneStartPct}%`,
                            width: `${laneWidthPct}%`,
                          }}
                        >
                          <CalendarEventCard
                            event={item.event}
                            onClick={onSelectEvent}
                            compact
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Day Selector + Single Day Chronological List */}
      <div className="lg:hidden space-y-4">
        <div className="grid grid-cols-7 gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2">
          {dayDatesISO.map((dateISO, idx) => {
            const isSelected = mobileDayIdx === idx;
            const dayCount = eventsByDay[idx]?.length ?? 0;
            return (
              <button
                key={dateISO}
                type="button"
                onClick={() => setMobileDayIdx(idx)}
                className={cn(
                  'min-h-[48px] flex flex-col items-center justify-center rounded-lg px-1 py-1.5 text-center transition-colors cursor-pointer',
                  isSelected
                    ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                    : 'bg-[var(--bg-surface-muted)]/60 text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]'
                )}
              >
                <span className="text-[11px] font-semibold truncate max-w-full">
                  {getPersianWeekdayName(idx).slice(0, 2)}
                </span>
                <span className="text-[10px] opacity-85 tabular-nums mt-0.5">
                  {formatFaNumber(dayCount)}
                </span>
              </button>
            );
          })}
        </div>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
              <div className="text-sm font-bold text-[var(--text-primary)]">
                {getPersianWeekdayName(mobileDayIdx)} {formatJalaliFullDate(mobileSelectedDateISO)}
              </div>
              <div className="text-xs text-[var(--text-muted)] tabular-nums">
                {formatFaNumber(mobileDayEvents.length)} رویداد
              </div>
            </div>

            {mobileDayEvents.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="h-5 w-5" />}
                title="رویدادی برای این روز ثبت نشده است"
                description="وعده‌های غذایی، مکمل‌ها و جلسات ورزشی این روز پس از ثبت در ماژول‌های مربوطه اینجا نمایش داده می‌شوند."
              />
            ) : (
              <div className="space-y-2.5">
                {mobileDayEvents.map((evt) => (
                  <div key={evt.id}>
                    <CalendarEventCard event={evt} onClick={onSelectEvent} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Out-of-hour-range notice if user narrowed display hours */}
      {outOfRangeEvents.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2.5 text-xs text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-[var(--color-accent)] shrink-0" />
            <span>
              {formatFaNumber(outOfRangeEvents.length)} رویداد خارج از بازه ساعتی نمایش فعلی ({toPersianDigits(
                `${String(startHour).padStart(2, '0')}:00`
              )} تا {toPersianDigits(`${String(endHour).padStart(2, '0')}:00`)}) قرار دارد.
            </span>
          </span>
          <div className="flex flex-wrap gap-2">
            {outOfRangeEvents.map((evt) => (
              <button
                key={evt.id}
                type="button"
                onClick={() => onSelectEvent(evt)}
                className="underline text-[var(--color-primary)] cursor-pointer tabular-nums"
              >
                {evt.title} ({toPersianDigits(evt.startTime)})
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
