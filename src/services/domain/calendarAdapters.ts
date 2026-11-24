import { DAILY_STATUS_LABELS, MEAL_SLOT_LABELS } from '../../shared/constants/units';
import { WORKOUT_STATUS_LABELS } from '../../shared/constants/workout';
import {
  CalendarNotificationPreferences,
  CalendarSyncPreferences,
  CalendarSyncPreviewResult,
  FilteredOutCalendarEvent,
  NotificationCategoryKey,
  RhythmCalendarEvent,
  UpcomingCalendarReminder,
} from '../../shared/types/calendar';
import {
  DailyPlanStatus,
  MealSlotType,
  RhythmAppData,
  WeeklyPlanStatus,
} from '../../shared/types/domain';
import { WorkoutSessionStatus } from '../../shared/types/workout';
import {
  addDaysToISO,
  buildZonedISOTimestamp,
  getSaturdayToFridayWeekRange,
} from './jalaliCalendar';
import { minutesToTime, timeToMinutes } from './scheduleConflictChecker';

const VALID_TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isValidTimeHHMM(value?: string): value is string {
  return Boolean(value && VALID_TIME_REGEX.test(value.trim()));
}

/**
 * Adapter 1: Converts WeeklyMealPlan daily meals into RhythmCalendarEvent[] without inventing fake durations.
 */
export function nutritionCalendarAdapter(
  data: Pick<RhythmAppData, 'weeklyPlans' | 'recipes' | 'foodItems' | 'profile'>,
  weekStartISO: string
): RhythmCalendarEvent[] {
  const timeZone = data.profile?.timezone || 'Asia/Tehran';
  const weekRange = getSaturdayToFridayWeekRange(weekStartISO);
  const weekDateSet = new Set(weekRange.dayDatesISO);

  const recipesById = Object.fromEntries(data.recipes.map((r) => [r.id, r]));
  const foodItemsById = Object.fromEntries(data.foodItems.map((f) => [f.id, f]));

  const events: RhythmCalendarEvent[] = [];

  for (const plan of data.weeklyPlans) {
    for (const day of plan.days) {
      if (!weekDateSet.has(day.dateISO)) continue;
      const isDayConfirmed = day.status === DailyPlanStatus.CONFIRMED;

      for (const meal of day.meals) {
        if (!isValidTimeHHMM(meal.suggestedTime)) continue; // Do not guess missing times

        const startTime = meal.suggestedTime.trim();
        const isSnack =
          meal.slot === MealSlotType.MORNING_SNACK || meal.slot === MealSlotType.AFTERNOON_SNACK;

        const itemNames = meal.items
          .map((item) => {
            if (item.kind === 'RECIPE' && item.recipeId) {
              return recipesById[item.recipeId]?.name;
            }
            if (item.kind === 'FOOD_ITEM' && item.foodItemId) {
              return foodItemsById[item.foodItemId]?.name;
            }
            return undefined;
          })
          .filter((name): name is string => Boolean(name));

        const mealLabel = meal.label || MEAL_SLOT_LABELS[meal.slot];
        const status = isDayConfirmed
          ? 'CONFIRMED'
          : day.status === DailyPlanStatus.IN_REVIEW
          ? 'IN_REVIEW'
          : 'DRAFT';

        const statusLabel = DAILY_STATUS_LABELS[day.status];
        const isConfirmed = isDayConfirmed && (meal.isConfirmed || isDayConfirmed);

        events.push({
          id: `cal_nut_${day.dateISO}_${meal.slot}_${meal.id}`,
          sourceId: meal.id,
          sourceModule: 'nutrition',
          activityKind: isSnack ? 'snack' : 'meal',
          title: mealLabel,
          subtitle: itemNames.length > 0 ? itemNames.join('، ') : undefined,
          dateISO: day.dateISO,
          dayIndex: day.dayIndex,
          startTime,
          // Meal slot has no explicit endTime in Nutrition domain -> keep endTime/endAt undefined
          endTime: undefined,
          startAt: buildZonedISOTimestamp(day.dateISO, startTime, timeZone),
          endAt: undefined,
          isAllDay: false,
          isPointInTime: true,
          status,
          statusLabel,
          isConfirmedForSync: isConfirmed,
          isDayConfirmed,
          description:
            itemNames.length > 0
              ? `محتوای وعده: ${itemNames.join('، ')}`
              : 'بدون مورد غذایی ثبت‌شده در این وعده',
          sourceRoute: `/nutrition/planner?day=${day.dayIndex}`,
          dedupeKey: `nutrition:${day.dateISO}:${meal.slot}`,
        });
      }
    }
  }

  return events;
}

/**
 * Adapter 2: Converts WorkoutSession[] into RhythmCalendarEvent[] preserving real start/end times and statuses.
 */
export function workoutCalendarAdapter(
  data: Pick<RhythmAppData, 'workoutSessions' | 'profile'>,
  weekStartISO: string
): RhythmCalendarEvent[] {
  const timeZone = data.profile?.timezone || 'Asia/Tehran';
  const weekRange = getSaturdayToFridayWeekRange(weekStartISO);
  const weekDateSet = new Set(weekRange.dayDatesISO);

  const events: RhythmCalendarEvent[] = [];

  for (const session of data.workoutSessions) {
    if (!weekDateSet.has(session.dateISO)) continue;
    if (!isValidTimeHHMM(session.startTime)) continue;

    const startTime = session.startTime.trim();
    const hasValidEnd =
      isValidTimeHHMM(session.endTime) &&
      timeToMinutes(session.endTime) > timeToMinutes(startTime);
    const endTime = hasValidEnd ? session.endTime.trim() : undefined;

    const statusMap: Record<WorkoutSessionStatus, RhythmCalendarEvent['status']> = {
      [WorkoutSessionStatus.PLANNED]: 'PLANNED',
      [WorkoutSessionStatus.IN_PROGRESS]: 'IN_PROGRESS',
      [WorkoutSessionStatus.COMPLETED]: 'COMPLETED',
      [WorkoutSessionStatus.MISSED]: 'MISSED',
      [WorkoutSessionStatus.CANCELLED]: 'CANCELLED',
    };

    const isConfirmedForSync =
      session.status === WorkoutSessionStatus.PLANNED ||
      session.status === WorkoutSessionStatus.IN_PROGRESS ||
      session.status === WorkoutSessionStatus.COMPLETED;

    events.push({
      id: `cal_wrk_${session.id}`,
      sourceId: session.id,
      sourceModule: 'workout',
      activityKind: 'workout',
      title: session.title,
      subtitle: `${session.estimatedDurationMinutes} دقیقه · ${WORKOUT_STATUS_LABELS[session.status]}`,
      dateISO: session.dateISO,
      dayIndex: session.dayIndex,
      startTime,
      endTime,
      startAt: buildZonedISOTimestamp(session.dateISO, startTime, timeZone),
      endAt: endTime ? buildZonedISOTimestamp(session.dateISO, endTime, timeZone) : undefined,
      isAllDay: false,
      isPointInTime: !endTime,
      status: statusMap[session.status],
      statusLabel: WORKOUT_STATUS_LABELS[session.status],
      isConfirmedForSync,
      isDayConfirmed: isConfirmedForSync,
      description: session.notes
        ? session.notes
        : `جلسه ورزشی برنامه‌ریزی‌شده (${session.exercises.length} حرکت)`,
      sourceRoute: '/workout/planner',
      dedupeKey: `workout:${session.id}`,
    });
  }

  return events;
}

/**
 * Adapter 3: Converts active Supplement schedules into point-in-time RhythmCalendarEvent[].
 * Never invents missing times or dosages.
 */
export function supplementCalendarAdapter(
  data: Pick<RhythmAppData, 'supplements' | 'weeklyPlans' | 'profile'>,
  weekStartISO: string
): RhythmCalendarEvent[] {
  const timeZone = data.profile?.timezone || 'Asia/Tehran';
  const weekRange = getSaturdayToFridayWeekRange(weekStartISO);

  const dayPlanByDate = new Map<string, RhythmAppData['weeklyPlans'][number]['days'][number]>();
  for (const plan of data.weeklyPlans) {
    for (const day of plan.days) {
      dayPlanByDate.set(day.dateISO, day);
    }
  }

  const events: RhythmCalendarEvent[] = [];

  for (let dayIndex = 0; dayIndex < weekRange.dayDatesISO.length; dayIndex += 1) {
    const dateISO = weekRange.dayDatesISO[dayIndex];
    const dayPlan = dayPlanByDate.get(dateISO);

    for (const sup of data.supplements) {
      if (!sup.isActive) continue;
      if (!sup.activeDays.includes(dayIndex)) continue;
      if (!isValidTimeHHMM(sup.timeOfDay)) continue; // Do not guess missing time

      const startTime = sup.timeOfDay.trim();
      const schedule = dayPlan?.supplementSchedules.find((sc) => sc.supplementId === sup.id);
      const isTaken = Boolean(schedule?.isTaken);

      const dosageText =
        sup.dosageAmount !== undefined && sup.dosageUnit
          ? `${sup.dosageAmount} ${sup.dosageUnit}`
          : sup.form;

      events.push({
        id: `cal_sup_${sup.id}_${dateISO}`,
        sourceId: sup.id,
        sourceModule: 'supplement',
        activityKind: 'supplement',
        title: isTaken ? `مصرف مکمل ثبت‌شده: ${sup.name}` : sup.name,
        subtitle: dosageText,
        dateISO,
        dayIndex,
        startTime,
        endTime: undefined,
        startAt: buildZonedISOTimestamp(dateISO, startTime, timeZone),
        endAt: undefined,
        isAllDay: false,
        isPointInTime: true,
        status: isTaken ? 'TAKEN' : 'PLANNED',
        statusLabel: isTaken ? 'مصرف‌شده' : 'زمان‌بندی‌شده',
        isConfirmedForSync: true,
        isDayConfirmed: true,
        description: sup.doctorOrPharmacistNote || sup.userNote || `فرم مصرف: ${sup.form}`,
        sourceRoute: '/settings/supplements',
        dedupeKey: `supplement:${sup.id}:${dateISO}`,
      });
    }
  }

  return events;
}

/**
 * Adapter 4: Emits the configured Weekly Planning Reminder system event cleanly separated from meals/workouts.
 */
export function weeklyPlanningCalendarAdapter(
  data: Pick<RhythmAppData, 'notificationPreferences' | 'agentPreferences' | 'profile'>,
  weekStartISO: string
): RhythmCalendarEvent[] {
  const timeZone = data.profile?.timezone || 'Asia/Tehran';
  const weekRange = getSaturdayToFridayWeekRange(weekStartISO);

  const reminderSetting = data.notificationPreferences?.weeklyPlanningReminder ?? {
    enabled: data.agentPreferences.reminderConfig.enabled,
    dayOfWeek: data.agentPreferences.reminderConfig.dayOfWeek,
    time24h: data.agentPreferences.reminderConfig.time24h,
    title: 'زمان برنامه‌ریزی هفته آینده ریتم',
  };

  if (!reminderSetting.enabled) return [];
  if (!isValidTimeHHMM(reminderSetting.time24h)) return [];

  const dayIndex = Math.min(6, Math.max(0, reminderSetting.dayOfWeek));
  const dateISO = weekRange.dayDatesISO[dayIndex];
  const startTime = reminderSetting.time24h.trim();

  return [
    {
      id: `cal_sys_weekly_plan_${dateISO}`,
      sourceId: 'weekly_planning_reminder',
      sourceModule: 'system',
      activityKind: 'weekly_planning_reminder',
      title: reminderSetting.title || 'زمان برنامه‌ریزی هفته آینده ریتم',
      subtitle: 'یادآور سیستمی ریتم',
      dateISO,
      dayIndex,
      startTime,
      endTime: undefined,
      startAt: buildZonedISOTimestamp(dateISO, startTime, timeZone),
      endAt: undefined,
      isAllDay: false,
      isPointInTime: true,
      status: 'SYSTEM',
      statusLabel: 'رویداد سیستمی',
      isConfirmedForSync: false,
      isDayConfirmed: false,
      description:
        'یادآور هفتگی برای مرور و تنظیم برنامه غذایی و ورزشی هفته آینده ریتم (اجرای واقعی یادآور در نسخه بعدی توسط Backend انجام می‌شود).',
      sourceRoute: '/nutrition/planner',
      dedupeKey: `system:weekly-planning:${dateISO}`,
    },
  ];
}

/**
 * Combines all module adapters into a deduplicated, chronologically sorted week view model.
 */
export function buildIntegratedWeekCalendarEvents(
  data: RhythmAppData,
  weekStartISO: string
): RhythmCalendarEvent[] {
  const combined = [
    ...nutritionCalendarAdapter(data, weekStartISO),
    ...workoutCalendarAdapter(data, weekStartISO),
    ...supplementCalendarAdapter(data, weekStartISO),
    ...weeklyPlanningCalendarAdapter(data, weekStartISO),
  ];

  // Deduplicate by deterministic event id and dedupeKey
  const seenIds = new Set<string>();
  const unique: RhythmCalendarEvent[] = [];

  for (const evt of combined) {
    if (seenIds.has(evt.id)) continue;
    seenIds.add(evt.id);
    unique.push(evt);
  }

  return unique.sort(
    (a, b) =>
      a.dateISO.localeCompare(b.dateISO) ||
      a.startTime.localeCompare(b.startTime) ||
      a.title.localeCompare(b.title, 'fa')
  );
}

/**
 * Computes exact reminder date & HH:mm trigger time given event start date/time and lead time in minutes.
 */
export function computeReminderTriggerTime(
  dateISO: string,
  startTimeHHMM: string,
  leadTimeMinutes: number
): { reminderDateISO: string; reminderTimeHHMM: string } {
  const startMinutes = timeToMinutes(startTimeHHMM);
  const delta = Math.max(0, Math.round(leadTimeMinutes));
  const rawMinutes = startMinutes - delta;

  if (rawMinutes >= 0) {
    return {
      reminderDateISO: dateISO,
      reminderTimeHHMM: minutesToTime(rawMinutes),
    };
  }

  const dayShift = Math.floor(rawMinutes / (24 * 60));
  const wrappedMinutes = ((rawMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  return {
    reminderDateISO: addDaysToISO(dateISO, dayShift),
    reminderTimeHHMM: minutesToTime(wrappedMinutes),
  };
}

/**
 * Generates upcoming reminders directly from real calendar events and saved NotificationPreferences.
 */
export function buildUpcomingReminders(
  events: RhythmCalendarEvent[],
  prefs: CalendarNotificationPreferences
): UpcomingCalendarReminder[] {
  return events
    .filter((evt) => evt.status !== 'CANCELLED' && evt.status !== 'MISSED')
    .map((evt) => {
      const category: NotificationCategoryKey = evt.activityKind;
      const catSetting = prefs.categories[category];
      const override = prefs.eventOverrides[evt.id];

      const enabled = override?.enabled !== undefined ? override.enabled : catSetting.enabled;
      const leadTimeMinutes =
        override?.leadTimeMinutes !== undefined
          ? override.leadTimeMinutes
          : catSetting.leadTimeMinutes;

      const trigger = computeReminderTriggerTime(evt.dateISO, evt.startTime, leadTimeMinutes);

      return {
        eventId: evt.id,
        event: evt,
        category,
        enabled,
        leadTimeMinutes,
        channel: catSetting.channel,
        reminderDateISO: trigger.reminderDateISO,
        reminderTimeHHMM: trigger.reminderTimeHHMM,
      };
    })
    .sort(
      (a, b) =>
        a.reminderDateISO.localeCompare(b.reminderDateISO) ||
        a.reminderTimeHHMM.localeCompare(b.reminderTimeHHMM)
    );
}

/**
 * Computes a dry-run preview of which events would export to Google Calendar under current Sync Preferences.
 */
export function buildCalendarSyncPreview(
  events: RhythmCalendarEvent[],
  syncPrefs: CalendarSyncPreferences,
  weeklyPlans: RhythmAppData['weeklyPlans']
): CalendarSyncPreviewResult {
  const eligibleEvents: RhythmCalendarEvent[] = [];
  const filteredOutEvents: FilteredOutCalendarEvent[] = [];
  const seenDedupeKeys = new Set<string>();
  let duplicateSkippedCount = 0;

  const planByDate = new Map<string, RhythmAppData['weeklyPlans'][number]>();
  for (const plan of weeklyPlans) {
    for (const day of plan.days) {
      planByDate.set(day.dateISO, plan);
    }
  }

  for (const evt of events) {
    if (evt.sourceModule === 'system') {
      filteredOutEvents.push({
        event: evt,
        reason: 'رویداد یادآور داخلی ریتم (خارج از همگام‌سازی خارجی)',
      });
      continue;
    }

    if (
      (evt.activityKind === 'meal' && !syncPrefs.includedTypes.meal) ||
      (evt.activityKind === 'snack' && !syncPrefs.includedTypes.snack) ||
      (evt.activityKind === 'supplement' && !syncPrefs.includedTypes.supplement) ||
      (evt.activityKind === 'workout' && !syncPrefs.includedTypes.workout)
    ) {
      filteredOutEvents.push({
        event: evt,
        reason: 'این نوع فعالیت در تنظیمات همگام‌سازی غیرفعال است',
      });
      continue;
    }

    if (evt.status === 'CANCELLED') {
      filteredOutEvents.push({
        event: evt,
        reason: syncPrefs.cancelExternalOnCancel
          ? 'جلسه لغوشده (در همگام‌سازی واقعی رویداد خارجی لغو/حذف می‌شود)'
          : 'جلسه لغوشده است',
      });
      continue;
    }

    if (evt.status === 'MISSED') {
      filteredOutEvents.push({
        event: evt,
        reason: 'جلسه انجام‌نشده است',
      });
      continue;
    }

    if (evt.sourceModule === 'nutrition') {
      const parentPlan = planByDate.get(evt.dateISO);
      if (syncPrefs.onlyConfirmedWeeks && parentPlan?.status !== WeeklyPlanStatus.CONFIRMED) {
        filteredOutEvents.push({
          event: evt,
          reason: 'برنامه هفتگی غذا هنوز به تأیید نهایی هفته نرسیده است',
        });
        continue;
      }
      if (!evt.isConfirmedForSync) {
        filteredOutEvents.push({
          event: evt,
          reason: 'برنامه غذایی این روز هنوز در وضعیت پیش‌نویس یا بررسی است',
        });
        continue;
      }
    }

    if (syncPrefs.preventDuplicates) {
      if (seenDedupeKeys.has(evt.dedupeKey)) {
        duplicateSkippedCount += 1;
        filteredOutEvents.push({
          event: evt,
          reason: 'جلوگیری از ایجاد رویداد تکراری با کلید یکتای مشابه',
        });
        continue;
      }
      seenDedupeKeys.add(evt.dedupeKey);
    }

    eligibleEvents.push(evt);
  }

  return {
    providerName: 'Google Calendar (اتصال در نسخه آینده)',
    isConnected: false,
    syncDirectionLabel: 'ارسال یک‌طرفه از ریتم به تقویم خارجی',
    eligibleEvents,
    filteredOutEvents,
    duplicateSkippedCount,
  };
}
