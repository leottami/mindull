/**
 * Reality-Check Scheduler Tests
 * Testet Seeded-Randomness, Abstandsregeln, No-Overlap und Edgecases
 */

import { RCScheduler, RCScheduleConfig, RCSlot } from '../../services/notifications/rc.scheduler';
import { RealityCheckSchedule } from '../../services/notifications/types';

// =========================================================================
// TEST HELPERS
// =========================================================================

const createGratitudeSlot = (
  hour: number,
  minute: number,
  category: 'gratitude_morning' | 'gratitude_evening'
): RCSlot => {
  const date = new Date('2024-01-15');
  date.setHours(hour, minute, 0, 0);
  
  return {
    startTime: date,
    endTime: new Date(date.getTime() + 5 * 60 * 1000), // 5 Minuten Dauer
    category
  };
};

const createRCConfig = (
  userId: string,
  date: string,
  count: number,
  startTime: string = '10:00',
  endTime: string = '20:00',
  gratitudeSlots: RCSlot[] = []
): RCScheduleConfig => ({
  userId,
  date,
  realityCheckSchedule: {
    enabled: true,
    startTime,
    endTime,
    count,
    quietHoursStart: '20:00',
    quietHoursEnd: '10:00'
  },
  gratitudeSlots
});

// =========================================================================
// TESTS
// =========================================================================

describe('RCScheduler', () => {
  beforeEach(() => {
    // Reset any global state if needed
  });

  describe('Seeded Randomness', () => {
    it('should generate same slots for same userId and date', () => {
      const config1 = createRCConfig('user123', '2024-01-15', 3);
      const config2 = createRCConfig('user123', '2024-01-15', 3);

      const result1 = RCScheduler.generateSlots(config1);
      const result2 = RCScheduler.generateSlots(config2);

      expect(result1.slots).toHaveLength(3);
      expect(result2.slots).toHaveLength(3);
      
      // Slots sollten identisch sein (gleicher Seed)
      result1.slots.forEach((slot, index) => {
        expect(slot.getTime()).toBe(result2.slots[index].getTime());
      });
    });

    it('should generate different slots for different users', () => {
      const config1 = createRCConfig('user123', '2024-01-15', 3);
      const config2 = createRCConfig('user456', '2024-01-15', 3);

      const result1 = RCScheduler.generateSlots(config1);
      const result2 = RCScheduler.generateSlots(config2);

      expect(result1.slots).toHaveLength(3);
      expect(result2.slots).toHaveLength(3);
      
      // Mindestens ein Slot sollte unterschiedlich sein
      const differentSlots = result1.slots.some((slot, index) => 
        slot.getTime() !== result2.slots[index].getTime()
      );
      expect(differentSlots).toBe(true);
    });

    it('should generate different slots for different dates', () => {
      const config1 = createRCConfig('user123', '2024-01-15', 3);
      const config2 = createRCConfig('user123', '2024-01-16', 3);

      const result1 = RCScheduler.generateSlots(config1);
      const result2 = RCScheduler.generateSlots(config2);

      expect(result1.slots).toHaveLength(3);
      expect(result2.slots).toHaveLength(3);
      
      // Mindestens ein Slot sollte unterschiedlich sein
      const differentSlots = result1.slots.some((slot, index) => 
        slot.getTime() !== result2.slots[index].getTime()
      );
      expect(differentSlots).toBe(true);
    });
  });

  describe('Distance Rules', () => {
    it('should maintain minimum 45-minute distance between slots', () => {
      const config = createRCConfig('user123', '2024-01-15', 4);
      const result = RCScheduler.generateSlots(config);

      expect(result.slots).toHaveLength(4);
      expect(result.conflicts).toHaveLength(0);

      // Prüfe Abstand zwischen aufeinanderfolgenden Slots
      for (let i = 1; i < result.slots.length; i++) {
        const distance = result.slots[i].getTime() - result.slots[i - 1].getTime();
        const distanceMinutes = distance / (60 * 1000);
        expect(distanceMinutes).toBeGreaterThanOrEqual(45);
      }
    });

    it('should report conflicts when slots are too close', () => {
      // Test mit kleinem Zeitfenster, das nicht genug Platz bietet
      const config = createRCConfig('user123', '2024-01-15', 5, '10:00', '11:00');
      const result = RCScheduler.generateSlots(config);

      // Sollte Konflikte melden, da 5 Slots mit 45min Abstand nicht in 1h passen
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts.some(c => c.includes('Insufficient time window'))).toBe(true);
    });
  });

  describe('No Overlap with Gratitude', () => {
    it('should avoid gratitude slots with 15-minute protection window', () => {
      const gratitudeSlots = [
        createGratitudeSlot(12, 0, 'gratitude_morning'), // 12:00-12:05
        createGratitudeSlot(18, 0, 'gratitude_evening')  // 18:00-18:05
      ];

      const config = createRCConfig('user123', '2024-01-15', 4, '10:00', '20:00', gratitudeSlots);
      const result = RCScheduler.generateSlots(config);

      expect(result.slots).toHaveLength(4);
      expect(result.warnings.length).toBeLessThanOrEqual(2); // Max 2 warnings für Gratitude-Nähe

      // Prüfe dass keine RC-Slots in Gratitude-Schutzfenster fallen
      result.slots.forEach(slot => {
        const slotHour = slot.getHours();
        const slotMinute = slot.getMinutes();
        
        // Sollte nicht zwischen 11:45-12:20 oder 17:45-18:20 sein
        const isNearMorningGratitude = 
          (slotHour === 11 && slotMinute >= 45) ||
          (slotHour === 12 && slotMinute <= 20);
        
        const isNearEveningGratitude = 
          (slotHour === 17 && slotMinute >= 45) ||
          (slotHour === 18 && slotMinute <= 20);

        expect(isNearMorningGratitude).toBe(false);
        expect(isNearEveningGratitude).toBe(false);
      });
    });

    it('should handle multiple gratitude slots correctly', () => {
      const gratitudeSlots = [
        createGratitudeSlot(8, 0, 'gratitude_morning'),   // 08:00-08:05
        createGratitudeSlot(12, 30, 'gratitude_morning'), // 12:30-12:35
        createGratitudeSlot(19, 0, 'gratitude_evening')   // 19:00-19:05
      ];

      const config = createRCConfig('user123', '2024-01-15', 3, '10:00', '20:00', gratitudeSlots);
      const result = RCScheduler.generateSlots(config);

      expect(result.slots).toHaveLength(3);
      
      // Alle Slots sollten im erlaubten Bereich sein
      result.slots.forEach(slot => {
        const hour = slot.getHours();
        expect(hour).toBeGreaterThanOrEqual(10);
        expect(hour).toBeLessThan(20);
      });
    });
  });

  describe('Window Boundaries', () => {
    it('should respect start and end time boundaries', () => {
      const config = createRCConfig('user123', '2024-01-15', 3, '11:00', '17:00');
      const result = RCScheduler.generateSlots(config);

      expect(result.slots).toHaveLength(3);

      result.slots.forEach(slot => {
        const hour = slot.getHours();
        const minute = slot.getMinutes();
        
        // Sollte zwischen 11:00 und 17:00 sein
        const slotTime = hour + minute / 60;
        expect(slotTime).toBeGreaterThanOrEqual(11);
        expect(slotTime).toBeLessThan(17);
      });
    });

    it('should handle edge case with exact time boundaries', () => {
      const config = createRCConfig('user123', '2024-01-15', 2, '10:00', '11:00');
      const result = RCScheduler.generateSlots(config);

      // Sollte Konflikte melden, da 2 Slots mit 45min Abstand nicht in 1h passen
      expect(result.conflicts.length).toBeGreaterThan(0);
    });

    it('should validate quiet hours correctly', () => {
      // Test mit Ruhezeiten-Überschneidung
      const config = createRCConfig('user123', '2024-01-15', 3, '09:00', '21:00');
      const result = RCScheduler.generateSlots(config);

      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts.some(c => c.includes('quiet hours'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle disabled reality checks', () => {
      const config = createRCConfig('user123', '2024-01-15', 3);
      config.realityCheckSchedule.enabled = false;

      const result = RCScheduler.generateSlots(config);

      expect(result.slots).toHaveLength(0);
      expect(result.conflicts).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle invalid count values', () => {
      const config = createRCConfig('user123', '2024-01-15', 2); // Zu wenig
      const result1 = RCScheduler.generateSlots(config);
      expect(result1.conflicts.some(c => c.includes('between 3 and 5'))).toBe(true);

      const config2 = createRCConfig('user123', '2024-01-15', 6); // Zu viel
      const result2 = RCScheduler.generateSlots(config2);
      expect(result2.conflicts.some(c => c.includes('between 3 and 5'))).toBe(true);
    });

    it('should handle invalid time format', () => {
      const config = createRCConfig('user123', '2024-01-15', 3, '25:00', '20:00'); // Ungültige Zeit
      const result = RCScheduler.generateSlots(config);

      expect(result.conflicts.length).toBeGreaterThan(0);
    });

    it('should handle start time after end time', () => {
      const config = createRCConfig('user123', '2024-01-15', 3, '20:00', '10:00');
      const result = RCScheduler.generateSlots(config);

      expect(result.conflicts.some(c => c.includes('Start time must be before end time'))).toBe(true);
    });

    it('should handle very small time windows', () => {
      const config = createRCConfig('user123', '2024-01-15', 3, '10:00', '10:30'); // Nur 30 Minuten
      const result = RCScheduler.generateSlots(config);

      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts.some(c => c.includes('Insufficient time window'))).toBe(true);
    });

    it('should handle maximum count in minimum window', () => {
      // 5 Slots mit 45min Abstand brauchen mindestens 4 * 45 = 180min = 3h
      const config = createRCConfig('user123', '2024-01-15', 5, '10:00', '13:00'); // 3h
      const result = RCScheduler.generateSlots(config);

      // Sollte gerade so funktionieren
      expect(result.slots).toHaveLength(5);
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe('Distribution Quality', () => {
    it('should distribute slots relatively evenly', () => {
      const config = createRCConfig('user123', '2024-01-15', 4, '10:00', '18:00'); // 8h Fenster
      const result = RCScheduler.generateSlots(config);

      expect(result.slots).toHaveLength(4);

      // Berechne Abstände zwischen Slots
      const distances: number[] = [];
      for (let i = 1; i < result.slots.length; i++) {
        const distance = result.slots[i].getTime() - result.slots[i - 1].getTime();
        distances.push(distance / (60 * 1000)); // In Minuten
      }

      // Abstände sollten relativ gleichmäßig sein (nicht zu stark variieren)
      const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
      const variance = distances.reduce((sum, d) => sum + Math.pow(d - avgDistance, 2), 0) / distances.length;
      const stdDev = Math.sqrt(variance);

      // Standardabweichung sollte nicht zu groß sein (max 30% des Durchschnitts)
      expect(stdDev / avgDistance).toBeLessThan(0.3);
    });

    it('should handle different count values correctly', () => {
      [3, 4, 5].forEach(count => {
        const config = createRCConfig('user123', '2024-01-15', count);
        const result = RCScheduler.generateSlots(config);

        expect(result.slots).toHaveLength(count);
        expect(result.conflicts).toHaveLength(0);
      });
    });
  });

  describe('Debug Methods', () => {
    it('should debug available slots correctly', () => {
      const gratitudeSlots = [
        createGratitudeSlot(12, 0, 'gratitude_morning'),
        createGratitudeSlot(18, 0, 'gratitude_evening')
      ];

      const availableSlots = RCScheduler.debugAvailableSlots('2024-01-15', gratitudeSlots);

      expect(availableSlots.length).toBeGreaterThan(0);
      
      // Alle verfügbaren Slots sollten im 10:00-20:00 Fenster sein
      availableSlots.forEach(slot => {
        expect(slot.start.getHours()).toBeGreaterThanOrEqual(10);
        expect(slot.end.getHours()).toBeLessThanOrEqual(20);
        expect(slot.duration).toBeGreaterThan(0);
      });
    });
  });
});
