import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck2, Eye, Info, Link2Off, Save } from 'lucide-react';
import { buildCalendarSyncPreview } from '../../../services/domain/calendarAdapters';
import {
  formatJalaliFullDate,
  getPersianWeekdayName,
} from '../../../services/domain/jalaliCalendar';
import { Button } from '../../../shared/components/ui/Button';
import { Checkbox, Switch } from '../../../shared/components/ui/FormControls';
import { Dialog } from '../../../shared/components/ui/Overlays';
import { CALENDAR_ACTIVITY_KIND_LABELS } from '../../../shared/constants/calendar';
import {
  CalendarSyncPreferences,
  RhythmCalendarEvent,
} from '../../../shared/types/calendar';
import { WeeklyMealPlan } from '../../../shared/types/domain';
import { formatFaNumber, toPersianDigits } from '../../../shared/utils/cn';
import { CalendarModuleIcon } from './CalendarEventCard';

interface CalendarSyncDialogProps {
  open: boolean;
  initialTab?: 'SETTINGS' | 'PREVIEW';
  onClose: () => void;
  syncPrefs: CalendarSyncPreferences;
  events: RhythmCalendarEvent[];
  weeklyPlans: WeeklyMealPlan[];
  onSaveSyncPrefs: (prefs: CalendarSyncPreferences) => Promise<unknown>;
}

export function CalendarSyncDialog({
  open,
  initialTab = 'SETTINGS',
  onClose,
  syncPrefs,
  events,
  weeklyPlans,
  onSaveSyncPrefs,
}: CalendarSyncDialogProps) {
  const [activeTab, setActiveTab] = useState<'SETTINGS' | 'PREVIEW'>(initialTab);
  const [draft, setDraft] = useState<CalendarSyncPreferences>(() => structuredClone(syncPrefs));
  const [showFutureNotice, setShowFutureNotice] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab);
    setDraft(structuredClone(syncPrefs));
    setShowFutureNotice(false);
  }, [open, initialTab, syncPrefs]);

  const previewResult = useMemo(
    () => buildCalendarSyncPreview(events, draft, weeklyPlans),
    [events, draft, weeklyPlans]
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveSyncPrefs(draft);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="همگامسازی تقویم"
      description="آماده‌سازی تنظیمات اتصال آینده به Google Calendar و پیش‌نمایش رویدادهای قابل ارسال"
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-5 text-xs">
        {/* Mode Tabs */}
        <div className="flex items-center gap-1 rounded-lg bg-[var(--bg-surface-muted)] p-1 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('SETTINGS')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'SETTINGS'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            تنظیمات همگام‌سازی
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PREVIEW')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'PREVIEW'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            پیشنمایش رویدادهای قابل همگام‌سازی ({formatFaNumber(previewResult.eligibleEvents.length)})
          </button>
        </div>

        {activeTab === 'SETTINGS' ? (
          <div className="space-y-5">
            {/* Connection Status Card */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]/45 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Link2Off className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
                  <div>
                    <div className="font-bold text-[var(--text-primary)]">
                      Google Calendar متصل نیست
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      سرویس ارائه‌دهنده: Google Calendar — اتصال در نسخه آینده
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFutureNotice((v) => !v)}
                >
                  اتصال Google Calendar — به‌زودی
                </Button>
              </div>

              {showFutureNotice && (
                <div className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[var(--color-accent)]" />
                  <span>
                    در نسخه فعلی ریتم هیچ اتصال واقعی یا OAuth با Google Calendar برقرار نمی‌شود. می‌توانید تنظیمات همگام‌سازی را ذخیره کنید و با دکمه «پیشنمایش رویدادهای قابل همگام‌سازی» خروجی دقیق فیلترها را ببینید.
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)]">
                نوع همگام‌سازی: <strong>فقط ارسال برنامه‌های تأییدشده از ریتم به تقویم خارجی</strong> (یک‌طرفه)
              </div>
            </div>

            {/* Included Event Types Checkboxes */}
            <div className="space-y-2.5">
              <div className="font-semibold text-[var(--text-primary)]">
                انتخاب نوع رویداد برای همگام‌سازی
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(
                  [
                    { key: 'meal', label: 'وعده‌های غذایی' },
                    { key: 'snack', label: 'میان‌وعده‌ها' },
                    { key: 'supplement', label: 'مکمل‌ها' },
                    { key: 'workout', label: 'جلسات ورزش' },
                  ] as const
                ).map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center gap-2.5 rounded-lg border border-[var(--border-subtle)] px-3 py-2.5 cursor-pointer"
                  >
                    <Checkbox
                      checked={draft.includedTypes[item.key]}
                      onCheckedChange={(checked) =>
                        setDraft((prev) => ({
                          ...prev,
                          includedTypes: {
                            ...prev.includedTypes,
                            [item.key]: checked,
                          },
                        }))
                      }
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Additional Sync Rules */}
            <div className="space-y-2.5 rounded-xl border border-[var(--border-subtle)] p-4">
              <div className="font-semibold text-[var(--text-primary)] pb-1">تنظیمات بیشتر</div>

              <div className="flex items-center justify-between py-1.5">
                <span>ارسال فقط برنامه هفته تأییدشده</span>
                <Switch
                  checked={draft.onlyConfirmedWeeks}
                  onCheckedChange={(v) =>
                    setDraft((prev) => ({ ...prev, onlyConfirmedWeeks: v }))
                  }
                />
              </div>

              <div className="flex items-center justify-between py-1.5 border-t border-[var(--border-subtle)]">
                <span>همگام‌سازی تغییرات بعدی</span>
                <Switch
                  checked={draft.syncSubsequentChanges}
                  onCheckedChange={(v) =>
                    setDraft((prev) => ({ ...prev, syncSubsequentChanges: v }))
                  }
                />
              </div>

              <div className="flex items-center justify-between py-1.5 border-t border-[var(--border-subtle)]">
                <span>حذف یا لغو رویداد خارجی هنگام لغو برنامه</span>
                <Switch
                  checked={draft.cancelExternalOnCancel}
                  onCheckedChange={(v) =>
                    setDraft((prev) => ({ ...prev, cancelExternalOnCancel: v }))
                  }
                />
              </div>

              <div className="flex items-center justify-between py-1.5 border-t border-[var(--border-subtle)]">
                <span>جلوگیری از ایجاد رویداد تکراری</span>
                <Switch
                  checked={draft.preventDuplicates}
                  onCheckedChange={(v) =>
                    setDraft((prev) => ({ ...prev, preventDuplicates: v }))
                  }
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)]">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('PREVIEW')}
              >
                <Eye className="h-3.5 w-3.5" />
                <span>پیشنمایش رویدادهای قابل همگام‌سازی</span>
              </Button>

              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={onClose}>
                  بستن
                </Button>
                <Button type="button" onClick={handleSave} disabled={saving}>
                  <Save className="h-3.5 w-3.5" />
                  <span>ذخیره تنظیمات</span>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Sync Preview Summary Counts */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-[var(--color-primary-subtle)]/70 border border-[var(--border-subtle)] p-3.5">
                <div className="text-[11px] text-[var(--text-secondary)]">
                  رویدادهای قابل همگام‌سازی
                </div>
                <div className="mt-1 text-xl font-bold text-[var(--color-primary)] tabular-nums">
                  {formatFaNumber(previewResult.eligibleEvents.length)} رویداد
                </div>
              </div>
              <div className="rounded-lg bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] p-3.5">
                <div className="text-[11px] text-[var(--text-secondary)]">
                  رویدادهای حذف‌شده با فیلترها
                </div>
                <div className="mt-1 text-xl font-bold text-[var(--text-primary)] tabular-nums">
                  {formatFaNumber(previewResult.filteredOutEvents.length)} رویداد
                </div>
              </div>
            </div>

            {/* Eligible Events List */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                <CalendarCheck2 className="h-4 w-4 text-[var(--color-success)]" />
                <span>فهرست رویدادهای واجد شرایط انتقال (فقط پیش‌نمایش)</span>
              </div>

              {previewResult.eligibleEvents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--border-subtle)] p-4 text-center text-[var(--text-muted)]">
                  با فیلترهای فعلی، رویداد تأییدشده‌ای برای انتقال در این هفته وجود ندارد.
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)] max-h-56 overflow-y-auto">
                  {previewResult.eligibleEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <CalendarModuleIcon sourceModule={evt.sourceModule} />
                        <div className="min-w-0">
                          <div className="font-semibold text-[var(--text-primary)] truncate">
                            {evt.title}
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)] tabular-nums">
                            {CALENDAR_ACTIVITY_KIND_LABELS[evt.activityKind]} ·{' '}
                            {getPersianWeekdayName(evt.dayIndex)} {formatJalaliFullDate(evt.dateISO)} ساعت{' '}
                            {toPersianDigits(evt.startTime)}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-[var(--color-success)] shrink-0">
                        {evt.statusLabel}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Filtered-Out Events List */}
            {previewResult.filteredOutEvents.length > 0 && (
              <div className="space-y-2">
                <div className="font-semibold text-[var(--text-secondary)]">
                  موارد حذف‌شده توسط فیلترهای تأیید و همگام‌سازی
                </div>
                <div className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)] max-h-44 overflow-y-auto bg-[var(--bg-surface-muted)]/30">
                  {previewResult.filteredOutEvents.map(({ event: evt, reason }) => (
                    <div
                      key={evt.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 px-3 py-2"
                    >
                      <span className="font-medium text-[var(--text-secondary)] truncate">
                        {evt.title} ({getPersianWeekdayName(evt.dayIndex)}{' '}
                        {toPersianDigits(evt.startTime)})
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)]">{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)]">
              <Button variant="outline" size="sm" onClick={() => setActiveTab('SETTINGS')}>
                بازگشت به تنظیمات
              </Button>
              <Button size="sm" onClick={onClose}>
                بستن پیش‌نمایش
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
