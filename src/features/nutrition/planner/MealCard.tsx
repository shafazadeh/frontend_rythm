import { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  Minus,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import {
  calculateMealNutrition,
  getEffectiveMealItemIngredients,
  NutritionContext,
} from '../../../services/domain/nutritionCalculator';
import { convertUnitQuantity } from '../../../services/domain/unitConverter';
import { UNIT_LABELS } from '../../../shared/constants/units';
import {
  FoodItem,
  Ingredient,
  IngredientCategory,
  Meal,
  MealIngredientOverride,
  MealItem,
  MealSlotType,
  PantryInventory,
  Recipe,
  RecipeCategory,
  UnitType,
} from '../../../shared/types/domain';
import { Button } from '../../../shared/components/ui/Button';
import { Card, CardContent } from '../../../shared/components/ui/Card';
import { Input } from '../../../shared/components/ui/FormControls';
import { RecipeThumbnail } from '../../../shared/components/RecipeThumbnail';
import { formatFaNumber, generateId, toPersianDigits } from '../../../shared/utils/cn';
import { IngredientReplaceDialog } from './IngredientReplaceDialog';
import { RecipeReplaceDialog } from './RecipeReplaceDialog';

interface MealCardProps {
  meal: Meal;
  nutritionContext: NutritionContext;
  allRecipes: Recipe[];
  recipeCategories: RecipeCategory[];
  allIngredients: Ingredient[];
  ingredientCategories: IngredientCategory[];
  allFoodItems: FoodItem[];
  pantry: PantryInventory[];
  onChangeMeal: (updatedMeal: Meal) => void;
  onOpenRecipeDetail: (recipe: Recipe) => void;
}

export function MealCard({
  meal,
  nutritionContext,
  allRecipes,
  recipeCategories,
  allIngredients,
  ingredientCategories,
  allFoodItems,
  pantry,
  onChangeMeal,
  onOpenRecipeDetail,
}: MealCardProps) {
  const [replaceModalState, setReplaceModalState] = useState<{
    open: boolean;
    itemId: string;
    mode: 'RECIPE' | 'FOOD_ITEM';
    currentId?: string;
    isAddMode?: boolean;
  }>({ open: false, itemId: '', mode: 'RECIPE' });

  const [ingReplaceState, setIngReplaceState] = useState<{
    open: boolean;
    itemId: string;
    originalIngredient: Ingredient;
    currentIngredientId: string;
    currentAmount: number;
    currentUnit: UnitType;
  } | null>(null);

  const [editingIngKey, setEditingIngKey] = useState<string | null>(null);
  const [editingIngAmount, setEditingIngAmount] = useState<number>(0);

  const mealNutrition = calculateMealNutrition(meal, nutritionContext);
  const isSnackSlot =
    meal.slot === MealSlotType.MORNING_SNACK || meal.slot === MealSlotType.AFTERNOON_SNACK;

  const updateItem = (itemId: string, updater: (item: MealItem) => MealItem) => {
    onChangeMeal({
      ...meal,
      isConfirmed: false,
      items: meal.items.map((it) => (it.id === itemId ? updater(it) : it)),
    });
  };

  const handleStepPortion = (item: MealItem, delta: number) => {
    if (item.kind === 'RECIPE') {
      const nextMult = Math.max(0.25, Math.min(4, Number((item.portionMultiplier + delta).toFixed(2))));
      updateItem(item.id, (it) => ({ ...it, portionMultiplier: nextMult }));
    } else {
      const food = item.foodItemId ? nutritionContext.foodItemsById[item.foodItemId] : undefined;
      const stepAmt = food ? Math.max(10, Math.round(food.servingSize * 0.25)) : 25;
      const nextAmt = Math.max(10, (item.amount ?? food?.servingSize ?? 100) + (delta > 0 ? stepAmt : -stepAmt));
      updateItem(item.id, (it) => ({ ...it, amount: nextAmt }));
    }
  };

  const handleToggleConfirmIngredient = (itemId: string, ingId: string) => {
    updateItem(itemId, (it) => {
      const exists = it.confirmedIngredientIds.includes(ingId);
      return {
        ...it,
        confirmedIngredientIds: exists
          ? it.confirmedIngredientIds.filter((id) => id !== ingId)
          : [...it.confirmedIngredientIds, ingId],
      };
    });
  };

  const handleApplyIngredientOverride = (itemId: string, override: MealIngredientOverride) => {
    updateItem(itemId, (it) => {
      const filtered = it.ingredientOverrides.filter(
        (ov) => ov.originalIngredientId !== override.originalIngredientId
      );
      return {
        ...it,
        ingredientOverrides: [...filtered, override],
        confirmedIngredientIds: Array.from(
          new Set([...it.confirmedIngredientIds, override.replacementIngredientId])
        ),
      };
    });
  };

  const handleSaveInlineIngredientAmount = (
    item: MealItem,
    originalIngId: string,
    effectiveIngId: string,
    unit: UnitType
  ) => {
    const safeAmount = Math.max(0.5, editingIngAmount);
    handleApplyIngredientOverride(item.id, {
      originalIngredientId: originalIngId,
      replacementIngredientId: effectiveIngId,
      amount: safeAmount,
      unit,
      isConfirmedByUser: true,
    });
    setEditingIngKey(null);
  };

  const handleRemoveItem = (itemId: string) => {
    onChangeMeal({
      ...meal,
      isConfirmed: false,
      items: meal.items.filter((i) => i.id !== itemId),
    });
  };

  const getPantryStatus = (ingredientId: string, requiredAmt: number, requiredUnit: UnitType) => {
    const ing = nutritionContext.ingredientsById[ingredientId];
    const entries = pantry.filter((p) => p.ingredientId === ingredientId && p.quantity > 0);
    if (entries.length === 0) {
      return { availableText: 'ناموجود', isEnough: false };
    }
    let totalInReqUnit = 0;
    let compatible = false;
    for (const entry of entries) {
      const conv = convertUnitQuantity(entry.quantity, entry.unit, requiredUnit, ing?.gramsPerUnit);
      if (conv.compatible) {
        totalInReqUnit += conv.quantity;
        compatible = true;
      }
    }
    if (!compatible) {
      const first = entries[0];
      return {
        availableText: `موجود (${formatFaNumber(first.quantity)} ${UNIT_LABELS[first.unit]})`,
        isEnough: true,
      };
    }
    const enough = totalInReqUnit >= requiredAmt;
    return {
      availableText: `${enough ? 'موجود' : 'کمبود'} (${formatFaNumber(totalInReqUnit)} ${UNIT_LABELS[requiredUnit]})`,
      isEnough: enough,
    };
  };

  return (
    <Card className={meal.isConfirmed ? 'border-[var(--color-primary)]/50' : undefined}>
      <CardContent className="p-5 space-y-4">
        {/* Meal Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-[var(--text-primary)]">{meal.label}</span>
            <span className="text-xs text-[var(--text-muted)] tabular-nums">
              ساعت {toPersianDigits(meal.suggestedTime)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-[var(--text-secondary)] tabular-nums">
              {formatFaNumber(mealNutrition.calories)} کالری
              <span aria-hidden="true" className="mx-1.5">·</span>
              پروتئین {formatFaNumber(mealNutrition.protein)} گ
              <span aria-hidden="true" className="mx-1.5">·</span>
              کربو {formatFaNumber(mealNutrition.carbs)} گ
              <span aria-hidden="true" className="mx-1.5">·</span>
              چربی {formatFaNumber(mealNutrition.fat)} گ
            </span>

            <Button
              size="sm"
              variant={meal.isConfirmed ? 'primary' : 'outline'}
              onClick={() => onChangeMeal({ ...meal, isConfirmed: !meal.isConfirmed })}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{meal.isConfirmed ? 'تأییدشده' : 'تأیید وعده'}</span>
            </Button>
          </div>
        </div>

        {/* Meal Items */}
        {meal.items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border-strong)] p-4 text-center space-y-2">
            <p className="text-xs text-[var(--text-muted)]">آیتمی برای این وعده ثبت نشده است.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setReplaceModalState({
                  open: true,
                  itemId: '',
                  mode: isSnackSlot ? 'FOOD_ITEM' : 'RECIPE',
                  isAddMode: true,
                })
              }
            >
              <Plus className="h-3.5 w-3.5" />
              <span>افزودن {isSnackSlot ? 'میوه / خوراکی' : 'غذا'}</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {meal.items.map((item) => {
              if (item.kind === 'FOOD_ITEM') {
                const food = item.foodItemId
                  ? nutritionContext.foodItemsById[item.foodItemId]
                  : undefined;
                const amount = item.amount ?? food?.servingSize ?? 100;
                const unit = item.unit ?? food?.unit ?? UnitType.GRAM;
                return (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--bg-surface-muted)]/60 p-3.5"
                  >
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">
                        {food?.name ?? 'خوراکی'}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] tabular-nums">
                        مقدار مصرف: {formatFaNumber(amount)} {UNIT_LABELS[unit]}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                        <button
                          type="button"
                          aria-label="کاهش مقدار"
                          onClick={() => handleStepPortion(item, -1)}
                          className="h-8 w-8 flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)] cursor-pointer"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="px-2.5 text-xs font-semibold tabular-nums">
                          {formatFaNumber(amount)} {UNIT_LABELS[unit]}
                        </span>
                        <button
                          type="button"
                          aria-label="افزایش مقدار"
                          onClick={() => handleStepPortion(item, 1)}
                          className="h-8 w-8 flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)] cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setReplaceModalState({
                            open: true,
                            itemId: item.id,
                            mode: 'FOOD_ITEM',
                            currentId: item.foodItemId,
                          })
                        }
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>تغییر</span>
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="حذف میانوعده"
                        onClick={() => handleRemoveItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-[var(--text-muted)]" />
                      </Button>
                    </div>
                  </div>
                );
              }

              // RECIPE ITEM
              const recipe = item.recipeId
                ? nutritionContext.recipesById[item.recipeId]
                : undefined;
              const effectiveIngredients = getEffectiveMealItemIngredients(
                item,
                nutritionContext.recipesById
              );

              return (
                <div key={item.id} className="space-y-4">
                  {/* Recipe Overview Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <RecipeThumbnail
                        src={recipe?.imageUrl}
                        alt={recipe?.name ?? 'غذا'}
                        className="h-16 w-20 shrink-0"
                      />
                      <div className="min-w-0 space-y-1">
                        <h4 className="text-base font-semibold text-[var(--text-primary)] truncate">
                          {recipe?.name ?? 'غذای نامشخص'}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)] tabular-nums">
                          <span>سهم انتخابی: {formatFaNumber(item.portionMultiplier, 2)} سروینگ</span>
                          {recipe && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatFaNumber(recipe.prepTimeMinutes + recipe.cookTimeMinutes)} دقیقه
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <div className="flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]/60">
                        <button
                          type="button"
                          aria-label="کاهش اندازه وعده"
                          onClick={() => handleStepPortion(item, -0.25)}
                          className="h-9 w-9 flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)] cursor-pointer"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="px-2.5 text-xs font-semibold tabular-nums">
                          ×{formatFaNumber(item.portionMultiplier, 2)}
                        </span>
                        <button
                          type="button"
                          aria-label="افزایش اندازه وعده"
                          onClick={() => handleStepPortion(item, 0.25)}
                          className="h-9 w-9 flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)] cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {recipe && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onOpenRecipeDetail(recipe)}
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                          <span>دستور پخت</span>
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setReplaceModalState({
                            open: true,
                            itemId: item.id,
                            mode: 'RECIPE',
                            currentId: item.recipeId,
                          })
                        }
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>جایگزینی غذا</span>
                      </Button>
                    </div>
                  </div>

                  {/* Interactive Ingredients Table */}
                  {effectiveIngredients.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-[var(--bg-surface-muted)]/70 text-[var(--text-secondary)] border-b border-[var(--border-subtle)]">
                          <tr>
                            <th className="py-2.5 px-3 font-medium">ماده اولیه</th>
                            <th className="py-2.5 px-3 font-medium">مقدار</th>
                            <th className="py-2.5 px-3 font-medium">موجودی خانه</th>
                            <th className="py-2.5 px-3 font-medium text-left">اقدام</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-subtle)]">
                          {effectiveIngredients.map((eff) => {
                            const effIng = nutritionContext.ingredientsById[eff.effectiveIngredientId];
                            const origIng = nutritionContext.ingredientsById[eff.originalIngredientId];
                            const pantryStatus = getPantryStatus(
                              eff.effectiveIngredientId,
                              eff.amount,
                              eff.unit
                            );
                            const isConfirmed = item.confirmedIngredientIds.includes(
                              eff.effectiveIngredientId
                            );
                            const rowKey = `${item.id}_${eff.originalIngredientId}`;
                            const isEditingAmt = editingIngKey === rowKey;

                            return (
                              <tr
                                key={rowKey}
                                className="hover:bg-[var(--bg-surface-muted)]/40 transition-colors"
                              >
                                <td className="py-2.5 px-3">
                                  <div className="font-medium text-[var(--text-primary)]">
                                    {effIng?.name ?? 'ماده ناشناخته'}
                                    {eff.isOverridden && origIng && effIng?.id !== origIng.id && (
                                      <span className="mr-1.5 text-[11px] text-[var(--color-accent)]">
                                        (جایگزین «{origIng.name}»)
                                      </span>
                                    )}
                                  </div>
                                  {eff.compatibilityWarning && (
                                    <div className="mt-1 flex items-center gap-1 text-[11px] text-[var(--color-warning)]">
                                      <AlertTriangle className="h-3 w-3 shrink-0" />
                                      <span>{eff.compatibilityWarning}</span>
                                    </div>
                                  )}
                                </td>

                                <td className="py-2.5 px-3 tabular-nums">
                                  {isEditingAmt ? (
                                    <div className="flex items-center gap-1.5">
                                      <Input
                                        type="number"
                                        min={0.5}
                                        step={1}
                                        value={editingIngAmount}
                                        onChange={(e) =>
                                          setEditingIngAmount(Number(e.target.value) || 0)
                                        }
                                        className="h-7 w-20 px-2 text-xs"
                                      />
                                      <Button
                                        size="sm"
                                        variant="primary"
                                        className="h-7 px-2 text-[11px]"
                                        onClick={() =>
                                          handleSaveInlineIngredientAmount(
                                            item,
                                            eff.originalIngredientId,
                                            eff.effectiveIngredientId,
                                            eff.unit
                                          )
                                        }
                                      >
                                        ثبت
                                      </Button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingIngKey(rowKey);
                                        setEditingIngAmount(eff.amount);
                                      }}
                                      title="کلیک برای تغییر مقدار"
                                      className="text-[var(--text-primary)] hover:text-[var(--color-primary)] underline decoration-dotted cursor-pointer"
                                    >
                                      {formatFaNumber(eff.amount, 1)} {UNIT_LABELS[eff.unit]}
                                    </button>
                                  )}
                                </td>

                                <td className="py-2.5 px-3 tabular-nums">
                                  <span
                                    className={
                                      pantryStatus.isEnough
                                        ? 'text-[var(--color-success)] font-medium'
                                        : 'text-[var(--color-warning)] font-medium'
                                    }
                                  >
                                    {pantryStatus.availableText}
                                  </span>
                                </td>

                                <td className="py-2.5 px-3 text-left">
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleToggleConfirmIngredient(
                                          item.id,
                                          eff.effectiveIngredientId
                                        )
                                      }
                                      className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                                        isConfirmed
                                          ? 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]'
                                          : 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                      }`}
                                    >
                                      {isConfirmed ? 'تأیید شد' : 'تأیید'}
                                    </button>
                                    {origIng && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setIngReplaceState({
                                            open: true,
                                            itemId: item.id,
                                            originalIngredient: origIng,
                                            currentIngredientId: eff.effectiveIngredientId,
                                            currentAmount: eff.amount,
                                            currentUnit: eff.unit,
                                          })
                                        }
                                        className="px-2 py-1 rounded text-[11px] font-medium border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                                      >
                                        جایگزینی
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}

            {isSnackSlot && (
              <div className="pt-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setReplaceModalState({
                      open: true,
                      itemId: '',
                      mode: 'FOOD_ITEM',
                      isAddMode: true,
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>افزودن میوه یا خوراکی دیگر</span>
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Replace Recipe or FoodItem Modal */}
      <RecipeReplaceDialog
        open={replaceModalState.open}
        onClose={() => setReplaceModalState((s) => ({ ...s, open: false }))}
        mode={replaceModalState.mode}
        slot={meal.slot}
        recipes={allRecipes}
        recipeCategories={recipeCategories}
        ingredientsById={nutritionContext.ingredientsById}
        foodItems={allFoodItems}
        currentId={replaceModalState.currentId}
        onSelectRecipe={(recipeId) => {
          if (replaceModalState.isAddMode) {
            onChangeMeal({
              ...meal,
              isConfirmed: false,
              items: [
                ...meal.items,
                {
                  id: generateId('mitem'),
                  kind: 'RECIPE',
                  recipeId,
                  portionMultiplier: 1,
                  ingredientOverrides: [],
                  confirmedIngredientIds: [],
                },
              ],
            });
          } else {
            updateItem(replaceModalState.itemId, (it) => ({
              ...it,
              recipeId,
              ingredientOverrides: [],
              confirmedIngredientIds: [],
            }));
          }
        }}
        onSelectFoodItem={(foodItemId) => {
          const food = nutritionContext.foodItemsById[foodItemId];
          if (replaceModalState.isAddMode) {
            onChangeMeal({
              ...meal,
              isConfirmed: false,
              items: [
                ...meal.items,
                {
                  id: generateId('mitem'),
                  kind: 'FOOD_ITEM',
                  foodItemId,
                  portionMultiplier: 1,
                  amount: food?.servingSize ?? 100,
                  unit: food?.unit ?? UnitType.GRAM,
                  ingredientOverrides: [],
                  confirmedIngredientIds: [],
                },
              ],
            });
          } else {
            updateItem(replaceModalState.itemId, (it) => ({
              ...it,
              foodItemId,
              amount: food?.servingSize ?? 100,
              unit: food?.unit ?? UnitType.GRAM,
            }));
          }
        }}
      />

      {/* Replace Ingredient Modal */}
      {ingReplaceState && (
        <IngredientReplaceDialog
          open={ingReplaceState.open}
          onClose={() => setIngReplaceState(null)}
          originalIngredient={ingReplaceState.originalIngredient}
          currentIngredientId={ingReplaceState.currentIngredientId}
          currentAmount={ingReplaceState.currentAmount}
          currentUnit={ingReplaceState.currentUnit}
          allIngredients={allIngredients}
          categories={ingredientCategories}
          onConfirmOverride={(override) =>
            handleApplyIngredientOverride(ingReplaceState.itemId, override)
          }
        />
      )}
    </Card>
  );
}
