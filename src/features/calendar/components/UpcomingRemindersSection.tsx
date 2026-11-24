import { useMemo, useState } from 'react';
import { Bell, Eye } from 'lucide-react';
import { buildUpcomingReminders } from '../../../services/domain/calendarAdapters';
import {
  formatJalaliDayMonth,
  getPersianWeekdayName,
} from '../../../services/domain/jalaliCalendar';
import { Button } from '../../../shared/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../shared/components/ui/Card';
import { Select, Switch } from '../../../shared/components/ui/FormControls';
import { EmptyState } from '../../../shared/components/ui/Overlays';
import {
  CALENDAR_ACTIVITY_KIND_LABELS,
  REMINDER_LEAD_TIME_PRESETS,
} from '../../../shared/constants/calendar';
import {
  CalendarNotificationPreferences,
  NotificationCategoryKey,
  RhythmCalendarEvent,
} from '../../../shared/types/calendar';
import { formatFaNumber, toPersianDigits } from '../../../shared/utils/cn';
import { CalendarModuleIcon } from './CalendarEventCard';

interface UpcomingRemindersSectionProps {
  events: RhythmCalendarEvent[];
  notificationPrefs: CalendarNotificationPreferences;
  onUpdateEventReminder: (
    eventId: string,
    override: { enabled: boolean; leadTimeMinutes: number }
  ) => Promise<unknown>;
  onOpenEventDetail: (event: RhythmCalendarEvent) => void;
  onOpenNotificationSettings: () => void;
}

export function UpcomingRemindersSection({
  events,
  notificationPrefs,
  onUpdateEventReminder,
  onOpenEventDetail,
  onOpenNotificationSettings,
}: UpcomingRemindersSectionProps) {
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | NotificationCategoryKey>('ALL');

  const reminders = useMemo(
    () => buildUpcomingReminders(events, notificationPrefs),
    [events, notificationPrefs]
  );

  const filteredReminders = useMemo(() => {
    if (categoryFilter === 'ALL') return reminders;
    return reminders.filter((r) => r.category === categoryFilter);
  }, [reminders, categoryFilter]);

  const activeCount = reminders.filter((r) => r.enabled).length;

  return (
    <Card>
      <CardHeader className="flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-[var(--color-primary)]" />
            <CardTitle>یادآوری‌های پیشرو</CardTitle>
          </div>
          <CardDescription>
            ساخته‌شده از رویدادهای واقعی هفته ({formatFaNumber(activeCount)} یادآور فعال از{' '}
            {formatFaNumber(reminders.length)} رویداد)
          </CardDescription>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-44">
            <Select
              aria-label="فیلتر نوع یادآور"
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(e.target.value as 'ALL' | NotificationCategoryKey)
              }
              className="h-9 text-xs"
            >
              <option value="ALL">همه انواع فعالیت</option>
              {(Object.keys(CALENDAR_ACTIVITY_KIND_LABELS) as NotificationCategoryKey[]).map(
                (k) => (
                  <option key={k} value={k}>
                    {CALENDAR_ACTIVITY_KIND_LABELS[k]}
                  </option>
                )
              )}
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={onOpenNotificationSettings}>
            تنظیمات دسته‌بندی‌ها
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {filteredReminders.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-5 w-5" />}
            title="یادآوری در این فیلتر وجود ندارد"
            description="با ثبت وعده، مکمل یا جلسه ورزشی در هفته انتخابی، یادآوری‌های پیشرو به‌صورت خودکار اینجا ساخته می‌شوند."
          />
        ) : (
          <div className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)]">
            {filteredReminders.slice(0, 14).map((item) => {
              const isPreset = REMINDER_LEAD_TIME_PRESETS.some(
                (p) => p.value === item.leadTimeMinutes
              );

              return (
                <div
                  key={item.eventId}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-4 py-3 text-xs"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="mt-0.5 text-[var(--color-primary)] shrink-0">
                      <CalendarModuleIcon sourceModule={item.event.sourceModule} />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-semibold text-[var(--text-primary)] truncate">
                        {item.event.title}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--text-secondary)] tabular-nums">
                        <span>
                          {getPersianWeekdayName(item.event.dayIndex)}{' '}
                          {formatJalaliDayMonth(item.event.dateISO)} ساعت{' '}
                          {toPersianDigits(item.event.startTime)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{CALENDAR_ACTIVITY_KIND_LABELS[item.category]}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            item.enabled
                              ? 'text-[var(--color-success)] font-medium'
                              : 'text-[var(--text-muted)]'
                          }
                        >
                          {item.enabled
                            ? `یادآور ساعت ${toPersianDigits(item.reminderTimeHHMM)}`
                            : 'اعلان غیرفعال'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2.5 shrink-0">
                    <div className="w-40">
                      <Select
                        aria-label={`زمان یادآوری ${item.event.title}`}
                        value={String(item.leadTimeMinutes)}
                        disabled={!item.enabled}
                        onChange={(e) =>
                          onUpdateEventReminder(item.eventId, {
                            enabled: item.enabled,
                            leadTimeMinutes: Number(e.target.value),
                          })
                        }
                        className="h-8 text-xs"
                      >
                        {REMINDER_LEAD_TIME_PRESETS.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                        {!isPreset && (
                          <option value={item.leadTimeMinutes}>
                            {formatFaNumber(item.leadTimeMinutes)} دقیقه قبل
                          </option>
                        )}
                      </Select>
                    </div>

                    <Switch
                      checked={item.enabled}
                      ariaLabel={`فعال یا غیرفعال کردن یادآور ${item.event.title}`}
                      onCheckedChange={(checked) =>
                        onUpdateEventReminder(item.eventId, {
                          enabled: checked,
                          leadTimeMinutes: item.leadTimeMinutes,
                        })
                      }
                    />

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onOpenEventDetail(item.event)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>جزئیات</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
