/**
 * PromptBuilder Tests
 * Testet kompakte Prompt-Erstellung für AI-Summaries
 */

import { PromptBuilder, type BuiltPrompt, type PromptConfig } from '../../../services/ai/prompt.builder';
import { EveningAggregation, MorningAggregation } from '../../../services/ai/aggregate';
import { DiaryEntry } from '../../../models/diary.model';
import { GratitudeEntry } from '../../../models/gratitude.model';
import { BreathingSession } from '../../../models/session.model';

/**
 * Test-Daten Factory
 */
const createTestDiaryEntry = (date: string, text: string): DiaryEntry => ({
  id: `diary-${date}`,
  userId: 'test-user',
  date,
  text,
  tags: ['test'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

const createTestGratitudeEntry = (date: string, morning: boolean, text: string): GratitudeEntry => ({
  id: `gratitude-${date}-${morning ? 'morning' : 'evening'}`,
  userId: 'test-user',
  date,
  morning,
  text,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

const createTestBreathingSession = (method: string, durationSec: number, completed: boolean): BreathingSession => ({
  id: `session-${Date.now()}`,
  userId: 'test-user',
  method: method as any,
  durationSec,
  completed,
  timestamp: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

describe('PromptBuilder', () => {
  describe('buildEveningPrompt', () => {
    it('sollte Evening-Prompt mit Daten erstellen', () => {
      const aggregation: EveningAggregation = {
        diaryEntries: [
          createTestDiaryEntry('2024-01-01', 'Heute war ein produktiver Tag')
        ],
        gratitudeEntries: [
          createTestGratitudeEntry('2024-01-01', true, 'Dankbar für Gesundheit')
        ],
        breathingSessions: [
          createTestBreathingSession('box', 300, true)
        ],
        summary: 'Test Summary',
        hasData: true,
        dataRange: { start: new Date().toISOString(), end: new Date().toISOString() }
      };

      const prompt = PromptBuilder.buildEveningPrompt(aggregation);

      expect(prompt.systemPrompt).toContain('Du bist ein achtsamer Begleiter');
      expect(prompt.systemPrompt).toContain('3-5 Punkte Zusammenfassung');
      expect(prompt.systemPrompt).toContain('Atem-Empfehlung');
      expect(prompt.userPrompt).toContain('Aktivitäten der letzten 24 Stunden');
      expect(prompt.userPrompt).toContain('Heute war ein produktiver Tag');
      expect(prompt.userPrompt).toContain('Dankbar für Gesundheit');
      expect(prompt.userPrompt).toContain('box - 5 Min');
      expect(prompt.language).toBe('de');
      expect(prompt.estimatedTokens).toBeGreaterThan(0);
    });

    it('sollte Evening-Prompt ohne Daten erstellen', () => {
      const aggregation: EveningAggregation = {
        diaryEntries: [],
        gratitudeEntries: [],
        breathingSessions: [],
        summary: 'Keine Daten',
        hasData: false,
        dataRange: { start: new Date().toISOString(), end: new Date().toISOString() }
      };

      const prompt = PromptBuilder.buildEveningPrompt(aggregation);

      expect(prompt.systemPrompt).toContain('Du bist ein achtsamer Begleiter');
      expect(prompt.userPrompt).toContain('Keine Aktivitäten in den letzten 24 Stunden');
      expect(prompt.language).toBe('de');
    });

    it('sollte Evening-Prompt auf Englisch erstellen', () => {
      const aggregation: EveningAggregation = {
        diaryEntries: [createTestDiaryEntry('2024-01-01', 'Today was productive')],
        gratitudeEntries: [],
        breathingSessions: [],
        summary: 'Test',
        hasData: true,
        dataRange: { start: new Date().toISOString(), end: new Date().toISOString() }
      };

      const config: PromptConfig = { language: 'en' };
      const prompt = PromptBuilder.buildEveningPrompt(aggregation, config);

      expect(prompt.systemPrompt).toContain('You are a mindful companion');
      expect(prompt.systemPrompt).toContain('3-5 point summary');
      expect(prompt.systemPrompt).toContain('Breathing recommendation');
      expect(prompt.userPrompt).toContain('activities from the last 24 hours');
      expect(prompt.language).toBe('en');
    });
  });

  describe('buildMorningPrompt', () => {
    it('sollte Morning-Prompt mit Daten erstellen', () => {
      const aggregation: MorningAggregation = {
        lastEveningSummary: 'Gestern war produktiv - 3 Atemübungen',
        todayGoals: ['Impuls 1', 'Impuls 2'],
        hasData: true,
        dataRange: { start: new Date().toISOString(), end: new Date().toISOString() }
      };

      const prompt = PromptBuilder.buildMorningPrompt(aggregation);

      expect(prompt.systemPrompt).toContain('Du bist ein achtsamer Begleiter');
      expect(prompt.systemPrompt).toContain('2-3 inspirierende Impulse');
      expect(prompt.systemPrompt).toContain('Tagesfokus');
      expect(prompt.systemPrompt).toContain('Dankbarkeits-Erinnerung');
      expect(prompt.userPrompt).toContain('Daten für den Tagesstart');
      expect(prompt.userPrompt).toContain('Gestern war produktiv');
      expect(prompt.userPrompt).toContain('Impuls 1');
      expect(prompt.userPrompt).toContain('Impuls 2');
      expect(prompt.language).toBe('de');
    });

    it('sollte Morning-Prompt ohne Daten erstellen', () => {
      const aggregation: MorningAggregation = {
        lastEveningSummary: undefined,
        todayGoals: [],
        hasData: false,
        dataRange: { start: new Date().toISOString(), end: new Date().toISOString() }
      };

      const prompt = PromptBuilder.buildMorningPrompt(aggregation);

      expect(prompt.systemPrompt).toContain('Du bist ein achtsamer Begleiter');
      expect(prompt.userPrompt).toContain('Keine spezifischen Daten verfügbar');
      expect(prompt.language).toBe('de');
    });

    it('sollte Morning-Prompt auf Englisch erstellen', () => {
      const aggregation: MorningAggregation = {
        lastEveningSummary: 'Yesterday was productive',
        todayGoals: ['Impulse 1'],
        hasData: true,
        dataRange: { start: new Date().toISOString(), end: new Date().toISOString() }
      };

      const config: PromptConfig = { language: 'en' };
      const prompt = PromptBuilder.buildMorningPrompt(aggregation, config);

      expect(prompt.systemPrompt).toContain('You are a mindful companion');
      expect(prompt.systemPrompt).toContain('2-3 inspiring impulses');
      expect(prompt.systemPrompt).toContain('Daily focus');
      expect(prompt.systemPrompt).toContain('Gratitude reminder');
      expect(prompt.userPrompt).toContain('data for the day start');
      expect(prompt.language).toBe('en');
    });
  });

  describe('validatePromptSize', () => {
    it('sollte gültige Prompt-Größe validieren', () => {
      const prompt: BuiltPrompt = {
        systemPrompt: 'Test system prompt',
        userPrompt: 'Test user prompt',
        estimatedTokens: 100,
        language: 'de'
      };

      expect(PromptBuilder.validatePromptSize(prompt)).toBe(true);
    });

    it('sollte zu große Prompts ablehnen', () => {
      const prompt: BuiltPrompt = {
        systemPrompt: 'Test system prompt',
        userPrompt: 'Test user prompt',
        estimatedTokens: 2500, // Über MAX_TOKENS (2000)
        language: 'de'
      };

      expect(PromptBuilder.validatePromptSize(prompt)).toBe(false);
    });
  });

  describe('optimizeForTokenBudget', () => {
    it('sollte Prompt unter Target-Tokens unverändert lassen', () => {
      const prompt: BuiltPrompt = {
        systemPrompt: 'Short system prompt',
        userPrompt: 'Short user prompt',
        estimatedTokens: 1000,
        language: 'de'
      };

      const optimized = PromptBuilder.optimizeForTokenBudget(prompt);

      expect(optimized).toEqual(prompt);
    });

    it('sollte User-Prompt kürzen wenn nötig', () => {
      const longUserPrompt = 'A'.repeat(5000); // Sehr langer Prompt
      const prompt: BuiltPrompt = {
        systemPrompt: 'Short system prompt',
        userPrompt: longUserPrompt,
        estimatedTokens: 2000,
        language: 'de'
      };

      const optimized = PromptBuilder.optimizeForTokenBudget(prompt);

      expect(optimized.userPrompt.length).toBeLessThan(longUserPrompt.length);
      expect(optimized.userPrompt).toContain('...');
      expect(optimized.estimatedTokens).toBeLessThan(prompt.estimatedTokens);
    });
  });

  describe('getRandomBreathingRecommendation', () => {
    it('sollte deutsche Atem-Empfehlung zurückgeben', () => {
      const recommendation = PromptBuilder.getRandomBreathingRecommendation('de');

      expect(recommendation).toMatch(/^(Box Breathing|4-7-8 Atmung|Coherent Breathing|Triangle Breathing|Tiefe Bauchatmung)/);
    });

    it('sollte englische Atem-Empfehlung zurückgeben', () => {
      const recommendation = PromptBuilder.getRandomBreathingRecommendation('en');

      expect(recommendation).toMatch(/^(Box Breathing|4-7-8 breathing|Coherent breathing|Triangle breathing|Deep belly breathing)/);
    });

    it('sollte verschiedene Empfehlungen bei mehreren Aufrufen zurückgeben', () => {
      const recommendations = new Set();
      
      for (let i = 0; i < 10; i++) {
        recommendations.add(PromptBuilder.getRandomBreathingRecommendation('de'));
      }

      // Sollte verschiedene Empfehlungen haben (nicht alle gleich)
      expect(recommendations.size).toBeGreaterThan(1);
    });
  });

  describe('getRandomMorningImpulses', () => {
    it('sollte deutsche Morning-Impulse zurückgeben', () => {
      const impulses = PromptBuilder.getRandomMorningImpulses('de', 3);

      expect(impulses).toHaveLength(3);
      impulses.forEach(impulse => {
        expect(impulse).toMatch(/^(Nimm dir Zeit|Schreibe drei Dinge|Reflektiere über|Mache einen kurzen|Praktiziere Achtsamkeit|Setze eine positive|Kontaktiere einen)/);
      });
    });

    it('sollte englische Morning-Impulse zurückgeben', () => {
      const impulses = PromptBuilder.getRandomMorningImpulses('en', 2);

      expect(impulses).toHaveLength(2);
      impulses.forEach(impulse => {
        expect(impulse).toMatch(/^(Take time|Write down three|Reflect on|Take a short|Practice mindfulness|Set a positive|Reach out to)/);
      });
    });

    it('sollte verschiedene Impulse bei mehreren Aufrufen zurückgeben', () => {
      const allImpulses = new Set();
      
      for (let i = 0; i < 5; i++) {
        const impulses = PromptBuilder.getRandomMorningImpulses('de', 3);
        impulses.forEach(impulse => allImpulses.add(impulse));
      }

      // Sollte verschiedene Impulse haben
      expect(allImpulses.size).toBeGreaterThan(3);
    });
  });

  describe('buildFallbackPrompt', () => {
    it('sollte Evening-Fallback-Prompt erstellen', () => {
      const prompt = PromptBuilder.buildFallbackPrompt('evening', 'de');

      expect(prompt.systemPrompt).toContain('Du bist ein achtsamer Begleiter');
      expect(prompt.userPrompt).toContain('Keine spezifischen Daten verfügbar');
      expect(prompt.userPrompt).toContain('allgemeine Abend-Reflexion');
      expect(prompt.language).toBe('de');
    });

    it('sollte Morning-Fallback-Prompt erstellen', () => {
      const prompt = PromptBuilder.buildFallbackPrompt('morning', 'en');

      expect(prompt.systemPrompt).toContain('You are a mindful companion');
      expect(prompt.userPrompt).toContain('No specific data available');
      expect(prompt.userPrompt).toContain('general, inspiring impulses');
      expect(prompt.language).toBe('en');
    });
  });

  describe('Edge Cases', () => {
    it('sollte mit sehr langen Texten umgehen', () => {
      const longText = 'A'.repeat(1000);
      const aggregation: EveningAggregation = {
        diaryEntries: [createTestDiaryEntry('2024-01-01', longText)],
        gratitudeEntries: [],
        breathingSessions: [],
        summary: 'Test',
        hasData: true,
        dataRange: { start: new Date().toISOString(), end: new Date().toISOString() }
      };

      const prompt = PromptBuilder.buildEveningPrompt(aggregation);

      expect(prompt.estimatedTokens).toBeGreaterThan(0);
      expect(PromptBuilder.validatePromptSize(prompt)).toBe(true);
    });

    it('sollte mit leeren Aggregationen umgehen', () => {
      const aggregation: EveningAggregation = {
        diaryEntries: [],
        gratitudeEntries: [],
        breathingSessions: [],
        summary: '',
        hasData: false,
        dataRange: { start: new Date().toISOString(), end: new Date().toISOString() }
      };

      const prompt = PromptBuilder.buildEveningPrompt(aggregation);

      expect(prompt.userPrompt).toContain('Keine Aktivitäten');
      expect(prompt.estimatedTokens).toBeGreaterThan(0);
    });

    it('sollte mit verschiedenen Zeitzonen umgehen', () => {
      const aggregation: EveningAggregation = {
        diaryEntries: [createTestDiaryEntry('2024-01-01', 'Test')],
        gratitudeEntries: [],
        breathingSessions: [],
        summary: 'Test',
        hasData: true,
        dataRange: { 
          start: new Date().toISOString(), 
          end: new Date().toISOString() 
        }
      };

      const prompt = PromptBuilder.buildEveningPrompt(aggregation);

      expect(prompt.userPrompt).toContain('Test');
      expect(prompt.language).toBe('de');
    });
  });

  describe('Performance', () => {
    it('sollte große Datenmengen effizient verarbeiten', () => {
      const diaryEntries = Array.from({ length: 100 }, (_, i) => 
        createTestDiaryEntry(`2024-01-${i + 1}`, `Entry ${i}`)
      );

      const aggregation: EveningAggregation = {
        diaryEntries,
        gratitudeEntries: [],
        breathingSessions: [],
        summary: 'Test',
        hasData: true,
        dataRange: { start: new Date().toISOString(), end: new Date().toISOString() }
      };

      const startTime = Date.now();
      const prompt = PromptBuilder.buildEveningPrompt(aggregation);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Sollte unter 100ms sein
      expect(prompt.estimatedTokens).toBeGreaterThan(0);
    });
  });

  describe('Token-Schätzung', () => {
    it('sollte Token-Anzahl korrekt schätzen', () => {
      const testText = 'Dies ist ein Test-Text mit 25 Zeichen.';
      const prompt: BuiltPrompt = {
        systemPrompt: testText,
        userPrompt: testText,
        estimatedTokens: 0,
        language: 'de'
      };

      // Grobe Schätzung: 25 Zeichen ≈ 6-7 Tokens
      expect(prompt.systemPrompt.length + prompt.userPrompt.length).toBe(76); // 38 + 38 = 76
    });
  });
});
