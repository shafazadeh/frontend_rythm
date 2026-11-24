import { beforeEach, describe, expect, it } from 'vitest';
import { WeeklyPlanStatus } from '../../../shared/types/domain';
import { WorkoutSessionStatus } from '../../../shared/types/workout';
import { buildInitialMockData } from '../../mock/mockInitialState';
import { MockRhythmRepository } from '../../repositories/rhythmRepository';
import {
  buildCalendarSyncPreview,
  buildIntegratedWeekCalendarEvents,
  buildUpcomingReminders,
  computeReminderTriggerTime,
  nutritionCalendarAdapter,
  supplementCalendarAdapter,
  weeklyPlanningCalendarAdapter,
  workoutCalendarAdapter,
} from '../calendarAdapters';
import { layoutOverlappingDayEvents } from '../calendarOverlapLayout';
import {
  formatJalaliDayMonth,
  formatJalaliFullDate,
  getPersianDayIndexFromISO,
  getPersianWeekdayName,
  getSaturdayToFridayWeekRange,
  shiftWeekISO,
} from '../jalaliCalendar';

describe('Integrated Calendar Domain & Adapter Tests', () => {
  it('1. computes Saturday-to-Friday Persian week boundaries and shifts weeks cleanly', () => {
    // 2026-11-19 is Thursday (پنج‌شنبه, dayIndex 5)
    const range = getSaturdayToFridayWeekRange('2026-11-19');
    expect(range.weekStartISO).toBe('2026-11-14'); // Saturday
    expect(range.weekEndISO).toBe('2026-11-20'); // Friday
    expect(getPersianDayIndexFromISO(range.dayDatesISO[0])).toBe(0);
    expect(getPersianWeekdayName(getPersianDayIndexFromISO(range.dayDatesISO[0]))).toBe('شنبه');
    expect(getPersianDayIndexFromISO(range.dayDatesISO[6])).toBe(6);

    const prevWeek = shiftWeekISO(range.weekStartISO, -1);
    const nextWeek = shiftWeekISO(range.weekStartISO, 1);
    expect(prevWeek).toBe('2026-11-07');
    expect(nextWeek).toBe('2026-11-21');
  });

  it('2. converts ISO dates to Persian Jalali labels', () => {
    const dayMonth = formatJalaliDayMonth('2026-11-19');
    const full = formatJalaliFullDate('2026-11-19');
    expect(dayMonth).toContain('آبان');
    expect(full).toContain('۱۴۰۵');
  });

  it('3. extracts nutrition events without fabricating endAt/endTime and preserves approval status', () => {
    const mockData = buildInitialMockData();
    const weekStart = '2026-11-14';
    const meals = nutritionCalendarAdapter(mockData, weekStart);

    expect(meals.length).toBeGreaterThan(0);
    for (const evt of meals) {
      expect(evt.sourceModule).toBe('nutrition');
      expect(evt.isPointInTime).toBe(true);
      expect(evt.endTime).toBeUndefined();
      expect(evt.endAt).toBeUndefined();
      expect(evt.startAt).toContain('+03:30');
    }

    // Days 0..3 are CONFIRMED, days 4..6 are IN_REVIEW/DRAFT
    const satBreakfast = meals.find((m) => m.dateISO === '2026-11-14' && m.activityKind === 'meal');
    const friBreakfast = meals.find((m) => m.dateISO === '2026-11-20' && m.activityKind === 'meal');
    expect(satBreakfast?.isConfirmedForSync).toBe(true);
    expect(friBreakfast?.isConfirmedForSync).toBe(false);
  });

  it('4. extracts workout sessions with real duration and updated statuses', () => {
    const mockData = buildInitialMockData();
    const weekStart = '2026-11-14';

    // Update one session status to COMPLETED and verify adapter reflects it
    mockData.workoutSessions[0] = {
      ...mockData.workoutSessions[0],
      dateISO: '2026-11-19',
      status: WorkoutSessionStatus.COMPLETED,
    };

    const workoutEvents = workoutCalendarAdapter(mockData, weekStart);
    expect(workoutEvents.length).toBeGreaterThan(0);

    const updatedEvt = workoutEvents.find((e) => e.sourceId === mockData.workoutSessions[0].id);
    expect(updatedEvt?.status).toBe('COMPLETED');
    expect(updatedEvt?.endTime).toBeTruthy();
    expect(updatedEvt?.endAt).toBeTruthy();
    expect(updatedEvt?.isPointInTime).toBe(false);
  });

  it('5. extracts scheduled supplements as point-in-time events and skips supplements without valid timeOfDay', () => {
    const mockData = buildInitialMockData();
    const weekStart = '2026-11-14';
    const supEvents = supplementCalendarAdapter(mockData, weekStart);

    expect(supEvents.length).toBeGreaterThan(0);
    expect(supEvents.every((e) => e.isPointInTime && e.endTime === undefined && e.endAt === undefined)).toBe(true);
    // sup_iron_incomplete has empty timeOfDay -> must NOT be guessed or included
    expect(supEvents.some((e) => e.sourceId === 'sup_iron_incomplete')).toBe(false);
  });

  it('6. includes system weekly planning reminder separately and prevents duplicate events', () => {
    const mockData = buildInitialMockData();
    const weekStart = '2026-11-14';

    const sysEvents = weeklyPlanningCalendarAdapter(mockData, weekStart);
    expect(sysEvents).toHaveLength(1);
    expect(sysEvents[0].sourceModule).toBe('system');
    expect(sysEvents[0].activityKind).toBe('weekly_planning_reminder');

    const allEvents = buildIntegratedWeekCalendarEvents(mockData, weekStart);
    const ids = allEvents.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('7. assigns collision-free side-by-side lanes to overlapping concurrent events', () => {
    const mockData = buildInitialMockData();
    const weekStart = '2026-11-14';
    const events = buildIntegratedWeekCalendarEvents(mockData, weekStart);

    const syntheticDay = [
      { ...events[0], id: 'e1', startTime: '17:00', endTime: '18:00', isPointInTime: false },
      { ...events[0], id: 'e2', startTime: '17:00', endTime: undefined, isPointInTime: true },
      { ...events[0], id: 'e3', startTime: '17:30', endTime: '18:30', isPointInTime: false },
      { ...events[0], id: 'e4', startTime: '20:00', endTime: undefined, isPointInTime: true },
    ];

    const layout = layoutOverlappingDayEvents(syntheticDay, 6, 23);
    const overlapCluster = layout.filter((l) => l.event.id !== 'e4');
    const isolated = layout.find((l) => l.event.id === 'e4');

    expect(overlapCluster).toHaveLength(3);
    expect(overlapCluster.every((item) => item.totalLanes === 3)).toBe(true);
    expect(new Set(overlapCluster.map((item) => item.laneIndex)).size).toBe(3);
    expect(isolated?.totalLanes).toBe(1);
    expect(isolated?.laneIndex).toBe(0);
  });

  it('8. computes reminder trigger times (including midnight wrap) and upcoming reminders from real events', () => {
    expect(computeReminderTriggerTime('2026-11-19', '18:00', 30)).toEqual({
      reminderDateISO: '2026-11-19',
      reminderTimeHHMM: '17:30',
    });
    expect(computeReminderTriggerTime('2026-11-19', '00:15', 30)).toEqual({
      reminderDateISO: '2026-11-18',
      reminderTimeHHMM: '23:45',
    });

    const mockData = buildInitialMockData();
    const events = buildIntegratedWeekCalendarEvents(mockData, '2026-11-14');
    const reminders = buildUpcomingReminders(events, mockData.notificationPreferences);
    expect(reminders.length).toBeGreaterThan(0);
    expect(reminders.every((r) => /^\d{2}:\d{2}$/.test(r.reminderTimeHHMM))).toBe(true);
  });

  it('9. filters sync preview events strictly by confirmation, type, and cancellation rules without mutating source modules', () => {
    const mockData = buildInitialMockData();
    const plansBeforeReadOnly = structuredClone(mockData.weeklyPlans);
    const workoutsBeforeReadOnly = structuredClone(mockData.workoutSessions);
    const supplementsBeforeReadOnly = structuredClone(mockData.supplements);

    const events = buildIntegratedWeekCalendarEvents(mockData, '2026-11-14');

    // By default onlyConfirmedWeeks = true and mock week status is REVIEWING -> nutrition meals filtered out
    const strictPreview = buildCalendarSyncPreview(
      events,
      mockData.calendarSyncPreferences,
      mockData.weeklyPlans
    );
    expect(strictPreview.eligibleEvents.some((e) => e.sourceModule === 'nutrition')).toBe(false);
    expect(strictPreview.eligibleEvents.some((e) => e.sourceModule === 'workout')).toBe(true);
    expect(strictPreview.eligibleEvents.some((e) => e.sourceModule === 'system')).toBe(false);

    // Ensure source module data was never mutated by read-only calendar adapters & preview
    expect(mockData.weeklyPlans).toEqual(plansBeforeReadOnly);
    expect(mockData.workoutSessions).toEqual(workoutsBeforeReadOnly);
    expect(mockData.supplements).toEqual(supplementsBeforeReadOnly);

    // Confirm weekly plan and allow confirmed days -> confirmed days' meals become eligible, draft days stay excluded
    const confirmedPlanData = structuredClone(mockData);
    confirmedPlanData.weeklyPlans[0].status = WeeklyPlanStatus.CONFIRMED;
    const confirmedWeekPreview = buildCalendarSyncPreview(
      events,
      confirmedPlanData.calendarSyncPreferences,
      confirmedPlanData.weeklyPlans
    );
    expect(confirmedWeekPreview.eligibleEvents.some((e) => e.sourceModule === 'nutrition')).toBe(true);
    expect(
      confirmedWeekPreview.filteredOutEvents.some(
        (f) => f.event.sourceModule === 'nutrition' && !f.event.isConfirmedForSync
      )
    ).toBe(true);
  });

  describe('10. Repository persistence across simulated page refreshes', () => {
    const store = new Map<string, string>();

    beforeEach(() => {
      store.clear();
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: {
          localStorage: {
            getItem: (k: string) => store.get(k) ?? null,
            setItem: (k: string, v: string) => {
              store.set(k, v);
            },
            removeItem: (k: string) => {
              store.delete(k);
            },
          },
        },
      });
    });

    it('persists updated notification and calendar sync preferences across repository re-instantiation', async () => {
      const repo1 = new MockRhythmRepository();
      await repo1.resetDemoData();

      const notif = await repo1.getNotificationPreferences();
      notif.categories.workout.leadTimeMinutes = 45;
      notif.weeklyPlanningReminder.time24h = '11:30';
      await repo1.updateNotificationPreferences(notif);

      const sync = await repo1.getCalendarSyncPreferences();
      sync.includedTypes.snack = true;
      sync.displayRange = { startHour: 7, endHour: 22 };
      await repo1.updateCalendarSyncPreferences(sync);

      // Simulate browser refresh by creating a fresh repository instance reading from localStorage
      const repo2 = new MockRhythmRepository();
      const reloadedNotif = await repo2.getNotificationPreferences();
      const reloadedSync = await repo2.getCalendarSyncPreferences();

      expect(reloadedNotif.categories.workout.leadTimeMinutes).toBe(45);
      expect(reloadedNotif.weeklyPlanningReminder.time24h).toBe('11:30');
      expect(reloadedSync.includedTypes.snack).toBe(true);
      expect(reloadedSync.displayRange).toEqual({ startHour: 7, endHour: 22 });
    });
  });
});
