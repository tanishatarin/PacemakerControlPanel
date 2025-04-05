import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronUp, ChevronDown, Key, Pause } from 'lucide-react';
import { BatteryHeader } from './BatteryHeader';
import Notifications from './Notifications';
import DDDSettings from './DDDSettings';
import VVISettings from './VVISettings';
import DOOSettings from './DOOSettings';
import HardwareRateControl from './HardwareRateControl';
import HardwareAOutputControl from './HardwareAOutputControl';
import HardwareVOutputControl from './HardwareVOutputControl';
import { 
  startEncoderPolling, 
  checkEncoderStatus, 
  updateControls, 
  toggleLock, 
  getLockState, 
  ApiStatus,
  EncoderControlData
} from '../utils/encoderApi';


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
  
  // Hardware connection state
  const [encoderConnected, setEncoderConnected] = useState(false);
  const [hardwareStatus, setHardwareStatus] = useState<ApiStatus | null>(null);
  const [localControlActive, setLocalControlActive] = useState(false);
  
  const [selectedDDDSetting, setSelectedDDDSetting] = useState<'aSensitivity' | 'vSensitivity'>('aSensitivity');

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
  const lastUpdateRef = useRef<{ source: string, time: number }>({ source: 'init', time: Date.now() });
  
  // Show error when trying to adjust while locked
  const handleLockError = useCallback(() => {
    setShowLockMessage(true);
    setTimeout(() => setShowLockMessage(false), 3000);
  }, []);

  // Auto-lock timer management
  const resetAutoLockTimer = useCallback(() => {
    if (autoLockTimer) {
      clearTimeout(autoLockTimer);
    }
    
    const newTimer = setTimeout(() => {
      setIsLocked(true);
      // Add these lines to update hardware lock state
      if (encoderConnected) {
        toggleLock().catch(err => console.error('Failed to toggle hardware lock state:', err));
      }
    }, 60000); // 1 minute
    
    setAutoLockTimer(newTimer as unknown as NodeJS.Timeout);
  }, [autoLockTimer, encoderConnected]);

  // Handle mode navigation - memoized with useCallback
  const handleModeNavigation = useCallback((direction: 'up' | 'down') => {
    resetAutoLockTimer();
    
    if (isLocked) {
      handleLockError();
      return;
    }
    
    // If we're in DDD settings, handle navigation within those settings
    if (showDDDSettings) {
      if (direction === 'up' && selectedDDDSetting === 'vSensitivity') {
        setSelectedDDDSetting('aSensitivity');
      } else if (direction === 'down' && selectedDDDSetting === 'aSensitivity') {
        setSelectedDDDSetting('vSensitivity');
      }
      return;
    }
    
    // If we're in DOO settings, go back to mode selection
    if (showDOOSettings) {
      setShowDOOSettings(false);
      return;
    }
    
    // Otherwise handle regular mode navigation
    let newIndex;
    if (direction === 'up') {
      newIndex = pendingModeIndex === 0 ? modes.length - 1 : pendingModeIndex - 1;
    } else {
      newIndex = pendingModeIndex === modes.length - 1 ? 0 : pendingModeIndex + 1;
    }
    
    setPendingModeIndex(newIndex);
    // Update the selected mode immediately to keep header in sync
    setSelectedModeIndex(newIndex);
    
    // Show settings if needed for the selected mode
    const newMode = modes[newIndex];
    if (newMode === 'DDD') {
      setShowDDDSettings(true);
      setShowVVISettings(false);
    } else if (newMode === 'VVI') {
      setShowVVISettings(true);
      setShowDDDSettings(false);
    }
    
  }, [isLocked, showDDDSettings, showDOOSettings, selectedDDDSetting, pendingModeIndex, modes, handleLockError, resetAutoLockTimer]);

  // Memoize the handleLeftArrowPress function
  const handleLeftArrowPress = useCallback(() => {
    resetAutoLockTimer();
    
    // Special case: When in DOO Settings, always allow going back regardless of lock state
    if (showDOOSettings) {
      setShowDOOSettings(false);
      return;
    }
    
    if (isLocked) {
      handleLockError();
      return;
    }
    
    // If we're in a settings screen, go back to the mode selection
    if (showDDDSettings || showVVISettings) {
      setShowDDDSettings(false);
      setShowVVISettings(false);
      return;
    }
    
    // Otherwise, apply the selected mode and show appropriate settings
    setSelectedModeIndex(pendingModeIndex);
    const newMode = modes[pendingModeIndex];
    
    // Check if mode requires special settings screen
    if (newMode === 'DDD') {
      setShowDDDSettings(true);
      setShowVVISettings(false);
    } else if (newMode === 'VVI') {
      setShowVVISettings(true);
      setShowDDDSettings(false);
    } else if (newMode === 'DOO') {
      setShowDOOSettings(true);
      setShowDDDSettings(false);
      setShowVVISettings(false);
    } else {
      setShowDDDSettings(false);
      setShowVVISettings(false);
      setShowDOOSettings(false);
    }
    
    // If exiting async message mode
    if (showAsyncMessage) {
      setShowAsyncMessage(false);
    }
  }, [isLocked, showDDDSettings, showVVISettings, showDOOSettings, pendingModeIndex, modes, showAsyncMessage, handleLockError, resetAutoLockTimer]);

  // Check encoder connection on startup
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const status = await checkEncoderStatus();
        if (status) {
          setEncoderConnected(true);
          setHardwareStatus(status);
          
          // checks lock state 
          if (status.locked !== undefined) {
            setIsLocked(status.locked);
          } else {
            // If not in status, try to get it directly
            const lockState = await getLockState();
            if (lockState !== null) {
              setIsLocked(lockState);
            }
          }

          console.log('Connected to encoder API:', status);
        } else {
          setEncoderConnected(false);
          console.log('Could not connect to encoder API');
        }
      } catch (e) {
        console.error('Error in connection check:', e);
        setEncoderConnected(false);
      }
    };
    
    checkConnection();
    
    // Also check periodically
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, []);
  
  // Handle local value changes and sync to hardware
  const handleLocalValueChange = async (key: string, value: number) => {
    if (isLocked) {
      handleLockError();
      return;
    }
    
    // Update local state
    if (key === 'rate') {
      setRate(value);
    } else if (key === 'a_output') {
      setAOutput(value);
    } else if (key === 'v_output') {
      setVOutput(value);
    }
    
    // Flag that we initiated this change
    lastUpdateRef.current = { source: 'frontend', time: Date.now() };
    setLocalControlActive(true);
    
    // Send to hardware if connected
    if (encoderConnected) {
      await updateControls({ [key]: value });
      
      // Allow hardware control again after a short delay
      setTimeout(() => {
        setLocalControlActive(false);
      }, 500);
    }
  };
  
  // Start encoder polling if connected
  useEffect(() => {
    if (!encoderConnected) return;
    
    console.log('Starting encoder polling');
    
    const stopPolling = startEncoderPolling(
      // Control values callback
      (data: EncoderControlData) => {
        // Don't update UI from hardware while user is actively controlling
        if (localControlActive) {
          console.log('Ignoring hardware update during local control');
          return;
        }
        
        // Update local state from hardware
        if (data.rate !== undefined && Math.abs(data.rate - rate) > 0.1) {
          setRate(data.rate);
        }
        
        if (data.a_output !== undefined && Math.abs(data.a_output - aOutput) > 0.1) {
          setAOutput(data.a_output);
        }
        
        if (data.v_output !== undefined && Math.abs(data.v_output - vOutput) > 0.1) {
          setVOutput(data.v_output);
        }

        // handles lock state changes
        if (data.locked !== undefined && data.locked !== isLocked) {
          setIsLocked(data.locked);
          if (data.locked) {
            // If device just locked, clear any auto-lock timer
            if (autoLockTimer) {
              clearTimeout(autoLockTimer);
              setAutoLockTimer(null);
            }
          }
        }
      },
      // Status callback
      (status) => {
        setHardwareStatus(status);
      },
      // Poll interval
      100,
      // Skip updates from these sources
      ['frontend']
    );
      
    return () => {
      console.log('Stopping encoder polling');
      stopPolling();
    };
  }, [encoderConnected, rate, aOutput, vOutput, localControlActive, autoLockTimer, isLocked]);

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
    if (isLocked) {
      handleLockError();
      return;
    }
    
    setDddSettings(prev => ({
      ...prev,
      [key]: value
    }));
    
    // If connected to hardware, send updates for sensitivity values
    if (encoderConnected && (key === 'aSensitivity' || key === 'vSensitivity')) {
      // Flag that we initiated this change
      lastUpdateRef.current = { source: 'frontend', time: Date.now() };
      setLocalControlActive(true);
      
      updateControls({ 
        active_control: key === 'aSensitivity' ? 'a_output' : 'v_output'
      });
      
      // Allow hardware control again after a short delay
      setTimeout(() => {
        setLocalControlActive(false);
      }, 500);
    }
  };

  // Handle VVI sensitivity change
  const handleVVISensitivityChange = (value: number) => {
    if (isLocked) {
      handleLockError();
      return;
    }
    
    setVviSensitivity(value);
    
    // If connected to hardware, send update
    if (encoderConnected) {
      // Flag that we initiated this change
      lastUpdateRef.current = { source: 'frontend', time: Date.now() };
      setLocalControlActive(true);
      
      updateControls({ 
        active_control: 'v_output',
        v_output: value  // Might need adjustment depending on your implementation
      });
      
      // Allow hardware control again after a short delay
      setTimeout(() => {
        setLocalControlActive(false);
      }, 500);
    }
  };

  // Activate emergency mode - don't check for lock 
  const handleEmergencyMode = useCallback(() => {
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
    
    // If connected to hardware, send emergency mode settings
    if (encoderConnected) {
      updateControls({
        rate: 80,
        a_output: 20.0,
        v_output: 25.0
      });
    }
  }, [resetAutoLockTimer, modes, encoderConnected]);

  // Set up listener for hardware up button press
  useEffect(() => {
    const handleHardwareUpButtonPress = () => {
      console.log("Hardware up button press detected");
      handleModeNavigation('up');
    };

    // Add event listener for the custom event
    window.addEventListener('hardware-up-button-pressed', handleHardwareUpButtonPress);

    // Clean up
    return () => {
      window.removeEventListener('hardware-up-button-pressed', handleHardwareUpButtonPress);
    };
  }, [handleModeNavigation]);

  // Set up listener for hardware down button press
  useEffect(() => {
    const handleHardwareDownButtonPress = () => {
      console.log("Hardware down button press detected");
      handleModeNavigation('down');
    };

    // Add event listener for the custom event
    window.addEventListener('hardware-down-button-pressed', handleHardwareDownButtonPress);

    // Clean up
    return () => {
      window.removeEventListener('hardware-down-button-pressed', handleHardwareDownButtonPress);
    };
  }, [handleModeNavigation]);

  // Set up listener for hardware left button press
  useEffect(() => {
    const handleHardwareLeftButtonPress = () => {
      console.log("Hardware left button press detected");
      handleLeftArrowPress();
    };

    // Add event listener for the custom event
    window.addEventListener('hardware-left-button-pressed', handleHardwareLeftButtonPress);

    // Clean up
    return () => {
      window.removeEventListener('hardware-left-button-pressed', handleHardwareLeftButtonPress);
    };
  }, [handleLeftArrowPress]);

  // Set up listener for hardware emergency button press
  useEffect(() => {
    const handleHardwareEmergencyButtonPress = () => {
      console.log("Hardware emergency button press detected");
      handleEmergencyMode();
    };

    // Add event listener for the custom event
    window.addEventListener('hardware-emergency-button-pressed', handleHardwareEmergencyButtonPress);

    // Clean up
    return () => {
      window.removeEventListener('hardware-emergency-button-pressed', handleHardwareEmergencyButtonPress);
    };
  }, [handleEmergencyMode]);

  // Add a dedicated hook to synchronize lock state from hardware to UI
  useEffect(() => {
    if (!encoderConnected) return;
    
    const checkLockState = async () => {
      try {
        const lockState = await getLockState();
        if (lockState !== null && lockState !== isLocked) {
          setIsLocked(lockState);
          
          // If device just unlocked, reset the auto-lock timer
          if (!lockState && autoLockTimer) {
            resetAutoLockTimer();
          }
          
          // If device just locked, clear any auto-lock timer
          if (lockState && autoLockTimer) {
            clearTimeout(autoLockTimer);
            setAutoLockTimer(null);
          }
        }
      } catch (error) {
        console.error('Error checking lock state:', error);
      }
    };
    
    // Initial check
    checkLockState();
    
    // Check every 100ms for lock state changes
    const interval = setInterval(checkLockState, 100);
    
    return () => clearInterval(interval);
  }, [encoderConnected, isLocked, autoLockTimer, resetAutoLockTimer]);

  // Toggle lock state
  const handleLockToggle = async () => {
    resetAutoLockTimer();
    
    // Toggle the lock state locally first for immediate UI feedback
    const newLockState = !isLocked;
    setIsLocked(newLockState);
    
    // Update the lock LED state
    if (encoderConnected) {
      try {
        // Use the toggleLock function but don't wait for it to complete
        toggleLock().then((hardwareLockState) => {
          // If the hardware returns a different state than expected, update our UI
          if (hardwareLockState !== null && hardwareLockState !== newLockState) {
            console.log("Hardware lock state doesn't match UI state, updating UI");
            setIsLocked(hardwareLockState);
          }
        }).catch(err => {
          console.error('Failed to toggle hardware lock state:', err);
          // Revert UI state if hardware toggle fails
          setIsLocked(isLocked);
        });
      } catch (err) {
        console.error('Failed to toggle hardware lock state:', err);
        // Revert UI state if hardware toggle fails
        setIsLocked(isLocked);
      }
    }
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
    
  // Render the appropriate mode panel
  const renderModePanel = () => {
    if (showDDDSettings) {
      return (
        <DDDSettings
          settings={dddSettings}
          onSettingsChange={handleDDDSettingsChange}
          onBack={handleLeftArrowPress}
          isLocked={isLocked}
          selectedSetting={selectedDDDSetting}
          onNavigate={handleModeNavigation}
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
      // Normal mode selection grid
      return (
        <div className="grid grid-cols-2 gap-3">
          {modes.map((mode, index) => (
            <button
              key={mode}
              className={`py-2.5 px-6 rounded-2xl text-sm font-medium transition-all
                ${index === pendingModeIndex 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }
                ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {mode}
            </button>
          ))}
        </div>
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

    {/* Encoder Connection Status */}
    {encoderConnected && (
      <div className="mb-2 p-2 bg-green-100 rounded-lg text-green-800 text-sm">
        Physical encoder connected and active {hardwareStatus?.hardware?.rate_encoder 
          ? `- Rotations: ${hardwareStatus.hardware.rate_encoder.rotation_count}` 
          : ''}
      </div>
    )}

      {/* Emergency Mode Button - always active */}
      <button
        onClick={handleEmergencyMode}
        className="w-full mb-4 bg-red-500 text-white py-2 px-4 rounded-xl hover:bg-red-600 transition-colors"
      >
        DOO Emergency Mode
      </button>

      {/* Main Controls */}
      <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
        
      <HardwareRateControl
          value={rate}
          onChange={setRate}
          isLocked={isLocked}
          onLockError={handleLockError}
        />
        
        <HardwareAOutputControl
          value={aOutput}
          onChange={setAOutput}
          isLocked={isLocked}
          onLockError={handleLockError}
        />
        
        <HardwareVOutputControl
          value={vOutput}
          onChange={setVOutput}
          isLocked={isLocked}
          onLockError={handleLockError}
        />
      </div>

      {/* Mode Selection and Control Buttons */}
      <div className="flex gap-4">
        <div className="bg-white rounded-3xl shadow-sm p-6 flex-1" style={{ minHeight: '200px' }}>
          {renderModePanel()}
        </div>

        <div className="flex flex-col gap-3">
          <button 
            onClick={handleLockToggle}
            className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center hover:bg-gray-50"
          >
            <Key className="w-5 h-5 text-gray-600" />
          </button>
          <button 
            onClick={handleLeftArrowPress}
            className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center hover:bg-gray-50"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <button 
            onClick={() => handleModeNavigation('up')}
            className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center hover:bg-gray-50"
          >
            <ChevronUp className="w-5 h-5 text-gray-600" />
          </button>
          <button 
            onClick={() => handleModeNavigation('down')}
            className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center hover:bg-gray-50"
          >
            <ChevronDown className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onMouseDown={handlePauseStart}
            onMouseUp={handlePauseEnd}
            onMouseLeave={handlePauseEnd}
            className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center hover:bg-gray-50"
          >
            <Pause className="w-5 h-5 text-gray-600" />
          </button>
        </div>
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