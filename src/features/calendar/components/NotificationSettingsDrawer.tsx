import { useEffect, useState } from 'react';
import { Bell, Clock, Info, Save } from 'lucide-react';
import { Button } from '../../../shared/components/ui/Button';
import { Input, Label, Select, Switch } from '../../../shared/components/ui/FormControls';
import { Sheet } from '../../../shared/components/ui/Overlays';
import {
  NOTIFICATION_CATEGORY_LABELS,
  NOTIFICATION_CHANNEL_OPTIONS,
  REMINDER_LEAD_TIME_PRESETS,
} from '../../../shared/constants/calendar';
import { PERSIAN_WEEKDAY_NAMES } from '../../../shared/constants/units';
import {
  CalendarDisplayPreferences,
  CalendarNotificationPreferences,
  NotificationCategoryKey,
  NotificationChannel,
} from '../../../shared/types/calendar';
import { formatFaNumber, toPersianDigits } from '../../../shared/utils/cn';

interface NotificationSettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  notificationPrefs: CalendarNotificationPreferences;
  displayRange: CalendarDisplayPreferences;
  onSaveNotificationPrefs: (prefs: CalendarNotificationPreferences) => Promise<unknown>;
  onSaveDisplayRange: (range: CalendarDisplayPreferences) => Promise<unknown>;
}

const CATEGORY_ORDER: NotificationCategoryKey[] = [
  'meal',
  'snack',
  'supplement',
  'workout',
  'weekly_planning_reminder',
];

export function NotificationSettingsDrawer({
  open,
  onClose,
  notificationPrefs,
  displayRange,
  onSaveNotificationPrefs,
  onSaveDisplayRange,
}: NotificationSettingsDrawerProps) {
  const [draftNotif, setDraftNotif] = useState<CalendarNotificationPreferences>(() =>
    structuredClone(notificationPrefs)
  );
  const [draftRange, setDraftRange] = useState<CalendarDisplayPreferences>(() =>
    structuredClone(displayRange)
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraftNotif(structuredClone(notificationPrefs));
    setDraftRange(structuredClone(displayRange));
  }, [open, notificationPrefs, displayRange]);

  const updateCategory = (
    key: NotificationCategoryKey,
    patch: Partial<CalendarNotificationPreferences['categories'][NotificationCategoryKey]>
  ) => {
    setDraftNotif((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [key]: {
          ...prev.categories[key],
          ...patch,
        },
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const normalizedStart = Math.min(22, Math.max(0, draftRange.startHour));
      const normalizedEnd = Math.min(23, Math.max(normalizedStart + 1, draftRange.endHour));

      await onSaveNotificationPrefs(draftNotif);
      if (
        normalizedStart !== displayRange.startHour ||
        normalizedEnd !== displayRange.endHour
      ) {
        await onSaveDisplayRange({
          startHour: normalizedStart,
          endHour: normalizedEnd,
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="مرکز تنظیمات اعلان و نمایش تقویم"
      subtitle="پیکربندی یادآوری وعده‌ها، مکمل‌ها، جلسات ورزش و ساعات نمایش تقویم هفتگی"
    >
      <div className="space-y-6 text-xs">
        {/* Category Notification Rules */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-[var(--color-primary)]" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              دسته‌بندی اعلان‌های برنامه هفته
            </h3>
          </div>

          <div className="space-y-3">
            {CATEGORY_ORDER.map((catKey) => {
              const cat = draftNotif.categories[catKey];
              const isPreset = REMINDER_LEAD_TIME_PRESETS.some(
                (p) => p.value === cat.leadTimeMinutes
              );

              return (
                <div
                  key={catKey}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3.5 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[var(--text-primary)]">
                      {NOTIFICATION_CATEGORY_LABELS[catKey]}
                    </span>
                    <Switch
                      checked={cat.enabled}
                      ariaLabel={NOTIFICATION_CATEGORY_LABELS[catKey]}
                      onCheckedChange={(checked) =>
                        updateCategory(catKey, { enabled: checked })
                      }
                    />
                  </div>

                  {cat.enabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1.5">
                        <Label htmlFor={`notif-lead-${catKey}`}>زمان یادآوری</Label>
                        <Select
                          id={`notif-lead-${catKey}`}
                          value={isPreset ? String(cat.leadTimeMinutes) : 'custom'}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'custom') {
                              updateCategory(catKey, {
                                leadTimeMinutes: isPreset ? 20 : cat.leadTimeMinutes,
                              });
                            } else {
                              updateCategory(catKey, { leadTimeMinutes: Number(val) });
                            }
                          }}
                        >
                          {REMINDER_LEAD_TIME_PRESETS.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                          <option value="custom">زمان سفارشی (دقیقه قبل)</option>
                        </Select>

                        {!isPreset && (
                          <div className="flex items-center gap-2 pt-1">
                            <Input
                              type="number"
                              min={0}
                              max={240}
                              value={cat.leadTimeMinutes}
                              onChange={(e) =>
                                updateCategory(catKey, {
                                  leadTimeMinutes: Math.max(
                                    0,
                                    Math.min(240, Number(e.target.value) || 0)
                                  ),
                                })
                              }
                              className="h-8 text-xs tabular-nums"
                              aria-label="دقیقه سفارشی یادآوری"
                            />
                            <span className="text-[11px] text-[var(--text-muted)] shrink-0">
                              دقیقه قبل
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor={`notif-chan-${catKey}`}>روش اعلان (پیشنمایش)</Label>
                        <Select
                          id={`notif-chan-${catKey}`}
                          value={cat.channel}
                          onChange={(e) =>
                            updateCategory(catKey, {
                              channel: e.target.value as NotificationChannel,
                            })
                          }
                        >
                          {NOTIFICATION_CHANNEL_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </Select>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          {
                            NOTIFICATION_CHANNEL_OPTIONS.find((o) => o.value === cat.channel)
                              ?.helper
                          }
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekly Planning Reminder Configuration (Section 12) */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]/40 p-4 space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-[var(--text-primary)]">
                یادآوری برنامه‌ریزی هفته آینده
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                به‌صورت یک رویداد سیستمی مجزا در تقویم هفتگی نمایش داده می‌شود
              </div>
            </div>
            <Switch
              checked={draftNotif.weeklyPlanningReminder.enabled}
              ariaLabel="فعال‌سازی یادآوری برنامه‌ریزی هفتگی"
              onCheckedChange={(checked) =>
                setDraftNotif((prev) => ({
                  ...prev,
                  weeklyPlanningReminder: {
                    ...prev.weeklyPlanningReminder,
                    enabled: checked,
                  },
                }))
              }
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="wpr-day">روز هفته</Label>
              <Select
                id="wpr-day"
                value={draftNotif.weeklyPlanningReminder.dayOfWeek}
                onChange={(e) =>
                  setDraftNotif((prev) => ({
                    ...prev,
                    weeklyPlanningReminder: {
                      ...prev.weeklyPlanningReminder,
                      dayOfWeek: Number(e.target.value),
                    },
                  }))
                }
              >
                {PERSIAN_WEEKDAY_NAMES.map((dayName, idx) => (
                  <option key={dayName} value={idx}>
                    {dayName}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="wpr-time">ساعت یادآور (۲۴ ساعته)</Label>
              <Input
                id="wpr-time"
                type="time"
                value={draftNotif.weeklyPlanningReminder.time24h}
                onChange={(e) =>
                  setDraftNotif((prev) => ({
                    ...prev,
                    weeklyPlanningReminder: {
                      ...prev.weeklyPlanningReminder,
                      time24h: e.target.value,
                    },
                  }))
                }
                className="tabular-nums"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="wpr-title">عنوان یادآور سیستمی</Label>
            <Input
              id="wpr-title"
              value={draftNotif.weeklyPlanningReminder.title}
              onChange={(e) =>
                setDraftNotif((prev) => ({
                  ...prev,
                  weeklyPlanningReminder: {
                    ...prev.weeklyPlanningReminder,
                    title: e.target.value,
                  },
                }))
              }
            />
          </div>
        </div>

        {/* Display Hours Range */}
        <div className="rounded-xl border border-[var(--border-subtle)] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[var(--color-accent)]" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              بازه ساعات نمایش تقویم هفتگی
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cal-start-hour">از ساعت</Label>
              <Select
                id="cal-start-hour"
                value={draftRange.startHour}
                onChange={(e) =>
                  setDraftRange((prev) => ({
                    ...prev,
                    startHour: Number(e.target.value),
                  }))
                }
              >
                {Array.from({ length: 16 }, (_, h) => h).map((h) => (
                  <option key={h} value={h}>
                    {toPersianDigits(`${String(h).padStart(2, '0')}:00`)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="cal-end-hour">تا ساعت</Label>
              <Select
                id="cal-end-hour"
                value={draftRange.endHour}
                onChange={(e) =>
                  setDraftRange((prev) => ({
                    ...prev,
                    endHour: Number(e.target.value),
                  }))
                }
              >
                {Array.from({ length: 12 }, (_, idx) => idx + 12).map((h) => (
                  <option key={h} value={h}>
                    {toPersianDigits(`${String(h).padStart(2, '0')}:00`)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
            بازه پیش‌فرض: ۰۶:۰۰ تا ۲۳:۰۰ (تعداد {formatFaNumber(Math.max(1, draftRange.endHour - draftRange.startHour + 1))} ساعت)
          </p>
        </div>

        {/* Honest Preview Notice */}
        <div className="flex items-start gap-2 rounded-lg bg-[var(--bg-surface-muted)]/60 p-3 text-[11px] text-[var(--text-muted)] leading-relaxed">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            در این نسخه تنظیمات اعلان‌ها و پیش‌نمایش یادآوری‌ها به‌صورت محلی ذخیره می‌شوند. ارسال واقعی اعلان مرورگر، Push و Telegram پس از اتصال سرویس اعلان در نسخه بعدی فعال می‌شود.
          </span>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
          <Button variant="ghost" onClick={onClose}>
            انصراف
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-3.5 w-3.5" />
            <span>ذخیره تنظیمات</span>
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
