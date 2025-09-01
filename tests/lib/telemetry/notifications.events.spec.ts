/**
 * Notification Telemetry Events Tests
 * Testet Opt-in, Rate-Limiting und PII-Schutz
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  NotificationTelemetry, 
  NotificationEventType, 
  NotificationEvent,
  TelemetryResult,
  initializeNotificationTelemetry,
  trackNotificationDelivered,
  trackNotificationOpened,
  trackNotificationSnoozed,
  trackNotificationDismissed
} from '../../../lib/telemetry/notifications.events';
import { NotificationCategory } from '../../../services/notifications/types';

// =========================================================================
// TEST HELPERS
// =========================================================================

const createMockEvent = (
  type: NotificationEventType,
  category: NotificationCategory,
  timestamp?: string
): NotificationEvent => ({
  type,
  category,
  timestamp: timestamp || new Date().toISOString(),
  sessionId: 'test-session-id',
  metadata: undefined
});

const createMockEventWithMetadata = (
  type: NotificationEventType,
  category: NotificationCategory,
  metadata: Record<string, any>
): NotificationEvent => ({
  type,
  category,
  timestamp: new Date().toISOString(),
  sessionId: 'test-session-id',
  metadata
});

// =========================================================================
// MOCKS
// =========================================================================

jest.mock('@react-native-async-storage/async-storage');

const MockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

// =========================================================================
// TESTS
// =========================================================================

describe('NotificationTelemetry', () => {
  let telemetry: NotificationTelemetry;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset singleton
    (NotificationTelemetry as any).instance = undefined;
    
    telemetry = NotificationTelemetry.getInstance();
    
    // Setup default mocks
    MockAsyncStorage.getItem.mockResolvedValue(null);
    MockAsyncStorage.setItem.mockResolvedValue();
    MockAsyncStorage.removeItem.mockResolvedValue();
  });

  describe('Initialization', () => {
    it('should initialize with opt-in disabled by default', () => {
      const debugInfo = telemetry.getDebugInfo();
      expect(debugInfo.config.enabled).toBe(false);
      expect(debugInfo.isEnabled).toBe(false);
    });

    it('should initialize with opt-in enabled', async () => {
      await telemetry.initialize(true);
      
      const debugInfo = telemetry.getDebugInfo();
      expect(debugInfo.config.enabled).toBe(true);
      expect(debugInfo.isEnabled).toBe(true);
      expect(debugInfo.sessionId).toBeTruthy();
    });

    it('should initialize with opt-in disabled', async () => {
      await telemetry.initialize(false);
      
      const debugInfo = telemetry.getDebugInfo();
      expect(debugInfo.config.enabled).toBe(false);
      expect(debugInfo.isEnabled).toBe(false);
    });

    it('should generate session ID when opt-in enabled', async () => {
      await telemetry.initialize(true);
      
      const debugInfo = telemetry.getDebugInfo();
      expect(debugInfo.sessionId).toMatch(/^session_\d+_[a-z0-9]+$/);
    });

    it('should reuse existing session ID', async () => {
      const existingSessionId = 'existing-session-123';
      MockAsyncStorage.getItem.mockResolvedValueOnce(existingSessionId);
      
      await telemetry.initialize(true);
      
      const debugInfo = telemetry.getDebugInfo();
      expect(debugInfo.sessionId).toBe(existingSessionId);
    });
  });

  describe('Event Tracking', () => {
    beforeEach(async () => {
      await telemetry.initialize(true);
    });

    it('should track delivered event', async () => {
      const result = await telemetry.trackDelivered('gratitude_morning');
      
      expect(result.success).toBe(true);
      expect(result.eventCount).toBe(1);
    });

    it('should track opened event', async () => {
      const result = await telemetry.trackOpened('reality_check');
      
      expect(result.success).toBe(true);
      expect(result.eventCount).toBe(1);
    });

    it('should track snoozed event with metadata', async () => {
      const result = await telemetry.trackSnoozed('gratitude_evening', 10);
      
      expect(result.success).toBe(true);
      expect(result.eventCount).toBe(1);
      
      // Check that event was saved with metadata
      const allEvents = await telemetry.debugGetAllEvents();
      const snoozedEvent = allEvents.find(e => e.type === 'notif.snoozed');
      
      expect(snoozedEvent).toBeDefined();
      expect(snoozedEvent?.metadata).toEqual({
        snoozeMinutes: 10,
        snoozeOption: 'medium'
      });
    });

    it('should track dismissed event', async () => {
      const result = await telemetry.trackDismissed('reminder');
      
      expect(result.success).toBe(true);
      expect(result.eventCount).toBe(1);
    });

    it('should ignore events when opt-in disabled', async () => {
      await telemetry.initialize(false);
      
      const result = await telemetry.trackDelivered('gratitude_morning');
      
      expect(result.success).toBe(true);
      expect(result.eventCount).toBeUndefined();
      
      const allEvents = await telemetry.debugGetAllEvents();
      expect(allEvents).toHaveLength(0);
    });

    it('should categorize snooze options correctly', async () => {
      // Short snooze (≤5 minutes)
      await telemetry.trackSnoozed('gratitude_morning', 5);
      
      // Medium snooze (6-15 minutes)
      await telemetry.trackSnoozed('gratitude_evening', 10);
      
      // Long snooze (>15 minutes)
      await telemetry.trackSnoozed('reality_check', 20);
      
      const allEvents = await telemetry.debugGetAllEvents();
      const snoozedEvents = allEvents.filter(e => e.type === 'notif.snoozed');
      
      expect(snoozedEvents).toHaveLength(3);
      expect(snoozedEvents[0].metadata?.snoozeOption).toBe('short');
      expect(snoozedEvents[1].metadata?.snoozeOption).toBe('medium');
      expect(snoozedEvents[2].metadata?.snoozeOption).toBe('long');
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(async () => {
      await telemetry.initialize(true);
    });

    it('should respect daily rate limit', async () => {
      // Track max events (20 by default)
      for (let i = 0; i < 20; i++) {
        const result = await telemetry.trackDelivered('gratitude_morning');
        expect(result.success).toBe(true);
      }
      
      // 21st event should be rate limited
      const result = await telemetry.trackDelivered('gratitude_morning');
      expect(result.success).toBe(false);
      expect(result.rateLimited).toBe(true);
      expect(result.eventCount).toBe(20);
    });

    it('should reset rate limit daily', async () => {
      // Mock yesterday's date
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const yesterdayEvents = Array.from({ length: 20 }, (_, i) => 
        createMockEvent('notif.delivered', 'gratitude_morning', yesterday.toISOString())
      );
      
      MockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(yesterdayEvents));
      
      // Should be able to track events today
      const result = await telemetry.trackDelivered('gratitude_morning');
      expect(result.success).toBe(true);
      expect(result.eventCount).toBe(1);
    });

    it('should provide rate limit status', async () => {
      const status = await telemetry.debugGetRateLimitStatus();
      
      expect(status.today).toBe(new Date().toISOString().split('T')[0]);
      expect(status.currentCount).toBe(0);
      expect(status.maxAllowed).toBe(20);
      expect(status.rateLimited).toBe(false);
    });
  });

  describe('PII Protection', () => {
    beforeEach(async () => {
      await telemetry.initialize(true);
    });

    it('should sanitize metadata to remove PII', async () => {
      const metadataWithPII = {
        snoozeMinutes: 10,
        snoozeOption: 'medium',
        userEmail: 'user@example.com', // PII - should be removed
        userName: 'John Doe', // PII - should be removed
        notificationId: 'notif_123', // Allowed
        location: 'Berlin, Germany' // PII - should be removed
      };
      
      // Use private method for testing
      const sanitized = (telemetry as any).sanitizeMetadata(metadataWithPII);
      
      expect(sanitized).toEqual({
        snoozeMinutes: 10,
        snoozeOption: 'medium',
        notificationId: 'notif_123'
      });
      
      expect(sanitized?.userEmail).toBeUndefined();
      expect(sanitized?.userName).toBeUndefined();
      expect(sanitized?.location).toBeUndefined();
    });

    it('should allow only whitelisted metadata fields', async () => {
      const allowedMetadata = {
        snoozeMinutes: 15,
        snoozeOption: 'long',
        notificationId: 'notif_456'
      };
      
      const sanitized = (telemetry as any).sanitizeMetadata(allowedMetadata);
      
      expect(sanitized).toEqual(allowedMetadata);
    });

    it('should return undefined for empty sanitized metadata', async () => {
      const piiOnlyMetadata = {
        userEmail: 'user@example.com',
        userName: 'John Doe',
        location: 'Berlin'
      };
      
      const sanitized = (telemetry as any).sanitizeMetadata(piiOnlyMetadata);
      
      expect(sanitized).toBeUndefined();
    });
  });

  describe('Daily Statistics', () => {
    beforeEach(async () => {
      await telemetry.initialize(true);
    });

    it('should provide daily statistics', async () => {
      // Track various events
      await telemetry.trackDelivered('gratitude_morning');
      await telemetry.trackOpened('gratitude_morning');
      await telemetry.trackSnoozed('gratitude_evening', 10);
      await telemetry.trackDismissed('reality_check');
      await telemetry.trackDelivered('reality_check');
      
      const stats = await telemetry.getDailyStats();
      
      expect(stats.totalEvents).toBe(5);
      expect(stats.eventsByType['notif.delivered']).toBe(2);
      expect(stats.eventsByType['notif.opened']).toBe(1);
      expect(stats.eventsByType['notif.snoozed']).toBe(1);
      expect(stats.eventsByType['notif.dismissed']).toBe(1);
      
      expect(stats.eventsByCategory['gratitude_morning']).toBe(2);
      expect(stats.eventsByCategory['gratitude_evening']).toBe(1);
      expect(stats.eventsByCategory['reality_check']).toBe(2);
      expect(stats.eventsByCategory['reminder']).toBe(0);
    });

    it('should exclude events from other days', async () => {
      // Mock events from yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const yesterdayEvents = [
        createMockEvent('notif.delivered', 'gratitude_morning', yesterday.toISOString())
      ];
      
      MockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(yesterdayEvents));
      
      const stats = await telemetry.getDailyStats();
      
      expect(stats.totalEvents).toBe(0);
    });
  });

  describe('Data Management', () => {
    beforeEach(async () => {
      await telemetry.initialize(true);
    });

    it('should clear all data', async () => {
      // Track some events first
      await telemetry.trackDelivered('gratitude_morning');
      await telemetry.trackOpened('reality_check');
      
      // Clear data
      await telemetry.clearAllData();
      
      const allEvents = await telemetry.debugGetAllEvents();
      expect(allEvents).toHaveLength(0);
      
      const debugInfo = telemetry.getDebugInfo();
      expect(debugInfo.sessionId).toBeNull();
    });

    it('should export data for GDPR', async () => {
      // Track some events
      await telemetry.trackDelivered('gratitude_morning');
      await telemetry.trackSnoozed('reality_check', 15);
      
      const exportData = await telemetry.exportData();
      
      expect(exportData.sessionId).toBeTruthy();
      expect(exportData.events).toHaveLength(2);
      expect(exportData.config.enabled).toBe(true);
      
      // Verify event structure
      const deliveredEvent = exportData.events.find(e => e.type === 'notif.delivered');
      expect(deliveredEvent?.category).toBe('gratitude_morning');
      expect(deliveredEvent?.sessionId).toBe(exportData.sessionId);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await telemetry.initialize(true);
    });

    it('should handle storage errors gracefully', async () => {
      MockAsyncStorage.setItem.mockRejectedValueOnce(new Error('Storage error'));
      
      const result = await telemetry.trackDelivered('gratitude_morning');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage error');
    });

    it('should handle corrupted storage data', async () => {
      MockAsyncStorage.getItem.mockResolvedValueOnce('invalid-json');
      
      const result = await telemetry.trackDelivered('gratitude_morning');
      
      // Should still work by treating corrupted data as empty
      expect(result.success).toBe(true);
      expect(result.eventCount).toBe(1);
    });

    it('should handle session ID generation failure', async () => {
      MockAsyncStorage.setItem.mockRejectedValueOnce(new Error('Session save failed'));
      
      // Should still work with fallback session ID
      const result = await telemetry.trackDelivered('gratitude_morning');
      
      expect(result.success).toBe(true);
      
      const debugInfo = telemetry.getDebugInfo();
      expect(debugInfo.sessionId).toBeTruthy();
    });
  });

  describe('Convenience Functions', () => {
    beforeEach(async () => {
      await initializeNotificationTelemetry(true);
    });

    it('should track delivered via convenience function', async () => {
      const result = await trackNotificationDelivered('gratitude_morning');
      
      expect(result.success).toBe(true);
      expect(result.eventCount).toBe(1);
    });

    it('should track opened via convenience function', async () => {
      const result = await trackNotificationOpened('reality_check');
      
      expect(result.success).toBe(true);
      expect(result.eventCount).toBe(1);
    });

    it('should track snoozed via convenience function', async () => {
      const result = await trackNotificationSnoozed('gratitude_evening', 10);
      
      expect(result.success).toBe(true);
      expect(result.eventCount).toBe(1);
    });

    it('should track dismissed via convenience function', async () => {
      const result = await trackNotificationDismissed('reminder');
      
      expect(result.success).toBe(true);
      expect(result.eventCount).toBe(1);
    });
  });

  describe('Event Structure', () => {
    beforeEach(async () => {
      await telemetry.initialize(true);
    });

    it('should create events with correct structure', async () => {
      await telemetry.trackDelivered('gratitude_morning');
      
      const allEvents = await telemetry.debugGetAllEvents();
      const event = allEvents[0];
      
      expect(event.type).toBe('notif.delivered');
      expect(event.category).toBe('gratitude_morning');
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(event.sessionId).toMatch(/^session_\d+_[a-z0-9]+$/);
      expect(event.metadata).toBeUndefined();
    });

    it('should include metadata when provided', async () => {
      await telemetry.trackSnoozed('reality_check', 15);
      
      const allEvents = await telemetry.debugGetAllEvents();
      const event = allEvents[0];
      
      expect(event.metadata).toEqual({
        snoozeMinutes: 15,
        snoozeOption: 'medium'
      });
    });
  });

  describe('Configuration', () => {
    it('should use custom configuration', () => {
      const customTelemetry = new (NotificationTelemetry as any)({
        enabled: true,
        maxEventsPerDay: 50,
        storageKey: '@custom:telemetry',
        sessionIdKey: '@custom:session'
      });
      
      const debugInfo = customTelemetry.getDebugInfo();
      
      expect(debugInfo.config.enabled).toBe(true);
      expect(debugInfo.config.maxEventsPerDay).toBe(50);
      expect(debugInfo.config.storageKey).toBe('@custom:telemetry');
      expect(debugInfo.config.sessionIdKey).toBe('@custom:session');
    });

    it('should respect custom rate limit', async () => {
      const customTelemetry = new (NotificationTelemetry as any)({
        enabled: true,
        maxEventsPerDay: 3
      });
      
      await customTelemetry.initialize(true);
      
      // Track 3 events (should work)
      for (let i = 0; i < 3; i++) {
        const result = await customTelemetry.trackDelivered('gratitude_morning');
        expect(result.success).toBe(true);
      }
      
      // 4th event should be rate limited
      const result = await customTelemetry.trackDelivered('gratitude_morning');
      expect(result.success).toBe(false);
      expect(result.rateLimited).toBe(true);
      expect(result.eventCount).toBe(3);
    });
  });
});
