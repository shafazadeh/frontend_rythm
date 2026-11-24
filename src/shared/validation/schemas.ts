import { z } from 'zod';
import {
  ActivityLevel,
  AllergenType,
  BudgetLevel,
  MealSlotType,
  PlanningStyle,
  SexForCalculation,
  UnitType,
  VarietyLevel,
} from '../types/domain';

export const profileSchema = z.object({
  displayName: z.string().trim().min(2, 'نام نمایشی باید حداقل ۲ کاراکتر باشد'),
  age: z.number({ message: 'سن معتبر نیست' }).min(12, 'سن باید حداقل ۱۲ سال باشد').max(110, 'سن معتبر نیست'),
  heightCm: z.number({ message: 'قد معتبر نیست' }).min(100, 'قد باید حداقل ۱۰۰ سانتی‌متر باشد').max(240, 'قد معتبر نیست'),
  weightKg: z.number({ message: 'وزن معتبر نیست' }).min(30, 'وزن باید حداقل ۳۰ کیلوگرم باشد').max(250, 'وزن معتبر نیست'),
  sexForCalculation: z.nativeEnum(SexForCalculation),
  activityLevel: z.nativeEnum(ActivityLevel),
  timezone: z.string().min(1, 'منطقه زمانی الزامی است'),
  hasSpecialMedicalCondition: z.boolean(),
});

export const nutritionTargetSchema = z.object({
  dailyCalories: z
    .number({ message: 'کالری معتبر وارد کنید' })
    .min(900, 'هدف کالری روزانه نباید کمتر از ۹۰۰ باشد')
    .max(5500, 'هدف کالری روزانه معتبر نیست'),
  proteinGrams: z.number({ message: 'مقدار معتبر وارد کنید' }).min(20, 'حداقل پروتئین ۲۰ گرم است').max(350),
  carbsGrams: z.number({ message: 'مقدار معتبر وارد کنید' }).min(20, 'حداقل کربوهیدرات ۲۰ گرم است').max(700),
  fatGrams: z.number({ message: 'مقدار معتبر وارد کنید' }).min(15, 'حداقل چربی ۱۵ گرم است').max(250),
  fiberGrams: z.number().min(0).max(120).optional(),
  mealsPerDay: z.number({ message: 'تعداد وعده معتبر وارد کنید' }).min(2, 'حداقل ۲ وعده').max(6, 'حداکثر ۶ وعده'),
});

export const recipeIngredientRowSchema = z.object({
  id: z.string(),
  ingredientId: z.string().min(1, 'انتخاب ماده اولیه الزامی است'),
  amount: z.number({ message: 'مقدار معتبر وارد کنید' }).positive('مقدار باید بیشتر از صفر باشد'),
  unit: z.nativeEnum(UnitType),
  notes: z.string().optional(),
  isOptional: z.boolean().optional(),
});

export const recipeStepRowSchema = z.object({
  id: z.string(),
  stepNumber: z.number(),
  instruction: z.string().trim().min(3, 'توضیح مرحله باید حداقل ۳ کاراکتر باشد'),
});

export const recipeFormSchema = z.object({
  name: z.string().trim().min(2, 'نام غذا الزامی است'),
  categoryId: z.string().min(1, 'انتخاب دسته‌بندی الزامی است'),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  servings: z.number({ message: 'مقدار معتبر وارد کنید' }).min(1, 'تعداد سروینگ حداقل ۱ است').max(20),
  prepTimeMinutes: z.number({ message: 'مقدار معتبر وارد کنید' }).min(0, 'زمان نباید منفی باشد').max(360),
  cookTimeMinutes: z.number({ message: 'مقدار معتبر وارد کنید' }).min(0, 'زمان نباید منفی باشد').max(480),
  ingredients: z.array(recipeIngredientRowSchema).min(1, 'حداقل یک ماده اولیه وارد کنید'),
  steps: z.array(recipeStepRowSchema).min(1, 'حداقل یک مرحله پخت وارد کنید'),
  useManualNutrition: z.boolean(),
  manualCalories: z.number().min(0).max(4000).optional(),
  manualProtein: z.number().min(0).max(300).optional(),
  manualCarbs: z.number().min(0).max(500).optional(),
  manualFat: z.number().min(0).max(300).optional(),
  manualFiber: z.number().min(0).max(100).optional(),
  suitableSlots: z.array(z.nativeEnum(MealSlotType)).min(1, 'حداقل یک وعده مناسب انتخاب کنید'),
  allergens: z.array(z.nativeEnum(AllergenType)),
  tagsText: z.string().optional(),
  isFavorite: z.boolean(),
  isDisliked: z.boolean(),
  isActive: z.boolean(),
  notes: z.string().optional(),
});

export const ingredientFormSchema = z.object({
  name: z.string().trim().min(2, 'نام ماده اولیه الزامی است'),
  categoryId: z.string().min(1, 'دسته‌بندی ماده اولیه الزامی است'),
  shoppingCategoryId: z.string().min(1, 'دسته‌بندی خرید الزامی است'),
  defaultUnit: z.nativeEnum(UnitType),
  referenceAmount: z.number({ message: 'مقدار معتبر وارد کنید' }).positive('مقدار مرجع باید مثبت باشد'),
  referenceUnit: z.nativeEnum(UnitType),
  gramsPerUnit: z.string().optional(),
  calories: z.string().optional(),
  protein: z.string().optional(),
  carbs: z.string().optional(),
  fat: z.string().optional(),
  fiber: z.string().optional(),
  allergens: z.array(z.nativeEnum(AllergenType)),
  isActive: z.boolean(),
});

export const categoryFormSchema = z.object({
  name: z.string().trim().min(2, 'عنوان دسته‌بندی الزامی است'),
  description: z.string().optional(),
  color: z.string().min(1, 'انتخاب رنگ الزامی است'),
  icon: z.string().min(1, 'انتخاب آیکن الزامی است'),
  order: z.number({ message: 'عدد معتبر وارد کنید' }).min(1).max(100),
  isActive: z.boolean(),
});

export const shoppingItemFormSchema = z.object({
  name: z.string().trim().min(2, 'نام کالا الزامی است'),
  suggestedBuyQuantity: z.number({ message: 'مقدار معتبر وارد کنید' }).positive('مقدار باید بیشتر از صفر باشد'),
  unit: z.nativeEnum(UnitType),
  categoryId: z.string().min(1, 'دسته‌بندی الزامی است'),
  note: z.string().optional(),
});

export const pantryItemFormSchema = z.object({
  ingredientId: z.string().min(1, 'انتخاب ماده اولیه الزامی است'),
  quantity: z.number({ message: 'مقدار معتبر وارد کنید' }).min(0, 'مقدار نمی‌تواند منفی باشد'),
  unit: z.nativeEnum(UnitType),
  shoppingCategoryId: z.string().min(1, 'دسته‌بندی الزامی است'),
  expiryDateISO: z.string().optional(),
  lowStockThreshold: z.string().optional(),
  note: z.string().optional(),
});

export const supplementSchema = z.object({
  name: z.string().trim().min(2, 'نام مکمل الزامی است'),
  form: z.string().trim().min(2, 'شکل مصرف (مثل کپسول یا قرص) الزامی است'),
  dosageAmount: z.string().optional(),
  dosageUnit: z.string().optional(),
  activeDays: z.array(z.number()),
  timeOfDay: z.string().optional(),
  linkedMealSlot: z.string().optional(),
  doctorOrPharmacistNote: z.string().optional(),
  userNote: z.string().optional(),
  isActive: z.boolean(),
});

export const agentPreferencesSchema = z.object({
  planningStyle: z.nativeEnum(PlanningStyle),
  varietyLevel: z.nativeEnum(VarietyLevel),
  preferQuickMeals: z.boolean(),
  budgetLevel: z.nativeEnum(BudgetLevel),
  prioritizePantry: z.boolean(),
  forbiddenFoodNotes: z.string(),
  maxRecipeRepeatsPerWeek: z.number({ message: 'عدد معتبر وارد کنید' }).min(1).max(7),
  customInstructions: z.string().max(1200, 'حداکثر ۱۲۰۰ کاراکتر مجاز است'),
});
