/**
 * Notification Permission Flow
 * State-Maschine für Pre-Permission Erklärung und Systemprompt
 * Mit Handhabung von Denied/Restricted und Einstellungen-Shortcut
 */

import { Platform } from 'react-native';

// =========================================================================
// TYPES
// =========================================================================

export type PermissionStatus = 
  | 'not_determined'
  | 'denied'
  | 'restricted'
  | 'authorized'
  | 'provisional'
  | 'ephemeral';

export type PermissionFlowState = 
  | 'initial'
  | 'explaining'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'restricted'
  | 'settings_redirect';

export interface PermissionFlowContext {
  hasShownExplanation: boolean;
  hasRequestedPermission: boolean;
  lastRequestTime?: number;
  explanationShownCount: number;
  settingsRedirectCount: number;
}

export interface PermissionFlowEvent {
  type: 'SHOW_EXPLANATION' | 'REQUEST_PERMISSION' | 'PERMISSION_GRANTED' | 'PERMISSION_DENIED' | 'PERMISSION_RESTRICTED' | 'OPEN_SETTINGS' | 'RESET';
  payload?: any;
}

export interface PermissionFlowResult {
  status: PermissionStatus;
  canRequest: boolean;
  needsSettingsRedirect: boolean;
  explanationRequired: boolean;
}

// =========================================================================
// PERMISSION FLOW STATE MACHINE
// =========================================================================

export class PermissionFlow {
  private state: PermissionFlowState = 'initial';
  private context: PermissionFlowContext = {
    hasShownExplanation: false,
    hasRequestedPermission: false,
    explanationShownCount: 0,
    settingsRedirectCount: 0
  };

  constructor() {
    this.reset();
  }

  /**
   * Hauptmethode: Verarbeitet Events und aktualisiert State
   */
  dispatch(event: PermissionFlowEvent): PermissionFlowState {
    const previousState = this.state;

    switch (this.state) {
      case 'initial':
        return this.handleInitialState(event);
      
      case 'explaining':
        return this.handleExplainingState(event);
      
      case 'requesting':
        return this.handleRequestingState(event);
      
      case 'granted':
        return this.handleGrantedState(event);
      
      case 'denied':
        return this.handleDeniedState(event);
      
      case 'restricted':
        return this.handleRestrictedState(event);
      
      case 'settings_redirect':
        return this.handleSettingsRedirectState(event);
      
      default:
        return this.state;
    }
  }

  /**
   * Initial State: Startpunkt, zeigt Erklärung oder geht direkt zu Request
   */
  private handleInitialState(event: PermissionFlowEvent): PermissionFlowState {
    switch (event.type) {
      case 'SHOW_EXPLANATION':
        this.context.explanationShownCount++;
        this.context.hasShownExplanation = true;
        this.state = 'explaining';
        break;
      
      case 'REQUEST_PERMISSION':
        this.context.hasRequestedPermission = true;
        this.context.lastRequestTime = Date.now();
        this.state = 'requesting';
        break;
      
      case 'RESET':
        this.reset();
        break;
    }
    
    return this.state;
  }

  /**
   * Explaining State: Zeigt Pre-Permission Erklärung
   */
  private handleExplainingState(event: PermissionFlowEvent): PermissionFlowState {
    switch (event.type) {
      case 'REQUEST_PERMISSION':
        this.context.hasRequestedPermission = true;
        this.context.lastRequestTime = Date.now();
        this.state = 'requesting';
        break;
      
      case 'RESET':
        this.reset();
        break;
    }
    
    return this.state;
  }

  /**
   * Requesting State: Wartet auf Permission-Response
   */
  private handleRequestingState(event: PermissionFlowEvent): PermissionFlowState {
    switch (event.type) {
      case 'PERMISSION_GRANTED':
        this.state = 'granted';
        break;
      
      case 'PERMISSION_DENIED':
        this.state = 'denied';
        break;
      
      case 'PERMISSION_RESTRICTED':
        this.state = 'restricted';
        break;
      
      case 'RESET':
        this.reset();
        break;
    }
    
    return this.state;
  }

  /**
   * Granted State: Permission erteilt
   */
  private handleGrantedState(event: PermissionFlowEvent): PermissionFlowState {
    switch (event.type) {
      case 'RESET':
        this.reset();
        break;
    }
    
    return this.state;
  }

  /**
   * Denied State: Permission verweigert
   */
  private handleDeniedState(event: PermissionFlowEvent): PermissionFlowState {
    switch (event.type) {
      case 'OPEN_SETTINGS':
        this.context.settingsRedirectCount++;
        this.state = 'settings_redirect';
        break;
      
      case 'RESET':
        this.reset();
        break;
    }
    
    return this.state;
  }

  /**
   * Restricted State: Permission eingeschränkt (Parental Controls etc.)
   */
  private handleRestrictedState(event: PermissionFlowEvent): PermissionFlowState {
    switch (event.type) {
      case 'OPEN_SETTINGS':
        this.context.settingsRedirectCount++;
        this.state = 'settings_redirect';
        break;
      
      case 'RESET':
        this.reset();
        break;
    }
    
    return this.state;
  }

  /**
   * Settings Redirect State: Benutzer zu Einstellungen weitergeleitet
   */
  private handleSettingsRedirectState(event: PermissionFlowEvent): PermissionFlowState {
    switch (event.type) {
      case 'PERMISSION_GRANTED':
        this.state = 'granted';
        break;
      
      case 'PERMISSION_DENIED':
        this.state = 'denied';
        break;
      
      case 'PERMISSION_RESTRICTED':
        this.state = 'restricted';
        break;
      
      case 'RESET':
        this.reset();
        break;
    }
    
    return this.state;
  }

  // =========================================================================
  // PUBLIC API
  // =========================================================================

  /**
   * Startet den Permission-Flow
   */
  start(): PermissionFlowState {
    // Zeige immer zuerst die Erklärung
    return this.dispatch({ type: 'SHOW_EXPLANATION' });
  }

  /**
   * Requestet Permission vom System
   */
  requestPermission(): PermissionFlowState {
    return this.dispatch({ type: 'REQUEST_PERMISSION' });
  }

  /**
   * Behandelt Permission-Response vom System
   */
  handlePermissionResponse(status: PermissionStatus): PermissionFlowState {
    switch (status) {
      case 'authorized':
      case 'provisional':
        return this.dispatch({ type: 'PERMISSION_GRANTED' });
      
      case 'denied':
        return this.dispatch({ type: 'PERMISSION_DENIED' });
      
      case 'restricted':
        return this.dispatch({ type: 'PERMISSION_RESTRICTED' });
      
      default:
        return this.state;
    }
  }

  /**
   * Öffnet System-Einstellungen
   */
  openSettings(): PermissionFlowState {
    return this.dispatch({ type: 'OPEN_SETTINGS' });
  }

  /**
   * Resetet den Flow
   */
  reset(): PermissionFlowState {
    this.state = 'initial';
    this.context = {
      hasShownExplanation: false,
      hasRequestedPermission: false,
      explanationShownCount: 0,
      settingsRedirectCount: 0
    };
    return this.state;
  }

  // =========================================================================
  // STATE QUERIES
  // =========================================================================

  /**
   * Aktueller State
   */
  getCurrentState(): PermissionFlowState {
    return this.state;
  }

  /**
   * Flow-Kontext
   */
  getContext(): PermissionFlowContext {
    return { ...this.context };
  }

  /**
   * Prüft ob Erklärung gezeigt werden soll
   */
  shouldShowExplanation(): boolean {
    return !this.context.hasShownExplanation;
  }

  /**
   * Prüft ob Permission requestet werden kann
   */
  canRequestPermission(): boolean {
    return this.state === 'explaining' || this.state === 'initial';
  }

  /**
   * Prüft ob Settings-Redirect möglich ist
   */
  canOpenSettings(): boolean {
    return this.state === 'denied' || this.state === 'restricted';
  }

  /**
   * Prüft ob Flow abgeschlossen ist
   */
  isCompleted(): boolean {
    return this.state === 'granted';
  }

  /**
   * Prüft ob Flow fehlgeschlagen ist
   */
  isFailed(): boolean {
    return this.state === 'denied' || this.state === 'restricted';
  }

  /**
   * Prüft ob Flow in Settings-Redirect ist
   */
  isInSettingsRedirect(): boolean {
    return this.state === 'settings_redirect';
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Generiert Permission-Flow-Result für UI
   */
  getFlowResult(): PermissionFlowResult {
    const status = this.getCurrentPermissionStatus();
    
    return {
      status,
      canRequest: this.canRequestPermission(),
      needsSettingsRedirect: this.canOpenSettings(),
      explanationRequired: this.shouldShowExplanation()
    };
  }

  /**
   * Simuliert aktuellen Permission-Status basierend auf State
   */
  private getCurrentPermissionStatus(): PermissionStatus {
    switch (this.state) {
      case 'granted':
        return 'authorized';
      
      case 'denied':
        return 'denied';
      
      case 'restricted':
        return 'restricted';
      
      default:
        return 'not_determined';
    }
  }

  /**
   * Debug-Info für Tests
   */
  getDebugInfo() {
    return {
      state: this.state,
      context: this.context,
      canRequest: this.canRequestPermission(),
      canOpenSettings: this.canOpenSettings(),
      isCompleted: this.isCompleted(),
      isFailed: this.isFailed()
    };
  }
}
