/**
 * Breathing Sessions Service
 * CRUD-Operationen für Atem-Sessions mit Range-Filtering und Analytics
 */

import { supabase } from './supabase.client';
import { 
  BreathingSession, 
  CreateBreathingSession, 
  UpdateBreathingSession,
  BreathingSessionResponse 
} from '../../models/session.model';
import { 
  mapToBreathingSession, 
  mapFromCreateBreathingSession, 
  mapFromUpdateBreathingSession,
  mapToBreathingSessionResponse 
} from './mappers';
import { createDBError, DBErrorCode, mapSupabaseError, logDBError } from './errors';

/**
 * Range-Filter-Parameter für Sessions
 */
export interface SessionRangeParams {
  startDate?: string;  // ISO timestamp
  endDate?: string;    // ISO timestamp
  method?: string;     // Atem-Methode filter
  completed?: boolean; // Nur abgeschlossene/unvollständige Sessions
}

/**
 * Pagination-Parameter
 */
export interface PaginationParams {
  cursor?: string; // ISO timestamp für cursor-based pagination
  page?: number;   // 1-basiert für page-based pagination
  limit?: number;  // Anzahl Einträge pro Seite (max 100)
}

/**
 * Paginierte Antwort
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    hasMore: boolean;
    nextCursor?: string;
    totalCount?: number;
    currentPage?: number;
    totalPages?: number;
  };
}

/**
 * Session-Statistiken
 */
export interface SessionStats {
  totalSessions: number;
  completedSessions: number;
  totalDurationSec: number;
  averageDurationSec: number;
  methodCounts: Record<string, number>;
  completionRate: number;
  sessionsThisWeek: number;
  sessionsThisMonth: number;
}

/**
 * Breathing Sessions Service Klasse
 */
export class BreathingSessionsService {
  private static readonly TABLE_NAME = 'breathing_sessions';
  private static readonly MAX_LIMIT = 100;
  private static readonly DEFAULT_LIMIT = 20;

  /**
   * Erstellt eine neue Breathing-Session
   */
  static async create(session: CreateBreathingSession): Promise<BreathingSession> {
    try {
      const dbData = mapFromCreateBreathingSession(session);
      
      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .insert(dbData)
        .select()
        .single();

      if (error) {
        const dbError = mapSupabaseError(error);
        logDBError(dbError);
        throw new Error(dbError.message);
      }

      return mapToBreathingSession(data);
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Holt eine Breathing-Session nach ID
   */
  static async getById(id: string, userId: string): Promise<BreathingSession | null> {
    try {
      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Nicht gefunden
        }
        const dbError = mapSupabaseError(error);
        logDBError(dbError);
        throw new Error(dbError.message);
      }

      return mapToBreathingSession(data);
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Holt Breathing-Sessions mit Range-Filtering und Pagination
   * Sortierung: timestamp desc (neueste zuerst)
   */
  static async list(
    userId: string, 
    rangeParams: SessionRangeParams = {},
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<BreathingSession>> {
    try {
      const limit = Math.min(pagination.limit || this.DEFAULT_LIMIT, this.MAX_LIMIT);
      
      let query = supabase
        .from(this.TABLE_NAME)
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('timestamp', { ascending: false }) // Neueste zuerst
        .order('created_at', { ascending: false });

      // Range-Filter: Start-Datum
      if (rangeParams.startDate) {
        query = query.gte('timestamp', rangeParams.startDate);
      }

      // Range-Filter: End-Datum
      if (rangeParams.endDate) {
        query = query.lte('timestamp', rangeParams.endDate);
      }

      // Method-Filter
      if (rangeParams.method) {
        query = query.eq('method', rangeParams.method);
      }

      // Completed-Filter
      if (rangeParams.completed !== undefined) {
        query = query.eq('completed', rangeParams.completed);
      }

      // Cursor-based pagination
      if (pagination.cursor) {
        query = query.lt('timestamp', pagination.cursor);
      }
      // Page-based pagination
      else if (pagination.page && pagination.page > 1) {
        const offset = (pagination.page - 1) * limit;
        query = query.range(offset, offset + limit - 1);
      }
      // Erste Seite
      else {
        query = query.limit(limit);
      }

      const { data, error, count } = await query;

      if (error) {
        const dbError = mapSupabaseError(error);
        logDBError(dbError);
        throw new Error(dbError.message);
      }

      const sessions = data?.map(mapToBreathingSession) || [];
      
      // Pagination-Metadaten
      const hasMore = sessions.length === limit;
      const nextCursor = hasMore ? sessions[sessions.length - 1]?.timestamp : undefined;
      
      let paginationMeta: PaginatedResponse<BreathingSession>['pagination'] = {
        hasMore,
        nextCursor
      };

      // Page-based Metadaten
      if (pagination.page && count !== null) {
        const totalPages = Math.ceil(count / limit);
        paginationMeta = {
          ...paginationMeta,
          totalCount: count,
          currentPage: pagination.page,
          totalPages
        };
      }

      return {
        data: sessions,
        pagination: paginationMeta
      };
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Aktualisiert eine Breathing-Session
   */
  static async update(
    id: string, 
    userId: string, 
    updates: UpdateBreathingSession
  ): Promise<BreathingSession> {
    try {
      const dbUpdates = mapFromUpdateBreathingSession(updates);
      dbUpdates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .update(dbUpdates)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Session nicht gefunden');
        }
        const dbError = mapSupabaseError(error);
        logDBError(dbError);
        throw new Error(dbError.message);
      }

      return mapToBreathingSession(data);
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Löscht eine Breathing-Session
   */
  static async delete(id: string, userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        const dbError = mapSupabaseError(error);
        logDBError(dbError);
        throw new Error(dbError.message);
      }
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Holt Sessions für ein spezifisches Datum
   */
  static async getByDate(date: string, userId: string): Promise<BreathingSession[]> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .eq('user_id', userId)
        .gte('timestamp', startOfDay.toISOString())
        .lte('timestamp', endOfDay.toISOString())
        .order('timestamp', { ascending: false });

      if (error) {
        const dbError = mapSupabaseError(error);
        logDBError(dbError);
        throw new Error(dbError.message);
      }

      return data?.map(mapToBreathingSession) || [];
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Holt die neueste Session eines Benutzers
   */
  static async getLatest(userId: string): Promise<BreathingSession | null> {
    try {
      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        const dbError = mapSupabaseError(error);
        logDBError(dbError);
        throw new Error(dbError.message);
      }

      return mapToBreathingSession(data);
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Statistiken für Breathing-Sessions
   */
  static async getStats(
    userId: string, 
    rangeParams: SessionRangeParams = {}
  ): Promise<SessionStats> {
    try {
      let query = supabase
        .from(this.TABLE_NAME)
        .select('*')
        .eq('user_id', userId);

      // Range-Filter anwenden
      if (rangeParams.startDate) {
        query = query.gte('timestamp', rangeParams.startDate);
      }
      if (rangeParams.endDate) {
        query = query.lte('timestamp', rangeParams.endDate);
      }
      if (rangeParams.method) {
        query = query.eq('method', rangeParams.method);
      }
      if (rangeParams.completed !== undefined) {
        query = query.eq('completed', rangeParams.completed);
      }

      const { data, error } = await query;

      if (error) {
        const dbError = mapSupabaseError(error);
        logDBError(dbError);
        throw new Error(dbError.message);
      }

      const sessions = data?.map(mapToBreathingSession) || [];
      const completed = sessions.filter(s => s.completed);
      const totalDuration = completed.reduce((sum, s) => sum + s.durationSec, 0);
      
      // Method-Counts
      const methodCounts = new Map<string, number>();
      completed.forEach(session => {
        methodCounts.set(session.method, (methodCounts.get(session.method) || 0) + 1);
      });

      // Sessions diese Woche
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const sessionsThisWeek = sessions.filter(s => 
        new Date(s.timestamp) >= oneWeekAgo
      ).length;

      // Sessions diesen Monat
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      const sessionsThisMonth = sessions.filter(s => 
        new Date(s.timestamp) >= oneMonthAgo
      ).length;

      return {
        totalSessions: sessions.length,
        completedSessions: completed.length,
        totalDurationSec: totalDuration,
        averageDurationSec: completed.length > 0 ? Math.round(totalDuration / completed.length) : 0,
        methodCounts: Object.fromEntries(methodCounts),
        completionRate: sessions.length > 0 ? (completed.length / sessions.length) * 100 : 0,
        sessionsThisWeek,
        sessionsThisMonth
      };
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Holt alle verwendeten Atem-Methoden eines Benutzers
   */
  static async getMethods(userId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('method')
        .eq('user_id', userId)
        .not('method', 'is', null);

      if (error) {
        const dbError = mapSupabaseError(error);
        logDBError(dbError);
        throw new Error(dbError.message);
      }

      // Methoden sammeln und deduplizieren
      const methods = new Set<string>();
      data?.forEach(row => {
        if (row.method) {
          methods.add(row.method);
        }
      });

      return Array.from(methods).sort();
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Markiert eine Session als abgeschlossen
   */
  static async markCompleted(id: string, userId: string): Promise<BreathingSession> {
    return this.update(id, userId, { completed: true });
  }

  /**
   * Markiert eine Session als unvollständig
   */
  static async markIncomplete(id: string, userId: string): Promise<BreathingSession> {
    return this.update(id, userId, { completed: false });
  }
}
