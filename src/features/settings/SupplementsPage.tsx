import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Edit3, Pill, Plus, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRhythmData, useRhythmMutations } from '../../services/api/useRhythmQueries';
import {
  MEAL_SLOT_LABELS,
  MEAL_SLOT_ORDER,
  PERSIAN_WEEKDAY_NAMES,
} from '../../shared/constants/units';
import { MealSlotType, Supplement } from '../../shared/types/domain';
import { supplementSchema } from '../../shared/validation/schemas';
import { Button } from '../../shared/components/ui/Button';
import { Card, CardContent } from '../../shared/components/ui/Card';
import {
  Checkbox,
  Input,
  Label,
  Select,
  Skeleton,
  Switch,
  Textarea,
} from '../../shared/components/ui/FormControls';
import { ConfirmDialog, Dialog, EmptyState } from '../../shared/components/ui/Overlays';
import { formatFaNumber, generateId, toPersianDigits } from '../../shared/utils/cn';

type SupplementFormValues = z.infer<typeof supplementSchema>;

export function SupplementsPage() {
  const { data, isLoading } = useRhythmData();
  const { upsertSupplement, deleteSupplement } = useRhythmMutations();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSup, setEditingSup] = useState<Supplement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplement | null>(null);

  const form = useForm<SupplementFormValues>({
    resolver: zodResolver(supplementSchema),
    defaultValues: {
      name: '',
      form: 'کپسول',
      dosageAmount: '',
      dosageUnit: 'mg',
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      timeOfDay: '13:30',
      linkedMealSlot: '',
      doctorOrPharmacistNote: '',
      userNote: '',
      isActive: true,
    },
  });

  if (isLoading || !data) {
    return <Skeleton className="h-72 w-full" />;
  }

  const openCreate = () => {
    setEditingSup(null);
    form.reset({
      name: '',
      form: 'کپسول',
      dosageAmount: '',
      dosageUnit: 'mg',
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      timeOfDay: '',
      linkedMealSlot: '',
      doctorOrPharmacistNote: '',
      userNote: '',
      isActive: true,
    });
    setEditorOpen(true);
  };

  const openEdit = (sup: Supplement) => {
    setEditingSup(sup);
    form.reset({
      name: sup.name,
      form: sup.form,
      dosageAmount: sup.dosageAmount !== undefined ? String(sup.dosageAmount) : '',
      dosageUnit: sup.dosageUnit ?? 'mg',
      activeDays: sup.activeDays,
      timeOfDay: sup.timeOfDay ?? '',
      linkedMealSlot: sup.linkedMealSlot ?? '',
      doctorOrPharmacistNote: sup.doctorOrPharmacistNote ?? '',
      userNote: sup.userNote ?? '',
      isActive: sup.isActive,
    });
    setEditorOpen(true);
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    const now = new Date().toISOString();
    await upsertSupplement.mutateAsync({
      id: editingSup?.id ?? generateId('sup'),
      name: values.name,
      form: values.form,
      dosageAmount: values.dosageAmount?.trim() ? Number(values.dosageAmount) : undefined,
      dosageUnit: values.dosageUnit || undefined,
      activeDays: values.activeDays,
      timeOfDay: values.timeOfDay || undefined,
      linkedMealSlot:
        values.linkedMealSlot === '' ? undefined : (values.linkedMealSlot as MealSlotType),
      doctorOrPharmacistNote: values.doctorOrPharmacistNote || undefined,
      userNote: values.userNote || undefined,
      isActive: values.isActive,
      createdAt: editingSup?.createdAt ?? now,
      updatedAt: now,
    });
    setEditorOpen(false);
  });

  const toggleDay = (dayIdx: number) => {
    const current = form.getValues('activeDays');
    const exists = current.includes(dayIdx);
    form.setValue(
      'activeDays',
      exists ? current.filter((d) => d !== dayIdx) : [...current, dayIdx].sort()
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
            مکمل‌ها و ویتامین‌ها
          </h1>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            مقادیر و زمان‌بندی مصرف صرفاً بر اساس اطلاعات ثبت‌شده توسط شما یا دستور پزشک ذخیره می‌شوند. سیستم دوز پزشکی پیشنهاد نمی‌کند.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          <span>ثبت مکمل جدید</span>
        </Button>
      </div>

      {data.supplements.length === 0 ? (
        <EmptyState
          icon={<Pill className="h-6 w-6" />}
          title="مکملی ثبت نشده است"
          description="مکمل‌ها یا ویتامین‌های مصرفی خود را همراه مقدار و ساعت تأییدشده ثبت کنید."
          action={
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              <span>ثبت مکمل</span>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.supplements.map((sup) => {
            const needsInfo = !sup.dosageAmount || !sup.timeOfDay;
            return (
              <Card key={sup.id}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-[var(--text-primary)]">
                          {sup.name}
                        </h3>
                        <span className="text-xs text-[var(--text-muted)]">· {sup.form}</span>
                      </div>
                      <div className="mt-1 text-xs text-[var(--text-secondary)] tabular-nums">
                        {sup.dosageAmount ? (
                          <span>
                            مقدار ثبت‌شده: {formatFaNumber(sup.dosageAmount)} {sup.dosageUnit}
                          </span>
                        ) : (
                          <span className="text-[var(--color-warning)]">مقدار ثبت نشده</span>
                        )}
                        <span aria-hidden="true" className="mx-1.5">·</span>
                        {sup.timeOfDay ? (
                          <span>ساعت {toPersianDigits(sup.timeOfDay)}</span>
                        ) : (
                          <span className="text-[var(--color-warning)]">ساعت ثبت نشده</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEdit(sup)}
                        aria-label="ویرایش مکمل"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleteTarget(sup)}
                        aria-label="حذف مکمل"
                      >
                        <Trash2 className="h-4 w-4 text-[var(--text-muted)]" />
                      </Button>
                    </div>
                  </div>

                  {needsInfo && (
                    <div className="flex items-center gap-2 rounded-lg bg-[var(--color-warning-subtle)] px-3 py-2 text-xs text-[var(--color-warning)]">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>نیازمند تکمیل اطلاعات (مقدار و زمان مصرف توسط کاربر وارد شود)</span>
                    </div>
                  )}

                  <div className="text-xs text-[var(--text-muted)]">
                    روزهای فعال:{' '}
                    {sup.activeDays.length === 7
                      ? 'همه روزهای هفته'
                      : sup.activeDays.map((d) => PERSIAN_WEEKDAY_NAMES[d]).join('، ')}
                  </div>

                  {sup.doctorOrPharmacistNote && (
                    <div className="rounded-lg bg-[var(--bg-surface-muted)]/60 p-2.5 text-xs text-[var(--text-secondary)]">
                      <span className="font-semibold">یادداشت پزشک/داروساز: </span>
                      {sup.doctorOrPharmacistNote}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)] text-xs">
                    <span className={sup.isActive ? 'text-[var(--color-success)]' : 'text-[var(--text-muted)]'}>
                      {sup.isActive ? 'فعال در برنامه روزانه' : 'غیرفعال'}
                    </span>
                    {sup.linkedMealSlot && (
                      <span className="text-[var(--text-muted)]">
                        مرتبط با: {MEAL_SLOT_LABELS[sup.linkedMealSlot]}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingSup ? `ویرایش «${editingSup.name}»` : 'ثبت مکمل جدید'}
        description="تنها مقادیر و زمان‌های تأییدشده توسط خودتان را وارد کنید."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="sup-name">نام مکمل</Label>
              <Input id="sup-name" {...form.register('name')} placeholder="مثلاً: ویتامین D3" />
              {form.formState.errors.name && (
                <p className="mt-1 text-xs text-[var(--color-error)]">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="sup-form">شکل مصرف</Label>
              <Input id="sup-form" {...form.register('form')} placeholder="کپسول، قرص، قطره" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="sup-dose">مقدار مصرف</Label>
              <Input id="sup-dose" type="number" {...form.register('dosageAmount')} />
            </div>
            <div>
              <Label htmlFor="sup-unit">واحد</Label>
              <Input id="sup-unit" {...form.register('dosageUnit')} placeholder="mg / IU / mcg" />
            </div>
            <div>
              <Label htmlFor="sup-time">ساعت مصرف</Label>
              <Input id="sup-time" type="time" {...form.register('timeOfDay')} />
            </div>
          </div>

          <div>
            <Label htmlFor="sup-slot">ارتباط با وعده غذایی (اختیاری)</Label>
            <Select id="sup-slot" {...form.register('linkedMealSlot')}>
              <option value="">بدون وابستگی به وعده</option>
              {MEAL_SLOT_ORDER.map((s) => (
                <option key={s} value={s}>
                  {MEAL_SLOT_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>روزهای مصرف</Label>
            <div className="flex flex-wrap gap-3 pt-1">
              {PERSIAN_WEEKDAY_NAMES.map((dayName, idx) => (
                <label key={dayName} className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                  <Checkbox
                    checked={form.watch('activeDays').includes(idx)}
                    onCheckedChange={() => toggleDay(idx)}
                  />
                  <span>{dayName}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="sup-doc">یادداشت تأییدشده پزشک یا داروساز</Label>
            <Textarea
              id="sup-doc"
              rows={2}
              className="min-h-[60px]"
              {...form.register('doctorOrPharmacistNote')}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="mb-0">نمایش در برنامه روزانه</Label>
            <Switch
              checked={form.watch('isActive')}
              onCheckedChange={(v) => form.setValue('isActive', v)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>
              انصراف
            </Button>
            <Button type="submit">ذخیره مکمل</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteSupplement.mutate(deleteTarget.id);
        }}
        title="حذف مکمل"
        message={`آیا از حذف «${deleteTarget?.name ?? ''}» مطمئن هستید؟`}
        confirmLabel="حذف"
        destructive
      />
    </div>
  );
}
