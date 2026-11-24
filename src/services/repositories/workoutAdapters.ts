import { RhythmAppData, UserProfile } from '../../shared/types/domain';
import {
  Exercise,
  MetReferenceEntry,
  WorkoutActivityLog,
  WorkoutPreferences,
  WorkoutProgram,
  WorkoutSession,
  WorkoutTemplate,
} from '../../shared/types/workout';

/**
 * Typed Repository Interface for the Workout Module.
 * Future Backend (PostgreSQL / REST / LangGraph) implements this exact contract.
 */
export interface IWorkoutRepository {
  upsertExercise(exercise: Exercise): Promise<Exercise>;
  deleteExercise(exerciseId: string): Promise<void>;

  saveWorkoutProgramWithTemplates(
    program: WorkoutProgram,
    templates: WorkoutTemplate[]
  ): Promise<{ program: WorkoutProgram; templates: WorkoutTemplate[] }>;
  duplicateWorkoutProgram(programId: string): Promise<WorkoutProgram>;
  toggleWorkoutProgramActive(programId: string, isActive: boolean): Promise<WorkoutProgram>;
  deleteWorkoutProgram(programId: string): Promise<void>;

  upsertWorkoutSession(session: WorkoutSession): Promise<WorkoutSession>;
  deleteWorkoutSession(sessionId: string): Promise<void>;
  generateWeeklyWorkoutSessions(params: {
    weekStartISO: string;
    programId: string;
    preferredDays?: number[];
    defaultStartTime?: string;
  }): Promise<WorkoutSession[]>;

  saveWorkoutActivityLog(
    log: WorkoutActivityLog,
    nextSessionStatus?: WorkoutSession['status'],
    updatedExercises?: WorkoutSession['exercises']
  ): Promise<WorkoutActivityLog>;

  updateWorkoutPreferences(prefs: WorkoutPreferences): Promise<WorkoutPreferences>;
  updateMetReferenceTable(entries: MetReferenceEntry[]): Promise<MetReferenceEntry[]>;
}

/**
 * Extensible Calendar Integration Adapter Interface.
 * Future versions can implement GoogleCalendarIntegrationAdapter without modifying UI components.
 */
export interface CalendarSyncEventPayload {
  id: string;
  title: string;
  dateISO: string;
  startTime: string;
  endTime: string;
  sourceModule: 'WORKOUT';
  notes?: string;
}

export interface ICalendarIntegrationAdapter {
  readonly providerName: string;
  readonly isConnected: boolean;
  listExternalBusySlots(weekStartISO: string, weekEndISO: string): Promise<CalendarSyncEventPayload[]>;
  syncWorkoutSession(session: WorkoutSession): Promise<{ synced: boolean; externalEventId?: string }>;
}

export class LocalStubCalendarIntegrationAdapter implements ICalendarIntegrationAdapter {
  readonly providerName = 'Google Calendar (غیرفعال در نسخه اول)';
  readonly isConnected = false;

  async listExternalBusySlots(): Promise<CalendarSyncEventPayload[]> {
    return [];
  }

  async syncWorkoutSession(): Promise<{ synced: boolean }> {
    return { synced: false };
  }
}

export const calendarIntegrationAdapter: ICalendarIntegrationAdapter =
  new LocalStubCalendarIntegrationAdapter();

/**
 * Read-only Adapter connecting Workout Module with shared Profile & Nutrition data.
 * Strictly prohibits mutating nutrition targets or duplicating user profile records.
 */
export interface SharedNutritionWorkoutContext {
  userWeightKg: number | null;
  timezone: string;
  dailyCalorieTarget: number | null;
  hasNutritionPlan: boolean;
  weeklyPlannedFoodCaloriesAvg: number | null;
}

export interface INutritionProfileAdapter {
  extractSharedContext(data: RhythmAppData): SharedNutritionWorkoutContext;
}

export const rhythmNutritionAdapter: INutritionProfileAdapter = {
  extractSharedContext(data: RhythmAppData): SharedNutritionWorkoutContext {
    const profile: UserProfile | undefined = data.profile;
    const userWeightKg =
      profile?.weightKg && Number.isFinite(profile.weightKg) && profile.weightKg > 0
        ? profile.weightKg
        : null;

    const latestPlan = data.weeklyPlans[0];
    const hasNutritionPlan = Boolean(latestPlan && latestPlan.snapshots.length > 0);
    const weeklyPlannedFoodCaloriesAvg =
      latestPlan?.snapshots[0]?.averageCalories ?? null;

    return {
      userWeightKg,
      timezone: profile?.timezone ?? 'Asia/Tehran',
      dailyCalorieTarget: data.target?.dailyCalories ?? null,
      hasNutritionPlan,
      weeklyPlannedFoodCaloriesAvg,
    };
  },
};
