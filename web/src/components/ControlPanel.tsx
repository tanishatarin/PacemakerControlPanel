import React, { useState, useRef, useEffect } from 'react';
import { BatteryHeader } from './BatteryHeader';
import Notifications from './Notifications';
import DDDSettings from './DDDSettings';
import VVISettings from './VVISettings';
import DOOSettings from './DOOSettings';
import EmergencyButton from './EmergencyButton';
import ModeSelector from './ModeSelector';
import ControlButtons from './ControlButtons';
import MainControls from './MainControls';
import ECGVisualizer from './ECGVisualizer';

const ControlPanel: React.FC = () => {
  // Main control values
  const [rate, setRate] = useState(80);
  const [aOutput, setAOutput] = useState(10.0);
  const [vOutput, setVOutput] = useState(10.0);
  
  // Mode selection
  const [selectedModeIndex, setSelectedModeIndex] = useState(0);
  const [pendingModeIndex, setPendingModeIndex] = useState(0);
  
  // System states
  const [isLocked, setIsLocked] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [autoLockTimer, setAutoLockTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Notification states
  const [showAsyncMessage, setShowAsyncMessage] = useState(false);
  const [showLockMessage, setShowLockMessage] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [pauseTimeLeft, setPauseTimeLeft] = useState(10);
  
  // Mode settings states
  const [showDDDSettings, setShowDDDSettings] = useState(false);
  const [showVVISettings, setShowVVISettings] = useState(false);
  const [showDOOSettings, setShowDOOSettings] = useState(false);
  
  // DDD Mode specific states
  const [dddSettings, setDddSettings] = useState({
    aSensitivity: 0.5,
    vSensitivity: 2.0,
    avDelay: 170,
    upperRate: 110,
    pvarp: 300,
    aTracking: true,
    settings: "Automatic"
  });
  
  // VVI Mode specific state
  const [vviSensitivity, setVviSensitivity] = useState(2.0);
  
  const pauseTimerRef = useRef<number>();
  const modes = ['VOO', 'VVI', 'VVT', 'AOO', 'AAI', 'DOO', 'DDD', 'DDI'];

  // Auto-lock timer management
  const resetAutoLockTimer = () => {
    if (autoLockTimer) {
      clearTimeout(autoLockTimer);
    }
    
    const newTimer = setTimeout(() => {
      setIsLocked(true);
    }, 60000); // 1 minute
    
    setAutoLockTimer(newTimer as unknown as NodeJS.Timeout);
  };

  // Handle pause button functionality
  useEffect(() => {
    if (isPausing) {
      pauseTimerRef.current = window.setInterval(() => {
        setPauseTimeLeft((prev) => {
          if (prev <= 1) {
            setIsPausing(false);
            clearInterval(pauseTimerRef.current);
            return 10;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(pauseTimerRef.current);
      setPauseTimeLeft(10);
    }

    return () => {
      if (pauseTimerRef.current) {
        clearInterval(pauseTimerRef.current);
      }
    };
  }, [isPausing]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (autoLockTimer) {
        clearTimeout(autoLockTimer);
      }
    };
  }, [autoLockTimer]);

  // Handle automatic mode changes based on output settings
  useEffect(() => {
    // If in DDD mode and A Output is set to 0, switch to VVI
    if (modes[selectedModeIndex] === 'DDD' && aOutput === 0) {
      const vviIndex = modes.indexOf('VVI');
      setSelectedModeIndex(vviIndex);
      setPendingModeIndex(vviIndex);
      // Show notification
      setShowAsyncMessage(true);
      setTimeout(() => setShowAsyncMessage(false), 3000);
    }
    
    // If in DDD mode and V Output is set to 0, switch to AAI
    if (modes[selectedModeIndex] === 'DDD' && vOutput === 0) {
      const aaiIndex = modes.indexOf('AAI');
      setSelectedModeIndex(aaiIndex);
      setPendingModeIndex(aaiIndex);
      // Show notification
      setShowAsyncMessage(true);
      setTimeout(() => setShowAsyncMessage(false), 3000);
    }
  }, [aOutput, vOutput, selectedModeIndex, modes]);

  // Handle DDD Settings changes
  const handleDDDSettingsChange = (key: string, value: any) => {
    setDddSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Handle VVI sensitivity change
  const handleVVISensitivityChange = (value: number) => {
    setVviSensitivity(value);
  };

  // Add this function that directly activates a mode
  const activateMode = (modeIndex: number) => {
    setSelectedModeIndex(modeIndex);
    const newMode = modes[modeIndex];
    
    // Check if mode requires special settings screen
    if (newMode === 'DDD') {
      setShowDDDSettings(true);
      setShowVVISettings(false);
      setShowDOOSettings(false);
    } else if (newMode === 'VVI') {
      setShowVVISettings(true);
      setShowDDDSettings(false);
      setShowDOOSettings(false);
    } else if (newMode === 'DOO') {
      setShowDOOSettings(true);
      setShowDDDSettings(false);
      setShowVVISettings(false);
    }
  };

  // Handle mode navigation
  const handleModeNavigation = (direction: 'up' | 'down') => {
    resetAutoLockTimer();
    
    if (isLocked) {
      handleLockError();
      return;
    }
    
    if (direction === 'up') {
      const newIndex = pendingModeIndex === 0 ? modes.length - 1 : pendingModeIndex - 1;
      setPendingModeIndex(newIndex);
      // Also update selectedModeIndex to ensure header updates
      setSelectedModeIndex(newIndex);
    } else {
      const newIndex = pendingModeIndex === modes.length - 1 ? 0 : pendingModeIndex + 1;
      setPendingModeIndex(newIndex);
      // Also update selectedModeIndex to ensure header updates
      setSelectedModeIndex(newIndex);
    }
  };

  // Apply selected mode or return from settings screen
  const handleLeftArrowPress = () => {
    resetAutoLockTimer();
    
    if (isLocked) {
      handleLockError();
      return;
    }
    
    // If we're in a settings screen, go back to the mode selection
    if (showDDDSettings || showVVISettings || showDOOSettings) {
      setShowDDDSettings(false);
      setShowVVISettings(false);
      setShowDOOSettings(false);
      return;
    }
    
    // Otherwise, activate the pending mode
    activateMode(pendingModeIndex);
    
    // If exiting async message mode
    if (showAsyncMessage) {
      setShowAsyncMessage(false);
    }
  };

  // Show error when trying to adjust while locked
  const handleLockError = () => {
    setShowLockMessage(true);
    setTimeout(() => setShowLockMessage(false), 3000);
  };

  // Activate emergency mode
  const handleEmergencyMode = () => {
    resetAutoLockTimer();
    
    // Set emergency parameters
    setRate(80);
    setAOutput(20.0);
    setVOutput(25.0);
    
    // Set to DOO mode
    const dooIndex = modes.indexOf('DOO');
    setSelectedModeIndex(dooIndex);
    setPendingModeIndex(dooIndex);
    
    // Show DOO settings
    setShowDOOSettings(true);
    setShowDDDSettings(false);
    setShowVVISettings(false);
  };

  // Handle pause button states
  const handlePauseStart = () => {
    resetAutoLockTimer();
    
    if (isLocked) {
      handleLockError();
      return;
    }
    
    setIsPausing(true);
  };

  const handlePauseEnd = () => {
    setIsPausing(false);
  };

  // Toggle lock state
  const handleLockToggle = () => {
    resetAutoLockTimer();
    setIsLocked(!isLocked);
  };

  // Render the appropriate mode panel
  const renderModePanel = () => {
    if (showDDDSettings) {
      return (
        <DDDSettings
          settings={dddSettings}
          onSettingsChange={handleDDDSettingsChange}
          onBack={handleLeftArrowPress}
          isLocked={isLocked}
        />
      );
    } else if (showVVISettings) {
      return (
        <VVISettings
          vSensitivity={vviSensitivity}
          onVSensitivityChange={handleVVISensitivityChange}
          onBack={handleLeftArrowPress}
          isLocked={isLocked}
        />
      );
    } else if (showDOOSettings) {
      return (
        <DOOSettings
          onBack={handleLeftArrowPress}
          isLocked={isLocked}
        />
      );
    } else {
      // Use updated ModeSelector component with new props
      return (
        <ModeSelector
          modes={modes}
          pendingModeIndex={pendingModeIndex}
          selectedModeIndex={selectedModeIndex} // Pass current selected mode
          isLocked={isLocked}
          onModeSelect={(index) => {
            setPendingModeIndex(index);
            // IMPORTANT FIX: Also update the selectedModeIndex immediately
            // This ensures the header updates as soon as a mode is selected
            setSelectedModeIndex(index);
          }}
          onModeActivate={activateMode}
        />
      );
    }
  };

  // Main control panel UI
  return (
    <div className="max-w-2xl mx-auto p-8 bg-gray-50 min-h-screen">
      {/* Battery and Mode Header */}
      <BatteryHeader
        batteryLevel={batteryLevel}
        selectedMode={modes[selectedModeIndex]}
        isLocked={isLocked}
        onBatteryChange={setBatteryLevel}
      />

      {/* Emergency Mode Button */}
      <EmergencyButton 
        onClick={handleEmergencyMode}
        isLocked={isLocked}
      />

      {/* Main Controls */}
      <MainControls
        rate={rate}
        aOutput={aOutput}
        vOutput={vOutput}
        isLocked={isLocked}
        onRateChange={setRate}
        onAOutputChange={setAOutput}
        onVOutputChange={setVOutput}
        onLockError={handleLockError}
      />

      {/* Mode Selection and Control Buttons */}
      <div className="flex gap-4">
        <div className="bg-white rounded-3xl shadow-sm p-6 flex-1" style={{ minHeight: '200px' }}>
          {renderModePanel()}
        </div>

        <ControlButtons
          onLockToggle={handleLockToggle}
          onBackPress={handleLeftArrowPress}
          onModeUp={() => handleModeNavigation('up')}
          onModeDown={() => handleModeNavigation('down')}
          onPauseStart={handlePauseStart}
          onPauseEnd={handlePauseEnd}
        />
      </div>

      {/* Notifications */}
      <Notifications
        showAsyncMessage={showAsyncMessage}
        showLockMessage={showLockMessage}
        isPausing={isPausing}
        pauseTimeLeft={pauseTimeLeft}
      />
    </div>
  );
};

export default ControlPanel;