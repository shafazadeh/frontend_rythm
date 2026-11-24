import {
  CalendarActivityKind,
  CalendarSourceModule,
  NotificationCategoryKey,
  NotificationChannel,
} from '../types/calendar';

export const CALENDAR_SOURCE_LABELS: Record<CalendarSourceModule, string> = {
  nutrition: 'تغذیه',
  workout: 'ورزش',
  supplement: 'مکمل‌ها',
  system: 'ریتم (سیستمی)',
};

export const CALENDAR_ACTIVITY_KIND_LABELS: Record<CalendarActivityKind, string> = {
  meal: 'وعده غذایی',
  snack: 'میان‌وعده',
  supplement: 'مکمل و ویتامین',
  workout: 'جلسه ورزشی',
  weekly_planning_reminder: 'یادآور برنامه‌ریزی هفتگی',
};

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategoryKey, string> = {
  meal: 'اعلان وعده‌های غذایی',
  snack: 'اعلان میان‌وعده‌ها',
  supplement: 'اعلان مکمل‌ها',
  workout: 'اعلان جلسات ورزش',
  weekly_planning_reminder: 'اعلان شروع برنامه‌ریزی هفتگی',
};

export const NOTIFICATION_CHANNEL_OPTIONS: Array<{
  value: NotificationChannel;
  label: string;
  helper: string;
  isActiveCapability: boolean;
}> = [
  {
    value: 'in_app',
    label: 'اعلان داخل اپلیکیشن',
    helper: 'نمایش یادآور و پیش‌نمایش در محیط ریتم',
    isActiveCapability: true,
  },
  {
    value: 'browser_preview',
    label: 'اعلان مرورگر (پیشنمایش)',
    helper: 'در نسخه اول اعلان Push واقعی مرورگر ارسال نمی‌شود',
    isActiveCapability: false,
  },
  {
    value: 'telegram_coming_soon',
    label: 'Telegram — به‌زودی',
    helper: 'اتصال ربات تلگرام در نسخه‌های آینده فعال خواهد شد',
    isActiveCapability: false,
  },
];

export const REMINDER_LEAD_TIME_PRESETS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'هنگام شروع فعالیت' },
  { value: 5, label: '۵ دقیقه قبل' },
  { value: 15, label: '۱۵ دقیقه قبل' },
  { value: 30, label: '۳۰ دقیقه قبل' },
  { value: 60, label: '۱ ساعت قبل' },
];

export const CALENDAR_EVENT_THEME: Record<
  CalendarSourceModule,
  {
    surfaceClass: string;
    borderClass: string;
    textClass: string;
    subtleTextClass: string;
    markerClass: string;
  }
> = {
  nutrition: {
    surfaceClass: 'bg-[var(--color-primary-subtle)]',
    borderClass: 'border-[var(--color-primary)]/40',
    textClass: 'text-[var(--color-primary)]',
    subtleTextClass: 'text-[var(--text-secondary)]',
    markerClass: 'bg-[var(--color-primary)]',
  },
  workout: {
    surfaceClass: 'bg-[var(--color-accent-subtle)]',
    borderClass: 'border-[var(--color-accent)]/40',
    textClass: 'text-[var(--color-accent)]',
    subtleTextClass: 'text-[var(--text-secondary)]',
    markerClass: 'bg-[var(--color-accent)]',
  },
  supplement: {
    surfaceClass: 'bg-purple-50 dark:bg-purple-950/35',
    borderClass: 'border-purple-300/80 dark:border-purple-700/60',
    textClass: 'text-purple-700 dark:text-purple-300',
    subtleTextClass: 'text-purple-800/80 dark:text-purple-200/80',
    markerClass: 'bg-purple-600 dark:bg-purple-400',
  },
  system: {
    surfaceClass: 'bg-[var(--bg-surface-muted)]',
    borderClass: 'border-[var(--border-strong)]',
    textClass: 'text-[var(--text-primary)]',
    subtleTextClass: 'text-[var(--text-secondary)]',
    markerClass: 'bg-[var(--text-muted)]',
  },
};
