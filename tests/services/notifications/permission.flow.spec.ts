/**
 * Permission Flow Tests
 * Testet State-Maschine, Events und Edgecases für Notification-Permissions
 */

import { PermissionFlow, PermissionFlowState, PermissionStatus, PermissionFlowEvent } from '../../services/notifications/permission.flow';

// =========================================================================
// TEST HELPERS
// =========================================================================

const createFlow = () => new PermissionFlow();

const createEvent = (type: PermissionFlowEvent['type'], payload?: any): PermissionFlowEvent => ({
  type,
  payload
});

// =========================================================================
// TESTS
// =========================================================================

describe('PermissionFlow', () => {
  let flow: PermissionFlow;

  beforeEach(() => {
    flow = createFlow();
  });

  describe('Initial State', () => {
    it('should start in initial state', () => {
      expect(flow.getCurrentState()).toBe('initial');
    });

    it('should have empty context initially', () => {
      const context = flow.getContext();
      expect(context.hasShownExplanation).toBe(false);
      expect(context.hasRequestedPermission).toBe(false);
      expect(context.explanationShownCount).toBe(0);
      expect(context.settingsRedirectCount).toBe(0);
    });

    it('should show explanation initially', () => {
      expect(flow.shouldShowExplanation()).toBe(true);
    });

    it('should allow permission request initially', () => {
      expect(flow.canRequestPermission()).toBe(true);
    });

    it('should not allow settings redirect initially', () => {
      expect(flow.canOpenSettings()).toBe(false);
    });
  });

  describe('State Transitions', () => {
    it('should transition from initial to explaining on SHOW_EXPLANATION', () => {
      const newState = flow.dispatch(createEvent('SHOW_EXPLANATION'));
      expect(newState).toBe('explaining');
      expect(flow.getCurrentState()).toBe('explaining');
    });

    it('should transition from initial to requesting on REQUEST_PERMISSION', () => {
      const newState = flow.dispatch(createEvent('REQUEST_PERMISSION'));
      expect(newState).toBe('requesting');
      expect(flow.getCurrentState()).toBe('requesting');
    });

    it('should transition from explaining to requesting on REQUEST_PERMISSION', () => {
      flow.dispatch(createEvent('SHOW_EXPLANATION'));
      const newState = flow.dispatch(createEvent('REQUEST_PERMISSION'));
      expect(newState).toBe('requesting');
    });

    it('should transition from requesting to granted on PERMISSION_GRANTED', () => {
      flow.dispatch(createEvent('REQUEST_PERMISSION'));
      const newState = flow.dispatch(createEvent('PERMISSION_GRANTED'));
      expect(newState).toBe('granted');
    });

    it('should transition from requesting to denied on PERMISSION_DENIED', () => {
      flow.dispatch(createEvent('REQUEST_PERMISSION'));
      const newState = flow.dispatch(createEvent('PERMISSION_DENIED'));
      expect(newState).toBe('denied');
    });

    it('should transition from requesting to restricted on PERMISSION_RESTRICTED', () => {
      flow.dispatch(createEvent('REQUEST_PERMISSION'));
      const newState = flow.dispatch(createEvent('PERMISSION_RESTRICTED'));
      expect(newState).toBe('restricted');
    });

    it('should transition from denied to settings_redirect on OPEN_SETTINGS', () => {
      flow.dispatch(createEvent('REQUEST_PERMISSION'));
      flow.dispatch(createEvent('PERMISSION_DENIED'));
      const newState = flow.dispatch(createEvent('OPEN_SETTINGS'));
      expect(newState).toBe('settings_redirect');
    });

    it('should transition from restricted to settings_redirect on OPEN_SETTINGS', () => {
      flow.dispatch(createEvent('REQUEST_PERMISSION'));
      flow.dispatch(createEvent('PERMISSION_RESTRICTED'));
      const newState = flow.dispatch(createEvent('OPEN_SETTINGS'));
      expect(newState).toBe('settings_redirect');
    });
  });

  describe('Context Updates', () => {
    it('should update context when showing explanation', () => {
      flow.dispatch(createEvent('SHOW_EXPLANATION'));
      const context = flow.getContext();
      expect(context.hasShownExplanation).toBe(true);
      expect(context.explanationShownCount).toBe(1);
    });

    it('should update context when requesting permission', () => {
      flow.dispatch(createEvent('REQUEST_PERMISSION'));
      const context = flow.getContext();
      expect(context.hasRequestedPermission).toBe(true);
      expect(context.lastRequestTime).toBeDefined();
    });

    it('should increment settings redirect count', () => {
      flow.dispatch(createEvent('REQUEST_PERMISSION'));
      flow.dispatch(createEvent('PERMISSION_DENIED'));
      flow.dispatch(createEvent('OPEN_SETTINGS'));
      
      const context = flow.getContext();
      expect(context.settingsRedirectCount).toBe(1);
    });

    it('should track multiple explanation shows', () => {
      flow.dispatch(createEvent('SHOW_EXPLANATION'));
      flow.reset();
      flow.dispatch(createEvent('SHOW_EXPLANATION'));
      
      const context = flow.getContext();
      expect(context.explanationShownCount).toBe(1); // Reset to 0, then 1
    });
  });

  describe('Public API', () => {
    it('should start flow correctly', () => {
      const state = flow.start();
      expect(state).toBe('explaining');
      expect(flow.getCurrentState()).toBe('explaining');
    });

    it('should request permission correctly', () => {
      flow.start();
      const state = flow.requestPermission();
      expect(state).toBe('requesting');
    });

    it('should handle permission response correctly', () => {
      flow.start();
      flow.requestPermission();
      
      const grantedState = flow.handlePermissionResponse('authorized');
      expect(grantedState).toBe('granted');
      
      flow.reset();
      flow.start();
      flow.requestPermission();
      
      const deniedState = flow.handlePermissionResponse('denied');
      expect(deniedState).toBe('denied');
    });

    it('should open settings correctly', () => {
      flow.start();
      flow.requestPermission();
      flow.handlePermissionResponse('denied');
      
      const state = flow.openSettings();
      expect(state).toBe('settings_redirect');
    });

    it('should reset flow correctly', () => {
      flow.start();
      flow.requestPermission();
      flow.handlePermissionResponse('granted');
      
      const resetState = flow.reset();
      expect(resetState).toBe('initial');
      expect(flow.getCurrentState()).toBe('initial');
      
      const context = flow.getContext();
      expect(context.hasShownExplanation).toBe(false);
      expect(context.hasRequestedPermission).toBe(false);
    });
  });

  describe('State Queries', () => {
    it('should correctly identify completed state', () => {
      flow.start();
      flow.requestPermission();
      flow.handlePermissionResponse('authorized');
      
      expect(flow.isCompleted()).toBe(true);
    });

    it('should correctly identify failed state', () => {
      flow.start();
      flow.requestPermission();
      flow.handlePermissionResponse('denied');
      
      expect(flow.isFailed()).toBe(true);
    });

    it('should correctly identify settings redirect state', () => {
      flow.start();
      flow.requestPermission();
      flow.handlePermissionResponse('denied');
      flow.openSettings();
      
      expect(flow.isInSettingsRedirect()).toBe(true);
    });

    it('should correctly identify when explanation should be shown', () => {
      expect(flow.shouldShowExplanation()).toBe(true);
      
      flow.start();
      expect(flow.shouldShowExplanation()).toBe(false);
    });

    it('should correctly identify when permission can be requested', () => {
      expect(flow.canRequestPermission()).toBe(true);
      
      flow.start();
      expect(flow.canRequestPermission()).toBe(true);
      
      flow.requestPermission();
      expect(flow.canRequestPermission()).toBe(false);
    });

    it('should correctly identify when settings can be opened', () => {
      expect(flow.canOpenSettings()).toBe(false);
      
      flow.start();
      flow.requestPermission();
      flow.handlePermissionResponse('denied');
      
      expect(flow.canOpenSettings()).toBe(true);
    });
  });

  describe('Flow Result', () => {
    it('should generate correct flow result for initial state', () => {
      const result = flow.getFlowResult();
      expect(result.status).toBe('not_determined');
      expect(result.canRequest).toBe(true);
      expect(result.needsSettingsRedirect).toBe(false);
      expect(result.explanationRequired).toBe(true);
    });

    it('should generate correct flow result for granted state', () => {
      flow.start();
      flow.requestPermission();
      flow.handlePermissionResponse('authorized');
      
      const result = flow.getFlowResult();
      expect(result.status).toBe('authorized');
      expect(result.canRequest).toBe(false);
      expect(result.needsSettingsRedirect).toBe(false);
      expect(result.explanationRequired).toBe(false);
    });

    it('should generate correct flow result for denied state', () => {
      flow.start();
      flow.requestPermission();
      flow.handlePermissionResponse('denied');
      
      const result = flow.getFlowResult();
      expect(result.status).toBe('denied');
      expect(result.canRequest).toBe(false);
      expect(result.needsSettingsRedirect).toBe(true);
      expect(result.explanationRequired).toBe(false);
    });

    it('should generate correct flow result for restricted state', () => {
      flow.start();
      flow.requestPermission();
      flow.handlePermissionResponse('restricted');
      
      const result = flow.getFlowResult();
      expect(result.status).toBe('restricted');
      expect(result.canRequest).toBe(false);
      expect(result.needsSettingsRedirect).toBe(true);
      expect(result.explanationRequired).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid events gracefully', () => {
      const initialState = flow.getCurrentState();
      
      // Teste ungültige Events in verschiedenen States
      flow.dispatch(createEvent('PERMISSION_GRANTED')); // Sollte nichts ändern
      expect(flow.getCurrentState()).toBe(initialState);
      
      flow.start();
      flow.dispatch(createEvent('SHOW_EXPLANATION')); // Sollte nichts ändern
      expect(flow.getCurrentState()).toBe('explaining');
    });

    it('should handle multiple permission requests', () => {
      flow.start();
      flow.requestPermission();
      flow.handlePermissionResponse('denied');
      
      // Zweiter Request sollte nicht möglich sein
      const state = flow.requestPermission();
      expect(state).toBe('denied'); // Bleibt im denied State
    });

    it('should handle settings redirect from granted state', () => {
      flow.start();
      flow.requestPermission();
      flow.handlePermissionResponse('authorized');
      
      // Settings-Öffnung sollte nicht möglich sein
      const state = flow.openSettings();
      expect(state).toBe('granted'); // Bleibt im granted State
    });

    it('should handle permission response in wrong state', () => {
      // Permission response ohne vorherigen Request
      const state = flow.handlePermissionResponse('authorized');
      expect(state).toBe('initial'); // Bleibt im initial State
    });
  });

  describe('Debug Info', () => {
    it('should provide complete debug info', () => {
      const debugInfo = flow.getDebugInfo();
      
      expect(debugInfo).toHaveProperty('state');
      expect(debugInfo).toHaveProperty('context');
      expect(debugInfo).toHaveProperty('canRequest');
      expect(debugInfo).toHaveProperty('canOpenSettings');
      expect(debugInfo).toHaveProperty('isCompleted');
      expect(debugInfo).toHaveProperty('isFailed');
    });

    it('should update debug info correctly', () => {
      const initialDebug = flow.getDebugInfo();
      expect(initialDebug.state).toBe('initial');
      expect(initialDebug.isCompleted).toBe(false);
      
      flow.start();
      flow.requestPermission();
      flow.handlePermissionResponse('authorized');
      
      const finalDebug = flow.getDebugInfo();
      expect(finalDebug.state).toBe('granted');
      expect(finalDebug.isCompleted).toBe(true);
    });
  });

  describe('Complete Flow Scenarios', () => {
    it('should handle successful flow: explain → request → granted', () => {
      const state1 = flow.start();
      expect(state1).toBe('explaining');
      
      const state2 = flow.requestPermission();
      expect(state2).toBe('requesting');
      
      const state3 = flow.handlePermissionResponse('authorized');
      expect(state3).toBe('granted');
      
      expect(flow.isCompleted()).toBe(true);
      expect(flow.isFailed()).toBe(false);
    });

    it('should handle denied flow: explain → request → denied → settings', () => {
      flow.start();
      flow.requestPermission();
      const deniedState = flow.handlePermissionResponse('denied');
      expect(deniedState).toBe('denied');
      
      const settingsState = flow.openSettings();
      expect(settingsState).toBe('settings_redirect');
      
      expect(flow.isCompleted()).toBe(false);
      expect(flow.isFailed()).toBe(true);
    });

    it('should handle restricted flow: explain → request → restricted → settings', () => {
      flow.start();
      flow.requestPermission();
      const restrictedState = flow.handlePermissionResponse('restricted');
      expect(restrictedState).toBe('restricted');
      
      const settingsState = flow.openSettings();
      expect(settingsState).toBe('settings_redirect');
      
      expect(flow.isCompleted()).toBe(false);
      expect(flow.isFailed()).toBe(true);
    });

    it('should handle settings redirect recovery: settings → granted', () => {
      flow.start();
      flow.requestPermission();
      flow.handlePermissionResponse('denied');
      flow.openSettings();
      
      const recoveredState = flow.handlePermissionResponse('authorized');
      expect(recoveredState).toBe('granted');
      
      expect(flow.isCompleted()).toBe(true);
    });
  });
});
