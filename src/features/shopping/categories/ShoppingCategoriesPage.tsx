import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Edit3, Plus, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRhythmData, useRhythmMutations } from '../../../services/api/useRhythmQueries';
import { ShoppingCategory } from '../../../shared/types/domain';
import { categoryFormSchema } from '../../../shared/validation/schemas';
import { Button } from '../../../shared/components/ui/Button';
import { Card } from '../../../shared/components/ui/Card';
import { Input, Label, Skeleton, Switch } from '../../../shared/components/ui/FormControls';
import { ConfirmDialog, Dialog } from '../../../shared/components/ui/Overlays';
import { formatFaNumber, generateId } from '../../../shared/utils/cn';

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export function ShoppingCategoriesPage() {
  const { data, isLoading } = useRhythmData();
  const { upsertShoppingCategory, deleteShoppingCategory } = useRhythmMutations();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<ShoppingCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ShoppingCategory | null>(null);

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: '',
      color: '#2f6f4e',
      icon: 'Package',
      order: 1,
      isActive: true,
    },
  });

  if (isLoading || !data) {
    return <Skeleton className="h-64 w-full" />;
  }

  const openCreate = () => {
    setEditingCat(null);
    form.reset({
      name: '',
      color: '#2f6f4e',
      icon: 'Package',
      order: data.shoppingCategories.length + 1,
      isActive: true,
    });
    setEditorOpen(true);
  };

  const openEdit = (cat: ShoppingCategory) => {
    setEditingCat(cat);
    form.reset({
      name: cat.title,
      color: cat.color,
      icon: cat.icon,
      order: cat.order,
      isActive: cat.isActive,
    });
    setEditorOpen(true);
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    await upsertShoppingCategory.mutateAsync({
      id: editingCat?.id ?? generateId('shop_cat'),
      title: values.name,
      color: values.color,
      icon: values.icon,
      order: values.order,
      isActive: values.isActive,
    });
    setEditorOpen(false);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
            دسته‌بندی‌های خرید
          </h1>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            تنظیم گروه‌بندی و ترتیب نمایش اقلام در لیست خرید هفته
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          <span>دسته‌بندی جدید</span>
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[var(--bg-surface-muted)]/70 border-b border-[var(--border-subtle)] text-[var(--text-secondary)]">
              <tr>
                <th className="py-3 px-4 font-medium">ترتیب</th>
                <th className="py-3 px-4 font-medium">عنوان</th>
                <th className="py-3 px-4 font-medium">رنگ</th>
                <th className="py-3 px-4 font-medium">وضعیت</th>
                <th className="py-3 px-4 font-medium text-left">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {data.shoppingCategories.map((cat) => (
                <tr key={cat.id} className="hover:bg-[var(--bg-surface-muted)]/40">
                  <td className="py-3 px-4 tabular-nums">{formatFaNumber(cat.order)}</td>
                  <td className="py-3 px-4 font-semibold text-sm text-[var(--text-primary)]">
                    {cat.title}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className="inline-block h-4 w-8 rounded border border-[var(--border-subtle)]"
                      style={{ backgroundColor: cat.color }}
                    />
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
                        onClick={() => setDeleteTarget(cat)}
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
        title={editingCat ? 'ویرایش دسته‌بندی خرید' : 'ایجاد دسته‌بندی خرید'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="scat-name">عنوان دسته</Label>
            <Input id="scat-name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="mt-1 text-xs text-[var(--color-error)]">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="scat-order">ترتیب نمایش</Label>
              <Input id="scat-order" type="number" {...form.register('order', { valueAsNumber: true })} />
            </div>
            <div>
              <Label htmlFor="scat-color">رنگ</Label>
              <Input id="scat-color" type="color" {...form.register('color')} className="h-10 p-1" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label className="mb-0">وضعیت فعال</Label>
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

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteShoppingCategory.mutate({ id: deleteTarget.id, replacementId: 'shop_cat_other' });
          }
        }}
        title="حذف دسته‌بندی خرید"
        message={`اقلام مرتبط با «${deleteTarget?.title ?? ''}» به «سایر موارد» منتقل می‌شوند. ادامه می‌دهید؟`}
        confirmLabel="حذف"
        destructive
      />
    </div>
  );
}
