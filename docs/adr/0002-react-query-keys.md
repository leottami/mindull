# ADR-0002: React Query Keys Struktur & Cache-Strategien

**Status:** Accepted  
**Date:** 2024-01-15  
**Authors:** Engineering Team  

## Kontext

React Query benötigt stabile, deterministische Query-Keys für optimales Caching und präzise Invalidations. Ohne einheitliche Struktur entstehen:

- Doppelte Fetches durch inkonsistente Keys
- Übermäßige Invalidations (Performance-Impact)
- Schwer debugbare Cache-Issues
- Inkonsistente staleTime-Strategien

## Entscheidung

### 1. Hierarchische Key-Struktur

```typescript
// Stabile Basis-Domains
['diary'] → ['diary', 'list'] → ['diary', 'list', userId, params]
['sessions'] → ['sessions', 'detail'] → ['sessions', 'detail', id, userId]
```

**Regeln:**
- Domains als Konstanten (`diary`, `sessions`, etc.)
- Operations als zweite Ebene (`list`, `detail`, `search`)
- userId/entityId/params am Ende
- Deterministisch durch `normalizeParams()` (sortierte Keys, keine undefined)

### 2. Differentielle Cache-Zeiten

```typescript
export const CACHE_TIMES = {
  LIST_STALE: 3 * 60 * 1000,     // 3min - häufig geändert
  DETAIL_STALE: 10 * 60 * 1000,  // 10min - seltener geändert  
  STATS_STALE: 15 * 60 * 1000,   // 15min - aufwändig zu berechnen
  SEARCH_STALE: 2 * 60 * 1000,   // 2min - interaktiv
}
```

**Begründung:** Listen ändern sich häufiger als Details, Stats sind teuer zu berechnen.

### 3. Minimale Invalidation-Strategien

```typescript
// ❌ Schlecht: Invalidiert alle Diary-Queries
queryClient.invalidateQueries({ queryKey: ['diary'] });

// ✅ Gut: Invalidiert nur Listen eines Users
invalidationStrategies.invalidateUserLists(queryClient, 'diary', userId);

// ✅ Gut: Invalidiert nur spezifische Entity
invalidationStrategies.invalidateEntityDetail(queryClient, 'diary', id, userId);
```

**Vorteile:** Reduziert Netzwerk-Requests, bessere UX durch weniger Loading-States.

### 4. Typisierte Domains

```typescript
type QueryDomain = 'diary' | 'gratitude' | 'sessions' | 'dreams' | 'realityChecks';
```

Verhindert Typos und ermöglicht bessere IDE-Unterstützung.

## Implementierung

### Query-Key-Erstellung

```typescript
// Automatische Normalisierung für Stabilität
queryKeys.diary.list(userId, { page: 2, limit: 20 })
// → ['diary', 'list', 'user-123', { limit: 20, page: 2 }]

queryKeys.sessions.stats(userId, { startDate: '2024-01-01', method: 'box' })
// → ['sessions', 'stats', 'user-123', { method: 'box', startDate: '2024-01-01' }]
```

### Hook-Integration

```typescript
// staleTime automatisch basierend auf Query-Typ
export function useDiaryList(userId: string, params?: PaginationParams) {
  return useQuery({
    queryKey: queryKeys.diary.list(userId, params),
    queryFn: () => DiaryService.list(userId, params),
    staleTime: CACHE_TIMES.LIST_STALE,  // 3min
    gcTime: CACHE_TIMES.LIST_GC,        // 10min
  });
}

export function useDiaryEntry(id: string, userId: string) {
  return useQuery({
    queryKey: queryKeys.diary.detail(id, userId),
    queryFn: () => DiaryService.getById(id, userId),
    staleTime: CACHE_TIMES.DETAIL_STALE, // 10min
    gcTime: CACHE_TIMES.DETAIL_GC,       // 30min
  });
}
```

## Alternativen

1. **Flache Keys**: `['diary-list-user-123']`  
   ❌ Schwer zu invalidieren, keine Hierarchie

2. **React Query Key Factory**: Externe Library  
   ❌ Zusätzliche Dependency, weniger Kontrolle

3. **Enum-basierte Keys**: `QueryKeys.DIARY_LIST`  
   ❌ Weniger flexibel für Parameter

## Konsequenzen

### Positive

- **Performance:** Weniger redundante Fetches durch stabile Keys
- **Debugging:** Klare Cache-Struktur in DevTools
- **Wartbarkeit:** Zentrale Key-Verwaltung
- **TypeScript:** Vollständige Typisierung

### Negative

- **Migration:** Bestehende Hooks müssen angepasst werden
- **Breaking Change:** Alte Helper-Funktionen deprecated
- **Komplexität:** Mehr Struktur = mehr Code

### Migrations-Plan

1. **Phase 1:** Neue Query-Keys parallel einführen (✅ Erledigt)
2. **Phase 2:** Hooks schrittweise migrieren
3. **Phase 3:** Deprecated Helper entfernen
4. **Phase 4:** Tests aktualisieren

## Messung

```typescript
// Metrics für Cache-Effizienz
const cacheMetrics = {
  hitRate: successfulCacheHits / totalQueries,
  avgResponseTime: totalResponseTime / totalQueries,
  invalidationCount: totalInvalidations / timeWindow
};

// Ziele:
// - hitRate > 80%
// - avgResponseTime < 100ms für cached data
// - invalidationCount < 10/min
```

## Referenzen

- [React Query Keys Best Practices](https://tkdodo.eu/blog/effective-react-query-keys)
- [Mindull .cursorrules](../.cursorrules) - Offline-First & Query Strategien
- [MVP Performance KPIs](../PRD.brief.md#kpis-mvp-leitplanken)
