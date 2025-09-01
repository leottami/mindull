/**
 * AI-Services Demo
 * Zeigt die Integration von PII-Scrubber, DataAggregator und PromptBuilder
 */

import { PIIScrubber } from '../services/ai/scrubber';
import { DataAggregator, type DataProvider } from '../services/ai/aggregate';
import { PromptBuilder } from '../services/ai/prompt.builder';
import { DiaryEntry } from '../models/diary.model';
import { GratitudeEntry } from '../models/gratitude.model';
import { BreathingSession } from '../models/session.model';

/**
 * Demo Data Provider
 */
class DemoDataProvider implements DataProvider {
  async getDiaryEntries(userId: string, startDate: string, endDate: string): Promise<DiaryEntry[]> {
    return [
      {
        id: 'diary-1',
        userId,
        date: '2024-01-01',
        text: 'Heute war ein produktiver Tag. Ich habe mit Anna Müller und Hans Schmidt an einem wichtigen Projekt gearbeitet. Wir haben uns in der Musterstraße 123 in Hamburg getroffen.',
        tags: ['arbeit', 'projekt'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
  }

  async getGratitudeEntries(userId: string, startDate: string, endDate: string): Promise<GratitudeEntry[]> {
    return [
      {
        id: 'gratitude-1',
        userId,
        date: '2024-01-01',
        morning: true,
        text: 'Dankbar für meine Gesundheit und die Unterstützung von meiner Familie',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
  }

  async getBreathingSessions(userId: string, startDate: string, endDate: string): Promise<BreathingSession[]> {
    return [
      {
        id: 'session-1',
        userId,
        method: 'box',
        durationSec: 300,
        completed: true,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
  }

  async getLastEveningSummary(userId: string): Promise<string | null> {
    return 'Gestern war produktiv - 3 Atemübungen, 2 Journal-Einträge, viel Dankbarkeit';
  }
}

/**
 * Demo: Vollständiger AI-Workflow
 */
async function demoAIWorkflow() {
  console.log('🤖 AI-Services Demo - Vollständiger Workflow\n');

  const userId = 'demo-user';
  const provider = new DemoDataProvider();

  // 1. Daten aggregieren
  console.log('📊 1. Daten aggregieren...');
  const eveningAggregation = await DataAggregator.aggregateEvening(userId, provider);
  const morningAggregation = await DataAggregator.aggregateMorning(userId, provider);

  console.log('Evening Aggregation:', {
    hasData: eveningAggregation.hasData,
    diaryCount: eveningAggregation.diaryEntries.length,
    gratitudeCount: eveningAggregation.gratitudeEntries.length,
    breathingCount: eveningAggregation.breathingSessions.length,
    summary: eveningAggregation.summary
  });

  // 2. PII-Scrubbing
  console.log('\n🔒 2. PII-Scrubbing...');
  const diaryText = eveningAggregation.diaryEntries[0]?.text || '';
  const scrubbedResult = PIIScrubber.scrub(diaryText);
  
  console.log('Original Text:', diaryText);
  console.log('Scrubbed Text:', scrubbedResult.scrubbedText);
  console.log('PII Map:', Object.fromEntries(scrubbedResult.originalMap));

  // 3. Prompts erstellen
  console.log('\n📝 3. Prompts erstellen...');
  const eveningPrompt = PromptBuilder.buildEveningPrompt(eveningAggregation);
  const morningPrompt = PromptBuilder.buildMorningPrompt(morningAggregation);

  console.log('Evening Prompt Tokens:', eveningPrompt.estimatedTokens);
  console.log('Morning Prompt Tokens:', morningPrompt.estimatedTokens);
  console.log('Evening System Prompt:', eveningPrompt.systemPrompt.substring(0, 100) + '...');
  console.log('Evening User Prompt:', eveningPrompt.userPrompt.substring(0, 100) + '...');

  // 4. Token-Budget-Optimierung
  console.log('\n⚡ 4. Token-Budget-Optimierung...');
  const optimizedPrompt = PromptBuilder.optimizeForTokenBudget(eveningPrompt);
  console.log('Optimized Tokens:', optimizedPrompt.estimatedTokens);

  // 5. Fallback-Prompts
  console.log('\n🔄 5. Fallback-Prompts...');
  const fallbackEvening = PromptBuilder.buildFallbackPrompt('evening', 'de');
  const fallbackMorning = PromptBuilder.buildFallbackPrompt('morning', 'en');
  
  console.log('German Fallback Evening:', fallbackEvening.estimatedTokens, 'tokens');
  console.log('English Fallback Morning:', fallbackMorning.estimatedTokens, 'tokens');

  // 6. Random Empfehlungen
  console.log('\n🎲 6. Random Empfehlungen...');
  const breathingRec = PromptBuilder.getRandomBreathingRecommendation('de');
  const morningImpulses = PromptBuilder.getRandomMorningImpulses('de', 3);
  
  console.log('Breathing Recommendation:', breathingRec);
  console.log('Morning Impulses:', morningImpulses);

  console.log('\n✅ Demo abgeschlossen!');
}

/**
 * Demo: PII-Scrubbing Details
 */
function demoPIIScrubbing() {
  console.log('🔒 PII-Scrubbing Demo\n');

  const testTexts = [
    'Ich habe mit Anna Müller (anna.mueller@email.de) gesprochen. Sie wohnt in der Hauptstraße 5 in Hamburg. Tel: +49 30 12345678',
    'Gestern traf ich Fräulein Schröder und Herrn Böhm.',
    'Kontaktiere mich unter +49 89 98765432 oder test@example.com'
  ];

  testTexts.forEach((text, index) => {
    console.log(`Test ${index + 1}:`);
    console.log('Original:', text);
    
    const result = PIIScrubber.scrub(text);
    console.log('Scrubbed:', result.scrubbedText);
    console.log('PII Count:', PIIScrubber.countPII(text));
    console.log('Contains PII:', PIIScrubber.containsPII(text));
    console.log('---');
  });
}

/**
 * Demo: Prompt-Builder Features
 */
function demoPromptBuilder() {
  console.log('📝 Prompt-Builder Demo\n');

  // Evening Prompt mit verschiedenen Sprachen
  const eveningAggregation = {
    diaryEntries: [],
    gratitudeEntries: [],
    breathingSessions: [],
    summary: 'Test',
    hasData: false,
    dataRange: { start: new Date().toISOString(), end: new Date().toISOString() }
  };

  const germanPrompt = PromptBuilder.buildEveningPrompt(eveningAggregation, { language: 'de' });
  const englishPrompt = PromptBuilder.buildEveningPrompt(eveningAggregation, { language: 'en' });

  console.log('German Evening Prompt:');
  console.log('System:', germanPrompt.systemPrompt.substring(0, 150) + '...');
  console.log('User:', germanPrompt.userPrompt.substring(0, 100) + '...');
  console.log('Tokens:', germanPrompt.estimatedTokens);
  console.log('---');

  console.log('English Evening Prompt:');
  console.log('System:', englishPrompt.systemPrompt.substring(0, 150) + '...');
  console.log('User:', englishPrompt.userPrompt.substring(0, 100) + '...');
  console.log('Tokens:', englishPrompt.estimatedTokens);
}

// Demo ausführen
if (require.main === module) {
  console.log('🚀 Starting AI-Services Demo...\n');
  
  demoPIIScrubbing();
  demoPromptBuilder();
  demoAIWorkflow().catch(console.error);
}

export { demoAIWorkflow, demoPIIScrubbing, demoPromptBuilder };
