import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AgentPreferences,
  DailyMealPlan,
  Ingredient,
  NutritionPreferences,
  NutritionTarget,
  PantryInventory,
  PlanningSession,
  Recipe,
  RecipeCategory,
  RhythmAppData,
  ShoppingCategory,
  ShoppingListItem,
  Supplement,
  UserProfile,
  WeeklyMealPlan,
} from '../../shared/types/domain';
import {
  Exercise,
  MetReferenceEntry,
  WorkoutActivityLog,
  WorkoutPreferences,
  WorkoutProgram,
  WorkoutSession,
  WorkoutTemplate,
} from '../../shared/types/workout';
import {
  CalendarNotificationPreferences,
  CalendarSyncPreferences,
  CalendarSyncPreviewResult,
  RhythmCalendarEvent,
} from '../../shared/types/calendar';
import { rhythmRepository } from '../repositories/rhythmRepository';

export const RHYTHM_DATA_KEY = ['rhythm', 'all-data'] as const;
export const RHYTHM_CALENDAR_ROOT_KEY = ['rhythm', 'calendar'] as const;
export const RHYTHM_CALENDAR_EVENTS_KEY = (weekStartISO: string) =>
  ['rhythm', 'calendar', 'events', weekStartISO] as const;
export const RHYTHM_NOTIFICATION_PREFS_KEY = ['rhythm', 'calendar', 'notifications'] as const;
export const RHYTHM_CALENDAR_SYNC_PREFS_KEY = ['rhythm', 'calendar', 'sync-prefs'] as const;
export const RHYTHM_CALENDAR_SYNC_PREVIEW_KEY = (weekStartISO: string) =>
  ['rhythm', 'calendar', 'sync-preview', weekStartISO] as const;

export function useRhythmData() {
  return useQuery<RhythmAppData>({
    queryKey: RHYTHM_DATA_KEY,
    queryFn: () => rhythmRepository.getAllData(),
    staleTime: 1000 * 60 * 5,
  });
}

export function useCalendarEvents(weekStartISO: string) {
  return useQuery<RhythmCalendarEvent[]>({
    queryKey: RHYTHM_CALENDAR_EVENTS_KEY(weekStartISO),
    queryFn: () => rhythmRepository.getCalendarEvents(weekStartISO),
    staleTime: 1000 * 60 * 2,
  });
}

export function useNotificationPreferences() {
  return useQuery<CalendarNotificationPreferences>({
    queryKey: RHYTHM_NOTIFICATION_PREFS_KEY,
    queryFn: () => rhythmRepository.getNotificationPreferences(),
    staleTime: 1000 * 60 * 5,
  });
}

export function useCalendarSyncPreferences() {
  return useQuery<CalendarSyncPreferences>({
    queryKey: RHYTHM_CALENDAR_SYNC_PREFS_KEY,
    queryFn: () => rhythmRepository.getCalendarSyncPreferences(),
    staleTime: 1000 * 60 * 5,
  });
}

export function useCalendarSyncPreview(weekStartISO: string, enabled = true) {
  return useQuery<CalendarSyncPreviewResult>({
    queryKey: RHYTHM_CALENDAR_SYNC_PREVIEW_KEY(weekStartISO),
    queryFn: () => rhythmRepository.previewCalendarSync(weekStartISO),
    enabled,
    staleTime: 1000 * 60,
  });
}

export function useRhythmMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: RHYTHM_DATA_KEY });
    queryClient.invalidateQueries({ queryKey: RHYTHM_CALENDAR_ROOT_KEY });
  };

  const resetDemoData = useMutation({
    mutationFn: () => rhythmRepository.resetDemoData(),
    onSuccess: () => {
      invalidate();
      toast.success('داده‌های نمونه به حالت اولیه بازنشانی شد.');
    },
  });

  const updateProfile = useMutation({
    mutationFn: (profile: UserProfile) => rhythmRepository.updateProfile(profile),
    onSuccess: () => {
      invalidate();
      toast.success('اطلاعات پروفایل با موفقیت ذخیره شد.');
    },
  });

  const updateTarget = useMutation({
    mutationFn: (target: NutritionTarget) => rhythmRepository.updateNutritionTarget(target),
    onSuccess: () => {
      invalidate();
      toast.success('اهداف تغذیه‌ای به‌روزرسانی شد.');
    },
  });

  const updatePreferences = useMutation({
    mutationFn: (prefs: NutritionPreferences) => rhythmRepository.updateNutritionPreferences(prefs),
    onSuccess: () => {
      invalidate();
      toast.success('ترجیحات غذایی ذخیره شد.');
    },
  });

  const updateAgentPreferences = useMutation({
    mutationFn: (prefs: AgentPreferences) => rhythmRepository.updateAgentPreferences(prefs),
    onSuccess: () => {
      invalidate();
      toast.success('تنظیمات دستیار ریتم ذخیره شد.');
    },
  });

  const upsertRecipe = useMutation({
    mutationFn: (recipe: Recipe) => rhythmRepository.upsertRecipe(recipe),
    onSuccess: () => {
      invalidate();
      toast.success('دستور غذا ذخیره شد.');
    },
  });

  const deleteRecipe = useMutation({
    mutationFn: (recipeId: string) => rhythmRepository.deleteRecipe(recipeId),
    onSuccess: () => {
      invalidate();
      toast.success('غذا از بانک غذاها حذف شد.');
    },
  });

  const upsertIngredient = useMutation({
    mutationFn: (ing: Ingredient) => rhythmRepository.upsertIngredient(ing),
    onSuccess: () => {
      invalidate();
      toast.success('ماده اولیه ذخیره شد.');
    },
  });

  const deleteIngredient = useMutation({
    mutationFn: (id: string) => rhythmRepository.deleteIngredient(id),
    onSuccess: () => {
      invalidate();
      toast.success('ماده اولیه حذف شد.');
    },
  });

  const upsertRecipeCategory = useMutation({
    mutationFn: (cat: RecipeCategory) => rhythmRepository.upsertRecipeCategory(cat),
    onSuccess: () => {
      invalidate();
      toast.success('دسته‌بندی غذا ذخیره شد.');
    },
  });

  const deleteRecipeCategory = useMutation({
    mutationFn: ({ id, replacementId }: { id: string; replacementId?: string }) =>
      rhythmRepository.deleteRecipeCategory(id, replacementId),
    onSuccess: () => {
      invalidate();
      toast.success('دسته‌بندی غذا حذف شد.');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const upsertShoppingCategory = useMutation({
    mutationFn: (cat: ShoppingCategory) => rhythmRepository.upsertShoppingCategory(cat),
    onSuccess: () => {
      invalidate();
      toast.success('دسته‌بندی خرید ذخیره شد.');
    },
  });

  const deleteShoppingCategory = useMutation({
    mutationFn: ({ id, replacementId }: { id: string; replacementId?: string }) =>
      rhythmRepository.deleteShoppingCategory(id, replacementId),
    onSuccess: () => {
      invalidate();
      toast.success('دسته‌بندی خرید حذف شد.');
    },
  });

  const upsertSupplement = useMutation({
    mutationFn: (sup: Supplement) => rhythmRepository.upsertSupplement(sup),
    onSuccess: () => {
      invalidate();
      toast.success('اطلاعات مکمل ذخیره شد.');
    },
  });

  const deleteSupplement = useMutation({
    mutationFn: (id: string) => rhythmRepository.deleteSupplement(id),
    onSuccess: () => {
      invalidate();
      toast.success('مکمل حذف شد.');
    },
  });

  const upsertPantryItem = useMutation({
    mutationFn: (item: PantryInventory) => rhythmRepository.upsertPantryItem(item),
    onSuccess: () => {
      invalidate();
      toast.success('موجودی خانه به‌روزرسانی شد.');
    },
  });

  const deletePantryItem = useMutation({
    mutationFn: (id: string) => rhythmRepository.deletePantryItem(id),
    onSuccess: () => {
      invalidate();
      toast.success('قلم از موجودی خانه حذف شد.');
    },
  });

  const adjustPantryQuantity = useMutation({
    mutationFn: ({ id, delta }: { id: string; delta: number }) =>
      rhythmRepository.adjustPantryQuantity(id, delta),
    onSuccess: () => {
      invalidate();
      toast.success('مقدار موجودی خانه تغییر کرد.');
    },
  });

  const startPlanningSession = useMutation({
    mutationFn: (weekType: 'CURRENT' | 'NEXT') =>
      rhythmRepository.startOrResumePlanningSession(weekType),
    onSuccess: () => {
      invalidate();
    },
  });

  const updatePlanningSession = useMutation({
    mutationFn: (session: PlanningSession | null) =>
      rhythmRepository.updatePlanningSession(session),
    onSuccess: () => {
      invalidate();
    },
  });

  const generateWeeklyPlan = useMutation({
    mutationFn: (weekStartISO: string) => rhythmRepository.generateWeeklyPlan(weekStartISO),
    onSuccess: () => {
      invalidate();
      toast.success('برنامه غذایی پیشنهادی هفته تولید شد.');
    },
  });

  const updateWeeklyPlan = useMutation({
    mutationFn: (plan: WeeklyMealPlan) => rhythmRepository.updateWeeklyPlan(plan),
    onSuccess: () => {
      invalidate();
    },
  });

  const updateDailyPlan = useMutation({
    mutationFn: ({ planId, day }: { planId: string; day: DailyMealPlan }) =>
      rhythmRepository.updateDailyPlan(planId, day),
    onSuccess: () => {
      invalidate();
    },
  });

  const confirmWeeklyPlan = useMutation({
    mutationFn: (planId: string) => rhythmRepository.confirmWeeklyPlan(planId),
    onSuccess: () => {
      invalidate();
      toast.success('برنامه هفته با موفقیت تأیید نهایی شد و لیست خرید ایجاد گردید.');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const regenerateShoppingList = useMutation({
    mutationFn: ({ planId, includeUnconfirmed }: { planId: string; includeUnconfirmed?: boolean }) =>
      rhythmRepository.regenerateShoppingList(planId, includeUnconfirmed),
    onSuccess: () => {
      invalidate();
      toast.success('لیست خرید با برنامه غذایی و موجودی خانه همگام‌سازی شد.');
    },
  });

  const upsertShoppingItem = useMutation({
    mutationFn: ({ listId, item }: { listId: string; item: ShoppingListItem }) =>
      rhythmRepository.upsertShoppingItem(listId, item),
    onSuccess: () => {
      invalidate();
    },
  });

  const deleteShoppingItem = useMutation({
    mutationFn: ({ listId, itemId }: { listId: string; itemId: string }) =>
      rhythmRepository.deleteShoppingItem(listId, itemId),
    onSuccess: () => {
      invalidate();
      toast.success('کالا از لیست خرید حذف شد.');
    },
  });

  // Workout Module Mutations
  const upsertExercise = useMutation({
    mutationFn: (exercise: Exercise) => rhythmRepository.upsertExercise(exercise),
    onSuccess: () => {
      invalidate();
      toast.success('حرکت ورزشی ذخیره شد.');
    },
  });

  const deleteExercise = useMutation({
    mutationFn: (id: string) => rhythmRepository.deleteExercise(id),
    onSuccess: () => {
      invalidate();
      toast.success('حرکت از بانک حرکات حذف شد.');
    },
  });

  const saveWorkoutProgram = useMutation({
    mutationFn: ({
      program,
      templates,
    }: {
      program: WorkoutProgram;
      templates: WorkoutTemplate[];
    }) => rhythmRepository.saveWorkoutProgramWithTemplates(program, templates),
    onSuccess: () => {
      invalidate();
      toast.success('برنامه ورزشی و جلسات آن ذخیره شد.');
    },
  });

  const duplicateWorkoutProgram = useMutation({
    mutationFn: (programId: string) => rhythmRepository.duplicateWorkoutProgram(programId),
    onSuccess: () => {
      invalidate();
      toast.success('کپی جدید از برنامه ورزشی ایجاد شد.');
    },
  });

  const toggleWorkoutProgramActive = useMutation({
    mutationFn: ({ programId, isActive }: { programId: string; isActive: boolean }) =>
      rhythmRepository.toggleWorkoutProgramActive(programId, isActive),
    onSuccess: () => {
      invalidate();
      toast.success('وضعیت برنامه ورزشی تغییر کرد.');
    },
  });

  const deleteWorkoutProgram = useMutation({
    mutationFn: (programId: string) => rhythmRepository.deleteWorkoutProgram(programId),
    onSuccess: () => {
      invalidate();
      toast.success('برنامه ورزشی حذف شد.');
    },
  });

  const upsertWorkoutSession = useMutation({
    mutationFn: (session: WorkoutSession) => rhythmRepository.upsertWorkoutSession(session),
    onSuccess: () => {
      invalidate();
    },
  });

  const deleteWorkoutSession = useMutation({
    mutationFn: (sessionId: string) => rhythmRepository.deleteWorkoutSession(sessionId),
    onSuccess: () => {
      invalidate();
      toast.success('جلسه تمرینی حذف شد.');
    },
  });

  const generateWeeklyWorkoutSessions = useMutation({
    mutationFn: (params: {
      weekStartISO: string;
      programId: string;
      preferredDays?: number[];
      defaultStartTime?: string;
    }) => rhythmRepository.generateWeeklyWorkoutSessions(params),
    onSuccess: (created) => {
      invalidate();
      toast.success(
        created.length > 0
          ? 'جلسات تمرینی هفته با موفقیت زمانبندی شدند.'
          : 'جلسات این برنامه از قبل در هفته انتخابی ثبت شده‌اند.'
      );
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const saveWorkoutActivityLog = useMutation({
    mutationFn: ({
      log,
      nextSessionStatus,
      updatedExercises,
    }: {
      log: WorkoutActivityLog;
      nextSessionStatus?: WorkoutSession['status'];
      updatedExercises?: WorkoutSession['exercises'];
    }) =>
      rhythmRepository.saveWorkoutActivityLog(log, nextSessionStatus, updatedExercises),
    onSuccess: () => {
      invalidate();
    },
  });

  const updateWorkoutPreferences = useMutation({
    mutationFn: (prefs: WorkoutPreferences) => rhythmRepository.updateWorkoutPreferences(prefs),
    onSuccess: () => {
      invalidate();
      toast.success('تنظیمات ورزشی ذخیره شد.');
    },
  });

  const updateMetReferenceTable = useMutation({
    mutationFn: (entries: MetReferenceEntry[]) => rhythmRepository.updateMetReferenceTable(entries),
    onSuccess: () => {
      invalidate();
      toast.success('جدول مرجع MET به‌روزرسانی شد.');
    },
  });

  // Integrated Calendar Mutations
  const updateNotificationPreferences = useMutation({
    mutationFn: (prefs: CalendarNotificationPreferences) =>
      rhythmRepository.updateNotificationPreferences(prefs),
    onSuccess: () => {
      invalidate();
      toast.success('تنظیمات اعلان‌ها و یادآوری هفتگی ذخیره شد.');
    },
  });

  const updateCalendarSyncPreferences = useMutation({
    mutationFn: (prefs: CalendarSyncPreferences) =>
      rhythmRepository.updateCalendarSyncPreferences(prefs),
    onSuccess: () => {
      invalidate();
      toast.success('تنظیمات همگام‌سازی و نمایش تقویم ذخیره شد.');
    },
  });

  return {
    resetDemoData,
    updateProfile,
    updateTarget,
    updatePreferences,
    updateAgentPreferences,
    upsertRecipe,
    deleteRecipe,
    upsertIngredient,
    deleteIngredient,
    upsertRecipeCategory,
    deleteRecipeCategory,
    upsertShoppingCategory,
    deleteShoppingCategory,
    upsertSupplement,
    deleteSupplement,
    upsertPantryItem,
    deletePantryItem,
    adjustPantryQuantity,
    startPlanningSession,
    updatePlanningSession,
    generateWeeklyPlan,
    updateWeeklyPlan,
    updateDailyPlan,
    confirmWeeklyPlan,
    regenerateShoppingList,
    upsertShoppingItem,
    deleteShoppingItem,
    upsertExercise,
    deleteExercise,
    saveWorkoutProgram,
    duplicateWorkoutProgram,
    toggleWorkoutProgramActive,
    deleteWorkoutProgram,
    upsertWorkoutSession,
    deleteWorkoutSession,
    generateWeeklyWorkoutSessions,
    saveWorkoutActivityLog,
    updateWorkoutPreferences,
    updateMetReferenceTable,
    updateNotificationPreferences,
    updateCalendarSyncPreferences,
  };
}
