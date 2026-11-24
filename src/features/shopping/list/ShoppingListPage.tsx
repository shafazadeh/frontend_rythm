import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertTriangle,
  Copy,
  Layers,
  Plus,
  RefreshCw,
  Search,
  ShoppingBasket,
  Trash2,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useRhythmData, useRhythmMutations } from '../../../services/api/useRhythmQueries';
import { formatJalaliWeekRangeLabel } from '../../../services/domain/jalaliCalendar';
import { UNIT_LABELS } from '../../../shared/constants/units';
import { ShoppingListItem, UnitType } from '../../../shared/types/domain';
import { shoppingItemFormSchema } from '../../../shared/validation/schemas';
import { Button } from '../../../shared/components/ui/Button';
import { Card, CardContent } from '../../../shared/components/ui/Card';
import {
  Checkbox,
  Input,
  Label,
  Progress,
  Select,
  Skeleton,
} from '../../../shared/components/ui/FormControls';
import { ConfirmDialog, Dialog, EmptyState } from '../../../shared/components/ui/Overlays';
import { formatFaNumber, generateId } from '../../../shared/utils/cn';

type ShoppingItemFormValues = z.infer<typeof shoppingItemFormSchema>;

export function ShoppingListPage() {
  const { data, isLoading } = useRhythmData();
  const { upsertShoppingItem, deleteShoppingItem, regenerateShoppingList } = useRhythmMutations();

  const [selectedListId, setSelectedListId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'REMAINING' | 'PURCHASED'>('ALL');
  const [groupByCategory, setGroupByCategory] = useState(true);
  const [sortBy, setSortBy] = useState<'CATEGORY' | 'NAME' | 'STATUS'>('CATEGORY');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ShoppingListItem | null>(null);
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [editingQtyVal, setEditingQtyVal] = useState<number>(0);

  const form = useForm<ShoppingItemFormValues>({
    resolver: zodResolver(shoppingItemFormSchema),
    defaultValues: {
      name: '',
      suggestedBuyQuantity: 1,
      unit: UnitType.PIECE,
      categoryId: 'shop_cat_other',
      note: '',
    },
  });

  const activeList = useMemo(() => {
    if (!data || data.shoppingLists.length === 0) return null;
    if (selectedListId) {
      return data.shoppingLists.find((l) => l.id === selectedListId) ?? data.shoppingLists[0];
    }
    return data.shoppingLists[0];
  }, [data, selectedListId]);

  const categoriesById = useMemo(
    () => Object.fromEntries((data?.shoppingCategories ?? []).map((c) => [c.id, c])),
    [data?.shoppingCategories]
  );

  const filteredItems = useMemo(() => {
    if (!activeList) return [];
    const q = search.trim().toLowerCase();
    return activeList.items
      .filter((it) => {
        if (statusFilter === 'REMAINING') return !it.isChecked;
        if (statusFilter === 'PURCHASED') return it.isChecked;
        return true;
      })
      .filter((it) => !q || it.name.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sortBy === 'NAME') return a.name.localeCompare(b.name, 'fa');
        if (sortBy === 'STATUS') return Number(a.isChecked) - Number(b.isChecked);
        const orderA = categoriesById[a.categoryId]?.order ?? 99;
        const orderB = categoriesById[b.categoryId]?.order ?? 99;
        return orderA - orderB || a.name.localeCompare(b.name, 'fa');
      });
  }, [activeList, search, statusFilter, sortBy, categoriesById]);

  const groupedItems = useMemo(() => {
    if (!groupByCategory) {
      return [{ categoryId: 'ALL', title: 'همه اقلام', items: filteredItems }];
    }
    const groups = new Map<string, ShoppingListItem[]>();
    for (const item of filteredItems) {
      const arr = groups.get(item.categoryId) ?? [];
      arr.push(item);
      groups.set(item.categoryId, arr);
    }
    return Array.from(groups.entries()).map(([catId, items]) => ({
      categoryId: catId,
      title: categoriesById[catId]?.title ?? 'سایر موارد',
      items,
    }));
  }, [filteredItems, groupByCategory, categoriesById]);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const totalCount = activeList?.items.length ?? 0;
  const checkedCount = activeList?.items.filter((i) => i.isChecked).length ?? 0;

  const handleToggleItem = async (item: ShoppingListItem) => {
    if (!activeList) return;
    await upsertShoppingItem.mutateAsync({
      listId: activeList.id,
      item: { ...item, isChecked: !item.isChecked },
    });
  };

  const handleSaveQty = async (item: ShoppingListItem) => {
    if (!activeList) return;
    await upsertShoppingItem.mutateAsync({
      listId: activeList.id,
      item: { ...item, suggestedBuyQuantity: Math.max(0.1, editingQtyVal) },
    });
    setEditingQtyId(null);
  };

  const handleChangeCategory = async (item: ShoppingListItem, categoryId: string) => {
    if (!activeList) return;
    await upsertShoppingItem.mutateAsync({
      listId: activeList.id,
      item: { ...item, categoryId },
    });
  };

  const handleAddManualItem = form.handleSubmit(async (values) => {
    if (!activeList) return;
    await upsertShoppingItem.mutateAsync({
      listId: activeList.id,
      item: {
        id: generateId('shop_man'),
        name: values.name,
        requiredQuantity: values.suggestedBuyQuantity,
        pantryQuantity: 0,
        suggestedBuyQuantity: values.suggestedBuyQuantity,
        unit: values.unit,
        categoryId: values.categoryId,
        isChecked: false,
        source: 'MANUAL',
        note: values.note || undefined,
        updatedAt: new Date().toISOString(),
      },
    });
    toast.success('کالا به لیست خرید اضافه شد.');
    form.reset();
    setAddModalOpen(false);
  });

  const handleCopyText = async () => {
    if (!activeList) return;
    const lines = groupedItems.flatMap((g) => [
      `\n— ${g.title} —`,
      ...g.items.map(
        (it) =>
          `${it.isChecked ? '[✓]' : '[ ]'} ${it.name}: ${formatFaNumber(
            it.suggestedBuyQuantity,
            2
          )} ${UNIT_LABELS[it.unit]}`
      ),
    ]);
    const text = `لیست خرید هفته (${formatJalaliWeekRangeLabel(
      activeList.weekStartISO,
      activeList.weekEndISO
    )})${lines.join('\n')}`;

    try {
      await navigator.clipboard.writeText(text);
      toast.success('متن لیست خرید در کلیپ‌بورد کپی شد.');
    } catch {
      toast.error('امکان کپی خودکار در مرورگر وجود ندارد.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
            لیست خرید هفته
          </h1>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {activeList
              ? `بازه: ${formatJalaliWeekRangeLabel(activeList.weekStartISO, activeList.weekEndISO)}`
              : 'لیست خریدی ایجاد نشده است'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {data.shoppingLists.length > 1 && (
            <Select
              value={activeList?.id ?? ''}
              onChange={(e) => setSelectedListId(e.target.value)}
              className="w-auto h-9 text-xs"
            >
              {data.shoppingLists.map((l) => (
                <option key={l.id} value={l.id}>
                  هفته {formatJalaliWeekRangeLabel(l.weekStartISO, l.weekEndISO)}
                </option>
              ))}
            </Select>
          )}

          {activeList?.weeklyPlanId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                regenerateShoppingList.mutate({
                  planId: activeList.weeklyPlanId!,
                  includeUnconfirmed: true,
                })
              }
              disabled={regenerateShoppingList.isPending}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>بازمحاسبه با برنامه</span>
            </Button>
          )}

          <Button size="sm" variant="outline" onClick={handleCopyText} disabled={!activeList}>
            <Copy className="h-3.5 w-3.5" />
            <span>کپی متن لیست</span>
          </Button>

          <Button size="sm" onClick={() => setAddModalOpen(true)} disabled={!activeList}>
            <Plus className="h-3.5 w-3.5" />
            <span>افزودن دستی کالا</span>
          </Button>
        </div>
      </div>

      {/* Progress & Filter Toolbar */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1.5 flex-1 max-w-md">
              <div className="flex items-center justify-between text-xs tabular-nums">
                <span className="text-[var(--text-secondary)]">پیشرفت خرید</span>
                <span className="font-semibold">
                  {formatFaNumber(checkedCount)} از {formatFaNumber(totalCount)} قلم خریداری‌شده
                </span>
              </div>
              <Progress value={checkedCount} max={Math.max(1, totalCount)} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg bg-[var(--bg-surface-muted)] p-1">
                {(['ALL', 'REMAINING', 'PURCHASED'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      statusFilter === st
                        ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {st === 'ALL' ? 'همه' : st === 'REMAINING' ? 'باقیمانده' : 'خریداری‌شده'}
                  </button>
                ))}
              </div>

              <Button
                size="sm"
                variant={groupByCategory ? 'secondary' : 'outline'}
                onClick={() => setGroupByCategory((v) => !v)}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>گروه‌بندی دسته‌ای</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 border-t border-[var(--border-subtle)]">
            <div className="sm:col-span-8 relative">
              <Search className="h-4 w-4 text-[var(--text-muted)] absolute right-3 top-3 pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جست‌وجوی کالا در لیست خرید..."
                className="pr-9"
              />
            </div>
            <div className="sm:col-span-4">
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              >
                <option value="CATEGORY">مرتب‌سازی بر اساس دسته‌بندی</option>
                <option value="NAME">مرتب‌سازی الفبایی</option>
                <option value="STATUS">خریدنشده‌ها ابتدا</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shopping Items */}
      {!activeList || filteredItems.length === 0 ? (
        <EmptyState
          icon={<ShoppingBasket className="h-6 w-6" />}
          title="موردی در این نمای لیست خرید نیست"
          description="می‌توانید فیلترها را تغییر دهید، کالا را به‌صورت دستی اضافه کنید یا از برنامه غذایی لیست بسازید."
          action={
            <Button size="sm" onClick={() => setAddModalOpen(true)}>
              <Plus className="h-4 w-4" />
              <span>افزودن کالا</span>
            </Button>
          }
        />
      ) : (
        <div className="space-y-5">
          {groupedItems.map((group) => (
            <Card key={group.categoryId}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]/40">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">{group.title}</h2>
                <span className="text-xs text-[var(--text-muted)] tabular-nums">
                  {formatFaNumber(group.items.length)} قلم
                </span>
              </div>

              <div className="divide-y divide-[var(--border-subtle)]">
                {group.items.map((item) => {
                  const isEditing = editingQtyId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`flex flex-col md:flex-row md:items-center justify-between gap-3 px-5 py-3.5 transition-colors ${
                        item.isChecked ? 'bg-[var(--bg-surface-muted)]/30 opacity-75' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <Checkbox
                          checked={item.isChecked}
                          onCheckedChange={() => handleToggleItem(item)}
                          ariaLabel={`خریداری ${item.name}`}
                        />
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`text-sm font-medium ${
                                item.isChecked
                                  ? 'line-through text-[var(--text-muted)]'
                                  : 'text-[var(--text-primary)]'
                              }`}
                            >
                              {item.name}
                            </span>
                            <span className="text-[11px] text-[var(--text-muted)]">
                              · {item.source === 'MANUAL' ? 'دستی' : 'خودکار از برنامه'}
                            </span>
                          </div>

                          <div className="text-xs text-[var(--text-muted)] tabular-nums">
                            {item.source === 'AUTO' ? (
                              <>
                                نیاز هفته: {formatFaNumber(item.requiredQuantity, 2)}{' '}
                                {UNIT_LABELS[item.unit]}
                                <span aria-hidden="true" className="mx-1.5">·</span>
                                موجود در خانه: {formatFaNumber(item.pantryQuantity, 2)}{' '}
                                {UNIT_LABELS[item.unit]}
                              </>
                            ) : (
                              item.note || 'اضافه‌شده توسط کاربر'
                            )}
                          </div>

                          {item.needsUnitReview && (
                            <div className="flex items-center gap-1.5 text-xs text-[var(--color-warning)]">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              <span>نیازمند بررسی واحد: {item.unitReviewMessage}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 shrink-0 pr-8 md:pr-0">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              min={0.1}
                              step={0.5}
                              value={editingQtyVal}
                              onChange={(e) => setEditingQtyVal(Number(e.target.value) || 0)}
                              className="h-8 w-24 text-xs tabular-nums"
                            />
                            <Button size="sm" onClick={() => handleSaveQty(item)}>
                              ذخیره
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingQtyId(item.id);
                              setEditingQtyVal(item.suggestedBuyQuantity);
                            }}
                            title="کلیک برای ویرایش مقدار خرید"
                            className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]/60 px-3 py-1.5 text-xs font-semibold tabular-nums hover:border-[var(--color-primary)] cursor-pointer"
                          >
                            خرید: {formatFaNumber(item.suggestedBuyQuantity, 2)} {UNIT_LABELS[item.unit]}
                          </button>
                        )}

                        <Select
                          value={item.categoryId}
                          onChange={(e) => handleChangeCategory(item, e.target.value)}
                          className="h-8 w-36 text-xs"
                          aria-label={`تغییر دسته‌بندی ${item.name}`}
                        >
                          {data.shoppingCategories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.title}
                            </option>
                          ))}
                        </Select>

                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`حذف ${item.name}`}
                          onClick={() => setDeleteTarget(item)}
                        >
                          <Trash2 className="h-4 w-4 text-[var(--text-muted)]" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Manual Item Dialog */}
      <Dialog
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="افزودن دستی کالا به لیست خرید"
        description="اقلام دستی در بازمحاسبه خودکار لیست خرید حفظ می‌شوند."
      >
        <form onSubmit={handleAddManualItem} className="space-y-4">
          <div>
            <Label htmlFor="shop-name">نام کالا</Label>
            <Input id="shop-name" {...form.register('name')} placeholder="مثلاً: دستمال کاغذی" />
            {form.formState.errors.name && (
              <p className="mt-1 text-xs text-[var(--color-error)]">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="shop-qty">مقدار</Label>
              <Input
                id="shop-qty"
                type="number"
                step={0.5}
                {...form.register('suggestedBuyQuantity', { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="shop-unit">واحد</Label>
              <Select id="shop-unit" {...form.register('unit')}>
                {Object.entries(UNIT_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="shop-cat">دسته‌بندی خرید</Label>
            <Select id="shop-cat" {...form.register('categoryId')}>
              {data.shoppingCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="shop-note">یادداشت (اختیاری)</Label>
            <Input id="shop-note" {...form.register('note')} placeholder="توضیح یا برند پیشنهادی" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setAddModalOpen(false)}>
              انصراف
            </Button>
            <Button type="submit">افزودن به لیست</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (activeList && deleteTarget) {
            deleteShoppingItem.mutate({ listId: activeList.id, itemId: deleteTarget.id });
          }
        }}
        title="حذف کالا از لیست خرید"
        message={`آیا از حذف «${deleteTarget?.name ?? ''}» از لیست خرید مطمئن هستید؟`}
        confirmLabel="حذف کالا"
        destructive
      />
    </div>
  );
}
