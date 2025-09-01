/**
 * Notifications Settings Screen
 * Container-Logik für Notification-Einstellungen (ohne Styling)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { SettingsBridge, NotificationSettings } from '../../../services/notifications/settings.bridge';
import { UserProfile } from '../../../models/profile.model';

// =========================================================================
// TYPES
// =========================================================================

export interface NotificationsSettingsScreenProps {
  userProfile: UserProfile;
  onSettingsChange: (settings: NotificationSettings) => void;
  onSave: (profileUpdate: Partial<UserProfile>) => Promise<boolean>;
  onBack: () => void;
}

export interface NotificationsSettingsState {
  settings: NotificationSettings;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  hasChanges: boolean;
  validationErrors: string[];
}

export interface TimePickerData {
  value: string;
  label: string;
  onChange: (time: string) => void;
  error?: string;
}

export interface ToggleData {
  value: boolean;
  label: string;
  description?: string;
  onChange: (enabled: boolean) => void;
}

export interface SliderData {
  value: number;
  min: number;
  max: number;
  step: number;
  label: string;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
}

export interface SelectData {
  value: number;
  options: Array<{ value: number; label: string }>;
  label: string;
  onChange: (value: number) => void;
}

// =========================================================================
// NOTIFICATIONS SETTINGS SCREEN
// =========================================================================

export const NotificationsSettingsScreen: React.FC<NotificationsSettingsScreenProps> = ({
  userProfile,
  onSettingsChange,
  onSave,
  onBack
}) => {
  const [state, setState] = useState<NotificationsSettingsState>({
    settings: SettingsBridge.getDefaultSettings(),
    isLoading: true,
    isSaving: false,
    error: null,
    hasChanges: false,
    validationErrors: []
  });

  // =========================================================================
  // EFFECTS
  // =========================================================================

  useEffect(() => {
    // Lade Settings aus UserProfile
    const settings = SettingsBridge.profileToNotificationSettings(userProfile);
    setState(prev => ({
      ...prev,
      settings,
      isLoading: false
    }));
  }, [userProfile]);

  useEffect(() => {
    // Validiere Settings bei Änderungen
    const validation = SettingsBridge.validateSettings(state.settings);
    setState(prev => ({
      ...prev,
      validationErrors: validation.errors
    }));
  }, [state.settings]);

  // =========================================================================
  // SETTINGS HANDLERS
  // =========================================================================

  const updateSettings = useCallback((updates: Partial<NotificationSettings>) => {
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...updates },
      hasChanges: true
    }));
  }, []);

  const handleGratitudeTimeChange = useCallback((type: 'morning' | 'evening', time: string) => {
    updateSettings({
      gratitude: {
        ...state.settings.gratitude,
        [type]: time
      }
    });
  }, [state.settings.gratitude, updateSettings]);

  const handleRealityCheckToggle = useCallback((enabled: boolean) => {
    updateSettings({
      realityChecks: {
        ...state.settings.realityChecks,
        enabled
      }
    });
  }, [state.settings.realityChecks, updateSettings]);

  const handleRealityCheckTimeChange = useCallback((type: 'startTime' | 'endTime', time: string) => {
    updateSettings({
      realityChecks: {
        ...state.settings.realityChecks,
        [type]: time
      }
    });
  }, [state.settings.realityChecks, updateSettings]);

  const handleRealityCheckCountChange = useCallback((count: number) => {
    updateSettings({
      realityChecks: {
        ...state.settings.realityChecks,
        count
      }
    });
  }, [state.settings.realityChecks, updateSettings]);

  const handleSoundToggle = useCallback((enabled: boolean) => {
    updateSettings({
      sound: {
        ...state.settings.sound,
        enabled
      }
    });
  }, [state.settings.sound, updateSettings]);

  const handleSoundVolumeChange = useCallback((volume: number) => {
    updateSettings({
      sound: {
        ...state.settings.sound,
        volume
      }
    });
  }, [state.settings.sound, updateSettings]);

  const handleHapticToggle = useCallback((enabled: boolean) => {
    updateSettings({
      haptic: {
        enabled
      }
    });
  }, [updateSettings]);

  const handleSnoozeOptionsChange = useCallback((options: number[]) => {
    updateSettings({
      snooze: {
        ...state.settings.snooze,
        options
      }
    });
  }, [state.settings.snooze, updateSettings]);

  const handleSnoozeLimitsChange = useCallback((type: 'maxPerDay' | 'maxPerCategory', value: number) => {
    updateSettings({
      snooze: {
        ...state.settings.snooze,
        [type]: value
      }
    });
  }, [state.settings.snooze, updateSettings]);

  // =========================================================================
  // SAVE HANDLERS
  // =========================================================================

  const handleSave = useCallback(async () => {
    if (state.validationErrors.length > 0) {
      setState(prev => ({
        ...prev,
        error: 'Bitte behebe die Validierungsfehler'
      }));
      return;
    }

    try {
      setState(prev => ({ ...prev, isSaving: true, error: null }));

      // Konvertiere zu Profile-Update
      const profileUpdate = SettingsBridge.notificationSettingsToProfileUpdate(state.settings);
      
      // Speichere Profile
      const success = await onSave(profileUpdate);
      
      if (success) {
        // Aktualisiere Channels
        SettingsBridge.updateChannels(state.settings);
        
        // Benachrichtige über Settings-Änderung
        onSettingsChange(state.settings);
        
        setState(prev => ({
          ...prev,
          isSaving: false,
          hasChanges: false
        }));
      } else {
        setState(prev => ({
          ...prev,
          isSaving: false,
          error: 'Speichern fehlgeschlagen'
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isSaving: false,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler'
      }));
    }
  }, [state.settings, state.validationErrors, onSave, onSettingsChange]);

  const handleReset = useCallback(() => {
    const defaultSettings = SettingsBridge.getDefaultSettings();
    setState(prev => ({
      ...prev,
      settings: defaultSettings,
      hasChanges: true,
      error: null
    }));
  }, []);

  const handleBack = useCallback(() => {
    if (state.hasChanges) {
      // Zeige Bestätigungsdialog (wird von Parent gehandhabt)
      // Für jetzt einfach zurück ohne Bestätigung
    }
    onBack();
  }, [state.hasChanges, onBack]);

  // =========================================================================
  // RENDER DATA
  // =========================================================================

  const renderGratitudeSection = () => ({
    title: 'Dankbarkeit',
    description: 'Erinnerungen für morgendliche und abendliche Dankbarkeits-Einträge',
    morningTime: {
      value: state.settings.gratitude.morning,
      label: 'Morgens',
      onChange: (time: string) => handleGratitudeTimeChange('morning', time),
      error: state.validationErrors.find(e => e.includes('morgendliche'))
    } as TimePickerData,
    eveningTime: {
      value: state.settings.gratitude.evening,
      label: 'Abends',
      onChange: (time: string) => handleGratitudeTimeChange('evening', time),
      error: state.validationErrors.find(e => e.includes('abendliche'))
    } as TimePickerData
  });

  const renderRealityCheckSection = () => ({
    title: 'Reality Checks',
    description: 'Erinnerungen für Reality-Checks (Luzides Träumen)',
    enabled: {
      value: state.settings.realityChecks.enabled,
      label: 'Reality Checks aktivieren',
      description: 'Erinnerungen für Reality-Checks tagsüber',
      onChange: handleRealityCheckToggle
    } as ToggleData,
    startTime: {
      value: state.settings.realityChecks.startTime,
      label: 'Start-Zeit',
      onChange: (time: string) => handleRealityCheckTimeChange('startTime', time),
      error: state.validationErrors.find(e => e.includes('Start-Zeit'))
    } as TimePickerData,
    endTime: {
      value: state.settings.realityChecks.endTime,
      label: 'End-Zeit',
      onChange: (time: string) => handleRealityCheckTimeChange('endTime', time),
      error: state.validationErrors.find(e => e.includes('End-Zeit'))
    } as TimePickerData,
    count: {
      value: state.settings.realityChecks.count,
      options: [
        { value: 3, label: '3 pro Tag' },
        { value: 4, label: '4 pro Tag' },
        { value: 5, label: '5 pro Tag' }
      ],
      label: 'Anzahl pro Tag',
      onChange: handleRealityCheckCountChange
    } as SelectData
  });

  const renderSoundSection = () => ({
    title: 'Ton',
    description: 'Einstellungen für Benachrichtigungstöne',
    enabled: {
      value: state.settings.sound.enabled,
      label: 'Ton aktivieren',
      description: 'Spiele Töne bei Benachrichtigungen',
      onChange: handleSoundToggle
    } as ToggleData,
    volume: {
      value: state.settings.sound.volume,
      min: 0,
      max: 1,
      step: 0.1,
      label: 'Lautstärke',
      onChange: handleSoundVolumeChange,
      formatValue: (value: number) => `${Math.round(value * 100)}%`
    } as SliderData
  });

  const renderHapticSection = () => ({
    title: 'Haptik',
    description: 'Einstellungen für haptisches Feedback',
    enabled: {
      value: state.settings.haptic.enabled,
      label: 'Haptik aktivieren',
      description: 'Vibriere bei Benachrichtigungen',
      onChange: handleHapticToggle
    } as ToggleData
  });

  const renderSnoozeSection = () => ({
    title: 'Snooze',
    description: 'Einstellungen für das Aufschieben von Benachrichtigungen',
    options: {
      value: state.settings.snooze.options,
      label: 'Snooze-Optionen',
      description: 'Verfügbare Aufschieb-Zeiten in Minuten',
      onChange: handleSnoozeOptionsChange
    },
    maxPerDay: {
      value: state.settings.snooze.maxPerDay,
      min: 1,
      max: 10,
      step: 1,
      label: 'Maximal pro Tag',
      onChange: (value: number) => handleSnoozeLimitsChange('maxPerDay', value),
      formatValue: (value: number) => `${value}`
    } as SliderData,
    maxPerCategory: {
      value: state.settings.snooze.maxPerCategory,
      min: 1,
      max: 5,
      step: 1,
      label: 'Maximal pro Kategorie',
      onChange: (value: number) => handleSnoozeLimitsChange('maxPerCategory', value),
      formatValue: (value: number) => `${value}`
    } as SliderData
  });

  // =========================================================================
  // PUBLIC API
  // =========================================================================

  const screenData = {
    // State
    isLoading: state.isLoading,
    isSaving: state.isSaving,
    error: state.error,
    hasChanges: state.hasChanges,
    validationErrors: state.validationErrors,
    
    // Sections
    gratitude: renderGratitudeSection(),
    realityChecks: renderRealityCheckSection(),
    sound: renderSoundSection(),
    haptic: renderHapticSection(),
    snooze: renderSnoozeSection(),
    
    // Actions
    actions: {
      save: {
        label: 'Speichern',
        onPress: handleSave,
        disabled: state.isSaving || state.validationErrors.length > 0
      },
      reset: {
        label: 'Zurücksetzen',
        onPress: handleReset,
        disabled: state.isSaving
      },
      back: {
        label: 'Zurück',
        onPress: handleBack,
        disabled: state.isSaving
      }
    },
    
    // Debug
    debug: {
      settings: state.settings,
      hasChanges: state.hasChanges,
      validationErrors: state.validationErrors
    }
  };

  return screenData;
};
