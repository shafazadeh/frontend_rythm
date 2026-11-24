import { ACTIVITY_LEVEL_INFO } from '../../shared/constants/units';
import {
  DailyMealPlan,
  DailyPlanStatus,
  FoodItem,
  Ingredient,
  Meal,
  MealItem,
  NutritionSummary,
  NutritionTarget,
  NutritionValues,
  Recipe,
  RecipeIngredient,
  SexForCalculation,
  UnitType,
  UserProfile,
} from '../../shared/types/domain';
import { convertUnitQuantity } from './unitConverter';

export interface NutritionContext {
  ingredientsById: Record<string, Ingredient>;
  recipesById: Record<string, Recipe>;
  foodItemsById: Record<string, FoodItem>;
}

export function emptyNutritionSummary(): NutritionSummary {
  return {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    hasIncompleteData: false,
  };
}

export function addNutrition(a: NutritionSummary, b: NutritionSummary): NutritionSummary {
  const hasIncompleteData = a.hasIncompleteData || b.hasIncompleteData;
  const reasons = [a.incompleteReason, b.incompleteReason].filter(Boolean);
  return {
    calories: Math.round((a.calories + b.calories) * 10) / 10,
    protein: Math.round((a.protein + b.protein) * 10) / 10,
    carbs: Math.round((a.carbs + b.carbs) * 10) / 10,
    fat: Math.round((a.fat + b.fat) * 10) / 10,
    fiber: Math.round(((a.fiber ?? 0) + (b.fiber ?? 0)) * 10) / 10,
    hasIncompleteData,
    incompleteReason: reasons.length > 0 ? Array.from(new Set(reasons)).join('؛ ') : undefined,
  };
}

/**
 * Calculates nutrition for a given ingredient, amount, and unit using its reference amount and unit.
 */
export function calculateIngredientNutrition(
  ingredient: Ingredient | undefined,
  amount: number,
  unit: UnitType
): NutritionSummary {
  if (!ingredient || !ingredient.nutritionPerReference || ingredient.referenceAmount <= 0) {
    return {
      ...emptyNutritionSummary(),
      hasIncompleteData: true,
      incompleteReason: ingredient
        ? `اطلاعات تغذیه‌ای «${ingredient.name}» ناقص است`
        : 'ماده اولیه یافت نشد',
    };
  }

  const conversion = convertUnitQuantity(
    amount,
    unit,
    ingredient.referenceUnit,
    ingredient.gramsPerUnit
  );

  if (!conversion.compatible) {
    return {
      ...emptyNutritionSummary(),
      hasIncompleteData: true,
      incompleteReason: `تبدیل واحد برای «${ingredient.name}» مشخص نیست`,
    };
  }

  const scale = conversion.quantity / ingredient.referenceAmount;
  const ref = ingredient.nutritionPerReference;

  return {
    calories: Math.round(ref.calories * scale * 10) / 10,
    protein: Math.round(ref.protein * scale * 10) / 10,
    carbs: Math.round(ref.carbs * scale * 10) / 10,
    fat: Math.round(ref.fat * scale * 10) / 10,
    fiber: ref.fiber !== undefined ? Math.round(ref.fiber * scale * 10) / 10 : 0,
    hasIncompleteData: false,
  };
}

/**
 * Calculates total and per-serving nutrition from a recipe's ingredients list.
 */
export function calculateRecipeNutritionFromIngredients(
  recipeIngredients: RecipeIngredient[],
  ingredientsById: Record<string, Ingredient>,
  servings: number
): {
  total: NutritionSummary;
  perServing: NutritionSummary;
} {
  let total = emptyNutritionSummary();

  for (const item of recipeIngredients) {
    const ing = ingredientsById[item.ingredientId];
    const ingNutrition = calculateIngredientNutrition(ing, item.amount, item.unit);
    total = addNutrition(total, ingNutrition);
  }

  const safeServings = servings > 0 ? servings : 1;
  const perServing: NutritionSummary = {
    calories: Math.round((total.calories / safeServings) * 10) / 10,
    protein: Math.round((total.protein / safeServings) * 10) / 10,
    carbs: Math.round((total.carbs / safeServings) * 10) / 10,
    fat: Math.round((total.fat / safeServings) * 10) / 10,
    fiber: Math.round(((total.fiber ?? 0) / safeServings) * 10) / 10,
    hasIncompleteData: total.hasIncompleteData,
    incompleteReason: total.incompleteReason,
  };

  return { total, perServing };
}

/**
 * Detects if manually entered recipe nutrition diverges significantly (>15% or >60 kcal) from calculated ingredients.
 */
export function checkNutritionDiscrepancy(
  calculatedPerServing: NutritionSummary,
  manualPerServing?: NutritionValues
): { hasDiscrepancy: boolean; differencePercent: number; message?: string } {
  if (!manualPerServing || calculatedPerServing.hasIncompleteData || calculatedPerServing.calories <= 0) {
    return { hasDiscrepancy: false, differencePercent: 0 };
  }

  const diff = Math.abs(manualPerServing.calories - calculatedPerServing.calories);
  const pct = Math.round((diff / calculatedPerServing.calories) * 100);

  if (pct > 15 && diff > 50) {
    return {
      hasDiscrepancy: true,
      differencePercent: pct,
      message: `اختلاف ${pct}٪ بین کالری دستی (${Math.round(manualPerServing.calories)}) و محاسبه‌شده از مواد اولیه (${Math.round(calculatedPerServing.calories)}) وجود دارد.`,
    };
  }

  return { hasDiscrepancy: false, differencePercent: pct };
}

/**
 * Resolves effective ingredients of a meal item (applying portionMultiplier and any weekly overrides without mutating base Recipe).
 */
export function getEffectiveMealItemIngredients(
  item: MealItem,
  recipesById: Record<string, Recipe>
): Array<{
  originalIngredientId: string;
  effectiveIngredientId: string;
  amount: number;
  unit: UnitType;
  isOverridden: boolean;
  compatibilityWarning?: string;
}> {
  if (item.kind !== 'RECIPE' || !item.recipeId) return [];
  const recipe = recipesById[item.recipeId];
  if (!recipe) return [];

  const safeServings = recipe.servings > 0 ? recipe.servings : 1;
  const scale = item.portionMultiplier / safeServings;

  return recipe.ingredients.map((ri) => {
    const override = item.ingredientOverrides.find(
      (ov) => ov.originalIngredientId === ri.ingredientId
    );
    if (override) {
      return {
        originalIngredientId: ri.ingredientId,
        effectiveIngredientId: override.replacementIngredientId,
        amount: Math.round(override.amount * 100) / 100,
        unit: override.unit,
        isOverridden: true,
        compatibilityWarning: override.compatibilityWarning,
      };
    }

    return {
      originalIngredientId: ri.ingredientId,
      effectiveIngredientId: ri.ingredientId,
      amount: Math.round(ri.amount * scale * 100) / 100,
      unit: ri.unit,
      isOverridden: false,
    };
  });
}

/**
 * Calculates nutrition for a single MealItem (either Recipe with portion/overrides or FoodItem).
 */
export function calculateMealItemNutrition(
  item: MealItem,
  context: NutritionContext
): NutritionSummary {
  if (item.kind === 'FOOD_ITEM') {
    const food = item.foodItemId ? context.foodItemsById[item.foodItemId] : undefined;
    if (!food || !food.nutritionPerServing) {
      return {
        ...emptyNutritionSummary(),
        hasIncompleteData: true,
        incompleteReason: food
          ? `اطلاعات تغذیه‌ای «${food.name}» ثبت نشده است`
          : 'آیتم خوراکی یافت نشد',
      };
    }

    const amount = item.amount ?? food.servingSize;
    const unit = item.unit ?? food.unit;
    const conv = convertUnitQuantity(amount, unit, food.unit);
    if (!conv.compatible || food.servingSize <= 0) {
      return {
        ...emptyNutritionSummary(),
        hasIncompleteData: true,
        incompleteReason: `تبدیل واحد برای «${food.name}» امکان‌پذیر نیست`,
      };
    }

    const ratio = conv.quantity / food.servingSize;
    const base = food.nutritionPerServing;
    return {
      calories: Math.round(base.calories * ratio * 10) / 10,
      protein: Math.round(base.protein * ratio * 10) / 10,
      carbs: Math.round(base.carbs * ratio * 10) / 10,
      fat: Math.round(base.fat * ratio * 10) / 10,
      fiber: base.fiber !== undefined ? Math.round(base.fiber * ratio * 10) / 10 : 0,
      hasIncompleteData: false,
    };
  }

  const recipe = item.recipeId ? context.recipesById[item.recipeId] : undefined;
  if (!recipe) {
    return {
      ...emptyNutritionSummary(),
      hasIncompleteData: true,
      incompleteReason: 'دستور غذا یافت نشد',
    };
  }

  // If no overrides and recipe explicitly uses verified manual nutrition, scale manual nutrition per serving
  if (item.ingredientOverrides.length === 0 && recipe.useManualNutrition && recipe.manualNutritionPerServing) {
    const m = recipe.manualNutritionPerServing;
    const mult = item.portionMultiplier;
    return {
      calories: Math.round(m.calories * mult * 10) / 10,
      protein: Math.round(m.protein * mult * 10) / 10,
      carbs: Math.round(m.carbs * mult * 10) / 10,
      fat: Math.round(m.fat * mult * 10) / 10,
      fiber: m.fiber !== undefined ? Math.round(m.fiber * mult * 10) / 10 : 0,
      hasIncompleteData: false,
    };
  }

  // Otherwise calculate directly from effective ingredients (including overrides!)
  const effectiveIngredients = getEffectiveMealItemIngredients(item, context.recipesById);
  let total = emptyNutritionSummary();
  for (const eff of effectiveIngredients) {
    const ing = context.ingredientsById[eff.effectiveIngredientId];
    total = addNutrition(total, calculateIngredientNutrition(ing, eff.amount, eff.unit));
  }
  return total;
}

export function calculateMealNutrition(meal: Meal, context: NutritionContext): NutritionSummary {
  return meal.items.reduce(
    (acc, item) => addNutrition(acc, calculateMealItemNutrition(item, context)),
    emptyNutritionSummary()
  );
}

export function calculateDailyNutrition(
  day: DailyMealPlan,
  context: NutritionContext
): NutritionSummary & { confirmedMealsCount: number; totalMealsCount: number } {
  let summary = emptyNutritionSummary();
  let confirmedMealsCount = 0;

  for (const meal of day.meals) {
    summary = addNutrition(summary, calculateMealNutrition(meal, context));
    if (meal.isConfirmed) confirmedMealsCount += 1;
  }

  return {
    ...summary,
    confirmedMealsCount,
    totalMealsCount: day.meals.length,
  };
}

export function calculateWeeklyNutritionSummary(
  days: DailyMealPlan[],
  context: NutritionContext,
  target: NutritionTarget
): {
  plannedDaysCount: number;
  confirmedDaysCount: number;
  averageCalories: number;
  averageProtein: number;
  averageCarbs: number;
  averageFat: number;
  dailyBreakdowns: Array<{
    dayIndex: number;
    dateISO: string;
    status: DailyPlanStatus;
    nutrition: NutritionSummary;
  }>;
  warnings: string[];
} {
  const dailyBreakdowns = days.map((day) => ({
    dayIndex: day.dayIndex,
    dateISO: day.dateISO,
    status: day.status,
    nutrition: calculateDailyNutrition(day, context),
  }));

  const planned = dailyBreakdowns.filter(
    (d) => d.status !== DailyPlanStatus.UNPLANNED && d.nutrition.calories > 0
  );
  const confirmedDaysCount = dailyBreakdowns.filter(
    (d) => d.status === DailyPlanStatus.CONFIRMED
  ).length;

  const divisor = planned.length > 0 ? planned.length : 1;
  const averageCalories = Math.round(
    planned.reduce((sum, d) => sum + d.nutrition.calories, 0) / divisor
  );
  const averageProtein = Math.round(
    planned.reduce((sum, d) => sum + d.nutrition.protein, 0) / divisor
  );
  const averageCarbs = Math.round(
    planned.reduce((sum, d) => sum + d.nutrition.carbs, 0) / divisor
  );
  const averageFat = Math.round(
    planned.reduce((sum, d) => sum + d.nutrition.fat, 0) / divisor
  );

  const warnings: string[] = [];
  if (planned.length > 0 && averageCalories < target.dailyCalories * 0.78) {
    warnings.push(
      `میانگین کالری برنامه (${averageCalories}) کمتر از ۸۰٪ هدف روزانه (${target.dailyCalories}) است.`
    );
  }
  if (planned.some((d) => d.nutrition.hasIncompleteData)) {
    warnings.push('برخی غذاها یا مواد اولیه دارای اطلاعات تغذیه‌ای ناقص هستند.');
  }
  if (planned.length > 0 && averageProtein < target.proteinGrams * 0.75) {
    warnings.push(
      `میانگین پروتئین (${averageProtein} گرم) به هدف تعیین‌شده (${target.proteinGrams} گرم) نزدیک نیست.`
    );
  }

  return {
    plannedDaysCount: planned.length,
    confirmedDaysCount,
    averageCalories,
    averageProtein,
    averageCarbs,
    averageFat,
    dailyBreakdowns,
    warnings,
  };
}

/**
 * Estimates daily energy need using Mifflin-St Jeor equation.
 * Returned value is an informational estimate only, never a medical prescription.
 */
export function estimateMifflinStJeor(profile: Pick<
  UserProfile,
  'age' | 'heightCm' | 'weightKg' | 'sexForCalculation' | 'activityLevel' | 'hasSpecialMedicalCondition'
>): {
  bmr: number;
  tdee: number;
  suggestedMacros: { proteinGrams: number; carbsGrams: number; fatGrams: number };
  warnings: string[];
} {
  const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age;
  const bmr = Math.round(profile.sexForCalculation === SexForCalculation.MALE ? base + 5 : base - 161);
  const multiplier = ACTIVITY_LEVEL_INFO[profile.activityLevel].multiplier;
  const tdee = Math.round(bmr * multiplier);

  const proteinGrams = Math.round(profile.weightKg * 1.4);
  const fatGrams = Math.round((tdee * 0.28) / 9);
  const remainingCalories = Math.max(0, tdee - proteinGrams * 4 - fatGrams * 9);
  const carbsGrams = Math.round(remainingCalories / 4);

  const warnings: string[] = [];
  if (tdee < 1300) {
    warnings.push('مقدار تخمینی بسیار پایین است؛ تنظیم هدف کمتر از ۱۳۰۰ کیلوکالری نیازمند بررسی متخصص تغذیه است.');
  }
  if (profile.hasSpecialMedicalCondition) {
    warnings.push('با توجه به ثبت شرایط خاص پزشکی، لطفاً پیش از اعمال هدف تغذیه‌ای با پزشک یا متخصص مشورت کنید.');
  }

  return {
    bmr,
    tdee,
    suggestedMacros: { proteinGrams, carbsGrams, fatGrams },
    warnings,
  };
}
