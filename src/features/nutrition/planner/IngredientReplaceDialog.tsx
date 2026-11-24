import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Search } from 'lucide-react';
import { calculateIngredientNutrition } from '../../../services/domain/nutritionCalculator';
import { UNIT_LABELS } from '../../../shared/constants/units';
import {
  Ingredient,
  IngredientCategory,
  MealIngredientOverride,
  UnitType,
} from '../../../shared/types/domain';
import { Button } from '../../../shared/components/ui/Button';
import { Input, Select } from '../../../shared/components/ui/FormControls';
import { Dialog } from '../../../shared/components/ui/Overlays';
import { formatFaNumber } from '../../../shared/utils/cn';

interface IngredientReplaceDialogProps {
  open: boolean;
  onClose: () => void;
  originalIngredient: Ingredient;
  currentIngredientId: string;
  currentAmount: number;
  currentUnit: UnitType;
  allIngredients: Ingredient[];
  categories: IngredientCategory[];
  onConfirmOverride: (override: MealIngredientOverride) => void;
}

export function IngredientReplaceDialog({
  open,
  onClose,
  originalIngredient,
  currentIngredientId,
  currentAmount,
  currentUnit,
  allIngredients,
  categories,
  onConfirmOverride,
}: IngredientReplaceDialogProps) {
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>(currentIngredientId);
  const [amount, setAmount] = useState<number>(currentAmount);
  const [unit, setUnit] = useState<UnitType>(currentUnit);

  const filteredIngredients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allIngredients
      .filter((ing) => ing.isActive)
      .filter((ing) => selectedCategoryId === 'ALL' || ing.categoryId === selectedCategoryId)
      .filter((ing) => !q || ing.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const aCompat = originalIngredient.compatibleSubstituteIds.includes(a.id) ? 1 : 0;
        const bCompat = originalIngredient.compatibleSubstituteIds.includes(b.id) ? 1 : 0;
        if (aCompat !== bCompat) return bCompat - aCompat;
        const aSameCat = a.categoryId === originalIngredient.categoryId ? 1 : 0;
        const bSameCat = b.categoryId === originalIngredient.categoryId ? 1 : 0;
        return bSameCat - aSameCat;
      });
  }, [allIngredients, search, selectedCategoryId, originalIngredient]);

  const chosenIngredient =
    allIngredients.find((i) => i.id === selectedIngredientId) ?? originalIngredient;

  const isCompatible =
    chosenIngredient.id === originalIngredient.id ||
    originalIngredient.compatibleSubstituteIds.includes(chosenIngredient.id) ||
    chosenIngredient.categoryId === originalIngredient.categoryId;

  const previewNutrition = calculateIngredientNutrition(chosenIngredient, amount, unit);

  const handleSelectRow = (ing: Ingredient) => {
    setSelectedIngredientId(ing.id);
    setUnit(ing.defaultUnit);
    if (ing.defaultUnit !== unit && ing.defaultUnit === UnitType.PIECE) {
      setAmount(1);
    }
  };

  const handleConfirm = () => {
    const warningMsg = !isCompatible
      ? `جایگزینی «${originalIngredient.name}» با «${chosenIngredient.name}» ممکن است با دستور اصلی هماهنگ نباشد.`
      : undefined;

    onConfirmOverride({
      originalIngredientId: originalIngredient.id,
      replacementIngredientId: chosenIngredient.id,
      amount: Math.max(0.1, amount),
      unit,
      isConfirmedByUser: true,
      compatibilityWarning: warningMsg,
    });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`جایگزینی «${originalIngredient.name}»`}
      description="انتخاب از بانک مواد اولیه؛ جایگزینی فقط در برنامه این هفته اعمال می‌شود و دستور اصلی تغییر نمی‌کند."
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Search & Category Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          <div className="sm:col-span-7 relative">
            <Search className="h-4 w-4 text-[var(--text-muted)] absolute right-3 top-3 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جست‌وجوی فارسی ماده اولیه..."
              className="pr-9"
            />
          </div>
          <div className="sm:col-span-5">
            <Select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
            >
              <option value="ALL">همه دسته‌بندی‌ها</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Ingredients List */}
        <div className="max-h-56 overflow-y-auto rounded-lg border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)]">
          {filteredIngredients.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--text-muted)]">
              ماده اولیه‌ای با این مشخصات یافت نشد.
            </div>
          ) : (
            filteredIngredients.map((ing) => {
              const isSelected = ing.id === selectedIngredientId;
              const isSuggested = originalIngredient.compatibleSubstituteIds.includes(ing.id);
              const sampleNut = calculateIngredientNutrition(
                ing,
                ing.referenceAmount,
                ing.referenceUnit
              );
              return (
                <button
                  key={ing.id}
                  type="button"
                  onClick={() => handleSelectRow(ing)}
                  className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-right transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--color-primary-subtle)]'
                      : 'hover:bg-[var(--bg-surface-muted)]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                      <span>{ing.name}</span>
                      {isSuggested && (
                        <span className="text-[11px] font-medium text-[var(--color-primary)]">
                          · جایگزین سازگار
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] tabular-nums mt-0.5">
                      هر {formatFaNumber(ing.referenceAmount)} {UNIT_LABELS[ing.referenceUnit]}:{' '}
                      {sampleNut.hasIncompleteData
                        ? 'داده ناقص'
                        : `${formatFaNumber(sampleNut.calories)} کالری · ${formatFaNumber(sampleNut.protein)} گ پروتئین`}
                    </div>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-[var(--color-primary)] shrink-0" />}
                </button>
              );
            })
          )}
        </div>

        {/* Amount & Unit + Nutrition Preview */}
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]/50 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                مقدار جایگزین
              </label>
              <Input
                type="number"
                min={0.1}
                step={0.5}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                className="tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                واحد
              </label>
              <Select
                value={unit}
                onChange={(e) => setUnit(e.target.value as UnitType)}
              >
                {Object.entries(UNIT_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-2 border-t border-[var(--border-subtle)]">
            <span className="text-[var(--text-secondary)]">پیش‌نمایش تغذیه انتخاب جدید:</span>
            {previewNutrition.hasIncompleteData ? (
              <span className="text-[var(--color-warning)]">
                {previewNutrition.incompleteReason}
              </span>
            ) : (
              <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                {formatFaNumber(previewNutrition.calories)} کالری · پروتئین {formatFaNumber(previewNutrition.protein)} گ · کربو {formatFaNumber(previewNutrition.carbs)} گ · چربی {formatFaNumber(previewNutrition.fat)} گ
              </span>
            )}
          </div>
        </div>

        {!isCompatible && (
          <div className="flex items-start gap-2 rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-warning-subtle)] p-3 text-xs text-[var(--color-warning)]">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              هشدار سازگاری: ماده انتخابی در دسته متفاوتی از «{originalIngredient.name}» قرار دارد و ممکن است بافت یا طعم دستور اصلی را تغییر دهد.
            </span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button variant="ghost" onClick={onClose}>
            انصراف
          </Button>
          <Button onClick={handleConfirm} disabled={amount <= 0}>
            تأیید جایگزینی
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
