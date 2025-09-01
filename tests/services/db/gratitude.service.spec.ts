import { GratitudeService, PaginationParams, GratitudeUpsertParams } from '../../../services/db/gratitude.service';
import { supabase } from '../../../services/db/supabase.client';
import { GratitudeEntry, DailyGratitude } from '../../../models/gratitude.model';

// Mock Supabase-Client
jest.mock('../../../services/db/supabase.client', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn()
  }
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('GratitudeService', () => {
  const mockUserId = 'user-123';
  const mockEntryId = 'gratitude-123';
  const mockDate = '2024-01-15';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getByDate', () => {
    it('sollte einen Gratitude-Eintrag nach Datum und Typ abrufen', async () => {
      const mockResponse = {
        id: mockEntryId,
        user_id: mockUserId,
        date: mockDate,
        morning: true,
        text: 'Morning gratitude',
        created_at: '2024-01-15T08:00:00.000Z',
        updated_at: '2024-01-15T08:00:00.000Z'
      };

      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
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
        })
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      } as any);

      const result = await GratitudeService.getByDate(mockDate, mockUserId, true);

      expect(result).toEqual({
        id: mockEntryId,
        userId: mockUserId,
        date: mockDate,
        morning: true,
        text: 'Morning gratitude',
        createdAt: '2024-01-15T08:00:00.000Z',
        updatedAt: '2024-01-15T08:00:00.000Z'
      });
    });

    it('sollte null zurückgeben wenn Eintrag nicht gefunden', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
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
        })
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      } as any);

      const result = await GratitudeService.getByDate(mockDate, mockUserId, true);
      expect(result).toBeNull();
    });
  });

  describe('getByDateFull', () => {
    it('sollte beide Einträge (morgens + abends) für ein Datum abrufen', async () => {
      const mockResponses = [
        {
          id: 'morning-123',
          user_id: mockUserId,
          date: mockDate,
          morning: true,
          text: 'Morning gratitude',
          created_at: '2024-01-15T08:00:00.000Z',
          updated_at: '2024-01-15T08:00:00.000Z'
        },
        {
          id: 'evening-123',
          user_id: mockUserId,
          date: mockDate,
          morning: false,
          text: 'Evening gratitude',
          created_at: '2024-01-15T20:00:00.000Z',
          updated_at: '2024-01-15T20:00:00.000Z'
        }
      ];

      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: mockResponses,
                error: null
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      } as any);

      const result = await GratitudeService.getByDateFull(mockDate, mockUserId);

      expect(result).toEqual({
        date: mockDate,
        morning: {
          id: 'morning-123',
          userId: mockUserId,
          date: mockDate,
          morning: true,
          text: 'Morning gratitude',
          createdAt: '2024-01-15T08:00:00.000Z',
          updatedAt: '2024-01-15T08:00:00.000Z'
        },
        evening: {
          id: 'evening-123',
          userId: mockUserId,
          date: mockDate,
          morning: false,
          text: 'Evening gratitude',
          createdAt: '2024-01-15T20:00:00.000Z',
          updatedAt: '2024-01-15T20:00:00.000Z'
        }
      });
    });

    it('sollte leere Struktur zurückgeben wenn keine Einträge existieren', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      } as any);

      const result = await GratitudeService.getByDateFull(mockDate, mockUserId);

      expect(result).toEqual({
        date: mockDate,
        morning: undefined,
        evening: undefined
      });
    });
  });

  describe('upsert', () => {
    it('sollte neuen Eintrag erstellen wenn keiner existiert', async () => {
      const upsertParams: GratitudeUpsertParams = {
        userId: mockUserId,
        date: mockDate,
        morning: true,
        text: 'New morning gratitude'
      };

      const mockResponse = {
        id: mockEntryId,
        user_id: mockUserId,
        date: mockDate,
        morning: true,
        text: 'New morning gratitude',
        created_at: '2024-01-15T08:00:00.000Z',
        updated_at: '2024-01-15T08:00:00.000Z'
      };

      // Mock getByDate für nicht existierenden Eintrag
      const mockGetByDate = jest.spyOn(GratitudeService, 'getByDate').mockResolvedValue(null);

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

      const result = await GratitudeService.upsert(upsertParams);

      expect(result).toEqual({
        id: mockEntryId,
        userId: mockUserId,
        date: mockDate,
        morning: true,
        text: 'New morning gratitude',
        createdAt: '2024-01-15T08:00:00.000Z',
        updatedAt: '2024-01-15T08:00:00.000Z'
      });

      expect(mockGetByDate).toHaveBeenCalledWith(mockDate, mockUserId, true);
      mockGetByDate.mockRestore();
    });

    it('sollte existierenden Eintrag aktualisieren', async () => {
      const upsertParams: GratitudeUpsertParams = {
        userId: mockUserId,
        date: mockDate,
        morning: true,
        text: 'Updated morning gratitude'
      };

      const existingEntry: GratitudeEntry = {
        id: mockEntryId,
        userId: mockUserId,
        date: mockDate,
        morning: true,
        text: 'Old morning gratitude',
        createdAt: '2024-01-15T08:00:00.000Z',
        updatedAt: '2024-01-15T08:00:00.000Z'
      };

      const updatedResponse = {
        ...existingEntry,
        text: 'Updated morning gratitude',
        updated_at: '2024-01-15T09:00:00.000Z'
      };

      // Mock getByDate für existierenden Eintrag
      const mockGetByDate = jest.spyOn(GratitudeService, 'getByDate').mockResolvedValue(existingEntry);

      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: updatedResponse,
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

      const result = await GratitudeService.upsert(upsertParams);

      expect(result.text).toBe('Updated morning gratitude');
      expect(mockGetByDate).toHaveBeenCalledWith(mockDate, mockUserId, true);
      mockGetByDate.mockRestore();
    });

    it('sollte Merge-Semantik korrekt anwenden - vorhandene Felder beibehalten', async () => {
      const upsertParams: GratitudeUpsertParams = {
        userId: mockUserId,
        date: mockDate,
        morning: true,
        text: 'Updated text only'
      };

      const existingEntry: GratitudeEntry = {
        id: mockEntryId,
        userId: mockUserId,
        date: mockDate,
        morning: true,
        text: 'Old text',
        createdAt: '2024-01-15T08:00:00.000Z',
        updatedAt: '2024-01-15T08:00:00.000Z'
      };

      // Mock getByDate für existierenden Eintrag
      const mockGetByDate = jest.spyOn(GratitudeService, 'getByDate').mockResolvedValue(existingEntry);

      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { ...existingEntry, text: 'Updated text only' },
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

      await GratitudeService.upsert(upsertParams);

      // Prüfe dass nur text und updated_at aktualisiert werden
      expect(mockUpdate).toHaveBeenCalledWith({
        text: 'Updated text only',
        updated_at: expect.any(String)
      });

      mockGetByDate.mockRestore();
    });
  });

  describe('upsertAtomic', () => {
    it('sollte atomischen Upsert über RPC durchführen', async () => {
      const upsertParams: GratitudeUpsertParams = {
        userId: mockUserId,
        date: mockDate,
        morning: true,
        text: 'Atomic gratitude'
      };

      const mockResponse = {
        id: mockEntryId,
        user_id: mockUserId,
        date: mockDate,
        morning: true,
        text: 'Atomic gratitude',
        created_at: '2024-01-15T08:00:00.000Z',
        updated_at: '2024-01-15T08:00:00.000Z'
      };

      mockSupabase.rpc.mockResolvedValue({
        data: mockResponse,
        error: null
      });

      const result = await GratitudeService.upsertAtomic(upsertParams);

      expect(result).toEqual({
        id: mockEntryId,
        userId: mockUserId,
        date: mockDate,
        morning: true,
        text: 'Atomic gratitude',
        createdAt: '2024-01-15T08:00:00.000Z',
        updatedAt: '2024-01-15T08:00:00.000Z'
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('upsert_gratitude_entry', {
        p_user_id: mockUserId,
        p_date: mockDate,
        p_morning: true,
        p_text: 'Atomic gratitude',
        p_updated_at: expect.any(String)
      });
    });

    it('sollte zu normalem Upsert fallback bei RPC-Fehler', async () => {
      const upsertParams: GratitudeUpsertParams = {
        userId: mockUserId,
        date: mockDate,
        morning: true,
        text: 'Fallback gratitude'
      };

      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC function not found' }
      });

      // Mock normalen Upsert
      const mockUpsert = jest.spyOn(GratitudeService, 'upsert').mockResolvedValue({
        id: mockEntryId,
        userId: mockUserId,
        date: mockDate,
        morning: true,
        text: 'Fallback gratitude',
        createdAt: '2024-01-15T08:00:00.000Z',
        updatedAt: '2024-01-15T08:00:00.000Z'
      });

      const result = await GratitudeService.upsertAtomic(upsertParams);

      expect(result).toBeDefined();
      expect(mockUpsert).toHaveBeenCalledWith(upsertParams);
      mockUpsert.mockRestore();
    });
  });

  describe('softDeleteByDate', () => {
    it('sollte spezifischen Eintrag soft-deleten', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              is: jest.fn().mockResolvedValue({
                error: null
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        update: mockUpdate
      } as any);

      await GratitudeService.softDeleteByDate(mockDate, mockUserId, true);

      expect(mockUpdate).toHaveBeenCalledWith({
        deleted_at: expect.any(String),
        updated_at: expect.any(String)
      });
    });
  });

  describe('softDeleteByDateFull', () => {
    it('sollte beide Einträge eines Tages soft-deleten', async () => {
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

      await GratitudeService.softDeleteByDateFull(mockDate, mockUserId);

      expect(mockUpdate).toHaveBeenCalledWith({
        deleted_at: expect.any(String),
        updated_at: expect.any(String)
      });
    });
  });

  describe('list', () => {
    it('sollte paginierte Gratitude-Liste abrufen', async () => {
      const mockEntries = [
        {
          id: 'entry-1',
          user_id: mockUserId,
          date: '2024-01-15',
          morning: true,
          text: 'Morning entry',
          created_at: '2024-01-15T08:00:00.000Z',
          updated_at: '2024-01-15T08:00:00.000Z'
        },
        {
          id: 'entry-2',
          user_id: mockUserId,
          date: '2024-01-14',
          morning: false,
          text: 'Evening entry',
          created_at: '2024-01-14T20:00:00.000Z',
          updated_at: '2024-01-14T20:00:00.000Z'
        }
      ];

      const mockSelect = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
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
        })
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      } as any);

      const result = await GratitudeService.list(mockUserId);

      expect(result.data).toHaveLength(2);
      expect(result.pagination.hasMore).toBe(false);
    });
  });

  describe('listDaily', () => {
    it('sollte paginierte tägliche Übersichten abrufen', async () => {
      const mockEntries = [
        {
          id: 'morning-1',
          user_id: mockUserId,
          date: '2024-01-15',
          morning: true,
          text: 'Morning gratitude',
          created_at: '2024-01-15T08:00:00.000Z',
          updated_at: '2024-01-15T08:00:00.000Z'
        },
        {
          id: 'evening-1',
          user_id: mockUserId,
          date: '2024-01-15',
          morning: false,
          text: 'Evening gratitude',
          created_at: '2024-01-15T20:00:00.000Z',
          updated_at: '2024-01-15T20:00:00.000Z'
        }
      ];

      // Mock list-Methode
      const mockList = jest.spyOn(GratitudeService, 'list').mockResolvedValue({
        data: mockEntries.map(entry => ({
          id: entry.id,
          userId: entry.user_id,
          date: entry.date,
          morning: entry.morning,
          text: entry.text,
          createdAt: entry.created_at,
          updatedAt: entry.updated_at
        })),
        pagination: {
          hasMore: false
        }
      });

      const result = await GratitudeService.listDaily(mockUserId);

      expect(result.data).toHaveLength(1); // Ein Tag mit zwei Einträgen
      expect(result.data[0].date).toBe('2024-01-15');
      expect(result.data[0].morning).toBeDefined();
      expect(result.data[0].evening).toBeDefined();

      mockList.mockRestore();
    });
  });

  describe('getStats', () => {
    it('sollte Gratitude-Statistiken berechnen', async () => {
      const mockEntries = [
        {
          text: 'First gratitude entry',
          date: '2024-01-15',
          morning: true
        },
        {
          text: 'Second gratitude entry with more words',
          date: '2024-01-15',
          morning: false
        },
        {
          text: 'Third entry',
          date: '2024-01-16',
          morning: true
        }
      ];

      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockEntries,
              error: null
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      } as any);

      const result = await GratitudeService.getStats(mockUserId);

      expect(result.totalEntries).toBe(3);
      expect(result.totalDays).toBe(2);
      expect(result.completeDays).toBe(1); // Nur 2024-01-15 hat beide Einträge
      expect(result.completionRate).toBe(50); // 1 von 2 Tagen vollständig
      expect(result.averageWordsPerEntry).toBe(4); // (3 + 5 + 2) / 3 = 3.33 gerundet
      expect(result.entriesThisMonth).toBe(3);
      expect(result.currentStreak).toBe(2); // Zwei aufeinanderfolgende Tage
    });
  });

  describe('canCreateForToday', () => {
    beforeEach(() => {
      // Mock Date für konsistente Tests
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-15T10:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('sollte true zurückgeben für morgens zwischen 05:00-12:00', () => {
      jest.setSystemTime(new Date('2024-01-15T08:00:00.000Z'));
      
      const result = GratitudeService.canCreateForToday('2024-01-15', true);
      expect(result).toBe(true);
    });

    it('sollte false zurückgeben für morgens außerhalb der Zeit', () => {
      jest.setSystemTime(new Date('2024-01-15T14:00:00.000Z'));
      
      const result = GratitudeService.canCreateForToday('2024-01-15', true);
      expect(result).toBe(false);
    });

    it('sollte true zurückgeben für abends zwischen 18:00-02:00', () => {
      jest.setSystemTime(new Date('2024-01-15T20:00:00.000Z'));
      
      const result = GratitudeService.canCreateForToday('2024-01-15', false);
      expect(result).toBe(true);
    });

    it('sollte false zurückgeben für abends außerhalb der Zeit', () => {
      jest.setSystemTime(new Date('2024-01-15T14:00:00.000Z'));
      
      const result = GratitudeService.canCreateForToday('2024-01-15', false);
      expect(result).toBe(false);
    });

    it('sollte false zurückgeben für zukünftige Daten', () => {
      const result = GratitudeService.canCreateForToday('2024-01-16', true);
      expect(result).toBe(false);
    });
  });

  describe('Unique-Pfad Tests', () => {
    it('sollte Unique-Constraint für (user_id, date, morning) respektieren', async () => {
      const upsertParams: GratitudeUpsertParams = {
        userId: mockUserId,
        date: mockDate,
        morning: true,
        text: 'Duplicate entry'
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

      // Mock getByDate für nicht existierenden Eintrag
      jest.spyOn(GratitudeService, 'getByDate').mockResolvedValue(null);

      await expect(GratitudeService.upsert(upsertParams)).rejects.toThrow(
        'Eintrag für diesen Tag und Zeitpunkt existiert bereits'
      );
    });
  });

  describe('Offline-Retry Tests', () => {
    it('sollte Netzwerkfehler graceful behandeln', async () => {
      const upsertParams: GratitudeUpsertParams = {
        userId: mockUserId,
        date: mockDate,
        morning: true,
        text: 'Offline entry'
      };

      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockRejectedValue(new Error('Network error'))
        })
      });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert
      } as any);

      // Mock getByDate für nicht existierenden Eintrag
      jest.spyOn(GratitudeService, 'getByDate').mockResolvedValue(null);

      await expect(GratitudeService.upsert(upsertParams)).rejects.toThrow('Network error');
    });
  });
});
