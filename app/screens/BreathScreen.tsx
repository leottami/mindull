/**
 * Breath Screen - Container-Logik ohne Styles
 * Atem-Übungen mit Methoden-Auswahl, Timer, Pause/Resume, Abbruch
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, AccessibilityInfo } from 'react-native';
import { 
  createBreathController, 
  BreathController, 
  BreathSessionInfo, 
  BreathSessionStatus,
  BreathControllerConfig 
} from '../../services/breath/controller';
import { 
  createBreathPersistenceService,
  BreathPersistenceService 
} from '../../services/breath/persist';
import { 
  createBreathTelemetryService,
  BreathTelemetryService 
} from '../../lib/telemetry/breath.events';
import { 
  BreathingMethod, 
  BREATHING_METHODS,
  BreathingMethodConfig 
} from '../../services/breath/methods.catalog';

// ============================================================================
// TYPES
// ============================================================================

export type BreathScreenState = 'idle' | 'running' | 'paused' | 'completed' | 'error';

interface BreathScreenProps {
  navigation: any; // React Navigation prop
  route: any; // React Navigation route prop
}

interface BreathScreenData {
  selectedMethod: BreathingMethod;
  selectedCycles: number;
  customPhases?: any;
  sessionInfo?: BreathSessionInfo;
  errorMessage?: string;
  isFavorite: boolean;
}

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

/**
 * Breath Screen Logic Hook
 */
function useBreathScreenLogic() {
  const [state, setState] = useState<BreathScreenState>('idle');
  const [data, setData] = useState<BreathScreenData>({
    selectedMethod: 'box',
    selectedCycles: 3,
    isFavorite: false
  });

  const controllerRef = useRef<BreathController | null>(null);
  const persistenceServiceRef = useRef<BreathPersistenceService | null>(null);
  const telemetryServiceRef = useRef<BreathTelemetryService | null>(null);
  const sessionStartTimeRef = useRef<number | null>(null);

  // Services initialisieren
  useEffect(() => {
    persistenceServiceRef.current = createBreathPersistenceService();
    telemetryServiceRef.current = createBreathTelemetryService();
    
    return () => {
      if (controllerRef.current) {
        controllerRef.current.destroy();
      }
      if (persistenceServiceRef.current) {
        persistenceServiceRef.current.cleanup();
      }
      if (telemetryServiceRef.current) {
        telemetryServiceRef.current.cleanup();
      }
    };
  }, []);

  // Method-Auswahl
  const selectMethod = useCallback((method: BreathingMethod) => {
    setData(prev => ({
      ...prev,
      selectedMethod: method,
      selectedCycles: BREATHING_METHODS[method].defaultCycles
    }));

    // Telemetrie
    telemetryServiceRef.current?.trackMethodSelection(method, 'screen_selection');
  }, []);

  // Zyklen anpassen
  const adjustCycles = useCallback((newCycles: number) => {
    const oldCycles = data.selectedCycles;
    setData(prev => ({
      ...prev,
      selectedCycles: newCycles
    }));

    // Telemetrie
    telemetryServiceRef.current?.trackCycleAdjustment(data.selectedMethod, oldCycles, newCycles);
  }, [data.selectedCycles, data.selectedMethod]);

  // Session starten
  const startSession = useCallback(async () => {
    try {
      setState('idle'); // Temporär für "preparing" Zustand
      
      // Controller erstellen
      const config: BreathControllerConfig = {
        method: data.selectedMethod,
        cycles: data.selectedCycles,
        customPhases: data.customPhases,
        audioEnabled: true, // TODO: Aus Settings
        hapticEnabled: true, // TODO: Aus Settings
        backgroundBehavior: 'pause'
      };

      const controller = createBreathController(config);
      controllerRef.current = controller;

      // Callbacks registrieren
      controller.onTick((tick, sessionInfo) => {
        setData(prev => ({ ...prev, sessionInfo }));
      });

      controller.onPhaseChange((phaseInfo, sessionInfo) => {
        setData(prev => ({ ...prev, sessionInfo }));
      });

      controller.onComplete((sessionInfo) => {
        setData(prev => ({ ...prev, sessionInfo }));
        setState('completed');
        sessionStartTimeRef.current = null;
        
        // Session persistieren
        handleSessionComplete(sessionInfo);
      });

      controller.onStateChange((sessionInfo) => {
        setData(prev => ({ ...prev, sessionInfo }));
        
        // State basierend auf Session-Status setzen
        switch (sessionInfo.status) {
          case 'active':
            setState('running');
            if (!sessionStartTimeRef.current) {
              sessionStartTimeRef.current = Date.now();
            }
            break;
          case 'paused':
            setState('paused');
            break;
          case 'completed':
            setState('completed');
            break;
          case 'cancelled':
            setState('idle');
            sessionStartTimeRef.current = null;
            break;
          case 'error':
            setState('error');
            break;
        }
      });

      // Session starten
      await controller.start();
      
      // Telemetrie
      telemetryServiceRef.current?.trackSessionStart(
        data.selectedMethod, 
        data.selectedCycles,
        'screen_start'
      );

    } catch (error: any) {
      console.error('Failed to start session:', error);
      setState('error');
      setData(prev => ({ 
        ...prev, 
        errorMessage: 'Fehler beim Starten der Atem-Übung' 
      }));
      
      // Telemetrie
      telemetryServiceRef.current?.trackSessionError(
        data.selectedMethod,
        'start_failed',
        error.message
      );
    }
  }, [data.selectedMethod, data.selectedCycles, data.customPhases]);

  // Session pausieren
  const pauseSession = useCallback(() => {
    if (controllerRef.current && state === 'running') {
      controllerRef.current.pause();
      
      // Telemetrie
      telemetryServiceRef.current?.trackSessionPause(
        data.selectedMethod,
        data.sessionInfo?.elapsedMs ? Math.round(data.sessionInfo.elapsedMs / 1000) : 0,
        'user_pause'
      );
    }
  }, [state, data.selectedMethod, data.sessionInfo]);

  // Session fortsetzen
  const resumeSession = useCallback(() => {
    if (controllerRef.current && state === 'paused') {
      controllerRef.current.resume();
      
      // Telemetrie
      telemetryServiceRef.current?.trackSessionResume(
        data.selectedMethod,
        data.sessionInfo?.elapsedMs ? Math.round(data.sessionInfo.elapsedMs / 1000) : 0,
        'user_resume'
      );
    }
  }, [state, data.selectedMethod, data.sessionInfo]);

  // Session abbrechen
  const cancelSession = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.stop();
      
      // Telemetrie
      const durationSec = data.sessionInfo?.elapsedMs 
        ? Math.round(data.sessionInfo.elapsedMs / 1000) 
        : 0;
      
      telemetryServiceRef.current?.trackSessionCancel(
        data.selectedMethod,
        durationSec,
        data.selectedCycles,
        'user_cancel'
      );
    }
  }, [data.selectedMethod, data.selectedCycles, data.sessionInfo]);

  // Session abschließen
  const handleSessionComplete = useCallback(async (sessionInfo: BreathSessionInfo) => {
    try {
      // Session persistieren
      if (persistenceServiceRef.current) {
        const result = await persistenceServiceRef.current.persistFromController(
          sessionInfo,
          'user123' // TODO: Aus Auth Service
        );

        // Telemetrie
        telemetryServiceRef.current?.trackSessionSave(
          data.selectedMethod,
          Math.round(sessionInfo.elapsedMs / 1000),
          sessionInfo.status === 'completed',
          result.isOffline,
          result.sessionId,
          result.error
        );

        if (!result.success) {
          console.warn('Failed to persist session:', result.error);
        }
      }

      // Telemetrie
      telemetryServiceRef.current?.trackSessionComplete(
        data.selectedMethod,
        Math.round(sessionInfo.elapsedMs / 1000),
        data.selectedCycles,
        sessionInfo.status === 'completed',
        sessionInfo.interruptions
      );

    } catch (error: any) {
      console.error('Failed to handle session completion:', error);
      
      // Telemetrie
      telemetryServiceRef.current?.trackSessionError(
        data.selectedMethod,
        'completion_failed',
        error.message
      );
    }
  }, [data.selectedMethod, data.selectedCycles]);

  // Als Favorit speichern
  const toggleFavorite = useCallback(() => {
    setData(prev => ({
      ...prev,
      isFavorite: !prev.isFavorite
    }));

    // TODO: Favorit in Settings speichern
    // TODO: Telemetrie für Favorit-Aktion
  }, []);

  // Neuer Versuch
  const retrySession = useCallback(() => {
    setState('idle');
    setData(prev => ({ 
      ...prev, 
      errorMessage: undefined,
      sessionInfo: undefined
    }));
    
    if (controllerRef.current) {
      controllerRef.current.destroy();
      controllerRef.current = null;
    }
  }, []);

  // Zurück zur Method-Auswahl
  const resetToIdle = useCallback(() => {
    setState('idle');
    setData(prev => ({ 
      ...prev, 
      sessionInfo: undefined,
      errorMessage: undefined
    }));
    
    if (controllerRef.current) {
      controllerRef.current.destroy();
      controllerRef.current = null;
    }
  }, []);

  return {
    state,
    data,
    actions: {
      selectMethod,
      adjustCycles,
      startSession,
      pauseSession,
      resumeSession,
      cancelSession,
      toggleFavorite,
      retrySession,
      resetToIdle
    }
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Breath Screen Component
 */
export function BreathScreen({ navigation, route }: BreathScreenProps) {
  const { state, data, actions } = useBreathScreenLogic();

  // A11y Labels
  const getAccessibilityLabel = useCallback(() => {
    switch (state) {
      case 'idle':
        return 'Atem-Übung bereit. Wähle eine Methode aus.';
      case 'running':
        return `Atem-Übung läuft. ${data.selectedMethod} Methode. Phase ${data.sessionInfo?.currentPhase}.`;
      case 'paused':
        return 'Atem-Übung pausiert. Tippe um fortzusetzen.';
      case 'completed':
        return 'Atem-Übung abgeschlossen. Tippe um zu wiederholen.';
      case 'error':
        return `Fehler: ${data.errorMessage}. Tippe um es erneut zu versuchen.`;
      default:
        return 'Atem-Übung Bildschirm';
    }
  }, [state, data.selectedMethod, data.sessionInfo, data.errorMessage]);

  // A11y Hint
  const getAccessibilityHint = useCallback(() => {
    switch (state) {
      case 'idle':
        return 'Doppel-Tippe um eine Atem-Methode auszuwählen';
      case 'running':
        return 'Doppel-Tippe um zu pausieren';
      case 'paused':
        return 'Doppel-Tippe um fortzusetzen';
      case 'completed':
        return 'Doppel-Tippe um eine neue Übung zu starten';
      case 'error':
        return 'Doppel-Tippe um es erneut zu versuchen';
      default:
        return '';
    }
  }, [state]);

  // Screen Focus Effect
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Screen wurde fokussiert
      AccessibilityInfo.announceForAccessibility('Atem-Übung Bildschirm geöffnet');
    });

    return unsubscribe;
  }, [navigation]);

  // State Change Announcements
  useEffect(() => {
    const announcement = getAccessibilityLabel();
    AccessibilityInfo.announceForAccessibility(announcement);
  }, [state, getAccessibilityLabel]);

  return (
    <View 
      accessibilityRole="main"
      accessibilityLabel={getAccessibilityLabel()}
      accessibilityHint={getAccessibilityHint()}
      accessibilityState={{
        busy: state === 'running',
        disabled: state === 'error'
      }}
    >
      {/* Method Selection (Idle State) */}
      {state === 'idle' && (
        <View accessibilityRole="radiogroup" accessibilityLabel="Atem-Methoden">
          {Object.entries(BREATHING_METHODS).map(([key, method]) => (
            <TouchableOpacity
              key={key}
              accessibilityRole="radio"
              accessibilityLabel={`${method.nameKey} Methode`}
              accessibilityHint="Doppel-Tippe um diese Methode auszuwählen"
              accessibilityState={{
                checked: data.selectedMethod === key,
                selected: data.selectedMethod === key
              }}
              onPress={() => actions.selectMethod(key as BreathingMethod)}
            >
              <Text>{method.nameKey}</Text>
            </TouchableOpacity>
          ))}
          
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Atem-Übung starten"
            accessibilityHint="Doppel-Tippe um die ausgewählte Methode zu starten"
            onPress={actions.startSession}
          >
            <Text>Start</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Running State */}
      {state === 'running' && (
        <View accessibilityRole="timer" accessibilityLabel="Atem-Übung läuft">
          <Text accessibilityRole="text">
            {data.sessionInfo?.currentPhase} - Zyklus {data.sessionInfo?.currentCycle}
          </Text>
          
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Pausieren"
            accessibilityHint="Doppel-Tippe um die Übung zu pausieren"
            onPress={actions.pauseSession}
          >
            <Text>Pause</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Abbrechen"
            accessibilityHint="Doppel-Tippe um die Übung abzubrechen"
            onPress={actions.cancelSession}
          >
            <Text>Abbrechen</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Paused State */}
      {state === 'paused' && (
        <View accessibilityRole="timer" accessibilityLabel="Atem-Übung pausiert">
          <Text accessibilityRole="text">
            Pausiert - Zyklus {data.sessionInfo?.currentCycle}
          </Text>
          
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Fortsetzen"
            accessibilityHint="Doppel-Tippe um die Übung fortzusetzen"
            onPress={actions.resumeSession}
          >
            <Text>Fortsetzen</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Abbrechen"
            accessibilityHint="Doppel-Tippe um die Übung abzubrechen"
            onPress={actions.cancelSession}
          >
            <Text>Abbrechen</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Completed State */}
      {state === 'completed' && (
        <View accessibilityRole="summary" accessibilityLabel="Atem-Übung abgeschlossen">
          <Text accessibilityRole="text">
            Übung abgeschlossen! Dauer: {Math.round((data.sessionInfo?.elapsedMs || 0) / 1000)}s
          </Text>
          
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Als Favorit speichern"
            accessibilityHint="Doppel-Tippe um diese Methode als Favorit zu speichern"
            accessibilityState={{
              checked: data.isFavorite,
              selected: data.isFavorite
            }}
            onPress={actions.toggleFavorite}
          >
            <Text>{data.isFavorite ? 'Favorit entfernen' : 'Als Favorit speichern'}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Neue Übung starten"
            accessibilityHint="Doppel-Tippe um eine neue Übung zu starten"
            onPress={actions.resetToIdle}
          >
            <Text>Neue Übung</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Error State */}
      {state === 'error' && (
        <View accessibilityRole="alert" accessibilityLabel="Fehler aufgetreten">
          <Text accessibilityRole="text">
            {data.errorMessage || 'Ein Fehler ist aufgetreten'}
          </Text>
          
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Erneut versuchen"
            accessibilityHint="Doppel-Tippe um es erneut zu versuchen"
            onPress={actions.retrySession}
          >
            <Text>Erneut versuchen</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Zurück zur Auswahl"
            accessibilityHint="Doppel-Tippe um zur Method-Auswahl zurückzukehren"
            onPress={actions.resetToIdle}
          >
            <Text>Zurück</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default BreathScreen;
