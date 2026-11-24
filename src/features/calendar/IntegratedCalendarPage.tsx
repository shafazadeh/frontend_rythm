import { useMemo, useState } from 'react';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
} from 'lucide-react';
import {
  useCalendarEvents,
  useCalendarSyncPreferences,
  useNotificationPreferences,
  useRhythmData,
  useRhythmMutations,
} from '../../services/api/useRhythmQueries';
import {
  formatJalaliWeekRangeLabel,
  getSaturdayToFridayWeekRange,
  shiftWeekISO,
} from '../../services/domain/jalaliCalendar';
import { Button } from '../../shared/components/ui/Button';
import { Card, CardContent } from '../../shared/components/ui/Card';
import { Skeleton } from '../../shared/components/ui/FormControls';
import { CALENDAR_EVENT_THEME } from '../../shared/constants/calendar';
import { RhythmCalendarEvent } from '../../shared/types/calendar';
import { CalendarEventCard, CalendarModuleIcon } from './components/CalendarEventCard';
import { CalendarSyncDialog } from './components/CalendarSyncDialog';
import { EventDetailDrawer } from './components/EventDetailDrawer';
import { NotificationSettingsDrawer } from './components/NotificationSettingsDrawer';
import { UpcomingRemindersSection } from './components/UpcomingRemindersSection';
import { WeeklyCalendarGrid } from './components/WeeklyCalendarGrid';

const DEMO_TODAY_ISO = '2026-11-19';

export function IntegratedCalendarPage() {
  const [weekAnchorISO, setWeekAnchorISO] = useState<string>(DEMO_TODAY_ISO);
  const weekRange = useMemo(
    () => getSaturdayToFridayWeekRange(weekAnchorISO),
    [weekAnchorISO]
  );

  const { data: appData, isLoading: appLoading, isError: appError } = useRhythmData();
  const {
    data: weekEvents,
    isLoading: eventsLoading,
    isError: eventsError,
  } = useCalendarEvents(weekRange.weekStartISO);
  const { data: notificationPrefs, isLoading: notifLoading } = useNotificationPreferences();
  const { data: syncPrefs, isLoading: syncLoading } = useCalendarSyncPreferences();
  const { updateNotificationPreferences, updateCalendarSyncPreferences } = useRhythmMutations();

  const [selectedEvent, setSelectedEvent] = useState<RhythmCalendarEvent | null>(null);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncInitialTab, setSyncInitialTab] = useState<'SETTINGS' | 'PREVIEW'>('SETTINGS');

  const isLoading = appLoading || eventsLoading || notifLoading || syncLoading;
  const isError = appError || eventsError;

  const currentWeekStart = useMemo(
    () => getSaturdayToFridayWeekRange(DEMO_TODAY_ISO).weekStartISO,
    []
  );
  const isCurrentWeek = weekRange.weekStartISO === currentWeekStart;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-[520px] w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (isError || !appData || !weekEvents || !notificationPrefs || !syncPrefs) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-[var(--color-error)]">
          بارگذاری تقویم یکپارچه با خطا مواجه شد. لطفاً صفحه را مجدداً بارگذاری کنید.
        </CardContent>
      </Card>
    );
  }

  const timeZone = appData.profile?.timezone || 'Asia/Tehran';

  const handleUpdateEventReminder = async (
    eventId: string,
    override: { enabled: boolean; leadTimeMinutes: number }
  ) => {
    await updateNotificationPreferences.mutateAsync({
      ...notificationPrefs,
      eventOverrides: {
        ...notificationPrefs.eventOverrides,
        [eventId]: override,
      },
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Toolbar & Week Navigation */}
      <Card>
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-balance text-[var(--text-primary)]">
                تقویم یکپارچه
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[var(--text-muted)]">
                <span className="tabular-nums font-medium text-[var(--text-secondary)]">
                  {formatJalaliWeekRangeLabel(weekRange.weekStartISO, weekRange.weekEndISO)}
                </span>
                <span aria-hidden="true">·</span>
                <span>منطقه زمانی: {timeZone}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWeekAnchorISO((prev) => shiftWeekISO(prev, -1))}
                >
                  <ChevronRight className="h-4 w-4" />
                  <span>هفته قبل</span>
                </Button>

                <Button
                  variant={isCurrentWeek ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setWeekAnchorISO(DEMO_TODAY_ISO)}
                  disabled={isCurrentWeek}
                >
                  بازگشت به هفته جاری
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWeekAnchorISO((prev) => shiftWeekISO(prev, 1))}
                >
                  <span>هفته بعد</span>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNotifDrawerOpen(true)}
                >
                  <Bell className="h-3.5 w-3.5" />
                  <span>تنظیمات اعلان</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSyncInitialTab('SETTINGS');
                    setSyncDialogOpen(true);
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>تنظیمات همگام‌سازی</span>
                </Button>

                <Button
                  size="sm"
                  onClick={() => {
                    setSyncInitialTab('PREVIEW');
                    setSyncDialogOpen(true);
                  }}
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>پیشنمایش همگام‌سازی</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Non-color-only Legend (Icon + Color + Text Label) */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-3 border-t border-[var(--border-subtle)] text-xs">
            <span className={`inline-flex items-center gap-1.5 font-medium ${CALENDAR_EVENT_THEME.nutrition.textClass}`}>
              <CalendarModuleIcon sourceModule="nutrition" />
              <span>تغذیه (سبز)</span>
            </span>
            <span className={`inline-flex items-center gap-1.5 font-medium ${CALENDAR_EVENT_THEME.workout.textClass}`}>
              <CalendarModuleIcon sourceModule="workout" />
              <span>ورزش (آبی)</span>
            </span>
            <span className={`inline-flex items-center gap-1.5 font-medium ${CALENDAR_EVENT_THEME.supplement.textClass}`}>
              <CalendarModuleIcon sourceModule="supplement" />
              <span>مکمل‌ها (بنفش)</span>
            </span>
            <span className={`inline-flex items-center gap-1.5 font-medium ${CALENDAR_EVENT_THEME.system.subtleTextClass}`}>
              <CalendarModuleIcon sourceModule="system" />
              <span>یادآوری برنامه‌ریزی هفته (سیستمی)</span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Weekly 7-Column Calendar (Desktop Hourly Grid / Mobile Day Selector) */}
      <WeeklyCalendarGrid
        dayDatesISO={weekRange.dayDatesISO}
        events={weekEvents}
        displayRange={syncPrefs.displayRange}
        todayISO={DEMO_TODAY_ISO}
        onSelectEvent={(evt) => setSelectedEvent(evt)}
      />

      {/* Section 3: Upcoming Reminders Center */}
      <UpcomingRemindersSection
        events={weekEvents}
        notificationPrefs={notificationPrefs}
        onUpdateEventReminder={handleUpdateEventReminder}
        onOpenEventDetail={(evt) => setSelectedEvent(evt)}
        onOpenNotificationSettings={() => setNotifDrawerOpen(true)}
      />

      {/* Event Details Drawer */}
      <EventDetailDrawer
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        notificationPrefs={notificationPrefs}
        onUpdateEventReminder={handleUpdateEventReminder}
      />

      {/* Notification Settings & Display Range Drawer */}
      <NotificationSettingsDrawer
        open={notifDrawerOpen}
        onClose={() => setNotifDrawerOpen(false)}
        notificationPrefs={notificationPrefs}
        displayRange={syncPrefs.displayRange}
        onSaveNotificationPrefs={(prefs) => updateNotificationPreferences.mutateAsync(prefs)}
        onSaveDisplayRange={(range) =>
          updateCalendarSyncPreferences.mutateAsync({
            ...syncPrefs,
            displayRange: range,
          })
        }
      />

      {/* Calendar Sync & Preview Dialog */}
      <CalendarSyncDialog
        open={syncDialogOpen}
        initialTab={syncInitialTab}
        onClose={() => setSyncDialogOpen(false)}
        syncPrefs={syncPrefs}
        events={weekEvents}
        weeklyPlans={appData.weeklyPlans}
        onSaveSyncPrefs={(prefs) => updateCalendarSyncPreferences.mutateAsync(prefs)}
      />
    </div>
  );
}

// Keep unused named export clean if ever imported by tests
export { CalendarEventCard };
