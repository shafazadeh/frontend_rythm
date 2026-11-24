import { z } from 'zod';
import {
  CardioIntensity,
  DifficultyLevel,
  ExerciseType,
  WorkoutGoal,
} from '../types/workout';

export const exerciseFormSchema = z.object({
  persianName: z.string().trim().min(2, 'نام فارسی حرکت الزامی است'),
  englishName: z.string().optional(),
  type: z.nativeEnum(ExerciseType),
  categoryId: z.string().min(1, 'دسته‌بندی الزامی است'),
  targetMuscleGroups: z.array(z.string()).min(1, 'حداقل یک گروه عضلانی انتخاب کنید'),
  difficulty: z.nativeEnum(DifficultyLevel),
  equipment: z.array(z.string()).min(1, 'حداقل یک مورد تجهیز یا بدون وسیله انتخاب کنید'),
  instructions: z.string().trim().min(5, 'روش صحیح اجرا باید حداقل ۵ کاراکتر باشد'),
  safetyNotes: z.string().trim().min(3, 'نکات ایمنی حرکت را وارد کنید'),
  mediaUrl: z.string().optional(),
  defaultMet: z
    .number({ message: 'مقدار MET معتبر نیست' })
    .min(1, 'حداقل MET برابر ۱ است')
    .max(20, 'حداکثر MET برابر ۲۰ است'),
  isActive: z.boolean(),
});

export const workoutTemplateExerciseSchema = z.object({
  id: z.string(),
  exerciseId: z.string().min(1, 'انتخاب حرکت الزامی است'),
  order: z.number(),
  exerciseType: z.nativeEnum(ExerciseType),
  sets: z.number().min(1).max(30).optional(),
  reps: z.number().min(1).max(200).optional(),
  targetWeightKg: z.number().min(0).max(500).optional(),
  restSeconds: z.number().min(0).max(600).optional(),
  durationMinutes: z.number().min(1).max(300).optional(),
  intensity: z.nativeEnum(CardioIntensity).optional(),
  targetDistanceKm: z.number().min(0).max(200).optional(),
  targetSpeedKmh: z.number().min(0).max(60).optional(),
  holdSeconds: z.number().min(5).max(600).optional(),
  notes: z.string().optional(),
});

export const workoutTemplateFormSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(2, 'عنوان جلسه تمرینی الزامی است'),
  type: z.nativeEnum(ExerciseType),
  estimatedDurationMinutes: z.number({ message: 'مدت تخمینی معتبر نیست' }).min(5).max(300),
  difficulty: z.nativeEnum(DifficultyLevel),
  exercises: z.array(workoutTemplateExerciseSchema).min(1, 'حداقل یک حرکت اضافه کنید'),
  notes: z.string().optional(),
});

export const workoutProgramFormSchema = z.object({
  title: z.string().trim().min(2, 'عنوان برنامه تمرینی الزامی است'),
  goal: z.nativeEnum(WorkoutGoal),
  difficulty: z.nativeEnum(DifficultyLevel),
  sessionsPerWeek: z.number({ message: 'تعداد جلسات معتبر نیست' }).min(1).max(7),
  startDateISO: z.string().min(8, 'تاریخ شروع الزامی است'),
  endDateISO: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean(),
  templates: z.array(workoutTemplateFormSchema).min(1, 'حداقل یک قالب جلسه برای برنامه تعریف کنید'),
});

export const workoutSessionFormSchema = z.object({
  title: z.string().trim().min(2, 'عنوان جلسه الزامی است'),
  type: z.nativeEnum(ExerciseType),
  dateISO: z.string().min(8, 'تاریخ جلسه الزامی است'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'ساعت شروع معتبر نیست (HH:mm)'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'ساعت پایان معتبر نیست (HH:mm)'),
  programId: z.string().optional(),
  templateId: z.string().optional(),
  reminderEnabled: z.boolean(),
  notes: z.string().optional(),
});

export const workoutPreferencesSchema = z.object({
  primaryGoal: z.nativeEnum(WorkoutGoal),
  experienceLevel: z.nativeEnum(DifficultyLevel),
  preferredSessionsPerWeek: z.number({ message: 'تعداد جلسات معتبر نیست' }).min(1).max(7),
  preferredDurationMinutes: z.number({ message: 'مدت جلسه معتبر نیست' }).min(10).max(240),
  preferredDays: z.array(z.number()),
  preferredTimeStart: z.string().regex(/^\d{2}:\d{2}$/, 'فرمت ساعت معتبر نیست'),
  preferredTimeEnd: z.string().regex(/^\d{2}:\d{2}$/, 'فرمت ساعت معتبر نیست'),
  favoriteTypes: z.array(z.nativeEnum(ExerciseType)),
  availableEquipment: z.array(z.string()),
  movementLimitations: z.string(),
  personalNotes: z.string(),
});
