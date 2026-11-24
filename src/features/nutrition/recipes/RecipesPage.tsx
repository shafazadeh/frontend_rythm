import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  BookOpen,
  Edit3,
  Heart,
  LayoutGrid,
  List,
  Plus,
  Search,
  Trash2,
  Utensils,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRhythmData, useRhythmMutations } from '../../../services/api/useRhythmQueries';
import { calculateRecipeNutritionFromIngredients } from '../../../services/domain/nutritionCalculator';
import { UNIT_LABELS } from '../../../shared/constants/units';
import { Ingredient, Recipe, UnitType } from '../../../shared/types/domain';
import { ingredientFormSchema } from '../../../shared/validation/schemas';
import { Button } from '../../../shared/components/ui/Button';
import { Card, CardContent } from '../../../shared/components/ui/Card';
import { Input, Label, Select, Skeleton, Switch } from '../../../shared/components/ui/FormControls';
import { ConfirmDialog, Dialog, EmptyState } from '../../../shared/components/ui/Overlays';
import { RecipeThumbnail } from '../../../shared/components/RecipeThumbnail';
import { formatFaNumber, generateId } from '../../../shared/utils/cn';
import { RecipeDetailDrawer } from '../planner/RecipeDetailDrawer';
import { RecipeEditorDialog } from './RecipeEditorDialog';

type IngredientFormValues = z.infer<typeof ingredientFormSchema>;

export function RecipesPage() {
  const { data, isLoading } = useRhythmData();
  const { upsertRecipe, deleteRecipe, upsertIngredient, deleteIngredient } = useRhythmMutations();

  const [activeTab, setActiveTab] = useState<'RECIPES' | 'INGREDIENTS'>('RECIPES');
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('GRID');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'NAME' | 'CALORIES' | 'TIME'>('NAME');

  const [drawerRecipe, setDrawerRecipe] = useState<Recipe | null>(null);
  const [editorRecipe, setEditorRecipe] = useState<Recipe | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteTargetRecipe, setDeleteTargetRecipe] = useState<Recipe | null>(null);

  // Ingredient editor state
  const [ingEditorOpen, setIngEditorOpen] = useState(false);
  const [editingIng, setEditingIng] = useState<Ingredient | null>(null);
  const [deleteTargetIng, setDeleteTargetIng] = useState<Ingredient | null>(null);

  const ingForm = useForm<IngredientFormValues>({
    resolver: zodResolver(ingredientFormSchema),
    defaultValues: {
      name: '',
      categoryId: 'ing_cat_veg',
      shoppingCategoryId: 'shop_cat_produce',
      defaultUnit: UnitType.GRAM,
      referenceAmount: 100,
      referenceUnit: UnitType.GRAM,
      gramsPerUnit: '',
      calories: '',
      protein: '',
      carbs: '',
      fat: '',
      fiber: '',
      allergens: [],
      isActive: true,
    },
  });

  const ingredientsById = useMemo(
    () => Object.fromEntries((data?.ingredients ?? []).map((i) => [i.id, i])),
    [data?.ingredients]
  );

  const categoriesById = useMemo(
    () => Object.fromEntries((data?.recipeCategories ?? []).map((c) => [c.id, c])),
    [data?.recipeCategories]
  );

  const enrichedRecipes = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.recipes
      .filter((r) => categoryFilter === 'ALL' || r.categoryId === categoryFilter)
      .filter(
        (r) =>
          !q ||
          r.name.toLowerCase().includes(q) ||
          r.tags.some((t) => t.toLowerCase().includes(q))
      )
      .map((r) => {
        const calc = calculateRecipeNutritionFromIngredients(
          r.ingredients,
          ingredientsById,
          r.servings
        );
        const nutrition =
          r.useManualNutrition && r.manualNutritionPerServing
            ? r.manualNutritionPerServing
            : calc.perServing;
        return { recipe: r, nutrition };
      })
      .sort((a, b) => {
        if (sortBy === 'CALORIES') return b.nutrition.calories - a.nutrition.calories;
        if (sortBy === 'TIME')
          return (
            a.recipe.prepTimeMinutes +
            a.recipe.cookTimeMinutes -
            (b.recipe.prepTimeMinutes + b.recipe.cookTimeMinutes)
          );
        return a.recipe.name.localeCompare(b.recipe.name, 'fa');
      });
  }, [data, search, categoryFilter, sortBy, ingredientsById]);

  const filteredIngredients = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.ingredients.filter((i) => !q || i.name.toLowerCase().includes(q));
  }, [data, search]);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((k) => (
            <Skeleton key={k} className="h-56 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const openNewIngredient = () => {
    setEditingIng(null);
    ingForm.reset({
      name: '',
      categoryId: data.ingredientCategories[0]?.id ?? 'ing_cat_veg',
      shoppingCategoryId: data.shoppingCategories[0]?.id ?? 'shop_cat_produce',
      defaultUnit: UnitType.GRAM,
      referenceAmount: 100,
      referenceUnit: UnitType.GRAM,
      gramsPerUnit: '',
      calories: '',
      protein: '',
      carbs: '',
      fat: '',
      fiber: '',
      allergens: [],
      isActive: true,
    });
    setIngEditorOpen(true);
  };

  const openEditIngredient = (ing: Ingredient) => {
    setEditingIng(ing);
    ingForm.reset({
      name: ing.name,
      categoryId: ing.categoryId,
      shoppingCategoryId: ing.shoppingCategoryId,
      defaultUnit: ing.defaultUnit,
      referenceAmount: ing.referenceAmount,
      referenceUnit: ing.referenceUnit,
      gramsPerUnit: ing.gramsPerUnit !== undefined ? String(ing.gramsPerUnit) : '',
      calories:
        ing.nutritionPerReference?.calories !== undefined
          ? String(ing.nutritionPerReference.calories)
          : '',
      protein:
        ing.nutritionPerReference?.protein !== undefined
          ? String(ing.nutritionPerReference.protein)
          : '',
      carbs:
        ing.nutritionPerReference?.carbs !== undefined
          ? String(ing.nutritionPerReference.carbs)
          : '',
      fat:
        ing.nutritionPerReference?.fat !== undefined
          ? String(ing.nutritionPerReference.fat)
          : '',
      fiber:
        ing.nutritionPerReference?.fiber !== undefined
          ? String(ing.nutritionPerReference.fiber)
          : '',
      allergens: ing.allergens,
      isActive: ing.isActive,
    });
    setIngEditorOpen(true);
  };

  const handleSaveIngredient = ingForm.handleSubmit(async (values) => {
    const hasCal = Boolean(values.calories?.trim());
    const now = new Date().toISOString();
    await upsertIngredient.mutateAsync({
      id: editingIng?.id ?? generateId('ing'),
      name: values.name,
      categoryId: values.categoryId,
      shoppingCategoryId: values.shoppingCategoryId,
      defaultUnit: values.defaultUnit,
      referenceAmount: values.referenceAmount,
      referenceUnit: values.referenceUnit,
      gramsPerUnit: values.gramsPerUnit?.trim() ? Number(values.gramsPerUnit) : undefined,
      nutritionPerReference: hasCal
        ? {
            calories: Number(values.calories) || 0,
            protein: Number(values.protein) || 0,
            carbs: Number(values.carbs) || 0,
            fat: Number(values.fat) || 0,
            fiber: Number(values.fiber) || 0,
          }
        : undefined,
      allergens: values.allergens,
      compatibleSubstituteIds: editingIng?.compatibleSubstituteIds ?? [],
      isActive: values.isActive,
      createdAt: editingIng?.createdAt ?? now,
      updatedAt: now,
    });
    setIngEditorOpen(false);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
            بانک غذاها و مواد اولیه
          </h1>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            مدیریت مستقل دستورهای غذایی و کاتالوگ مواد اولیه با محاسبه خودکار ارزش تغذیه‌ای
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-[var(--bg-surface-muted)] p-1">
            <button
              type="button"
              onClick={() => setActiveTab('RECIPES')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                activeTab === 'RECIPES'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              غذاها ({formatFaNumber(data.recipes.length)})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('INGREDIENTS')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                activeTab === 'INGREDIENTS'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              مواد اولیه ({formatFaNumber(data.ingredients.length)})
            </button>
          </div>

          {activeTab === 'RECIPES' ? (
            <Button
              size="sm"
              onClick={() => {
                setEditorRecipe(null);
                setEditorOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              <span>غذای جدید</span>
            </Button>
          ) : (
            <Button size="sm" onClick={openNewIngredient}>
              <Plus className="h-4 w-4" />
              <span>ماده اولیه جدید</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-5 relative">
            <Search className="h-4 w-4 text-[var(--text-muted)] absolute right-3 top-3 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                activeTab === 'RECIPES'
                  ? 'جست‌وجوی نام غذا یا برچسب...'
                  : 'جست‌وجو در بانک مواد اولیه...'
              }
              className="pr-9"
            />
          </div>

          {activeTab === 'RECIPES' && (
            <>
              <div className="md:col-span-3">
                <Select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="ALL">همه دسته‌بندی‌ها</option>
                  {data.recipeCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="md:col-span-2">
                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                >
                  <option value="NAME">الفبایی</option>
                  <option value="CALORIES">بیشترین کالری</option>
                  <option value="TIME">سریع‌ترین تهیه</option>
                </Select>
              </div>
              <div className="md:col-span-2 flex justify-end gap-1">
                <Button
                  size="icon"
                  variant={viewMode === 'GRID' ? 'secondary' : 'ghost'}
                  onClick={() => setViewMode('GRID')}
                  aria-label="نمای شبکه‌ای"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant={viewMode === 'TABLE' ? 'secondary' : 'ghost'}
                  onClick={() => setViewMode('TABLE')}
                  aria-label="نمای جدولی"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* RECIPES TAB */}
      {activeTab === 'RECIPES' &&
        (enrichedRecipes.length === 0 ? (
          <EmptyState
            icon={<Utensils className="h-6 w-6" />}
            title="غذایی یافت نشد"
            description="فیلترها را تغییر دهید یا یک دستور غذای جدید به بانک اضافه کنید."
          />
        ) : viewMode === 'GRID' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {enrichedRecipes.map(({ recipe, nutrition }) => {
              const cat = categoriesById[recipe.categoryId];
              return (
                <Card key={recipe.id} className="overflow-hidden flex flex-col justify-between">
                  <div>
                    <RecipeThumbnail
                      src={recipe.imageUrl}
                      alt={recipe.name}
                      className="w-full h-40 rounded-none border-0 border-b border-[var(--border-subtle)]"
                    />
                    <div className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-bold text-[var(--text-primary)] leading-snug">
                          {recipe.name}
                        </h3>
                        {recipe.isFavorite && (
                          <Heart className="h-4 w-4 text-[var(--color-error)] fill-current shrink-0" />
                        )}
                      </div>

                      <div className="text-xs text-[var(--text-muted)]">
                        {cat?.name ?? 'سایر'} · {formatFaNumber(recipe.servings)} سروینگ ·{' '}
                        {formatFaNumber(recipe.prepTimeMinutes + recipe.cookTimeMinutes)} دقیقه
                      </div>

                      <div className="grid grid-cols-4 gap-1.5 rounded-lg bg-[var(--bg-surface-muted)]/60 p-2 text-center text-[11px] tabular-nums">
                        <div>
                          <div className="font-bold text-[var(--text-primary)]">
                            {formatFaNumber(nutrition.calories)}
                          </div>
                          <div className="text-[var(--text-muted)]">کالری</div>
                        </div>
                        <div>
                          <div className="font-bold text-[var(--color-primary)]">
                            {formatFaNumber(nutrition.protein)}گ
                          </div>
                          <div className="text-[var(--text-muted)]">پروتئین</div>
                        </div>
                        <div>
                          <div className="font-bold text-[var(--color-accent)]">
                            {formatFaNumber(nutrition.carbs)}گ
                          </div>
                          <div className="text-[var(--text-muted)]">کربو</div>
                        </div>
                        <div>
                          <div className="font-bold text-[var(--color-warning)]">
                            {formatFaNumber(nutrition.fat)}گ
                          </div>
                          <div className="text-[var(--text-muted)]">چربی</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-subtle)]">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDrawerRecipe(recipe)}
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>جزئیات</span>
                    </Button>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="ویرایش غذا"
                        onClick={() => {
                          setEditorRecipe(recipe);
                          setEditorOpen(true);
                        }}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="حذف غذا"
                        onClick={() => setDeleteTargetRecipe(recipe)}
                      >
                        <Trash2 className="h-4 w-4 text-[var(--text-muted)]" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-[var(--bg-surface-muted)]/70 border-b border-[var(--border-subtle)] text-[var(--text-secondary)]">
                  <tr>
                    <th className="py-3 px-4 font-medium">نام غذا</th>
                    <th className="py-3 px-4 font-medium">دسته‌بندی</th>
                    <th className="py-3 px-4 font-medium">کالری</th>
                    <th className="py-3 px-4 font-medium">پروتئین / کربو / چربی</th>
                    <th className="py-3 px-4 font-medium">زمان کل</th>
                    <th className="py-3 px-4 font-medium">وضعیت</th>
                    <th className="py-3 px-4 font-medium text-left">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {enrichedRecipes.map(({ recipe, nutrition }) => (
                    <tr key={recipe.id} className="hover:bg-[var(--bg-surface-muted)]/40">
                      <td className="py-3 px-4 font-semibold text-sm text-[var(--text-primary)]">
                        {recipe.name}
                      </td>
                      <td className="py-3 px-4 text-[var(--text-secondary)]">
                        {categoriesById[recipe.categoryId]?.name ?? '—'}
                      </td>
                      <td className="py-3 px-4 tabular-nums font-semibold">
                        {formatFaNumber(nutrition.calories)}
                      </td>
                      <td className="py-3 px-4 tabular-nums">
                        {formatFaNumber(nutrition.protein)} / {formatFaNumber(nutrition.carbs)} /{' '}
                        {formatFaNumber(nutrition.fat)} گ
                      </td>
                      <td className="py-3 px-4 tabular-nums">
                        {formatFaNumber(recipe.prepTimeMinutes + recipe.cookTimeMinutes)} دقیقه
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={
                            recipe.isActive
                              ? 'text-[var(--color-success)]'
                              : 'text-[var(--text-muted)]'
                          }
                        >
                          {recipe.isActive ? 'فعال' : 'غیرفعال'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-left">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDrawerRecipe(recipe)}
                          >
                            مشاهده
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditorRecipe(recipe);
                              setEditorOpen(true);
                            }}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteTargetRecipe(recipe)}
                          >
                            <Trash2 className="h-4 w-4 text-[var(--text-muted)]" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}

      {/* INGREDIENTS CATALOG TAB */}
      {activeTab === 'INGREDIENTS' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[var(--bg-surface-muted)]/70 border-b border-[var(--border-subtle)] text-[var(--text-secondary)]">
                <tr>
                  <th className="py-3 px-4 font-medium">نام ماده اولیه</th>
                  <th className="py-3 px-4 font-medium">واحد پایه</th>
                  <th className="py-3 px-4 font-medium">مقدار مرجع</th>
                  <th className="py-3 px-4 font-medium">کالری / پروتئین مرجع</th>
                  <th className="py-3 px-4 font-medium text-left">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filteredIngredients.map((ing) => (
                  <tr key={ing.id} className="hover:bg-[var(--bg-surface-muted)]/40">
                    <td className="py-3 px-4 font-semibold text-sm text-[var(--text-primary)]">
                      {ing.name}
                    </td>
                    <td className="py-3 px-4">{UNIT_LABELS[ing.defaultUnit]}</td>
                    <td className="py-3 px-4 tabular-nums">
                      {formatFaNumber(ing.referenceAmount)} {UNIT_LABELS[ing.referenceUnit]}
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      {ing.nutritionPerReference
                        ? `${formatFaNumber(ing.nutritionPerReference.calories)} کالری · ${formatFaNumber(
                            ing.nutritionPerReference.protein
                          )} گ پروتئین`
                        : 'ناقص (نیازمند تکمیل)'}
                    </td>
                    <td className="py-3 px-4 text-left">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditIngredient(ing)}
                          aria-label="ویرایش ماده اولیه"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleteTargetIng(ing)}
                          aria-label="حذف ماده اولیه"
                        >
                          <Trash2 className="h-4 w-4 text-[var(--text-muted)]" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Drawers & Dialogs */}
      <RecipeDetailDrawer
        recipe={drawerRecipe}
        ingredientsById={ingredientsById}
        onClose={() => setDrawerRecipe(null)}
      />

      <RecipeEditorDialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        recipe={editorRecipe}
        categories={data.recipeCategories}
        ingredients={data.ingredients}
        onSave={async (r) => {
          await upsertRecipe.mutateAsync(r);
        }}
      />

      <Dialog
        open={ingEditorOpen}
        onClose={() => setIngEditorOpen(false)}
        title={editingIng ? `ویرایش «${editingIng.name}»` : 'افزودن ماده اولیه به کاتالوگ'}
      >
        <form onSubmit={handleSaveIngredient} className="space-y-4">
          <div>
            <Label htmlFor="ing-name">نام ماده اولیه</Label>
            <Input id="ing-name" {...ingForm.register('name')} />
            {ingForm.formState.errors.name && (
              <p className="mt-1 text-xs text-[var(--color-error)]">
                {ingForm.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>دسته‌بندی ماده</Label>
              <Select {...ingForm.register('categoryId')}>
                {data.ingredientCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>دسته‌بندی خرید</Label>
              <Select {...ingForm.register('shoppingCategoryId')}>
                {data.shoppingCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>واحد پایه</Label>
              <Select {...ingForm.register('defaultUnit')}>
                {Object.entries(UNIT_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>مقدار مرجع</Label>
              <Input type="number" {...ingForm.register('referenceAmount', { valueAsNumber: true })} />
            </div>
            <div>
              <Label>واحد مرجع</Label>
              <Select {...ingForm.register('referenceUnit')}>
                {Object.entries(UNIT_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <Label>کالری مرجع</Label>
              <Input type="number" {...ingForm.register('calories')} placeholder="مثلاً 165" />
            </div>
            <div>
              <Label>پروتئین (گ)</Label>
              <Input type="number" step={0.1} {...ingForm.register('protein')} />
            </div>
            <div>
              <Label>کربو (گ)</Label>
              <Input type="number" step={0.1} {...ingForm.register('carbs')} />
            </div>
            <div>
              <Label>چربی (گ)</Label>
              <Input type="number" step={0.1} {...ingForm.register('fat')} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label className="mb-0">فعال در کاتالوگ</Label>
            <Switch
              checked={ingForm.watch('isActive')}
              onCheckedChange={(v) => ingForm.setValue('isActive', v)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIngEditorOpen(false)}>
              انصراف
            </Button>
            <Button type="submit">ذخیره</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTargetRecipe)}
        onClose={() => setDeleteTargetRecipe(null)}
        onConfirm={() => {
          if (deleteTargetRecipe) deleteRecipe.mutate(deleteTargetRecipe.id);
        }}
        title="حذف غذا از بانک غذاها"
        message={`آیا از حذف «${deleteTargetRecipe?.name ?? ''}» مطمئن هستید؟`}
        confirmLabel="حذف غذا"
        destructive
      />

      <ConfirmDialog
        open={Boolean(deleteTargetIng)}
        onClose={() => setDeleteTargetIng(null)}
        onConfirm={() => {
          if (deleteTargetIng) deleteIngredient.mutate(deleteTargetIng.id);
        }}
        title="حذف ماده اولیه"
        message={`آیا از حذف «${deleteTargetIng?.name ?? ''}» مطمئن هستید؟`}
        confirmLabel="حذف"
        destructive
      />
    </div>
  );
}
