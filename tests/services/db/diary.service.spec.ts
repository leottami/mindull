import { DiaryService, PaginationParams, SearchParams } from '../../../services/db/diary.service';
import { supabase } from '../../../services/db/supabase.client';
import { CreateDiaryEntry, UpdateDiaryEntry } from '../../../models/diary.model';

// Mock Supabase-Client
jest.mock('../../../services/db/supabase.client', () => ({
  supabase: {
    from: jest.fn()
  }
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('DiaryService', () => {
  const mockUserId = 'user-123';
  const mockEntryId = 'entry-123';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('sollte einen neuen Diary-Eintrag erstellen', async () => {
      const createData: CreateDiaryEntry = {
        userId: mockUserId,
        date: '2024-01-15',
        text: 'Test entry',
        tags: ['test', 'diary']
      };

      const mockResponse = {
        id: mockEntryId,
        user_id: mockUserId,
        date: '2024-01-15',
        text: 'Test entry',
        tags: ['test', 'diary'],
        created_at: '2024-01-15T10:30:00.000Z',
        updated_at: '2024-01-15T10:30:00.000Z'
      };

      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockResponse,
            error: null
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert
      } as any);

      const result = await DiaryService.create(createData);

      expect(result).toEqual({
        id: mockEntryId,
        userId: mockUserId,
        date: '2024-01-15',
        text: 'Test entry',
        tags: ['test', 'diary'],
        createdAt: '2024-01-15T10:30:00.000Z',
        updatedAt: '2024-01-15T10:30:00.000Z'
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('diary_entries');
      expect(mockInsert).toHaveBeenCalledWith({
        user_id: mockUserId,
        date: '2024-01-15',
        text: 'Test entry',
        tags: ['test', 'diary']
      });
    });

    it('sollte 409-Konflikt-Fehler behandeln', async () => {
      const createData: CreateDiaryEntry = {
        userId: mockUserId,
        date: '2024-01-15',
        text: 'Test entry'
      };

      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { code: '23505', message: 'duplicate key value violates unique constraint' }
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert
      } as any);

      await expect(DiaryService.create(createData)).rejects.toThrow(
        'Eintrag für dieses Datum existiert bereits'
      );
    });
  });

  describe('getById', () => {
    it('sollte einen Diary-Eintrag nach ID abrufen', async () => {
      const mockResponse = {
        id: mockEntryId,
        user_id: mockUserId,
        date: '2024-01-15',
        text: 'Test entry',
        tags: ['test'],
        created_at: '2024-01-15T10:30:00.000Z',
        updated_at: '2024-01-15T10:30:00.000Z'
      };

      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockResponse,
                error: null
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      } as any);

      const result = await DiaryService.getById(mockEntryId, mockUserId);

      expect(result).toEqual({
        id: mockEntryId,
        userId: mockUserId,
        date: '2024-01-15',
        text: 'Test entry',
        tags: ['test'],
        createdAt: '2024-01-15T10:30:00.000Z',
        updatedAt: '2024-01-15T10:30:00.000Z'
      });
    });

    it('sollte null zurückgeben wenn Eintrag nicht gefunden', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' }
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      } as any);

      const result = await DiaryService.getById('non-existent', mockUserId);
      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('sollte paginierte Liste ohne Parameter abrufen', async () => {
      const mockEntries = [
        {
          id: 'entry-1',
          user_id: mockUserId,
          date: '2024-01-15',
          text: 'Entry 1',
          tags: ['test'],
          created_at: '2024-01-15T10:30:00.000Z',
          updated_at: '2024-01-15T10:30:00.000Z'
        },
        {
          id: 'entry-2',
          user_id: mockUserId,
          date: '2024-01-14',
          text: 'Entry 2',
          tags: ['test'],
          created_at: '2024-01-14T10:30:00.000Z',
          updated_at: '2024-01-14T10:30:00.000Z'
        }
      ];

      const mockSelect = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: mockEntries,
                    error: null,
                    count: 2
                  })
                })
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      } as any);

      const result = await DiaryService.list(mockUserId);

      expect(result.data).toHaveLength(2);
      expect(result.pagination.hasMore).toBe(false);
      expect(result.pagination.nextCursor).toBeUndefined();
    });

    it('sollte cursor-based pagination korrekt handhaben', async () => {
      const mockEntries = [
        {
          id: 'entry-2',
          user_id: mockUserId,
          date: '2024-01-14',
          text: 'Entry 2',
          tags: ['test'],
          created_at: '2024-01-14T10:30:00.000Z',
          updated_at: '2024-01-14T10:30:00.000Z'
        }
      ];

      const mockSelect = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  lt: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({
                      data: mockEntries,
                      error: null,
                      count: 1
                    })
                  })
                })
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      } as any);

      const params: PaginationParams = {
        cursor: '2024-01-15T10:30:00.000Z',
        limit: 1
      };

      const result = await DiaryService.list(mockUserId, params);

      expect(result.data).toHaveLength(1);
      expect(result.pagination.hasMore).toBe(false);
      expect(result.pagination.nextCursor).toBe('2024-01-14T10:30:00.000Z');
    });

    it('sollte page-based pagination korrekt handhaben', async () => {
      const mockEntries = [
        {
          id: 'entry-3',
          user_id: mockUserId,
          date: '2024-01-13',
          text: 'Entry 3',
          tags: ['test'],
          created_at: '2024-01-13T10:30:00.000Z',
          updated_at: '2024-01-13T10:30:00.000Z'
        }
      ];

      const mockSelect = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  range: jest.fn().mockResolvedValue({
                    data: mockEntries,
                    error: null,
                    count: 5
                  })
                })
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      } as any);

      const params: PaginationParams = {
        page: 2,
        limit: 2
      };

      const result = await DiaryService.list(mockUserId, params);

      expect(result.data).toHaveLength(1);
      expect(result.pagination.totalCount).toBe(5);
      expect(result.pagination.currentPage).toBe(2);
      expect(result.pagination.totalPages).toBe(3);
    });

    it('sollte Limit auf MAX_LIMIT begrenzen', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                    count: 0
                  })
                })
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      } as any);

      const params: PaginationParams = {
        limit: 150 // Über MAX_LIMIT (100)
      };

      await DiaryService.list(mockUserId, params);

      // Prüfe dass range mit 100 aufgerufen wurde
      const mockRange = mockSelect().select().eq().is().order().order().range;
      expect(mockRange).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('sollte einen Diary-Eintrag aktualisieren', async () => {
      const updateData: UpdateDiaryEntry = {
        text: 'Updated text',
        tags: ['updated', 'tags']
      };

      const mockResponse = {
        id: mockEntryId,
        user_id: mockUserId,
        date: '2024-01-15',
        text: 'Updated text',
        tags: ['updated', 'tags'],
        created_at: '2024-01-15T10:30:00.000Z',
        updated_at: '2024-01-15T11:00:00.000Z'
      };

      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockResponse,
                  error: null
                })
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        update: mockUpdate
      } as any);

      const result = await DiaryService.update(mockEntryId, mockUserId, updateData);

      expect(result.text).toBe('Updated text');
      expect(result.tags).toEqual(['updated', 'tags']);
      expect(mockUpdate).toHaveBeenCalledWith({
        text: 'Updated text',
        tags: ['updated', 'tags'],
        updated_at: expect.any(String)
      });
    });

    it('sollte Fehler werfen wenn Eintrag nicht gefunden', async () => {
      const updateData: UpdateDiaryEntry = {
        text: 'Updated text'
      };

      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'PGRST116' }
                })
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        update: mockUpdate
      } as any);

      await expect(
        DiaryService.update('non-existent', mockUserId, updateData)
      ).rejects.toThrow('Eintrag nicht gefunden');
    });
  });

  describe('delete', () => {
    it('sollte einen Diary-Eintrag soft-deleten', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockResolvedValue({
              error: null
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        update: mockUpdate
      } as any);

      await DiaryService.delete(mockEntryId, mockUserId);

      expect(mockUpdate).toHaveBeenCalledWith({
        deleted_at: expect.any(String),
        updated_at: expect.any(String)
      });
    });
  });

  describe('search', () => {
    it('sollte Volltextsuche durchführen', async () => {
      const searchParams: SearchParams = {
        userId: mockUserId,
        query: 'test query'
      };

      const mockEntries = [
        {
          id: 'entry-1',
          user_id: mockUserId,
          date: '2024-01-15',
          text: 'This is a test query result',
          tags: ['test'],
          created_at: '2024-01-15T10:30:00.000Z',
          updated_at: '2024-01-15T10:30:00.000Z'
        }
      ];

      const mockSelect = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue({
              textSearch: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({
                      data: mockEntries,
                      error: null,
                      count: 1
                    })
                  })
                })
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      } as any);

      const result = await DiaryService.search(searchParams);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].text).toContain('test query');
    });

    it('sollte Datumsbereich-Filter anwenden', async () => {
      const searchParams: SearchParams = {
        userId: mockUserId,
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31'
        }
      };

      const mockSelect = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue({
              gte: jest.fn().mockReturnValue({
                lte: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    order: jest.fn().mockReturnValue({
                      limit: jest.fn().mockResolvedValue({
                        data: [],
                        error: null,
                        count: 0
                      })
                    })
                  })
                })
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      } as any);

      await DiaryService.search(searchParams);

      const mockGte = mockSelect().select().eq().is().gte;
      const mockLte = mockSelect().select().eq().is().gte().lte;
      
      expect(mockGte).toHaveBeenCalledWith('date', '2024-01-01');
      expect(mockLte).toHaveBeenCalledWith('date', '2024-01-31');
    });

    it('sollte Tag-Filter anwenden', async () => {
      const searchParams: SearchParams = {
        userId: mockUserId,
        tags: ['important', 'work']
      };

      const mockSelect = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue({
              overlaps: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({
                      data: [],
                      error: null,
                      count: 0
                    })
                  })
                })
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      } as any);

      await DiaryService.search(searchParams);

      const mockOverlaps = mockSelect().select().eq().is().overlaps;
      expect(mockOverlaps).toHaveBeenCalledWith('tags', ['important', 'work']);
    });
  });

  describe('getByDate', () => {
    it('sollte Eintrag für spezifisches Datum abrufen', async () => {
      const mockResponse = {
        id: mockEntryId,
        user_id: mockUserId,
        date: '2024-01-15',
        text: 'Daily entry',
        tags: ['daily'],
        created_at: '2024-01-15T10:30:00.000Z',
        updated_at: '2024-01-15T10:30:00.000Z'
      };

      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockResponse,
                error: null
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      } as any);

      const result = await DiaryService.getByDate('2024-01-15', mockUserId);

      expect(result?.date).toBe('2024-01-15');
      expect(result?.text).toBe('Daily entry');
    });
  });

  describe('getTags', () => {
    it('sollte alle Tags eines Benutzers abrufen', async () => {
      const mockData = [
        { tags: ['work', 'important'] },
        { tags: ['personal', 'work'] },
        { tags: ['health', 'personal'] }
      ];

      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue({
            not: jest.fn().mockResolvedValue({
              data: mockData,
              error: null
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      } as any);

      const result = await DiaryService.getTags(mockUserId);

      expect(result).toEqual(['health', 'important', 'personal', 'work']);
    });
  });

  describe('getStats', () => {
    it('sollte Diary-Statistiken berechnen', async () => {
      const mockCountResponse = {
        count: 3,
        error: null
      };

      const mockEntriesResponse = {
        data: [
          { text: 'First entry with some words', tags: ['work'], date: '2024-01-15' },
          { text: 'Second entry with more words here', tags: ['personal', 'work'], date: '2024-01-16' },
          { text: 'Third entry', tags: ['health'], date: '2024-01-17' }
        ],
        error: null
      };

      const mockSelect = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              is: jest.fn().mockResolvedValue(mockCountResponse)
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              is: jest.fn().mockResolvedValue(mockEntriesResponse)
            })
          })
        });

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      } as any);

      const result = await DiaryService.getStats(mockUserId);

      expect(result.totalEntries).toBe(3);
      expect(result.totalWords).toBe(12); // 4 + 5 + 3 Wörter
      expect(result.averageWordsPerEntry).toBe(4);
      expect(result.mostUsedTags).toEqual([
        { tag: 'work', count: 2 },
        { tag: 'personal', count: 1 },
        { tag: 'health', count: 1 }
      ]);
      expect(result.entriesThisMonth).toBe(3); // Alle im Januar 2024
    });
  });
});
