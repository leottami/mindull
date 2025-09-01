/**
 * Offline-Outbox Service
 * Persistente Queue für Offline-Operationen mit Retry & Konfliktbehandlung
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NetworkStatus } from '../../lib/net/network';

// ============================================================================
// TYPES
// ============================================================================

export interface OutboxItem {
  id: string;
  type: 'create' | 'update' | 'delete';
  domain: 'diary' | 'gratitude' | 'sessions' | 'dreams';
  entityId?: string;
  userId: string;
  payload: any;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
  status: 'pending' | 'processing' | 'failed' | 'completed';
  error?: string;
  conflictResolution?: 'server' | 'client' | 'manual';
}

export interface OutboxConfig {
  maxRetries: number;
  baseDelay: number; // ms
  maxDelay: number; // ms
  batchSize: number;
  retryOnConflict: boolean;
}

export interface ConflictInfo {
  itemId: string;
  serverUpdatedAt: string;
  clientUpdatedAt: string;
  conflictType: 'timestamp' | 'version' | 'deletion';
  resolution: 'server' | 'client' | 'manual';
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: OutboxConfig = {
  maxRetries: 5,
  baseDelay: 1000, // 1s
  maxDelay: 30000, // 30s
  batchSize: 10,
  retryOnConflict: true
};

// ============================================================================
// OUTBOX SERVICE
// ============================================================================

export class OfflineOutbox {
  private static instance: OfflineOutbox;
  private config: OutboxConfig;
  private isProcessing = false;
  private networkStatus: NetworkStatus = 'unknown';
  private storageKey = 'mindull_outbox_queue';
  private processingQueue: Set<string> = new Set();

  private constructor(config: Partial<OutboxConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static getInstance(config?: Partial<OutboxConfig>): OfflineOutbox {
    if (!OfflineOutbox.instance) {
      OfflineOutbox.instance = new OfflineOutbox(config);
    }
    return OfflineOutbox.instance;
  }

  /**
   * Setzt Netzwerk-Status (wird von NetworkListener aufgerufen)
   */
  setNetworkStatus(status: NetworkStatus): void {
    const wasOffline = this.networkStatus === 'offline';
    this.networkStatus = status;

    if (wasOffline && status === 'online') {
      this.processQueue();
    }
  }

  /**
   * Fügt Item zur Outbox hinzu
   */
  async addItem(
    type: OutboxItem['type'],
    domain: OutboxItem['domain'],
    userId: string,
    payload: any,
    entityId?: string
  ): Promise<string> {
    const item: OutboxItem = {
      id: this.generateId(),
      type,
      domain,
      entityId,
      userId,
      payload,
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'pending'
    };

    await this.persistItem(item);
    
    // Verarbeite Queue wenn online
    if (this.networkStatus === 'online' && !this.isProcessing) {
      this.processQueue();
    }

    return item.id;
  }

  /**
   * Verarbeitet alle pending Items
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing || this.networkStatus === 'offline') {
      return;
    }

    this.isProcessing = true;

    try {
      const pendingItems = await this.getPendingItems();
      
      if (pendingItems.length === 0) {
        return;
      }

      // Verarbeite in Batches
      for (let i = 0; i < pendingItems.length; i += this.config.batchSize) {
        const batch = pendingItems.slice(i, i + this.config.batchSize);
        await this.processBatch(batch);
      }
    } catch (error) {
      console.error('Fehler beim Verarbeiten der Outbox:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Verarbeitet einen Batch von Items
   */
  private async processBatch(items: OutboxItem[]): Promise<void> {
    const promises = items.map(item => this.processItem(item));
    await Promise.allSettled(promises);
  }

  /**
   * Verarbeitet ein einzelnes Item
   */
  private async processItem(item: OutboxItem): Promise<void> {
    if (this.processingQueue.has(item.id)) {
      return; // Bereits in Verarbeitung
    }

    this.processingQueue.add(item.id);

    try {
      // Markiere als processing
      await this.updateItemStatus(item.id, 'processing');

      // Führe Operation aus
      const result = await this.executeOperation(item);

      // Markiere als completed
      await this.updateItemStatus(item.id, 'completed');
      await this.removeItem(item.id);

    } catch (error: any) {
      console.error(`Fehler bei Item ${item.id}:`, error);

      // Prüfe auf Konflikte
      if (this.isConflictError(error)) {
        await this.handleConflict(item, error);
      } else {
        // Normale Retry-Logik
        await this.handleRetry(item, error);
      }
    } finally {
      this.processingQueue.delete(item.id);
    }
  }

  /**
   * Führt die eigentliche Operation aus
   */
  private async executeOperation(item: OutboxItem): Promise<any> {
    // Hier würde der tatsächliche API-Call erfolgen
    // Für jetzt simulieren wir es
    switch (item.domain) {
      case 'diary':
        return this.executeDiaryOperation(item);
      case 'gratitude':
        return this.executeGratitudeOperation(item);
      case 'sessions':
        return this.executeSessionsOperation(item);
      case 'dreams':
        return this.executeDreamsOperation(item);
      default:
        throw new Error(`Unbekannte Domain: ${item.domain}`);
    }
  }

  /**
   * Simulierte Operationen (werden durch echte Service-Calls ersetzt)
   */
  private async executeDiaryOperation(item: OutboxItem): Promise<any> {
    // Simuliere API-Call
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (Math.random() < 0.1) { // 10% Fehlerrate für Tests
      throw new Error('Simulierter API-Fehler');
    }

    return { success: true, id: item.entityId || 'new-id' };
  }

  private async executeGratitudeOperation(item: OutboxItem): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 100));
    return { success: true, id: item.entityId || 'new-id' };
  }

  private async executeSessionsOperation(item: OutboxItem): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 100));
    return { success: true, id: item.entityId || 'new-id' };
  }

  private async executeDreamsOperation(item: OutboxItem): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 100));
    return { success: true, id: item.entityId || 'new-id' };
  }

  /**
   * Behandelt Konflikte (server updated_at gewinnt)
   */
  private async handleConflict(item: OutboxItem, error: any): Promise<void> {
    const conflictInfo: ConflictInfo = {
      itemId: item.id,
      serverUpdatedAt: error.serverUpdatedAt || new Date().toISOString(),
      clientUpdatedAt: item.updatedAt,
      conflictType: 'timestamp',
      resolution: 'server' // Standard: Server gewinnt
    };

    // Aktualisiere Item mit Konflikt-Info
    item.conflictResolution = 'server';
    item.error = `Konflikt: Server-Version ist neuer (${conflictInfo.serverUpdatedAt})`;
    item.status = 'failed';

    await this.updateItem(item);

    // Emit Event für UI (wird später implementiert)
    this.emitConflictEvent(conflictInfo);
  }

  /**
   * Behandelt Retry-Logik mit Exponential Backoff
   */
  private async handleRetry(item: OutboxItem, error: any): Promise<void> {
    if (item.retryCount >= item.maxRetries) {
      // Max Retries erreicht
      item.status = 'failed';
      item.error = `Max Retries erreicht: ${error.message}`;
      await this.updateItem(item);
      return;
    }

    // Exponential Backoff
    const delay = Math.min(
      this.config.baseDelay * Math.pow(2, item.retryCount),
      this.config.maxDelay
    );

    item.retryCount++;
    item.status = 'pending';
    item.error = `Retry ${item.retryCount}/${item.maxRetries}: ${error.message}`;
    item.updatedAt = new Date().toISOString();

    await this.updateItem(item);

    // Verzögerte Wiederaufnahme
    setTimeout(() => {
      if (this.networkStatus === 'online') {
        this.processQueue();
      }
    }, delay);
  }

  /**
   * Prüft ob ein Fehler ein Konflikt ist
   */
  private isConflictError(error: any): boolean {
    return error.status === 409 || 
           error.code === 'CONFLICT' ||
           error.message?.includes('conflict') ||
           error.message?.includes('409');
  }

  /**
   * Holt alle pending Items
   */
  private async getPendingItems(): Promise<OutboxItem[]> {
    try {
      const items = await this.getAllItems();
      return items
        .filter(item => item.status === 'pending')
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } catch (error) {
      console.error('Fehler beim Laden der pending Items:', error);
      return [];
    }
  }

  /**
   * Holt alle Items aus dem Storage
   */
  private async getAllItems(): Promise<OutboxItem[]> {
    try {
      const data = await AsyncStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Fehler beim Laden der Outbox:', error);
      return [];
    }
  }

  /**
   * Persistiert ein Item
   */
  private async persistItem(item: OutboxItem): Promise<void> {
    try {
      const items = await this.getAllItems();
      items.push(item);
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(items));
    } catch (error) {
      console.error('Fehler beim Persistieren des Items:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert Item-Status
   */
  private async updateItemStatus(id: string, status: OutboxItem['status']): Promise<void> {
    try {
      const items = await this.getAllItems();
      const item = items.find(i => i.id === id);
      if (item) {
        item.status = status;
        item.updatedAt = new Date().toISOString();
        await AsyncStorage.setItem(this.storageKey, JSON.stringify(items));
      }
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Item-Status:', error);
    }
  }

  /**
   * Aktualisiert ein komplettes Item
   */
  private async updateItem(updatedItem: OutboxItem): Promise<void> {
    try {
      const items = await this.getAllItems();
      const index = items.findIndex(i => i.id === updatedItem.id);
      if (index !== -1) {
        items[index] = updatedItem;
        await AsyncStorage.setItem(this.storageKey, JSON.stringify(items));
      }
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Items:', error);
    }
  }

  /**
   * Entfernt ein Item
   */
  private async removeItem(id: string): Promise<void> {
    try {
      const items = await this.getAllItems();
      const filteredItems = items.filter(i => i.id !== id);
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(filteredItems));
    } catch (error) {
      console.error('Fehler beim Entfernen des Items:', error);
    }
  }

  /**
   * Generiert eindeutige ID
   */
  private generateId(): string {
    return `outbox_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Emittiert Konflikt-Event (wird später durch Event-System ersetzt)
   */
  private emitConflictEvent(conflictInfo: ConflictInfo): void {
    // TODO: Implementiere Event-System
    console.log('Konflikt erkannt:', conflictInfo);
  }

  /**
   * Löscht alle Items (für Tests)
   */
  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('Fehler beim Löschen der Outbox:', error);
    }
  }

  /**
   * Gibt Statistiken zurück
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    processing: number;
    failed: number;
    completed: number;
  }> {
    try {
      const items = await this.getAllItems();
      return {
        total: items.length,
        pending: items.filter(i => i.status === 'pending').length,
        processing: items.filter(i => i.status === 'processing').length,
        failed: items.filter(i => i.status === 'failed').length,
        completed: items.filter(i => i.status === 'completed').length
      };
    } catch (error) {
      console.error('Fehler beim Laden der Statistiken:', error);
      return { total: 0, pending: 0, processing: 0, failed: 0, completed: 0 };
    }
  }
}
