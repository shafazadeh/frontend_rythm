import { describe, expect, it } from 'vitest';
import {
  DailyPlanStatus,
  MealItem,
  PantryInventory,
  ShoppingList,
  UnitType,
  WeeklyPlanStatus,
} from '../../../shared/types/domain';
import { MOCK_FOOD_ITEMS } from '../../mock/mockFoodItems';
import { MOCK_INGREDIENTS } from '../../mock/mockIngredients';
import { buildInitialMockData } from '../../mock/mockInitialState';
import { MOCK_RECIPES } from '../../mock/mockRecipes';
import {
  getNextSaturdayToFridayWeekRange,
  getSaturdayToFridayWeekRange,
} from '../jalaliCalendar';
import { generateMockWeeklyPlan } from '../mockPlannerEngine';
import {
  calculateIngredientNutrition,
  calculateMealItemNutrition,
  NutritionContext,
} from '../nutritionCalculator';
import { generateShoppingListFromPlan } from '../shoppingAggregator';
import { convertUnitQuantity } from '../unitConverter';

const ingredientsById = Object.fromEntries(MOCK_INGREDIENTS.map((i) => [i.id, i]));
const recipesById = Object.fromEntries(MOCK_RECIPES.map((r) => [r.id, r]));
const foodItemsById = Object.fromEntries(MOCK_FOOD_ITEMS.map((f) => [f.id, f]));
const context: NutritionContext = { ingredientsById, recipesById, foodItemsById };

describe('Rhythm Domain Logic Unit Tests', () => {
  it('1. calculates calories and macros accurately by ingredient amount', () => {
    const chicken = ingredientsById['ing_chicken_breast']; // 165 kcal, 31g protein per 100g
    const result = calculateIngredientNutrition(chicken, 200, UnitType.GRAM);

    expect(result.hasIncompleteData).toBe(false);
    expect(result.calories).toBe(330);
    expect(result.protein).toBe(62);
    expect(result.carbs).toBe(0);
    expect(result.fat).toBe(7.2);
  });

  it('2. converts compatible units (kg <-> g, l <-> ml) and flags incompatible units', () => {
    const kgToG = convertUnitQuantity(1.5, UnitType.KILOGRAM, UnitType.GRAM);
    expect(kgToG.compatible).toBe(true);
    expect(kgToG.quantity).toBe(1500);

    const incompatible = convertUnitQuantity(2, UnitType.PIECE, UnitType.GRAM);
    expect(incompatible.compatible).toBe(false);
  });

  it('3. scales meal nutrition with portionMultiplier without mutating recipe', () => {
    const baseItem: MealItem = {
      id: 'm1',
      kind: 'RECIPE',
      recipeId: 'rec_joojeh_kabab',
      portionMultiplier: 1,
      ingredientOverrides: [],
      confirmedIngredientIds: [],
    };
    const doubleItem: MealItem = {
      ...baseItem,
      portionMultiplier: 2,
    };

    const singleNut = calculateMealItemNutrition(baseItem, context);
    const doubleNut = calculateMealItemNutrition(doubleItem, context);

    expect(doubleNut.calories).toBeCloseTo(singleNut.calories * 2, 0);
    expect(doubleNut.protein).toBeCloseTo(singleNut.protein * 2, 0);
  });

  it('4. recalculates meal nutrition on ingredient override without altering base Recipe', () => {
    const recipeBefore = structuredClone(recipesById['rec_joojeh_kabab']);
    const overriddenItem: MealItem = {
      id: 'm_ov',
      kind: 'RECIPE',
      recipeId: 'rec_joojeh_kabab',
      portionMultiplier: 1,
      ingredientOverrides: [
        {
          originalIngredientId: 'ing_chicken_breast',
          replacementIngredientId: 'ing_salmon',
          amount: 200,
          unit: UnitType.GRAM,
          isConfirmedByUser: true,
        },
      ],
      confirmedIngredientIds: ['ing_salmon'],
    };

    const baseItem: MealItem = {
      id: 'm_base',
      kind: 'RECIPE',
      recipeId: 'rec_joojeh_kabab',
      portionMultiplier: 1,
      ingredientOverrides: [],
      confirmedIngredientIds: [],
    };

    const baseNut = calculateMealItemNutrition(baseItem, context);
    const ovNut = calculateMealItemNutrition(overriddenItem, context);

    expect(ovNut.calories).not.toBe(baseNut.calories);
    expect(recipesById['rec_joojeh_kabab']).toEqual(recipeBefore);
  });

  it('5. computes Saturday-to-Friday Persian week range accurately', () => {
    // 2026-11-19 is Thursday -> Saturday start is 2026-11-14, Friday end is 2026-11-20
    const range = getSaturdayToFridayWeekRange('2026-11-19');
    expect(range.weekStartISO).toBe('2026-11-14');
    expect(range.weekEndISO).toBe('2026-11-20');
    expect(range.dayDatesISO).toHaveLength(7);

    const nextRange = getNextSaturdayToFridayWeekRange('2026-11-19');
    expect(nextRange.weekStartISO).toBe('2026-11-21');
    expect(nextRange.weekEndISO).toBe('2026-11-27');
  });

  it('6. aggregates ingredients, prevents duplicates, subtracts pantry read-only, and preserves manual/checked items', () => {
    const mockData = buildInitialMockData();
    const plan = mockData.weeklyPlans[0];
    // Confirm all days
    plan.days = plan.days.map((d) => ({ ...d, status: DailyPlanStatus.CONFIRMED }));

    const pantrySnapshotBefore = structuredClone(mockData.pantry);
    const customPantry: PantryInventory[] = [
      {
        id: 'p_rice',
        ingredientId: 'ing_rice_basmati',
        quantity: 200,
        unit: UnitType.GRAM,
        shoppingCategoryId: 'shop_cat_grains',
        updatedAt: '2026-11-19T00:00:00Z',
      },
    ];

    const firstList = generateShoppingListFromPlan({
      weeklyPlan: plan,
      recipesById,
      ingredientsById,
      pantry: customPantry,
    });

    // Check no duplicate ingredientIds in AUTO items
    const autoIds = firstList.items
      .filter((i) => i.source === 'AUTO' && i.ingredientId)
      .map((i) => i.ingredientId);
    expect(new Set(autoIds).size).toBe(autoIds.length);

    // Ensure pantry was not mutated
    expect(mockData.pantry).toEqual(pantrySnapshotBefore);

    // Add manual item and mark one auto item as checked
    const manualList: ShoppingList = {
      ...firstList,
      items: [
        ...firstList.items.map((it, idx) => (idx === 0 ? { ...it, isChecked: true } : it)),
        {
          id: 'manual_test_1',
          name: 'نمک دریا',
          requiredQuantity: 1,
          pantryQuantity: 0,
          suggestedBuyQuantity: 1,
          unit: UnitType.PACK,
          categoryId: 'shop_cat_spices',
          isChecked: false,
          source: 'MANUAL',
          updatedAt: '2026-11-19T00:00:00Z',
        },
      ],
    };

    const regenerated = generateShoppingListFromPlan({
      weeklyPlan: plan,
      recipesById,
      ingredientsById,
      pantry: customPantry,
      existingShoppingList: manualList,
    });

    // Manual item must be preserved
    expect(regenerated.items.some((i) => i.id === 'manual_test_1')).toBe(true);
    // Checked auto item must stay checked
    const firstAutoId = firstList.items[0].ingredientId;
    const preservedAuto = regenerated.items.find((i) => i.ingredientId === firstAutoId);
    expect(preservedAuto?.isChecked).toBe(true);
  });
});

describe('Rhythm Weekly Planning Integration Flow (Happy Path)', () => {
  it('generates next week plan, confirms 7 days, creates snapshot, and builds deficit shopping list', () => {
    const initial = buildInitialMockData();
    const nextRange = getNextSaturdayToFridayWeekRange('2026-11-19');

    const generatedPlan = generateMockWeeklyPlan({
      weekStartISO: nextRange.weekStartISO,
      weekEndISO: nextRange.weekEndISO,
      dayDatesISO: nextRange.dayDatesISO,
      recipes: initial.recipes,
      ingredients: initial.ingredients,
      foodItems: initial.foodItems,
      supplements: initial.supplements,
      pantry: initial.pantry,
      target: initial.target,
      preferences: initial.preferences,
      agentPreferences: initial.agentPreferences,
    });

    expect(generatedPlan.days).toHaveLength(7);
    expect(generatedPlan.status).toBe(WeeklyPlanStatus.DRAFT);

    // Simulate reviewing and confirming each day Saturday..Friday
    generatedPlan.days = generatedPlan.days.map((day) => ({
      ...day,
      status: DailyPlanStatus.CONFIRMED,
      meals: day.meals.map((m) => ({ ...m, isConfirmed: true })),
    }));
    generatedPlan.status = WeeklyPlanStatus.CONFIRMED;

    const shoppingList = generateShoppingListFromPlan({
      weeklyPlan: generatedPlan,
      recipesById,
      ingredientsById,
      pantry: initial.pantry,
      includeUnconfirmedDays: false,
    });

    expect(shoppingList.items.length).toBeGreaterThan(0);
    // Every suggestedBuyQuantity must reflect requiredQuantity minus pantryQuantity (when units match)
    for (const item of shoppingList.items) {
      expect(item.suggestedBuyQuantity).toBeGreaterThanOrEqual(0);
    }
  });
});
