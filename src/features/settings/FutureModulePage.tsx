import { useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarDays, CheckSquare, Dumbbell, Repeat } from 'lucide-react';
import { MODULE_REGISTRY } from '../../shared/constants/navigation';
import { Button } from '../../shared/components/ui/Button';
import { Card, CardContent } from '../../shared/components/ui/Card';

const FUTURE_ICONS: Record<string, typeof Dumbbell> = {
  workouts: Dumbbell,
  tasks: CheckSquare,
  calendar: CalendarDays,
  habits: Repeat,
};

export function FutureModulePage({ moduleId }: { moduleId: string }) {
  const navigate = useNavigate();
  const mod = MODULE_REGISTRY.find((m) => m.id === moduleId);
  const Icon = FUTURE_ICONS[moduleId] ?? CalendarDays;

  return (
    <div className="py-10 max-w-xl mx-auto">
      <Card>
        <CardContent className="p-8 text-center space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--bg-surface-muted)] text-[var(--color-primary)]">
            <Icon className="h-7 w-7" />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-[var(--color-accent)]">
              در دست توسعه · به‌زودی در نسخه‌های بعدی ریتم
            </div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">
              {mod?.title ?? 'ماژول آینده'}
            </h1>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              {mod?.subtitle ??
                'این بخش در ساختار ماژولار ریتم آماده شده و پس از تکمیل ماژول تغذیه و خرید فعال خواهد شد.'}
            </p>
          </div>

          <div className="rounded-lg bg-[var(--bg-surface-muted)]/60 p-4 text-xs text-[var(--text-muted)] text-right leading-relaxed">
            در نسخه اول «ریتم» تمرکز کامل بر دو ماژول فعال «برنامه غذایی هفتگی» و «لیست خرید و موجودی خانه» قرار دارد. ساختار مسیریابی و مخزن داده برای افزودن این ماژول آماده است.
          </div>

          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            <ArrowRight className="h-4 w-4" />
            <span>بازگشت به داشبورد</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
