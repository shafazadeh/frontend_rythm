import {
  ActivityLevel,
  AllergenType,
  BudgetLevel,
  MealSlotType,
  PantryInventory,
  PlanningStyle,
  RhythmAppData,
  SexForCalculation,
  Supplement,
  UnitType,
  VarietyLevel,
} from '../../shared/types/domain';
import { getSaturdayToFridayWeekRange } from '../domain/jalaliCalendar';
import { generateMockWeeklyPlan } from '../domain/mockPlannerEngine';
import { generateShoppingListFromPlan } from '../domain/shoppingAggregator';
import {
  MOCK_INGREDIENT_CATEGORIES,
  MOCK_RECIPE_CATEGORIES,
  MOCK_SHOPPING_CATEGORIES,
} from './mockCategories';
import { MOCK_FOOD_ITEMS } from './mockFoodItems';
import { MOCK_INGREDIENTS } from './mockIngredients';
import { MOCK_RECIPES } from './mockRecipes';
import { buildInitialWorkoutMockData } from './mockWorkouts';
import {
  buildDefaultCalendarSyncPreferences,
  buildDefaultNotificationPreferences,
} from './mockCalendarDefaults';

export function buildInitialMockData(referenceDate = new Date('2026-11-19T10:30:00+03:30')): RhythmAppData {
  const refISO = referenceDate.toISOString().slice(0, 10);
  const currentWeek = getSaturdayToFridayWeekRange(refISO);
  const nowISO = referenceDate.toISOString();

  const profile = {
    id: 'user_1',
    displayName: 'سارا محمدی',
    age: 29,
    heightCm: 167,
    weightKg: 62,
    sexForCalculation: SexForCalculation.FEMALE,
    activityLevel: ActivityLevel.MODERATE,
    timezone: 'Asia/Tehran',
    hasSpecialMedicalCondition: false,
    avatarUrl: '/src/assets/images/avatar_rhythm_user_1795168839003.jpg',
    updatedAt: nowISO,
  };

  const target = {
    dailyCalories: 1950,
    proteinGrams: 105,
    carbsGrams: 220,
    fatGrams: 65,
    fiberGrams: 28,
    mealsPerDay: 5,
    updatedAt: nowISO,
  };

  const preferences = {
    favoriteRecipeIds: ['rec_ghormeh_sabzi', 'rec_joojeh_kabab', 'rec_persian_breakfast', 'rec_caesar_light'],
    dislikedRecipeIds: [],
    allergies: [] as AllergenType[],
    dietaryRestrictions: ['کاهش شکر افزوده'],
    dislikedIngredientIds: [],
    mealTimings: [
      { slot: MealSlotType.BREAKFAST, label: 'صبحانه', defaultTime: '08:00', enabled: true },
      { slot: MealSlotType.MORNING_SNACK, label: 'میان‌وعده صبح', defaultTime: '10:30', enabled: true },
      { slot: MealSlotType.LUNCH, label: 'ناهار', defaultTime: '13:30', enabled: true },
      { slot: MealSlotType.AFTERNOON_SNACK, label: 'میان‌وعده عصر', defaultTime: '17:00', enabled: true },
      { slot: MealSlotType.DINNER, label: 'شام', defaultTime: '20:30', enabled: true },
    ],
    varietyPreference: VarietyLevel.HIGH,
    updatedAt: nowISO,
  };

  const supplements: Supplement[] = [
    {
      id: 'sup_vit_d3',
      name: 'ویتامین D3',
      form: 'کپسول ژلاتینی',
      dosageAmount: 2000,
      dosageUnit: 'IU',
      activeDays: [0, 2, 4, 6],
      timeOfDay: '13:45',
      linkedMealSlot: MealSlotType.LUNCH,
      doctorOrPharmacistNote: 'طبق آزمایش خون اخیر، همراه وعده ناهار مصرف شود.',
      userNote: 'همراه غذای چرب جذب بهتری دارد.',
      isActive: true,
      createdAt: nowISO,
      updatedAt: nowISO,
    },
    {
      id: 'sup_omega3',
      name: 'امگا ۳',
      form: 'سافت‌ژل',
      dosageAmount: 1000,
      dosageUnit: 'mg',
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      timeOfDay: '20:45',
      linkedMealSlot: MealSlotType.DINNER,
      doctorOrPharmacistNote: 'بعد از شام مصرف شود.',
      isActive: true,
      createdAt: nowISO,
      updatedAt: nowISO,
    },
    {
      id: 'sup_magnesium',
      name: 'منیزیم گلایسینات',
      form: 'قرص',
      dosageAmount: 250,
      dosageUnit: 'mg',
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      timeOfDay: '22:00',
      userNote: 'پیش از خواب برای کیفیت استراحت',
      isActive: true,
      createdAt: nowISO,
      updatedAt: nowISO,
    },
    {
      id: 'sup_iron_incomplete',
      name: 'مکمل آهن (ثبت آزمایشی)',
      form: 'قرص',
      dosageAmount: undefined,
      dosageUnit: '',
      activeDays: [1, 3, 5],
      timeOfDay: '',
      userNote: 'نیاز به ثبت مقدار تأییدشده پزشک دارد',
      isActive: true,
      createdAt: nowISO,
      updatedAt: nowISO,
    },
  ];

  const pantry: PantryInventory[] = [
    {
      id: 'pan_rice',
      ingredientId: 'ing_rice_basmati',
      quantity: 1200,
      unit: UnitType.GRAM,
      shoppingCategoryId: 'shop_cat_grains',
      note: 'برنج طارم گیلان',
      updatedAt: nowISO,
    },
    {
      id: 'pan_egg',
      ingredientId: 'ing_egg',
      quantity: 6,
      unit: UnitType.PIECE,
      shoppingCategoryId: 'shop_cat_dairy',
      expiryDateISO: '2026-11-26',
      lowStockThreshold: 4,
      updatedAt: nowISO,
    },
    {
      id: 'pan_olive_oil',
      ingredientId: 'ing_olive_oil',
      quantity: 450,
      unit: UnitType.MILLILITER,
      shoppingCategoryId: 'shop_cat_spices',
      updatedAt: nowISO,
    },
    {
      id: 'pan_lentils',
      ingredientId: 'ing_lentils',
      quantity: 500,
      unit: UnitType.GRAM,
      shoppingCategoryId: 'shop_cat_legumes',
      updatedAt: nowISO,
    },
    {
      id: 'pan_oats',
      ingredientId: 'ing_oats',
      quantity: 350,
      unit: UnitType.GRAM,
      shoppingCategoryId: 'shop_cat_grains',
      lowStockThreshold: 150,
      updatedAt: nowISO,
    },
    {
      id: 'pan_tomato',
      ingredientId: 'ing_tomato',
      quantity: 400,
      unit: UnitType.GRAM,
      shoppingCategoryId: 'shop_cat_produce',
      expiryDateISO: '2026-11-22',
      lowStockThreshold: 300,
      updatedAt: nowISO,
    },
    {
      id: 'pan_onion',
      ingredientId: 'ing_onion',
      quantity: 800,
      unit: UnitType.GRAM,
      shoppingCategoryId: 'shop_cat_produce',
      updatedAt: nowISO,
    },
    {
      id: 'pan_chicken',
      ingredientId: 'ing_chicken_breast',
      quantity: 450,
      unit: UnitType.GRAM,
      shoppingCategoryId: 'shop_cat_protein',
      expiryDateISO: '2026-11-21',
      lowStockThreshold: 500,
      updatedAt: nowISO,
    },
    {
      id: 'pan_walnut',
      ingredientId: 'ing_walnut',
      quantity: 200,
      unit: UnitType.GRAM,
      shoppingCategoryId: 'shop_cat_other',
      updatedAt: nowISO,
    },
    {
      id: 'pan_feta',
      ingredientId: 'ing_feta_cheese',
      quantity: 120,
      unit: UnitType.GRAM,
      shoppingCategoryId: 'shop_cat_dairy',
      expiryDateISO: '2026-11-23',
      updatedAt: nowISO,
    },
    {
      id: 'pan_milk',
      ingredientId: 'ing_milk_lowfat',
      quantity: 500,
      unit: UnitType.MILLILITER,
      shoppingCategoryId: 'shop_cat_dairy',
      expiryDateISO: '2026-11-22',
      lowStockThreshold: 300,
      updatedAt: nowISO,
    },
    {
      id: 'pan_yogurt',
      ingredientId: 'ing_yogurt_greek',
      quantity: 250,
      unit: UnitType.GRAM,
      shoppingCategoryId: 'shop_cat_dairy',
      expiryDateISO: '2026-11-24',
      updatedAt: nowISO,
    },
    {
      id: 'pan_sangak',
      ingredientId: 'ing_sangak_bread',
      quantity: 200,
      unit: UnitType.GRAM,
      shoppingCategoryId: 'shop_cat_grains',
      expiryDateISO: '2026-11-21',
      updatedAt: nowISO,
    },
    {
      id: 'pan_red_beans',
      ingredientId: 'ing_red_beans',
      quantity: 400,
      unit: UnitType.GRAM,
      shoppingCategoryId: 'shop_cat_legumes',
      updatedAt: nowISO,
    },
  ];

  const agentPreferences = {
    planningStyle: PlanningStyle.BALANCED,
    varietyLevel: VarietyLevel.HIGH,
    preferQuickMeals: false,
    budgetLevel: BudgetLevel.MODERATE,
    prioritizePantry: true,
    forbiddenFoodNotes: '',
    maxRecipeRepeatsPerWeek: 2,
    customInstructions:
      'غذاهای سنتی ایرانی در وعده ناهار بیشتر باشند و شام‌ها سبک و سریع آماده شوند.',
    reminderConfig: {
      enabled: true,
      dayOfWeek: 5, // پنج‌شنبه
      time24h: '10:00',
    },
    updatedAt: nowISO,
  };

  // Generate an active current week plan with the first 5 days confirmed and 2 days in review/draft
  const currentPlan = generateMockWeeklyPlan({
    weekStartISO: currentWeek.weekStartISO,
    weekEndISO: currentWeek.weekEndISO,
    dayDatesISO: currentWeek.dayDatesISO,
    recipes: MOCK_RECIPES,
    ingredients: MOCK_INGREDIENTS,
    foodItems: MOCK_FOOD_ITEMS,
    supplements,
    pantry,
    target,
    preferences,
    agentPreferences,
  });

  currentPlan.status = 'REVIEWING' as typeof currentPlan.status;
  currentPlan.days = currentPlan.days.map((day, idx) => {
    if (idx < 4) {
      return {
        ...day,
        status: 'CONFIRMED' as typeof day.status,
        meals: day.meals.map((m) => ({ ...m, isConfirmed: true })),
      };
    }
    if (idx === 4) {
      return {
        ...day,
        status: 'IN_REVIEW' as typeof day.status,
      };
    }
    return day;
  });

  const recipesById = Object.fromEntries(MOCK_RECIPES.map((r) => [r.id, r]));
  const ingredientsById = Object.fromEntries(MOCK_INGREDIENTS.map((i) => [i.id, i]));

  const initialShoppingList = generateShoppingListFromPlan({
    weeklyPlan: currentPlan,
    recipesById,
    ingredientsById,
    pantry,
    includeUnconfirmedDays: true,
  });

  // Add one manual item to showcase manual vs auto distinction
  initialShoppingList.items.push({
    id: 'shop_manual_1',
    name: 'چای سبز کیسه‌ای',
    requiredQuantity: 1,
    pantryQuantity: 0,
    suggestedBuyQuantity: 1,
    unit: UnitType.PACK,
    categoryId: 'shop_cat_other',
    isChecked: false,
    source: 'MANUAL',
    note: 'اضافه‌شده به‌صورت دستی',
    updatedAt: nowISO,
  });

  const workoutInitial = buildInitialWorkoutMockData(referenceDate);
  const notificationPreferences = buildDefaultNotificationPreferences(nowISO);
  const calendarSyncPreferences = buildDefaultCalendarSyncPreferences(nowISO);

  return {
    profile,
    target,
    preferences,
    ingredientCategories: MOCK_INGREDIENT_CATEGORIES,
    ingredients: MOCK_INGREDIENTS,
    recipeCategories: MOCK_RECIPE_CATEGORIES,
    recipes: MOCK_RECIPES,
    foodItems: MOCK_FOOD_ITEMS,
    supplements,
    pantry,
    shoppingCategories: MOCK_SHOPPING_CATEGORIES,
    weeklyPlans: [currentPlan],
    shoppingLists: [initialShoppingList],
    agentPreferences,
    planningSession: null,
    ...workoutInitial,
    notificationPreferences,
    calendarSyncPreferences,
  };
}
