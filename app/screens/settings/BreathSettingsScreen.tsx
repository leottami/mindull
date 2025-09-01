/**
 * Breath Settings Screen - Container-Logik ohne Styles
 * Einstellungen für Atem-Übungen: Haptik/Ton, Default-Methode, Zyklen/Phasen
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, AccessibilityInfo } from 'react-native';
import { 
  createBreathSettingsBridge,
  BreathSettingsBridge,
  BreathSettings,
  BreathSettingsChangeEvent,
  BreathSettingsUtils,
  DEFAULT_BREATH_SETTINGS
} from '../../../services/breath/settings.bridge';
import { 
  BreathingMethod, 
  BREATHING_METHODS 
} from '../../../services/breath/methods.catalog';
import { CueIntensity } from '../../../services/breath/cues';

// ============================================================================
// TYPES
// ============================================================================

export type BreathSettingsSection = 'audio' | 'method' | 'phases' | 'session' | 'advanced';

interface BreathSettingsScreenProps {
  navigation: any; // React Navigation prop
  route: any; // React Navigation route prop
}

interface BreathSettingsScreenState {
  settings: BreathSettings;
  isLoading: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  activeSection: BreathSettingsSection;
  errorMessage?: string;
  validationErrors: string[];
  validationWarnings: string[];
}

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

/**
 * Breath Settings Screen Logic Hook
 */
function useBreathSettingsLogic() {
  const [state, setState] = useState<BreathSettingsScreenState>({
    settings: { ...DEFAULT_BREATH_SETTINGS },
    isLoading: true,
    isSaving: false,
    hasUnsavedChanges: false,
    activeSection: 'audio',
    validationErrors: [],
    validationWarnings: []
  });

  const settingsBridgeRef = useRef<BreathSettingsBridge | null>(null);
  const unsavedChangesRef = useRef<Partial<BreathSettings>>({});

  // Settings Bridge initialisieren
  useEffect(() => {
    const initializeSettings = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true }));
        
        const bridge = createBreathSettingsBridge();
        settingsBridgeRef.current = bridge;
        
        const settings = await bridge.loadSettings();
        setState(prev => ({ 
          ...prev, 
          settings,
          isLoading: false 
        }));

        // Settings-Änderungen überwachen
        const unsubscribe = bridge.onSettingsChange((event: BreathSettingsChangeEvent) => {
          setState(prev => ({ 
            ...prev, 
            settings: bridge.getSettings() 
          }));
        });

        return unsubscribe;
      } catch (error: any) {
        console.error('Failed to initialize settings:', error);
        setState(prev => ({ 
          ...prev, 
          isLoading: false,
          errorMessage: 'Fehler beim Laden der Einstellungen' 
        }));
      }
    };

    initializeSettings();
  }, []);

  // Section wechseln
  const setActiveSection = useCallback((section: BreathSettingsSection) => {
    setState(prev => ({ ...prev, activeSection: section }));
  }, []);

  // Audio-Einstellungen
  const updateAudioSetting = useCallback(async (key: 'audioEnabled' | 'audioIntensity', value: boolean | CueIntensity) => {
    if (!settingsBridgeRef.current) return;

    try {
      const success = await settingsBridgeRef.current.updateSetting(key, value);
      if (success) {
        setState(prev => ({ 
          ...prev, 
          settings: settingsBridgeRef.current!.getSettings(),
          hasUnsavedChanges: false 
        }));
        unsavedChangesRef.current = {};
      } else {
        setState(prev => ({ 
          ...prev, 
          errorMessage: 'Fehler beim Speichern der Audio-Einstellung' 
        }));
      }
    } catch (error: any) {
      console.error('Failed to update audio setting:', error);
      setState(prev => ({ 
        ...prev, 
        errorMessage: 'Fehler beim Speichern der Audio-Einstellung' 
      }));
    }
  }, []);

  // Haptik-Einstellungen
  const updateHapticSetting = useCallback(async (key: 'hapticEnabled' | 'hapticIntensity', value: boolean | CueIntensity) => {
    if (!settingsBridgeRef.current) return;

    try {
      const success = await settingsBridgeRef.current.updateSetting(key, value);
      if (success) {
        setState(prev => ({ 
          ...prev, 
          settings: settingsBridgeRef.current!.getSettings(),
          hasUnsavedChanges: false 
        }));
        unsavedChangesRef.current = {};
      } else {
        setState(prev => ({ 
          ...prev, 
          errorMessage: 'Fehler beim Speichern der Haptik-Einstellung' 
        }));
      }
    } catch (error: any) {
      console.error('Failed to update haptic setting:', error);
      setState(prev => ({ 
        ...prev, 
        errorMessage: 'Fehler beim Speichern der Haptik-Einstellung' 
      }));
    }
  }, []);

  // Default-Methode
  const updateDefaultMethod = useCallback(async (method: BreathingMethod) => {
    if (!settingsBridgeRef.current) return;

    try {
      const methodConfig = BREATHING_METHODS[method];
      const success = await settingsBridgeRef.current.saveSettings({
        defaultMethod: method,
        defaultCycles: methodConfig.defaultCycles
      });

      if (success) {
        setState(prev => ({ 
          ...prev, 
          settings: settingsBridgeRef.current!.getSettings(),
          hasUnsavedChanges: false 
        }));
        unsavedChangesRef.current = {};
      } else {
        setState(prev => ({ 
          ...prev, 
          errorMessage: 'Fehler beim Speichern der Standard-Methode' 
        }));
      }
    } catch (error: any) {
      console.error('Failed to update default method:', error);
      setState(prev => ({ 
        ...prev, 
        errorMessage: 'Fehler beim Speichern der Standard-Methode' 
      }));
    }
  }, []);

  // Default-Zyklen
  const updateDefaultCycles = useCallback(async (cycles: number) => {
    if (!settingsBridgeRef.current) return;

    try {
      const validation = BreathSettingsUtils.validateSingle('defaultCycles', cycles);
      if (!validation.isValid) {
        setState(prev => ({ 
          ...prev, 
          validationErrors: [validation.error!] 
        }));
        return;
      }

      const success = await settingsBridgeRef.current.updateSetting('defaultCycles', cycles);
      if (success) {
        setState(prev => ({ 
          ...prev, 
          settings: settingsBridgeRef.current!.getSettings(),
          hasUnsavedChanges: false,
          validationErrors: [] 
        }));
        unsavedChangesRef.current = {};
      } else {
        setState(prev => ({ 
          ...prev, 
          errorMessage: 'Fehler beim Speichern der Standard-Zyklen' 
        }));
      }
    } catch (error: any) {
      console.error('Failed to update default cycles:', error);
      setState(prev => ({ 
        ...prev, 
        errorMessage: 'Fehler beim Speichern der Standard-Zyklen' 
      }));
    }
  }, []);

  // Custom-Phasen
  const updateCustomPhases = useCallback(async (phases: Partial<BreathSettings['customPhases']>) => {
    if (!settingsBridgeRef.current) return;

    try {
      const currentPhases = state.settings.customPhases;
      const newPhases = { ...currentPhases, ...phases };
      
      const validation = BreathSettingsUtils.validateSingle('customPhases', newPhases);
      if (!validation.isValid) {
        setState(prev => ({ 
          ...prev, 
          validationErrors: [validation.error!] 
        }));
        return;
      }

      const success = await settingsBridgeRef.current.updateSetting('customPhases', newPhases);
      if (success) {
        setState(prev => ({ 
          ...prev, 
          settings: settingsBridgeRef.current!.getSettings(),
          hasUnsavedChanges: false,
          validationErrors: [] 
        }));
        unsavedChangesRef.current = {};
      } else {
        setState(prev => ({ 
          ...prev, 
          errorMessage: 'Fehler beim Speichern der Custom-Phasen' 
        }));
      }
    } catch (error: any) {
      console.error('Failed to update custom phases:', error);
      setState(prev => ({ 
        ...prev, 
        errorMessage: 'Fehler beim Speichern der Custom-Phasen' 
      }));
    }
  }, [state.settings.customPhases]);

  // Session-Einstellungen
  const updateSessionSetting = useCallback(async (
    key: 'autoStart' | 'backgroundBehavior' | 'showProgress', 
    value: any
  ) => {
    if (!settingsBridgeRef.current) return;

    try {
      const success = await settingsBridgeRef.current.updateSetting(key, value);
      if (success) {
        setState(prev => ({ 
          ...prev, 
          settings: settingsBridgeRef.current!.getSettings(),
          hasUnsavedChanges: false 
        }));
        unsavedChangesRef.current = {};
      } else {
        setState(prev => ({ 
          ...prev, 
          errorMessage: 'Fehler beim Speichern der Session-Einstellung' 
        }));
      }
    } catch (error: any) {
      console.error('Failed to update session setting:', error);
      setState(prev => ({ 
        ...prev, 
        errorMessage: 'Fehler beim Speichern der Session-Einstellung' 
      }));
    }
  }, []);

  // Advanced-Einstellungen
  const updateAdvancedSetting = useCallback(async (
    key: 'strictTiming' | 'allowInterruptions' | 'sessionReminders', 
    value: boolean
  ) => {
    if (!settingsBridgeRef.current) return;

    try {
      const success = await settingsBridgeRef.current.updateSetting(key, value);
      if (success) {
        setState(prev => ({ 
          ...prev, 
          settings: settingsBridgeRef.current!.getSettings(),
          hasUnsavedChanges: false 
        }));
        unsavedChangesRef.current = {};
      } else {
        setState(prev => ({ 
          ...prev, 
          errorMessage: 'Fehler beim Speichern der Advanced-Einstellung' 
        }));
      }
    } catch (error: any) {
      console.error('Failed to update advanced setting:', error);
      setState(prev => ({ 
        ...prev, 
        errorMessage: 'Fehler beim Speichern der Advanced-Einstellung' 
      }));
    }
  }, []);

  // Zurücksetzen auf Standardwerte
  const resetToDefaults = useCallback(async () => {
    if (!settingsBridgeRef.current) return;

    Alert.alert(
      'Einstellungen zurücksetzen',
      'Möchten Sie alle Atem-Einstellungen auf die Standardwerte zurücksetzen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Zurücksetzen',
          style: 'destructive',
          onPress: async () => {
            try {
              setState(prev => ({ ...prev, isSaving: true }));
              
              const success = await settingsBridgeRef.current!.resetToDefaults();
              if (success) {
                setState(prev => ({ 
                  ...prev, 
                  settings: settingsBridgeRef.current!.getSettings(),
                  isSaving: false,
                  hasUnsavedChanges: false,
                  validationErrors: [],
                  validationWarnings: []
                }));
                unsavedChangesRef.current = {};
              } else {
                setState(prev => ({ 
                  ...prev, 
                  isSaving: false,
                  errorMessage: 'Fehler beim Zurücksetzen der Einstellungen' 
                }));
              }
            } catch (error: any) {
              console.error('Failed to reset settings:', error);
              setState(prev => ({ 
                ...prev, 
                isSaving: false,
                errorMessage: 'Fehler beim Zurücksetzen der Einstellungen' 
              }));
            }
          }
        }
      ]
    );
  }, []);

  // Fehler zurücksetzen
  const clearError = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      errorMessage: undefined,
      validationErrors: [],
      validationWarnings: []
    }));
  }, []);

  return {
    state,
    actions: {
      setActiveSection,
      updateAudioSetting,
      updateHapticSetting,
      updateDefaultMethod,
      updateDefaultCycles,
      updateCustomPhases,
      updateSessionSetting,
      updateAdvancedSetting,
      resetToDefaults,
      clearError
    }
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Breath Settings Screen Component
 */
export function BreathSettingsScreen({ navigation, route }: BreathSettingsScreenProps) {
  const { state, actions } = useBreathSettingsLogic();

  // A11y Labels
  const getAccessibilityLabel = useCallback(() => {
    return `Atem-Einstellungen. Aktive Sektion: ${state.activeSection}. ${state.hasUnsavedChanges ? 'Ungespeicherte Änderungen vorhanden.' : ''}`;
  }, [state.activeSection, state.hasUnsavedChanges]);

  // Screen Focus Effect
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      AccessibilityInfo.announceForAccessibility('Atem-Einstellungen geöffnet');
    });

    return unsubscribe;
  }, [navigation]);

  // Error Announcements
  useEffect(() => {
    if (state.errorMessage) {
      AccessibilityInfo.announceForAccessibility(`Fehler: ${state.errorMessage}`);
    }
  }, [state.errorMessage]);

  if (state.isLoading) {
    return (
      <View 
        accessibilityRole="main"
        accessibilityLabel="Lade Atem-Einstellungen"
      >
        <Text accessibilityRole="text">Lade Einstellungen...</Text>
      </View>
    );
  }

  return (
    <View 
      accessibilityRole="main"
      accessibilityLabel={getAccessibilityLabel()}
      accessibilityHint="Doppel-Tippe um Einstellungen zu ändern"
    >
      {/* Error Display */}
      {state.errorMessage && (
        <View accessibilityRole="alert" accessibilityLabel="Fehler aufgetreten">
          <Text accessibilityRole="text">{state.errorMessage}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Fehler schließen"
            onPress={actions.clearError}
          >
            <Text>Schließen</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Validation Errors */}
      {state.validationErrors.length > 0 && (
        <View accessibilityRole="alert" accessibilityLabel="Validierungsfehler">
          {state.validationErrors.map((error, index) => (
            <Text key={index} accessibilityRole="text">{error}</Text>
          ))}
        </View>
      )}

      {/* Validation Warnings */}
      {state.validationWarnings.length > 0 && (
        <View accessibilityRole="note" accessibilityLabel="Warnungen">
          {state.validationWarnings.map((warning, index) => (
            <Text key={index} accessibilityRole="text">{warning}</Text>
          ))}
        </View>
      )}

      {/* Section Navigation */}
      <View accessibilityRole="tablist" accessibilityLabel="Einstellungs-Sektionen">
        {(['audio', 'method', 'phases', 'session', 'advanced'] as BreathSettingsSection[]).map(section => (
          <TouchableOpacity
            key={section}
            accessibilityRole="tab"
            accessibilityLabel={`${section} Einstellungen`}
            accessibilityState={{
              selected: state.activeSection === section
            }}
            onPress={() => actions.setActiveSection(section)}
          >
            <Text>{section}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Audio Settings Section */}
      {state.activeSection === 'audio' && (
        <View accessibilityRole="group" accessibilityLabel="Audio und Haptik Einstellungen">
          <Text accessibilityRole="text">Audio & Haptik</Text>
          
          {/* Audio Enabled */}
          <TouchableOpacity
            accessibilityRole="switch"
            accessibilityLabel={`Audio ${state.settings.audioEnabled ? 'aktiviert' : 'deaktiviert'}`}
            accessibilityState={{
              checked: state.settings.audioEnabled
            }}
            onPress={() => actions.updateAudioSetting('audioEnabled', !state.settings.audioEnabled)}
          >
            <Text>Audio: {state.settings.audioEnabled ? 'An' : 'Aus'}</Text>
          </TouchableOpacity>

          {/* Audio Intensity */}
          {state.settings.audioEnabled && (
            <View accessibilityRole="radiogroup" accessibilityLabel="Audio Intensität">
              {(['gentle', 'distinct'] as CueIntensity[]).map(intensity => (
                <TouchableOpacity
                  key={intensity}
                  accessibilityRole="radio"
                  accessibilityLabel={`Audio Intensität ${intensity}`}
                  accessibilityState={{
                    checked: state.settings.audioIntensity === intensity
                  }}
                  onPress={() => actions.updateAudioSetting('audioIntensity', intensity)}
                >
                  <Text>{intensity}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Haptic Enabled */}
          <TouchableOpacity
            accessibilityRole="switch"
            accessibilityLabel={`Haptik ${state.settings.hapticEnabled ? 'aktiviert' : 'deaktiviert'}`}
            accessibilityState={{
              checked: state.settings.hapticEnabled
            }}
            onPress={() => actions.updateHapticSetting('hapticEnabled', !state.settings.hapticEnabled)}
          >
            <Text>Haptik: {state.settings.hapticEnabled ? 'An' : 'Aus'}</Text>
          </TouchableOpacity>

          {/* Haptic Intensity */}
          {state.settings.hapticEnabled && (
            <View accessibilityRole="radiogroup" accessibilityLabel="Haptik Intensität">
              {(['gentle', 'distinct'] as CueIntensity[]).map(intensity => (
                <TouchableOpacity
                  key={intensity}
                  accessibilityRole="radio"
                  accessibilityLabel={`Haptik Intensität ${intensity}`}
                  accessibilityState={{
                    checked: state.settings.hapticIntensity === intensity
                  }}
                  onPress={() => actions.updateHapticSetting('hapticIntensity', intensity)}
                >
                  <Text>{intensity}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Method Settings Section */}
      {state.activeSection === 'method' && (
        <View accessibilityRole="group" accessibilityLabel="Standard-Methode Einstellungen">
          <Text accessibilityRole="text">Standard-Methode</Text>
          
          {/* Method Selection */}
          <View accessibilityRole="radiogroup" accessibilityLabel="Atem-Methoden">
            {Object.keys(BREATHING_METHODS).map(method => (
              <TouchableOpacity
                key={method}
                accessibilityRole="radio"
                accessibilityLabel={`Methode ${method}`}
                accessibilityState={{
                  checked: state.settings.defaultMethod === method
                }}
                onPress={() => actions.updateDefaultMethod(method as BreathingMethod)}
              >
                <Text>{method}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Cycles Input */}
          <View accessibilityRole="group" accessibilityLabel="Standard-Zyklen">
            <Text accessibilityRole="text">Standard-Zyklen: {state.settings.defaultCycles}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Zyklen erhöhen"
              onPress={() => actions.updateDefaultCycles(state.settings.defaultCycles + 1)}
            >
              <Text>+</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Zyklen verringern"
              onPress={() => actions.updateDefaultCycles(state.settings.defaultCycles - 1)}
            >
              <Text>-</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Phases Settings Section */}
      {state.activeSection === 'phases' && (
        <View accessibilityRole="group" accessibilityLabel="Custom-Phasen Einstellungen">
          <Text accessibilityRole="text">Custom-Phasen</Text>
          
          {/* Phase Duration Controls */}
          {(['inhaleSec', 'holdSec', 'exhaleSec', 'holdAfterExhaleSec'] as const).map(phase => (
            <View key={phase} accessibilityRole="group" accessibilityLabel={`${phase} Dauer`}>
              <Text accessibilityRole="text">{phase}: {state.settings.customPhases[phase]}s</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`${phase} Dauer erhöhen`}
                onPress={() => actions.updateCustomPhases({ [phase]: state.settings.customPhases[phase] + 1 })}
              >
                <Text>+</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`${phase} Dauer verringern`}
                onPress={() => actions.updateCustomPhases({ [phase]: state.settings.customPhases[phase] - 1 })}
              >
                <Text>-</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Session Settings Section */}
      {state.activeSection === 'session' && (
        <View accessibilityRole="group" accessibilityLabel="Session Einstellungen">
          <Text accessibilityRole="text">Session-Einstellungen</Text>
          
          {/* Auto Start */}
          <TouchableOpacity
            accessibilityRole="switch"
            accessibilityLabel={`Auto-Start ${state.settings.autoStart ? 'aktiviert' : 'deaktiviert'}`}
            accessibilityState={{
              checked: state.settings.autoStart
            }}
            onPress={() => actions.updateSessionSetting('autoStart', !state.settings.autoStart)}
          >
            <Text>Auto-Start: {state.settings.autoStart ? 'An' : 'Aus'}</Text>
          </TouchableOpacity>

          {/* Background Behavior */}
          <View accessibilityRole="radiogroup" accessibilityLabel="Hintergrund-Verhalten">
            {(['pause', 'stop', 'continue'] as const).map(behavior => (
              <TouchableOpacity
                key={behavior}
                accessibilityRole="radio"
                accessibilityLabel={`Hintergrund-Verhalten ${behavior}`}
                accessibilityState={{
                  checked: state.settings.backgroundBehavior === behavior
                }}
                onPress={() => actions.updateSessionSetting('backgroundBehavior', behavior)}
              >
                <Text>{behavior}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Show Progress */}
          <TouchableOpacity
            accessibilityRole="switch"
            accessibilityLabel={`Fortschritt anzeigen ${state.settings.showProgress ? 'aktiviert' : 'deaktiviert'}`}
            accessibilityState={{
              checked: state.settings.showProgress
            }}
            onPress={() => actions.updateSessionSetting('showProgress', !state.settings.showProgress)}
          >
            <Text>Fortschritt anzeigen: {state.settings.showProgress ? 'An' : 'Aus'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Advanced Settings Section */}
      {state.activeSection === 'advanced' && (
        <View accessibilityRole="group" accessibilityLabel="Erweiterte Einstellungen">
          <Text accessibilityRole="text">Erweiterte Einstellungen</Text>
          
          {/* Strict Timing */}
          <TouchableOpacity
            accessibilityRole="switch"
            accessibilityLabel={`Strikte Zeitmessung ${state.settings.strictTiming ? 'aktiviert' : 'deaktiviert'}`}
            accessibilityState={{
              checked: state.settings.strictTiming
            }}
            onPress={() => actions.updateAdvancedSetting('strictTiming', !state.settings.strictTiming)}
          >
            <Text>Strikte Zeitmessung: {state.settings.strictTiming ? 'An' : 'Aus'}</Text>
          </TouchableOpacity>

          {/* Allow Interruptions */}
          <TouchableOpacity
            accessibilityRole="switch"
            accessibilityLabel={`Unterbrechungen erlauben ${state.settings.allowInterruptions ? 'aktiviert' : 'deaktiviert'}`}
            accessibilityState={{
              checked: state.settings.allowInterruptions
            }}
            onPress={() => actions.updateAdvancedSetting('allowInterruptions', !state.settings.allowInterruptions)}
          >
            <Text>Unterbrechungen erlauben: {state.settings.allowInterruptions ? 'An' : 'Aus'}</Text>
          </TouchableOpacity>

          {/* Session Reminders */}
          <TouchableOpacity
            accessibilityRole="switch"
            accessibilityLabel={`Session-Erinnerungen ${state.settings.sessionReminders ? 'aktiviert' : 'deaktiviert'}`}
            accessibilityState={{
              checked: state.settings.sessionReminders
            }}
            onPress={() => actions.updateAdvancedSetting('sessionReminders', !state.settings.sessionReminders)}
          >
            <Text>Session-Erinnerungen: {state.settings.sessionReminders ? 'An' : 'Aus'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Reset Button */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Einstellungen zurücksetzen"
        onPress={actions.resetToDefaults}
      >
        <Text>Zurücksetzen</Text>
      </TouchableOpacity>

      {/* Loading Indicator */}
      {state.isSaving && (
        <View accessibilityRole="progressbar" accessibilityLabel="Speichere Einstellungen">
          <Text accessibilityRole="text">Speichere...</Text>
        </View>
      )}
    </View>
  );
}

export default BreathSettingsScreen;
