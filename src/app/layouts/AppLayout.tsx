import * as React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  Dumbbell,
  LayoutDashboard,
  Menu,
  Moon,
  Repeat,
  Settings,
  ShoppingBasket,
  Sparkles,
  Sun,
  Utensils,
  X,
} from 'lucide-react';
import { MODULE_REGISTRY, ROUTE_TITLES } from '../../shared/constants/navigation';
import { useAppStore } from '../../store/useAppStore';
import { useRhythmData, useRhythmMutations } from '../../services/api/useRhythmQueries';
import { Button } from '../../shared/components/ui/Button';
import { cn } from '../../shared/utils/cn';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Utensils,
  ShoppingBasket,
  Settings,
  Dumbbell,
  CheckSquare,
  CalendarDays,
  Repeat,
};

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const { data } = useRhythmData();
  const activeModules = MODULE_REGISTRY.filter((m) => m.status === 'ACTIVE');
  const futureModules = MODULE_REGISTRY.filter((m) => m.status === 'COMING_SOON');

  return (
    <div className="flex h-full flex-col justify-between py-5 px-4">
      <div className="space-y-6 overflow-y-auto">
        {/* Brand mark */}
        <div className="px-2">
          <NavLink
            to="/dashboard"
            onClick={onNavigate}
            className="flex items-center gap-2.5 text-[var(--text-primary)]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary)] text-[var(--color-primary-foreground)] font-bold text-base">
              ر
            </span>
            <div>
              <div className="text-base font-bold leading-tight">ریتم</div>
              <div className="text-[11px] text-[var(--text-muted)]">
                برنامه‌ریزی با ریتم خودت
              </div>
            </div>
          </NavLink>
        </div>

        {/* Active Navigation */}
        <nav aria-label="منوی اصلی" className="space-y-5">
          {activeModules.map((mod) => {
            const Icon = ICON_MAP[mod.iconName] ?? LayoutDashboard;
            if (!mod.children) {
              return (
                <NavLink
                  key={mod.id}
                  to={mod.basePath}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)] hover:text-[var(--text-primary)]'
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{mod.title}</span>
                </NavLink>
              );
            }

            const isGroupActive = pathname.startsWith(mod.basePath);
            return (
              <div key={mod.id} className="space-y-1">
                <div
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 text-xs font-semibold',
                    isGroupActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{mod.title}</span>
                </div>
                <div className="space-y-0.5 pr-4">
                  {mod.children.map((child) => (
                    <NavLink
                      key={child.path}
                      to={child.path}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
                          isActive
                            ? 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-medium'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)] hover:text-[var(--text-primary)]'
                        )
                      }
                    >
                      <span className="truncate">{child.title}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Future Modules */}
          <div className="pt-3 border-t border-[var(--border-subtle)] space-y-1">
            <div className="px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)]">
              ماژول‌های آینده
            </div>
            {futureModules.map((mod) => {
              const Icon = ICON_MAP[mod.iconName] ?? CalendarDays;
              return (
                <NavLink
                  key={mod.id}
                  to={mod.basePath}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] font-medium'
                        : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface-muted)] hover:text-[var(--text-secondary)]'
                    )
                  }
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{mod.title}</span>
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)] whitespace-nowrap shrink-0">
                    به‌زودی
                  </span>
                </NavLink>
              );
            })}
          </div>
        </nav>
      </div>

      {/* User Mini Footer */}
      {data?.profile && (
        <NavLink
          to="/settings/profile"
          onClick={onNavigate}
          className="mt-4 flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]/60 p-2.5 hover:bg-[var(--bg-surface-muted)] transition-colors"
        >
          {data.profile.avatarUrl ? (
            <img
              src={data.profile.avatarUrl}
              alt={data.profile.displayName}
              referrerPolicy="no-referrer"
              className="h-9 w-9 rounded-full object-cover border border-[var(--border-subtle)] shrink-0"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] text-sm font-semibold shrink-0">
              {data.profile.displayName.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold text-[var(--text-primary)]">
              {data.profile.displayName}
            </div>
            <div className="truncate text-[11px] text-[var(--text-muted)] tabular-nums">
              هدف: {data.target.dailyCalories.toLocaleString('fa-IR')} کالری
            </div>
          </div>
        </NavLink>
      )}
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme, mobileNavOpen, setMobileNavOpen } = useAppStore();
  const { startPlanningSession } = useRhythmMutations();

  const routeMeta = ROUTE_TITLES[pathname] ?? {
    title: 'ریتم',
    breadcrumb: ['ریتم'],
  };

  const handleStartPlanning = async () => {
    await startPlanningSession.mutateAsync('NEXT');
    navigate('/nutrition/planner');
  };

  return (
    <div className="min-h-screen flex bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Desktop Right Sidebar (RTL Start) */}
      <aside className="hidden lg:block w-[264px] shrink-0 border-l border-[var(--border-subtle)] bg-[var(--bg-surface)] sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden bg-black/45"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileNavOpen(false);
          }}
        >
          <aside className="w-[272px] max-w-[85vw] h-full bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] shadow-xl relative">
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              aria-label="بستن منو"
              className="absolute left-3 top-4 flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-surface-muted)] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb on Start, Theme + Primary CTA on End */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur-sm px-4 sm:px-6 h-16">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="باز کردن منو"
              className="inline-flex lg:hidden h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] cursor-pointer shrink-0"
            >
              <Menu className="h-5 w-5" />
            </button>

            <nav aria-label="مسیر صفحه" className="flex items-center gap-1.5 text-sm min-w-0">
              {routeMeta.breadcrumb.map((crumb, idx) => (
                <React.Fragment key={crumb}>
                  {idx > 0 && <ChevronLeft className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />}
                  <span
                    className={cn(
                      'truncate',
                      idx === routeMeta.breadcrumb.length - 1
                        ? 'font-semibold text-[var(--text-primary)]'
                        : 'text-[var(--text-muted)] hidden sm:inline'
                    )}
                  >
                    {crumb}
                  </span>
                </React.Fragment>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={theme === 'light' ? 'تغییر به حالت تیره' : 'تغییر به حالت روشن'}
              title={theme === 'light' ? 'حالت تیره' : 'حالت روشن'}
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>

            <Button
              size="sm"
              onClick={handleStartPlanning}
              disabled={startPlanningSession.isPending}
              className="hidden sm:inline-flex"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>برنامه‌ریزی هفته</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-[1280px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
