import {
  // Generic Mappers
  normalizeString,
  normalizeStringArray,
  normalizeDate,
  normalizeTimestamp,
  
  // Profile Mappers
  mapToUserProfile,
  mapFromCreateUserProfile,
  mapFromUpdateUserProfile,
  
  // Diary Mappers
  mapToDiaryEntry,
  mapFromCreateDiaryEntry,
  mapFromUpdateDiaryEntry,
  mapToDiaryEntryResponse,
  
  // Gratitude Mappers
  mapToGratitudeEntry,
  mapFromCreateGratitudeEntry,
  mapFromUpdateGratitudeEntry,
  mapToGratitudeEntryResponse,
  
  // Session Mappers
  mapToBreathingSession,
  mapFromCreateBreathingSession,
  mapFromUpdateBreathingSession,
  mapToBreathingSessionResponse,
  
  // Dream Mappers
  mapToDreamEntry,
  mapFromCreateDreamEntry,
  mapFromUpdateDreamEntry,
  mapToDreamEntryResponse
} from '../../services/db/mappers';

describe('DB Mappers', () => {
  describe('Generic Mappers', () => {
    describe('normalizeString', () => {
      it('sollte Strings trimmen und lowercase machen', () => {
        expect(normalizeString('  Hello World  ')).toBe('hello world');
        expect(normalizeString('TEST')).toBe('test');
        expect(normalizeString('  ')).toBe('');
      });
    });
    
    describe('normalizeStringArray', () => {
      it('sollte Arrays von Strings normalisieren', () => {
        const input = ['  Tag1  ', 'TAG2', 'tag1', '  Tag3  '];
        const expected = ['tag1', 'tag2', 'tag3'];
        expect(normalizeStringArray(input)).toEqual(expected);
      });
      
      it('sollte leere Arrays zurückgeben bei ungültigen Inputs', () => {
        expect(normalizeStringArray(null as any)).toEqual([]);
        expect(normalizeStringArray(undefined as any)).toEqual([]);
        expect(normalizeStringArray('not an array' as any)).toEqual([]);
      });
    });
    
    describe('normalizeDate', () => {
      it('sollte gültige Daten normalisieren', () => {
        expect(normalizeDate('2024-01-15')).toBe('2024-01-15');
        expect(normalizeDate('2024-12-31')).toBe('2024-12-31');
      });
      
      it('sollte bei ungültigen Daten Fehler werfen', () => {
        expect(() => normalizeDate('invalid-date')).toThrow('Ungültiges Datum-Format');
        expect(() => normalizeDate('2024/01/15')).toThrow('Ungültiges Datum-Format');
        expect(() => normalizeDate('2024-13-01')).toThrow('Ungültiges Datum-Format');
      });
    });
    
    describe('normalizeTimestamp', () => {
      it('sollte gültige Timestamps normalisieren', () => {
        const input = '2024-01-15T10:30:00.000Z';
        const result = normalizeTimestamp(input);
        expect(result).toBe(input);
      });
      
      it('sollte bei ungültigen Timestamps Fehler werfen', () => {
        expect(() => normalizeTimestamp('invalid-timestamp')).toThrow('Ungültiger Timestamp');
        expect(() => normalizeTimestamp('2024-13-01T25:00:00.000Z')).toThrow('Ungültiger Timestamp');
      });
    });
  });
  
  describe('Profile Mappers', () => {
    const validProfileRow = {
      id: 'user-123',
      email: '  test@example.com  ',
      created_at: '2024-01-15T10:30:00.000Z',
      updated_at: '2024-01-15T10:30:00.000Z',
      reminder_morning: '08:00',
      reminder_evening: '20:00',
      reality_check_enabled: true,
      reality_check_start: '10:00',
      reality_check_end: '20:00',
      reality_check_count: 3,
      analytics_opt_in: false,
      ai_reflection_opt_in: true,
      theme: 'system'
    };
    
    describe('mapToUserProfile', () => {
      it('sollte DB-Row zu UserProfile mappen', () => {
        const result = mapToUserProfile(validProfileRow);
        
        expect(result).toEqual({
          id: 'user-123',
          email: 'test@example.com',
          createdAt: '2024-01-15T10:30:00.000Z',
          updatedAt: '2024-01-15T10:30:00.000Z',
          reminderMorning: '08:00',
          reminderEvening: '20:00',
          realityCheckEnabled: true,
          realityCheckStart: '10:00',
          realityCheckEnd: '20:00',
          realityCheckCount: 3,
          analyticsOptIn: false,
          aiReflectionOptIn: true,
          theme: 'system'
        });
      });
      
      it('sollte bei fehlenden Daten Fehler werfen', () => {
        expect(() => mapToUserProfile(null)).toThrow('Keine Daten für UserProfile');
        expect(() => mapToUserProfile(undefined)).toThrow('Keine Daten für UserProfile');
      });
      
      it('sollte bei Validierungsfehlern Fehler werfen', () => {
        const invalidRow = { ...validProfileRow, email: 'invalid-email' };
        expect(() => mapToUserProfile(invalidRow)).toThrow('Profile-Validierung fehlgeschlagen');
      });
    });
    
    describe('mapFromCreateUserProfile', () => {
      it('sollte CreateUserProfile zu DB-Row mappen', () => {
        const input = {
          email: '  test@example.com  ',
          reminderMorning: '08:00',
          reminderEvening: '20:00',
          realityCheckEnabled: true,
          realityCheckStart: '10:00',
          realityCheckEnd: '20:00',
          realityCheckCount: 3,
          analyticsOptIn: false,
          aiReflectionOptIn: true,
          theme: 'system' as const
        };
        
        const result = mapFromCreateUserProfile(input);
        
        expect(result).toEqual({
          email: 'test@example.com',
          reminder_morning: '08:00',
          reminder_evening: '20:00',
          reality_check_enabled: true,
          reality_check_start: '10:00',
          reality_check_end: '20:00',
          reality_check_count: 3,
          analytics_opt_in: false,
          ai_reflection_opt_in: true,
          theme: 'system'
        });
      });
      
      it('sollte bei Validierungsfehlern Fehler werfen', () => {
        const invalidInput = { email: 'invalid-email' };
        expect(() => mapFromCreateUserProfile(invalidInput)).toThrow('CreateProfile-Validierung fehlgeschlagen');
      });
    });
    
    describe('mapFromUpdateUserProfile', () => {
      it('sollte UpdateUserProfile zu DB-Row mappen', () => {
        const input = {
          email: '  new@example.com  ',
          theme: 'dark' as const
        };
        
        const result = mapFromUpdateUserProfile(input);
        
        expect(result).toEqual({
          email: 'new@example.com',
          theme: 'dark'
        });
      });
      
      it('sollte nur definierte Felder mappen', () => {
        const input = { email: 'test@example.com' };
        const result = mapFromUpdateUserProfile(input);
        
        expect(result).toEqual({
          email: 'test@example.com'
        });
        expect(Object.keys(result)).toHaveLength(1);
      });
    });
  });
  
  describe('Diary Mappers', () => {
    const validDiaryRow = {
      id: 'diary-123',
      user_id: 'user-123',
      date: '2024-01-15',
      text: '  Test diary entry  ',
      tags: ['  tag1  ', 'TAG2', 'tag1'],
      created_at: '2024-01-15T10:30:00.000Z',
      updated_at: '2024-01-15T10:30:00.000Z'
    };
    
    describe('mapToDiaryEntry', () => {
      it('sollte DB-Row zu DiaryEntry mappen', () => {
        const result = mapToDiaryEntry(validDiaryRow);
        
        expect(result).toEqual({
          id: 'diary-123',
          userId: 'user-123',
          date: '2024-01-15',
          text: '  Test diary entry  ',
          tags: ['  tag1  ', 'TAG2', 'tag1'],
          createdAt: '2024-01-15T10:30:00.000Z',
          updatedAt: '2024-01-15T10:30:00.000Z'
        });
      });
      
      it('sollte bei fehlenden Daten Fehler werfen', () => {
        expect(() => mapToDiaryEntry(null)).toThrow('Keine Daten für DiaryEntry');
      });
      
      it('sollte bei ungültigen Tags leeres Array verwenden', () => {
        const rowWithInvalidTags = { ...validDiaryRow, tags: 'not-an-array' };
        const result = mapToDiaryEntry(rowWithInvalidTags);
        expect(result.tags).toEqual([]);
      });
    });
    
    describe('mapFromCreateDiaryEntry', () => {
      it('sollte CreateDiaryEntry zu DB-Row mappen', () => {
        const input = {
          userId: 'user-123',
          date: '2024-01-15',
          text: '  Test entry  ',
          tags: ['  tag1  ', 'TAG2', 'tag1']
        };
        
        const result = mapFromCreateDiaryEntry(input);
        
        expect(result).toEqual({
          user_id: 'user-123',
          date: '2024-01-15',
          text: 'Test entry',
          tags: ['tag1', 'tag2']
        });
      });
      
      it('sollte Tags normalisieren und deduplizieren', () => {
        const input = {
          userId: 'user-123',
          date: '2024-01-15',
          text: 'Test',
          tags: ['  Tag1  ', 'TAG1', 'tag2', '  TAG2  ']
        };
        
        const result = mapFromCreateDiaryEntry(input);
        expect(result.tags).toEqual(['tag1', 'tag2']);
      });
    });
    
    describe('mapFromUpdateDiaryEntry', () => {
      it('sollte UpdateDiaryEntry zu DB-Row mappen', () => {
        const input = {
          text: '  Updated text  ',
          tags: ['  new-tag  ', 'TAG2']
        };
        
        const result = mapFromUpdateDiaryEntry(input);
        
        expect(result).toEqual({
          text: 'Updated text',
          tags: ['new-tag', 'tag2']
        });
      });
      
      it('sollte nur definierte Felder mappen', () => {
        const input = { text: 'Updated' };
        const result = mapFromUpdateDiaryEntry(input);
        
        expect(result).toEqual({ text: 'Updated' });
        expect(Object.keys(result)).toHaveLength(1);
      });
    });
    
    describe('mapToDiaryEntryResponse', () => {
      it('sollte DiaryEntry zu Response-Format mappen', () => {
        const input = {
          id: 'diary-123',
          userId: 'user-123',
          date: '2024-01-15',
          text: 'Test entry',
          tags: ['tag1', 'tag2'],
          createdAt: '2024-01-15T10:30:00.000Z',
          updatedAt: '2024-01-15T10:30:00.000Z'
        };
        
        const result = mapToDiaryEntryResponse(input);
        
        expect(result).toEqual({
          id: 'diary-123',
          date: '2024-01-15',
          text: 'Test entry',
          tags: ['tag1', 'tag2'],
          createdAt: '2024-01-15T10:30:00.000Z',
          updatedAt: '2024-01-15T10:30:00.000Z'
        });
        expect(result).not.toHaveProperty('userId');
      });
    });
  });
  
  describe('Gratitude Mappers', () => {
    const validGratitudeRow = {
      id: 'gratitude-123',
      user_id: 'user-123',
      date: '2024-01-15',
      morning: true,
      text: '  Test gratitude  ',
      created_at: '2024-01-15T10:30:00.000Z',
      updated_at: '2024-01-15T10:30:00.000Z'
    };
    
    describe('mapToGratitudeEntry', () => {
      it('sollte DB-Row zu GratitudeEntry mappen', () => {
        const result = mapToGratitudeEntry(validGratitudeRow);
        
        expect(result).toEqual({
          id: 'gratitude-123',
          userId: 'user-123',
          date: '2024-01-15',
          morning: true,
          text: '  Test gratitude  ',
          createdAt: '2024-01-15T10:30:00.000Z',
          updatedAt: '2024-01-15T10:30:00.000Z'
        });
      });
    });
    
    describe('mapFromCreateGratitudeEntry', () => {
      it('sollte CreateGratitudeEntry zu DB-Row mappen', () => {
        const input = {
          userId: 'user-123',
          date: '2024-01-15',
          morning: true,
          text: '  Test gratitude  '
        };
        
        const result = mapFromCreateGratitudeEntry(input);
        
        expect(result).toEqual({
          user_id: 'user-123',
          date: '2024-01-15',
          morning: true,
          text: 'Test gratitude'
        });
      });
    });
    
    describe('mapToGratitudeEntryResponse', () => {
      it('sollte GratitudeEntry zu Response-Format mappen', () => {
        const input = {
          id: 'gratitude-123',
          userId: 'user-123',
          date: '2024-01-15',
          morning: true,
          text: 'Test gratitude',
          createdAt: '2024-01-15T10:30:00.000Z',
          updatedAt: '2024-01-15T10:30:00.000Z'
        };
        
        const result = mapToGratitudeEntryResponse(input);
        
        expect(result).toEqual({
          id: 'gratitude-123',
          date: '2024-01-15',
          morning: true,
          text: 'Test gratitude',
          createdAt: '2024-01-15T10:30:00.000Z',
          updatedAt: '2024-01-15T10:30:00.000Z'
        });
        expect(result).not.toHaveProperty('userId');
      });
    });
  });
  
  describe('Session Mappers', () => {
    const validSessionRow = {
      id: 'session-123',
      user_id: 'user-123',
      method: 'box',
      duration_sec: 300,
      completed: true,
      timestamp: '2024-01-15T10:30:00.000Z',
      created_at: '2024-01-15T10:30:00.000Z',
      updated_at: '2024-01-15T10:30:00.000Z'
    };
    
    describe('mapToBreathingSession', () => {
      it('sollte DB-Row zu BreathingSession mappen', () => {
        const result = mapToBreathingSession(validSessionRow);
        
        expect(result).toEqual({
          id: 'session-123',
          userId: 'user-123',
          method: 'box',
          durationSec: 300,
          completed: true,
          timestamp: '2024-01-15T10:30:00.000Z',
          createdAt: '2024-01-15T10:30:00.000Z',
          updatedAt: '2024-01-15T10:30:00.000Z'
        });
      });
    });
    
    describe('mapFromCreateBreathingSession', () => {
      it('sollte CreateBreathingSession zu DB-Row mappen', () => {
        const input = {
          userId: 'user-123',
          method: 'box' as const,
          durationSec: 300.7,
          completed: true
        };
        
        const result = mapFromCreateBreathingSession(input);
        
        expect(result).toEqual({
          user_id: 'user-123',
          method: 'box',
          duration_sec: 301, // Gerundet
          completed: true,
          timestamp: expect.any(String)
        });
      });
      
      it('sollte default completed auf false setzen', () => {
        const input = {
          userId: 'user-123',
          method: 'box' as const,
          durationSec: 300
        };
        
        const result = mapFromCreateBreathingSession(input);
        expect(result.completed).toBe(false);
      });
    });
    
    describe('mapToBreathingSessionResponse', () => {
      it('sollte BreathingSession zu Response-Format mappen', () => {
        const input = {
          id: 'session-123',
          userId: 'user-123',
          method: 'box' as const,
          durationSec: 300,
          completed: true,
          timestamp: '2024-01-15T10:30:00.000Z',
          createdAt: '2024-01-15T10:30:00.000Z',
          updatedAt: '2024-01-15T10:30:00.000Z'
        };
        
        const result = mapToBreathingSessionResponse(input);
        
        expect(result).toEqual({
          id: 'session-123',
          method: 'box',
          durationSec: 300,
          completed: true,
          timestamp: '2024-01-15T10:30:00.000Z',
          createdAt: '2024-01-15T10:30:00.000Z',
          updatedAt: '2024-01-15T10:30:00.000Z'
        });
        expect(result).not.toHaveProperty('userId');
      });
    });
  });
  
  describe('Dream Mappers (Phase 2)', () => {
    const validDreamRow = {
      id: 'dream-123',
      user_id: 'user-123',
      date: '2024-01-15',
      title: '  Test Dream  ',
      content: '  Dream content  ',
      lucidity: true,
      recall: 4,
      tags: ['  tag1  ', 'TAG2', 'tag1'],
      created_at: '2024-01-15T10:30:00.000Z',
      updated_at: '2024-01-15T10:30:00.000Z'
    };
    
    describe('mapToDreamEntry', () => {
      it('sollte DB-Row zu DreamEntry mappen', () => {
        const result = mapToDreamEntry(validDreamRow);
        
        expect(result).toEqual({
          id: 'dream-123',
          userId: 'user-123',
          date: '2024-01-15',
          title: '  Test Dream  ',
          content: '  Dream content  ',
          lucidity: true,
          recall: 4,
          tags: ['  tag1  ', 'TAG2', 'tag1'],
          createdAt: '2024-01-15T10:30:00.000Z',
          updatedAt: '2024-01-15T10:30:00.000Z'
        });
      });
    });
    
    describe('mapFromCreateDreamEntry', () => {
      it('sollte CreateDreamEntry zu DB-Row mappen', () => {
        const input = {
          userId: 'user-123',
          date: '2024-01-15',
          title: '  Test Dream  ',
          content: '  Dream content  ',
          lucidity: true,
          recall: 4,
          tags: ['  tag1  ', 'TAG2', 'tag1']
        };
        
        const result = mapFromCreateDreamEntry(input);
        
        expect(result).toEqual({
          user_id: 'user-123',
          date: '2024-01-15',
          title: 'Test Dream',
          content: 'Dream content',
          lucidity: true,
          recall: 4,
          tags: ['tag1', 'tag2']
        });
      });
    });
    
    describe('mapToDreamEntryResponse', () => {
      it('sollte DreamEntry zu Response-Format mappen', () => {
        const input = {
          id: 'dream-123',
          userId: 'user-123',
          date: '2024-01-15',
          title: 'Test Dream',
          content: 'Dream content',
          lucidity: true,
          recall: 4,
          tags: ['tag1', 'tag2'],
          createdAt: '2024-01-15T10:30:00.000Z',
          updatedAt: '2024-01-15T10:30:00.000Z'
        };
        
        const result = mapToDreamEntryResponse(input);
        
        expect(result).toEqual({
          id: 'dream-123',
          date: '2024-01-15',
          title: 'Test Dream',
          content: 'Dream content',
          lucidity: true,
          recall: 4,
          tags: ['tag1', 'tag2'],
          createdAt: '2024-01-15T10:30:00.000Z',
          updatedAt: '2024-01-15T10:30:00.000Z'
        });
        expect(result).not.toHaveProperty('userId');
      });
    });
  });
});
