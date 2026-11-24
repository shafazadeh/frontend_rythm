import { EntityId, ISODateString } from './domain';

export type CalendarSourceModule = 'nutrition' | 'workout' | 'supplement' | 'system';

export type CalendarActivityKind =
  | 'meal'
  | 'snack'
  | 'supplement'
  | 'workout'
  | 'weekly_planning_reminder';

export type CalendarEventStatus =
  | 'CONFIRMED'
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'MISSED'
  | 'CANCELLED'
  | 'TAKEN'
  | 'SYSTEM';

export interface RhythmCalendarEvent {
  id: string;
  sourceId: EntityId;
  sourceModule: CalendarSourceModule;
  activityKind: CalendarActivityKind;
  title: string;
  subtitle?: string;
  dateISO: string; // YYYY-MM-DD
  dayIndex: number; // 0 = Saturday .. 6 = Friday
  startTime: string; // 24h HH:mm
  endTime?: string; // 24h HH:mm; omitted for point-in-time events
  startAt: ISODateString; // Full ISO timestamp with timezone offset
  endAt?: ISODateString; // Undefined when duration/end is not defined
  isAllDay: boolean;
  isPointInTime: boolean;
  status: CalendarEventStatus;
  statusLabel: string;
  isConfirmedForSync: boolean;
  isDayConfirmed?: boolean;
  description?: string;
  sourceRoute: string;
  dedupeKey: string;
}

export type NotificationCategoryKey =
  | 'meal'
  | 'snack'
  | 'supplement'
  | 'workout'
  | 'weekly_planning_reminder';

export type NotificationChannel =
  | 'in_app'
  | 'browser_preview'
  | 'telegram_coming_soon';

export interface CategoryNotificationSetting {
  category: NotificationCategoryKey;
  label: string;
  enabled: boolean;
  leadTimeMinutes: number; // 0, 5, 15, 30, 60, or custom >= 0
  channel: NotificationChannel;
}

export interface EventReminderOverride {
  enabled?: boolean;
  leadTimeMinutes?: number;
}

export interface WeeklyPlanningReminderSetting {
  enabled: boolean;
  dayOfWeek: number; // 0 = Saturday .. 6 = Friday (default 5 = Thursday)
  time24h: string; // default "10:00"
  title: string; // default "زمان برنامه‌ریزی هفته آینده ریتم"
}

export interface CalendarNotificationPreferences {
  categories: Record<NotificationCategoryKey, CategoryNotificationSetting>;
  eventOverrides: Record<string, EventReminderOverride>;
  weeklyPlanningReminder: WeeklyPlanningReminderSetting;
  updatedAt: ISODateString;
}

export interface CalendarDisplayPreferences {
  startHour: number; // default 6 (06:00)
  endHour: number; // default 23 (23:00)
}

export interface CalendarSyncPreferences {
  provider: 'google_calendar_future';
  syncDirection: 'one_way_export';
  includedTypes: {
    meal: boolean;
    snack: boolean;
    supplement: boolean;
    workout: boolean;
  };
  onlyConfirmedWeeks: boolean;
  syncSubsequentChanges: boolean;
  cancelExternalOnCancel: boolean;
  preventDuplicates: boolean;
  displayRange: CalendarDisplayPreferences;
  updatedAt: ISODateString;
}

export interface UpcomingCalendarReminder {
  eventId: string;
  event: RhythmCalendarEvent;
  category: NotificationCategoryKey;
  enabled: boolean;
  leadTimeMinutes: number;
  channel: NotificationChannel;
  reminderTimeHHMM: string;
  reminderDateISO: string;
}

export interface FilteredOutCalendarEvent {
  event: RhythmCalendarEvent;
  reason: string;
}

export interface CalendarSyncPreviewResult {
  providerName: string;
  isConnected: false;
  syncDirectionLabel: string;
  eligibleEvents: RhythmCalendarEvent[];
  filteredOutEvents: FilteredOutCalendarEvent[];
  duplicateSkippedCount: number;
}
