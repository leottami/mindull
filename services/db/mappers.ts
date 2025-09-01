/**
 * Zentrale Mapper-Funktionen für DB-Operationen
 * Parsing, Normalisierung und Serialisierung aller Modelle
 */

import { 
  UserProfile, 
  CreateUserProfile, 
  UpdateUserProfile,
  ProfileValidator 
} from '../../models/profile.model';

import { 
  DiaryEntry, 
  CreateDiaryEntry, 
  UpdateDiaryEntry,
  DiaryEntryResponse,
  DiaryValidator,
  normalizeTags 
} from '../../models/diary.model';

import { 
  GratitudeEntry, 
  CreateGratitudeEntry, 
  UpdateGratitudeEntry,
  GratitudeEntryResponse,
  GratitudeValidator 
} from '../../models/gratitude.model';

import { 
  BreathingSession, 
  CreateBreathingSession, 
  UpdateBreathingSession,
  BreathingSessionResponse,
  SessionValidator 
} from '../../models/session.model';

import { 
  DreamEntry, 
  CreateDreamEntry, 
  UpdateDreamEntry,
  DreamEntryResponse,
  DreamValidator,
  normalizeDreamTags 
} from '../../models/dream.model';

// ============================================================================
// GENERIC MAPPERS
// ============================================================================

/**
 * Normalisiert Strings (trimmen, lowercase)
 */
export function normalizeString(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Normalisiert Arrays von Strings
 */
export function normalizeStringArray(values: string[]): string[] {
  if (!Array.isArray(values)) return [];
  
  return [...new Set(
    values
      .map(v => normalizeString(v))
      .filter(v => v.length > 0)
  )].sort();
}

/**
 * Validiert und normalisiert Datum (YYYY-MM-DD)
 */
export function normalizeDate(date: string): string {
  if (!DiaryValidator.isValidDate(date)) {
    throw new Error('Ungültiges Datum-Format');
  }
  return date;
}

/**
 * Validiert und normalisiert Timestamp (ISO-UTC)
 */
export function normalizeTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    throw new Error('Ungültiger Timestamp');
  }
  return date.toISOString();
}

// ============================================================================
// PROFILE MAPPERS
// ============================================================================

/**
 * Mappt DB-Row zu UserProfile
 */
export function mapToUserProfile(row: any): UserProfile {
  if (!row) throw new Error('Keine Daten für UserProfile');
  
  const profile: UserProfile = {
    id: String(row.id),
    email: normalizeString(row.email),
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
    reminderMorning: row.reminder_morning,
    reminderEvening: row.reminder_evening,
    realityCheckEnabled: Boolean(row.reality_check_enabled),
    realityCheckStart: row.reality_check_start,
    realityCheckEnd: row.reality_check_end,
    realityCheckCount: Number(row.reality_check_count),
    analyticsOptIn: Boolean(row.analytics_opt_in),
    aiReflectionOptIn: Boolean(row.ai_reflection_opt_in),
    theme: row.theme
  };
  
  const errors = ProfileValidator.validateProfile(profile);
  if (errors.length > 0) {
    throw new Error(`Profile-Validierung fehlgeschlagen: ${errors.join(', ')}`);
  }
  
  return profile;
}

/**
 * Mappt CreateUserProfile zu DB-Row
 */
export function mapFromCreateUserProfile(profile: CreateUserProfile): any {
  const errors = ProfileValidator.validateCreateProfile(profile);
  if (errors.length > 0) {
    throw new Error(`CreateProfile-Validierung fehlgeschlagen: ${errors.join(', ')}`);
  }
  
  return {
    email: normalizeString(profile.email),
    reminder_morning: profile.reminderMorning,
    reminder_evening: profile.reminderEvening,
    reality_check_enabled: profile.realityCheckEnabled,
    reality_check_start: profile.realityCheckStart,
    reality_check_end: profile.realityCheckEnd,
    reality_check_count: profile.realityCheckCount,
    analytics_opt_in: profile.analyticsOptIn,
    ai_reflection_opt_in: profile.aiReflectionOptIn,
    theme: profile.theme
  };
}

/**
 * Mappt UpdateUserProfile zu DB-Row
 */
export function mapFromUpdateUserProfile(profile: UpdateUserProfile): any {
  const update: any = {};
  
  if (profile.email !== undefined) {
    update.email = normalizeString(profile.email);
  }
  if (profile.reminderMorning !== undefined) {
    update.reminder_morning = profile.reminderMorning;
  }
  if (profile.reminderEvening !== undefined) {
    update.reminder_evening = profile.reminderEvening;
  }
  if (profile.realityCheckEnabled !== undefined) {
    update.reality_check_enabled = profile.realityCheckEnabled;
  }
  if (profile.realityCheckStart !== undefined) {
    update.reality_check_start = profile.realityCheckStart;
  }
  if (profile.realityCheckEnd !== undefined) {
    update.reality_check_end = profile.realityCheckEnd;
  }
  if (profile.realityCheckCount !== undefined) {
    update.reality_check_count = profile.realityCheckCount;
  }
  if (profile.analyticsOptIn !== undefined) {
    update.analytics_opt_in = profile.analyticsOptIn;
  }
  if (profile.aiReflectionOptIn !== undefined) {
    update.ai_reflection_opt_in = profile.aiReflectionOptIn;
  }
  if (profile.theme !== undefined) {
    update.theme = profile.theme;
  }
  
  return update;
}

// ============================================================================
// DIARY MAPPERS
// ============================================================================

/**
 * Mappt DB-Row zu DiaryEntry
 */
export function mapToDiaryEntry(row: any): DiaryEntry {
  if (!row) throw new Error('Keine Daten für DiaryEntry');
  
  const entry: DiaryEntry = {
    id: String(row.id),
    userId: String(row.user_id),
    date: normalizeDate(row.date),
    text: String(row.text),
    tags: Array.isArray(row.tags) ? row.tags : [],
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at)
  };
  
  const errors = DiaryValidator.validateEntry(entry);
  if (errors.length > 0) {
    throw new Error(`DiaryEntry-Validierung fehlgeschlagen: ${errors.join(', ')}`);
  }
  
  return entry;
}

/**
 * Mappt CreateDiaryEntry zu DB-Row
 */
export function mapFromCreateDiaryEntry(entry: CreateDiaryEntry): any {
  const errors = DiaryValidator.validateCreateEntry(entry);
  if (errors.length > 0) {
    throw new Error(`CreateDiaryEntry-Validierung fehlgeschlagen: ${errors.join(', ')}`);
  }
  
  return {
    user_id: String(entry.userId),
    date: normalizeDate(entry.date),
    text: String(entry.text).trim(),
    tags: normalizeTags(entry.tags || [])
  };
}

/**
 * Mappt UpdateDiaryEntry zu DB-Row
 */
export function mapFromUpdateDiaryEntry(entry: UpdateDiaryEntry): any {
  const update: any = {};
  
  if (entry.text !== undefined) {
    update.text = String(entry.text).trim();
  }
  if (entry.tags !== undefined) {
    update.tags = normalizeTags(entry.tags);
  }
  
  return update;
}

/**
 * Mappt DiaryEntry zu Response-Format
 */
export function mapToDiaryEntryResponse(entry: DiaryEntry): DiaryEntryResponse {
  return {
    id: entry.id,
    date: entry.date,
    text: entry.text,
    tags: entry.tags,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };
}

// ============================================================================
// GRATITUDE MAPPERS
// ============================================================================

/**
 * Mappt DB-Row zu GratitudeEntry
 */
export function mapToGratitudeEntry(row: any): GratitudeEntry {
  if (!row) throw new Error('Keine Daten für GratitudeEntry');
  
  const entry: GratitudeEntry = {
    id: String(row.id),
    userId: String(row.user_id),
    date: normalizeDate(row.date),
    morning: Boolean(row.morning),
    text: String(row.text),
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at)
  };
  
  const errors = GratitudeValidator.validateEntry(entry);
  if (errors.length > 0) {
    throw new Error(`GratitudeEntry-Validierung fehlgeschlagen: ${errors.join(', ')}`);
  }
  
  return entry;
}

/**
 * Mappt CreateGratitudeEntry zu DB-Row
 */
export function mapFromCreateGratitudeEntry(entry: CreateGratitudeEntry): any {
  const errors = GratitudeValidator.validateCreateEntry(entry);
  if (errors.length > 0) {
    throw new Error(`CreateGratitudeEntry-Validierung fehlgeschlagen: ${errors.join(', ')}`);
  }
  
  return {
    user_id: String(entry.userId),
    date: normalizeDate(entry.date),
    morning: Boolean(entry.morning),
    text: String(entry.text).trim()
  };
}

/**
 * Mappt UpdateGratitudeEntry zu DB-Row
 */
export function mapFromUpdateGratitudeEntry(entry: UpdateGratitudeEntry): any {
  const update: any = {};
  
  if (entry.text !== undefined) {
    update.text = String(entry.text).trim();
  }
  
  return update;
}

/**
 * Mappt GratitudeEntry zu Response-Format
 */
export function mapToGratitudeEntryResponse(entry: GratitudeEntry): GratitudeEntryResponse {
  return {
    id: entry.id,
    date: entry.date,
    morning: entry.morning,
    text: entry.text,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };
}

// ============================================================================
// SESSION MAPPERS
// ============================================================================

/**
 * Mappt DB-Row zu BreathingSession
 */
export function mapToBreathingSession(row: any): BreathingSession {
  if (!row) throw new Error('Keine Daten für BreathingSession');
  
  const session: BreathingSession = {
    id: String(row.id),
    userId: String(row.user_id),
    method: String(row.method),
    durationSec: Number(row.duration_sec),
    completed: Boolean(row.completed),
    timestamp: normalizeTimestamp(row.timestamp),
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at)
  };
  
  const errors = SessionValidator.validateSession(session);
  if (errors.length > 0) {
    throw new Error(`BreathingSession-Validierung fehlgeschlagen: ${errors.join(', ')}`);
  }
  
  return session;
}

/**
 * Mappt CreateBreathingSession zu DB-Row
 */
export function mapFromCreateBreathingSession(session: CreateBreathingSession): any {
  const errors = SessionValidator.validateCreateSession(session);
  if (errors.length > 0) {
    throw new Error(`CreateBreathingSession-Validierung fehlgeschlagen: ${errors.join(', ')}`);
  }
  
  return {
    user_id: String(session.userId),
    method: String(session.method),
    duration_sec: Math.round(Number(session.durationSec)),
    completed: Boolean(session.completed ?? false),
    timestamp: new Date().toISOString()
  };
}

/**
 * Mappt UpdateBreathingSession zu DB-Row
 */
export function mapFromUpdateBreathingSession(session: UpdateBreathingSession): any {
  const update: any = {};
  
  if (session.completed !== undefined) {
    update.completed = Boolean(session.completed);
  }
  if (session.durationSec !== undefined) {
    update.duration_sec = Math.round(Number(session.durationSec));
  }
  
  return update;
}

/**
 * Mappt BreathingSession zu Response-Format
 */
export function mapToBreathingSessionResponse(session: BreathingSession): BreathingSessionResponse {
  return {
    id: session.id,
    method: session.method,
    durationSec: session.durationSec,
    completed: session.completed,
    timestamp: session.timestamp,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  };
}

// ============================================================================
// DREAM MAPPERS (Phase 2)
// ============================================================================

/**
 * Mappt DB-Row zu DreamEntry
 */
export function mapToDreamEntry(row: any): DreamEntry {
  if (!row) throw new Error('Keine Daten für DreamEntry');
  
  const entry: DreamEntry = {
    id: String(row.id),
    userId: String(row.user_id),
    date: normalizeDate(row.date),
    title: String(row.title),
    content: String(row.content),
    lucidity: Boolean(row.lucidity),
    recall: Number(row.recall),
    tags: Array.isArray(row.tags) ? row.tags : [],
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at)
  };
  
  const errors = DreamValidator.validateEntry(entry);
  if (errors.length > 0) {
    throw new Error(`DreamEntry-Validierung fehlgeschlagen: ${errors.join(', ')}`);
  }
  
  return entry;
}

/**
 * Mappt CreateDreamEntry zu DB-Row
 */
export function mapFromCreateDreamEntry(entry: CreateDreamEntry): any {
  const errors = DreamValidator.validateCreateEntry(entry);
  if (errors.length > 0) {
    throw new Error(`CreateDreamEntry-Validierung fehlgeschlagen: ${errors.join(', ')}`);
  }
  
  return {
    user_id: String(entry.userId),
    date: normalizeDate(entry.date),
    title: String(entry.title).trim(),
    content: String(entry.content).trim(),
    lucidity: Boolean(entry.lucidity),
    recall: Number(entry.recall),
    tags: normalizeDreamTags(entry.tags || [])
  };
}

/**
 * Mappt UpdateDreamEntry zu DB-Row
 */
export function mapFromUpdateDreamEntry(entry: UpdateDreamEntry): any {
  const update: any = {};
  
  if (entry.title !== undefined) {
    update.title = String(entry.title).trim();
  }
  if (entry.content !== undefined) {
    update.content = String(entry.content).trim();
  }
  if (entry.lucidity !== undefined) {
    update.lucidity = Boolean(entry.lucidity);
  }
  if (entry.recall !== undefined) {
    update.recall = Number(entry.recall);
  }
  if (entry.tags !== undefined) {
    update.tags = normalizeDreamTags(entry.tags);
  }
  
  return update;
}

/**
 * Mappt DreamEntry zu Response-Format
 */
export function mapToDreamEntryResponse(entry: DreamEntry): DreamEntryResponse {
  return {
    id: entry.id,
    date: entry.date,
    title: entry.title,
    content: entry.content,
    lucidity: entry.lucidity,
    recall: entry.recall,
    tags: entry.tags,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };
}
