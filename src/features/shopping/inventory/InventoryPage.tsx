import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertTriangle,
  Archive,
  Edit3,
  Minus,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRhythmData, useRhythmMutations } from '../../../services/api/useRhythmQueries';
import { formatJalaliFullDate } from '../../../services/domain/jalaliCalendar';
import { UNIT_LABELS } from '../../../shared/constants/units';
import { PantryInventory, UnitType } from '../../../shared/types/domain';
import { pantryItemFormSchema } from '../../../shared/validation/schemas';
import { Button } from '../../../shared/components/ui/Button';
import { Card, CardContent } from '../../../shared/components/ui/Card';
import { Input, Label, Select, Skeleton } from '../../../shared/components/ui/FormControls';
import { ConfirmDialog, Dialog, EmptyState } from '../../../shared/components/ui/Overlays';
import { formatFaNumber, generateId } from '../../../shared/utils/cn';

type PantryFormValues = z.infer<typeof pantryItemFormSchema>;

export function InventoryPage() {
  const { data, isLoading } = useRhythmData();
  const { upsertPantryItem, deletePantryItem, adjustPantryQuantity } = useRhythmMutations();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [onlyLowOrExpiring, setOnlyLowOrExpiring] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PantryInventory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PantryInventory | null>(null);

  const form = useForm<PantryFormValues>({
    resolver: zodResolver(pantryItemFormSchema),
    defaultValues: {
      ingredientId: '',
      quantity: 100,
      unit: UnitType.GRAM,
      shoppingCategoryId: 'shop_cat_other',
      expiryDateISO: '',
      lowStockThreshold: '',
      note: '',
    },
  });

  const ingredientsById = useMemo(
    () => Object.fromEntries((data?.ingredients ?? []).map((i) => [i.id, i])),
    [data?.ingredients]
  );
  const categoriesById = useMemo(
    () => Object.fromEntries((data?.shoppingCategories ?? []).map((c) => [c.id, c])),
    [data?.shoppingCategories]
  );

  const isExpiringSoon = (expiryISO?: string) => {
    if (!expiryISO) return false;
    const diffDays =
      (new Date(expiryISO).getTime() - new Date('2026-11-19').getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 5;
  };

  const isLowStock = (item: PantryInventory) =>
    item.lowStockThreshold !== undefined && item.quantity <= item.lowStockThreshold;

  const filteredPantry = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.pantry
      .filter((p) => categoryFilter === 'ALL' || p.shoppingCategoryId === categoryFilter)
      .filter((p) => !onlyLowOrExpiring || isLowStock(p) || isExpiringSoon(p.expiryDateISO))
      .filter((p) => {
        const name = ingredientsById[p.ingredientId]?.name ?? p.customName ?? '';
        return !q || name.toLowerCase().includes(q);
      });
  }, [data, search, categoryFilter, onlyLowOrExpiring, ingredientsById]);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const openCreateModal = () => {
    const firstIng = data.ingredients[0];
    setEditingItem(null);
    form.reset({
      ingredientId: firstIng?.id ?? '',
      quantity: 200,
      unit: firstIng?.defaultUnit ?? UnitType.GRAM,
      shoppingCategoryId: firstIng?.shoppingCategoryId ?? 'shop_cat_other',
      expiryDateISO: '',
      lowStockThreshold: '',
      note: '',
    });
    setEditorOpen(true);
  };

  const openEditModal = (item: PantryInventory) => {
    setEditingItem(item);
    form.reset({
      ingredientId: item.ingredientId,
      quantity: item.quantity,
      unit: item.unit,
      shoppingCategoryId: item.shoppingCategoryId,
      expiryDateISO: item.expiryDateISO ?? '',
      lowStockThreshold: item.lowStockThreshold !== undefined ? String(item.lowStockThreshold) : '',
      note: item.note ?? '',
    });
    setEditorOpen(true);
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    await upsertPantryItem.mutateAsync({
      id: editingItem?.id ?? generateId('pan'),
      ingredientId: values.ingredientId,
      quantity: values.quantity,
      unit: values.unit,
      shoppingCategoryId: values.shoppingCategoryId,
      expiryDateISO: values.expiryDateISO || undefined,
      lowStockThreshold: values.lowStockThreshold?.trim()
        ? Number(values.lowStockThreshold)
        : undefined,
      note: values.note || undefined,
      updatedAt: new Date().toISOString(),
    });
    setEditorOpen(false);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
            موجودی مواد غذایی خانه
          </h1>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            موجودی واقعی خانه در محاسبه لیست خرید کسر می‌شود و با تأیید برنامه غذایی به‌صورت خودکار کاهش نمی‌یابد.
          </p>
        </div>
        <Button size="sm" onClick={openCreateModal}>
          <Plus className="h-4 w-4" />
          <span>افزودن موجودی</span>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-5 relative">
            <Search className="h-4 w-4 text-[var(--text-muted)] absolute right-3 top-3 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جست‌وجو در موجودی خانه..."
              className="pr-9"
            />
          </div>
          <div className="md:col-span-4">
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="ALL">همه دسته‌بندی‌ها</option>
              {data.shoppingCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-3 flex justify-end">
            <Button
              size="sm"
              variant={onlyLowOrExpiring ? 'secondary' : 'outline'}
              onClick={() => setOnlyLowOrExpiring((v) => !v)}
              className="w-full"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>اقلام رو به اتمام</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pantry Table */}
      {filteredPantry.length === 0 ? (
        <EmptyState
          icon={<Archive className="h-6 w-6" />}
          title="قلمی در این بخش یافت نشد"
          description="موجودی مواد غذایی منزل را ثبت کنید تا لیست خرید دقیق‌تری دریافت کنید."
          action={
            <Button size="sm" onClick={openCreateModal}>
              <Plus className="h-4 w-4" />
              <span>ثبت اولین موجودی</span>
            </Button>
          }
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[var(--bg-surface-muted)]/70 border-b border-[var(--border-subtle)] text-[var(--text-secondary)]">
                <tr>
                  <th className="py-3 px-4 font-medium">ماده اولیه</th>
                  <th className="py-3 px-4 font-medium">دسته‌بندی</th>
                  <th className="py-3 px-4 font-medium">مقدار موجود</th>
                  <th className="py-3 px-4 font-medium">تاریخ انقضا</th>
                  <th className="py-3 px-4 font-medium">یادداشت</th>
                  <th className="py-3 px-4 font-medium text-left">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filteredPantry.map((item) => {
                  const ing = ingredientsById[item.ingredientId];
                  const cat = categoriesById[item.shoppingCategoryId];
                  const low = isLowStock(item);
                  const expiring = isExpiringSoon(item.expiryDateISO);
                  const stepDelta =
                    item.unit === UnitType.GRAM || item.unit === UnitType.MILLILITER ? 50 : 1;

                  return (
                    <tr key={item.id} className="hover:bg-[var(--bg-surface-muted)]/40">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-sm text-[var(--text-primary)]">
                          {ing?.name ?? item.customName ?? 'نامشخص'}
                        </div>
                        {(low || expiring) && (
                          <div className="mt-0.5 text-[11px] text-[var(--color-warning)]">
                            {low ? 'رو به اتمام' : ''}
                            {low && expiring ? ' · ' : ''}
                            {expiring ? 'نزدیک به انقضا' : ''}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[var(--text-secondary)]">
                        {cat?.title ?? '—'}
                      </td>
                      <td className="py-3 px-4 tabular-nums">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            aria-label="کاهش موجودی پس از مصرف"
                            onClick={() =>
                              adjustPantryQuantity.mutate({ id: item.id, delta: -stepDelta })
                            }
                            className="h-7 w-7 flex items-center justify-center rounded border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)] cursor-pointer"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="font-semibold text-[var(--text-primary)] min-w-[68px] text-center">
                            {formatFaNumber(item.quantity)} {UNIT_LABELS[item.unit]}
                          </span>
                          <button
                            type="button"
                            aria-label="افزایش موجودی"
                            onClick={() =>
                              adjustPantryQuantity.mutate({ id: item.id, delta: stepDelta })
                            }
                            className="h-7 w-7 flex items-center justify-center rounded border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)] cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 tabular-nums text-[var(--text-secondary)]">
                        {item.expiryDateISO ? formatJalaliFullDate(item.expiryDateISO) : '—'}
                      </td>
                      <td className="py-3 px-4 text-[var(--text-muted)] max-w-[180px] truncate">
                        {item.note || '—'}
                      </td>
                      <td className="py-3 px-4 text-left">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="ویرایش"
                            onClick={() => openEditModal(item)}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="حذف"
                            onClick={() => setDeleteTarget(item)}
                          >
                            <Trash2 className="h-4 w-4 text-[var(--text-muted)]" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Editor Dialog */}
      <Dialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingItem ? 'ویرایش موجودی خانه' : 'افزودن موجودی جدید'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="pan-ing">ماده اولیه</Label>
            <Select
              id="pan-ing"
              {...form.register('ingredientId')}
              onChange={(e) => {
                form.setValue('ingredientId', e.target.value);
                const found = ingredientsById[e.target.value];
                if (found) {
                  form.setValue('unit', found.defaultUnit);
                  form.setValue('shoppingCategoryId', found.shoppingCategoryId);
                }
              }}
            >
              {data.ingredients.map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {ing.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pan-qty">مقدار موجود</Label>
              <Input
                id="pan-qty"
                type="number"
                step={0.5}
                {...form.register('quantity', { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="pan-unit">واحد</Label>
              <Select id="pan-unit" {...form.register('unit')}>
                {Object.entries(UNIT_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pan-cat">دسته‌بندی</Label>
              <Select id="pan-cat" {...form.register('shoppingCategoryId')}>
                {data.shoppingCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="pan-thresh">آستانه هشدار کمبود</Label>
              <Input
                id="pan-thresh"
                type="number"
                {...form.register('lowStockThreshold')}
                placeholder="اختیاری"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="pan-exp">تاریخ انقضا (میلادی YYYY-MM-DD، نمایش شمسی)</Label>
            <Input id="pan-exp" type="date" {...form.register('expiryDateISO')} />
          </div>

          <div>
            <Label htmlFor="pan-note">یادداشت</Label>
            <Input id="pan-note" {...form.register('note')} placeholder="مثلاً: قفسه بالا" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>
              انصراف
            </Button>
            <Button type="submit">ذخیره موجودی</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deletePantryItem.mutate(deleteTarget.id);
        }}
        title="حذف قلم از موجودی"
        message="آیا از حذف این مورد از موجودی خانه مطمئن هستید؟"
        confirmLabel="حذف"
        destructive
      />
    </div>
  );
}
