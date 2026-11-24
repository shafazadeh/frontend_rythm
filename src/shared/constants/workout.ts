import {
  CardioIntensity,
  DifficultyLevel,
  ExerciseType,
  WorkoutGoal,
  WorkoutSessionStatus,
} from '../types/workout';

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  [ExerciseType.STRENGTH]: 'قدرتی',
  [ExerciseType.CARDIO]: 'هوازی',
  [ExerciseType.STRETCHING]: 'کششی',
  [ExerciseType.MOBILITY]: 'تحرک‌پذیری (Mobility)',
  [ExerciseType.BALANCE]: 'تعادلی',
};

export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  [DifficultyLevel.BEGINNER]: 'مبتدی',
  [DifficultyLevel.INTERMEDIATE]: 'متوسط',
  [DifficultyLevel.ADVANCED]: 'پیشرفته',
};

export const WORKOUT_GOAL_LABELS: Record<WorkoutGoal, string> = {
  [WorkoutGoal.STRENGTH_GAIN]: 'افزایش قدرت',
  [WorkoutGoal.MUSCLE_GAIN]: 'عضله‌سازی',
  [WorkoutGoal.ENDURANCE]: 'افزایش استقامت',
  [WorkoutGoal.GENERAL_FITNESS]: 'آمادگی جسمانی',
  [WorkoutGoal.MOBILITY_FLEXIBILITY]: 'افزایش تحرک',
  [WorkoutGoal.WEIGHT_MANAGEMENT]: 'مدیریت وزن',
};

export const WORKOUT_STATUS_LABELS: Record<WorkoutSessionStatus, string> = {
  [WorkoutSessionStatus.PLANNED]: 'برنامه‌ریزی‌شده',
  [WorkoutSessionStatus.IN_PROGRESS]: 'در حال انجام',
  [WorkoutSessionStatus.COMPLETED]: 'تکمیل‌شده',
  [WorkoutSessionStatus.MISSED]: 'انجام‌نشده',
  [WorkoutSessionStatus.CANCELLED]: 'لغوشده',
};

export const CARDIO_INTENSITY_LABELS: Record<CardioIntensity, string> = {
  [CardioIntensity.LIGHT]: 'سبک',
  [CardioIntensity.MODERATE]: 'متوسط',
  [CardioIntensity.VIGOROUS]: 'شدید',
};

export const COMMON_MUSCLE_GROUPS: string[] = [
  'سینه',
  'پشت و زیربغل',
  'سرشانه',
  'جلوبازو',
  'پشت‌بازو',
  'چهارسر ران',
  'همسترینگ',
  'باسن',
  'میان‌تنه (شکم)',
  'ساق پا',
  'کل بدن',
  'ستون فقرات و لگن',
];

export const COMMON_EQUIPMENT_LIST: string[] = [
  'بدون وسیله (وزن بدن)',
  'دمبل',
  'هالتر',
  'کتل‌بل',
  'دستگاه سیم‌کش',
  'کش مقاومتی',
  'تردمیل',
  'دوچرخه ثابت',
  'الپتیکال',
  'طناب ورزشی',
  'مت ورزشی',
  'بارفیکس',
];
