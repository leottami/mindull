/**
 * Notification Permission Screen
 * Container-Logik für Pre-Permission Erklärung und Systemprompt
 * Ohne Styles - nur Business Logic
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { PermissionFlow, PermissionFlowState, PermissionStatus } from '../../../services/notifications/permission.flow';

// =========================================================================
// TYPES
// =========================================================================

export interface PermissionScreenProps {
  onPermissionGranted: () => void;
  onPermissionDenied: () => void;
  onSkip: () => void;
  onBack: () => void;
}

export interface PermissionScreenState {
  currentState: PermissionFlowState;
  isLoading: boolean;
  error: string | null;
}

// =========================================================================
// TEXT CONTENT
// =========================================================================

const PERMISSION_TEXTS = {
  headline: 'Sanfte Erinnerungen, die dich dran erinnern, gut zu dir zu sein.',
  body: 'Wir erinnern dich morgens & abends an dein Dankbarkeitstagebuch — und tagsüber an kleine Reality-Checks. Zeiten & Ton kannst du jederzeit ändern.',
  ctaAllow: 'Benachrichtigungen erlauben',
  ctaLater: 'Später',
  ctaSettings: 'Zu Einstellungen',
  ctaBack: 'Zurück'
};

const ERROR_MESSAGES = {
  permissionRequestFailed: 'Fehler beim Anfordern der Berechtigung',
  settingsOpenFailed: 'Einstellungen konnten nicht geöffnet werden',
  unknownError: 'Ein unbekannter Fehler ist aufgetreten'
};

// =========================================================================
// PERMISSION SCREEN COMPONENT
// =========================================================================

export const PermissionScreen: React.FC<PermissionScreenProps> = ({
  onPermissionGranted,
  onPermissionDenied,
  onSkip,
  onBack
}) => {
  const [permissionFlow] = useState(() => new PermissionFlow());
  const [state, setState] = useState<PermissionScreenState>({
    currentState: 'initial',
    isLoading: false,
    error: null
  });

  // =========================================================================
  // EFFECTS
  // =========================================================================

  useEffect(() => {
    // Starte Permission-Flow beim Mount
    const initialState = permissionFlow.start();
    setState(prev => ({ ...prev, currentState: initialState }));
  }, [permissionFlow]);

  useEffect(() => {
    // Beobachte State-Änderungen und handle Callbacks
    if (state.currentState === 'granted') {
      onPermissionGranted();
    } else if (state.currentState === 'denied' || state.currentState === 'restricted') {
      // Nicht sofort onPermissionDenied aufrufen - warte auf User-Input
    }
  }, [state.currentState, onPermissionGranted, onPermissionDenied]);

  // =========================================================================
  // PERMISSION HANDLERS
  // =========================================================================

  const handleAllowPermission = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Request Permission vom System
      const newState = permissionFlow.requestPermission();
      setState(prev => ({ ...prev, currentState: newState }));

      // Simuliere System-Permission-Request
      // In der echten Implementierung würde hier der native Permission-Request stehen
      const permissionStatus = await requestSystemPermission();
      
      // Handle Permission-Response
      const finalState = permissionFlow.handlePermissionResponse(permissionStatus);
      setState(prev => ({ ...prev, currentState: finalState, isLoading: false }));

    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: ERROR_MESSAGES.permissionRequestFailed 
      }));
    }
  }, [permissionFlow]);

  const handleSkip = useCallback(() => {
    onSkip();
  }, [onSkip]);

  const handleBack = useCallback(() => {
    onBack();
  }, [onBack]);

  const handleOpenSettings = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const newState = permissionFlow.openSettings();
      setState(prev => ({ ...prev, currentState: newState }));

      // Öffne System-Einstellungen
      const settingsOpened = await openSystemSettings();
      
      if (!settingsOpened) {
        throw new Error('Settings could not be opened');
      }

      setState(prev => ({ ...prev, isLoading: false }));

    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: ERROR_MESSAGES.settingsOpenFailed 
      }));
    }
  }, [permissionFlow]);

  const handleRetry = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
    handleAllowPermission();
  }, [handleAllowPermission]);

  // =========================================================================
  // RENDER LOGIC
  // =========================================================================

  const renderContent = () => {
    const { currentState, isLoading, error } = state;
    const flowResult = permissionFlow.getFlowResult();

    switch (currentState) {
      case 'initial':
      case 'explaining':
        return {
          headline: PERMISSION_TEXTS.headline,
          body: PERMISSION_TEXTS.body,
          primaryAction: {
            label: PERMISSION_TEXTS.ctaAllow,
            onPress: handleAllowPermission,
            disabled: isLoading
          },
          secondaryAction: {
            label: PERMISSION_TEXTS.ctaLater,
            onPress: handleSkip
          },
          showBackButton: true,
          onBackPress: handleBack
        };

      case 'requesting':
        return {
          headline: 'Berechtigung wird angefordert...',
          body: 'Bitte bestätige die Benachrichtigungsberechtigung in der Systemanfrage.',
          primaryAction: {
            label: 'Warten...',
            onPress: () => {},
            disabled: true
          },
          secondaryAction: null,
          showBackButton: false
        };

      case 'granted':
        return {
          headline: 'Benachrichtigungen aktiviert!',
          body: 'Du wirst jetzt sanft an deine Achtsamkeitsübungen erinnert.',
          primaryAction: {
            label: 'Weiter',
            onPress: () => onPermissionGranted(),
            disabled: false
          },
          secondaryAction: null,
          showBackButton: false
        };

      case 'denied':
        return {
          headline: 'Benachrichtigungen deaktiviert',
          body: 'Du kannst Benachrichtigungen jederzeit in den Einstellungen aktivieren.',
          primaryAction: {
            label: PERMISSION_TEXTS.ctaSettings,
            onPress: handleOpenSettings,
            disabled: isLoading
          },
          secondaryAction: {
            label: PERMISSION_TEXTS.ctaLater,
            onPress: handleSkip
          },
          showBackButton: true,
          onBackPress: handleBack
        };

      case 'restricted':
        return {
          headline: 'Benachrichtigungen eingeschränkt',
          body: 'Benachrichtigungen sind durch Einstellungen oder Parental Controls eingeschränkt.',
          primaryAction: {
            label: PERMISSION_TEXTS.ctaSettings,
            onPress: handleOpenSettings,
            disabled: isLoading
          },
          secondaryAction: {
            label: PERMISSION_TEXTS.ctaLater,
            onPress: handleSkip
          },
          showBackButton: true,
          onBackPress: handleBack
        };

      case 'settings_redirect':
        return {
          headline: 'Einstellungen geöffnet',
          body: 'Bitte aktiviere Benachrichtigungen in den Einstellungen und kehre dann zur App zurück.',
          primaryAction: {
            label: 'Zurück zur App',
            onPress: () => {
              // Prüfe Permission-Status nach Settings-Besuch
              checkPermissionStatus();
            },
            disabled: false
          },
          secondaryAction: {
            label: PERMISSION_TEXTS.ctaLater,
            onPress: handleSkip
          },
          showBackButton: false
        };

      default:
        return {
          headline: 'Unbekannter Zustand',
          body: 'Ein Fehler ist aufgetreten.',
          primaryAction: {
            label: 'Erneut versuchen',
            onPress: handleRetry,
            disabled: isLoading
          },
          secondaryAction: {
            label: PERMISSION_TEXTS.ctaLater,
            onPress: handleSkip
          },
          showBackButton: true,
          onBackPress: handleBack
        };
    }
  };

  // =========================================================================
  // ERROR HANDLING
  // =========================================================================

  const renderError = () => {
    if (!state.error) return null;

    return {
      message: state.error,
      onRetry: handleRetry,
      onDismiss: () => setState(prev => ({ ...prev, error: null }))
    };
  };

  // =========================================================================
  // PUBLIC API FOR PARENT COMPONENT
  // =========================================================================

  const screenData = {
    content: renderContent(),
    error: renderError(),
    isLoading: state.isLoading,
    currentState: state.currentState,
    flowResult: permissionFlow.getFlowResult(),
    debugInfo: permissionFlow.getDebugInfo()
  };

  // =========================================================================
  // MOCK IMPLEMENTATIONS (In echtem Code würden diese native APIs verwenden)
  // =========================================================================

  async function requestSystemPermission(): Promise<PermissionStatus> {
    // Mock: Simuliere System-Permission-Request
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simuliere 80% Erfolgsrate
        const isGranted = Math.random() > 0.2;
        resolve(isGranted ? 'authorized' : 'denied');
      }, 1000);
    });
  }

  async function openSystemSettings(): Promise<boolean> {
    // Mock: Simuliere Settings-Öffnung
    try {
      const settingsUrl = Platform.OS === 'ios' 
        ? 'app-settings:' 
        : 'package:com.mindull.app';
      
      const supported = await Linking.canOpenURL(settingsUrl);
      if (supported) {
        await Linking.openURL(settingsUrl);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  async function checkPermissionStatus(): Promise<void> {
    // Mock: Prüfe Permission-Status nach Settings-Besuch
    // In der echten Implementierung würde hier der native Status-Check stehen
    const mockStatus: PermissionStatus = Math.random() > 0.5 ? 'authorized' : 'denied';
    const newState = permissionFlow.handlePermissionResponse(mockStatus);
    setState(prev => ({ ...prev, currentState: newState }));
  }

  // =========================================================================
  // RENDER
  // =========================================================================

  // Container-Komponente ohne Styles - gibt nur Daten zurück
  return {
    ...screenData,
    // Expose handlers für Parent-Component
    handlers: {
      allowPermission: handleAllowPermission,
      skip: handleSkip,
      back: handleBack,
      openSettings: handleOpenSettings,
      retry: handleRetry
    }
  };
};
