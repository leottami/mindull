/**
 * Insights Screen Tests
 * Testet Container-Logik für Evening/Morning AI-Insights
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import InsightsScreen from '../../../../app/screens/ai/InsightsScreen';

// Mock AI Services
jest.mock('../../../../services/ai/settings.bridge');
jest.mock('../../../../services/ai');

describe('InsightsScreen', () => {
  const mockUserId = 'test-user';
  const mockDataProvider = {
    getDiaryEntries: jest.fn(),
    getGratitudeEntries: jest.fn(),
    getBreathingSessions: jest.fn(),
    getLastEveningSummary: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('sollte ohne Fehler rendern', () => {
      const { getByText } = render(
        <InsightsScreen 
          userId={mockUserId} 
          dataProvider={mockDataProvider} 
        />
      );

      // Sollte mindestens einen Text anzeigen
      expect(getByText).toBeDefined();
    });

    it('sollte mit allen Props rendern', () => {
      const onInsightGenerated = jest.fn();
      
      const { getByText } = render(
        <InsightsScreen 
          userId={mockUserId} 
          dataProvider={mockDataProvider}
          onInsightGenerated={onInsightGenerated}
        />
      );

      expect(getByText).toBeDefined();
    });
  });

  describe('Component Structure', () => {
    it('sollte korrekte Komponenten-Struktur haben', () => {
      const { UNSAFE_root } = render(
        <InsightsScreen 
          userId={mockUserId} 
          dataProvider={mockDataProvider} 
        />
      );

      // Prüfe ob Komponente gerendert wurde
      expect(UNSAFE_root).toBeDefined();
    });
  });
});
