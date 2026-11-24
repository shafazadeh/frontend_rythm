import {
  CalendarNotificationPreferences,
  CalendarSyncPreferences,
  CalendarSyncPreviewResult,
  RhythmCalendarEvent,
} from '../../shared/types/calendar';

/**
 * Repository contract for Integrated Calendar events and sync preferences.
 * Future Backend / Google Calendar Provider implements this interface without modifying UI components.
 */
export interface CalendarPreferencesRepository {
  getCalendarEvents(weekStartISO: string): Promise<RhythmCalendarEvent[]>;
  getCalendarSyncPreferences(): Promise<CalendarSyncPreferences>;
  updateCalendarSyncPreferences(prefs: CalendarSyncPreferences): Promise<CalendarSyncPreferences>;
  previewCalendarSync(weekStartISO: string): Promise<CalendarSyncPreviewResult>;
}

/**
 * Repository contract for Calendar Notification & Weekly Planning Reminder preferences.
 */
export interface NotificationPreferencesRepository {
  getNotificationPreferences(): Promise<CalendarNotificationPreferences>;
  updateNotificationPreferences(
    prefs: CalendarNotificationPreferences
  ): Promise<CalendarNotificationPreferences>;
}
