import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { calculateRecipeNutritionFromIngredients } from '../../../services/domain/nutritionCalculator';
import { UNIT_LABELS } from '../../../shared/constants/units';
import {
  FoodItem,
  Ingredient,
  MealSlotType,
  Recipe,
  RecipeCategory,
} from '../../../shared/types/domain';
import { Button } from '../../../shared/components/ui/Button';
import { Input, Select } from '../../../shared/components/ui/FormControls';
import { Dialog } from '../../../shared/components/ui/Overlays';
import { formatFaNumber } from '../../../shared/utils/cn';

interface RecipeReplaceDialogProps {
  open: boolean;
  onClose: () => void;
  mode: 'RECIPE' | 'FOOD_ITEM';
  slot: MealSlotType;
  recipes: Recipe[];
  recipeCategories: RecipeCategory[];
  ingredientsById: Record<string, Ingredient>;
  foodItems: FoodItem[];
  currentId?: string;
  onSelectRecipe: (recipeId: string) => void;
  onSelectFoodItem: (foodItemId: string) => void;
}

export function RecipeReplaceDialog({
  open,
  onClose,
  mode,
  slot,
  recipes,
  recipeCategories,
  ingredientsById,
  foodItems,
  currentId,
  onSelectRecipe,
  onSelectFoodItem,
}: RecipeReplaceDialogProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [foodCatFilter, setFoodCatFilter] = useState('ALL');

  const filteredRecipes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipes
      .filter((r) => r.isActive)
      .filter((r) => categoryFilter === 'ALL' || r.categoryId === categoryFilter)
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const aFit = a.suitableSlots.includes(slot) ? 1 : 0;
        const bFit = b.suitableSlots.includes(slot) ? 1 : 0;
        return bFit - aFit;
      });
  }, [recipes, search, categoryFilter, slot]);

  const filteredFoods = useMemo(() => {
    const q = search.trim().toLowerCase();
    return foodItems
      .filter((f) => f.isActive)
      .filter((f) => foodCatFilter === 'ALL' || f.category === foodCatFilter)
      .filter((f) => !q || f.name.toLowerCase().includes(q));
  }, [foodItems, search, foodCatFilter]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === 'RECIPE' ? 'جایگزینی غذا از بانک دستور پخت' : 'انتخاب میوه یا میانوعده از بانک خوراکی‌ها'}
      description={
        mode === 'RECIPE'
          ? 'کالری، درشت‌مغذی‌ها و اندازه سروینگ هر غذا نمایش داده شده است.'
          : 'میوه یا خوراکی جایگزین را انتخاب کنید تا محاسبه روز فوراً به‌روزرسانی شود.'
      }
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          <div className="sm:col-span-7 relative">
            <Search className="h-4 w-4 text-[var(--text-muted)] absolute right-3 top-3 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={mode === 'RECIPE' ? 'جست‌وجوی نام غذا...' : 'جست‌وجوی میوه یا میانوعده...'}
              className="pr-9"
            />
          </div>
          <div className="sm:col-span-5">
            {mode === 'RECIPE' ? (
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="ALL">همه دسته‌بندی‌ها</option>
                {recipeCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            ) : (
              <Select
                value={foodCatFilter}
                onChange={(e) => setFoodCatFilter(e.target.value)}
              >
                <option value="ALL">همه خوراکی‌ها</option>
                <option value="FRUIT">میوه‌ها</option>
                <option value="NUTS_SEEDS">مغزها و آجیل</option>
                <option value="DAIRY_SNACK">لبنیات</option>
                <option value="HEALTHY_SNACK">سایر میانوعده‌ها</option>
              </Select>
            )}
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto rounded-lg border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)]">
          {mode === 'RECIPE' ? (
            filteredRecipes.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--text-muted)]">
                غذایی با این عبارت یافت نشد.
              </div>
            ) : (
              filteredRecipes.map((recipe) => {
                const { perServing } = calculateRecipeNutritionFromIngredients(
                  recipe.ingredients,
                  ingredientsById,
                  recipe.servings
                );
                const nut =
                  recipe.useManualNutrition && recipe.manualNutritionPerServing
                    ? recipe.manualNutritionPerServing
                    : perServing;
                const isCurrent = recipe.id === currentId;

                return (
                  <button
                    key={recipe.id}
                    type="button"
                    onClick={() => {
                      onSelectRecipe(recipe.id);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between gap-4 px-4 py-3 text-right transition-colors cursor-pointer ${
                      isCurrent
                        ? 'bg-[var(--color-primary-subtle)]'
                        : 'hover:bg-[var(--bg-surface-muted)]'
                    }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--text-primary)]">
                          {recipe.name}
                        </span>
                        {recipe.suitableSlots.includes(slot) && (
                          <span className="text-[11px] text-[var(--color-primary)]">
                            · مناسب این وعده
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] tabular-nums">
                        ۱ سروینگ · {formatFaNumber(nut.calories)} کالری · پروتئین {formatFaNumber(nut.protein)} گ · کربو {formatFaNumber(nut.carbs)} گ · چربی {formatFaNumber(nut.fat)} گ
                      </div>
                    </div>
                    {isCurrent ? (
                      <Check className="h-4 w-4 text-[var(--color-primary)] shrink-0" />
                    ) : (
                      <span className="text-xs font-medium text-[var(--color-primary)] shrink-0">
                        انتخاب
                      </span>
                    )}
                  </button>
                );
              })
            )
          ) : filteredFoods.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--text-muted)]">
              خوراکی با این عبارت یافت نشد.
            </div>
          ) : (
            filteredFoods.map((food) => {
              const nut = food.nutritionPerServing;
              const isCurrent = food.id === currentId;
              return (
                <button
                  key={food.id}
                  type="button"
                  onClick={() => {
                    onSelectFoodItem(food.id);
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between gap-4 px-4 py-3 text-right transition-colors cursor-pointer ${
                    isCurrent
                      ? 'bg-[var(--color-primary-subtle)]'
                      : 'hover:bg-[var(--bg-surface-muted)]'
                  }`}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="text-sm font-semibold text-[var(--text-primary)]">
                      {food.name}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] tabular-nums">
                      واحد مصرف: {formatFaNumber(food.servingSize)} {UNIT_LABELS[food.unit]}
                      {nut
                        ? ` · ${formatFaNumber(nut.calories)} کالری · پروتئین ${formatFaNumber(nut.protein)} گ · کربو ${formatFaNumber(nut.carbs)} گ`
                        : ' · اطلاعات تغذیه‌ای ثبت‌نشده'}
                    </div>
                  </div>
                  <span className="text-xs font-medium text-[var(--color-primary)] shrink-0">
                    انتخاب
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            بستن
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
