import { MEAL_SLOT_LABELS, MEAL_SLOT_ORDER } from '../../shared/constants/units';
import {
  AgentPreferences,
  DailyMealPlan,
  DailyPlanStatus,
  FoodItem,
  Ingredient,
  Meal,
  MealItem,
  MealSlotType,
  NutritionPreferences,
  NutritionTarget,
  PantryInventory,
  PlanningStyle,
  Recipe,
  Supplement,
  SupplementSchedule,
  VarietyLevel,
  WeeklyMealPlan,
  WeeklyPlanStatus,
} from '../../shared/types/domain';
import { generateId } from '../../shared/utils/cn';
import {
  calculateMealItemNutrition,
  calculateWeeklyNutritionSummary,
  NutritionContext,
} from './nutritionCalculator';

export interface GeneratePlanInput {
  weekStartISO: string;
  weekEndISO: string;
  dayDatesISO: string[];
  recipes: Recipe[];
  ingredients: Ingredient[];
  foodItems: FoodItem[];
  supplements: Supplement[];
  pantry: PantryInventory[];
  target: NutritionTarget;
  preferences: NutritionPreferences;
  agentPreferences: AgentPreferences;
}

function scoreRecipeForContext(
  recipe: Recipe,
  slot: MealSlotType,
  preferences: NutritionPreferences,
  agentPreferences: AgentPreferences,
  pantryIngredientIds: Set<string>,
  usageCount: number
): number {
  let score = 50;

  if (recipe.suitableSlots.includes(slot)) {
    score += 35;
  } else {
    score -= 40;
  }

  if (recipe.isFavorite || preferences.favoriteRecipeIds.includes(recipe.id)) {
    score += 20;
  }

  if (agentPreferences.preferQuickMeals && recipe.prepTimeMinutes + recipe.cookTimeMinutes <= 25) {
    score += 18;
  }

  if (agentPreferences.planningStyle === PlanningStyle.HIGH_PROTEIN) {
    const prot = recipe.manualNutritionPerServing?.protein ?? 0;
    if (prot >= 25) score += 20;
  }

  if (agentPreferences.prioritizePantry) {
    const overlap = recipe.ingredients.filter((ri) =>
      pantryIngredientIds.has(ri.ingredientId)
    ).length;
    score += overlap * 5;
  }

  // Penalize repeats heavily depending on variety preference
  const repeatPenalty =
    agentPreferences.varietyLevel === VarietyLevel.HIGH
      ? 45
      : agentPreferences.varietyLevel === VarietyLevel.MEDIUM
      ? 30
      : 15;
  score -= usageCount * repeatPenalty;

  return score;
}

/**
 * Generates a realistic, structured 7-day WeeklyMealPlan based on user recipes,
 * nutrition targets, allergies, dislikes, pantry stock, and agent preferences.
 */
export function generateMockWeeklyPlan(input: GeneratePlanInput): WeeklyMealPlan {
  const {
    weekStartISO,
    weekEndISO,
    dayDatesISO,
    recipes,
    ingredients,
    foodItems,
    supplements,
    pantry,
    target,
    preferences,
    agentPreferences,
  } = input;

  const nowISO = new Date().toISOString();
  const ingredientsById = Object.fromEntries(ingredients.map((i) => [i.id, i]));
  const recipesById = Object.fromEntries(recipes.map((r) => [r.id, r]));
  const foodItemsById = Object.fromEntries(foodItems.map((f) => [f.id, f]));
  const nutritionContext: NutritionContext = {
    ingredientsById,
    recipesById,
    foodItemsById,
  };

  const pantryIngredientIds = new Set(pantry.filter((p) => p.quantity > 0).map((p) => p.ingredientId));
  const blockedAllergens = new Set(preferences.allergies);
  const dislikedIngredientIds = new Set(preferences.dislikedIngredientIds);
  const dislikedRecipeIds = new Set(preferences.dislikedRecipeIds);

  // Filter eligible recipes strictly respecting allergens & dislikes
  const safeRecipes = recipes.filter((r) => {
    if (!r.isActive || r.isDisliked || dislikedRecipeIds.has(r.id)) return false;
    if (r.allergens.some((a) => blockedAllergens.has(a))) return false;
    if (r.ingredients.some((ri) => dislikedIngredientIds.has(ri.ingredientId))) return false;
    if (
      agentPreferences.forbiddenFoodNotes.trim() &&
      agentPreferences.forbiddenFoodNotes
        .split(/[,،\n]/)
        .some((word) => word.trim().length > 1 && r.name.includes(word.trim()))
    ) {
      return false;
    }
    return true;
  });

  const safeFoods = foodItems.filter(
    (f) => f.isActive && !f.allergens.some((a) => blockedAllergens.has(a))
  );

  const usageCounts = new Map<string, number>();
  const maxRepeats = Math.max(1, agentPreferences.maxRecipeRepeatsPerWeek);

  const enabledSlots = preferences.mealTimings.filter((t) => t.enabled);
  const slotsToUse =
    enabledSlots.length > 0
      ? enabledSlots
      : MEAL_SLOT_ORDER.slice(0, Math.min(5, Math.max(3, target.mealsPerDay))).map((slot) => ({
          slot,
          label: MEAL_SLOT_LABELS[slot],
          defaultTime:
            slot === MealSlotType.BREAKFAST
              ? '08:00'
              : slot === MealSlotType.MORNING_SNACK
              ? '10:30'
              : slot === MealSlotType.LUNCH
              ? '13:30'
              : slot === MealSlotType.AFTERNOON_SNACK
              ? '17:00'
              : '20:30',
          enabled: true,
        }));

  const days: DailyMealPlan[] = dayDatesISO.map((dateISO, dayIndex) => {
    const meals: Meal[] = slotsToUse.map((slotPref, slotIdx) => {
      const slot = slotPref.slot;

      if (slot === MealSlotType.MORNING_SNACK || slot === MealSlotType.AFTERNOON_SNACK) {
        const snackItems: MealItem[] = [];
        if (safeFoods.length > 0) {
          const fruitPool = safeFoods.filter((f) => f.category === 'FRUIT');
          const nutOrDairyPool = safeFoods.filter((f) => f.category !== 'FRUIT');

          const primaryPool =
            slot === MealSlotType.MORNING_SNACK && fruitPool.length > 0
              ? fruitPool
              : nutOrDairyPool.length > 0
              ? nutOrDairyPool
              : safeFoods;

          const pickedFood = primaryPool[(dayIndex + slotIdx) % primaryPool.length];
          snackItems.push({
            id: generateId('mitem'),
            kind: 'FOOD_ITEM',
            foodItemId: pickedFood.id,
            portionMultiplier: 1,
            amount: pickedFood.servingSize,
            unit: pickedFood.unit,
            ingredientOverrides: [],
            confirmedIngredientIds: [],
          });

          // For afternoon snack also pair a fruit if available and calories allow
          if (slot === MealSlotType.AFTERNOON_SNACK && fruitPool.length > 0) {
            const pairedFruit = fruitPool[(dayIndex + 2) % fruitPool.length];
            if (pairedFruit.id !== pickedFood.id) {
              snackItems.push({
                id: generateId('mitem'),
                kind: 'FOOD_ITEM',
                foodItemId: pairedFruit.id,
                portionMultiplier: 1,
                amount: pairedFruit.servingSize,
                unit: pairedFruit.unit,
                ingredientOverrides: [],
                confirmedIngredientIds: [],
              });
            }
          }
        }

        return {
          id: generateId('meal'),
          slot,
          label: slotPref.label || MEAL_SLOT_LABELS[slot],
          suggestedTime: slotPref.defaultTime,
          items: snackItems,
          isConfirmed: false,
        };
      }

      // Main meal slot: Breakfast, Lunch, Dinner
      const slotCandidates = safeRecipes.filter((r) => r.suitableSlots.includes(slot));
      const pool = slotCandidates.length > 0 ? slotCandidates : safeRecipes;

      const sorted = [...pool].sort((a, b) => {
        const countA = usageCounts.get(a.id) ?? 0;
        const countB = usageCounts.get(b.id) ?? 0;
        const capPenaltyA = countA >= maxRepeats ? -500 : 0;
        const capPenaltyB = countB >= maxRepeats ? -500 : 0;
        const scoreA =
          scoreRecipeForContext(a, slot, preferences, agentPreferences, pantryIngredientIds, countA) +
          capPenaltyA;
        const scoreB =
          scoreRecipeForContext(b, slot, preferences, agentPreferences, pantryIngredientIds, countB) +
          capPenaltyB;
        return scoreB - scoreA;
      });

      const chosen = sorted[0];
      const mealItems: MealItem[] = [];

      if (chosen) {
        usageCounts.set(chosen.id, (usageCounts.get(chosen.id) ?? 0) + 1);

        // Gently scale portion multiplier to stay near target daily calorie budget without deleting meals
        const baseItem: MealItem = {
          id: generateId('mitem'),
          kind: 'RECIPE',
          recipeId: chosen.id,
          portionMultiplier: 1,
          ingredientOverrides: [],
          confirmedIngredientIds: [],
        };

        const itemCal = calculateMealItemNutrition(baseItem, nutritionContext).calories;
        const slotShare =
          slot === MealSlotType.LUNCH
            ? target.dailyCalories * 0.36
            : slot === MealSlotType.DINNER
            ? target.dailyCalories * 0.28
            : target.dailyCalories * 0.22;

        let multiplier = 1;
        if (itemCal > 0) {
          const raw = slotShare / itemCal;
          multiplier = Math.min(1.75, Math.max(0.75, Math.round(raw * 4) / 4));
        }

        mealItems.push({
          ...baseItem,
          portionMultiplier: multiplier,
        });
      }

      return {
        id: generateId('meal'),
        slot,
        label: slotPref.label || MEAL_SLOT_LABELS[slot],
        suggestedTime: slotPref.defaultTime,
        items: mealItems,
        isConfirmed: false,
      };
    });

    const supplementSchedules: SupplementSchedule[] = supplements
      .filter((s) => s.isActive && s.activeDays.includes(dayIndex))
      .map((s) => ({
        id: generateId('supsch'),
        supplementId: s.id,
        dayIndex,
        isTaken: false,
      }));

    return {
      id: generateId('day'),
      dayIndex,
      dateISO,
      status: DailyPlanStatus.DRAFT,
      meals,
      supplementSchedules,
      updatedAt: nowISO,
    };
  });

  const summary = calculateWeeklyNutritionSummary(days, nutritionContext, target);
  const warnings = [...summary.warnings];

  if (safeRecipes.length < 5) {
    warnings.push(
      'تعداد غذاهای مجاز پس از اعمال حساسیت‌ها و غذاهای نامطلوب کم است؛ ممکن است تنوع برنامه کاهش یابد.'
    );
  }

  return {
    id: generateId('wplan'),
    weekStartISO,
    weekEndISO,
    status: WeeklyPlanStatus.DRAFT,
    days,
    warnings,
    version: 1,
    snapshots: [],
    createdAt: nowISO,
    updatedAt: nowISO,
  };
}
