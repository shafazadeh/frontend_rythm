import type {
  CalendarNotificationPreferences,
  CalendarSyncPreferences,
} from './calendar';
import type {
  Exercise,
  ExerciseCategory,
  MetReferenceEntry,
  WorkoutActivityLog,
  WorkoutPreferences,
  WorkoutProgram,
  WorkoutSession,
  WorkoutTemplate,
} from './workout';

export type EntityId = string;
export type ISODateString = string; // YYYY-MM-DD or full ISO timestamp

export enum UnitType {
  GRAM = 'g',
  KILOGRAM = 'kg',
  MILLILITER = 'ml',
  LITER = 'l',
  PIECE = 'piece',
  TABLESPOON = 'tbsp',
  TEASPOON = 'tsp',
  CUP = 'cup',
  SLICE = 'slice',
  PACK = 'pack',
}

export enum MealSlotType {
  BREAKFAST = 'BREAKFAST',
  MORNING_SNACK = 'MORNING_SNACK',
  LUNCH = 'LUNCH',
  AFTERNOON_SNACK = 'AFTERNOON_SNACK',
  DINNER = 'DINNER',
}

export enum WeeklyPlanStatus {
  DRAFT = 'DRAFT',
  REVIEWING = 'REVIEWING',
  CONFIRMED = 'CONFIRMED',
  ARCHIVED = 'ARCHIVED',
}

export enum DailyPlanStatus {
  UNPLANNED = 'UNPLANNED',
  DRAFT = 'DRAFT',
  IN_REVIEW = 'IN_REVIEW',
  CONFIRMED = 'CONFIRMED',
}

export enum ActivityLevel {
  SEDENTARY = 'SEDENTARY',
  LIGHT = 'LIGHT',
  MODERATE = 'MODERATE',
  ACTIVE = 'ACTIVE',
  VERY_ACTIVE = 'VERY_ACTIVE',
}

export enum SexForCalculation {
  FEMALE = 'FEMALE',
  MALE = 'MALE',
}

export enum AllergenType {
  DAIRY = 'DAIRY',
  GLUTEN = 'GLUTEN',
  NUTS = 'NUTS',
  EGGS = 'EGGS',
  SEAFOOD = 'SEAFOOD',
  SOY = 'SOY',
  SESAME = 'SESAME',
}

export enum PlanningStyle {
  BALANCED = 'BALANCED',
  HIGH_PROTEIN = 'HIGH_PROTEIN',
  BUDGET_FRIENDLY = 'BUDGET_FRIENDLY',
  QUICK_PREP = 'QUICK_PREP',
}

export enum VarietyLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum BudgetLevel {
  ECONOMIC = 'ECONOMIC',
  MODERATE = 'MODERATE',
  FLEXIBLE = 'FLEXIBLE',
}

export interface NutritionValues {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
}

export interface NutritionSummary extends NutritionValues {
  hasIncompleteData: boolean;
  incompleteReason?: string;
}

export interface UserProfile {
  id: EntityId;
  displayName: string;
  age: number;
  heightCm: number;
  weightKg: number;
  sexForCalculation: SexForCalculation;
  activityLevel: ActivityLevel;
  timezone: string; // Default: Asia/Tehran
  hasSpecialMedicalCondition: boolean;
  avatarUrl?: string;
  updatedAt: ISODateString;
}

export interface NutritionTarget {
  dailyCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams?: number;
  mealsPerDay: number;
  updatedAt: ISODateString;
}

export interface MealTimingPreference {
  slot: MealSlotType;
  label: string;
  defaultTime: string; // 24h HH:mm
  enabled: boolean;
}

export interface NutritionPreferences {
  favoriteRecipeIds: EntityId[];
  dislikedRecipeIds: EntityId[];
  allergies: AllergenType[];
  dietaryRestrictions: string[];
  dislikedIngredientIds: EntityId[];
  mealTimings: MealTimingPreference[];
  varietyPreference: VarietyLevel;
  updatedAt: ISODateString;
}

export interface IngredientCategory {
  id: EntityId;
  name: string;
  description?: string;
  color: string;
  icon: string;
  order: number;
  isActive: boolean;
}

export interface Ingredient {
  id: EntityId;
  name: string;
  categoryId: EntityId;
  shoppingCategoryId: EntityId;
  defaultUnit: UnitType;
  referenceAmount: number; // e.g., 100 for 100g or 1 for 1 piece
  referenceUnit: UnitType;
  gramsPerUnit?: number; // optional conversion helper for piece/tbsp/cup -> g
  nutritionPerReference?: NutritionValues; // undefined => incomplete data
  allergens: AllergenType[];
  compatibleSubstituteIds: EntityId[];
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface RecipeCategory {
  id: EntityId;
  name: string;
  description?: string;
  color: string;
  icon: string;
  order: number;
  isActive: boolean;
}

export interface RecipeIngredient {
  id: EntityId;
  ingredientId: EntityId;
  amount: number;
  unit: UnitType;
  notes?: string;
  isOptional?: boolean;
}

export interface RecipeStep {
  id: EntityId;
  stepNumber: number;
  instruction: string;
}

export interface Recipe {
  id: EntityId;
  name: string;
  categoryId: EntityId;
  description?: string;
  imageUrl?: string;
  servings: number;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  manualNutritionPerServing?: NutritionValues;
  useManualNutrition: boolean;
  tags: string[];
  suitableSlots: MealSlotType[];
  allergens: AllergenType[];
  isFavorite: boolean;
  isDisliked: boolean;
  isActive: boolean;
  notes?: string;
  version: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface FoodItem {
  id: EntityId;
  name: string;
  category: 'FRUIT' | 'NUTS_SEEDS' | 'DAIRY_SNACK' | 'HEALTHY_SNACK';
  servingSize: number;
  unit: UnitType;
  nutritionPerServing?: NutritionValues;
  allergens: AllergenType[];
  isActive: boolean;
}

export interface Supplement {
  id: EntityId;
  name: string;
  form: string; // کپسول، قرص، پودر، قطره...
  dosageAmount?: number;
  dosageUnit?: string;
  activeDays: number[]; // 0 = Saturday .. 6 = Friday
  timeOfDay?: string; // HH:mm 24h
  linkedMealSlot?: MealSlotType;
  doctorOrPharmacistNote?: string;
  userNote?: string;
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface SupplementSchedule {
  id: EntityId;
  supplementId: EntityId;
  dayIndex: number; // 0..6
  isTaken: boolean;
  takenAt?: ISODateString;
}

export interface MealIngredientOverride {
  originalIngredientId: EntityId;
  replacementIngredientId: EntityId;
  amount: number;
  unit: UnitType;
  isConfirmedByUser: boolean;
  compatibilityWarning?: string;
}

export interface MealItem {
  id: EntityId;
  kind: 'RECIPE' | 'FOOD_ITEM';
  recipeId?: EntityId;
  foodItemId?: EntityId;
  portionMultiplier: number; // for RECIPE (default 1 = 1 serving)
  amount?: number; // for FOOD_ITEM
  unit?: UnitType;
  ingredientOverrides: MealIngredientOverride[];
  confirmedIngredientIds: EntityId[]; // original or overridden ingredient ids confirmed in daily review
}

export interface Meal {
  id: EntityId;
  slot: MealSlotType;
  label: string;
  suggestedTime: string; // HH:mm
  items: MealItem[];
  isConfirmed: boolean;
}

export interface DailyMealPlan {
  id: EntityId;
  dayIndex: number; // 0 = Saturday .. 6 = Friday
  dateISO: string; // YYYY-MM-DD
  status: DailyPlanStatus;
  meals: Meal[];
  supplementSchedules: SupplementSchedule[];
  notes?: string;
  updatedAt: ISODateString;
}

export interface WeeklyPlanSnapshot {
  version: number;
  confirmedAt: ISODateString;
  averageCalories: number;
  averageProtein: number;
  totalMealsCount: number;
  daysSummary: Array<{
    dayIndex: number;
    dateISO: string;
    calories: number;
    protein: number;
    status: DailyPlanStatus;
  }>;
}

export interface WeeklyMealPlan {
  id: EntityId;
  weekStartISO: string; // Saturday YYYY-MM-DD
  weekEndISO: string; // Friday YYYY-MM-DD
  status: WeeklyPlanStatus;
  days: DailyMealPlan[];
  warnings: string[];
  version: number;
  snapshots: WeeklyPlanSnapshot[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface PantryInventory {
  id: EntityId;
  ingredientId: EntityId;
  customName?: string;
  quantity: number;
  unit: UnitType;
  shoppingCategoryId: EntityId;
  expiryDateISO?: string;
  lowStockThreshold?: number;
  note?: string;
  updatedAt: ISODateString;
}

export interface ShoppingCategory {
  id: EntityId;
  title: string;
  color: string;
  icon: string;
  order: number;
  isActive: boolean;
}

export interface ShoppingListItem {
  id: EntityId;
  ingredientId?: EntityId;
  name: string;
  requiredQuantity: number;
  pantryQuantity: number;
  suggestedBuyQuantity: number;
  unit: UnitType;
  categoryId: EntityId;
  isChecked: boolean;
  source: 'AUTO' | 'MANUAL';
  needsUnitReview?: boolean;
  unitReviewMessage?: string;
  note?: string;
  updatedAt: ISODateString;
}

export interface ShoppingList {
  id: EntityId;
  weeklyPlanId?: EntityId;
  weekStartISO: string;
  weekEndISO: string;
  items: ShoppingListItem[];
  lastGeneratedAt: ISODateString;
  updatedAt: ISODateString;
}

export interface PlanningReminderConfig {
  enabled: boolean;
  dayOfWeek: number; // 5 = Thursday (in Sat=0..Fri=6 index)
  time24h: string; // "10:00"
}

export interface AgentPreferences {
  planningStyle: PlanningStyle;
  varietyLevel: VarietyLevel;
  preferQuickMeals: boolean;
  budgetLevel: BudgetLevel;
  prioritizePantry: boolean;
  forbiddenFoodNotes: string;
  maxRecipeRepeatsPerWeek: number;
  customInstructions: string;
  reminderConfig: PlanningReminderConfig;
  updatedAt: ISODateString;
}

export interface PlanningSession {
  id: EntityId;
  targetWeekStartISO: string;
  targetWeekEndISO: string;
  currentStep: 1 | 2 | 3 | 4 | 5 | 6;
  activeDayIndex: number; // 0..6
  weeklyPlanId?: EntityId;
  isActive: boolean;
  updatedAt: ISODateString;
}

export interface RhythmAppData {
  profile: UserProfile;
  target: NutritionTarget;
  preferences: NutritionPreferences;
  ingredientCategories: IngredientCategory[];
  ingredients: Ingredient[];
  recipeCategories: RecipeCategory[];
  recipes: Recipe[];
  foodItems: FoodItem[];
  supplements: Supplement[];
  pantry: PantryInventory[];
  shoppingCategories: ShoppingCategory[];
  weeklyPlans: WeeklyMealPlan[];
  shoppingLists: ShoppingList[];
  agentPreferences: AgentPreferences;
  planningSession: PlanningSession | null;
  // Active Workout Module Collections
  exerciseCategories: ExerciseCategory[];
  exercises: Exercise[];
  metReferenceTable: MetReferenceEntry[];
  workoutPrograms: WorkoutProgram[];
  workoutTemplates: WorkoutTemplate[];
  workoutSessions: WorkoutSession[];
  workoutActivityLogs: WorkoutActivityLog[];
  workoutPreferences: WorkoutPreferences;
  // Integrated Calendar Preferences
  notificationPreferences: CalendarNotificationPreferences;
  calendarSyncPreferences: CalendarSyncPreferences;
}

export type ThemeMode = 'light' | 'dark';

export interface ModuleRegistryItem {
  id: string;
  title: string;
  subtitle?: string;
  basePath: string;
  iconName: string;
  status: 'ACTIVE' | 'COMING_SOON';
  children?: Array<{
    title: string;
    path: string;
  }>;
}
