/**
 * AI Insights Screen
 * Container-Logik für Evening/Morning AI-Insights
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';

// AI Services
import { 
  DataAggregator, 
  PromptBuilder, 
  OpenAIClient,
  type DataProvider,
  type EveningAggregation,
  type MorningAggregation,
  type AIResponse,
  type FallbackResponse
} from '../../../services/ai';

// Settings Bridge
import { 
  AISettingsBridge, 
  type AISettings, 
  type AIUsageStats,
  type AIInsightTrigger 
} from '../../../services/ai/settings.bridge';

/**
 * Insights Screen Props
 */
interface InsightsScreenProps {
  userId: string;
  dataProvider: DataProvider;
  onInsightGenerated?: (type: 'evening' | 'morning', content: string) => void;
}

/**
 * Screen State
 */
interface InsightsScreenState {
  settings: AISettings | null;
  usageStats: AIUsageStats | null;
  eveningTrigger: AIInsightTrigger | null;
  morningTrigger: AIInsightTrigger | null;
  currentInsight: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * AI Insights Screen Component
 */
export const InsightsScreen: React.FC<InsightsScreenProps> = ({
  userId,
  dataProvider,
  onInsightGenerated
}) => {
  const [state, setState] = useState<InsightsScreenState>({
    settings: null,
    usageStats: null,
    eveningTrigger: null,
    morningTrigger: null,
    currentInsight: null,
    isLoading: false,
    error: null
  });

  const [openAIClient] = useState(() => new OpenAIClient());

  /**
   * Lädt initiale Daten
   */
  useEffect(() => {
    loadInitialData();
  }, [userId]);

  /**
   * Prüft Insights beim App-Start
   */
  useEffect(() => {
    checkInsightTriggers();
  }, [state.settings]);

  /**
   * Lädt initiale Daten
   */
  const loadInitialData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Lade Settings
      const settings = await AISettingsBridge.getSettings(userId);
      
      // Lade Rate-Limit Status
      const rateLimitStatus = await openAIClient.getRateLimitStatus(userId);
      
      // Lade Usage Stats
      const usageStats = await AISettingsBridge.getUsageStats(userId, rateLimitStatus);

      setState(prev => ({
        ...prev,
        settings,
        usageStats,
        isLoading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Fehler beim Laden der Einstellungen'
      }));
    }
  }, [userId, openAIClient]);

  /**
   * Prüft ob Insights angezeigt werden sollen
   */
  const checkInsightTriggers = useCallback(async () => {
    if (!state.settings) return;

    try {
      const [eveningTrigger, morningTrigger] = await Promise.all([
        AISettingsBridge.shouldShowEveningInsight(userId),
        AISettingsBridge.shouldShowMorningInsight(userId)
      ]);

      setState(prev => ({
        ...prev,
        eveningTrigger,
        morningTrigger
      }));

      // Zeige Auto-Hinweis wenn nötig
      if (eveningTrigger.shouldShow) {
        showEveningReminder();
      } else if (morningTrigger.shouldShow) {
        showMorningReminder();
      }
    } catch (error) {
      console.error('Error checking insight triggers:', error);
    }
  }, [userId, state.settings]);

  /**
   * Zeigt Evening-Reminder
   */
  const showEveningReminder = () => {
    Alert.alert(
      'Tagesrückblick',
      'Es ist Zeit für deinen täglichen Rückblick. Möchtest du jetzt ein AI-Insight erstellen?',
      [
        { text: 'Später', style: 'cancel' },
        { text: 'Jetzt erstellen', onPress: () => generateEveningInsight() }
      ]
    );
  };

  /**
   * Zeigt Morning-Reminder
   */
  const showMorningReminder = () => {
    Alert.alert(
      'Tagesfokus',
      'Es ist Zeit für deinen Tagesfokus. Möchtest du jetzt ein AI-Insight erstellen?',
      [
        { text: 'Später', style: 'cancel' },
        { text: 'Jetzt erstellen', onPress: () => generateMorningInsight() }
      ]
    );
  };

  /**
   * Generiert Evening-Insight
   */
  const generateEveningInsight = useCallback(async () => {
    if (!state.settings) return;

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Prüfe ob AI-Insights verfügbar sind
      const rateLimitStatus = await openAIClient.getRateLimitStatus(userId);
      const canUse = await AISettingsBridge.canUseAIInsights(userId, rateLimitStatus);

      if (!canUse.canUse) {
        Alert.alert('Nicht verfügbar', canUse.reason || 'AI-Insights sind derzeit nicht verfügbar');
        return;
      }

      // Aggregiere Daten
      const aggregation = await DataAggregator.aggregateEvening(userId, dataProvider);

      // Erstelle Prompt
      const prompt = PromptBuilder.buildEveningPrompt(aggregation, {
        language: state.settings.language
      });

      // Sende AI-Request
      const response = await openAIClient.sendRequest({
        prompt,
        userId
      });

      // Verarbeite Response
      const insight = response.isFallback 
        ? response.content 
        : response.content;

      // Markiere als erstellt
      await AISettingsBridge.markEveningInsightCreated(userId, insight);

      // Update State
      setState(prev => ({
        ...prev,
        currentInsight: insight,
        isLoading: false
      }));

      // Callback
      onInsightGenerated?.('evening', insight);

      // Update Triggers
      await checkInsightTriggers();

    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Fehler beim Erstellen des Evening-Insights'
      }));
    }
  }, [userId, state.settings, dataProvider, openAIClient, onInsightGenerated, checkInsightTriggers]);

  /**
   * Generiert Morning-Insight
   */
  const generateMorningInsight = useCallback(async () => {
    if (!state.settings) return;

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Prüfe ob AI-Insights verfügbar sind
      const rateLimitStatus = await openAIClient.getRateLimitStatus(userId);
      const canUse = await AISettingsBridge.canUseAIInsights(userId, rateLimitStatus);

      if (!canUse.canUse) {
        Alert.alert('Nicht verfügbar', canUse.reason || 'AI-Insights sind derzeit nicht verfügbar');
        return;
      }

      // Aggregiere Daten
      const aggregation = await DataAggregator.aggregateMorning(userId, dataProvider);

      // Erstelle Prompt
      const prompt = PromptBuilder.buildMorningPrompt(aggregation, {
        language: state.settings.language
      });

      // Sende AI-Request
      const response = await openAIClient.sendRequest({
        prompt,
        userId
      });

      // Verarbeite Response
      const insight = response.isFallback 
        ? response.content 
        : response.content;

      // Markiere als erstellt
      await AISettingsBridge.markMorningInsightCreated(userId, insight);

      // Update State
      setState(prev => ({
        ...prev,
        currentInsight: insight,
        isLoading: false
      }));

      // Callback
      onInsightGenerated?.('morning', insight);

      // Update Triggers
      await checkInsightTriggers();

    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Fehler beim Erstellen des Morning-Insights'
      }));
    }
  }, [userId, state.settings, dataProvider, openAIClient, onInsightGenerated, checkInsightTriggers]);

  /**
   * Aktualisiert Settings
   */
  const updateSettings = useCallback(async (updates: Partial<AISettings>) => {
    if (!state.settings) return;

    try {
      const updatedSettings = await AISettingsBridge.updateSettings(userId, updates);
      setState(prev => ({ ...prev, settings: updatedSettings }));
    } catch (error) {
      setState(prev => ({ ...prev, error: 'Fehler beim Speichern der Einstellungen' }));
    }
  }, [userId, state.settings]);

  /**
   * Toggle AI-Insights
   */
  const toggleAIInsights = () => {
    if (!state.settings) return;
    updateSettings({ enabled: !state.settings.enabled });
  };

  /**
   * Toggle Evening Reminder
   */
  const toggleEveningReminder = () => {
    if (!state.settings) return;
    updateSettings({ eveningReminderEnabled: !state.settings.eveningReminderEnabled });
  };

  /**
   * Toggle Morning Reminder
   */
  const toggleMorningReminder = () => {
    if (!state.settings) return;
    updateSettings({ morningReminderEnabled: !state.settings.morningReminderEnabled });
  };

  /**
   * Render Loading State
   */
  if (state.isLoading && !state.settings) {
    return (
      <View>
        <ActivityIndicator size="large" />
        <Text>Lade AI-Einstellungen...</Text>
      </View>
    );
  }

  /**
   * Render Error State
   */
  if (state.error) {
    return (
      <View>
        <Text>Fehler: {state.error}</Text>
        <TouchableOpacity onPress={loadInitialData}>
          <Text>Erneut versuchen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  /**
   * Render Main Content
   */
  return (
    <View>
      {/* AI Settings Section */}
      <View>
        <Text>AI-Insights Einstellungen</Text>
        
        <TouchableOpacity onPress={toggleAIInsights}>
          <Text>
            AI-Insights: {state.settings?.enabled ? 'Aktiviert' : 'Deaktiviert'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={toggleEveningReminder}>
          <Text>
            Evening Reminder: {state.settings?.eveningReminderEnabled ? 'Aktiviert' : 'Deaktiviert'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={toggleMorningReminder}>
          <Text>
            Morning Reminder: {state.settings?.morningReminderEnabled ? 'Aktiviert' : 'Deaktiviert'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Usage Statistics */}
      {state.usageStats && (
        <View>
          <Text>Nutzung heute:</Text>
          <Text>{state.usageStats.callsText}</Text>
          <Text>{state.usageStats.tokensText}</Text>
          <Text>Status: {state.usageStats.statusText}</Text>
        </View>
      )}

      {/* Insight Triggers */}
      <View>
        <Text>Verfügbare Insights:</Text>
        
        {state.eveningTrigger && (
          <View>
            <Text>
              Evening Insight: {state.eveningTrigger.shouldShow ? 'Verfügbar' : 'Nicht verfügbar'}
            </Text>
            <Text>Grund: {state.eveningTrigger.reason}</Text>
            {state.eveningTrigger.shouldShow && (
              <TouchableOpacity 
                onPress={generateEveningInsight}
                disabled={state.isLoading}
              >
                <Text>Tagesrückblick erstellen</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {state.morningTrigger && (
          <View>
            <Text>
              Morning Insight: {state.morningTrigger.shouldShow ? 'Verfügbar' : 'Nicht verfügbar'}
            </Text>
            <Text>Grund: {state.morningTrigger.reason}</Text>
            {state.morningTrigger.shouldShow && (
              <TouchableOpacity 
                onPress={generateMorningInsight}
                disabled={state.isLoading}
              >
                <Text>Tagesfokus erstellen</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Current Insight */}
      {state.currentInsight && (
        <View>
          <Text>Aktuelles Insight:</Text>
          <Text>{state.currentInsight}</Text>
        </View>
      )}

      {/* Loading Indicator */}
      {state.isLoading && (
        <View>
          <ActivityIndicator size="small" />
          <Text>Erstelle AI-Insight...</Text>
        </View>
      )}
    </View>
  );
};

export default InsightsScreen;
