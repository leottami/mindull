import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

/**
 * Supabase-Client-Konfiguration
 * Liest URL und ANON-Key aus Umgebungsvariablen
 * Keine Secrets im Repository - nur über .env
 */
class SupabaseClientManager {
  private static instance: SupabaseClient<Database> | null = null;
  
  /**
   * Erstellt oder gibt den Supabase-Client zurück
   * @returns Konfigurierter Supabase-Client
   * @throws Error wenn Umgebungsvariablen fehlen
   */
  static getClient(): SupabaseClient<Database> {
    if (!this.instance) {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('DB_CLIENT_CONFIG_ERROR: Supabase URL oder ANON-Key fehlt');
      }
      
      this.instance = createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: false, // Verwende iOS Keychain stattdessen
          detectSessionInUrl: false
        },
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            'X-Client-Info': 'mindull-ios'
          }
        }
      });
    }
    
    return this.instance;
  }
  
  /**
   * Setzt den Client zurück (für Tests)
   */
  static reset(): void {
    this.instance = null;
  }
}

export const supabase = SupabaseClientManager.getClient();
export { SupabaseClientManager };
