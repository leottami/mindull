/**
 * Konsolidierte Query-Keys für React Query
 * Stabile, typisierte Hierarchie mit minimalen Invalidations
 */

// =========================================================================
// TYPES
// =========================================================================

type PaginationParams = {
  cursor?: string;
  page?: number;
  limit?: number;
};

type SearchParams = {
  query?: string;
  dateRange?: { start: string; end: string };
  tags?: string[];
};

type StatsParams = {
  startDate?: string;
  endDate?: string;
  method?: string;
  [key: string]: any;
};

// =========================================================================
// STABLE CACHE TIMING CONSTANTS
// =========================================================================

export const CACHE_TIMES = {
  // Listen: kürzere staleTime für Aktualität
  LIST_STALE: 3 * 60 * 1000,    // 3 Minuten
  LIST_GC: 10 * 60 * 1000,      // 10 Minuten
  
  // Details: längere staleTime da seltener geändert
  DETAIL_STALE: 10 * 60 * 1000, // 10 Minuten
  DETAIL_GC: 30 * 60 * 1000,    // 30 Minuten
  
  // Stats/Analytics: sehr lang da aufwändig zu berechnen
  STATS_STALE: 15 * 60 * 1000,  // 15 Minuten
  STATS_GC: 60 * 60 * 1000,     // 1 Stunde
  
  // Search: kurz da oft interaktiv
  SEARCH_STALE: 2 * 60 * 1000,  // 2 Minuten
  SEARCH_GC: 5 * 60 * 1000,     // 5 Minuten
} as const;

// =========================================================================
// BASE KEYS (Hierarchisch & Deterministisch)
// =========================================================================

export const queryKeys = {
  // Auth & User
  auth: {
    all: ['auth'] as const,
    user: (userId: string) => [...queryKeys.auth.all, 'user', userId] as const,
    session: () => [...queryKeys.auth.all, 'session'] as const,
  },
  
  profile: {
    all: ['profile'] as const,
    user: (userId: string) => [...queryKeys.profile.all, userId] as const,
  },
  
  // Diary Domain
  diary: {
    all: ['diary'] as const,
    lists: () => [...queryKeys.diary.all, 'list'] as const,
    list: (userId: string, params?: PaginationParams) => [
      ...queryKeys.diary.lists(), 
      userId, 
      normalizeParams(params)
    ] as const,
    details: () => [...queryKeys.diary.all, 'detail'] as const,
    detail: (id: string, userId: string) => [...queryKeys.diary.details(), id, userId] as const,
    byDate: (date: string, userId: string) => [...queryKeys.diary.all, 'byDate', userId, date] as const,
    search: (userId: string, params: SearchParams) => [
      ...queryKeys.diary.all, 
      'search', 
      userId, 
      normalizeParams(params)
    ] as const,
    tags: (userId: string) => [...queryKeys.diary.all, 'tags', userId] as const,
    stats: (userId: string) => [...queryKeys.diary.all, 'stats', userId] as const,
  },
  
  // Gratitude Domain
  gratitude: {
    all: ['gratitude'] as const,
    lists: () => [...queryKeys.gratitude.all, 'list'] as const,
    list: (userId: string, params?: PaginationParams) => [
      ...queryKeys.gratitude.lists(), 
      userId, 
      normalizeParams(params)
    ] as const,
    details: () => [...queryKeys.gratitude.all, 'detail'] as const,
    detail: (id: string, userId: string) => [...queryKeys.gratitude.details(), id, userId] as const,
    byDate: (date: string, userId: string) => [...queryKeys.gratitude.all, 'byDate', userId, date] as const,
    byDay: (date: string, userId: string, morning: boolean) => [
      ...queryKeys.gratitude.all, 
      'byDay', 
      userId, 
      date, 
      morning
    ] as const,
  },
  
  // Breathing Sessions Domain
  sessions: {
    all: ['sessions'] as const,
    lists: () => [...queryKeys.sessions.all, 'list'] as const,
    list: (userId: string, rangeParams?: StatsParams, pagination?: PaginationParams) => [
      ...queryKeys.sessions.lists(), 
      userId, 
      normalizeParams(rangeParams), 
      normalizeParams(pagination)
    ] as const,
    details: () => [...queryKeys.sessions.all, 'detail'] as const,
    detail: (id: string, userId: string) => [...queryKeys.sessions.details(), id, userId] as const,
    byDate: (date: string, userId: string) => [...queryKeys.sessions.all, 'byDate', userId, date] as const,
    latest: (userId: string) => [...queryKeys.sessions.all, 'latest', userId] as const,
    stats: (userId: string, rangeParams?: StatsParams) => [
      ...queryKeys.sessions.all, 
      'stats', 
      userId, 
      normalizeParams(rangeParams)
    ] as const,
    methods: (userId: string) => [...queryKeys.sessions.all, 'methods', userId] as const,
  },
  
  // Dreams Domain (Phase 2)
  dreams: {
    all: ['dreams'] as const,
    lists: () => [...queryKeys.dreams.all, 'list'] as const,
    list: (userId: string, params?: PaginationParams) => [
      ...queryKeys.dreams.lists(), 
      userId, 
      normalizeParams(params)
    ] as const,
    details: () => [...queryKeys.dreams.all, 'detail'] as const,
    detail: (id: string, userId: string) => [...queryKeys.dreams.details(), id, userId] as const,
    search: (userId: string, params: SearchParams) => [
      ...queryKeys.dreams.all, 
      'search', 
      userId, 
      normalizeParams(params)
    ] as const,
    stats: (userId: string) => [...queryKeys.dreams.all, 'stats', userId] as const,
  },
  
  // Reality Checks (Phase 2)
  realityChecks: {
    all: ['reality-checks'] as const,
    lists: () => [...queryKeys.realityChecks.all, 'list'] as const,
    list: (userId: string, params?: PaginationParams) => [
      ...queryKeys.realityChecks.lists(), 
      userId, 
      normalizeParams(params)
    ] as const,
    details: () => [...queryKeys.realityChecks.all, 'detail'] as const,
    detail: (id: string, userId: string) => [...queryKeys.realityChecks.details(), id, userId] as const,
  },
  
  // AI & Analytics
  ai: {
    all: ['ai'] as const,
    reflection: (date: string, userId: string) => [...queryKeys.ai.all, 'reflection', userId, date] as const,
    summary: (userId: string, dateRange: { start: string; end: string }) => [
      ...queryKeys.ai.all, 
      'summary', 
      userId, 
      normalizeParams(dateRange)
    ] as const,
  },
  
  // Analytics & Insights
  analytics: {
    all: ['analytics'] as const,
    dashboard: (userId: string) => [...queryKeys.analytics.all, 'dashboard', userId] as const,
    trends: (userId: string, period: string) => [...queryKeys.analytics.all, 'trends', userId, period] as const,
    streaks: (userId: string) => [...queryKeys.analytics.all, 'streaks', userId] as const,
  },
  
  // Settings & Configuration
  settings: {
    all: ['settings'] as const,
    notifications: (userId: string) => [...queryKeys.settings.all, 'notifications', userId] as const,
    preferences: (userId: string) => [...queryKeys.settings.all, 'preferences', userId] as const,
    privacy: (userId: string) => [...queryKeys.settings.all, 'privacy', userId] as const,
  },
  
  // Health & System
  health: {
    all: ['health'] as const,
    db: () => [...queryKeys.health.all, 'db'] as const,
    sync: (userId: string) => [...queryKeys.health.all, 'sync', userId] as const,
  },
} as const;

// =========================================================================
// MUTATION KEYS
// =========================================================================

export const mutationKeys = {
  // Diary Mutations
  diary: {
    create: () => ['diary-mutation', 'create'] as const,
    update: (id: string) => ['diary-mutation', 'update', id] as const,
    delete: (id: string) => ['diary-mutation', 'delete', id] as const,
  },
  
  // Gratitude Mutations
  gratitude: {
    create: () => ['gratitude-mutation', 'create'] as const,
    update: (id: string) => ['gratitude-mutation', 'update', id] as const,
    delete: (id: string) => ['gratitude-mutation', 'delete', id] as const,
  },
  
  // Session Mutations
  sessions: {
    create: () => ['sessions-mutation', 'create'] as const,
    update: (id: string) => ['sessions-mutation', 'update', id] as const,
    delete: (id: string) => ['sessions-mutation', 'delete', id] as const,
  },
  
  // Dream Mutations (Phase 2)
  dreams: {
    create: () => ['dreams-mutation', 'create'] as const,
    update: (id: string) => ['dreams-mutation', 'update', id] as const,
    delete: (id: string) => ['dreams-mutation', 'delete', id] as const,
  },
  
  // Profile Mutations
  profile: {
    update: (userId: string) => ['profile-mutation', 'update', userId] as const,
  },
  
  // Auth Mutations
  auth: {
    signIn: () => ['auth-mutation', 'signIn'] as const,
    signOut: () => ['auth-mutation', 'signOut'] as const,
    signUp: () => ['auth-mutation', 'signUp'] as const,
  },
} as const;

// =========================================================================
// UTILITY FUNCTIONS
// =========================================================================

/**
 * Normalisiert Parameter für stabile Query-Keys
 * Sortiert Objekt-Keys, entfernt undefined-Werte
 */
function normalizeParams(params?: Record<string, any> | null): Record<string, any> | null {
  if (!params || typeof params !== 'object') return null;
  
  const normalized: Record<string, any> = {};
  const sortedKeys = Object.keys(params).sort();
  
  for (const key of sortedKeys) {
    const value = params[key];
    if (value !== undefined && value !== null) {
      normalized[key] = value;
    }
  }
  
  return Object.keys(normalized).length > 0 ? normalized : null;
}

/**
 * Typisierte Domain-Namen für bessere DX
 */
type QueryDomain = 'diary' | 'gratitude' | 'sessions' | 'dreams' | 'realityChecks';

/**
 * Minimale, präzise Invalidation-Strategien
 */
export const invalidationStrategies = {
  
  /**
   * Invalidiert nur Listen einer Domain für einen User
   */
  invalidateUserLists(queryClient: any, domain: QueryDomain, userId: string) {
    const domainKeys = queryKeys[domain] as any;
    return queryClient.invalidateQueries({
      queryKey: domainKeys.lists(),
      predicate: (query: any) => {
        const key = query.queryKey;
        return key.includes(userId);
      }
    });
  },
  
  /**
   * Invalidiert nur Detail einer spezifischen Entität
   */
  invalidateEntityDetail(queryClient: any, domain: QueryDomain, id: string, userId: string) {
    const domainKeys = queryKeys[domain] as any;
    return queryClient.invalidateQueries({
      queryKey: domainKeys.detail(id, userId)
    });
  },
  
  /**
   * Invalidiert Stats/Analytics (teure Queries)
   */
  invalidateStats(queryClient: any, domain: QueryDomain, userId: string) {
    const domainKeys = queryKeys[domain] as any;
    if ('stats' in domainKeys) {
      return queryClient.invalidateQueries({
        queryKey: domainKeys.stats(userId)
      });
    }
  },
  
  /**
   * Soft Invalidation: Setzt Queries als stale ohne Refetch
   */
  markStale(queryClient: any, domain: QueryDomain, userId: string) {
    const domainKeys = queryKeys[domain] as any;
    return queryClient.invalidateQueries({
      queryKey: domainKeys.all,
      refetchType: 'none'
    });
  }
} as const;

/**
 * Backwards compatibility helpers (werden schrittweise entfernt)
 * @deprecated Verwende direkt queryKeys.domain.method()
 */
export function createListQueryKey(
  domain: QueryDomain,
  userId: string,
  params?: PaginationParams
) {
  console.warn('createListQueryKey ist deprecated. Verwende queryKeys.domain.list() direkt.');
  const domainKeys = queryKeys[domain] as any;
  return domainKeys.list(userId, params);
}

/**
 * @deprecated Verwende direkt queryKeys.domain.detail()
 */
export function createDetailQueryKey(
  domain: QueryDomain,
  id: string,
  userId: string
) {
  console.warn('createDetailQueryKey ist deprecated. Verwende queryKeys.domain.detail() direkt.');
  const domainKeys = queryKeys[domain] as any;
  return domainKeys.detail(id, userId);
}

/**
 * @deprecated Verwende invalidationStrategies.invalidateUserLists()
 */
export function invalidateListQueries(
  queryClient: any,
  domain: QueryDomain,
  userId: string
) {
  console.warn('invalidateListQueries ist deprecated. Verwende invalidationStrategies.invalidateUserLists().');
  return invalidationStrategies.invalidateUserLists(queryClient, domain, userId);
}

/**
 * @deprecated Verwende invalidationStrategies.invalidateEntityDetail()
 */
export function invalidateDetailQueries(
  queryClient: any,
  domain: QueryDomain,
  id: string,
  userId: string
) {
  console.warn('invalidateDetailQueries ist deprecated. Verwende invalidationStrategies.invalidateEntityDetail().');
  return invalidationStrategies.invalidateEntityDetail(queryClient, domain, id, userId);
}
