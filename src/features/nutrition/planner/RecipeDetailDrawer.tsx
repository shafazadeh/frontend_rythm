import { Clock, Users } from 'lucide-react';
import { calculateRecipeNutritionFromIngredients } from '../../../services/domain/nutritionCalculator';
import { UNIT_LABELS } from '../../../shared/constants/units';
import { Ingredient, Recipe } from '../../../shared/types/domain';
import { Sheet } from '../../../shared/components/ui/Overlays';
import { RecipeThumbnail } from '../../../shared/components/RecipeThumbnail';
import { formatFaNumber } from '../../../shared/utils/cn';

interface RecipeDetailDrawerProps {
  recipe: Recipe | null;
  ingredientsById: Record<string, Ingredient>;
  onClose: () => void;
}

export function RecipeDetailDrawer({
  recipe,
  ingredientsById,
  onClose,
}: RecipeDetailDrawerProps) {
  if (!recipe) return null;

  const { perServing } = calculateRecipeNutritionFromIngredients(
    recipe.ingredients,
    ingredientsById,
    recipe.servings
  );

  const displayNutrition =
    recipe.useManualNutrition && recipe.manualNutritionPerServing
      ? recipe.manualNutritionPerServing
      : perServing;

  return (
    <Sheet
      open={Boolean(recipe)}
      onClose={onClose}
      title={recipe.name}
      subtitle={recipe.description}
    >
      <div className="space-y-6">
        {recipe.imageUrl && (
          <RecipeThumbnail
            src={recipe.imageUrl}
            alt={recipe.name}
            className="w-full h-48"
          />
        )}

        {/* Meta strip */}
        <div className="grid grid-cols-3 gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]/60 p-3 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-xs text-[var(--text-muted)]">
              <Clock className="h-3.5 w-3.5" />
              <span>آماده‌سازی</span>
            </div>
            <div className="mt-1 text-sm font-semibold tabular-nums">
              {formatFaNumber(recipe.prepTimeMinutes)} دقیقه
            </div>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-xs text-[var(--text-muted)]">
              <Clock className="h-3.5 w-3.5" />
              <span>زمان پخت</span>
            </div>
            <div className="mt-1 text-sm font-semibold tabular-nums">
              {formatFaNumber(recipe.cookTimeMinutes)} دقیقه
            </div>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-xs text-[var(--text-muted)]">
              <Users className="h-3.5 w-3.5" />
              <span>تعداد سروینگ</span>
            </div>
            <div className="mt-1 text-sm font-semibold tabular-nums">
              {formatFaNumber(recipe.servings)} نفر
            </div>
          </div>
        </div>

        {/* Nutrition per serving */}
        <div>
          <h4 className="text-xs font-semibold text-[var(--text-muted)] mb-2">
            اطلاعات تغذیه‌ای هر سروینگ
          </h4>
          <div className="grid grid-cols-4 gap-2 text-center rounded-lg border border-[var(--border-subtle)] p-3">
            <div>
              <div className="text-sm font-bold tabular-nums text-[var(--text-primary)]">
                {formatFaNumber(displayNutrition.calories)}
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">کالری</div>
            </div>
            <div>
              <div className="text-sm font-bold tabular-nums text-[var(--color-primary)]">
                {formatFaNumber(displayNutrition.protein)} گ
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">پروتئین</div>
            </div>
            <div>
              <div className="text-sm font-bold tabular-nums text-[var(--color-accent)]">
                {formatFaNumber(displayNutrition.carbs)} گ
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">کربوهیدرات</div>
            </div>
            <div>
              <div className="text-sm font-bold tabular-nums text-[var(--color-warning)]">
                {formatFaNumber(displayNutrition.fat)} گ
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">چربی</div>
            </div>
          </div>
        </div>

        {/* Ingredients */}
        <div>
          <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2.5">
            مواد اولیه ({formatFaNumber(recipe.servings)} سروینگ)
          </h4>
          <ul className="divide-y divide-[var(--border-subtle)] rounded-lg border border-[var(--border-subtle)]">
            {recipe.ingredients.map((ri) => {
              const ing = ingredientsById[ri.ingredientId];
              return (
                <li key={ri.id} className="flex items-center justify-between px-3.5 py-2.5 text-sm">
                  <span className="text-[var(--text-primary)]">
                    {ing?.name ?? 'ماده ناشناخته'}
                    {ri.isOptional && (
                      <span className="mr-1.5 text-xs text-[var(--text-muted)]">(اختیاری)</span>
                    )}
                  </span>
                  <span className="text-xs font-medium text-[var(--text-secondary)] tabular-nums">
                    {formatFaNumber(ri.amount)} {UNIT_LABELS[ri.unit]}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Steps */}
        <div>
          <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2.5">
            مراحل تهیه
          </h4>
          <ol className="space-y-3">
            {recipe.steps.map((step) => (
              <li
                key={step.id}
                className="flex gap-3 rounded-lg bg-[var(--bg-surface-muted)]/60 p-3 text-sm leading-relaxed"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-subtle)] text-xs font-semibold text-[var(--color-primary)] tabular-nums">
                  {formatFaNumber(step.stepNumber)}
                </span>
                <span className="text-[var(--text-primary)]">{step.instruction}</span>
              </li>
            ))}
          </ol>
        </div>

        {recipe.notes && (
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]/40 p-3 text-xs text-[var(--text-secondary)] leading-relaxed">
            <span className="font-semibold text-[var(--text-primary)]">نکته: </span>
            {recipe.notes}
          </div>
        )}
      </div>
    </Sheet>
  );
}
