/**
 * Prompt-Builder für AI-Summaries
 * Erstellt kompakte, achtsame Prompts für Evening/Morning AI-Verarbeitung
 */

import { EveningAggregation, MorningAggregation } from './aggregate';

/**
 * Prompt-Typen
 */
export type PromptType = 'evening' | 'morning';
export type Language = 'de' | 'en';

/**
 * Prompt-Konfiguration
 */
export interface PromptConfig {
  language: Language;
  maxTokens?: number;
  tone?: 'mindful' | 'positive' | 'neutral';
}

/**
 * Erstellte Prompts
 */
export interface BuiltPrompt {
  systemPrompt: string;
  userPrompt: string;
  estimatedTokens: number;
  language: Language;
}

/**
 * Atem-Empfehlungen für Evening
 */
const BREATHING_RECOMMENDATIONS = {
  de: [
    'Box Breathing (4-4-4-4) für Entspannung',
    '4-7-8 Atmung für besseren Schlaf',
    'Coherent Breathing (5-5) für Balance',
    'Triangle Breathing für Fokus',
    'Tiefe Bauchatmung für Stressabbau'
  ],
  en: [
    'Box Breathing (4-4-4-4) for relaxation',
    '4-7-8 breathing for better sleep',
    'Coherent breathing (5-5) for balance',
    'Triangle breathing for focus',
    'Deep belly breathing for stress relief'
  ]
};

/**
 * Generische Impulse für Morning
 */
const MORNING_IMPULSES = {
  de: [
    'Nimm dir Zeit für eine bewusste Atemübung',
    'Schreibe drei Dinge auf, für die du dankbar bist',
    'Reflektiere über deine Ziele für diese Woche',
    'Mache einen kurzen Spaziergang in der Natur',
    'Praktiziere Achtsamkeit bei deiner ersten Mahlzeit',
    'Setze eine positive Intention für den Tag',
    'Kontaktiere einen lieben Menschen'
  ],
  en: [
    'Take time for a mindful breathing exercise',
    'Write down three things you are grateful for',
    'Reflect on your goals for this week',
    'Take a short walk in nature',
    'Practice mindfulness during your first meal',
    'Set a positive intention for the day',
    'Reach out to a loved one'
  ]
};

/**
 * Prompt-Builder Klasse
 */
export class PromptBuilder {
  private static readonly MAX_TOKENS = 2000;
  private static readonly TARGET_TOKENS = 1500;
  private static readonly SYSTEM_PROMPT_TOKENS = 300;

  /**
   * Erstellt Evening Summary Prompt
   */
  static buildEveningPrompt(
    aggregation: EveningAggregation,
    config: PromptConfig = { language: 'de' }
  ): BuiltPrompt {
    const { language } = config;
    
    const systemPrompt = this.buildEveningSystemPrompt(language);
    const userPrompt = this.buildEveningUserPrompt(aggregation, language);
    
    const estimatedTokens = this.estimateTokens(systemPrompt + userPrompt);
    
    return {
      systemPrompt,
      userPrompt,
      estimatedTokens,
      language
    };
  }

  /**
   * Erstellt Morning Focus Prompt
   */
  static buildMorningPrompt(
    aggregation: MorningAggregation,
    config: PromptConfig = { language: 'de' }
  ): BuiltPrompt {
    const { language } = config;
    
    const systemPrompt = this.buildMorningSystemPrompt(language);
    const userPrompt = this.buildMorningUserPrompt(aggregation, language);
    
    const estimatedTokens = this.estimateTokens(systemPrompt + userPrompt);
    
    return {
      systemPrompt,
      userPrompt,
      estimatedTokens,
      language
    };
  }

  /**
   * Evening System Prompt
   */
  private static buildEveningSystemPrompt(language: Language): string {
    if (language === 'de') {
      return `Du bist ein achtsamer Begleiter für die Abend-Reflexion. 

Erstelle eine 3-5 Punkte Zusammenfassung der letzten 24 Stunden basierend auf:
- Journal-Einträgen
- Dankbarkeits-Notizen  
- Atemübungen

Ton: Positiv, unterstützend, ohne Diagnosen. Fokus auf Wachstum und Bewusstsein.

Füge eine passende Atem-Empfehlung für den Abend hinzu.

Format:
• Punkt 1
• Punkt 2  
• Punkt 3
• Punkt 4 (optional)
• Punkt 5 (optional)

💨 Atem-Empfehlung: [Empfehlung]`;
    } else {
      return `You are a mindful companion for evening reflection.

Create a 3-5 point summary of the last 24 hours based on:
- Journal entries
- Gratitude notes
- Breathing exercises

Tone: Positive, supportive, no diagnoses. Focus on growth and awareness.

Add a suitable breathing recommendation for the evening.

Format:
• Point 1
• Point 2
• Point 3
• Point 4 (optional)
• Point 5 (optional)

💨 Breathing recommendation: [recommendation]`;
    }
  }

  /**
   * Morning System Prompt
   */
  private static buildMorningSystemPrompt(language: Language): string {
    if (language === 'de') {
      return `Du bist ein achtsamer Begleiter für den Tagesstart.

Erstelle 2-3 inspirierende Impulse für den Tag basierend auf:
- Gestern Abend (falls verfügbar)
- Generischen Achtsamkeits-Praktiken

Ton: Ermutigend, positiv, ohne Druck. Fokus auf kleine, machbare Schritte.

Format:
🌅 Tagesfokus:
• Impuls 1
• Impuls 2
• Impuls 3 (optional)

💝 Dankbarkeits-Erinnerung: [kurze Erinnerung]`;
    } else {
      return `You are a mindful companion for morning focus.

Create 2-3 inspiring impulses for the day based on:
- Yesterday evening (if available)
- General mindfulness practices

Tone: Encouraging, positive, no pressure. Focus on small, achievable steps.

Format:
🌅 Daily focus:
• Impulse 1
• Impulse 2
• Impulse 3 (optional)

💝 Gratitude reminder: [short reminder]`;
    }
  }

  /**
   * Evening User Prompt
   */
  private static buildEveningUserPrompt(aggregation: EveningAggregation, language: Language): string {
    const dataText = this.formatAggregationForPrompt(aggregation, language);
    
    if (language === 'de') {
      return `Hier sind deine Aktivitäten der letzten 24 Stunden:

${dataText}

Erstelle eine achtsame Abend-Zusammenfassung mit 3-5 Punkten und einer passenden Atem-Empfehlung.`;
    } else {
      return `Here are your activities from the last 24 hours:

${dataText}

Create a mindful evening summary with 3-5 points and a suitable breathing recommendation.`;
    }
  }

  /**
   * Morning User Prompt
   */
  private static buildMorningUserPrompt(aggregation: MorningAggregation, language: Language): string {
    const dataText = this.formatMorningDataForPrompt(aggregation, language);
    
    if (language === 'de') {
      return `Hier sind deine Daten für den Tagesstart:

${dataText}

Erstelle 2-3 inspirierende Impulse für heute und eine Dankbarkeits-Erinnerung.`;
    } else {
      return `Here is your data for the day start:

${dataText}

Create 2-3 inspiring impulses for today and a gratitude reminder.`;
    }
  }

  /**
   * Formatiert Evening-Aggregation für Prompt
   */
  private static formatAggregationForPrompt(aggregation: EveningAggregation, language: Language): string {
    const parts: string[] = [];

    if (aggregation.diaryEntries.length > 0) {
      const diaryText = aggregation.diaryEntries
        .map(entry => `${entry.date}: ${entry.text}`)
        .join('\n');
      parts.push(language === 'de' ? `JOURNAL:\n${diaryText}` : `JOURNAL:\n${diaryText}`);
    }

    if (aggregation.gratitudeEntries.length > 0) {
      const gratitudeText = aggregation.gratitudeEntries
        .map(entry => `${entry.date} ${entry.morning ? '(morgens)' : '(abends)'}: ${entry.text}`)
        .join('\n');
      parts.push(language === 'de' ? `DANKBARKEIT:\n${gratitudeText}` : `GRATITUDE:\n${gratitudeText}`);
    }

    if (aggregation.breathingSessions.length > 0) {
      const breathingText = aggregation.breathingSessions
        .map(session => `${session.method} - ${Math.round(session.durationSec / 60)} Min`)
        .join('\n');
      parts.push(language === 'de' ? `ATEMÜBUNGEN:\n${breathingText}` : `BREATHING:\n${breathingText}`);
    }

    if (parts.length === 0) {
      return language === 'de' 
        ? 'Keine Aktivitäten in den letzten 24 Stunden.'
        : 'No activities in the last 24 hours.';
    }

    return parts.join('\n\n');
  }

  /**
   * Formatiert Morning-Aggregation für Prompt
   */
  private static formatMorningDataForPrompt(aggregation: MorningAggregation, language: Language): string {
    const parts: string[] = [];

    if (aggregation.lastEveningSummary) {
      parts.push(language === 'de' 
        ? `GESTERN ABEND:\n${aggregation.lastEveningSummary}`
        : `YESTERDAY EVENING:\n${aggregation.lastEveningSummary}`
      );
    }

    if (aggregation.todayGoals && aggregation.todayGoals.length > 0) {
      const goalsText = aggregation.todayGoals
        .map((goal, index) => `${index + 1}. ${goal}`)
        .join('\n');
      parts.push(language === 'de' 
        ? `HEUTIGE IMPULSE:\n${goalsText}`
        : `TODAY'S IMPULSES:\n${goalsText}`
      );
    }

    if (parts.length === 0) {
      return language === 'de'
        ? 'Keine spezifischen Daten verfügbar.'
        : 'No specific data available.';
    }

    return parts.join('\n\n');
  }

  /**
   * Schätzt Token-Anzahl (grobe Schätzung: 1 Token ≈ 4 Zeichen)
   */
  private static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Validiert Prompt-Größe
   */
  static validatePromptSize(prompt: BuiltPrompt): boolean {
    return prompt.estimatedTokens <= this.MAX_TOKENS;
  }

  /**
   * Optimiert Prompt für Token-Budget
   */
  static optimizeForTokenBudget(prompt: BuiltPrompt): BuiltPrompt {
    if (prompt.estimatedTokens <= this.TARGET_TOKENS) {
      return prompt;
    }

    // Kürze User-Prompt wenn nötig
    const maxUserTokens = this.TARGET_TOKENS - this.SYSTEM_PROMPT_TOKENS;
    const currentUserTokens = this.estimateTokens(prompt.userPrompt);
    
    if (currentUserTokens > maxUserTokens) {
      const maxUserChars = maxUserTokens * 4;
      const shortenedUserPrompt = prompt.userPrompt.substring(0, maxUserChars) + '...';
      
      return {
        ...prompt,
        userPrompt: shortenedUserPrompt,
        estimatedTokens: this.estimateTokens(prompt.systemPrompt + shortenedUserPrompt)
      };
    }

    return prompt;
  }

  /**
   * Holt zufällige Atem-Empfehlung
   */
  static getRandomBreathingRecommendation(language: Language): string {
    const recommendations = BREATHING_RECOMMENDATIONS[language];
    const randomIndex = Math.floor(Math.random() * recommendations.length);
    return recommendations[randomIndex];
  }

  /**
   * Holt zufällige Morning-Impulse
   */
  static getRandomMorningImpulses(language: Language, count: number = 3): string[] {
    const impulses = MORNING_IMPULSES[language];
    const shuffled = [...impulses].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  /**
   * Erstellt kompakten Fallback-Prompt
   */
  static buildFallbackPrompt(type: PromptType, language: Language): BuiltPrompt {
    if (type === 'evening') {
      const systemPrompt = this.buildEveningSystemPrompt(language);
      const userPrompt = language === 'de' 
        ? 'Keine spezifischen Daten verfügbar. Erstelle eine allgemeine Abend-Reflexion mit 3-5 Punkten und einer Atem-Empfehlung.'
        : 'No specific data available. Create a general evening reflection with 3-5 points and a breathing recommendation.';
      
      return {
        systemPrompt,
        userPrompt,
        estimatedTokens: this.estimateTokens(systemPrompt + userPrompt),
        language
      };
    } else {
      const systemPrompt = this.buildMorningSystemPrompt(language);
      const userPrompt = language === 'de'
        ? 'Keine spezifischen Daten verfügbar. Erstelle 2-3 allgemeine, inspirierende Impulse für den Tag.'
        : 'No specific data available. Create 2-3 general, inspiring impulses for the day.';
      
      return {
        systemPrompt,
        userPrompt,
        estimatedTokens: this.estimateTokens(systemPrompt + userPrompt),
        language
      };
    }
  }
}
