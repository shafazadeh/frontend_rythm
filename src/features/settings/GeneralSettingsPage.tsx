import { useState } from 'react';
import { Bell, Moon, RotateCcw, Sun } from 'lucide-react';
import { useRhythmData, useRhythmMutations } from '../../services/api/useRhythmQueries';
import { COMMON_TIMEZONES, PERSIAN_WEEKDAY_NAMES } from '../../shared/constants/units';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../shared/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../shared/components/ui/Card';
import { Input, Label, Select, Skeleton, Switch } from '../../shared/components/ui/FormControls';
import { ConfirmDialog } from '../../shared/components/ui/Overlays';

export function GeneralSettingsPage() {
  const { data, isLoading } = useRhythmData();
  const { updateProfile, updateAgentPreferences, resetDemoData } = useRhythmMutations();
  const { theme, setTheme, simulateThursday10AM, setSimulateThursday10AM } = useAppStore();
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  if (isLoading || !data) {
    return <Skeleton className="h-72 w-full" />;
  }

  const reminder = data.agentPreferences.reminderConfig;

  const updateReminder = async (patch: Partial<typeof reminder>) => {
    await updateAgentPreferences.mutateAsync({
      ...data.agentPreferences,
      reminderConfig: {
        ...reminder,
        ...patch,
      },
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
          تنظیمات عمومی و زمان‌بندی
        </h1>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          ظاهر برنامه، منطقه زمانی، یادآور هفتگی و مدیریت داده‌های نسخه نمایشی
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Appearance & Timezone */}
        <Card>
          <CardHeader>
            <CardTitle>ظاهر و منطقه زمانی</CardTitle>
            <CardDescription>تنظیم حالت روشن/تیره و ساعت محلی</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>پوسته رنگی</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors cursor-pointer ${
                    theme === 'light'
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-subtle)] text-[var(--color-primary)]'
                      : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
                  }`}
                >
                  <Sun className="h-4 w-4" />
                  <span>حالت روشن</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors cursor-pointer ${
                    theme === 'dark'
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-subtle)] text-[var(--color-primary)]'
                      : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
                  }`}
                >
                  <Moon className="h-4 w-4" />
                  <span>حالت تیره</span>
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="gen-tz">منطقه زمانی پیش‌فرض</Label>
              <Select
                id="gen-tz"
                value={data.profile.timezone}
                onChange={(e) =>
                  updateProfile.mutate({
                    ...data.profile,
                    timezone: e.target.value,
                    updatedAt: new Date().toISOString(),
                  })
                }
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Planning Reminder UI */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-[var(--color-primary)]" />
              <CardTitle>زمان‌بندی یادآور برنامه‌ریزی هفتگی</CardTitle>
            </div>
            <CardDescription>
              تنظیم یادآور برای شروع برنامه هفته آینده (اجرای زمان‌بند واقعی در نسخه سرور انجام می‌شود)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] p-3.5">
              <div>
                <div className="text-sm font-medium">یادآور هفتگی فعال باشد</div>
                <div className="text-xs text-[var(--text-muted)]">
                  ارسال پیشنهاد شروع برنامه‌ریزی هفته بعد
                </div>
              </div>
              <Switch
                checked={reminder.enabled}
                onCheckedChange={(v) => updateReminder({ enabled: v })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="rem-day">روز برنامه‌ریزی</Label>
                <Select
                  id="rem-day"
                  value={reminder.dayOfWeek}
                  onChange={(e) => updateReminder({ dayOfWeek: Number(e.target.value) })}
                >
                  {PERSIAN_WEEKDAY_NAMES.map((name, idx) => (
                    <option key={name} value={idx}>
                      {name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="rem-time">ساعت (۲۴ ساعته)</Label>
                <Input
                  id="rem-time"
                  type="time"
                  value={reminder.time24h}
                  onChange={(e) => updateReminder({ time24h: e.target.value })}
                  className="tabular-nums"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-[var(--bg-surface-muted)]/60 p-3 text-xs">
              <span>شبیه‌سازی وضعیت پنج‌شنبه ساعت ۱۰:۰۰ در داشبورد</span>
              <Switch
                checked={simulateThursday10AM}
                onCheckedChange={setSimulateThursday10AM}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Demo Persistence Reset */}
      <Card>
        <CardHeader>
          <CardTitle>مدیریت داده‌های نسخه نمایشی</CardTitle>
          <CardDescription>
            اطلاعات فعلی شما به‌صورت آزمایشی در حافظه مرورگر (Local Storage) نگهداری می‌شوند.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs text-[var(--text-secondary)]">
            برای بازگرداندن بانک غذاها، موجودی خانه و برنامه هفته به حالت اولیه می‌توانید داده‌ها را بازنشانی کنید.
          </p>
          <Button variant="outline" onClick={() => setResetConfirmOpen(true)}>
            <RotateCcw className="h-4 w-4" />
            <span>بازنشانی داده‌های نمونه</span>
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        onConfirm={() => resetDemoData.mutate()}
        title="بازنشانی داده‌های نمونه"
        message="تمام تغییرات شما در برنامه غذایی، لیست خرید و دستورهای پخت به داده‌های اولیه برمی‌گردند. ادامه می‌دهید؟"
        confirmLabel="بازنشانی"
        destructive
      />
    </div>
  );
}
