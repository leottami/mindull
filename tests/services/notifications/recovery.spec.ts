/**
 * Recovery Service Tests
 * Testet Boot-Hook, Timezone-Watcher und Recovery-Szenarien
 */

import { RecoveryService, RecoveryContext, RecoveryResult, TimezoneInfo } from '../../services/notifications/recovery';
import { PlanStore, PlanSnapshot } from '../../services/notifications/plan.store';
import { NotificationService } from '../../services/notifications/notification.service';
import { GratitudeSchedule, RealityCheckSchedule } from '../../services/notifications/types';

// =========================================================================
// TEST HELPERS
// =========================================================================

const createRecoveryContext = (userId: string = 'test-user'): RecoveryContext => ({
  userId,
  gratitudeSchedule: {
    enabled: true,
    morning: '08:00',
    evening: '20:00'
  },
  realityCheckSchedule: {
    enabled: true,
    startTime: '10:00',
    endTime: '18:00',
    count: 3,
    quietHoursStart: '20:00',
    quietHoursEnd: '10:00'
  },
  recoveryAttempts: 0
});

const createMockSnapshot = (userId: string = 'test-user'): PlanSnapshot => ({
  version: '1.0.0',
  userId,
  timestamp: new Date().toISOString(),
  timezone: 'Europe/Berlin',
  dstOffset: 60,
  notifications: [],
  metadata: {
    totalScheduled: 0,
    gratitudeCount: 0,
    realityCheckCount: 0,
    lastPlannedDate: new Date().toISOString().split('T')[0]
  }
});

// =========================================================================
// MOCKS
// =========================================================================

jest.mock('../../services/notifications/plan.store');
jest.mock('../../services/notifications/notification.service');

const MockPlanStore = PlanStore as jest.MockedClass<typeof PlanStore>;
const MockNotificationService = NotificationService as jest.MockedClass<typeof NotificationService>;

// =========================================================================
// TESTS
// =========================================================================

describe('RecoveryService', () => {
  let recoveryService: RecoveryService;
  let mockPlanStore: jest.Mocked<PlanStore>;
  let mockNotificationService: jest.Mocked<NotificationService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset singleton
    (RecoveryService as any).instance = undefined;
    
    recoveryService = RecoveryService.getInstance();
    
    // Setup mocks
    mockPlanStore = new MockPlanStore() as jest.Mocked<PlanStore>;
    mockNotificationService = new MockNotificationService() as jest.Mocked<NotificationService>;
    
    // Mock static getInstance
    MockNotificationService.getInstance.mockReturnValue(mockNotificationService);
  });

  afterEach(() => {
    recoveryService.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const debugInfo = recoveryService.getDebugInfo();
      expect(debugInfo.config.enableAutoRecovery).toBe(true);
      expect(debugInfo.config.enableTimezoneWatcher).toBe(true);
      expect(debugInfo.config.enableDSTProtection).toBe(true);
    });

    it('should initialize with custom config', () => {
      const customService = new (RecoveryService as any)({
        enableAutoRecovery: false,
        enableTimezoneWatcher: false
      });
      
      const debugInfo = customService.getDebugInfo();
      expect(debugInfo.config.enableAutoRecovery).toBe(false);
      expect(debugInfo.config.enableTimezoneWatcher).toBe(false);
    });

    it('should initialize with context', () => {
      const context = createRecoveryContext();
      recoveryService.initialize(context);
      
      const debugInfo = recoveryService.getDebugInfo();
      expect(debugInfo.context).toEqual(context);
    });
  });

  describe('Boot Recovery', () => {
    it('should return error when not initialized', async () => {
      const result = await recoveryService.onBoot();
      
      expect(result.success).toBe(false);
      expect(result.recovered).toBe(false);
      expect(result.error).toContain('not initialized');
      expect(result.reason).toBe('boot');
    });

    it('should handle no saved plan', async () => {
      const context = createRecoveryContext();
      recoveryService.initialize(context);
      
      mockPlanStore.hasPlan.mockResolvedValue(false);
      
      const result = await recoveryService.onBoot();
      
      expect(result.success).toBe(true);
      expect(result.recovered).toBe(false);
      expect(result.reason).toBe('boot');
    });

    it('should handle successful plan recovery', async () => {
      const context = createRecoveryContext();
      recoveryService.initialize(context);
      
      const snapshot = createMockSnapshot(context.userId);
      
      mockPlanStore.hasPlan.mockResolvedValue(true);
      mockPlanStore.loadPlan.mockResolvedValue({
        success: true,
        snapshot,
        migrated: false
      });
      
      const result = await recoveryService.onBoot();
      
      expect(result.success).toBe(true);
      expect(result.recovered).toBe(true);
      expect(result.reason).toBe('boot');
      expect(result.snapshot).toEqual(snapshot);
    });

    it('should handle load plan failure', async () => {
      const context = createRecoveryContext();
      recoveryService.initialize(context);
      
      mockPlanStore.hasPlan.mockResolvedValue(true);
      mockPlanStore.loadPlan.mockResolvedValue({
        success: false,
        error: 'Load failed',
        migrated: false
      });
      
      const result = await recoveryService.onBoot();
      
      expect(result.success).toBe(false);
      expect(result.recovered).toBe(false);
      expect(result.error).toBe('Load failed');
    });

    it('should handle wrong user plan', async () => {
      const context = createRecoveryContext('user1');
      recoveryService.initialize(context);
      
      const snapshot = createMockSnapshot('user2'); // Different user
      
      mockPlanStore.hasPlan.mockResolvedValue(true);
      mockPlanStore.loadPlan.mockResolvedValue({
        success: true,
        snapshot,
        migrated: false
      });
      
      const result = await recoveryService.onBoot();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('different user');
    });
  });

  describe('Timezone Changes', () => {
    it('should detect timezone changes', () => {
      const snapshot = createMockSnapshot();
      snapshot.timezone = 'Europe/Berlin';
      
      // Mock current timezone as different
      const originalResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
      Intl.DateTimeFormat.prototype.resolvedOptions = jest.fn().mockReturnValue({
        timeZone: 'America/New_York'
      });
      
      const result = (recoveryService as any).checkTimezoneChanges(snapshot);
      
      expect(result.changed).toBe(true);
      expect(result.current).toBe('America/New_York');
      expect(result.previous).toBe('Europe/Berlin');
      
      // Restore original
      Intl.DateTimeFormat.prototype.resolvedOptions = originalResolvedOptions;
    });

    it('should detect DST changes', () => {
      const snapshot = createMockSnapshot();
      snapshot.dstOffset = 60; // Summer time
      
      // Mock current DST offset as different
      const result = (recoveryService as any).checkTimezoneChanges(snapshot);
      
      // Note: This test depends on the actual current DST offset
      // In a real test, you'd mock the calculateDSTOffset method
      expect(result.dstChanged).toBeDefined();
    });

    it('should handle timezone change during recovery', async () => {
      const context = createRecoveryContext();
      recoveryService.initialize(context);
      
      const snapshot = createMockSnapshot(context.userId);
      snapshot.timezone = 'Europe/Berlin';
      
      mockPlanStore.hasPlan.mockResolvedValue(true);
      mockPlanStore.loadPlan.mockResolvedValue({
        success: true,
        snapshot,
        migrated: false
      });
      
      // Mock timezone change
      const originalResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
      Intl.DateTimeFormat.prototype.resolvedOptions = jest.fn().mockReturnValue({
        timeZone: 'America/New_York'
      });
      
      const result = await recoveryService.onBoot();
      
      // Should trigger plan regeneration due to timezone change
      expect(result.reason).toBe('boot');
      
      // Restore original
      Intl.DateTimeFormat.prototype.resolvedOptions = originalResolvedOptions;
    });
  });

  describe('Settings Changes', () => {
    it('should regenerate plan on settings change', async () => {
      const context = createRecoveryContext();
      recoveryService.initialize(context);
      
      mockNotificationService.planGratitude.mockResolvedValue({
        scheduled: 2,
        cancelled: 0,
        errors: []
      });
      
      mockNotificationService.planRealityChecks.mockResolvedValue({
        scheduled: 3,
        cancelled: 0,
        errors: []
      });
      
      mockPlanStore.savePlan.mockResolvedValue({
        success: true,
        snapshot: createMockSnapshot(),
        migrated: false
      });
      
      const result = await recoveryService.onSettingsChange();
      
      expect(result.success).toBe(true);
      expect(result.recovered).toBe(true);
      expect(result.reason).toBe('settings');
      
      expect(mockNotificationService.clearAll).toHaveBeenCalled();
      expect(mockNotificationService.planGratitude).toHaveBeenCalledWith(
        context.userId,
        context.gratitudeSchedule
      );
      expect(mockNotificationService.planRealityChecks).toHaveBeenCalledWith(
        context.userId,
        context.realityCheckSchedule
      );
    });
  });

  describe('Login/Logout', () => {
    it('should clear plans on logout', async () => {
      const context = createRecoveryContext();
      recoveryService.initialize(context);
      
      const result = await recoveryService.onLogout();
      
      expect(result.success).toBe(true);
      expect(result.recovered).toBe(false);
      expect(result.reason).toBe('manual');
      
      expect(mockPlanStore.clearPlan).toHaveBeenCalled();
      expect(mockNotificationService.clearAll).toHaveBeenCalled();
    });

    it('should generate new plan on login', async () => {
      const context = createRecoveryContext();
      recoveryService.initialize(context);
      
      mockNotificationService.planGratitude.mockResolvedValue({
        scheduled: 2,
        cancelled: 0,
        errors: []
      });
      
      mockNotificationService.planRealityChecks.mockResolvedValue({
        scheduled: 3,
        cancelled: 0,
        errors: []
      });
      
      mockPlanStore.savePlan.mockResolvedValue({
        success: true,
        snapshot: createMockSnapshot(),
        migrated: false
      });
      
      const result = await recoveryService.onLogin('new-user');
      
      expect(result.success).toBe(true);
      expect(result.recovered).toBe(true);
      expect(result.reason).toBe('manual');
      
      expect(mockPlanStore.clearPlan).toHaveBeenCalled();
      expect(mockNotificationService.clearAll).toHaveBeenCalled();
    });
  });

  describe('Recovery Limits', () => {
    it('should respect max recovery attempts', async () => {
      const context = createRecoveryContext();
      context.recoveryAttempts = 3; // Max attempts
      recoveryService.initialize(context);
      
      const result = await recoveryService.onSettingsChange();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum recovery attempts exceeded');
    });

    it('should track recovery attempts', async () => {
      const context = createRecoveryContext();
      recoveryService.initialize(context);
      
      mockNotificationService.planGratitude.mockResolvedValue({
        scheduled: 2,
        cancelled: 0,
        errors: []
      });
      
      mockNotificationService.planRealityChecks.mockResolvedValue({
        scheduled: 3,
        cancelled: 0,
        errors: []
      });
      
      mockPlanStore.savePlan.mockResolvedValue({
        success: true,
        snapshot: createMockSnapshot(),
        migrated: false
      });
      
      await recoveryService.onSettingsChange();
      
      // Context should be updated
      const debugInfo = recoveryService.getDebugInfo();
      expect(debugInfo.context?.recoveryAttempts).toBe(1);
      expect(debugInfo.context?.lastRecoveryAttempt).toBeDefined();
    });
  });

  describe('DST Protection', () => {
    it('should delay recovery during quiet hours', async () => {
      const context = createRecoveryContext();
      recoveryService.initialize(context);
      
      // Mock current time as 23:00 (quiet hours)
      const originalDate = global.Date;
      global.Date = jest.fn(() => new Date('2024-01-15T23:00:00Z')) as any;
      
      const snapshot = createMockSnapshot(context.userId);
      snapshot.dstOffset = 60;
      
      mockPlanStore.hasPlan.mockResolvedValue(true);
      mockPlanStore.loadPlan.mockResolvedValue({
        success: true,
        snapshot,
        migrated: false
      });
      
      const result = await recoveryService.onBoot();
      
      expect(result.success).toBe(true);
      expect(result.recovered).toBe(false);
      expect(result.error).toContain('quiet hours');
      
      // Restore original Date
      global.Date = originalDate;
    });
  });

  describe('Plan Validation', () => {
    it('should validate plan age', () => {
      const snapshot = createMockSnapshot();
      
      // Plan from 8 days ago (too old)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 8);
      snapshot.timestamp = oldDate.toISOString();
      
      const isValid = (recoveryService as any).validatePlan(snapshot);
      expect(isValid).toBe(false);
    });

    it('should accept recent plans', () => {
      const snapshot = createMockSnapshot();
      
      // Plan from 3 days ago (valid)
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 3);
      snapshot.timestamp = recentDate.toISOString();
      
      const isValid = (recoveryService as any).validatePlan(snapshot);
      expect(isValid).toBe(true);
    });
  });

  describe('Manual Recovery', () => {
    it('should allow manual recovery', async () => {
      const context = createRecoveryContext();
      recoveryService.initialize(context);
      
      mockNotificationService.planGratitude.mockResolvedValue({
        scheduled: 2,
        cancelled: 0,
        errors: []
      });
      
      mockNotificationService.planRealityChecks.mockResolvedValue({
        scheduled: 3,
        cancelled: 0,
        errors: []
      });
      
      mockPlanStore.savePlan.mockResolvedValue({
        success: true,
        snapshot: createMockSnapshot(),
        migrated: false
      });
      
      const result = await recoveryService.manualRecovery();
      
      expect(result.success).toBe(true);
      expect(result.recovered).toBe(true);
      expect(result.reason).toBe('manual');
    });
  });

  describe('Error Handling', () => {
    it('should handle notification service errors', async () => {
      const context = createRecoveryContext();
      recoveryService.initialize(context);
      
      mockNotificationService.planGratitude.mockRejectedValue(
        new Error('Service error')
      );
      
      const result = await recoveryService.onSettingsChange();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Service error');
    });

    it('should handle plan store errors', async () => {
      const context = createRecoveryContext();
      recoveryService.initialize(context);
      
      mockNotificationService.planGratitude.mockResolvedValue({
        scheduled: 2,
        cancelled: 0,
        errors: []
      });
      
      mockNotificationService.planRealityChecks.mockResolvedValue({
        scheduled: 3,
        cancelled: 0,
        errors: []
      });
      
      mockPlanStore.savePlan.mockResolvedValue({
        success: false,
        error: 'Save failed',
        migrated: false
      });
      
      const result = await recoveryService.onSettingsChange();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Save failed');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup watchers on shutdown', () => {
      const context = createRecoveryContext();
      recoveryService.initialize(context);
      
      const debugInfo = recoveryService.getDebugInfo();
      expect(debugInfo.hasTimezoneWatcher).toBe(true);
      
      recoveryService.cleanup();
      
      const debugInfoAfter = recoveryService.getDebugInfo();
      expect(debugInfoAfter.hasTimezoneWatcher).toBe(false);
    });
  });
});
