import { UnitType } from '../../shared/types/domain';

export interface ConversionResult {
  compatible: boolean;
  quantity: number;
  unit: UnitType;
}

const MASS_TO_GRAMS: Partial<Record<UnitType, number>> = {
  [UnitType.GRAM]: 1,
  [UnitType.KILOGRAM]: 1000,
};

const VOLUME_TO_ML: Partial<Record<UnitType, number>> = {
  [UnitType.MILLILITER]: 1,
  [UnitType.LITER]: 1000,
  [UnitType.TEASPOON]: 5,
  [UnitType.TABLESPOON]: 15,
  [UnitType.CUP]: 240,
};

/**
 * Converts a quantity from `fromUnit` to `toUnit` if the units belong to the same physical family
 * or if `gramsPerUnit` is explicitly supplied for a unit-to-mass conversion.
 */
export function convertUnitQuantity(
  quantity: number,
  fromUnit: UnitType,
  toUnit: UnitType,
  gramsPerUnit?: number
): ConversionResult {
  if (fromUnit === toUnit) {
    return { compatible: true, quantity, unit: toUnit };
  }

  // Mass <-> Mass
  const fromMass = MASS_TO_GRAMS[fromUnit];
  const toMass = MASS_TO_GRAMS[toUnit];
  if (fromMass !== undefined && toMass !== undefined) {
    const grams = quantity * fromMass;
    return { compatible: true, quantity: grams / toMass, unit: toUnit };
  }

  // Volume <-> Volume
  const fromVol = VOLUME_TO_ML[fromUnit];
  const toVol = VOLUME_TO_ML[toUnit];
  if (fromVol !== undefined && toVol !== undefined) {
    const ml = quantity * fromVol;
    return { compatible: true, quantity: ml / toVol, unit: toUnit };
  }

  // Optional piece/tbsp/cup -> gram using ingredient-specific gramsPerUnit
  if (gramsPerUnit && gramsPerUnit > 0) {
    if (toMass !== undefined && fromUnit !== UnitType.PACK) {
      const grams = quantity * gramsPerUnit;
      return { compatible: true, quantity: grams / toMass, unit: toUnit };
    }
    if (fromMass !== undefined && toUnit !== UnitType.PACK) {
      const grams = quantity * fromMass;
      return { compatible: true, quantity: grams / gramsPerUnit, unit: toUnit };
    }
  }

  return { compatible: false, quantity, unit: fromUnit };
}

/**
 * Formats a unit quantity cleanly (e.g., converts >= 1000g to kg for shopping readability if desired).
 */
export function normalizeDisplayUnit(quantity: number, unit: UnitType): { quantity: number; unit: UnitType } {
  if (unit === UnitType.GRAM && quantity >= 1000) {
    return { quantity: Number((quantity / 1000).toFixed(2)), unit: UnitType.KILOGRAM };
  }
  if (unit === UnitType.MILLILITER && quantity >= 1000) {
    return { quantity: Number((quantity / 1000).toFixed(2)), unit: UnitType.LITER };
  }
  return { quantity: Number(quantity.toFixed(2)), unit };
}
