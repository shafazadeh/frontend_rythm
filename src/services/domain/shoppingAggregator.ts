import {
  DailyPlanStatus,
  Ingredient,
  PantryInventory,
  Recipe,
  ShoppingList,
  ShoppingListItem,
  UnitType,
  WeeklyMealPlan,
} from '../../shared/types/domain';
import { generateId } from '../../shared/utils/cn';
import { getEffectiveMealItemIngredients } from './nutritionCalculator';
import { convertUnitQuantity, normalizeDisplayUnit } from './unitConverter';

export interface AggregationParams {
  weeklyPlan: WeeklyMealPlan;
  recipesById: Record<string, Recipe>;
  ingredientsById: Record<string, Ingredient>;
  pantry: PantryInventory[];
  existingShoppingList?: ShoppingList | null;
  includeUnconfirmedDays?: boolean;
  defaultCategoryId?: string;
}

interface AggregatedBucket {
  ingredientId: string;
  name: string;
  targetUnit: UnitType;
  totalRequired: number;
  categoryId: string;
  needsUnitReview: boolean;
  unitReviewReasons: string[];
  gramsPerUnit?: number;
}

/**
 * Generates or regenerates a ShoppingList from a WeeklyMealPlan while:
 * 1. Grouping identical ingredients by unique ID
 * 2. Normalizing compatible units (e.g., g <-> kg, ml <-> l)
 * 3. Flagging incompatible units without guessing
 * 4. Subtracting usable home PantryInventory (read-only; never mutates pantry)
 * 5. Preserving manual user items and previously checked items
 */
export function generateShoppingListFromPlan({
  weeklyPlan,
  recipesById,
  ingredientsById,
  pantry,
  existingShoppingList,
  includeUnconfirmedDays = false,
  defaultCategoryId = 'shop_cat_other',
}: AggregationParams): ShoppingList {
  const nowISO = new Date().toISOString();
  const buckets = new Map<string, AggregatedBucket>();

  const targetDays = includeUnconfirmedDays
    ? weeklyPlan.days
    : weeklyPlan.days.filter((d) => d.status === DailyPlanStatus.CONFIRMED);

  for (const day of targetDays) {
    for (const meal of day.meals) {
      for (const item of meal.items) {
        if (item.kind !== 'RECIPE') continue;
        const effectiveIngredients = getEffectiveMealItemIngredients(item, recipesById);

        for (const eff of effectiveIngredients) {
          const ingredient = ingredientsById[eff.effectiveIngredientId];
          if (!ingredient) continue;

          const existingBucket = buckets.get(ingredient.id);
          if (!existingBucket) {
            const conv = convertUnitQuantity(
              eff.amount,
              eff.unit,
              ingredient.defaultUnit,
              ingredient.gramsPerUnit
            );
            buckets.set(ingredient.id, {
              ingredientId: ingredient.id,
              name: ingredient.name,
              targetUnit: conv.compatible ? ingredient.defaultUnit : eff.unit,
              totalRequired: conv.compatible ? conv.quantity : eff.amount,
              categoryId: ingredient.shoppingCategoryId || defaultCategoryId,
              needsUnitReview: !conv.compatible,
              unitReviewReasons: conv.compatible
                ? []
                : [`واحد ${eff.unit} با واحد پایه ${ingredient.defaultUnit} سازگار نیست`],
              gramsPerUnit: ingredient.gramsPerUnit,
            });
          } else {
            const conv = convertUnitQuantity(
              eff.amount,
              eff.unit,
              existingBucket.targetUnit,
              existingBucket.gramsPerUnit
            );
            if (conv.compatible) {
              existingBucket.totalRequired += conv.quantity;
            } else {
              existingBucket.needsUnitReview = true;
              existingBucket.unitReviewReasons.push(
                `مقدار ${eff.amount} (${eff.unit}) به دلیل ناسازگاری واحد تجمیع نشد`
              );
            }
          }
        }
      }
    }
  }

  // Index existing auto items to preserve checked state & notes
  const existingAutoByIngredientId = new Map<string, ShoppingListItem>();
  const manualItems: ShoppingListItem[] = [];

  if (existingShoppingList) {
    for (const item of existingShoppingList.items) {
      if (item.source === 'MANUAL') {
        manualItems.push(item);
      } else if (item.ingredientId) {
        existingAutoByIngredientId.set(item.ingredientId, item);
      }
    }
  }

  const autoItems: ShoppingListItem[] = [];

  for (const bucket of buckets.values()) {
    // Sum available pantry inventory for this ingredient
    const matchingPantry = pantry.filter((p) => p.ingredientId === bucket.ingredientId);
    let pantryAvailableInTargetUnit = 0;
    let pantryUnitMismatch = false;

    for (const pItem of matchingPantry) {
      const conv = convertUnitQuantity(
        pItem.quantity,
        pItem.unit,
        bucket.targetUnit,
        bucket.gramsPerUnit
      );
      if (conv.compatible) {
        pantryAvailableInTargetUnit += conv.quantity;
      } else if (pItem.quantity > 0) {
        pantryUnitMismatch = true;
        bucket.unitReviewReasons.push(
          `موجودی خانه (${pItem.quantity} ${pItem.unit}) واحد ناسازگار دارد و کسر نشد`
        );
      }
    }

    const deficit = Math.max(0, bucket.totalRequired - pantryAvailableInTargetUnit);
    const prevItem = existingAutoByIngredientId.get(bucket.ingredientId);

    // If deficit is 0 AND it wasn't previously checked/needed, skip adding to shopping list
    // Unless there's a unit review warning or user already checked it
    if (deficit <= 0.001 && !pantryUnitMismatch && !bucket.needsUnitReview && !prevItem?.isChecked) {
      continue;
    }

    const normalizedBuy = normalizeDisplayUnit(
      deficit > 0 ? deficit : 0,
      bucket.targetUnit
    );
    const normalizedReq = normalizeDisplayUnit(bucket.totalRequired, bucket.targetUnit);
    const convPantry = convertUnitQuantity(
      pantryAvailableInTargetUnit,
      bucket.targetUnit,
      normalizedReq.unit,
      bucket.gramsPerUnit
    );

    autoItems.push({
      id: prevItem?.id ?? generateId('shop'),
      ingredientId: bucket.ingredientId,
      name: bucket.name,
      requiredQuantity: normalizedReq.quantity,
      pantryQuantity: convPantry.compatible
        ? Number(convPantry.quantity.toFixed(2))
        : Number(pantryAvailableInTargetUnit.toFixed(2)),
      suggestedBuyQuantity:
        normalizedBuy.unit === normalizedReq.unit
          ? normalizedBuy.quantity
          : Number(deficit.toFixed(2)),
      unit: normalizedReq.unit,
      categoryId: prevItem?.categoryId ?? bucket.categoryId,
      isChecked: prevItem?.isChecked ?? false,
      source: 'AUTO',
      needsUnitReview: bucket.needsUnitReview || pantryUnitMismatch,
      unitReviewMessage:
        bucket.unitReviewReasons.length > 0
          ? Array.from(new Set(bucket.unitReviewReasons)).join('؛ ')
          : undefined,
      note: prevItem?.note,
      updatedAt: nowISO,
    });
  }

  return {
    id: existingShoppingList?.id ?? generateId('shoplist'),
    weeklyPlanId: weeklyPlan.id,
    weekStartISO: weeklyPlan.weekStartISO,
    weekEndISO: weeklyPlan.weekEndISO,
    items: [...autoItems, ...manualItems],
    lastGeneratedAt: nowISO,
    updatedAt: nowISO,
  };
}
