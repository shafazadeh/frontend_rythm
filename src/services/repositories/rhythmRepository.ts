import {
  AgentPreferences,
  DailyMealPlan,
  DailyPlanStatus,
  Ingredient,
  MealIngredientOverride,
  NutritionPreferences,
  NutritionTarget,
  PantryInventory,
  PlanningSession,
  Recipe,
  RecipeCategory,
  RhythmAppData,
  ShoppingCategory,
  ShoppingList,
  ShoppingListItem,
  Supplement,
  UserProfile,
  WeeklyMealPlan,
  WeeklyPlanStatus,
} from '../../shared/types/domain';
import {
  Exercise,
  MetReferenceEntry,
  WorkoutActivityLog,
  WorkoutPreferences,
  WorkoutProgram,
  WorkoutSession,
  WorkoutSessionStatus,
  WorkoutTemplate,
} from '../../shared/types/workout';
import { generateId } from '../../shared/utils/cn';
import {
  getNextSaturdayToFridayWeekRange,
  getPersianDayIndexFromISO,
  getSaturdayToFridayWeekRange,
} from '../domain/jalaliCalendar';
import { generateMockWeeklyPlan } from '../domain/mockPlannerEngine';
import { calculateWeeklyNutritionSummary } from '../domain/nutritionCalculator';
import { minutesToTime, timeToMinutes } from '../domain/scheduleConflictChecker';
import { generateShoppingListFromPlan } from '../domain/shoppingAggregator';
import { buildInitialMockData } from '../mock/mockInitialState';
import {
  buildInitialWorkoutMockData,
  templateExercisesToSessionExercises,
} from '../mock/mockWorkouts';
import {
  CalendarNotificationPreferences,
  CalendarSyncPreferences,
  CalendarSyncPreviewResult,
  RhythmCalendarEvent,
} from '../../shared/types/calendar';
import {
  buildCalendarSyncPreview,
  buildIntegratedWeekCalendarEvents,
} from '../domain/calendarAdapters';
import {
  buildDefaultCalendarSyncPreferences,
  buildDefaultNotificationPreferences,
} from '../mock/mockCalendarDefaults';
import {
  CalendarPreferencesRepository,
  NotificationPreferencesRepository,
} from './calendarPreferencesRepository';
import { IWorkoutRepository } from './workoutAdapters';

const STORAGE_KEY = 'rhythm_demo_state_v1';

/**
 * Typed Repository Interface for Rhythm.
 * Future Backend (REST / LangGraph / PostgreSQL) implements this exact contract.
 */
export interface IRhythmRepository
  extends IWorkoutRepository,
    CalendarPreferencesRepository,
    NotificationPreferencesRepository {
  getAllData(): Promise<RhythmAppData>;
  resetDemoData(): Promise<RhythmAppData>;

  // Profile, Targets & Preferences
  updateProfile(profile: UserProfile): Promise<UserProfile>;
  updateNutritionTarget(target: NutritionTarget): Promise<NutritionTarget>;
  updateNutritionPreferences(prefs: NutritionPreferences): Promise<NutritionPreferences>;
  updateAgentPreferences(prefs: AgentPreferences): Promise<AgentPreferences>;

  // Recipes & Ingredients
  upsertRecipe(recipe: Recipe): Promise<Recipe>;
  deleteRecipe(recipeId: string): Promise<void>;
  upsertIngredient(ingredient: Ingredient): Promise<Ingredient>;
  deleteIngredient(ingredientId: string): Promise<void>;

  // Categories
  upsertRecipeCategory(category: RecipeCategory): Promise<RecipeCategory>;
  deleteRecipeCategory(categoryId: string, replacementCategoryId?: string): Promise<void>;
  upsertShoppingCategory(category: ShoppingCategory): Promise<ShoppingCategory>;
  deleteShoppingCategory(categoryId: string, replacementCategoryId?: string): Promise<void>;

  // Supplements
  upsertSupplement(supplement: Supplement): Promise<Supplement>;
  deleteSupplement(supplementId: string): Promise<void>;

  // Pantry
  upsertPantryItem(item: PantryInventory): Promise<PantryInventory>;
  deletePantryItem(itemId: string): Promise<void>;
  adjustPantryQuantity(itemId: string, delta: number): Promise<PantryInventory | null>;

  // Weekly Planning & Session
  startOrResumePlanningSession(weekType: 'CURRENT' | 'NEXT'): Promise<PlanningSession>;
  updatePlanningSession(session: PlanningSession | null): Promise<PlanningSession | null>;
  generateWeeklyPlan(weekStartISO: string): Promise<WeeklyMealPlan>;
  updateWeeklyPlan(plan: WeeklyMealPlan): Promise<WeeklyMealPlan>;
  updateDailyPlan(planId: string, day: DailyMealPlan): Promise<WeeklyMealPlan>;
  confirmWeeklyPlan(planId: string): Promise<{ plan: WeeklyMealPlan; shoppingList: ShoppingList }>;

  // Shopping List
  regenerateShoppingList(weeklyPlanId: string, includeUnconfirmed?: boolean): Promise<ShoppingList>;
  upsertShoppingItem(listId: string, item: ShoppingListItem): Promise<ShoppingList>;
  deleteShoppingItem(listId: string, itemId: string): Promise<ShoppingList>;
}

function loadFromStorage(): RhythmAppData {
  if (typeof window === 'undefined') {
    return buildInitialMockData();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = buildInitialMockData();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as Partial<RhythmAppData>;
    if (
      !parsed.exercises ||
      !parsed.workoutPrograms ||
      !parsed.workoutSessions ||
      !parsed.notificationPreferences ||
      !parsed.calendarSyncPreferences
    ) {
      const workoutDefaults = buildInitialWorkoutMockData();
      const defaultNotif = buildDefaultNotificationPreferences();
      const defaultSync = buildDefaultCalendarSyncPreferences();
      const hydrated: RhythmAppData = {
        ...(buildInitialMockData()),
        ...parsed,
        exerciseCategories: parsed.exerciseCategories ?? workoutDefaults.exerciseCategories,
        exercises: parsed.exercises ?? workoutDefaults.exercises,
        metReferenceTable: parsed.metReferenceTable ?? workoutDefaults.metReferenceTable,
        workoutPrograms: parsed.workoutPrograms ?? workoutDefaults.workoutPrograms,
        workoutTemplates: parsed.workoutTemplates ?? workoutDefaults.workoutTemplates,
        workoutSessions: parsed.workoutSessions ?? workoutDefaults.workoutSessions,
        workoutActivityLogs: parsed.workoutActivityLogs ?? workoutDefaults.workoutActivityLogs,
        workoutPreferences: parsed.workoutPreferences ?? workoutDefaults.workoutPreferences,
        notificationPreferences: parsed.notificationPreferences ?? defaultNotif,
        calendarSyncPreferences: parsed.calendarSyncPreferences ?? defaultSync,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(hydrated));
      return hydrated;
    }
    return parsed as RhythmAppData;
  } catch {
    return buildInitialMockData();
  }
}

function saveToStorage(data: RhythmAppData): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors in demo mode
  }
}

export class MockRhythmRepository implements IRhythmRepository {
  private state: RhythmAppData;

  constructor() {
    this.state = loadFromStorage();
  }

  private persist(): void {
    saveToStorage(this.state);
  }

  async getAllData(): Promise<RhythmAppData> {
    this.state = loadFromStorage();
    return structuredClone(this.state);
  }

  async resetDemoData(): Promise<RhythmAppData> {
    this.state = buildInitialMockData();
    this.persist();
    return structuredClone(this.state);
  }

  async updateProfile(profile: UserProfile): Promise<UserProfile> {
    this.state.profile = { ...profile, updatedAt: new Date().toISOString() };
    this.persist();
    return structuredClone(this.state.profile);
  }

  async updateNutritionTarget(target: NutritionTarget): Promise<NutritionTarget> {
    this.state.target = { ...target, updatedAt: new Date().toISOString() };
    this.persist();
    return structuredClone(this.state.target);
  }

  async updateNutritionPreferences(prefs: NutritionPreferences): Promise<NutritionPreferences> {
    this.state.preferences = { ...prefs, updatedAt: new Date().toISOString() };
    this.persist();
    return structuredClone(this.state.preferences);
  }

  async updateAgentPreferences(prefs: AgentPreferences): Promise<AgentPreferences> {
    this.state.agentPreferences = { ...prefs, updatedAt: new Date().toISOString() };
    this.persist();
    return structuredClone(this.state.agentPreferences);
  }

  async upsertRecipe(recipe: Recipe): Promise<Recipe> {
    const now = new Date().toISOString();
    const idx = this.state.recipes.findIndex((r) => r.id === recipe.id);
    if (idx >= 0) {
      const updated = { ...recipe, version: recipe.version + 1, updatedAt: now };
      this.state.recipes[idx] = updated;
      this.persist();
      return structuredClone(updated);
    }
    const created = { ...recipe, id: recipe.id || generateId('rec'), createdAt: now, updatedAt: now };
    this.state.recipes.unshift(created);
    this.persist();
    return structuredClone(created);
  }

  async deleteRecipe(recipeId: string): Promise<void> {
    this.state.recipes = this.state.recipes.filter((r) => r.id !== recipeId);
    this.persist();
  }

  async upsertIngredient(ingredient: Ingredient): Promise<Ingredient> {
    const now = new Date().toISOString();
    const idx = this.state.ingredients.findIndex((i) => i.id === ingredient.id);
    if (idx >= 0) {
      const updated = { ...ingredient, updatedAt: now };
      this.state.ingredients[idx] = updated;
      this.persist();
      return structuredClone(updated);
    }
    const created = {
      ...ingredient,
      id: ingredient.id || generateId('ing'),
      createdAt: now,
      updatedAt: now,
    };
    this.state.ingredients.unshift(created);
    this.persist();
    return structuredClone(created);
  }

  async deleteIngredient(ingredientId: string): Promise<void> {
    this.state.ingredients = this.state.ingredients.filter((i) => i.id !== ingredientId);
    this.persist();
  }

  async upsertRecipeCategory(category: RecipeCategory): Promise<RecipeCategory> {
    const idx = this.state.recipeCategories.findIndex((c) => c.id === category.id);
    if (idx >= 0) {
      this.state.recipeCategories[idx] = category;
    } else {
      this.state.recipeCategories.push({ ...category, id: category.id || generateId('rec_cat') });
    }
    this.state.recipeCategories.sort((a, b) => a.order - b.order);
    this.persist();
    return structuredClone(category);
  }

  async deleteRecipeCategory(categoryId: string, replacementCategoryId?: string): Promise<void> {
    const dependentCount = this.state.recipes.filter((r) => r.categoryId === categoryId).length;
    if (dependentCount > 0) {
      if (!replacementCategoryId) {
        throw new Error('این دسته‌بندی دارای غذاهای وابسته است و بدون انتخاب دسته جایگزین قابل حذف نیست.');
      }
      this.state.recipes = this.state.recipes.map((r) =>
        r.categoryId === categoryId ? { ...r, categoryId: replacementCategoryId } : r
      );
    }
    this.state.recipeCategories = this.state.recipeCategories.filter((c) => c.id !== categoryId);
    this.persist();
  }

  async upsertShoppingCategory(category: ShoppingCategory): Promise<ShoppingCategory> {
    const idx = this.state.shoppingCategories.findIndex((c) => c.id === category.id);
    if (idx >= 0) {
      this.state.shoppingCategories[idx] = category;
    } else {
      this.state.shoppingCategories.push({ ...category, id: category.id || generateId('shop_cat') });
    }
    this.state.shoppingCategories.sort((a, b) => a.order - b.order);
    this.persist();
    return structuredClone(category);
  }

  async deleteShoppingCategory(categoryId: string, replacementCategoryId?: string): Promise<void> {
    const fallbackId = replacementCategoryId || 'shop_cat_other';
    this.state.ingredients = this.state.ingredients.map((ing) =>
      ing.shoppingCategoryId === categoryId ? { ...ing, shoppingCategoryId: fallbackId } : ing
    );
    this.state.pantry = this.state.pantry.map((p) =>
      p.shoppingCategoryId === categoryId ? { ...p, shoppingCategoryId: fallbackId } : p
    );
    this.state.shoppingLists = this.state.shoppingLists.map((list) => ({
      ...list,
      items: list.items.map((item) =>
        item.categoryId === categoryId ? { ...item, categoryId: fallbackId } : item
      ),
    }));
    this.state.shoppingCategories = this.state.shoppingCategories.filter((c) => c.id !== categoryId);
    this.persist();
  }

  async upsertSupplement(supplement: Supplement): Promise<Supplement> {
    const now = new Date().toISOString();
    const idx = this.state.supplements.findIndex((s) => s.id === supplement.id);
    if (idx >= 0) {
      const updated = { ...supplement, updatedAt: now };
      this.state.supplements[idx] = updated;
      this.persist();
      return structuredClone(updated);
    }
    const created = {
      ...supplement,
      id: supplement.id || generateId('sup'),
      createdAt: now,
      updatedAt: now,
    };
    this.state.supplements.push(created);
    this.persist();
    return structuredClone(created);
  }

  async deleteSupplement(supplementId: string): Promise<void> {
    this.state.supplements = this.state.supplements.filter((s) => s.id !== supplementId);
    this.persist();
  }

  async upsertPantryItem(item: PantryInventory): Promise<PantryInventory> {
    const now = new Date().toISOString();
    const idx = this.state.pantry.findIndex((p) => p.id === item.id);
    if (idx >= 0) {
      const updated = { ...item, updatedAt: now };
      this.state.pantry[idx] = updated;
      this.persist();
      return structuredClone(updated);
    }
    const created = { ...item, id: item.id || generateId('pan'), updatedAt: now };
    this.state.pantry.unshift(created);
    this.persist();
    return structuredClone(created);
  }

  async deletePantryItem(itemId: string): Promise<void> {
    this.state.pantry = this.state.pantry.filter((p) => p.id !== itemId);
    this.persist();
  }

  async adjustPantryQuantity(itemId: string, delta: number): Promise<PantryInventory | null> {
    const idx = this.state.pantry.findIndex((p) => p.id === itemId);
    if (idx < 0) return null;
    const nextQty = Math.max(0, Number((this.state.pantry[idx].quantity + delta).toFixed(2)));
    this.state.pantry[idx] = {
      ...this.state.pantry[idx],
      quantity: nextQty,
      updatedAt: new Date().toISOString(),
    };
    this.persist();
    return structuredClone(this.state.pantry[idx]);
  }

  async startOrResumePlanningSession(weekType: 'CURRENT' | 'NEXT'): Promise<PlanningSession> {
    const refISO = '2026-11-19';
    const range =
      weekType === 'NEXT'
        ? getNextSaturdayToFridayWeekRange(refISO)
        : getSaturdayToFridayWeekRange(refISO);

    const existingPlan = this.state.weeklyPlans.find((p) => p.weekStartISO === range.weekStartISO);
    const session: PlanningSession = {
      id: generateId('psess'),
      targetWeekStartISO: range.weekStartISO,
      targetWeekEndISO: range.weekEndISO,
      currentStep: existingPlan ? 3 : 1,
      activeDayIndex: 0,
      weeklyPlanId: existingPlan?.id,
      isActive: true,
      updatedAt: new Date().toISOString(),
    };
    this.state.planningSession = session;
    this.persist();
    return structuredClone(session);
  }

  async updatePlanningSession(session: PlanningSession | null): Promise<PlanningSession | null> {
    this.state.planningSession = session
      ? { ...session, updatedAt: new Date().toISOString() }
      : null;
    this.persist();
    return structuredClone(this.state.planningSession);
  }

  async generateWeeklyPlan(weekStartISO: string): Promise<WeeklyMealPlan> {
    const range = getSaturdayToFridayWeekRange(weekStartISO);
    const generated = generateMockWeeklyPlan({
      weekStartISO: range.weekStartISO,
      weekEndISO: range.weekEndISO,
      dayDatesISO: range.dayDatesISO,
      recipes: this.state.recipes,
      ingredients: this.state.ingredients,
      foodItems: this.state.foodItems,
      supplements: this.state.supplements,
      pantry: this.state.pantry,
      target: this.state.target,
      preferences: this.state.preferences,
      agentPreferences: this.state.agentPreferences,
    });

    const existingIdx = this.state.weeklyPlans.findIndex(
      (p) => p.weekStartISO === range.weekStartISO
    );
    if (existingIdx >= 0) {
      generated.id = this.state.weeklyPlans[existingIdx].id;
      generated.version = this.state.weeklyPlans[existingIdx].version + 1;
      generated.snapshots = this.state.weeklyPlans[existingIdx].snapshots;
      this.state.weeklyPlans[existingIdx] = generated;
    } else {
      this.state.weeklyPlans.unshift(generated);
    }

    if (this.state.planningSession) {
      this.state.planningSession = {
        ...this.state.planningSession,
        weeklyPlanId: generated.id,
        currentStep: 3,
        activeDayIndex: 0,
        updatedAt: new Date().toISOString(),
      };
    }

    this.persist();
    return structuredClone(generated);
  }

  async updateWeeklyPlan(plan: WeeklyMealPlan): Promise<WeeklyMealPlan> {
    const idx = this.state.weeklyPlans.findIndex((p) => p.id === plan.id);
    const updated = { ...plan, updatedAt: new Date().toISOString() };
    if (idx >= 0) {
      this.state.weeklyPlans[idx] = updated;
    } else {
      this.state.weeklyPlans.unshift(updated);
    }
    this.persist();
    return structuredClone(updated);
  }

  async updateDailyPlan(planId: string, day: DailyMealPlan): Promise<WeeklyMealPlan> {
    const planIdx = this.state.weeklyPlans.findIndex((p) => p.id === planId);
    if (planIdx < 0) throw new Error('برنامه هفتگی یافت نشد');

    const plan = this.state.weeklyPlans[planIdx];
    const nextDays = plan.days.map((d) =>
      d.dayIndex === day.dayIndex ? { ...day, updatedAt: new Date().toISOString() } : d
    );

    const allConfirmed = nextDays.every((d) => d.status === DailyPlanStatus.CONFIRMED);
    const nextStatus = allConfirmed
      ? plan.status === WeeklyPlanStatus.CONFIRMED
        ? WeeklyPlanStatus.CONFIRMED
        : WeeklyPlanStatus.REVIEWING
      : WeeklyPlanStatus.REVIEWING;

    const updatedPlan: WeeklyMealPlan = {
      ...plan,
      days: nextDays,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };

    this.state.weeklyPlans[planIdx] = updatedPlan;
    this.persist();
    return structuredClone(updatedPlan);
  }

  async confirmWeeklyPlan(
    planId: string
  ): Promise<{ plan: WeeklyMealPlan; shoppingList: ShoppingList }> {
    const planIdx = this.state.weeklyPlans.findIndex((p) => p.id === planId);
    if (planIdx < 0) throw new Error('برنامه هفتگی یافت نشد');

    const plan = this.state.weeklyPlans[planIdx];
    const allConfirmed = plan.days.every((d) => d.status === DailyPlanStatus.CONFIRMED);
    if (!allConfirmed) {
      throw new Error('همه روزهای هفته هنوز تأیید نشده‌اند.');
    }

    const ingredientsById = Object.fromEntries(this.state.ingredients.map((i) => [i.id, i]));
    const recipesById = Object.fromEntries(this.state.recipes.map((r) => [r.id, r]));
    const foodItemsById = Object.fromEntries(this.state.foodItems.map((f) => [f.id, f]));

    const summary = calculateWeeklyNutritionSummary(
      plan.days,
      { ingredientsById, recipesById, foodItemsById },
      this.state.target
    );

    const nextVersion = plan.version + 1;
    const nowISO = new Date().toISOString();

    const snapshot = {
      version: nextVersion,
      confirmedAt: nowISO,
      averageCalories: summary.averageCalories,
      averageProtein: summary.averageProtein,
      totalMealsCount: plan.days.reduce((s, d) => s + d.meals.length, 0),
      daysSummary: summary.dailyBreakdowns.map((d) => ({
        dayIndex: d.dayIndex,
        dateISO: d.dateISO,
        calories: Math.round(d.nutrition.calories),
        protein: Math.round(d.nutrition.protein),
        status: d.status,
      })),
    };

    const confirmedPlan: WeeklyMealPlan = {
      ...plan,
      status: WeeklyPlanStatus.CONFIRMED,
      version: nextVersion,
      snapshots: [snapshot, ...plan.snapshots],
      updatedAt: nowISO,
    };

    this.state.weeklyPlans[planIdx] = confirmedPlan;

    // Generate or synchronize shopping list without mutating pantry inventory
    const existingList = this.state.shoppingLists.find(
      (l) => l.weeklyPlanId === confirmedPlan.id || l.weekStartISO === confirmedPlan.weekStartISO
    );

    const shoppingList = generateShoppingListFromPlan({
      weeklyPlan: confirmedPlan,
      recipesById,
      ingredientsById,
      pantry: this.state.pantry,
      existingShoppingList: existingList,
      includeUnconfirmedDays: false,
    });

    const listIdx = this.state.shoppingLists.findIndex((l) => l.id === shoppingList.id);
    if (listIdx >= 0) {
      this.state.shoppingLists[listIdx] = shoppingList;
    } else {
      this.state.shoppingLists.unshift(shoppingList);
    }

    if (this.state.planningSession?.weeklyPlanId === confirmedPlan.id) {
      this.state.planningSession = {
        ...this.state.planningSession,
        currentStep: 6,
        updatedAt: nowISO,
      };
    }

    this.persist();
    return {
      plan: structuredClone(confirmedPlan),
      shoppingList: structuredClone(shoppingList),
    };
  }

  async regenerateShoppingList(
    weeklyPlanId: string,
    includeUnconfirmed = false
  ): Promise<ShoppingList> {
    const plan = this.state.weeklyPlans.find((p) => p.id === weeklyPlanId);
    if (!plan) throw new Error('برنامه هفتگی برای تولید لیست خرید یافت نشد');

    const ingredientsById = Object.fromEntries(this.state.ingredients.map((i) => [i.id, i]));
    const recipesById = Object.fromEntries(this.state.recipes.map((r) => [r.id, r]));

    const existingList = this.state.shoppingLists.find(
      (l) => l.weeklyPlanId === plan.id || l.weekStartISO === plan.weekStartISO
    );

    const updatedList = generateShoppingListFromPlan({
      weeklyPlan: plan,
      recipesById,
      ingredientsById,
      pantry: this.state.pantry,
      existingShoppingList: existingList,
      includeUnconfirmedDays: includeUnconfirmed,
    });

    const idx = this.state.shoppingLists.findIndex((l) => l.id === updatedList.id);
    if (idx >= 0) {
      this.state.shoppingLists[idx] = updatedList;
    } else {
      this.state.shoppingLists.unshift(updatedList);
    }

    this.persist();
    return structuredClone(updatedList);
  }

  async upsertShoppingItem(listId: string, item: ShoppingListItem): Promise<ShoppingList> {
    const listIdx = this.state.shoppingLists.findIndex((l) => l.id === listId);
    if (listIdx < 0) throw new Error('لیست خرید یافت نشد');

    const list = this.state.shoppingLists[listIdx];
    const itemIdx = list.items.findIndex((i) => i.id === item.id);
    const nextItems = [...list.items];
    if (itemIdx >= 0) {
      nextItems[itemIdx] = { ...item, updatedAt: new Date().toISOString() };
    } else {
      nextItems.unshift({ ...item, id: item.id || generateId('shop'), updatedAt: new Date().toISOString() });
    }

    const updatedList: ShoppingList = {
      ...list,
      items: nextItems,
      updatedAt: new Date().toISOString(),
    };
    this.state.shoppingLists[listIdx] = updatedList;
    this.persist();
    return structuredClone(updatedList);
  }

  async deleteShoppingItem(listId: string, itemId: string): Promise<ShoppingList> {
    const listIdx = this.state.shoppingLists.findIndex((l) => l.id === listId);
    if (listIdx < 0) throw new Error('لیست خرید یافت نشد');

    const list = this.state.shoppingLists[listIdx];
    const updatedList: ShoppingList = {
      ...list,
      items: list.items.filter((i) => i.id !== itemId),
      updatedAt: new Date().toISOString(),
    };
    this.state.shoppingLists[listIdx] = updatedList;
    this.persist();
    return structuredClone(updatedList);
  }

  // ========================
  // Workout Module Operations
  // ========================

  async upsertExercise(exercise: Exercise): Promise<Exercise> {
    const now = new Date().toISOString();
    const idx = this.state.exercises.findIndex((e) => e.id === exercise.id);
    if (idx >= 0) {
      const updated = { ...exercise, updatedAt: now };
      this.state.exercises[idx] = updated;
      this.persist();
      return structuredClone(updated);
    }
    const created: Exercise = {
      ...exercise,
      id: exercise.id || generateId('ex'),
      createdAt: now,
      updatedAt: now,
    };
    this.state.exercises.unshift(created);
    this.persist();
    return structuredClone(created);
  }

  async deleteExercise(exerciseId: string): Promise<void> {
    this.state.exercises = this.state.exercises.filter((e) => e.id !== exerciseId);
    this.persist();
  }

  async saveWorkoutProgramWithTemplates(
    program: WorkoutProgram,
    templates: WorkoutTemplate[]
  ): Promise<{ program: WorkoutProgram; templates: WorkoutTemplate[] }> {
    const now = new Date().toISOString();
    const programId = program.id || generateId('wprog');

    const savedTemplates: WorkoutTemplate[] = templates.map((tpl) => ({
      ...tpl,
      id: tpl.id || generateId('wtpl'),
      programId,
      createdAt: tpl.createdAt || now,
      updatedAt: now,
    }));

    const templateIds = savedTemplates.map((t) => t.id);
    const savedProgram: WorkoutProgram = {
      ...program,
      id: programId,
      templateIds,
      createdAt: program.createdAt || now,
      updatedAt: now,
    };

    const progIdx = this.state.workoutPrograms.findIndex((p) => p.id === programId);
    if (progIdx >= 0) {
      this.state.workoutPrograms[progIdx] = savedProgram;
    } else {
      this.state.workoutPrograms.unshift(savedProgram);
    }

    // Replace templates belonging to this program without altering scheduled sessions (strict template/session separation)
    const otherTemplates = this.state.workoutTemplates.filter((t) => t.programId !== programId);
    this.state.workoutTemplates = [...savedTemplates, ...otherTemplates];

    this.persist();
    return {
      program: structuredClone(savedProgram),
      templates: structuredClone(savedTemplates),
    };
  }

  async duplicateWorkoutProgram(programId: string): Promise<WorkoutProgram> {
    const source = this.state.workoutPrograms.find((p) => p.id === programId);
    if (!source) throw new Error('برنامه ورزشی یافت نشد');
    const now = new Date().toISOString();
    const newProgId = generateId('wprog');
    const sourceTemplates = this.state.workoutTemplates.filter((t) => t.programId === programId);

    const clonedTemplates: WorkoutTemplate[] = sourceTemplates.map((tpl) => ({
      ...structuredClone(tpl),
      id: generateId('wtpl'),
      programId: newProgId,
      createdAt: now,
      updatedAt: now,
    }));

    const clonedProgram: WorkoutProgram = {
      ...structuredClone(source),
      id: newProgId,
      title: `${source.title} (کپی)`,
      templateIds: clonedTemplates.map((t) => t.id),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    this.state.workoutPrograms.unshift(clonedProgram);
    this.state.workoutTemplates = [...clonedTemplates, ...this.state.workoutTemplates];
    this.persist();
    return structuredClone(clonedProgram);
  }

  async toggleWorkoutProgramActive(programId: string, isActive: boolean): Promise<WorkoutProgram> {
    const idx = this.state.workoutPrograms.findIndex((p) => p.id === programId);
    if (idx < 0) throw new Error('برنامه ورزشی یافت نشد');
    const updated: WorkoutProgram = {
      ...this.state.workoutPrograms[idx],
      isActive,
      updatedAt: new Date().toISOString(),
    };
    this.state.workoutPrograms[idx] = updated;
    this.persist();
    return structuredClone(updated);
  }

  async deleteWorkoutProgram(programId: string): Promise<void> {
    this.state.workoutPrograms = this.state.workoutPrograms.filter((p) => p.id !== programId);
    this.state.workoutTemplates = this.state.workoutTemplates.filter((t) => t.programId !== programId);
    this.persist();
  }

  async upsertWorkoutSession(session: WorkoutSession): Promise<WorkoutSession> {
    const now = new Date().toISOString();
    const normalized: WorkoutSession = {
      ...session,
      dayIndex: getPersianDayIndexFromISO(session.dateISO),
      updatedAt: now,
    };
    const idx = this.state.workoutSessions.findIndex((s) => s.id === normalized.id);
    if (idx >= 0) {
      this.state.workoutSessions[idx] = normalized;
    } else {
      normalized.id = normalized.id || generateId('ws');
      normalized.createdAt = normalized.createdAt || now;
      this.state.workoutSessions.push(normalized);
    }
    this.persist();
    return structuredClone(normalized);
  }

  async deleteWorkoutSession(sessionId: string): Promise<void> {
    this.state.workoutSessions = this.state.workoutSessions.filter((s) => s.id !== sessionId);
    this.persist();
  }

  async generateWeeklyWorkoutSessions(params: {
    weekStartISO: string;
    programId: string;
    preferredDays?: number[];
    defaultStartTime?: string;
  }): Promise<WorkoutSession[]> {
    const program = this.state.workoutPrograms.find((p) => p.id === params.programId);
    if (!program) throw new Error('برنامه ورزشی انتخاب‌شده یافت نشد');

    const templates = this.state.workoutTemplates.filter((t) => t.programId === program.id);
    if (templates.length === 0) throw new Error('برای این برنامه هنوز جلسه‌ای تعریف نشده است');

    const range = getSaturdayToFridayWeekRange(params.weekStartISO);
    const defaultDays =
      params.preferredDays && params.preferredDays.length > 0
        ? params.preferredDays
        : [0, 2, 4, 5, 1, 3, 6].slice(0, program.sessionsPerWeek);

    const startTime = params.defaultStartTime ?? this.state.workoutPreferences.preferredTimeStart ?? '17:30';
    const startMinutes = timeToMinutes(startTime);
    const now = new Date().toISOString();

    const createdSessions: WorkoutSession[] = [];

    for (let i = 0; i < Math.min(program.sessionsPerWeek, 7); i += 1) {
      const dayIdx = defaultDays[i % defaultDays.length];
      const dateISO = range.dayDatesISO[dayIdx];
      const tpl = templates[i % templates.length];

      // Avoid duplicating the exact same template on the same date if already planned
      const alreadyExists = this.state.workoutSessions.some(
        (s) =>
          s.dateISO === dateISO &&
          s.templateId === tpl.id &&
          s.status !== WorkoutSessionStatus.CANCELLED
      );
      if (alreadyExists) continue;

      const endTime = minutesToTime(startMinutes + tpl.estimatedDurationMinutes);
      const session: WorkoutSession = {
        id: generateId('ws'),
        programId: program.id,
        templateId: tpl.id,
        title: tpl.title,
        type: tpl.type,
        dateISO,
        dayIndex: dayIdx,
        startTime,
        endTime,
        estimatedDurationMinutes: tpl.estimatedDurationMinutes,
        status: WorkoutSessionStatus.PLANNED,
        reminderEnabled: true,
        exercises: templateExercisesToSessionExercises(tpl.exercises),
        createdAt: now,
        updatedAt: now,
      };
      this.state.workoutSessions.push(session);
      createdSessions.push(session);
    }

    this.persist();
    return structuredClone(createdSessions);
  }

  async saveWorkoutActivityLog(
    log: WorkoutActivityLog,
    nextSessionStatus?: WorkoutSession['status'],
    updatedExercises?: WorkoutSession['exercises']
  ): Promise<WorkoutActivityLog> {
    const now = new Date().toISOString();
    const savedLog: WorkoutActivityLog = {
      ...log,
      id: log.id || generateId('wlog'),
      updatedAt: now,
    };

    const logIdx = this.state.workoutActivityLogs.findIndex(
      (l) => l.id === savedLog.id || l.sessionId === savedLog.sessionId
    );
    if (logIdx >= 0) {
      this.state.workoutActivityLogs[logIdx] = savedLog;
    } else {
      this.state.workoutActivityLogs.unshift(savedLog);
    }

    const sessionIdx = this.state.workoutSessions.findIndex((s) => s.id === savedLog.sessionId);
    if (sessionIdx >= 0) {
      this.state.workoutSessions[sessionIdx] = {
        ...this.state.workoutSessions[sessionIdx],
        status: nextSessionStatus ?? this.state.workoutSessions[sessionIdx].status,
        exercises: updatedExercises ?? this.state.workoutSessions[sessionIdx].exercises,
        updatedAt: now,
      };
    }

    this.persist();
    return structuredClone(savedLog);
  }

  async updateWorkoutPreferences(prefs: WorkoutPreferences): Promise<WorkoutPreferences> {
    const updated: WorkoutPreferences = {
      ...prefs,
      updatedAt: new Date().toISOString(),
    };
    this.state.workoutPreferences = updated;
    this.persist();
    return structuredClone(updated);
  }

  async updateMetReferenceTable(entries: MetReferenceEntry[]): Promise<MetReferenceEntry[]> {
    this.state.metReferenceTable = structuredClone(entries);
    this.persist();
    return structuredClone(this.state.metReferenceTable);
  }

  // ========================
  // Integrated Calendar Operations
  // ========================

  async getCalendarEvents(weekStartISO: string): Promise<RhythmCalendarEvent[]> {
    this.state = loadFromStorage();
    return buildIntegratedWeekCalendarEvents(this.state, weekStartISO);
  }

  async getNotificationPreferences(): Promise<CalendarNotificationPreferences> {
    this.state = loadFromStorage();
    return structuredClone(this.state.notificationPreferences);
  }

  async updateNotificationPreferences(
    prefs: CalendarNotificationPreferences
  ): Promise<CalendarNotificationPreferences> {
    const updated: CalendarNotificationPreferences = {
      ...structuredClone(prefs),
      updatedAt: new Date().toISOString(),
    };
    this.state.notificationPreferences = updated;
    this.persist();
    return structuredClone(updated);
  }

  async getCalendarSyncPreferences(): Promise<CalendarSyncPreferences> {
    this.state = loadFromStorage();
    return structuredClone(this.state.calendarSyncPreferences);
  }

  async updateCalendarSyncPreferences(
    prefs: CalendarSyncPreferences
  ): Promise<CalendarSyncPreferences> {
    const updated: CalendarSyncPreferences = {
      ...structuredClone(prefs),
      updatedAt: new Date().toISOString(),
    };
    this.state.calendarSyncPreferences = updated;
    this.persist();
    return structuredClone(updated);
  }

  async previewCalendarSync(weekStartISO: string): Promise<CalendarSyncPreviewResult> {
    this.state = loadFromStorage();
    const events = buildIntegratedWeekCalendarEvents(this.state, weekStartISO);
    return buildCalendarSyncPreview(
      events,
      this.state.calendarSyncPreferences,
      this.state.weeklyPlans
    );
  }
}

export const rhythmRepository: IRhythmRepository = new MockRhythmRepository();
export type { MealIngredientOverride };
