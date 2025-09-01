import { supabase } from './supabase.client';
import { createDBError, DBErrorCode, logDBError } from './errors';

/**
 * Health-Check-Ergebnis
 */
export interface HealthCheckResult {
  online: boolean;
  latency?: number;
  error?: string;
  timestamp: Date;
}

/**
 * Führt eine leichte Read-Probe gegen die Datenbank aus
 * Verwendet eine einfache SELECT-Abfrage ohne Authentifizierung
 * 
 * @param timeoutMs Timeout in Millisekunden (Standard: 5000ms)
 * @returns Health-Check-Ergebnis
 */
export async function checkDBHealth(timeoutMs: number = 5000): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    // Prüfe Netzwerk-Status
    if (!navigator.onLine) {
      return {
        online: false,
        error: 'Offline-Modus',
        timestamp: new Date()
      };
    }
    
    // Führe leichte Probe aus (SELECT 1)
    const { data, error } = await Promise.race([
      supabase.from('_health_check').select('1').limit(1),
      new Promise<{ error: any }>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      )
    ]);
    
    const latency = Date.now() - startTime;
    
    if (error) {
      // Erwarteter Fehler bei nicht existierender Tabelle
      // Aber Verbindung funktioniert
      return {
        online: true,
        latency,
        timestamp: new Date()
      };
    }
    
    return {
      online: true,
      latency,
      timestamp: new Date()
    };
    
  } catch (error: any) {
    const dbError = createDBError(
      DBErrorCode.NETWORK_ERROR,
      'Health-Check fehlgeschlagen',
      true,
      error
    );
    
    logDBError(dbError);
    
    return {
      online: false,
      error: dbError.message,
      timestamp: new Date()
    };
  }
}

/**
 * Führt einen erweiterten Health-Check mit Auth-Status aus
 * Nur für authentifizierte Benutzer
 */
export async function checkDBHealthWithAuth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    // Prüfe Auth-Status
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError) {
      return {
        online: false,
        error: 'Auth-Fehler',
        timestamp: new Date()
      };
    }
    
    if (!session) {
      return {
        online: false,
        error: 'Nicht authentifiziert',
        timestamp: new Date()
      };
    }
    
    // Führe authentifizierte Probe aus
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('id', session.user.id)
      .limit(1);
    
    const latency = Date.now() - startTime;
    
    if (error) {
      const dbError = createDBError(
        DBErrorCode.UNAUTHORIZED,
        'Auth-Health-Check fehlgeschlagen',
        false,
        error
      );
      
      logDBError(dbError);
      
      return {
        online: false,
        error: dbError.message,
        timestamp: new Date()
      };
    }
    
    return {
      online: true,
      latency,
      timestamp: new Date()
    };
    
  } catch (error: any) {
    const dbError = createDBError(
      DBErrorCode.NETWORK_ERROR,
      'Auth-Health-Check fehlgeschlagen',
      true,
      error
    );
    
    logDBError(dbError);
    
    return {
      online: false,
      error: dbError.message,
      timestamp: new Date()
    };
  }
}

/**
 * Kontinuierlicher Health-Monitor
 * Führt regelmäßige Checks aus und ruft Callback auf
 */
export class HealthMonitor {
  private intervalId?: NodeJS.Timeout;
  private isRunning = false;
  
  /**
   * Startet kontinuierliches Monitoring
   * @param intervalMs Intervall in Millisekunden
   * @param onHealthChange Callback bei Status-Änderung
   */
  start(
    intervalMs: number = 30000,
    onHealthChange?: (result: HealthCheckResult) => void
  ): void {
    if (this.isRunning) {
      return;
    }
    
    this.isRunning = true;
    
    this.intervalId = setInterval(async () => {
      const result = await checkDBHealth();
      onHealthChange?.(result);
    }, intervalMs);
  }
  
  /**
   * Stoppt das Monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
  }
  
  /**
   * Gibt zurück ob Monitoring läuft
   */
  get isActive(): boolean {
    return this.isRunning;
  }
}
