import {
  CalendarNotificationPreferences,
  CalendarSyncPreferences,
} from '../../shared/types/calendar';

export function buildDefaultNotificationPreferences(
  nowISO = new Date().toISOString()
): CalendarNotificationPreferences {
  return {
    categories: {
      meal: {
        category: 'meal',
        label: 'اعلان وعده‌های غذایی',
        enabled: true,
        leadTimeMinutes: 15,
        channel: 'in_app',
      },
      snack: {
        category: 'snack',
        label: 'اعلان میان‌وعده‌ها',
        enabled: false,
        leadTimeMinutes: 10,
        channel: 'in_app',
      },
      supplement: {
        category: 'supplement',
        label: 'اعلان مکمل‌ها',
        enabled: true,
        leadTimeMinutes: 5,
        channel: 'in_app',
      },
      workout: {
        category: 'workout',
        label: 'اعلان جلسات ورزش',
        enabled: true,
        leadTimeMinutes: 30,
        channel: 'in_app',
      },
      weekly_planning_reminder: {
        category: 'weekly_planning_reminder',
        label: 'اعلان شروع برنامه‌ریزی هفتگی',
        enabled: true,
        leadTimeMinutes: 0,
        channel: 'in_app',
      },
    },
    eventOverrides: {},
    weeklyPlanningReminder: {
      enabled: true,
      dayOfWeek: 5, // پنج‌شنبه (Sat=0..Fri=6)
      time24h: '10:00',
      title: 'زمان برنامه‌ریزی هفته آینده ریتم',
    },
    updatedAt: nowISO,
  };
}

export function buildDefaultCalendarSyncPreferences(
  nowISO = new Date().toISOString()
): CalendarSyncPreferences {
  return {
    provider: 'google_calendar_future',
    syncDirection: 'one_way_export',
    includedTypes: {
      meal: true,
      snack: false,
      supplement: true,
      workout: true,
    },
    onlyConfirmedWeeks: true,
    syncSubsequentChanges: true,
    cancelExternalOnCancel: true,
    preventDuplicates: true,
    displayRange: {
      startHour: 6,
      endHour: 23,
    },
    updatedAt: nowISO,
  };
}
