import { ArrowLeft, Bell, Calendar, Clock, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { computeReminderTriggerTime } from '../../../services/domain/calendarAdapters';
import {
  formatJalaliFullDate,
  getPersianWeekdayName,
} from '../../../services/domain/jalaliCalendar';
import { Button } from '../../../shared/components/ui/Button';
import { Label, Select, Switch } from '../../../shared/components/ui/FormControls';
import { Sheet } from '../../../shared/components/ui/Overlays';
import {
  CALENDAR_ACTIVITY_KIND_LABELS,
  CALENDAR_SOURCE_LABELS,
  REMINDER_LEAD_TIME_PRESETS,
} from '../../../shared/constants/calendar';
import {
  CalendarNotificationPreferences,
  RhythmCalendarEvent,
} from '../../../shared/types/calendar';
import { formatFaNumber, toPersianDigits } from '../../../shared/utils/cn';
import { CalendarModuleIcon } from './CalendarEventCard';

interface EventDetailDrawerProps {
  event: RhythmCalendarEvent | null;
  onClose: () => void;
  notificationPrefs: CalendarNotificationPreferences;
  onUpdateEventReminder: (
    eventId: string,
    override: { enabled: boolean; leadTimeMinutes: number }
  ) => Promise<unknown>;
}

const SOURCE_ACTION_LABEL: Record<RhythmCalendarEvent['sourceModule'], string> = {
  workout: 'مشاهده جلسه تمرینی',
  nutrition: 'مشاهده برنامه غذایی روز',
  supplement: 'مشاهده تنظیمات مکمل',
  system: 'مشاهده برنامه‌ریز هفتگی',
};

export function EventDetailDrawer({
  event,
  onClose,
  notificationPrefs,
  onUpdateEventReminder,
}: EventDetailDrawerProps) {
  const navigate = useNavigate();

  if (!event) return null;

  const categorySetting = notificationPrefs.categories[event.activityKind];
  const eventOverride = notificationPrefs.eventOverrides[event.id];
  const isReminderEnabled =
    eventOverride?.enabled !== undefined ? eventOverride.enabled : categorySetting.enabled;
  const leadTimeMinutes =
    eventOverride?.leadTimeMinutes !== undefined
      ? eventOverride.leadTimeMinutes
      : categorySetting.leadTimeMinutes;

  const trigger = computeReminderTriggerTime(event.dateISO, event.startTime, leadTimeMinutes);

  const handleNavigateToSource = () => {
    onClose();
    navigate(event.sourceRoute);
  };

  return (
    <Sheet
      open={Boolean(event)}
      onClose={onClose}
      title={event.title}
      subtitle={`${CALENDAR_SOURCE_LABELS[event.sourceModule]} · ${CALENDAR_ACTIVITY_KIND_LABELS[event.activityKind]}`}
    >
      <div className="space-y-5 text-xs">
        {/* Core Metadata Grid */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]/45 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--text-muted)]">ماژول منبع</span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
              <CalendarModuleIcon sourceModule={event.sourceModule} />
              <span>{CALENDAR_SOURCE_LABELS[event.sourceModule]}</span>
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--text-muted)]">نوع فعالیت</span>
            <span className="font-medium text-[var(--text-primary)]">
              {CALENDAR_ACTIVITY_KIND_LABELS[event.activityKind]}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--text-muted)]">تاریخ شمسی</span>
            <span className="inline-flex items-center gap-1.5 font-medium text-[var(--text-primary)] tabular-nums">
              <Calendar className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              <span>
                {getPersianWeekdayName(event.dayIndex)} {formatJalaliFullDate(event.dateISO)}
              </span>
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--text-muted)]">زمان</span>
            <span className="inline-flex items-center gap-1.5 font-medium text-[var(--text-primary)] tabular-nums">
              <Clock className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              <span>
                {toPersianDigits(event.startTime)}
                {event.endTime
                  ? ` تا ${toPersianDigits(event.endTime)}`
                  : ' (رویداد لحظه‌ای — بدون زمان پایان)'}
              </span>
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--text-muted)]">وضعیت</span>
            <span className="font-semibold text-[var(--color-primary)]">
              {event.statusLabel}
            </span>
          </div>
        </div>

        {/* Description / Subtitle */}
        {(event.subtitle || event.description) && (
          <div className="rounded-xl border border-[var(--border-subtle)] p-4 space-y-1.5">
            <div className="font-semibold text-[var(--text-primary)]">توضیحات</div>
            {event.subtitle && (
              <p className="text-[var(--text-primary)]">{event.subtitle}</p>
            )}
            {event.description && (
              <p className="text-[var(--text-secondary)] leading-relaxed">{event.description}</p>
            )}
          </div>
        )}

        {/* Per-Event Notification Management */}
        <div className="rounded-xl border border-[var(--border-subtle)] p-4 space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-[var(--color-primary)]" />
              <span className="font-semibold text-[var(--text-primary)]">
                مدیریت اعلان این رویداد
              </span>
            </div>
            <Switch
              checked={isReminderEnabled}
              ariaLabel="فعال‌سازی یادآور این رویداد"
              onCheckedChange={(checked) =>
                onUpdateEventReminder(event.id, {
                  enabled: checked,
                  leadTimeMinutes,
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="detail-lead-time">زمان یادآوری</Label>
            <Select
              id="detail-lead-time"
              value={String(leadTimeMinutes)}
              disabled={!isReminderEnabled}
              onChange={(e) =>
                onUpdateEventReminder(event.id, {
                  enabled: isReminderEnabled,
                  leadTimeMinutes: Number(e.target.value),
                })
              }
            >
              {REMINDER_LEAD_TIME_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
              {!REMINDER_LEAD_TIME_PRESETS.some((p) => p.value === leadTimeMinutes) && (
                <option value={leadTimeMinutes}>
                  سفارشی ({formatFaNumber(leadTimeMinutes)} دقیقه قبل)
                </option>
              )}
            </Select>
            <div className="text-[11px] text-[var(--text-muted)] tabular-nums">
              {isReminderEnabled
                ? `زمان پیش‌بینی یادآور: ${formatJalaliFullDate(
                    trigger.reminderDateISO
                  )} ساعت ${toPersianDigits(trigger.reminderTimeHHMM)}`
                : 'یادآور برای این رویداد غیرفعال است.'}
            </div>
          </div>
        </div>

        {/* Read-Only Principle Notice */}
        <div className="flex items-start gap-2 rounded-lg bg-[var(--bg-surface-muted)]/60 p-3 text-[11px] text-[var(--text-muted)] leading-relaxed">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            برای حفظ یکپارچگی داده‌ها، تغییر ساعت یا جزئیات برنامه مستقیماً در ماژول اصلی انجام می‌شود و بلافاصله در تقویم منعکس خواهد شد.
          </span>
        </div>

        {/* Source Module Navigation Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[var(--border-subtle)]">
          <Button variant="ghost" size="sm" onClick={onClose}>
            بستن
          </Button>
          <Button size="sm" onClick={handleNavigateToSource}>
            <span>{SOURCE_ACTION_LABEL[event.sourceModule]}</span>
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
