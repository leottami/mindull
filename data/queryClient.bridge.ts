/**
 * React Query Cache Bridge - Auth-State Integration
 * Cache-Management bei Login/Logout und Identity-Wechsel
 */

import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import { User } from '../services/auth/types';
import { IQueryClientService } from '../services/auth/auth.bridge';

// ============================================================================
// TYPES
// ============================================================================

export interface CacheInvalidationStrategy {
  readonly clearAll: boolean;
  readonly clearSensitive: boolean;
  readonly invalidateUserScoped: boolean;
  readonly preserveStatic: boolean;
}

export interface CacheCleanupConfig {
  // Welche Cache-Keys als "sensitiv" gelten
  readonly sensitivePrefixes: string[];
  // Welche Cache-Keys als "statisch" gelten (nicht user-bezogen)
  readonly staticPrefixes: string[];
  // User-scoped Prefixes (müssen userId enthalten)
  readonly userScopedPrefixes: string[];
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Standard Cache-Cleanup-Konfiguration für mindull
 * Basierend auf queryKeys.ts Struktur
 */
export const DEFAULT_CACHE_CONFIG: CacheCleanupConfig = {
  // Sensitive Daten die bei Logout komplett gelöscht werden
  sensitivePrefixes: [
    'diary',        // Private Tagebucheinträge
    'gratitude',    // Private Dankbarkeitseinträge
    'sessions',     // Private Atemsessions
    'dreams',       // Private Traumtagebuch (Phase 2)
    'user',         // User-Profile und Settings
    'ai'            // AI-Reflexionen mit persönlichen Daten
  ],

  // Statische Daten die user-unabhängig sind
  staticPrefixes: [
    'breathing-methods',  // Öffentliche Atemmethoden
    'app-config',        // App-Konfiguration
    'feature-flags',     // Feature-Flags
    'health-check'       // System-Health
  ],

  // User-scoped Daten die bei Identity-Wechsel invalidiert werden
  userScopedPrefixes: [
    'diary',
    'gratitude', 
    'sessions',
    'dreams',
    'user',
    'ai'
  ]
};

// ============================================================================
// CACHE STRATEGIES
// ============================================================================

/**
 * Cache-Strategien für verschiedene Auth-Events
 */
export const CACHE_STRATEGIES = {
  // Logout: Alle sensitiven Daten löschen, statische behalten
  LOGOUT: {
    clearAll: false,
    clearSensitive: true,
    invalidateUserScoped: false,
    preserveStatic: true
  } as CacheInvalidationStrategy,

  // Login: User-Scoped Keys invalidieren für frische Daten
  LOGIN: {
    clearAll: false,
    clearSensitive: false,
    invalidateUserScoped: true,
    preserveStatic: true
  } as CacheInvalidationStrategy,

  // Identity-Wechsel: Sensitive Daten löschen + User-Scoped invalidieren
  IDENTITY_CHANGE: {
    clearAll: false,
    clearSensitive: true,
    invalidateUserScoped: true,
    preserveStatic: true
  } as CacheInvalidationStrategy,

  // Kompletter Reset (nur in Notfällen)
  FULL_RESET: {
    clearAll: true,
    clearSensitive: true,
    invalidateUserScoped: true,
    preserveStatic: false
  } as CacheInvalidationStrategy
};

// ============================================================================
// QUERY CLIENT BRIDGE IMPLEMENTATION
// ============================================================================

/**
 * React Query Cache Bridge
 * Implementiert IQueryClientService für Auth-Bridge Integration
 */
export class QueryClientBridge implements IQueryClientService {
  constructor(
    private queryClient: QueryClient,
    private config: CacheCleanupConfig = DEFAULT_CACHE_CONFIG
  ) {}

  /**
   * Löscht alle sensitiven Caches (bei Logout)
   */
  async clearSensitiveCaches(): Promise<void> {
    try {
      const strategy = CACHE_STRATEGIES.LOGOUT;
      await this.applyCacheStrategy(strategy);
    } catch (error) {
      console.error('QueryClientBridge: Fehler beim Löschen sensitiver Caches:', error);
      throw error;
    }
  }

  /**
   * Invalidiert User-Scoped Queries für neuen/geänderten User
   */
  async invalidateUserScopedQueries(userId: string): Promise<void> {
    try {
      const promises: Promise<void>[] = [];

      for (const prefix of this.config.userScopedPrefixes) {
        // Invalidiere alle Queries mit diesem Prefix und der userId
        promises.push(
          this.queryClient.invalidateQueries({
            predicate: (query) => {
              const queryKey = query.queryKey;
              return this.isUserScopedQuery(queryKey, prefix, userId);
            }
          })
        );
      }

      await Promise.all(promises);
    } catch (error) {
      console.error('QueryClientBridge: Fehler beim Invalidieren User-Scoped Queries:', error);
      throw error;
    }
  }

  /**
   * Kompletter Query-Client Reset
   */
  async resetQueryClient(): Promise<void> {
    try {
      await this.queryClient.clear();
    } catch (error) {
      console.error('QueryClientBridge: Fehler beim Query-Client Reset:', error);
      throw error;
    }
  }

  /**
   * Cache-Strategie anwenden
   */
  private async applyCacheStrategy(strategy: CacheInvalidationStrategy): Promise<void> {
    const promises: Promise<void>[] = [];

    if (strategy.clearAll) {
      // Kompletter Reset
      promises.push(this.queryClient.clear());
    } else {
      if (strategy.clearSensitive) {
        // Nur sensitive Caches löschen
        promises.push(this.clearSensitiveQueries());
      }

      if (strategy.invalidateUserScoped) {
        // User-Scoped Queries invalidieren (ohne spezifische userId)
        promises.push(this.invalidateAllUserScopedQueries());
      }
    }

    await Promise.all(promises);
  }

  /**
   * Löscht alle sensitiven Queries
   */
  private async clearSensitiveQueries(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const prefix of this.config.sensitivePrefixes) {
      promises.push(
        this.queryClient.removeQueries({
          predicate: (query) => {
            const queryKey = query.queryKey;
            return this.hasPrefix(queryKey, prefix) && !this.isStaticQuery(queryKey);
          }
        })
      );
    }

    await Promise.all(promises);
  }

  /**
   * Invalidiert alle User-Scoped Queries (ohne spezifische userId)
   */
  private async invalidateAllUserScopedQueries(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const prefix of this.config.userScopedPrefixes) {
      promises.push(
        this.queryClient.invalidateQueries({
          predicate: (query) => {
            const queryKey = query.queryKey;
            return this.hasPrefix(queryKey, prefix);
          }
        })
      );
    }

    await Promise.all(promises);
  }

  /**
   * Prüft ob Query-Key einen bestimmten Prefix hat
   */
  private hasPrefix(queryKey: unknown[], prefix: string): boolean {
    if (!Array.isArray(queryKey) || queryKey.length === 0) {
      return false;
    }

    const firstKey = queryKey[0];
    if (typeof firstKey === 'string') {
      return firstKey.startsWith(prefix);
    }

    return false;
  }

  /**
   * Prüft ob Query statisch ist (user-unabhängig)
   */
  private isStaticQuery(queryKey: unknown[]): boolean {
    return this.config.staticPrefixes.some(prefix => this.hasPrefix(queryKey, prefix));
  }

  /**
   * Prüft ob Query user-scoped ist und zur userId gehört
   */
  private isUserScopedQuery(queryKey: unknown[], prefix: string, userId: string): boolean {
    if (!this.hasPrefix(queryKey, prefix)) {
      return false;
    }

    // Prüfe ob userId in Query-Key enthalten ist
    return queryKey.some(key => 
      typeof key === 'string' && key.includes(userId)
    );
  }

  /**
   * Gibt Cache-Statistiken zurück
   */
  getCacheStats(): {
    totalQueries: number;
    sensitiveQueries: number;
    staticQueries: number;
    userScopedQueries: number;
  } {
    const allQueries = this.queryClient.getQueryCache().getAll();
    
    let sensitiveQueries = 0;
    let staticQueries = 0;
    let userScopedQueries = 0;

    for (const query of allQueries) {
      const queryKey = query.queryKey;
      
      if (this.isStaticQuery(queryKey)) {
        staticQueries++;
      } else if (this.config.sensitivePrefixes.some(prefix => this.hasPrefix(queryKey, prefix))) {
        sensitiveQueries++;
      } else if (this.config.userScopedPrefixes.some(prefix => this.hasPrefix(queryKey, prefix))) {
        userScopedQueries++;
      }
    }

    return {
      totalQueries: allQueries.length,
      sensitiveQueries,
      staticQueries,
      userScopedQueries
    };
  }

  /**
   * Bereinigt abgelaufene Queries
   */
  async cleanup(): Promise<void> {
    try {
      this.queryClient.getQueryCache().clear();
    } catch (error) {
      console.error('QueryClientBridge: Fehler beim Cleanup:', error);
    }
  }
}

// ============================================================================
// SPECIFIC CACHE OPERATIONS
// ============================================================================

/**
 * Spezifische Cache-Operationen für mindull Domains
 */
export class MindullCacheOperations {
  constructor(private queryClient: QueryClient) {}

  /**
   * Diary-Cache für User invalidieren
   */
  async invalidateDiaryCache(userId: string): Promise<void> {
    await this.queryClient.invalidateQueries({
      queryKey: queryKeys.diary.user(userId).all
    });
  }

  /**
   * Gratitude-Cache für User invalidieren
   */
  async invalidateGratitudeCache(userId: string): Promise<void> {
    await this.queryClient.invalidateQueries({
      queryKey: queryKeys.gratitude.user(userId).all
    });
  }

  /**
   * Sessions-Cache für User invalidieren
   */
  async invalidateSessionsCache(userId: string): Promise<void> {
    await this.queryClient.invalidateQueries({
      queryKey: queryKeys.sessions.user(userId).all
    });
  }

  /**
   * AI-Cache für User löschen (sensitive)
   */
  async clearAICache(userId: string): Promise<void> {
    await this.queryClient.removeQueries({
      queryKey: queryKeys.ai.user(userId).all
    });
  }

  /**
   * User-Profile Cache invalidieren
   */
  async invalidateUserCache(userId: string): Promise<void> {
    await this.queryClient.invalidateQueries({
      queryKey: queryKeys.user.byId(userId)
    });
  }

  /**
   * Optimistic Update für neue Diary Entry
   */
  async optimisticDiaryUpdate(userId: string, entry: any): Promise<void> {
    const queryKey = queryKeys.diary.user(userId).list({});
    
    this.queryClient.setQueryData(queryKey, (oldData: any) => {
      if (!oldData) return { items: [entry], total: 1 };
      
      return {
        ...oldData,
        items: [entry, ...oldData.items],
        total: oldData.total + 1
      };
    });
  }

  /**
   * Optimistic Update für neue Gratitude Entry
   */
  async optimisticGratitudeUpdate(userId: string, entry: any): Promise<void> {
    const queryKey = queryKeys.gratitude.user(userId).list({});
    
    this.queryClient.setQueryData(queryKey, (oldData: any) => {
      if (!oldData) return { items: [entry], total: 1 };
      
      return {
        ...oldData,
        items: [entry, ...oldData.items],
        total: oldData.total + 1
      };
    });
  }
}

// ============================================================================
// SINGLETON & FACTORY
// ============================================================================

let queryClientBridgeInstance: QueryClientBridge | null = null;
let mindullCacheOperationsInstance: MindullCacheOperations | null = null;

export function getQueryClientBridge(
  queryClient?: QueryClient,
  config?: CacheCleanupConfig
): QueryClientBridge {
  if (!queryClientBridgeInstance && queryClient) {
    queryClientBridgeInstance = new QueryClientBridge(queryClient, config);
  }
  
  if (!queryClientBridgeInstance) {
    throw new Error('QueryClientBridge: QueryClient muss beim ersten Aufruf übergeben werden');
  }
  
  return queryClientBridgeInstance;
}

export function getMindullCacheOperations(queryClient?: QueryClient): MindullCacheOperations {
  if (!mindullCacheOperationsInstance && queryClient) {
    mindullCacheOperationsInstance = new MindullCacheOperations(queryClient);
  }
  
  if (!mindullCacheOperationsInstance) {
    throw new Error('MindullCacheOperations: QueryClient muss beim ersten Aufruf übergeben werden');
  }
  
  return mindullCacheOperationsInstance;
}

/**
 * Für Tests: Reset der Singleton-Instanzen
 */
export function resetQueryClientBridge(): void {
  queryClientBridgeInstance = null;
  mindullCacheOperationsInstance = null;
}

// ============================================================================
// INTEGRATION HELPER
// ============================================================================

/**
 * Initialisiert QueryClient-Bridge mit Auth-Bridge Integration
 */
export function initializeQueryClientBridge(queryClient: QueryClient): QueryClientBridge {
  const bridge = getQueryClientBridge(queryClient);
  
  // Bridge als IQueryClientService in AuthBridge registrieren würde hier passieren
  // Das geschieht in der App-Initialisierung
  
  return bridge;
}
