/**
 * Notification Services
 * Zentrale Export-Datei für alle Notification-Funktionalitäten
 */

// Core Services
export { NotificationService } from './notification.service';
export { RCScheduler } from './rc.scheduler';
export { PermissionFlow } from './permission.flow';
export { PlanStore } from './plan.store';
export { RecoveryService } from './recovery';
export { SettingsBridge } from './settings.bridge';

// Types
export type {
  Notification,
  CreateNotification,
  UpdateNotification,
  NotificationCategory,
  NotificationStatus,
  NotificationPriority,
  GratitudeSchedule,
  RealityCheckSchedule,
  NotificationSchedule,
  ScheduledNotification,
  NotificationPlanResult,
  SnoozeResult
} from './types';

export type {
  RCSlot,
  RCScheduleConfig,
  RCScheduleResult
} from './rc.scheduler';

export type {
  PermissionStatus,
  PermissionFlowState,
  PermissionFlowContext,
  PermissionFlowEvent,
  PermissionFlowResult
} from './permission.flow';

export type {
  PlanSnapshot,
  PlanStoreConfig,
  PlanStoreResult
} from './plan.store';

export type {
  RecoveryConfig,
  RecoveryContext,
  RecoveryResult,
  TimezoneInfo
} from './recovery';

export type {
  NotificationSettings,
  SettingsUpdateResult
} from './settings.bridge';

// Channels
export {
  ChannelManager,
  NOTIFICATION_CHANNELS,
  DEFAULT_CHANNEL_SETTINGS
} from './channels';

export type {
  NotificationChannel,
  NotificationSound,
  NotificationHaptic
} from './channels';

// Validators
export { NotificationValidator } from './types';
export { ChannelValidator } from './channels';
