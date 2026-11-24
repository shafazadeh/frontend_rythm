import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { DashboardPage } from '../../features/dashboard/DashboardPage';
import { PlannerPage } from '../../features/nutrition/planner/PlannerPage';
import { RecipesPage } from '../../features/nutrition/recipes/RecipesPage';
import { RecipeCategoriesPage } from '../../features/nutrition/categories/RecipeCategoriesPage';
import { ShoppingListPage } from '../../features/shopping/list/ShoppingListPage';
import { ShoppingCategoriesPage } from '../../features/shopping/categories/ShoppingCategoriesPage';
import { ProfileSettingsPage } from '../../features/settings/ProfileSettingsPage';
import { SupplementsPage } from '../../features/settings/SupplementsPage';
import { AgentPreferencesPage } from '../../features/agent/preferences/AgentPreferencesPage';
import { GeneralSettingsPage } from '../../features/settings/GeneralSettingsPage';
import { FutureModulePage } from '../../features/settings/FutureModulePage';
import { WorkoutDashboardPage } from '../../features/workout/dashboard/WorkoutDashboardPage';
import { WorkoutPlannerPage } from '../../features/workout/planner/WorkoutPlannerPage';
import { WorkoutCalendarPage } from '../../features/workout/calendar/WorkoutCalendarPage';
import { WorkoutProgramsPage } from '../../features/workout/programs/WorkoutProgramsPage';
import { ExercisesPage } from '../../features/workout/exercises/ExercisesPage';
import { WorkoutHistoryPage } from '../../features/workout/history/WorkoutHistoryPage';
import { WorkoutSettingsPage } from '../../features/workout/settings/WorkoutSettingsPage';
import { IntegratedCalendarPage } from '../../features/calendar/IntegratedCalendarPage';

export function AppRouter() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* Active Nutrition Module */}
          <Route path="/nutrition/planner" element={<PlannerPage />} />
          <Route path="/nutrition/recipes" element={<RecipesPage />} />
          <Route path="/nutrition/categories" element={<RecipeCategoriesPage />} />

          {/* Active Shopping Module */}
          <Route path="/shopping/list" element={<ShoppingListPage />} />
          <Route path="/shopping/categories" element={<ShoppingCategoriesPage />} />

          {/* Active Workout Module */}
          <Route path="/workout" element={<WorkoutDashboardPage />} />
          <Route path="/workout/planner" element={<WorkoutPlannerPage />} />
          <Route path="/workout/calendar" element={<WorkoutCalendarPage />} />
          <Route path="/workout/programs" element={<WorkoutProgramsPage />} />
          <Route path="/workout/exercises" element={<ExercisesPage />} />
          <Route path="/workout/history" element={<WorkoutHistoryPage />} />
          <Route path="/workout/settings" element={<WorkoutSettingsPage />} />
          <Route path="/workouts" element={<Navigate to="/workout" replace />} />

          {/* Active Integrated Calendar Module */}
          <Route path="/calendar" element={<IntegratedCalendarPage />} />

          {/* Settings & Agent */}
          <Route path="/settings/profile" element={<ProfileSettingsPage />} />
          <Route path="/settings/supplements" element={<SupplementsPage />} />
          <Route path="/settings/agent" element={<AgentPreferencesPage />} />
          <Route path="/settings/general" element={<GeneralSettingsPage />} />

          {/* Extensible Future Modules (Coming Soon) */}
          <Route path="/tasks" element={<FutureModulePage moduleId="tasks" />} />
          <Route path="/habits" element={<FutureModulePage moduleId="habits" />} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
