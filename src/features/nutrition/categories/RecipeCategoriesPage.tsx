import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Edit3, Plus, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRhythmData, useRhythmMutations } from '../../../services/api/useRhythmQueries';
import { RecipeCategory } from '../../../shared/types/domain';
import { categoryFormSchema } from '../../../shared/validation/schemas';
import { Button } from '../../../shared/components/ui/Button';
import { Card } from '../../../shared/components/ui/Card';
import { Input, Label, Select, Skeleton, Switch } from '../../../shared/components/ui/FormControls';
import { Dialog } from '../../../shared/components/ui/Overlays';
import { formatFaNumber, generateId } from '../../../shared/utils/cn';

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export function RecipeCategoriesPage() {
  const { data, isLoading } = useRhythmData();
  const { upsertRecipeCategory, deleteRecipeCategory } = useRhythmMutations();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<RecipeCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecipeCategory | null>(null);
  const [replacementCatId, setReplacementCatId] = useState<string>('');

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: '',
      description: '',
      color: '#2f6f4e',
      icon: 'Utensils',
      order: 1,
      isActive: true,
    },
  });

  if (isLoading || !data) {
    return <Skeleton className="h-64 w-full" />;
  }

  const getDependentCount = (catId: string) =>
    data.recipes.filter((r) => r.categoryId === catId).length;

  const openCreate = () => {
    setEditingCat(null);
    form.reset({
      name: '',
      description: '',
      color: '#2f6f4e',
      icon: 'Utensils',
      order: data.recipeCategories.length + 1,
      isActive: true,
    });
    setEditorOpen(true);
  };

  const openEdit = (cat: RecipeCategory) => {
    setEditingCat(cat);
    form.reset({
      name: cat.name,
      description: cat.description ?? '',
      color: cat.color,
      icon: cat.icon,
      order: cat.order,
      isActive: cat.isActive,
    });
    setEditorOpen(true);
  };

  const openDelete = (cat: RecipeCategory) => {
    const others = data.recipeCategories.filter((c) => c.id !== cat.id);
    setReplacementCatId(others[0]?.id ?? '');
    setDeleteTarget(cat);
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    await upsertRecipeCategory.mutateAsync({
      id: editingCat?.id ?? generateId('rec_cat'),
      name: values.name,
      description: values.description || undefined,
      color: values.color,
      icon: values.icon,
      order: values.order,
      isActive: values.isActive,
    });
    setEditorOpen(false);
  });

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteRecipeCategory.mutateAsync({
      id: deleteTarget.id,
      replacementId: replacementCatId || undefined,
    });
    setDeleteTarget(null);
  };

  const dependentCount = deleteTarget ? getDependentCount(deleteTarget.id) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
            دسته‌بندی غذاها
          </h1>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            سازمان‌دهی غذاها با بررسی خودکار وابستگی پیش از حذف
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          <span>دسته جدید</span>
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[var(--bg-surface-muted)]/70 border-b border-[var(--border-subtle)] text-[var(--text-secondary)]">
              <tr>
                <th className="py-3 px-4 font-medium">ترتیب</th>
                <th className="py-3 px-4 font-medium">عنوان دسته</th>
                <th className="py-3 px-4 font-medium">توضیح</th>
                <th className="py-3 px-4 font-medium">تعداد غذاها</th>
                <th className="py-3 px-4 font-medium">وضعیت</th>
                <th className="py-3 px-4 font-medium text-left">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {data.recipeCategories.map((cat) => (
                <tr key={cat.id} className="hover:bg-[var(--bg-surface-muted)]/40">
                  <td className="py-3 px-4 tabular-nums">{formatFaNumber(cat.order)}</td>
                  <td className="py-3 px-4 font-semibold text-sm text-[var(--text-primary)]">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full ml-2"
                      style={{ backgroundColor: cat.color }}
                    />
                    {cat.name}
                  </td>
                  <td className="py-3 px-4 text-[var(--text-muted)]">{cat.description || '—'}</td>
                  <td className="py-3 px-4 tabular-nums">
                    {formatFaNumber(getDependentCount(cat.id))} غذا
                  </td>
                  <td className="py-3 px-4">
                    <span className={cat.isActive ? 'text-[var(--color-success)]' : 'text-[var(--text-muted)]'}>
                      {cat.isActive ? 'فعال' : 'غیرفعال'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-left">
                    <div className="inline-flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(cat)} aria-label="ویرایش">
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openDelete(cat)}
                        aria-label="حذف"
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

      <Dialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingCat ? 'ویرایش دسته‌بندی غذا' : 'ایجاد دسته‌بندی غذا'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="rcat-name">نام دسته</Label>
            <Input id="rcat-name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="mt-1 text-xs text-[var(--color-error)]">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="rcat-desc">توضیح اختیاری</Label>
            <Input id="rcat-desc" {...form.register('description')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="rcat-order">ترتیب نمایش</Label>
              <Input id="rcat-order" type="number" {...form.register('order', { valueAsNumber: true })} />
            </div>
            <div>
              <Label htmlFor="rcat-color">رنگ</Label>
              <Input id="rcat-color" type="color" {...form.register('color')} className="h-10 p-1" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label className="mb-0">فعال</Label>
            <Switch
              checked={form.watch('isActive')}
              onCheckedChange={(v) => form.setValue('isActive', v)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>
              انصراف
            </Button>
            <Button type="submit">ذخیره</Button>
          </div>
        </form>
      </Dialog>

      {/* Safe Delete with Replacement Category Check */}
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="حذف دسته‌بندی غذا"
      >
        <div className="space-y-4 text-sm">
          {dependentCount > 0 ? (
            <>
              <p className="text-[var(--text-secondary)]">
                در دسته‌بندی «{deleteTarget?.name}» تعداد{' '}
                <strong className="tabular-nums">{formatFaNumber(dependentCount)}</strong> غذا وجود
                دارد. برای جلوگیری از حذف غذاها، دسته‌بندی جایگزین را انتخاب کنید:
              </p>
              <div>
                <Label htmlFor="rep-cat">دسته‌بندی جایگزین</Label>
                <Select
                  id="rep-cat"
                  value={replacementCatId}
                  onChange={(e) => setReplacementCatId(e.target.value)}
                >
                  {data.recipeCategories
                    .filter((c) => c.id !== deleteTarget?.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </Select>
              </div>
            </>
          ) : (
            <p className="text-[var(--text-secondary)]">
              آیا از حذف دسته‌بندی «{deleteTarget?.name}» مطمئن هستید؟
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              انصراف
            </Button>
            <Button
              variant="destructive"
              disabled={dependentCount > 0 && !replacementCatId}
              onClick={handleConfirmDelete}
            >
              تأیید و حذف
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
