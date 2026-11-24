import { EntityId, ISODateString } from './domain';

export enum ExerciseType {
  STRENGTH = 'STRENGTH',
  CARDIO = 'CARDIO',
  STRETCHING = 'STRETCHING',
  MOBILITY = 'MOBILITY',
  BALANCE = 'BALANCE',
}

export enum DifficultyLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
}

export enum WorkoutGoal {
  STRENGTH_GAIN = 'STRENGTH_GAIN',
  MUSCLE_GAIN = 'MUSCLE_GAIN',
  ENDURANCE = 'ENDURANCE',
  GENERAL_FITNESS = 'GENERAL_FITNESS',
  MOBILITY_FLEXIBILITY = 'MOBILITY_FLEXIBILITY',
  WEIGHT_MANAGEMENT = 'WEIGHT_MANAGEMENT',
}

export enum WorkoutSessionStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  MISSED = 'MISSED',
  CANCELLED = 'CANCELLED',
}

export enum CardioIntensity {
  LIGHT = 'LIGHT',
  MODERATE = 'MODERATE',
  VIGOROUS = 'VIGOROUS',
}

export interface ExerciseCategory {
  id: EntityId;
  name: string;
  type: ExerciseType;
  description?: string;
  order: number;
  isActive: boolean;
}

export interface Exercise {
  id: EntityId;
  persianName: string;
  englishName?: string;
  type: ExerciseType;
  categoryId: EntityId;
  targetMuscleGroups: string[];
  difficulty: DifficultyLevel;
  equipment: string[];
  instructions: string;
  safetyNotes: string;
  mediaUrl?: string;
  defaultMet: number;
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface MetReferenceEntry {
  id: EntityId;
  exerciseType: ExerciseType;
  intensity: CardioIntensity;
  label: string;
  metValue: number;
  description: string;
}

export interface WorkoutTemplateExercise {
  id: EntityId;
  exerciseId: EntityId;
  order: number;
  exerciseType: ExerciseType;
  // Strength fields
  sets?: number;
  reps?: number;
  targetWeightKg?: number;
  restSeconds?: number;
  // Cardio fields
  durationMinutes?: number;
  intensity?: CardioIntensity;
  targetDistanceKm?: number;
  targetSpeedKmh?: number;
  // Stretching / Mobility / Balance fields
  holdSeconds?: number;
  notes?: string;
}

export interface WorkoutTemplate {
  id: EntityId;
  programId?: EntityId;
  title: string;
  type: ExerciseType;
  estimatedDurationMinutes: number;
  difficulty: DifficultyLevel;
  exercises: WorkoutTemplateExercise[];
  notes?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface WorkoutProgram {
  id: EntityId;
  title: string;
  goal: WorkoutGoal;
  difficulty: DifficultyLevel;
  sessionsPerWeek: number;
  startDateISO: string; // YYYY-MM-DD
  endDateISO?: string; // YYYY-MM-DD
  description?: string;
  templateIds: EntityId[];
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface WorkoutSet {
  id: EntityId;
  setNumber: number;
  targetReps?: number;
  targetWeightKg?: number;
  actualReps?: number;
  actualWeightKg?: number;
  isCompleted: boolean;
}

export interface WorkoutSessionExercise {
  id: EntityId;
  exerciseId: EntityId;
  order: number;
  exerciseType: ExerciseType;
  restSeconds?: number;
  // Strength sets
  sets: WorkoutSet[];
  // Cardio target/actual
  targetDurationMinutes?: number;
  actualDurationMinutes?: number;
  targetIntensity?: CardioIntensity;
  targetDistanceKm?: number;
  actualDistanceKm?: number;
  targetSpeedKmh?: number;
  perceivedRpe?: number; // 1..10
  // Stretching / Mobility / Balance
  targetSetsCount?: number;
  targetRepsCount?: number;
  holdSeconds?: number;
  isCompleted: boolean;
  notes?: string;
}

export interface WorkoutSession {
  id: EntityId;
  programId?: EntityId;
  templateId?: EntityId;
  title: string;
  type: ExerciseType;
  dateISO: string; // YYYY-MM-DD
  dayIndex: number; // 0 = Saturday .. 6 = Friday
  startTime: string; // HH:mm 24h
  endTime: string; // HH:mm 24h
  estimatedDurationMinutes: number;
  status: WorkoutSessionStatus;
  reminderEnabled: boolean;
  notes?: string;
  exercises: WorkoutSessionExercise[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface WorkoutPauseInterval {
  startedAtISO: ISODateString;
  resumedAtISO?: ISODateString;
}

export interface WorkoutActivityLog {
  id: EntityId;
  sessionId: EntityId;
  programId?: EntityId;
  templateId?: EntityId;
  title: string;
  type: ExerciseType;
  dateISO: string;
  startedAtISO: ISODateString;
  endedAtISO?: ISODateString;
  pauseIntervals: WorkoutPauseInterval[];
  actualDurationMinutes: number;
  estimatedCalories: number | null;
  caloriesFormulaNote?: string;
  completedExercisesCount: number;
  totalExercisesCount: number;
  completedSetsCount: number;
  totalSetsCount: number;
  perceivedRpe?: number;
  userNotes?: string;
  exercisesSnapshot: WorkoutSessionExercise[];
  status: 'IN_PROGRESS' | 'COMPLETED' | 'PARTIAL' | 'CANCELLED';
  updatedAt: ISODateString;
}

export interface WorkoutPreferences {
  primaryGoal: WorkoutGoal;
  experienceLevel: DifficultyLevel;
  preferredSessionsPerWeek: number;
  preferredDurationMinutes: number;
  preferredDays: number[]; // 0..6 (Sat..Fri)
  preferredTimeStart: string; // HH:mm
  preferredTimeEnd: string; // HH:mm
  favoriteTypes: ExerciseType[];
  availableEquipment: string[];
  movementLimitations: string;
  personalNotes: string;
  updatedAt: ISODateString;
}

export interface WorkoutProgressSummary {
  plannedCount: number;
  completedCount: number;
  missedCount: number;
  cancelledCount: number;
  inProgressCount: number;
  totalDurationMinutes: number;
  totalEstimatedCalories: number;
  adherencePercent: number;
}
