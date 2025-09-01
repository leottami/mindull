/**
 * Netzwerk-Status-Listener
 * Überwacht Online/Offline-Status und informiert Services
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { OfflineOutbox } from '../../services/offline/outbox';

// ============================================================================
// TYPES
// ============================================================================

export type NetworkStatus = 'online' | 'offline' | 'unknown';

export interface NetworkInfo {
  status: NetworkStatus;
  isConnected: boolean;
  isInternetReachable: boolean;
  type: string;
  isWifi: boolean;
  isCellular: boolean;
  strength?: number; // WLAN-Signalstärke
  lastUpdated: Date;
}

export interface NetworkListener {
  onOnline: () => void;
  onOffline: () => void;
  onStatusChange: (status: NetworkStatus) => void;
}

// ============================================================================
// NETWORK MANAGER
// ============================================================================

export class NetworkManager {
  private static instance: NetworkManager;
  private currentStatus: NetworkStatus = 'unknown';
  private listeners: Set<NetworkListener> = new Set();
  private isInitialized = false;
  private outbox: OfflineOutbox;

  private constructor() {
    this.outbox = OfflineOutbox.getInstance();
  }

  static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  /**
   * Initialisiert den Network Manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialer Status-Check
      const netInfo = await NetInfo.fetch();
      this.updateStatus(this.mapNetInfoToStatus(netInfo));

      // Event-Listener registrieren
      NetInfo.addEventListener(this.handleNetInfoChange.bind(this));

      this.isInitialized = true;
      console.log('Network Manager initialisiert');
    } catch (error) {
      console.error('Fehler beim Initialisieren des Network Managers:', error);
      // Fallback: Offline annehmen
      this.updateStatus('offline');
    }
  }

  /**
   * Registriert einen Listener
   */
  addListener(listener: NetworkListener): void {
    this.listeners.add(listener);
  }

  /**
   * Entfernt einen Listener
   */
  removeListener(listener: NetworkListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Gibt aktuellen Netzwerk-Status zurück
   */
  getStatus(): NetworkStatus {
    return this.currentStatus;
  }

  /**
   * Gibt detaillierte Netzwerk-Informationen zurück
   */
  async getNetworkInfo(): Promise<NetworkInfo> {
    try {
      const netInfo = await NetInfo.fetch();
      
      return {
        status: this.currentStatus,
        isConnected: netInfo.isConnected ?? false,
        isInternetReachable: netInfo.isInternetReachable ?? false,
        type: netInfo.type || 'unknown',
        isWifi: netInfo.type === 'wifi',
        isCellular: netInfo.type === 'cellular',
        strength: this.getSignalStrength(netInfo),
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Fehler beim Abrufen der Netzwerk-Informationen:', error);
      return {
        status: this.currentStatus,
        isConnected: false,
        isInternetReachable: false,
        type: 'unknown',
        isWifi: false,
        isCellular: false,
        lastUpdated: new Date()
      };
    }
  }

  /**
   * Prüft ob das Netzwerk verfügbar ist
   */
  isOnline(): boolean {
    return this.currentStatus === 'online';
  }

  /**
   * Prüft ob das Netzwerk offline ist
   */
  isOffline(): boolean {
    return this.currentStatus === 'offline';
  }

  /**
   * Manueller Status-Check (für Tests oder manuelle Updates)
   */
  async checkStatus(): Promise<NetworkStatus> {
    try {
      const netInfo = await NetInfo.fetch();
      const newStatus = this.mapNetInfoToStatus(netInfo);
      this.updateStatus(newStatus);
      return newStatus;
    } catch (error) {
      console.error('Fehler beim manuellen Status-Check:', error);
      return this.currentStatus;
    }
  }

  /**
   * Simuliert Netzwerk-Status (für Tests)
   */
  simulateStatus(status: NetworkStatus): void {
    this.updateStatus(status);
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Behandelt NetInfo-Änderungen
   */
  private handleNetInfoChange(state: NetInfoState): void {
    const newStatus = this.mapNetInfoToStatus(state);
    
    if (newStatus !== this.currentStatus) {
      this.updateStatus(newStatus);
    }
  }

  /**
   * Aktualisiert den Netzwerk-Status
   */
  private updateStatus(newStatus: NetworkStatus): void {
    const oldStatus = this.currentStatus;
    this.currentStatus = newStatus;

    console.log(`Netzwerk-Status geändert: ${oldStatus} → ${newStatus}`);

    // Benachrichtige alle Listener
    this.notifyListeners(newStatus, oldStatus);

    // Benachrichtige Outbox
    this.outbox.setNetworkStatus(newStatus);
  }

  /**
   * Benachrichtigt alle registrierten Listener
   */
  private notifyListeners(newStatus: NetworkStatus, oldStatus: NetworkStatus): void {
    this.listeners.forEach(listener => {
      try {
        // Allgemeine Status-Änderung
        listener.onStatusChange(newStatus);

        // Spezifische Events
        if (oldStatus === 'offline' && newStatus === 'online') {
          listener.onOnline();
        } else if (oldStatus === 'online' && newStatus === 'offline') {
          listener.onOffline();
        }
      } catch (error) {
        console.error('Fehler beim Benachrichtigen eines Listeners:', error);
      }
    });
  }

  /**
   * Mappt NetInfo-Status zu unserem NetworkStatus
   */
  private mapNetInfoToStatus(netInfo: NetInfoState): NetworkStatus {
    // Prüfe zuerst Internet-Reachability
    if (netInfo.isInternetReachable === false) {
      return 'offline';
    }

    // Dann Connection-Status
    if (netInfo.isConnected === false) {
      return 'offline';
    }

    // Wenn beides true ist, sind wir online
    if (netInfo.isConnected === true && netInfo.isInternetReachable === true) {
      return 'online';
    }

    // Fallback: Unbekannt
    return 'unknown';
  }

  /**
   * Extrahiert Signalstärke aus NetInfo
   */
  private getSignalStrength(netInfo: NetInfoState): number | undefined {
    if (netInfo.type === 'wifi' && netInfo.details) {
      // WLAN-Signalstärke (0-100)
      const strength = (netInfo.details as any).strength;
      if (typeof strength === 'number') {
        return Math.max(0, Math.min(100, strength));
      }
    }

    if (netInfo.type === 'cellular' && netInfo.details) {
      // Mobilfunk-Signalstärke (0-5)
      const strength = (netInfo.details as any).strength;
      if (typeof strength === 'number') {
        return Math.max(0, Math.min(5, strength));
      }
    }

    return undefined;
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Gibt den Network Manager zurück
 */
export function getNetworkManager(): NetworkManager {
  return NetworkManager.getInstance();
}

/**
 * Prüft ob das Netzwerk online ist
 */
export function isNetworkOnline(): boolean {
  return getNetworkManager().isOnline();
}

/**
 * Prüft ob das Netzwerk offline ist
 */
export function isNetworkOffline(): boolean {
  return getNetworkManager().isOffline();
}

/**
 * Registriert einen Network-Listener
 */
export function addNetworkListener(listener: NetworkListener): void {
  getNetworkManager().addListener(listener);
}

/**
 * Entfernt einen Network-Listener
 */
export function removeNetworkListener(listener: NetworkListener): void {
  getNetworkManager().removeListener(listener);
}

// ============================================================================
// HOOKS (für React Components)
// ============================================================================

/**
 * Hook für Netzwerk-Status
 */
export function useNetworkStatus(): NetworkStatus {
  // TODO: Implementiere React Hook mit useState/useEffect
  // Für jetzt geben wir den aktuellen Status zurück
  return getNetworkManager().getStatus();
}

/**
 * Hook für detaillierte Netzwerk-Informationen
 */
export function useNetworkInfo(): NetworkInfo | null {
  // TODO: Implementiere React Hook
  // Für jetzt geben wir null zurück
  return null;
}
