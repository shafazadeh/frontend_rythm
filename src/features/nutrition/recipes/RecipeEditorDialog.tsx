import { useEffect, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  calculateRecipeNutritionFromIngredients,
  checkNutritionDiscrepancy,
} from '../../../services/domain/nutritionCalculator';
import {
  ALLERGEN_LABELS,
  MEAL_SLOT_LABELS,
  MEAL_SLOT_ORDER,
  UNIT_LABELS,
} from '../../../shared/constants/units';
import {
  AllergenType,
  Ingredient,
  MealSlotType,
  Recipe,
  RecipeCategory,
  UnitType,
} from '../../../shared/types/domain';
import { recipeFormSchema } from '../../../shared/validation/schemas';
import { Button } from '../../../shared/components/ui/Button';
import {
  Checkbox,
  Input,
  Label,
  Select,
  Switch,
  Textarea,
} from '../../../shared/components/ui/FormControls';
import { Dialog } from '../../../shared/components/ui/Overlays';
import { formatFaNumber, generateId } from '../../../shared/utils/cn';

type RecipeFormValues = z.infer<typeof recipeFormSchema>;

interface RecipeEditorDialogProps {
  open: boolean;
  onClose: () => void;
  recipe: Recipe | null;
  categories: RecipeCategory[];
  ingredients: Ingredient[];
  onSave: (recipe: Recipe) => Promise<void>;
}

export function RecipeEditorDialog({
  open,
  onClose,
  recipe,
  categories,
  ingredients,
  onSave,
}: RecipeEditorDialogProps) {
  const ingredientsById = useMemo(
    () => Object.fromEntries(ingredients.map((i) => [i.id, i])),
    [ingredients]
  );

  const form = useForm<RecipeFormValues>({
    resolver: zodResolver(recipeFormSchema),
    defaultValues: {
      name: '',
      categoryId: categories[0]?.id ?? 'rec_cat_main',
      description: '',
      imageUrl: '',
      servings: 1,
      prepTimeMinutes: 15,
      cookTimeMinutes: 20,
      ingredients: [
        {
          id: generateId('ri'),
          ingredientId: ingredients[0]?.id ?? '',
          amount: 100,
          unit: ingredients[0]?.defaultUnit ?? UnitType.GRAM,
          isOptional: false,
        },
      ],
      steps: [{ id: generateId('st'), stepNumber: 1, instruction: '' }],
      useManualNutrition: false,
      manualCalories: 0,
      manualProtein: 0,
      manualCarbs: 0,
      manualFat: 0,
      manualFiber: 0,
      suitableSlots: [MealSlotType.LUNCH],
      allergens: [],
      tagsText: '',
      isFavorite: false,
      isDisliked: false,
      isActive: true,
      notes: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    if (recipe) {
      form.reset({
        name: recipe.name,
        categoryId: recipe.categoryId,
        description: recipe.description ?? '',
        imageUrl: recipe.imageUrl ?? '',
        servings: recipe.servings,
        prepTimeMinutes: recipe.prepTimeMinutes,
        cookTimeMinutes: recipe.cookTimeMinutes,
        ingredients: recipe.ingredients.map((ri) => ({ ...ri })),
        steps: recipe.steps.map((s) => ({ ...s })),
        useManualNutrition: recipe.useManualNutrition,
        manualCalories: recipe.manualNutritionPerServing?.calories ?? 0,
        manualProtein: recipe.manualNutritionPerServing?.protein ?? 0,
        manualCarbs: recipe.manualNutritionPerServing?.carbs ?? 0,
        manualFat: recipe.manualNutritionPerServing?.fat ?? 0,
        manualFiber: recipe.manualNutritionPerServing?.fiber ?? 0,
        suitableSlots: recipe.suitableSlots,
        allergens: recipe.allergens,
        tagsText: recipe.tags.join('، '),
        isFavorite: recipe.isFavorite,
        isDisliked: recipe.isDisliked,
        isActive: recipe.isActive,
        notes: recipe.notes ?? '',
      });
    } else {
      form.reset({
        name: '',
        categoryId: categories[0]?.id ?? 'rec_cat_main',
        description: '',
        imageUrl: '',
        servings: 1,
        prepTimeMinutes: 15,
        cookTimeMinutes: 20,
        ingredients: [
          {
            id: generateId('ri'),
            ingredientId: ingredients[0]?.id ?? '',
            amount: 100,
            unit: ingredients[0]?.defaultUnit ?? UnitType.GRAM,
            isOptional: false,
          },
        ],
        steps: [{ id: generateId('st'), stepNumber: 1, instruction: '' }],
        useManualNutrition: false,
        manualCalories: 0,
        manualProtein: 0,
        manualCarbs: 0,
        manualFat: 0,
        manualFiber: 0,
        suitableSlots: [MealSlotType.LUNCH],
        allergens: [],
        tagsText: '',
        isFavorite: false,
        isDisliked: false,
        isActive: true,
        notes: '',
      });
    }
  }, [open, recipe, categories, ingredients, form]);

  const ingArray = useFieldArray({ control: form.control, name: 'ingredients' });
  const stepArray = useFieldArray({ control: form.control, name: 'steps' });

  const watchedIngredients = form.watch('ingredients');
  const watchedServings = Number(form.watch('servings')) || 1;
  const watchedUseManual = form.watch('useManualNutrition');
  const watchedManualCalories = Number(form.watch('manualCalories')) || 0;

  const calculated = calculateRecipeNutritionFromIngredients(
    watchedIngredients.map((ri) => ({
      ...ri,
      amount: Number(ri.amount) || 0,
    })),
    ingredientsById,
    watchedServings
  );

  const discrepancy = watchedUseManual
    ? checkNutritionDiscrepancy(calculated.perServing, {
        calories: watchedManualCalories,
        protein: Number(form.watch('manualProtein')) || 0,
        carbs: Number(form.watch('manualCarbs')) || 0,
        fat: Number(form.watch('manualFat')) || 0,
      })
    : { hasDiscrepancy: false, differencePercent: 0, message: undefined as string | undefined };

  const handleSubmit = form.handleSubmit(async (values) => {
    const now = new Date().toISOString();
    const payload: Recipe = {
      id: recipe?.id ?? generateId('rec'),
      name: values.name,
      categoryId: values.categoryId,
      description: values.description || undefined,
      imageUrl: values.imageUrl || undefined,
      servings: values.servings,
      prepTimeMinutes: values.prepTimeMinutes,
      cookTimeMinutes: values.cookTimeMinutes,
      ingredients: values.ingredients,
      steps: values.steps.map((s, idx) => ({ ...s, stepNumber: idx + 1 })),
      useManualNutrition: values.useManualNutrition,
      manualNutritionPerServing: values.useManualNutrition
        ? {
            calories: values.manualCalories ?? 0,
            protein: values.manualProtein ?? 0,
            carbs: values.manualCarbs ?? 0,
            fat: values.manualFat ?? 0,
            fiber: values.manualFiber ?? 0,
          }
        : undefined,
      tags: (values.tagsText ?? '')
        .split(/[،,]/)
        .map((t) => t.trim())
        .filter(Boolean),
      suitableSlots: values.suitableSlots,
      allergens: values.allergens,
      isFavorite: values.isFavorite,
      isDisliked: values.isDisliked,
      isActive: values.isActive,
      notes: values.notes || undefined,
      version: recipe?.version ?? 1,
      createdAt: recipe?.createdAt ?? now,
      updatedAt: now,
    };
    await onSave(payload);
    onClose();
  });

  const toggleSlot = (slot: MealSlotType) => {
    const current = form.getValues('suitableSlots');
    const exists = current.includes(slot);
    form.setValue(
      'suitableSlots',
      exists ? current.filter((s) => s !== slot) : [...current, slot],
      { shouldValidate: true }
    );
  };

  const toggleAllergen = (allergen: AllergenType) => {
    const current = form.getValues('allergens');
    const exists = current.includes(allergen);
    form.setValue(
      'allergens',
      exists ? current.filter((a) => a !== allergen) : [...current, allergen]
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={recipe ? `ویرایش «${recipe.name}»` : 'ایجاد غذای جدید'}
      description="فرم ساختاریافته مدیریت دستور پخت، مواد اولیه و اطلاعات تغذیه‌ای"
      maxWidthClass="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Basic Info */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold border-b border-[var(--border-subtle)] pb-1.5">
            ۱. اطلاعات پایه
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="rec-name">نام غذا (اجباری)</Label>
              <Input id="rec-name" {...form.register('name')} />
              {form.formState.errors.name && (
                <p className="mt-1 text-xs text-[var(--color-error)]">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="rec-cat">دسته‌بندی</Label>
              <Select id="rec-cat" {...form.register('categoryId')}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="rec-desc">توضیح کوتاه</Label>
            <Input id="rec-desc" {...form.register('description')} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="rec-serv">تعداد سروینگ</Label>
              <Input id="rec-serv" type="number" min={1} {...form.register('servings', { valueAsNumber: true })} />
            </div>
            <div>
              <Label htmlFor="rec-prep">زمان آماده‌سازی (دقیقه)</Label>
              <Input id="rec-prep" type="number" min={0} {...form.register('prepTimeMinutes', { valueAsNumber: true })} />
            </div>
            <div>
              <Label htmlFor="rec-cook">زمان پخت (دقیقه)</Label>
              <Input id="rec-cook" type="number" min={0} {...form.register('cookTimeMinutes', { valueAsNumber: true })} />
            </div>
          </div>
        </section>

        {/* Section 2: Dynamic Ingredients */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-1.5">
            <h3 className="text-sm font-semibold">۲. مواد اولیه (برای کل دستور)</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                ingArray.append({
                  id: generateId('ri'),
                  ingredientId: ingredients[0]?.id ?? '',
                  amount: 100,
                  unit: ingredients[0]?.defaultUnit ?? UnitType.GRAM,
                  isOptional: false,
                })
              }
            >
              <Plus className="h-3.5 w-3.5" />
              <span>افزودن ماده</span>
            </Button>
          </div>

          <div className="space-y-2">
            {ingArray.fields.map((field, idx) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5">
                  <Select
                    {...form.register(`ingredients.${idx}.ingredientId`)}
                    onChange={(e) => {
                      form.setValue(`ingredients.${idx}.ingredientId`, e.target.value);
                      const ing = ingredientsById[e.target.value];
                      if (ing) form.setValue(`ingredients.${idx}.unit`, ing.defaultUnit);
                    }}
                  >
                    {ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="col-span-3">
                  <Input
                    type="number"
                    step={0.5}
                    {...form.register(`ingredients.${idx}.amount`, { valueAsNumber: true })}
                    placeholder="مقدار"
                  />
                </div>
                <div className="col-span-3">
                  <Select {...form.register(`ingredients.${idx}.unit`)}>
                    {Object.entries(UNIT_LABELS).map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={ingArray.fields.length <= 1}
                    onClick={() => ingArray.remove(idx)}
                    aria-label="حذف ماده"
                  >
                    <Trash2 className="h-4 w-4 text-[var(--text-muted)]" />
                  </Button>
                </div>
              </div>
            ))}
            {form.formState.errors.ingredients && (
              <p className="text-xs text-[var(--color-error)]">
                لطفاً اطلاعات مواد اولیه را کامل کنید.
              </p>
            )}
          </div>
        </section>

        {/* Section 3: Recipe Steps */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-1.5">
            <h3 className="text-sm font-semibold">۳. مراحل دستور پخت</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                stepArray.append({
                  id: generateId('st'),
                  stepNumber: stepArray.fields.length + 1,
                  instruction: '',
                })
              }
            >
              <Plus className="h-3.5 w-3.5" />
              <span>افزودن مرحله</span>
            </Button>
          </div>

          <div className="space-y-2">
            {stepArray.fields.map((field, idx) => (
              <div key={field.id} className="flex items-start gap-2">
                <span className="mt-2.5 text-xs font-semibold tabular-nums text-[var(--text-muted)] w-5">
                  {formatFaNumber(idx + 1)}.
                </span>
                <Textarea
                  rows={2}
                  className="min-h-[60px] flex-1"
                  {...form.register(`steps.${idx}.instruction`)}
                  placeholder="توضیح مرحله پخت..."
                />
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => stepArray.move(idx, idx - 1)}
                    aria-label="بالا بردن مرحله"
                    className="p-1 rounded hover:bg-[var(--bg-surface-muted)] disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === stepArray.fields.length - 1}
                    onClick={() => stepArray.move(idx, idx + 1)}
                    aria-label="پایین بردن مرحله"
                    className="p-1 rounded hover:bg-[var(--bg-surface-muted)] disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={stepArray.fields.length <= 1}
                    onClick={() => stepArray.remove(idx)}
                    aria-label="حذف مرحله"
                    className="p-1 rounded hover:bg-[var(--bg-surface-muted)] text-[var(--text-muted)] disabled:opacity-30 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Nutrition */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-1.5">
            <h3 className="text-sm font-semibold">۴. اطلاعات تغذیه‌ای</h3>
            <div className="flex items-center gap-2 text-xs">
              <span>ثبت دستی تأییدشده</span>
              <Switch
                checked={watchedUseManual}
                onCheckedChange={(v) => form.setValue('useManualNutrition', v)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs rounded-lg bg-[var(--bg-surface-muted)]/60 p-3">
            <div>
              <div className="font-semibold text-[var(--text-secondary)]">
                محاسبه‌شده از مواد اولیه (هر سروینگ):
              </div>
              <div className="mt-1 tabular-nums text-[var(--text-primary)]">
                {formatFaNumber(calculated.perServing.calories)} کالری · پروتئین{' '}
                {formatFaNumber(calculated.perServing.protein)} گ · کربو{' '}
                {formatFaNumber(calculated.perServing.carbs)} گ · چربی{' '}
                {formatFaNumber(calculated.perServing.fat)} گ
              </div>
            </div>
            <div>
              <div className="font-semibold text-[var(--text-secondary)]">
                کل دستور ({formatFaNumber(watchedServings)} سروینگ):
              </div>
              <div className="mt-1 tabular-nums text-[var(--text-primary)]">
                {formatFaNumber(calculated.total.calories)} کالری · پروتئین{' '}
                {formatFaNumber(calculated.total.protein)} گ
              </div>
            </div>
          </div>

          {watchedUseManual && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div>
                <Label>کالری (سروینگ)</Label>
                <Input
                  type="number"
                  {...form.register('manualCalories', {
                    setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
                  })}
                />
              </div>
              <div>
                <Label>پروتئین (گ)</Label>
                <Input
                  type="number"
                  {...form.register('manualProtein', {
                    setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
                  })}
                />
              </div>
              <div>
                <Label>کربوهیدرات (گ)</Label>
                <Input
                  type="number"
                  {...form.register('manualCarbs', {
                    setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
                  })}
                />
              </div>
              <div>
                <Label>چربی (گ)</Label>
                <Input
                  type="number"
                  {...form.register('manualFat', {
                    setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
                  })}
                />
              </div>
              <div>
                <Label>فیبر (گ)</Label>
                <Input
                  type="number"
                  {...form.register('manualFiber', {
                    setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
                  })}
                />
              </div>
            </div>
          )}

          {discrepancy.hasDiscrepancy && (
            <div className="flex items-start gap-2 rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-warning-subtle)] p-3 text-xs text-[var(--color-warning)]">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                {discrepancy.message} منبع فعال فعلی: مقادیر دستی کاربر.
              </span>
            </div>
          )}
        </section>

        {/* Section 5: Preferences & Tags */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold border-b border-[var(--border-subtle)] pb-1.5">
            ۵. وعده‌های مناسب، آلرژن‌ها و برچسب‌ها
          </h3>

          <div>
            <Label>مناسب برای وعده‌های</Label>
            <div className="flex flex-wrap gap-3 pt-1">
              {MEAL_SLOT_ORDER.map((slot) => (
                <label key={slot} className="inline-flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={form.watch('suitableSlots').includes(slot)}
                    onCheckedChange={() => toggleSlot(slot)}
                  />
                  <span>{MEAL_SLOT_LABELS[slot]}</span>
                </label>
              ))}
            </div>
            {form.formState.errors.suitableSlots && (
              <p className="mt-1 text-xs text-[var(--color-error)]">
                {form.formState.errors.suitableSlots.message}
              </p>
            )}
          </div>

          <div>
            <Label>آلرژن‌های موجود</Label>
            <div className="flex flex-wrap gap-3 pt-1">
              {Object.values(AllergenType).map((alg) => (
                <label key={alg} className="inline-flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={form.watch('allergens').includes(alg)}
                    onCheckedChange={() => toggleAllergen(alg)}
                  />
                  <span>{ALLERGEN_LABELS[alg]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="rec-tags">برچسب‌ها (با ویرگول جدا کنید)</Label>
              <Input id="rec-tags" {...form.register('tagsText')} placeholder="سنتی، پروتئین بالا" />
            </div>
            <div className="flex items-center gap-6 pt-5 text-xs">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={form.watch('isFavorite')}
                  onCheckedChange={(v) => form.setValue('isFavorite', v)}
                />
                <span>موردعلاقه</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={form.watch('isDisliked')}
                  onCheckedChange={(v) => form.setValue('isDisliked', v)}
                />
                <span>عدم تمایل</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={form.watch('isActive')}
                  onCheckedChange={(v) => form.setValue('isActive', v)}
                />
                <span>فعال</span>
              </label>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
          <Button variant="ghost" onClick={onClose}>
            انصراف
          </Button>
          <Button type="submit">ذخیره غذا</Button>
        </div>
      </form>
    </Dialog>
  );
}
