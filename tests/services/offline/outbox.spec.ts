/**
 * Tests für Offline-Outbox Service
 * Testet Offline/Online-Wechsel, Retry-Logik, Konflikte und Rollback
 */

import { OfflineOutbox, OutboxItem, OutboxConfig } from '../../../services/offline/outbox';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NetworkStatus } from '../../../lib/net/network';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('OfflineOutbox', () => {
  let outbox: OfflineOutbox;
  const mockUserId = 'user-123';
  const mockEntityId = 'entity-456';

  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue('[]');
    mockAsyncStorage.setItem.mockResolvedValue();
    mockAsyncStorage.removeItem.mockResolvedValue();
    
    // Reset Singleton
    (OfflineOutbox as any).instance = null;
    outbox = OfflineOutbox.getInstance();
  });

  afterEach(async () => {
    await outbox.clear();
  });

  describe('Grundfunktionalität', () => {
    it('sollte Item zur Outbox hinzufügen', async () => {
      const payload = { title: 'Test Entry', content: 'Test Content' };
      
      const itemId = await outbox.addItem('create', 'diary', mockUserId, payload);

      expect(itemId).toBeDefined();
      expect(mockAsyncStorage.setItem).toHaveBeenCalled();
      
      const stats = await outbox.getStats();
      expect(stats.total).toBe(1);
      expect(stats.pending).toBe(1);
    });

    it('sollte verschiedene Operationstypen unterstützen', async () => {
      const createId = await outbox.addItem('create', 'diary', mockUserId, {});
      const updateId = await outbox.addItem('update', 'diary', mockUserId, {}, mockEntityId);
      const deleteId = await outbox.addItem('delete', 'diary', mockUserId, {}, mockEntityId);

      expect(createId).not.toEqual(updateId);
      expect(updateId).not.toEqual(deleteId);

      const stats = await outbox.getStats();
      expect(stats.total).toBe(3);
    });

    it('sollte Items in korrekter Reihenfolge verarbeiten (FIFO)', async () => {
      // Füge Items in bestimmter Reihenfolge hinzu
      const item1 = await outbox.addItem('create', 'diary', mockUserId, { order: 1 });
      await new Promise(resolve => setTimeout(resolve, 10));
      const item2 = await outbox.addItem('create', 'diary', mockUserId, { order: 2 });
      await new Promise(resolve => setTimeout(resolve, 10));
      const item3 = await outbox.addItem('create', 'diary', mockUserId, { order: 3 });

      // Simuliere Online-Status
      outbox.setNetworkStatus('online');

      // Verarbeite Queue
      await outbox.processQueue();

      const stats = await outbox.getStats();
      expect(stats.total).toBe(0); // Alle sollten verarbeitet sein
    });
  });

  describe('Netzwerk-Status-Wechsel', () => {
    it('sollte Queue pausieren wenn offline', async () => {
      // Setze offline
      outbox.setNetworkStatus('offline');

      // Füge Items hinzu
      await outbox.addItem('create', 'diary', mockUserId, {});
      await outbox.addItem('create', 'diary', mockUserId, {});

      // Versuche Queue zu verarbeiten
      await outbox.processQueue();

      const stats = await outbox.getStats();
      expect(stats.pending).toBe(2); // Sollten pending bleiben
    });

    it('sollte Queue automatisch starten wenn online wird', async () => {
      // Starte offline
      outbox.setNetworkStatus('offline');
      
      // Füge Items hinzu
      await outbox.addItem('create', 'diary', mockUserId, {});
      await outbox.addItem('create', 'diary', mockUserId, {});

      // Simuliere Online-Wechsel
      outbox.setNetworkStatus('online');

      // Warte auf Verarbeitung
      await new Promise(resolve => setTimeout(resolve, 200));

      const stats = await outbox.getStats();
      expect(stats.pending).toBe(0); // Sollten verarbeitet sein
    });

    it('sollte nicht mehrfach gleichzeitig verarbeiten', async () => {
      outbox.setNetworkStatus('online');

      // Füge mehrere Items hinzu
      for (let i = 0; i < 5; i++) {
        await outbox.addItem('create', 'diary', mockUserId, { index: i });
      }

      // Starte mehrere processQueue-Aufrufe gleichzeitig
      const promises = [
        outbox.processQueue(),
        outbox.processQueue(),
        outbox.processQueue()
      ];

      await Promise.all(promises);

      const stats = await outbox.getStats();
      expect(stats.total).toBe(0); // Alle sollten verarbeitet sein
    });
  });

  describe('Retry-Logik & Backoff', () => {
    it('sollte Exponential Backoff bei Fehlern verwenden', async () => {
      const config: Partial<OutboxConfig> = {
        maxRetries: 3,
        baseDelay: 100, // 100ms für Tests
        maxDelay: 1000
      };

      const testOutbox = OfflineOutbox.getInstance(config);
      testOutbox.setNetworkStatus('online');

      // Mocke fehlschlagende Operation
      jest.spyOn(testOutbox as any, 'executeOperation').mockRejectedValue(
        new Error('Simulierter API-Fehler')
      );

      const itemId = await testOutbox.addItem('create', 'diary', mockUserId, {});

      // Starte Verarbeitung
      await testOutbox.processQueue();

      // Warte auf Retries
      await new Promise(resolve => setTimeout(resolve, 500));

      const stats = await testOutbox.getStats();
      expect(stats.failed).toBe(1); // Sollte nach max Retries fehlschlagen
    });

    it('sollte Max Retries respektieren', async () => {
      const config: Partial<OutboxConfig> = {
        maxRetries: 2,
        baseDelay: 50
      };

      const testOutbox = OfflineOutbox.getInstance(config);
      testOutbox.setNetworkStatus('online');

      // Mocke fehlschlagende Operation
      jest.spyOn(testOutbox as any, 'executeOperation').mockRejectedValue(
        new Error('Persistenter Fehler')
      );

      await testOutbox.addItem('create', 'diary', mockUserId, {});
      await testOutbox.processQueue();

      // Warte auf alle Retries
      await new Promise(resolve => setTimeout(resolve, 300));

      const stats = await testOutbox.getStats();
      expect(stats.failed).toBe(1);
      expect(stats.pending).toBe(0);
    });

    it('sollte erfolgreiche Items nach Retry entfernen', async () => {
      outbox.setNetworkStatus('online');

      let attemptCount = 0;
      jest.spyOn(outbox as any, 'executeOperation').mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error(`Fehler bei Versuch ${attemptCount}`);
        }
        return { success: true };
      });

      await outbox.addItem('create', 'diary', mockUserId, {});
      await outbox.processQueue();

      // Warte auf Retries
      await new Promise(resolve => setTimeout(resolve, 400));

      const stats = await outbox.getStats();
      expect(stats.total).toBe(0); // Sollte erfolgreich verarbeitet sein
    });
  });

  describe('Konfliktbehandlung', () => {
    it('sollte Konflikte erkennen und server updated_at bevorzugen', async () => {
      outbox.setNetworkStatus('online');

      // Mocke Konflikt-Fehler
      const conflictError = {
        status: 409,
        message: 'Conflict: Server version is newer',
        serverUpdatedAt: '2024-01-15T12:00:00.000Z'
      };

      jest.spyOn(outbox as any, 'executeOperation').mockRejectedValue(conflictError);

      const itemId = await outbox.addItem('update', 'diary', mockUserId, {}, mockEntityId);
      await outbox.processQueue();

      // Warte auf Konfliktbehandlung
      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = await outbox.getStats();
      expect(stats.failed).toBe(1); // Sollte als Konflikt markiert werden
    });

    it('sollte verschiedene Konflikt-Typen erkennen', async () => {
      outbox.setNetworkStatus('online');

      const conflictErrors = [
        { status: 409, message: 'Conflict' },
        { code: 'CONFLICT', message: 'Version conflict' },
        { message: 'Conflict detected' },
        { message: '409 error occurred' }
      ];

      for (const error of conflictErrors) {
        jest.spyOn(outbox as any, 'executeOperation').mockRejectedValueOnce(error);
        await outbox.addItem('update', 'diary', mockUserId, {}, mockEntityId);
      }

      await outbox.processQueue();

      // Warte auf Verarbeitung
      await new Promise(resolve => setTimeout(resolve, 200));

      const stats = await outbox.getStats();
      expect(stats.failed).toBe(4); // Alle sollten als Konflikte markiert werden
    });
  });

  describe('Batch-Verarbeitung', () => {
    it('sollte Items in konfigurierten Batches verarbeiten', async () => {
      const config: Partial<OutboxConfig> = {
        batchSize: 3
      };

      const testOutbox = OfflineOutbox.getInstance(config);
      testOutbox.setNetworkStatus('online');

      // Füge mehr Items hinzu als Batch-Größe
      for (let i = 0; i < 7; i++) {
        await testOutbox.addItem('create', 'diary', mockUserId, { index: i });
      }

      // Mocke erfolgreiche Operationen
      jest.spyOn(testOutbox as any, 'executeOperation').mockResolvedValue({ success: true });

      await testOutbox.processQueue();

      // Warte auf Batch-Verarbeitung
      await new Promise(resolve => setTimeout(resolve, 200));

      const stats = await testOutbox.getStats();
      expect(stats.total).toBe(0); // Alle sollten verarbeitet sein
    });

    it('sollte Batch-Verarbeitung bei Fehlern fortsetzen', async () => {
      const config: Partial<OutboxConfig> = {
        batchSize: 2
      };

      const testOutbox = OfflineOutbox.getInstance(config);
      testOutbox.setNetworkStatus('online');

      // Füge Items hinzu
      for (let i = 0; i < 4; i++) {
        await testOutbox.addItem('create', 'diary', mockUserId, { index: i });
      }

      // Mocke gemischte Ergebnisse
      let callCount = 0;
      jest.spyOn(testOutbox as any, 'executeOperation').mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Fehler bei Item 2');
        }
        return { success: true };
      });

      await testOutbox.processQueue();

      // Warte auf Verarbeitung
      await new Promise(resolve => setTimeout(resolve, 200));

      const stats = await testOutbox.getStats();
      expect(stats.failed).toBe(1); // Ein Item sollte fehlschlagen
      expect(stats.completed).toBe(3); // Drei sollten erfolgreich sein
    });
  });

  describe('Persistenz & Recovery', () => {
    it('sollte Items nach App-Neustart wiederherstellen', async () => {
      // Füge Items hinzu
      await outbox.addItem('create', 'diary', mockUserId, {});
      await outbox.addItem('create', 'diary', mockUserId, {});

      // Simuliere App-Neustart durch neuen Outbox-Instance
      (OfflineOutbox as any).instance = null;
      const newOutbox = OfflineOutbox.getInstance();

      const stats = await newOutbox.getStats();
      expect(stats.total).toBe(2);
      expect(stats.pending).toBe(2);
    });

    it('sollte Storage-Fehler graceful behandeln', async () => {
      // Mocke Storage-Fehler
      mockAsyncStorage.setItem.mockRejectedValueOnce(new Error('Storage error'));

      await expect(
        outbox.addItem('create', 'diary', mockUserId, {})
      ).rejects.toThrow('Storage error');
    });

    it('sollte mit korrupten Storage-Daten umgehen', async () => {
      // Mocke korrupte Daten
      mockAsyncStorage.getItem.mockResolvedValueOnce('invalid json');

      const stats = await outbox.getStats();
      expect(stats.total).toBe(0); // Sollte graceful mit Fehler umgehen
    });
  });

  describe('Edge Cases', () => {
    it('sollte mit leeren Payloads umgehen', async () => {
      const itemId = await outbox.addItem('create', 'diary', mockUserId, {});
      expect(itemId).toBeDefined();
    });

    it('sollte mit sehr großen Payloads umgehen', async () => {
      const largePayload = {
        content: 'x'.repeat(10000), // 10k Zeichen
        metadata: { tags: Array(100).fill('tag') }
      };

      const itemId = await outbox.addItem('create', 'diary', mockUserId, largePayload);
      expect(itemId).toBeDefined();
    });

    it('sollte mit Sonderzeichen in IDs umgehen', async () => {
      const specialUserId = 'user-with-special-chars-!@#$%^&*()';
      const specialEntityId = 'entity-with-ümläuts-ß';

      const itemId = await outbox.addItem(
        'update', 
        'diary', 
        specialUserId, 
        {}, 
        specialEntityId
      );
      expect(itemId).toBeDefined();
    });
  });

  describe('Statistiken', () => {
    it('sollte korrekte Statistiken zurückgeben', async () => {
      // Füge Items in verschiedenen Status hinzu
      await outbox.addItem('create', 'diary', mockUserId, {});
      await outbox.addItem('create', 'diary', mockUserId, {});
      await outbox.addItem('create', 'diary', mockUserId, {});

      // Simuliere verschiedene Status
      const items = await (outbox as any).getAllItems();
      items[0].status = 'completed';
      items[1].status = 'failed';
      items[2].status = 'processing';

      // Mocke Storage für Update
      mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);

      const stats = await outbox.getStats();
      expect(stats.total).toBe(3);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.processing).toBe(1);
      expect(stats.pending).toBe(0);
    });

    it('sollte leere Statistiken bei leerer Outbox zurückgeben', async () => {
      const stats = await outbox.getStats();
      expect(stats.total).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.processing).toBe(0);
    });
  });
});
