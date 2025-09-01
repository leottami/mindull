/**
 * Tests für Query-Keys: Determinismus & Keine Duplikate
 */

import { queryKeys, mutationKeys, invalidationStrategies, CACHE_TIMES } from '../../data/queryKeys';

describe('queryKeys', () => {
  const mockUserId = 'user-123';
  const mockId = 'entry-456';
  const mockDate = '2024-01-15';

  describe('Determinismus', () => {
    it('sollte identische Keys für identische Parameter erzeugen', () => {
      const params1 = { page: 1, limit: 20 };
      const params2 = { page: 1, limit: 20 };

      const key1 = queryKeys.diary.list(mockUserId, params1);
      const key2 = queryKeys.diary.list(mockUserId, params2);

      expect(key1).toEqual(key2);
    });

    it('sollte identische Keys trotz Parameter-Reihenfolge erzeugen', () => {
      const params1 = { page: 1, limit: 20, cursor: 'abc' };
      const params2 = { cursor: 'abc', limit: 20, page: 1 };

      const key1 = queryKeys.diary.list(mockUserId, params1);
      const key2 = queryKeys.diary.list(mockUserId, params2);

      expect(key1).toEqual(key2);
    });

    it('sollte undefined/null Parameter ignorieren', () => {
      const params1 = { page: 1, limit: 20 };
      const params2 = { page: 1, limit: 20, cursor: undefined, extra: null };

      const key1 = queryKeys.diary.list(mockUserId, params1);
      const key2 = queryKeys.diary.list(mockUserId, params2);

      expect(key1).toEqual(key2);
    });

    it('sollte verschiedene Keys für verschiedene Parameter erzeugen', () => {
      const key1 = queryKeys.diary.list(mockUserId, { page: 1 });
      const key2 = queryKeys.diary.list(mockUserId, { page: 2 });

      expect(key1).not.toEqual(key2);
    });
  });

  describe('Hierarchie & Struktur', () => {
    it('sollte korrekte Hierarchie für Domain-Keys haben', () => {
      expect(queryKeys.diary.all).toEqual(['diary']);
      expect(queryKeys.sessions.all).toEqual(['sessions']);
      expect(queryKeys.dreams.all).toEqual(['dreams']);
    });

    it('sollte Listen-Keys als Untermenge von Domain-Keys haben', () => {
      const diaryLists = queryKeys.diary.lists();
      const diaryAll = queryKeys.diary.all;

      expect(diaryLists).toEqual([...diaryAll, 'list']);
    });

    it('sollte Detail-Keys als Untermenge von Domain-Keys haben', () => {
      const diaryDetails = queryKeys.diary.details();
      const diaryAll = queryKeys.diary.all;

      expect(diaryDetails).toEqual([...diaryAll, 'detail']);
    });

    it('sollte spezifische Detail-Keys korrekt aufbauen', () => {
      const key = queryKeys.diary.detail(mockId, mockUserId);
      
      expect(key).toEqual(['diary', 'detail', mockId, mockUserId]);
    });

    it('sollte byDate-Keys konsistent strukturieren', () => {
      const diaryByDate = queryKeys.diary.byDate(mockDate, mockUserId);
      const sessionsbyDate = queryKeys.sessions.byDate(mockDate, mockUserId);

      expect(diaryByDate).toEqual(['diary', 'byDate', mockUserId, mockDate]);
      expect(sessionsbyDate).toEqual(['sessions', 'byDate', mockUserId, mockDate]);
    });
  });

  describe('Sessions-spezifische Keys', () => {
    it('sollte Stats-Keys mit Range-Parametern korrekt erzeugen', () => {
      const rangeParams = { startDate: '2024-01-01', method: 'box' };
      const key = queryKeys.sessions.stats(mockUserId, rangeParams);

      expect(key).toEqual([
        'sessions', 
        'stats', 
        mockUserId, 
        { method: 'box', startDate: '2024-01-01' } // normalisiert & sortiert
      ]);
    });

    it('sollte Latest-Keys eindeutig sein', () => {
      const key = queryKeys.sessions.latest(mockUserId);
      expect(key).toEqual(['sessions', 'latest', mockUserId]);
    });

    it('sollte Methods-Keys eindeutig sein', () => {
      const key = queryKeys.sessions.methods(mockUserId);
      expect(key).toEqual(['sessions', 'methods', mockUserId]);
    });
  });

  describe('Search-Keys', () => {
    it('sollte Search-Keys für Diary normalisieren', () => {
      const searchParams = {
        query: 'test',
        tags: ['important'],
        dateRange: { start: '2024-01-01', end: '2024-01-31' }
      };

      const key = queryKeys.diary.search(mockUserId, searchParams);

      expect(key).toEqual([
        'diary',
        'search',
        mockUserId,
        {
          dateRange: { start: '2024-01-01', end: '2024-01-31' },
          query: 'test',
          tags: ['important']
        }
      ]);
    });

    it('sollte Search-Keys für Dreams normalisieren', () => {
      const searchParams = {
        query: 'flying',
        tags: ['lucid']
      };

      const key = queryKeys.dreams.search(mockUserId, searchParams);

      expect(key).toEqual([
        'dreams',
        'search',
        mockUserId,
        {
          query: 'flying',
          tags: ['lucid']
        }
      ]);
    });
  });

  describe('Mutations-Keys', () => {
    it('sollte separate Mutation-Keys haben', () => {
      const createKey = mutationKeys.diary.create();
      const updateKey = mutationKeys.diary.update(mockId);
      const deleteKey = mutationKeys.diary.delete(mockId);

      expect(createKey).toEqual(['diary-mutation', 'create']);
      expect(updateKey).toEqual(['diary-mutation', 'update', mockId]);
      expect(deleteKey).toEqual(['diary-mutation', 'delete', mockId]);
    });

    it('sollte Mutation-Keys nicht mit Query-Keys überschneiden', () => {
      const queryKey = queryKeys.diary.all;
      const mutationKey = mutationKeys.diary.create();

      expect(queryKey).not.toEqual(mutationKey);
      expect(queryKey[0]).not.toEqual(mutationKey[0]);
    });
  });

  describe('keine Duplikate', () => {
    it('sollte keine doppelten Fetches durch identische Keys auslösen', () => {
      const keys = new Set();
      
      // Simuliere mehrere Hook-Aufrufe mit gleichen Parametern
      for (let i = 0; i < 10; i++) {
        const key = JSON.stringify(queryKeys.diary.list(mockUserId, { page: 1, limit: 20 }));
        keys.add(key);
      }

      expect(keys.size).toBe(1); // Nur ein einzigartiger Key
    });

    it('sollte verschiedene Keys für verschiedene User erzeugen', () => {
      const user1Key = queryKeys.diary.list('user-1', { page: 1 });
      const user2Key = queryKeys.diary.list('user-2', { page: 1 });

      expect(user1Key).not.toEqual(user2Key);
    });

    it('sollte verschiedene Keys für verschiedene Domains erzeugen', () => {
      const diaryKey = queryKeys.diary.list(mockUserId);
      const gratitudeKey = queryKeys.gratitude.list(mockUserId);
      const sessionsKey = queryKeys.sessions.list(mockUserId);

      const uniqueKeys = new Set([
        JSON.stringify(diaryKey),
        JSON.stringify(gratitudeKey),
        JSON.stringify(sessionsKey)
      ]);

      expect(uniqueKeys.size).toBe(3);
    });
  });

  describe('Invalidation-Strategien', () => {
    const mockQueryClient = {
      invalidateQueries: jest.fn(),
    };

    beforeEach(() => {
      mockQueryClient.invalidateQueries.mockClear();
    });

    it('sollte User-Listen präzise invalidieren', () => {
      invalidationStrategies.invalidateUserLists(mockQueryClient, 'diary', mockUserId);

      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['diary', 'list'],
        predicate: expect.any(Function)
      });
    });

    it('sollte Entity-Details präzise invalidieren', () => {
      invalidationStrategies.invalidateEntityDetail(mockQueryClient, 'diary', mockId, mockUserId);

      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['diary', 'detail', mockId, mockUserId]
      });
    });

    it('sollte Stats invalidieren wenn verfügbar', () => {
      invalidationStrategies.invalidateStats(mockQueryClient, 'sessions', mockUserId);

      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['sessions', 'stats', mockUserId, null]
      });
    });

    it('sollte Soft-Invalidation ohne Refetch durchführen', () => {
      invalidationStrategies.markStale(mockQueryClient, 'diary', mockUserId);

      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['diary'],
        refetchType: 'none'
      });
    });
  });

  describe('Cache-Zeiten', () => {
    it('sollte verschiedene staleTime für verschiedene Query-Typen haben', () => {
      expect(CACHE_TIMES.LIST_STALE).toBeLessThan(CACHE_TIMES.DETAIL_STALE);
      expect(CACHE_TIMES.DETAIL_STALE).toBeLessThan(CACHE_TIMES.STATS_STALE);
      expect(CACHE_TIMES.SEARCH_STALE).toBeLessThan(CACHE_TIMES.LIST_STALE);
    });

    it('sollte GC-Zeiten länger als staleTime haben', () => {
      expect(CACHE_TIMES.LIST_GC).toBeGreaterThan(CACHE_TIMES.LIST_STALE);
      expect(CACHE_TIMES.DETAIL_GC).toBeGreaterThan(CACHE_TIMES.DETAIL_STALE);
      expect(CACHE_TIMES.STATS_GC).toBeGreaterThan(CACHE_TIMES.STATS_STALE);
      expect(CACHE_TIMES.SEARCH_GC).toBeGreaterThan(CACHE_TIMES.SEARCH_STALE);
    });
  });

  describe('Edge Cases', () => {
    it('sollte mit leeren Parametern umgehen', () => {
      const key1 = queryKeys.diary.list(mockUserId, {});
      const key2 = queryKeys.diary.list(mockUserId, undefined);
      const key3 = queryKeys.diary.list(mockUserId);

      expect(key1).toEqual(key2);
      expect(key2).toEqual(key3);
    });

    it('sollte mit komplexen verschachtelten Parametern umgehen', () => {
      const complexParams = {
        dateRange: { start: '2024-01-01', end: '2024-01-31' },
        tags: ['work', 'important'],
        pagination: { page: 1, limit: 20 }
      };

      const key = queryKeys.diary.search(mockUserId, complexParams);
      
      expect(key).toContain(mockUserId);
      expect(key[key.length - 1]).toEqual({
        dateRange: { end: '2024-01-31', start: '2024-01-01' },
        pagination: { limit: 20, page: 1 },
        tags: ['work', 'important']
      });
    });

    it('sollte mit Sonderzeichen in Parametern umgehen', () => {
      const paramsWithSpecialChars = {
        query: 'test "quoted" & special chars',
        tags: ['tag-with-dash', 'tag_with_underscore']
      };

      expect(() => {
        queryKeys.diary.search(mockUserId, paramsWithSpecialChars);
      }).not.toThrow();
    });
  });
});
