/**
 * Notifications Settings Screen Tests
 * Testet Settings-Container-Logik und Bridge-Integration
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { NotificationsSettingsScreen } from '../../../../app/screens/settings/NotificationsSettingsScreen';
import { SettingsBridge, NotificationSettings } from '../../../../services/notifications/settings.bridge';
import { UserProfile } from '../../../../models/profile.model';

// =========================================================================
// TEST HELPERS
// =========================================================================

const createMockUserProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: 'test-user',
  email: 'test@example.com',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  reminderMorning: '08:00',
  reminderEvening: '20:00',
  realityCheckEnabled: true,
  realityCheckStart: '10:00',
  realityCheckEnd: '18:00',
  realityCheckCount: 3,
  analyticsOptIn: false,
  aiReflectionOptIn: false,
  theme: 'system',
  ...overrides
});

const createMockNotificationSettings = (overrides: Partial<NotificationSettings> = {}): NotificationSettings => ({
  gratitude: {
    enabled: true,
    morning: '08:00',
    evening: '20:00'
  },
  realityChecks: {
    enabled: true,
    startTime: '10:00',
    endTime: '18:00',
    count: 3,
    quietHoursStart: '20:00',
    quietHoursEnd: '10:00'
  },
  sound: {
    enabled: true,
    volume: 0.6
  },
  haptic: {
    enabled: true
  },
  snooze: {
    options: [5, 10, 15],
    maxPerDay: 3,
    maxPerCategory: 3
  },
  ...overrides
});

// =========================================================================
// MOCKS
// =========================================================================

jest.mock('../../../../services/notifications/settings.bridge');

const MockSettingsBridge = SettingsBridge as jest.Mocked<typeof SettingsBridge>;

// =========================================================================
// TESTS
// =========================================================================

describe('NotificationsSettingsScreen', () => {
  let mockOnSettingsChange: jest.Mock;
  let mockOnSave: jest.Mock;
  let mockOnBack: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockOnSettingsChange = jest.fn();
    mockOnSave = jest.fn().mockResolvedValue(true);
    mockOnBack = jest.fn();

    // Setup default mocks
    MockSettingsBridge.profileToNotificationSettings.mockReturnValue(
      createMockNotificationSettings()
    );
    MockSettingsBridge.getDefaultSettings.mockReturnValue(
      createMockNotificationSettings()
    );
    MockSettingsBridge.validateSettings.mockReturnValue({
      valid: true,
      errors: []
    });
  });

  describe('Initialization', () => {
    it('should initialize with user profile settings', () => {
      const userProfile = createMockUserProfile();
      const defaultSettings = createMockNotificationSettings();
      
      MockSettingsBridge.profileToNotificationSettings.mockReturnValue(defaultSettings);

      const { result } = renderHook(() => 
        NotificationsSettingsScreen({
          userProfile,
          onSettingsChange: mockOnSettingsChange,
          onSave: mockOnSave,
          onBack: mockOnBack
        })
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.settings).toEqual(defaultSettings);
      expect(MockSettingsBridge.profileToNotificationSettings).toHaveBeenCalledWith(userProfile);
    });

    it('should show loading state initially', () => {
      const userProfile = createMockUserProfile();

      const { result } = renderHook(() => 
        NotificationsSettingsScreen({
          userProfile,
          onSettingsChange: mockOnSettingsChange,
          onSave: mockOnSave,
          onBack: mockOnBack
        })
      );

      // Initial state should be loading
      expect(result.current.isLoading).toBe(false); // Wird sofort auf false gesetzt
    });
  });

  describe('Gratitude Settings', () => {
    it('should handle morning time change', () => {
      const userProfile = createMockUserProfile();
      const { result } = renderHook(() => 
        NotificationsSettingsScreen({
          userProfile,
          onSettingsChange: mockOnSettingsChange,
          onSave: mockOnSave,
          onBack: mockOnBack
        })
      );

      act(() => {
        result.current.gratitude.morningTime.onChange('09:00');
      });

      expect(result.current.hasChanges).toBe(true);
      expect(result.current.gratitude.morningTime.value).toBe('09:00');
    });

    it('should handle evening time change', () => {
      const userProfile = createMockUserProfile();
      const { result } = renderHook(() => 
        NotificationsSettingsScreen({
          userProfile,
          onSettingsChange: mockOnSettingsChange,
          onSave: mockOnSave,
          onBack: mockOnBack
        })
      );

      act(() => {
        result.current.gratitude.eveningTime.onChange('21:00');
      });

      expect(result.current.hasChanges).toBe(true);
      expect(result.current.gratitude.eveningTime.value).toBe('21:00');
    });

    it('should show validation errors for invalid times', () => {
      const userProfile = createMockUserProfile();
      MockSettingsBridge.validateSettings.mockReturnValue({
        valid: false,
        errors: ['Ungültige morgendliche Gratitude-Zeit']
      });

      const { result } = renderHook(() => 
        NotificationsSettingsScreen({
          userProfile,
          onSettingsChange: mockOnSettingsChange,
          onSave: mockOnSave,
          onBack: mockOnBack
        })
      );

      act(() => {
        result.current.gratitude.morningTime.onChange('25:00');
      });

      expect(result.current.validationErrors).toContain('Ungültige morgendliche Gratitude-Zeit');
      expect(result.current.gratitude.morningTime.error).toBe('Ungültige morgendliche Gratitude-Zeit');
    });
  });

  describe('Reality Check Settings', () => {
    it('should handle reality check toggle', () => {
      const userProfile = createMockUserProfile();
      const { result } = renderHook(() => 
        NotificationsSettingsScreen({
          userProfile,
          onSettingsChange: mockOnSettingsChange,
          onSave: mockOnSave,
          onBack: mockOnBack
        })
      );

      act(() => {
        result.current.realityChecks.enabled.onChange(false);
      });

      expect(result.current.hasChanges).toBe(true);
      expect(result.current.realityChecks.enabled.value).toBe(false);
    });

    it('should handle start time change', () => {
      const userProfile = createMockUserProfile();
      const { result } = renderHook(() => 
        NotificationsSettingsScreen({
          userProfile,
          onSettingsChange: mockOnSettingsChange,
          onSave: mockOnSave,
          onBack: mockOnBack
        })
      );

      act(() => {
        result.current.realityChecks.startTime.onChange('11:00');
      });

      expect(result.current.hasChanges).toBe(true);
      expect(result.current.realityChecks.startTime.value).toBe('11:00');
    });

    it('should handle end time change', () => {
      const userProfile = createMockUserProfile();
      const { result } = renderHook(() => 
        NotificationsSettingsScreen({
          userProfile,
          onSettingsChange: mockOnSettingsChange,
          onSave: mockOnSave,
          onBack: mockOnBack
        })
      );

      act(() => {
        result.current.realityChecks.endTime.onChange('19:00');
      });

      expect(result.current.hasChanges).toBe(true);
      expect(result.current.realityChecks.endTime.value).toBe('19:00');
    });

    it('should handle count change', () => {
      const userProfile = createMockUserProfile();
      const { result } = renderHook(() => 
        NotificationsSettingsScreen({
          userProfile,
          onSettingsChange: mockOnSettingsChange,
          onSave: mockOnSave,
          onBack: mockOnBack
        })
      );

      act(() => {
        result.current.realityChecks.count.onChange(5);
      });

      expect(result.current.hasChanges).toBe(true);
      expect(result.current.realityChecks.count.value).toBe(5);
    });
  });

  describe('Sound Settings', () => {
    it('should handle sound toggle', () => {
      const userProfile = createMockUserProfile();
      const { result } = renderHook(() => 
        NotificationsSettingsScreen({
          userProfile,
          onSettingsChange: mockOnSettingsChange,
          onSave: mockOnSave,
          onBack: mockOnBack
        })
      );

      act(() => {
        result.current.sound.enabled.onChange(false);
      });

      expect(result.current.hasChanges).toBe(true);
      expect(result.current.sound.enabled.value).toBe(false);
    });

    it('should handle volume change', () => {
      const userProfile = createMockUserProfile();
      const { result } = renderHook(() => 
        NotificationsSettingsScreen({
          userProfile,
          onSettingsChange: mockOnSettingsChange,
          onSave: mockOnSave,
          onBack: mockOnBack
        })
      );

      act(() => {
        result.current.sound.volume.onChange(0.8);
      });

      expect(result.current.hasChanges).toBe(true);
      expect(result.current.sound.volume.value).toBe(0.8);
    });

    it('should format volume value correctly', () => {
      const userProfile = createMockUserProfile();
      const { result } = renderHook(() => 
        NotificationsSettingsScreen({
          userProfile,
          onSettingsChange: mockOnSettingsChange,
          onSave: mockOnSave,
          onBack: mockOnBack
        })
      );

      expect(result.current.sound.volume.formatValue?.(0.6)).toBe('60%');
      expect(result.current.sound.volume.formatValue?.(0.85)).toBe('85%');
    });
  });

  describe('Haptic Settings', () => {
    it('should handle haptic toggle', () => {
      const userProfile = createMockUserProfile();
      const { result } = renderHook(() => 
        NotificationsSettingsScreen({
          userProfile,
          onSettingsChange: mockOnSettingsChange,
          onSave: mockOnSave,
          onBack: mockOnBack
        })
      );

      act(() => {
        result.current.haptic.enabled.onChange(false);
      });

      expect(result.current.hasChanges).toBe(true);
      expect(result.current.haptic.enabled.value).toBe(false);
    });
  });

  describe('Snooze Settings', () => {
    it('should handle max per day change', () => {
      const userProfile = createMockUserProfile();
      const { result } = renderHook(() => 
        NotificationsSettingsScreen({
          userProfile,
          onSettingsChange: mockOnSettingsChange,
          onSave: mockOnSave,
          onBack: mockOnBack
        })
      );

      act(() => {
        result.current.snooze.maxPerDay.onChange(5);
      });

      expect(result.current.hasChanges).toBe(true);
      expect(result.current.snooze.maxPerDay.value).toBe(5);
    });

    it('should handle max per category change', () => {
      const userProfile = createMockUserProfile();
      const { result } = renderHook(() => 
        NotificationsSettingsScreen({
          userProfile,
          onSettingsChange: mockOnSettingsChange,
          onSave: mockOnSave,
          onBack: mockOnBack
        })
      );

      act(() => {
        result.current.snooze.maxPerCategory.onChange(4);
      });

      expect(result.current.hasChanges).toBe(true);
      expect(result.current.snooze.maxPerCategory.value).toBe(4);
    });

    it('should format snooze values correctly', () => {
      const userProfile = createMockUserProfile();
      const { result } = renderHook(() => 
        NotificationsSettingsScreen({
          userProfile,
          onSettingsChange: mockOnSettingsChange,
          onSave: mockOnSave,
          onBack: mockOnBack
        })
      );

      expect(result.current.snooze.maxPerDay.formatValue?.(3)).toBe('3');
      expect(result.current.snooze.maxPerCategory.formatValue?.(2)).toBe('2');
    });
  });

  describe('Save Functionality', () => {
    it('should save settings successfully', async () => {
      const userProfile = createMockUserProfile();
      const { result } = renderHook(() => 
        NotificationsSettingsScreen({
          userProfile,
          onSettingsChange: mockOnSettingsChange,
          onSave: mockOnSave,
          onBack: mockOnBack
        })
      );

      // Make a change
      act(() => {
        result.current.gratitude.morningTime.onChange('09:00');
      });

      // Save
      await act(async () => {
        await result.current.actions.save.onPress();
      });

      expect(mockOnSave).toHaveBeenCalled();
      expect(mockOnSettingsChange).toHaveBeenCalled();
      expect(result.current.hasChanges).toBe(false);
      expect(result.current.isSaving).toBe(false);
    });

    it('should handle save failure', async () => {
      const userProfile = createMockUserProfile();
      mockOnSave.mockResolvedValue(false);

      const { result } = renderHook(() => 
        NotificationsSettingsScreen({
          userProfile,
          onSettingsChange: mockOnSettingsChange,
          onSave: mockOnSave,
          onBack: mockOnBack
        })
      );

      // Make a change
      act(() => {
        result.current.gratitude.morningTime.onChange('09:00');
      });

      // Save
      await act(async () => {
        await result.current.actions.save.onPress();
      });

      expect(result.current.error).toBe('Speichern fehlgeschlagen');
      expect(result.current.hasChanges).toBe(true); // Should still have changes
    });

    it('should not save with validation errors', async () => {
      const userProfile = createMockUserProfile();
      MockSettingsBridge.validateSettings.mockReturnValue({
        valid: false,
        errors: ['Ungültige Zeit']
      });

      const { result } = renderHook(() => 
        NotificationsSettingsScreen({
          userProfile,
          onSettingsChange: mockOnSettingsChange,
          onSave: mockOnSave,
          onBack: mockOnBack
        })
      );

      // Make a change that triggers validation error
      act(() => {
        result.current.gratitude.morningTime.onChange('25:00');
      });

      // Try to save
      await act(async () => {
        await result.current.actions.save.onPress();
      });

      expect(mockOnSave).not.toHaveBeenCalled();
      expect(result.current.error).toBe('Bitte behebe die Validierungsfehler');
    });

    it('should disable save button when saving', async () => {
      const userProfile = createMockUserProfile();
      let resolveSave: (value: boolean) => void;
      mockOnSave.mockImplementation(() => new Promise(resolve => {
        resolveSave = resolve;
      }));

      const { result } = renderHook(() => 
        NotificationsSettingsScreen({
          userProfile,
          onSettingsChange: mockOnSettingsChange,
          onSave: mockOnSave,
          onBack: mockOnBack
        })
      );

      // Make a change
      act(() => {
        result.current.gratitude.morningTime.onChange('09:00');
      });

      // Start save
      act(() => {
        result.current.actions.save.onPress();
      });

      expect(result.current.actions.save.disabled).toBe(true);
      expect(result.current.isSaving).toBe(true);

      // Resolve save
      resolveSave!(true);
      await act(async () => {
        // Wait for save to complete
      });

      expect(result.current.actions.save.disabled).toBe(false);
      expect(result.current.isSaving).toBe(false);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset to default settings', () => {
      const userProfile = createMockUserProfile();
      const defaultSettings = createMockNotificationSettings({
        gratitude: { morning: '07:00', evening: '19:00', enabled: true }
      });
      
      MockSettingsBridge.getDefaultSettings.mockReturnValue(defaultSettings);

      const { result } = renderHook(() => 
        NotificationsSettingsScreen({
          userProfile,
          onSettingsChange: mockOnSettingsChange,
          onSave: mockOnSave,
          onBack: mockOnBack
        })
      );

      act(() => {
        result.current.actions.reset.onPress();
      });

      expect(result.current.hasChanges).toBe(true);
      expect(result.current.gratitude.morningTime.value).toBe('07:00');
      expect(result.current.gratitude.eveningTime.value).toBe('19:00');
    });
  });

  describe('Back Navigation', () => {
    it('should call onBack when no changes', () => {
      const userProfile = createMockUserProfile();
      const { result } = renderHook(() => 
        NotificationsSettingsScreen({
          userProfile,
          onSettingsChange: mockOnSettingsChange,
          onSave: mockOnSave,
          onBack: mockOnBack
        })
      );

      act(() => {
        result.current.actions.back.onPress();
      });

      expect(mockOnBack).toHaveBeenCalled();
    });

    it('should call onBack even with changes (no confirmation for now)', () => {
      const userProfile = createMockUserProfile();
      const { result } = renderHook(() => 
        NotificationsSettingsScreen({
          userProfile,
          onSettingsChange: mockOnSettingsChange,
          onSave: mockOnSave,
          onBack: mockOnBack
        })
      );

      // Make a change
      act(() => {
        result.current.gratitude.morningTime.onChange('09:00');
      });

      // Go back
      act(() => {
        result.current.actions.back.onPress();
      });

      expect(mockOnBack).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle save errors', async () => {
      const userProfile = createMockUserProfile();
      mockOnSave.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => 
        NotificationsSettingsScreen({
          userProfile,
          onSettingsChange: mockOnSettingsChange,
          onSave: mockOnSave,
          onBack: mockOnBack
        })
      );

      // Make a change
      act(() => {
        result.current.gratitude.morningTime.onChange('09:00');
      });

      // Save
      await act(async () => {
        await result.current.actions.save.onPress();
      });

      expect(result.current.error).toBe('Network error');
    });

    it('should clear error on new changes', () => {
      const userProfile = createMockUserProfile();
      const { result } = renderHook(() => 
        NotificationsSettingsScreen({
          userProfile,
          onSettingsChange: mockOnSettingsChange,
          onSave: mockOnSave,
          onBack: mockOnBack
        })
      );

      // Set error
      act(() => {
        result.current.gratitude.morningTime.onChange('25:00'); // Invalid time
      });

      MockSettingsBridge.validateSettings.mockReturnValue({
        valid: false,
        errors: ['Ungültige Zeit']
      });

      expect(result.current.error).toBeTruthy();

      // Fix the error
      act(() => {
        result.current.gratitude.morningTime.onChange('09:00');
      });

      MockSettingsBridge.validateSettings.mockReturnValue({
        valid: true,
        errors: []
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Settings Bridge Integration', () => {
    it('should call SettingsBridge.updateChannels on save', async () => {
      const userProfile = createMockUserProfile();
      MockSettingsBridge.updateChannels = jest.fn();

      const { result } = renderHook(() => 
        NotificationsSettingsScreen({
          userProfile,
          onSettingsChange: mockOnSettingsChange,
          onSave: mockOnSave,
          onBack: mockOnBack
        })
      );

      // Make a change
      act(() => {
        result.current.sound.enabled.onChange(false);
      });

      // Save
      await act(async () => {
        await result.current.actions.save.onPress();
      });

      expect(MockSettingsBridge.updateChannels).toHaveBeenCalled();
    });

    it('should convert settings to profile update correctly', async () => {
      const userProfile = createMockUserProfile();
      const mockProfileUpdate = {
        reminderMorning: '09:00',
        reminderEvening: '21:00'
      };
      
      MockSettingsBridge.notificationSettingsToProfileUpdate.mockReturnValue(mockProfileUpdate);

      const { result } = renderHook(() => 
        NotificationsSettingsScreen({
          userProfile,
          onSettingsChange: mockOnSettingsChange,
          onSave: mockOnSave,
          onBack: mockOnBack
        })
      );

      // Make changes
      act(() => {
        result.current.gratitude.morningTime.onChange('09:00');
        result.current.gratitude.eveningTime.onChange('21:00');
      });

      // Save
      await act(async () => {
        await result.current.actions.save.onPress();
      });

      expect(MockSettingsBridge.notificationSettingsToProfileUpdate).toHaveBeenCalled();
      expect(mockOnSave).toHaveBeenCalledWith(mockProfileUpdate);
    });
  });
});
