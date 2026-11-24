import { RhythmCalendarEvent } from '../../shared/types/calendar';
import { timeToMinutes } from './scheduleConflictChecker';

export interface PositionedCalendarEvent {
  event: RhythmCalendarEvent;
  startMinutes: number;
  visualEndMinutes: number;
  laneIndex: number;
  totalLanes: number;
}

const DEFAULT_POINT_EVENT_VISUAL_SPAN = 42; // Visual height reservation in minutes so overlapping cards never collide

/**
 * Computes collision-free side-by-side lane placement for concurrent or overlapping events on the same day.
 * Never mutates the underlying event's endAt/endTime (point-in-time events keep endTime undefined).
 */
export function layoutOverlappingDayEvents(
  events: RhythmCalendarEvent[],
  displayStartHour = 6,
  displayEndHour = 23
): PositionedCalendarEvent[] {
  const minMinute = displayStartHour * 60;
  const maxMinute = (displayEndHour + 1) * 60;

  const normalized = events
    .map((event) => {
      const startMinutes = timeToMinutes(event.startTime);
      const explicitEnd = event.endTime ? timeToMinutes(event.endTime) : null;
      const visualEndMinutes =
        explicitEnd && explicitEnd > startMinutes
          ? Math.max(startMinutes + 30, explicitEnd)
          : startMinutes + DEFAULT_POINT_EVENT_VISUAL_SPAN;

      return {
        event,
        startMinutes,
        visualEndMinutes,
      };
    })
    .filter((item) => item.visualEndMinutes > minMinute && item.startMinutes < maxMinute)
    .sort(
      (a, b) =>
        a.startMinutes - b.startMinutes ||
        b.visualEndMinutes - a.visualEndMinutes ||
        a.event.title.localeCompare(b.event.title, 'fa')
    );

  if (normalized.length === 0) return [];

  // Partition into connected overlap clusters
  const clusters: Array<typeof normalized> = [];
  let currentCluster: typeof normalized = [];
  let clusterMaxEnd = -1;

  for (const item of normalized) {
    if (currentCluster.length === 0 || item.startMinutes < clusterMaxEnd) {
      currentCluster.push(item);
      clusterMaxEnd = Math.max(clusterMaxEnd, item.visualEndMinutes);
    } else {
      clusters.push(currentCluster);
      currentCluster = [item];
      clusterMaxEnd = item.visualEndMinutes;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const positioned: PositionedCalendarEvent[] = [];

  for (const cluster of clusters) {
    const laneEndTimes: number[] = [];
    const assigned: Array<{
      item: (typeof normalized)[number];
      laneIndex: number;
    }> = [];

    for (const item of cluster) {
      let laneIndex = laneEndTimes.findIndex((endTime) => endTime <= item.startMinutes);
      if (laneIndex === -1) {
        laneIndex = laneEndTimes.length;
        laneEndTimes.push(item.visualEndMinutes);
      } else {
        laneEndTimes[laneIndex] = item.visualEndMinutes;
      }
      assigned.push({ item, laneIndex });
    }

    const totalLanes = Math.max(1, laneEndTimes.length);
    for (const entry of assigned) {
      positioned.push({
        event: entry.item.event,
        startMinutes: entry.item.startMinutes,
        visualEndMinutes: entry.item.visualEndMinutes,
        laneIndex: entry.laneIndex,
        totalLanes,
      });
    }
  }

  return positioned;
}
