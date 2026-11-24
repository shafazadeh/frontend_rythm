import { ActivityLevel, AllergenType, DailyPlanStatus, MealSlotType, UnitType } from '../types/domain';

export const UNIT_LABELS: Record<UnitType, string> = {
  [UnitType.GRAM]: 'گرم',
  [UnitType.KILOGRAM]: 'کیلوگرم',
  [UnitType.MILLILITER]: 'میلی‌لیتر',
  [UnitType.LITER]: 'لیتر',
  [UnitType.PIECE]: 'عدد',
  [UnitType.TABLESPOON]: 'قاشق غذاخوری',
  [UnitType.TEASPOON]: 'قاشق چای‌خوری',
  [UnitType.CUP]: 'پیمانه',
  [UnitType.SLICE]: 'برش',
  [UnitType.PACK]: 'بسته',
};

export const MEAL_SLOT_LABELS: Record<MealSlotType, string> = {
  [MealSlotType.BREAKFAST]: 'صبحانه',
  [MealSlotType.MORNING_SNACK]: 'میان‌وعده صبح',
  [MealSlotType.LUNCH]: 'ناهار',
  [MealSlotType.AFTERNOON_SNACK]: 'میان‌وعده عصر',
  [MealSlotType.DINNER]: 'شام',
};

export const MEAL_SLOT_ORDER: MealSlotType[] = [
  MealSlotType.BREAKFAST,
  MealSlotType.MORNING_SNACK,
  MealSlotType.LUNCH,
  MealSlotType.AFTERNOON_SNACK,
  MealSlotType.DINNER,
];

export const PERSIAN_WEEKDAY_NAMES: string[] = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنج‌شنبه',
  'جمعه',
];

export const DAILY_STATUS_LABELS: Record<DailyPlanStatus, string> = {
  [DailyPlanStatus.UNPLANNED]: 'برنامه‌ریزی‌نشده',
  [DailyPlanStatus.DRAFT]: 'پیش‌نویس',
  [DailyPlanStatus.IN_REVIEW]: 'در حال بررسی',
  [DailyPlanStatus.CONFIRMED]: 'تأییدشده',
};

export const ALLERGEN_LABELS: Record<AllergenType, string> = {
  [AllergenType.DAIRY]: 'لبنیات',
  [AllergenType.GLUTEN]: 'گلوتن',
  [AllergenType.NUTS]: 'مغزها و آجیل',
  [AllergenType.EGGS]: 'تخم‌مرغ',
  [AllergenType.SEAFOOD]: 'غذاهای دریایی',
  [AllergenType.SOY]: 'سویا',
  [AllergenType.SESAME]: 'کنجد',
};

export const ACTIVITY_LEVEL_INFO: Record<
  ActivityLevel,
  { label: string; multiplier: number; description: string }
> = {
  [ActivityLevel.SEDENTARY]: {
    label: 'کم‌تحرک',
    multiplier: 1.2,
    description: 'کار پشت‌میز بدون ورزش منظم',
  },
  [ActivityLevel.LIGHT]: {
    label: 'فعالیت سبک',
    multiplier: 1.375,
    description: '۱ تا ۳ روز ورزش سبک در هفته',
  },
  [ActivityLevel.MODERATE]: {
    label: 'فعالیت متوسط',
    multiplier: 1.55,
    description: '۳ تا ۵ روز ورزش منظم در هفته',
  },
  [ActivityLevel.ACTIVE]: {
    label: 'فعالیت بالا',
    multiplier: 1.725,
    description: '۶ تا ۷ روز تمرین جدی در هفته',
  },
  [ActivityLevel.VERY_ACTIVE]: {
    label: 'بسیار پرتحرک',
    multiplier: 1.9,
    description: 'تمرینات سنگین روزانه یا شغل فیزیکی',
  },
};

export const COMMON_TIMEZONES = [
  { value: 'Asia/Tehran', label: 'تهران (Asia/Tehran)' },
  { value: 'Europe/London', label: 'لندن (Europe/London)' },
  { value: 'Europe/Berlin', label: 'برلین (Europe/Berlin)' },
  { value: 'Asia/Dubai', label: 'دبی (Asia/Dubai)' },
  { value: 'America/Toronto', label: 'تورنتو (America/Toronto)' },
  { value: 'UTC', label: 'هماهنگ جهانی (UTC)' },
];
