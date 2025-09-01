# Settings-Bridge (Breath) Implementation

## Overview

The Settings-Bridge provides a comprehensive interface between user preferences and the breath functionality. It manages all configurable settings for breathing exercises, including audio/haptic feedback, default methods, custom phase durations, and session preferences.

## Architecture

### Core Components

1. **BreathSettings Interface** - Defines all configurable options
2. **BreathSettingsValidator** - Validates and corrects settings
3. **BreathSettingsBridge** - Singleton service for settings management
4. **BreathSettingsScreen** - UI container for settings management

### Data Flow

```
User Input → BreathSettingsScreen → BreathSettingsBridge → Validation → Storage
     ↓
BreathScreen ← BreathSettingsBridge ← Settings ← AsyncStorage
```

## Implementation Details

### 1. BreathSettings Interface

```typescript
export interface BreathSettings {
  // Audio & Haptic Settings
  audioEnabled: boolean;
  hapticEnabled: boolean;
  audioIntensity: CueIntensity;
  hapticIntensity: CueIntensity;
  
  // Default Method Settings
  defaultMethod: BreathingMethod;
  defaultCycles: number;
  
  // Custom Phase Settings
  customPhases: {
    inhaleSec: number;
    holdSec: number;
    exhaleSec: number;
    holdAfterExhaleSec: number;
  };
  
  // Session Preferences
  autoStart: boolean;
  backgroundBehavior: 'pause' | 'stop' | 'continue';
  showProgress: boolean;
  
  // Advanced Settings
  strictTiming: boolean;
  allowInterruptions: boolean;
  sessionReminders: boolean;
}
```

### 2. Default Settings

```typescript
export const DEFAULT_BREATH_SETTINGS: BreathSettings = {
  audioEnabled: true,
  hapticEnabled: true,
  audioIntensity: 'gentle',
  hapticIntensity: 'gentle',
  defaultMethod: 'box',
  defaultCycles: 5,
  customPhases: {
    inhaleSec: 4,
    holdSec: 4,
    exhaleSec: 4,
    holdAfterExhaleSec: 4,
  },
  autoStart: false,
  backgroundBehavior: 'pause',
  showProgress: true,
  strictTiming: false,
  allowInterruptions: true,
  sessionReminders: false,
};
```

### 3. Validation System

The `BreathSettingsValidator` provides comprehensive validation:

- **Type Validation**: Ensures correct data types
- **Range Validation**: Validates against `BREATHING_CONSTRAINTS`
- **Method Validation**: Ensures default method exists
- **Cycle Validation**: Validates against method-specific limits
- **Phase Validation**: Ensures custom phases are within bounds
- **Logic Validation**: Checks for problematic combinations

#### Validation Features

- **Auto-correction**: Automatically corrects invalid values
- **Warnings**: Provides warnings for problematic combinations
- **Single Setting Validation**: Validates individual settings
- **Bulk Validation**: Validates entire settings object

### 4. BreathSettingsBridge Service

#### Singleton Pattern

```typescript
export class BreathSettingsBridge {
  private static instance: BreathSettingsBridge;
  
  static getInstance(): BreathSettingsBridge {
    if (!BreathSettingsBridge.instance) {
      BreathSettingsBridge.instance = new BreathSettingsBridge();
    }
    return BreathSettingsBridge.instance;
  }
}
```

#### Core Methods

- `loadSettings()`: Loads settings from storage
- `saveSettings()`: Saves settings to storage
- `updateSetting()`: Updates a single setting
- `resetSettings()`: Resets to default values
- `getCueSettings()`: Converts to CueSettings
- `getControllerConfig()`: Converts to BreathControllerConfig

#### Change Event System

```typescript
export interface BreathSettingsChangeEvent {
  type: 'setting_changed' | 'settings_reset' | 'settings_loaded';
  key?: keyof BreathSettings;
  oldValue?: any;
  newValue?: any;
  timestamp: number;
}
```

### 5. BreathSettingsScreen Component

#### State Management

```typescript
function useBreathSettingsLogic() {
  const [settings, setSettings] = useState<BreathSettings>(DEFAULT_BREATH_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeSection, setActiveSection] = useState<BreathSettingsSection>('audio');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
}
```

#### Sections

1. **Audio & Haptics**: Toggle audio/haptic, intensity selection
2. **Default Method**: Method selection, cycle count
3. **Custom Phases**: Phase duration configuration
4. **Session Preferences**: Auto-start, background behavior, progress display
5. **Advanced Settings**: Strict timing, interruptions, reminders

## Integration Points

### 1. BreathScreen Integration

The `BreathScreen` can use settings to configure:

```typescript
// TODO: Aus Settings
const audioEnabled = true;
const hapticEnabled = true;
const defaultMethod = 'box';
const defaultCycles = 5;
const customPhases = { inhaleSec: 4, holdSec: 4, exhaleSec: 4, holdAfterExhaleSec: 4 };
const backgroundBehavior = 'pause';
```

### 2. BreathController Integration

Settings are converted to controller configuration:

```typescript
getControllerConfig(): {
  audioEnabled: boolean;
  hapticEnabled: boolean;
  cueSettings: CueSettings;
  backgroundBehavior: 'pause' | 'stop' | 'continue';
  strictTiming: boolean;
  allowInterruptions: boolean;
}
```

### 3. CueService Integration

Settings are converted to cue configuration:

```typescript
getCueSettings(): CueSettings {
  return {
    audioEnabled: this.settings.audioEnabled,
    hapticEnabled: this.settings.hapticEnabled,
    audioIntensity: this.settings.audioIntensity,
    hapticIntensity: this.settings.hapticIntensity,
  };
}
```

## Error Handling

### 1. Validation Errors

- Invalid values are automatically corrected
- Errors are logged and reported to UI
- Graceful fallback to default values

### 2. Storage Errors

- AsyncStorage failures are handled gracefully
- Settings remain in memory if storage fails
- Error events are logged for debugging

### 3. Listener Errors

- Individual listener failures don't affect others
- Errors are logged but don't crash the system
- Graceful degradation of change notifications

## Testing Strategy

### 1. Unit Tests

- **BreathSettingsValidator**: Comprehensive validation tests
- **BreathSettingsBridge**: Singleton pattern, CRUD operations
- **BreathSettingsUtils**: Utility function tests

### 2. Integration Tests

- **Full Settings Workflow**: Load → Modify → Save → Validate
- **Validation with Correction**: Invalid input → Auto-correction
- **Change Event System**: Listener registration and notification

### 3. Error Scenarios

- **Invalid Settings**: Test validation and correction
- **Storage Failures**: Test graceful degradation
- **Listener Errors**: Test error isolation

## Performance Considerations

### 1. Memory Management

- Singleton pattern prevents multiple instances
- Settings are cached in memory for fast access
- Change listeners are properly cleaned up

### 2. Storage Optimization

- Settings are only saved when changed
- Batch updates reduce storage operations
- Validation prevents unnecessary saves

### 3. Event System

- Change events are batched when possible
- Listeners are called asynchronously
- Error isolation prevents cascading failures

## Accessibility Features

### 1. Screen Reader Support

- All interactive elements have accessibility labels
- State changes are announced
- Error messages are accessible

### 2. Keyboard Navigation

- Logical tab order through settings sections
- Keyboard shortcuts for common actions
- Focus management for dynamic content

### 3. Visual Feedback

- Clear visual indicators for current settings
- Validation errors are prominently displayed
- Loading and saving states are communicated

## Future Enhancements

### 1. Settings Profiles

- Multiple user profiles
- Import/export settings
- Cloud synchronization

### 2. Advanced Validation

- Cross-field validation rules
- Custom validation functions
- Real-time validation feedback

### 3. Settings Analytics

- Usage tracking for settings
- A/B testing for defaults
- User preference insights

## Usage Examples

### 1. Loading Settings

```typescript
const settingsBridge = createBreathSettingsBridge();
const settings = await settingsBridge.loadSettings();
```

### 2. Updating a Setting

```typescript
await settingsBridge.updateSetting('audioEnabled', false);
```

### 3. Getting Controller Config

```typescript
const config = settingsBridge.getControllerConfig();
const controller = createBreathController(config);
```

### 4. Listening for Changes

```typescript
const unsubscribe = settingsBridge.onSettingsChange((event) => {
  console.log('Settings changed:', event);
});
```

## Constraints and Limitations

### 1. Storage Dependencies

- Requires AsyncStorage to be available
- Settings are lost if storage fails
- No offline persistence beyond memory

### 2. Validation Constraints

- Validation rules are hardcoded
- No custom validation functions
- Limited cross-field validation

### 3. Performance Limits

- All settings loaded at startup
- No lazy loading of settings
- Change events are synchronous

## Conclusion

The Settings-Bridge provides a robust foundation for managing user preferences in the breath functionality. It offers comprehensive validation, change tracking, and integration with other breath services. The implementation follows React Native best practices and provides excellent accessibility support.

The system is designed to be extensible and maintainable, with clear separation of concerns and comprehensive test coverage. Future enhancements can build upon this foundation to add more advanced features like profiles, cloud sync, and analytics.
