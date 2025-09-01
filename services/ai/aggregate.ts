/**
 * Daten-Aggregator für AI-Summaries
 * Sammelt und strukturiert Daten für Evening/Morning AI-Verarbeitung
 */

import { DiaryEntry } from '../../models/diary.model';
import { GratitudeEntry } from '../../models/gratitude.model';
import { BreathingSession } from '../../models/session.model';

/**
 * Aggregierte Daten für Evening Summary
 */
export interface EveningAggregation {
  diaryEntries: DiaryEntry[];
  gratitudeEntries: GratitudeEntry[];
  breathingSessions: BreathingSession[];
  summary: string;
  hasData: boolean;
  dataRange: {
    start: string; // ISO timestamp
    end: string;   // ISO timestamp
  };
}

/**
 * Aggregierte Daten für Morning Focus
 */
export interface MorningAggregation {
  lastEveningSummary?: string;
  todayGoals?: string[];
  hasData: boolean;
  dataRange: {
    start: string; // ISO timestamp
    end: string;   // ISO timestamp
  };
}

/**
 * Daten-Provider Interface für Offline-Unterstützung
 */
export interface DataProvider {
  getDiaryEntries(userId: string, startDate: string, endDate: string): Promise<DiaryEntry[]>;
  getGratitudeEntries(userId: string, startDate: string, endDate: string): Promise<GratitudeEntry[]>;
  getBreathingSessions(userId: string, startDate: string, endDate: string): Promise<BreathingSession[]>;
  getLastEveningSummary(userId: string): Promise<string | null>;
}

/**
 * Generische Impulse für leere Morning-Daten
 */
const GENERIC_MORNING_IMPULSES = [
  'Nimm dir heute Zeit für eine bewusste Atemübung',
  'Schreibe drei Dinge auf, für die du dankbar bist',
  'Reflektiere über deine Ziele für diese Woche',
  'Mache einen kurzen Spaziergang in der Natur',
  'Praktiziere Achtsamkeit bei deiner ersten Mahlzeit'
];

/**
 * Daten-Aggregator Klasse
 */
export class DataAggregator {
  private static readonly EVENING_HOURS = 24; // Letzte 24 Stunden
  private static readonly MORNING_HOURS = 12; // Letzte 12 Stunden (seit Mitternacht)
  private static readonly MAX_DIARY_LENGTH = 497; // Max Zeichen pro Diary-Entry (497 + "...")
  private static readonly MAX_GRATITUDE_LENGTH = 197; // Max Zeichen pro Gratitude-Entry (197 + "...")

  /**
   * Aggregiert Daten für Evening Summary (letzte 24 Stunden)
   */
  static async aggregateEvening(
    userId: string, 
    provider: DataProvider,
    timestamp: string = new Date().toISOString()
  ): Promise<EveningAggregation> {
    const endTime = new Date(timestamp);
    const startTime = new Date(endTime.getTime() - (this.EVENING_HOURS * 60 * 60 * 1000));
    
    const startDate = startTime.toISOString();
    const endDate = endTime.toISOString();

    try {
      // Parallele Datenabfrage für Performance
      const [diaryEntries, gratitudeEntries, breathingSessions] = await Promise.all([
        provider.getDiaryEntries(userId, startDate, endDate),
        provider.getGratitudeEntries(userId, startDate, endDate),
        provider.getBreathingSessions(userId, startDate, endDate)
      ]);

      // Daten trimmen und kürzen
      const trimmedDiary = this.trimDiaryEntries(diaryEntries);
      const trimmedGratitude = this.trimGratitudeEntries(gratitudeEntries);
      const filteredSessions = this.filterCompletedSessions(breathingSessions);

      const hasData = trimmedDiary.length > 0 || 
                     trimmedGratitude.length > 0 || 
                     filteredSessions.length > 0;

      return {
        diaryEntries: trimmedDiary,
        gratitudeEntries: trimmedGratitude,
        breathingSessions: filteredSessions,
        summary: this.generateEveningSummary(trimmedDiary, trimmedGratitude, filteredSessions),
        hasData,
        dataRange: { start: startDate, end: endDate }
      };
    } catch (error) {
      // Offline-Fallback: Leere Aggregation mit Platzhalter
      return {
        diaryEntries: [],
        gratitudeEntries: [],
        breathingSessions: [],
        summary: 'Keine Daten verfügbar - Offline-Modus',
        hasData: false,
        dataRange: { start: startDate, end: endDate }
      };
    }
  }

  /**
   * Aggregiert Daten für Morning Focus
   */
  static async aggregateMorning(
    userId: string,
    provider: DataProvider,
    timestamp: string = new Date().toISOString()
  ): Promise<MorningAggregation> {
    const endTime = new Date(timestamp);
    const startTime = new Date(endTime);
    startTime.setHours(0, 0, 0, 0); // Seit Mitternacht
    
    const startDate = startTime.toISOString();
    const endDate = endTime.toISOString();

    try {
      // Hole letzten Evening Summary
      const lastEveningSummary = await provider.getLastEveningSummary(userId);

      // Generiere heutige Ziele (leer → generische Impulse)
      const todayGoals = this.generateTodayGoals();

      const hasData = !!lastEveningSummary || todayGoals.length > 0;

      return {
        lastEveningSummary: lastEveningSummary || undefined,
        todayGoals,
        hasData,
        dataRange: { start: startDate, end: endDate }
      };
    } catch (error) {
      // Offline-Fallback: Generische Impulse
      return {
        lastEveningSummary: undefined,
        todayGoals: GENERIC_MORNING_IMPULSES,
        hasData: true,
        dataRange: { start: startDate, end: endDate }
      };
    }
  }

  /**
   * Kürzt Diary-Entries für AI-Verarbeitung
   */
  private static trimDiaryEntries(entries: DiaryEntry[]): DiaryEntry[] {
    return entries
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5) // Max 5 neueste Einträge
      .map(entry => ({
        ...entry,
        text: entry.text.length > this.MAX_DIARY_LENGTH 
          ? entry.text.substring(0, this.MAX_DIARY_LENGTH) + '...'
          : entry.text
      }));
  }

  /**
   * Kürzt Gratitude-Entries für AI-Verarbeitung
   */
  private static trimGratitudeEntries(entries: GratitudeEntry[]): GratitudeEntry[] {
    return entries
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6) // Max 6 neueste Einträge (3 Tage morgens + abends)
      .map(entry => ({
        ...entry,
        text: entry.text.length > this.MAX_GRATITUDE_LENGTH
          ? entry.text.substring(0, this.MAX_GRATITUDE_LENGTH) + '...'
          : entry.text
      }));
  }

  /**
   * Filtert nur abgeschlossene Atem-Sessions
   */
  private static filterCompletedSessions(sessions: BreathingSession[]): BreathingSession[] {
    return sessions
      .filter(session => session.completed)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10); // Max 10 neueste Sessions
  }

  /**
   * Generiert Evening Summary Text
   */
  private static generateEveningSummary(
    diaryEntries: DiaryEntry[],
    gratitudeEntries: GratitudeEntry[],
    breathingSessions: BreathingSession[]
  ): string {
    const parts: string[] = [];

    // Diary Summary
    if (diaryEntries.length > 0) {
      const diaryCount = diaryEntries.length;
      const diaryText = diaryEntries.map(entry => entry.text).join(' ');
      parts.push(`Journal: ${diaryCount} Einträge - ${diaryText.substring(0, 200)}...`);
    }

    // Gratitude Summary
    if (gratitudeEntries.length > 0) {
      const morningGratitude = gratitudeEntries.filter(g => g.morning);
      const eveningGratitude = gratitudeEntries.filter(g => !g.morning);
      parts.push(`Dankbarkeit: ${morningGratitude.length} morgens, ${eveningGratitude.length} abends`);
    }

    // Breathing Summary
    if (breathingSessions.length > 0) {
      const totalDuration = breathingSessions.reduce((sum, s) => sum + s.durationSec, 0);
      const minutes = Math.round(totalDuration / 60);
      parts.push(`Atemübungen: ${breathingSessions.length} Sessions, ${minutes} Minuten`);
    }

    return parts.length > 0 ? parts.join(' | ') : 'Keine Aktivitäten in den letzten 24 Stunden';
  }

  /**
   * Generiert heutige Ziele (leer → generische Impulse)
   */
  private static generateTodayGoals(): string[] {
    // Zufällige Auswahl von 3 generischen Impulsen
    const shuffled = [...GENERIC_MORNING_IMPULSES].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3);
  }

  /**
   * Formatiert Daten für AI-Prompt
   */
  static formatForAIPrompt(aggregation: EveningAggregation | MorningAggregation): string {
    if ('diaryEntries' in aggregation) {
      // Evening Aggregation
      const evening = aggregation as EveningAggregation;
      const parts: string[] = [];

      if (evening.diaryEntries.length > 0) {
        parts.push('JOURNAL:');
        evening.diaryEntries.forEach((entry, index) => {
          parts.push(`${index + 1}. ${entry.date}: ${entry.text}`);
        });
      }

      if (evening.gratitudeEntries.length > 0) {
        parts.push('\nDANKBARKEIT:');
        evening.gratitudeEntries.forEach((entry, index) => {
          const time = entry.morning ? 'morgens' : 'abends';
          parts.push(`${index + 1}. ${entry.date} ${time}: ${entry.text}`);
        });
      }

      if (evening.breathingSessions.length > 0) {
        parts.push('\nATEMÜBUNGEN:');
        evening.breathingSessions.forEach((session, index) => {
          const minutes = Math.round(session.durationSec / 60);
          parts.push(`${index + 1}. ${session.method} - ${minutes} Minuten`);
        });
      }

      return parts.join('\n');
    } else {
      // Morning Aggregation
      const morning = aggregation as MorningAggregation;
      const parts: string[] = [];

      if (morning.lastEveningSummary) {
        parts.push(`GESTERN ABEND: ${morning.lastEveningSummary}`);
      }

      if (morning.todayGoals && morning.todayGoals.length > 0) {
        parts.push('\nHEUTIGE IMPULSE:');
        morning.todayGoals.forEach((goal, index) => {
          parts.push(`${index + 1}. ${goal}`);
        });
      }

      return parts.join('\n');
    }
  }

  /**
   * Validiert Aggregation-Daten
   */
  static validateAggregation(aggregation: EveningAggregation | MorningAggregation): boolean {
    if ('diaryEntries' in aggregation) {
      const evening = aggregation as EveningAggregation;
      return evening.dataRange.start < evening.dataRange.end &&
             evening.diaryEntries.length >= 0 &&
             evening.gratitudeEntries.length >= 0 &&
             evening.breathingSessions.length >= 0;
    } else {
      const morning = aggregation as MorningAggregation;
      return morning.dataRange.start < morning.dataRange.end &&
             (morning.todayGoals?.length ?? 0) >= 0;
    }
  }
}
