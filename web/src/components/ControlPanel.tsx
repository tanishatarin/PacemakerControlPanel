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
  
  // Get if controls should be locked (device locked or in DOO mode)
  const isControlsLocked = useCallback(() => {
    const currentMode = modes[selectedModeIndex];
    const isDOOMode = currentMode === 'DOO';
    
    // Store this in a variable for debugging
    const lockStatus = isLocked || isDOOMode;
    
    // Log for debugging
    if (isDOOMode) {
      console.log("Controls locked due to DOO mode");
    }
    
    return lockStatus;
  }, [isLocked, modes, selectedModeIndex]);
  
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
        
        // Update hardware active control if connected
        if (encoderConnected) {
          updateControls({
            active_control: 'a_sensitivity',
            a_sensitivity: dddSettings.aSensitivity
          }).catch(err => console.error('Error updating active control:', err));
        }
      } else if (direction === 'down' && selectedDDDSetting === 'aSensitivity') {
        setSelectedDDDSetting('vSensitivity');
        
        // Update hardware active control if connected
        if (encoderConnected) {
          updateControls({
            active_control: 'v_sensitivity',
            v_sensitivity: dddSettings.vSensitivity
          }).catch(err => console.error('Error updating active control:', err));
        }
      }
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
    
    // Update the selected mode index immediately to fix header display
    // When we're in the mode selection screen (not in settings screens)
    if (!showDDDSettings && !showVVISettings && !showDOOSettings) {
      setSelectedModeIndex(newIndex);
      
      // If connected to hardware, update mode there as well
      if (encoderConnected) {
        updateControls({ mode: newIndex });
      }
    }
    
  }, [isLocked, showDDDSettings, showVVISettings, showDOOSettings, selectedDDDSetting, pendingModeIndex, modes.length, encoderConnected, dddSettings.aSensitivity, dddSettings.vSensitivity, handleLockError, resetAutoLockTimer]);

  // Memoize the handleLeftArrowPress function
  const handleLeftArrowPress = useCallback(() => {
    resetAutoLockTimer();
    
    // If we're in a settings screen, go back to the mode selection
    if (showDDDSettings || showVVISettings || showDOOSettings) {
      const currentMode = modes[selectedModeIndex];
      
      // Reset active control when leaving settings screens
      if (encoderConnected) {
        updateControls({ active_control: 'none' })
          .catch(err => console.error('Failed to reset active control:', err));
      }
      
      // Special case: When exiting DOO mode, switch to DDD mode
      if (currentMode === 'DOO') {
        const dddIndex = modes.indexOf('DDD');
        setSelectedModeIndex(dddIndex);
        setPendingModeIndex(dddIndex);
        
        // Force a complete update of all controls to ensure hardware and UI are in sync
        if (encoderConnected) {
          // First, update the mode to DDD
          console.log("Switching from DOO to DDD mode");
          
          // Force a complete refresh of all control values
          const forceRefreshControls = async () => {
            try {
              // Send a complete update with all values to ensure hardware state is reset
              await updateControls({
                mode: dddIndex,
                rate: rate,
                a_output: aOutput,
                v_output: vOutput
              });
              console.log("All controls refreshed after DOO->DDD transition");
            } catch (error) {
              console.error("Error refreshing controls:", error);
            }
          };
          
          forceRefreshControls();
        }
        
        // Re-enable controls by breaking out of DOO emergency mode
        setLocalControlActive(false);
      }
      
      setShowDDDSettings(false);
      setShowVVISettings(false);
      setShowDOOSettings(false);
      return;
    }
    
    if (isLocked) {
      handleLockError();
      return;
    }
    
    // Otherwise, apply the selected mode and show appropriate settings
    setSelectedModeIndex(pendingModeIndex);
    const newMode = modes[pendingModeIndex];
    
    // Check if mode requires special settings screen
    if (newMode === 'DDD') {
      setShowDDDSettings(true);
      setShowVVISettings(false);
      setShowDOOSettings(false);
      
      // Set the active control to A Sensitivity by default when entering DDD settings
      if (encoderConnected) {
        updateControls({
          active_control: 'a_sensitivity',
          a_sensitivity: dddSettings.aSensitivity
        }).catch(err => console.error('Error setting initial active control for DDD:', err));
      }
    } else if (newMode === 'VVI') {
      setShowVVISettings(true);
      setShowDDDSettings(false);
      setShowDOOSettings(false);
      
      // Set the active control to V Sensitivity when entering VVI settings
      if (encoderConnected) {
        updateControls({
          active_control: 'v_sensitivity',
          v_sensitivity: vviSensitivity
        }).catch(err => console.error('Error setting initial active control for VVI:', err));
      }
    } else if (newMode === 'DOO') {
      setShowDOOSettings(true);
      setShowDDDSettings(false);
      setShowVVISettings(false);
      
      // Reset the active control when entering DOO mode (no sensitivity settings)
      if (encoderConnected) {
        updateControls({ active_control: 'none' })
          .catch(err => console.error('Failed to reset active control:', err));
      }
    } else {
      setShowDDDSettings(false);
      setShowVVISettings(false);
      setShowDOOSettings(false);
      
      // Reset the active control for other modes
      if (encoderConnected) {
        updateControls({ active_control: 'none' })
          .catch(err => console.error('Failed to reset active control:', err));
      }
    }
    
    // If exiting async message mode
    if (showAsyncMessage) {
      setShowAsyncMessage(false);
    }
  }, [isLocked, showDDDSettings, showVVISettings, showDOOSettings, pendingModeIndex, selectedModeIndex, modes, showAsyncMessage, encoderConnected, rate, aOutput, vOutput, dddSettings.aSensitivity, vviSensitivity, handleLockError, resetAutoLockTimer]);

  // Check encoder connection on startup and reconnect if lost
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const status = await checkEncoderStatus();
        if (status) {
          setEncoderConnected(true);
          setHardwareStatus(status);
          
          // Update sensitivity values from hardware if available
          if (status.a_sensitivity !== undefined) {
            setDddSettings(prev => ({
              ...prev,
              aSensitivity: status.a_sensitivity || prev.aSensitivity
            }));
          }
          
          if (status.v_sensitivity !== undefined) {
            // Update both DDD and VVI sensitivity values
            setDddSettings(prev => ({
              ...prev,
              vSensitivity: status.v_sensitivity || prev.vSensitivity
            }));
            setVviSensitivity(status.v_sensitivity || vviSensitivity);
          }
          
          // Check lock state 
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
          // If we've lost connection, log it
          if (encoderConnected) {
            console.warn('Lost connection to encoder API, will retry');
          } else {
            console.log('Could not connect to encoder API, will retry');
          }
          setEncoderConnected(false);
        }
      } catch (e) {
        console.error('Error in connection check:', e);
        setEncoderConnected(false);
      }
    };
    
    // Check immediately
    checkConnection();
    
    // Check more frequently (every 2 seconds) to detect and recover from connection loss quickly
    const interval = setInterval(checkConnection, 2000);
    return () => clearInterval(interval);
  }, [encoderConnected, vviSensitivity]);
  
  // Handle local value changes and sync to hardware
  const handleLocalValueChange = async (key: string, value: number) => {
    // Check if we're in DOO mode - if we just switched away from DOO, allow control
    const isDOOMode = modes[selectedModeIndex] === 'DOO';
    const isLockedControls = isLocked || isDOOMode;
    
    // For debugging
    if (isDOOMode) {
      console.log("In DOO mode - controls should be locked");
    }
    
    // If we're locked, show error and return
    if (isLockedControls) {
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
        
        // Don't update main controls if they should be locked
        // BUT allow hardware mode data to update our UI mode
        if (isControlsLocked()) {
          // Only process lock state changes and mode changes when locked
          if (data.locked !== undefined && data.locked !== isLocked) {
            setIsLocked(data.locked);
          }
          
          if (data.mode !== undefined && data.mode !== selectedModeIndex) {
            // If hardware says we've changed mode, update our UI
            setSelectedModeIndex(data.mode);
            setPendingModeIndex(data.mode);
            console.log(`Mode updated from hardware: ${modes[data.mode]}`);
          }
          
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

        // Handle sensitivity value updates from hardware
        if (data.a_sensitivity !== undefined) {
          setDddSettings(prev => {
            // Only update if value has changed (considering floating point rounding)
            if (Math.abs(data.a_sensitivity! - prev.aSensitivity) > 0.01) {
              console.log(`Updating A sensitivity from hardware: ${data.a_sensitivity}`);
              return {
                ...prev,
                aSensitivity: data.a_sensitivity!
              };
            }
            return prev;
          });
        }
        
        if (data.v_sensitivity !== undefined) {
          // Update both DDD and VVI sensitivity values when they change
          setDddSettings(prev => {
            if (Math.abs(data.v_sensitivity! - prev.vSensitivity) > 0.01) {
              console.log(`Updating V sensitivity in DDD from hardware: ${data.v_sensitivity}`);
              return {
                ...prev,
                vSensitivity: data.v_sensitivity!
              };
            }
            return prev;
          });
          
          if (Math.abs(data.v_sensitivity - vviSensitivity) > 0.01) {
            console.log(`Updating VVI sensitivity from hardware: ${data.v_sensitivity}`);
            setVviSensitivity(data.v_sensitivity);
          }
        }

        // Handle lock state changes
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
        
        // Handle mode changes
        if (data.mode !== undefined && data.mode !== selectedModeIndex) {
          setSelectedModeIndex(data.mode);
          setPendingModeIndex(data.mode);
          console.log(`Mode updated from hardware: ${modes[data.mode]}`);
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
  }, [encoderConnected, rate, aOutput, vOutput, vviSensitivity, localControlActive, autoLockTimer, isLocked, isControlsLocked]);

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
      
      // Update hardware mode as well
      if (encoderConnected) {
        updateControls({ mode: vviIndex });
      }
      
      // Show notification
      setShowAsyncMessage(true);
      setTimeout(() => setShowAsyncMessage(false), 3000);
    }
    
    // If in DDD mode and V Output is set to 0, switch to AAI
    if (modes[selectedModeIndex] === 'DDD' && vOutput === 0) {
      const aaiIndex = modes.indexOf('AAI');
      setSelectedModeIndex(aaiIndex);
      setPendingModeIndex(aaiIndex);
      
      // Update hardware mode as well
      if (encoderConnected) {
        updateControls({ mode: aaiIndex });
      }
      
      // Show notification
      setShowAsyncMessage(true);
      setTimeout(() => setShowAsyncMessage(false), 3000);
    }
  }, [aOutput, vOutput, selectedModeIndex, modes, encoderConnected]);

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
      
      // Directly update the sensitivity value in hardware
      const controlType = key === 'aSensitivity' ? 'a_sensitivity' : 'v_sensitivity';
      updateControls({ 
        active_control: controlType,
        [controlType]: value
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
      
      // Update the v_sensitivity value directly in hardware
      updateControls({ 
        active_control: 'v_sensitivity',
        v_sensitivity: value
      });
      
      // Allow hardware control again after a short delay
      setTimeout(() => {
        setLocalControlActive(false);
      }, 500);
    }
  };

  // Activate emergency mode
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
        v_output: 25.0,
        mode: dooIndex, // Add mode update to ensure hardware is synchronized
        active_control: 'none' // Reset active control in emergency mode
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
    
    if (isControlsLocked()) {
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
          encoderConnected={encoderConnected}
        />
      );
    } else if (showVVISettings) {
      return (
        <VVISettings
          vSensitivity={vviSensitivity}
          onVSensitivityChange={handleVVISensitivityChange}
          onBack={handleLeftArrowPress}
          isLocked={isLocked}
          encoderConnected={encoderConnected}
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
              onClick={() => {
                if (!isLocked) {
                  setPendingModeIndex(index);
                                    
                  // Also update the selected mode index immediately to fix header display
                  setSelectedModeIndex(index);
                  
                  // If connected to hardware, update mode there as well
                  if (encoderConnected) {
                    updateControls({ mode: index });
                  }
                } else {
                  handleLockError();
                }
              }}
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

      {/* Emergency Mode Button */}
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
          onChange={(value) => handleLocalValueChange('rate', value)}
          isLocked={isControlsLocked()}
          onLockError={handleLockError}
        />
        
        <HardwareAOutputControl
          value={aOutput}
          onChange={(value) => handleLocalValueChange('a_output', value)}
          isLocked={isControlsLocked()}
          onLockError={handleLockError}
        />
        
        <HardwareVOutputControl
          value={vOutput}
          onChange={(value) => handleLocalValueChange('v_output', value)}
          isLocked={isControlsLocked()}
          onLockError={handleLockError}
        />
        
        {/* Debug info for mode/lock state (hidden in production) */}
        <div className="mt-4 text-xs text-gray-400">
          Mode: {modes[selectedModeIndex]} (Index: {selectedModeIndex}) 
          {isControlsLocked() ? " - Controls Locked" : " - Controls Unlocked"}
        </div>
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