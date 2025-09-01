/**
 * DataAggregator Tests
 * Testet Daten-Aggregation für Evening/Morning AI-Summaries
 */

import { DataAggregator, type DataProvider, type EveningAggregation, type MorningAggregation } from '../../../services/ai/aggregate';
import { DiaryEntry } from '../../../models/diary.model';
import { GratitudeEntry } from '../../../models/gratitude.model';
import { BreathingSession } from '../../../models/session.model';

/**
 * Mock Data Provider für Tests
 */
class MockDataProvider implements DataProvider {
  private diaryEntries: DiaryEntry[] = [];
  private gratitudeEntries: GratitudeEntry[] = [];
  private breathingSessions: BreathingSession[] = [];
  private lastEveningSummary: string | null = null;

  constructor(data?: {
    diaryEntries?: DiaryEntry[];
    gratitudeEntries?: GratitudeEntry[];
    breathingSessions?: BreathingSession[];
    lastEveningSummary?: string | null;
  }) {
    if (data) {
      this.diaryEntries = data.diaryEntries || [];
      this.gratitudeEntries = data.gratitudeEntries || [];
      this.breathingSessions = data.breathingSessions || [];
      this.lastEveningSummary = data.lastEveningSummary || null;
    }
  }

  async getDiaryEntries(userId: string, startDate: string, endDate: string): Promise<DiaryEntry[]> {
    return this.diaryEntries.filter(entry => 
      entry.createdAt >= startDate && entry.createdAt <= endDate
    );
  }

  async getGratitudeEntries(userId: string, startDate: string, endDate: string): Promise<GratitudeEntry[]> {
    return this.gratitudeEntries.filter(entry => 
      entry.createdAt >= startDate && entry.createdAt <= endDate
    );
  }

  async getBreathingSessions(userId: string, startDate: string, endDate: string): Promise<BreathingSession[]> {
    return this.breathingSessions.filter(session => 
      session.timestamp >= startDate && session.timestamp <= endDate
    );
  }

  async getLastEveningSummary(userId: string): Promise<string | null> {
    return this.lastEveningSummary;
  }

  // Test-Helper Methoden
  setDiaryEntries(entries: DiaryEntry[]) {
    this.diaryEntries = entries;
  }

  setGratitudeEntries(entries: GratitudeEntry[]) {
    this.gratitudeEntries = entries;
  }

  setBreathingSessions(sessions: BreathingSession[]) {
    this.breathingSessions = sessions;
  }

  setLastEveningSummary(summary: string | null) {
    this.lastEveningSummary = summary;
  }
}

/**
 * Test-Daten Factory
 */
const createTestDiaryEntry = (date: string, text: string, createdAt: string): DiaryEntry => ({
  id: `diary-${date}`,
  userId: 'test-user',
  date,
  text,
  tags: ['test'],
  createdAt,
  updatedAt: createdAt
});

const createTestGratitudeEntry = (date: string, morning: boolean, text: string, createdAt: string): GratitudeEntry => ({
  id: `gratitude-${date}-${morning ? 'morning' : 'evening'}`,
  userId: 'test-user',
  date,
  morning,
  text,
  createdAt,
  updatedAt: createdAt
});

const createTestBreathingSession = (method: string, durationSec: number, completed: boolean, timestamp: string): BreathingSession => ({
  id: `session-${timestamp}`,
  userId: 'test-user',
  method: method as any,
  durationSec,
  completed,
  timestamp,
  createdAt: timestamp,
  updatedAt: timestamp
});

describe('DataAggregator', () => {
  let provider: MockDataProvider;
  const userId = 'test-user';

  beforeEach(() => {
    provider = new MockDataProvider();
  });

  describe('aggregateEvening', () => {
    it('sollte leere Aggregation für keine Daten zurückgeben', async () => {
      const result = await DataAggregator.aggregateEvening(userId, provider);

      expect(result.hasData).toBe(false);
      expect(result.diaryEntries).toHaveLength(0);
      expect(result.gratitudeEntries).toHaveLength(0);
      expect(result.breathingSessions).toHaveLength(0);
      expect(result.summary).toBe('Keine Aktivitäten in den letzten 24 Stunden');
      expect(result.dataRange.start).toBeDefined();
      expect(result.dataRange.end).toBeDefined();
    });

    it('sollte Diary-Entries korrekt aggregieren', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      const diaryEntries = [
        createTestDiaryEntry('2024-01-01', 'Heute war ein guter Tag', oneHourAgo.toISOString()),
        createTestDiaryEntry('2024-01-02', 'Morgen wird noch besser', now.toISOString())
      ];

      provider.setDiaryEntries(diaryEntries);

      const result = await DataAggregator.aggregateEvening(userId, provider);

      expect(result.hasData).toBe(true);
      expect(result.diaryEntries).toHaveLength(2);
      expect(result.summary).toContain('Journal: 2 Einträge');
    });

    it('sollte Gratitude-Entries korrekt aggregieren', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      const gratitudeEntries = [
        createTestGratitudeEntry('2024-01-01', true, 'Dankbar für Gesundheit', oneHourAgo.toISOString()),
        createTestGratitudeEntry('2024-01-01', false, 'Dankbar für Familie', oneHourAgo.toISOString()),
        createTestGratitudeEntry('2024-01-02', true, 'Dankbar für Sonnenschein', now.toISOString())
      ];

      provider.setGratitudeEntries(gratitudeEntries);

      const result = await DataAggregator.aggregateEvening(userId, provider);

      expect(result.hasData).toBe(true);
      expect(result.gratitudeEntries).toHaveLength(3);
      expect(result.summary).toContain('Dankbarkeit: 2 morgens, 1 abends');
    });

    it('sollte Breathing-Sessions korrekt aggregieren', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      const breathingSessions = [
        createTestBreathingSession('box', 300, true, oneHourAgo.toISOString()),
        createTestBreathingSession('478', 600, true, now.toISOString()),
        createTestBreathingSession('coherent', 180, false, now.toISOString()) // Nicht abgeschlossen
      ];

      provider.setBreathingSessions(breathingSessions);

      const result = await DataAggregator.aggregateEvening(userId, provider);

      expect(result.hasData).toBe(true);
      expect(result.breathingSessions).toHaveLength(2); // Nur abgeschlossene
      expect(result.summary).toContain('Atemübungen: 2 Sessions, 15 Minuten');
    });

    it('sollte lange Texte kürzen', async () => {
      const longText = 'A'.repeat(1000);
      const diaryEntries = [
        createTestDiaryEntry('2024-01-01', longText, new Date().toISOString())
      ];

      provider.setDiaryEntries(diaryEntries);

      const result = await DataAggregator.aggregateEvening(userId, provider);

      expect(result.diaryEntries[0].text.length).toBeLessThanOrEqual(500);
      expect(result.diaryEntries[0].text).toContain('...');
    });

    it('sollte nur die neuesten Einträge behalten', async () => {
      const now = new Date();
      const diaryEntries = Array.from({ length: 10 }, (_, i) => 
        createTestDiaryEntry(`2024-01-${i + 1}`, `Entry ${i}`, now.toISOString())
      );

      provider.setDiaryEntries(diaryEntries);

      const result = await DataAggregator.aggregateEvening(userId, provider);

      expect(result.diaryEntries).toHaveLength(5); // Max 5
    });

    it('sollte Offline-Fallback bei Provider-Fehlern liefern', async () => {
      const errorProvider: DataProvider = {
        getDiaryEntries: () => Promise.reject(new Error('Network error')),
        getGratitudeEntries: () => Promise.reject(new Error('Network error')),
        getBreathingSessions: () => Promise.reject(new Error('Network error')),
        getLastEveningSummary: () => Promise.reject(new Error('Network error'))
      };

      const result = await DataAggregator.aggregateEvening(userId, errorProvider);

      expect(result.hasData).toBe(false);
      expect(result.summary).toBe('Keine Daten verfügbar - Offline-Modus');
    });
  });

  describe('aggregateMorning', () => {
    it('sollte Morning-Aggregation mit generischen Impulsen zurückgeben', async () => {
      const result = await DataAggregator.aggregateMorning(userId, provider);

      expect(result.hasData).toBe(true);
      expect(result.todayGoals).toHaveLength(3);
      expect(result.todayGoals![0]).toMatch(/^[A-Z].*$/); // Sollte mit Großbuchstabe beginnen
      expect(result.dataRange.start).toBeDefined();
      expect(result.dataRange.end).toBeDefined();
    });

    it('sollte letzten Evening Summary einbeziehen', async () => {
      const lastSummary = 'Gestern war produktiv - 3 Atemübungen, 2 Journal-Einträge';
      provider.setLastEveningSummary(lastSummary);

      const result = await DataAggregator.aggregateMorning(userId, provider);

      expect(result.hasData).toBe(true);
      expect(result.lastEveningSummary).toBe(lastSummary);
      expect(result.todayGoals).toHaveLength(3);
    });

    it('sollte Offline-Fallback bei Provider-Fehlern liefern', async () => {
      const errorProvider: DataProvider = {
        getDiaryEntries: () => Promise.reject(new Error('Network error')),
        getGratitudeEntries: () => Promise.reject(new Error('Network error')),
        getBreathingSessions: () => Promise.reject(new Error('Network error')),
        getLastEveningSummary: () => Promise.reject(new Error('Network error'))
      };

      const result = await DataAggregator.aggregateMorning(userId, errorProvider);

      expect(result.hasData).toBe(true);
      expect(result.todayGoals).toHaveLength(5); // Alle generischen Impulse
    });
  });

  describe('formatForAIPrompt', () => {
    it('sollte Evening-Aggregation für AI formatieren', () => {
      const now = new Date();
      const diaryEntries = [
        createTestDiaryEntry('2024-01-01', 'Test Diary', now.toISOString())
      ];
      const gratitudeEntries = [
        createTestGratitudeEntry('2024-01-01', true, 'Test Gratitude', now.toISOString())
      ];
      const breathingSessions = [
        createTestBreathingSession('box', 300, true, now.toISOString())
      ];

      const aggregation: EveningAggregation = {
        diaryEntries,
        gratitudeEntries,
        breathingSessions,
        summary: 'Test Summary',
        hasData: true,
        dataRange: { start: now.toISOString(), end: now.toISOString() }
      };

      const formatted = DataAggregator.formatForAIPrompt(aggregation);

      expect(formatted).toContain('JOURNAL:');
      expect(formatted).toContain('DANKBARKEIT:');
      expect(formatted).toContain('ATEMÜBUNGEN:');
      expect(formatted).toContain('Test Diary');
      expect(formatted).toContain('Test Gratitude');
      expect(formatted).toContain('box - 5 Minuten');
    });

    it('sollte Morning-Aggregation für AI formatieren', () => {
      const aggregation: MorningAggregation = {
        lastEveningSummary: 'Gestern war gut',
        todayGoals: ['Impuls 1', 'Impuls 2'],
        hasData: true,
        dataRange: { start: new Date().toISOString(), end: new Date().toISOString() }
      };

      const formatted = DataAggregator.formatForAIPrompt(aggregation);

      expect(formatted).toContain('GESTERN ABEND: Gestern war gut');
      expect(formatted).toContain('HEUTIGE IMPULSE:');
      expect(formatted).toContain('1. Impuls 1');
      expect(formatted).toContain('2. Impuls 2');
    });

    it('sollte leere Aggregation korrekt formatieren', () => {
      const aggregation: EveningAggregation = {
        diaryEntries: [],
        gratitudeEntries: [],
        breathingSessions: [],
        summary: 'Keine Daten',
        hasData: false,
        dataRange: { start: new Date().toISOString(), end: new Date().toISOString() }
      };

      const formatted = DataAggregator.formatForAIPrompt(aggregation);

      expect(formatted).toBe('');
    });
  });

  describe('validateAggregation', () => {
    it('sollte gültige Evening-Aggregation validieren', () => {
      const now = new Date();
      const aggregation: EveningAggregation = {
        diaryEntries: [],
        gratitudeEntries: [],
        breathingSessions: [],
        summary: 'Test',
        hasData: false,
        dataRange: { start: now.toISOString(), end: new Date(now.getTime() + 1000).toISOString() }
      };

      expect(DataAggregator.validateAggregation(aggregation)).toBe(true);
    });

    it('sollte gültige Morning-Aggregation validieren', () => {
      const now = new Date();
      const aggregation: MorningAggregation = {
        todayGoals: ['Test'],
        hasData: true,
        dataRange: { start: now.toISOString(), end: new Date(now.getTime() + 1000).toISOString() }
      };

      expect(DataAggregator.validateAggregation(aggregation)).toBe(true);
    });

    it('sollte ungültige Datenbereiche ablehnen', () => {
      const now = new Date();
      const aggregation: EveningAggregation = {
        diaryEntries: [],
        gratitudeEntries: [],
        breathingSessions: [],
        summary: 'Test',
        hasData: false,
        dataRange: { start: now.toISOString(), end: now.toISOString() } // Start = End
      };

      expect(DataAggregator.validateAggregation(aggregation)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('sollte mit sehr vielen Einträgen umgehen', async () => {
      const now = new Date();
      const diaryEntries = Array.from({ length: 100 }, (_, i) => 
        createTestDiaryEntry(`2024-01-${i + 1}`, `Entry ${i}`, now.toISOString())
      );

      provider.setDiaryEntries(diaryEntries);

      const result = await DataAggregator.aggregateEvening(userId, provider);

      expect(result.diaryEntries).toHaveLength(5); // Max 5
    });

    it('sollte mit leeren Texten umgehen', async () => {
      const diaryEntries = [
        createTestDiaryEntry('2024-01-01', '', new Date().toISOString())
      ];

      provider.setDiaryEntries(diaryEntries);

      const result = await DataAggregator.aggregateEvening(userId, provider);

      expect(result.diaryEntries).toHaveLength(1);
      expect(result.diaryEntries[0].text).toBe('');
    });

    it('sollte mit verschiedenen Zeitzonen umgehen', async () => {
      const utcTime = new Date().toISOString();
      const localTime = new Date().toLocaleString();

      const diaryEntries = [
        createTestDiaryEntry('2024-01-01', 'Test', utcTime)
      ];

      provider.setDiaryEntries(diaryEntries);

      const result = await DataAggregator.aggregateEvening(userId, provider);

      expect(result.dataRange.start).toBeDefined();
      expect(result.dataRange.end).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('sollte große Datenmengen effizient verarbeiten', async () => {
      const now = new Date();
      const diaryEntries = Array.from({ length: 1000 }, (_, i) => 
        createTestDiaryEntry(`2024-01-${i + 1}`, `Entry ${i}`, now.toISOString())
      );

      provider.setDiaryEntries(diaryEntries);

      const startTime = Date.now();
      const result = await DataAggregator.aggregateEvening(userId, provider);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Sollte unter 100ms sein
      expect(result.diaryEntries).toHaveLength(5);
    });
  });
});
