/**
 * Reality-Check Scheduler
 * Algorithmus für gleichmäßige Verteilung von RC-Notifications
 * Mit Abstandsregeln, Ruhezeiten und Seeded-Randomness
 */

import { RealityCheckSchedule } from './types';

// =========================================================================
// TYPES
// =========================================================================

export interface RCSlot {
  startTime: Date;
  endTime: Date;
  category: 'reality_check' | 'gratitude_morning' | 'gratitude_evening';
}

export interface RCScheduleConfig {
  userId: string;
  date: string; // YYYY-MM-DD
  realityCheckSchedule: RealityCheckSchedule;
  gratitudeSlots: RCSlot[]; // Bereits geplante Gratitude-Slots
}

export interface RCScheduleResult {
  slots: Date[];
  conflicts: string[];
  warnings: string[];
}

// =========================================================================
// CONSTANTS
// =========================================================================

const MIN_SLOT_DISTANCE = 45 * 60 * 1000; // 45 Minuten in ms
const GRATITUDE_PROTECTION_WINDOW = 15 * 60 * 1000; // 15 Minuten Schutzfenster
const QUIET_HOURS_START = 20; // 20:00 Uhr
const QUIET_HOURS_END = 10; // 10:00 Uhr
const DEFAULT_RC_START = 10; // 10:00 Uhr
const DEFAULT_RC_END = 20; // 20:00 Uhr

// =========================================================================
// RC SCHEDULER
// =========================================================================

export class RCScheduler {
  /**
   * Generiert Reality-Check-Slots für einen Tag
   * Mit Seeded-Randomness für Reproduzierbarkeit
   */
  static generateSlots(config: RCScheduleConfig): RCScheduleResult {
    const { userId, date, realityCheckSchedule, gratitudeSlots } = config;
    
    if (!realityCheckSchedule.enabled) {
      return { slots: [], conflicts: [], warnings: [] };
    }

    // Validiere Konfiguration
    const validation = this.validateConfig(realityCheckSchedule);
    if (validation.errors.length > 0) {
      return { 
        slots: [], 
        conflicts: validation.errors, 
        warnings: validation.warnings 
      };
    }

    // Erstelle Seeded-Random-Generator
    const seed = this.generateSeed(userId, date);
    const random = this.createSeededRandom(seed);

    // Definiere verfügbares Zeitfenster
    const availableWindow = this.calculateAvailableWindow(
      realityCheckSchedule,
      gratitudeSlots
    );

    if (availableWindow.duration < MIN_SLOT_DISTANCE * realityCheckSchedule.count) {
      return {
        slots: [],
        conflicts: [`Insufficient time window: ${availableWindow.duration}ms for ${realityCheckSchedule.count} slots`],
        warnings: []
      };
    }

    // Generiere Slots mit gleichmäßiger Verteilung
    const slots = this.distributeSlotsEvenly(
      availableWindow,
      realityCheckSchedule.count,
      random
    );

    // Validiere finale Slots
    const validationResult = this.validateSlots(slots, gratitudeSlots);
    
    return {
      slots,
      conflicts: validationResult.conflicts,
      warnings: validationResult.warnings
    };
  }

  /**
   * Validiert Reality-Check-Konfiguration
   */
  private static validateConfig(schedule: RealityCheckSchedule): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validiere Count (3-5)
    if (schedule.count < 3 || schedule.count > 5) {
      errors.push(`Reality check count must be between 3 and 5, got ${schedule.count}`);
    }

    // Validiere Zeitfenster
    const startHour = parseInt(schedule.startTime.split(':')[0]);
    const endHour = parseInt(schedule.endTime.split(':')[0]);

    if (startHour >= endHour) {
      errors.push('Start time must be before end time');
    }

    if (startHour < QUIET_HOURS_END || endHour > QUIET_HOURS_START) {
      warnings.push('Schedule overlaps with quiet hours (20:00-10:00)');
    }

    // Validiere Ruhezeiten
    if (startHour < QUIET_HOURS_END) {
      errors.push(`Start time ${schedule.startTime} is during quiet hours`);
    }

    if (endHour > QUIET_HOURS_START) {
      errors.push(`End time ${schedule.endTime} is during quiet hours`);
    }

    return { errors, warnings };
  }

  /**
   * Berechnet verfügbares Zeitfenster unter Berücksichtigung von Gratitude-Slots
   */
  private static calculateAvailableWindow(
    schedule: RealityCheckSchedule,
    gratitudeSlots: RCSlot[]
  ): { start: Date; end: Date; duration: number } {
    const date = new Date();
    const startHour = parseInt(schedule.startTime.split(':')[0]);
    const startMinute = parseInt(schedule.startTime.split(':')[1]);
    const endHour = parseInt(schedule.endTime.split(':')[0]);
    const endMinute = parseInt(schedule.endTime.split(':')[1]);

    const windowStart = new Date(date);
    windowStart.setHours(startHour, startMinute, 0, 0);

    const windowEnd = new Date(date);
    windowEnd.setHours(endHour, endMinute, 0, 0);

    // Erstelle Blocked-Slots aus Gratitude-Slots
    const blockedSlots = this.createBlockedSlots(gratitudeSlots);

    // Entferne Blocked-Slots aus verfügbarem Fenster
    const availableSlots = this.removeBlockedSlots(
      { start: windowStart, end: windowEnd },
      blockedSlots
    );

    // Berechne Gesamtdauer aller verfügbaren Slots
    const totalDuration = availableSlots.reduce(
      (sum, slot) => sum + (slot.end.getTime() - slot.start.getTime()),
      0
    );

    return {
      start: windowStart,
      end: windowEnd,
      duration: totalDuration
    };
  }

  /**
   * Erstellt Blocked-Slots aus Gratitude-Slots mit Schutzfenster
   */
  private static createBlockedSlots(gratitudeSlots: RCSlot[]): Array<{ start: Date; end: Date }> {
    return gratitudeSlots.map(slot => ({
      start: new Date(slot.startTime.getTime() - GRATITUDE_PROTECTION_WINDOW),
      end: new Date(slot.endTime.getTime() + GRATITUDE_PROTECTION_WINDOW)
    }));
  }

  /**
   * Entfernt Blocked-Slots aus verfügbarem Fenster
   */
  private static removeBlockedSlots(
    window: { start: Date; end: Date },
    blockedSlots: Array<{ start: Date; end: Date }>
  ): Array<{ start: Date; end: Date }> {
    let availableSlots: Array<{ start: Date; end: Date }> = [window];

    for (const blockedSlot of blockedSlots) {
      const newAvailableSlots: Array<{ start: Date; end: Date }> = [];

      for (const availableSlot of availableSlots) {
        // Keine Überlappung
        if (blockedSlot.end <= availableSlot.start || blockedSlot.start >= availableSlot.end) {
          newAvailableSlots.push(availableSlot);
          continue;
        }

        // Teilweise Überlappung - schneide aus
        if (blockedSlot.start > availableSlot.start) {
          newAvailableSlots.push({
            start: availableSlot.start,
            end: blockedSlot.start
          });
        }

        if (blockedSlot.end < availableSlot.end) {
          newAvailableSlots.push({
            start: blockedSlot.end,
            end: availableSlot.end
          });
        }
      }

      availableSlots = newAvailableSlots;
    }

    return availableSlots;
  }

  /**
   * Verteilt Slots gleichmäßig über verfügbares Fenster
   */
  private static distributeSlotsEvenly(
    window: { start: Date; end: Date; duration: number },
    count: number,
    random: () => number
  ): Date[] {
    const slots: Date[] = [];
    const interval = window.duration / (count + 1);

    for (let i = 1; i <= count; i++) {
      const baseTime = window.start.getTime() + (interval * i);
      
      // Füge Zufälligkeit hinzu (±15% des Intervalls)
      const jitterRange = interval * 0.15;
      const jitter = (random() - 0.5) * 2 * jitterRange;
      
      const slotTime = new Date(baseTime + jitter);
      slots.push(slotTime);
    }

    return slots.sort((a, b) => a.getTime() - b.getTime());
  }

  /**
   * Validiert finale Slots gegen Abstandsregeln
   */
  private static validateSlots(
    slots: Date[],
    gratitudeSlots: RCSlot[]
  ): { conflicts: string[]; warnings: string[] } {
    const conflicts: string[] = [];
    const warnings: string[] = [];

    // Prüfe Abstand zwischen RC-Slots
    for (let i = 1; i < slots.length; i++) {
      const distance = slots[i].getTime() - slots[i - 1].getTime();
      if (distance < MIN_SLOT_DISTANCE) {
        conflicts.push(
          `Slot ${i} too close to slot ${i - 1}: ${Math.round(distance / 60000)}min (min: 45min)`
        );
      }
    }

    // Prüfe Abstand zu Gratitude-Slots
    for (const rcSlot of slots) {
      for (const gratitudeSlot of gratitudeSlots) {
        const distanceToStart = Math.abs(
          rcSlot.getTime() - gratitudeSlot.startTime.getTime()
        );
        const distanceToEnd = Math.abs(
          rcSlot.getTime() - gratitudeSlot.endTime.getTime()
        );

        if (distanceToStart < GRATITUDE_PROTECTION_WINDOW || 
            distanceToEnd < GRATITUDE_PROTECTION_WINDOW) {
          warnings.push(
            `RC slot too close to gratitude slot: ${Math.round(Math.min(distanceToStart, distanceToEnd) / 60000)}min`
          );
        }
      }
    }

    return { conflicts, warnings };
  }

  /**
   * Generiert deterministischen Seed aus userId und Datum
   */
  private static generateSeed(userId: string, date: string): number {
    const combined = `${userId}_${date}`;
    let hash = 0;
    
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash);
  }

  /**
   * Erstellt Seeded-Random-Generator (Linear Congruential Generator)
   */
  private static createSeededRandom(seed: number): () => number {
    let state = seed;
    
    return () => {
      // Linear Congruential Generator
      state = (state * 1664525 + 1013904223) % 2 ** 32;
      return state / 2 ** 32;
    };
  }

  /**
   * Debug-Methode: Zeigt verfügbare Slots für einen Tag
   */
  static debugAvailableSlots(
    date: string,
    gratitudeSlots: RCSlot[]
  ): Array<{ start: Date; end: Date; duration: number }> {
    const window = {
      start: new Date(date + 'T10:00:00'),
      end: new Date(date + 'T20:00:00')
    };

    const blockedSlots = this.createBlockedSlots(gratitudeSlots);
    return this.removeBlockedSlots(window, blockedSlots);
  }
}
