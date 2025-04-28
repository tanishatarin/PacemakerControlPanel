import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronUp, ChevronDown, Key } from 'lucide-react';
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
  EncoderControlData,
  getSensitivityDebug,
  resetEncoder
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
  // const [pauseTimeLeft, setPauseTimeLeft] = useState(10);
  
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
  
  // const pauseTimerRef = useRef<number>();
  const modes = ['VOO', 'VVI', 'VVT', 'AOO', 'AAI', 'DOO', 'DDD', 'DDI'];
  const lastUpdateRef = useRef<{ source: string, time: number }>({ source: 'init', time: Date.now() });

  const isControlsLocked = useCallback(() => {
    return isLocked; // Only check for the lock state, not the mode
  }, [isLocked]);

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
    
    // If in DOO settings, don't allow navigation to change mode
    if (showDOOSettings || showVVISettings || showDDDSettings) {
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
    
  }, [isLocked, showDDDSettings, showDOOSettings, selectedDDDSetting, pendingModeIndex, modes.length, handleLockError, resetAutoLockTimer]);

  // Memoize the handleLeftArrowPress function
  const handleLeftArrowPress = useCallback(() => {
    resetAutoLockTimer();
    
    // If we're in DOO settings, do not allow exiting via left arrow
    if (showDOOSettings) {
      return;
    }
    
    // If we're in other settings screens, go back to the mode selection
    if (showDDDSettings || showVVISettings) {
      if (encoderConnected) {
        updateControls({ active_control: 'none' })
          .catch(err => console.error('Failed to reset active control:', err));
      }
      setShowDDDSettings(false);
      setShowVVISettings(false);
      return;
    }
    
    if (isLocked) {
      handleLockError();
      return;
    }
    
    // Prevent setting mode to DOO via left arrow
    if (modes[pendingModeIndex] === 'DOO') {
      return;
    }
    
    // Otherwise, apply the selected mode and show appropriate settings
    setSelectedModeIndex(pendingModeIndex);
    const newMode = modes[pendingModeIndex];
    
    // Check if mode requires special settings screen
    if (newMode === 'DDD') {
      setShowDDDSettings(true);

      // Set the active control to A Sensitivity by default when entering DDD settings
      if (encoderConnected) {
        updateControls({
          active_control: 'a_sensitivity',
          a_sensitivity: dddSettings.aSensitivity
        }).catch(err => console.error('Error setting initial active control for DDD:', err));
      }

    } else if (newMode === 'VVI') {
      setShowVVISettings(true);

      // Set the active control to V Sensitivity when entering VVI settings
      if (encoderConnected) {
        updateControls({
          active_control: 'v_sensitivity',
          v_sensitivity: vviSensitivity
        }).catch(err => console.error('Error setting initial active control for VVI:', err));
      }

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
  }, [encoderConnected, vviSensitivity]);
  
  // Handle local value changes and sync to hardware
  const handleLocalValueChange = async (key: string, value: number) => {
    if (isControlsLocked()) {
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

  // Add an emergency reset function
const handleEncoderReset = useCallback(() => {
  if (encoderConnected) {
    console.log("Performing emergency encoder reset");
    
    // Reset the encoder
    resetEncoder('mode').catch(err => console.error('Failed encoder reset:', err));
    
    // Also reset the active control
    setTimeout(() => {
      if (showDDDSettings) {
        // Re-establish the DDD settings active control
        const controlType = selectedDDDSetting === 'aSensitivity' ? 'a_sensitivity' : 'v_sensitivity';
        const sensitivityValue = selectedDDDSetting === 'aSensitivity' 
          ? dddSettings.aSensitivity 
          : dddSettings.vSensitivity;
        
        updateControls({
          active_control: controlType,
          [controlType]: sensitivityValue
        }).catch(err => console.error('Failed to reset control:', err));
      } else if (showVVISettings) {
        // Re-establish the VVI settings active control
        updateControls({
          active_control: 'v_sensitivity',
          v_sensitivity: vviSensitivity
        }).catch(err => console.error('Failed to reset control:', err));
      }
    }, 200);
  }
}, [encoderConnected, showDDDSettings, showVVISettings, selectedDDDSetting]);

// Add a listener to detect potential stuck encoder
useEffect(() => {
  let lastSensitivityValues = {
    a: dddSettings.aSensitivity,
    v: dddSettings.vSensitivity,
    vvi: vviSensitivity,
    timestamp: Date.now()
  };
  
  const checkStuckInterval = setInterval(() => {
    // If we're in a settings screen and connected to hardware
    if (encoderConnected && (showDDDSettings || showVVISettings)) {
      const now = Date.now();
      const timeSinceLastChange = now - lastSensitivityValues.timestamp;
      
      // If values haven't changed in 10 seconds and we're actively in settings
      if (timeSinceLastChange > 10000) {
        console.log("Long period without sensitivity changes - doing safety reset");
        handleEncoderReset();
        
        // Update the timestamp to avoid multiple resets
        lastSensitivityValues.timestamp = now;
      }
    }
    
    // Update our tracked values if they've changed
    if (dddSettings.aSensitivity !== lastSensitivityValues.a ||
        dddSettings.vSensitivity !== lastSensitivityValues.v ||
        vviSensitivity !== lastSensitivityValues.vvi) {
      
      lastSensitivityValues = {
        a: dddSettings.aSensitivity,
        v: dddSettings.vSensitivity,
        vvi: vviSensitivity,
        timestamp: Date.now()
      };
    }
  }, 5000); // Check every 5 seconds
  
  return () => clearInterval(checkStuckInterval);
}, [encoderConnected, showDDDSettings, showVVISettings, dddSettings, vviSensitivity, handleEncoderReset]);

  useEffect(() => {
    if (encoderConnected) {
      const interval = setInterval(() => {
        getSensitivityDebug();
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [encoderConnected]);
  
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
        
        // Don't update if controls should be locked
        if (isControlsLocked()) {
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


        // Handle mode changes from hardware
        if (data.mode !== undefined && data.mode !== selectedModeIndex) {
          console.log(`Mode change detected from hardware: ${data.mode}`);
          
          // Update both selected and pending mode indices
          setSelectedModeIndex(data.mode);
          setPendingModeIndex(data.mode);
          
          // Handle special mode screens
          if (data.mode === 5) { // DOO mode
            setShowDOOSettings(true);
            setShowDDDSettings(false);
            setShowVVISettings(false);
          } else if (data.mode === 6) { // DDD mode
            // If entering DDD mode, show DDD settings
            setShowDDDSettings(true);
            setShowVVISettings(false);
            setShowDOOSettings(false);
          } else if (data.mode === 1) { // VVI mode
            // If entering VVI mode, show VVI settings
            setShowVVISettings(true);
            setShowDDDSettings(false);
            setShowDOOSettings(false);
          } else {
            // For other modes, hide all special settings
            setShowDDDSettings(false);
            setShowVVISettings(false);
            setShowDOOSettings(false);
          }
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

        // Also update mode from status if available
        if (status.mode !== undefined && status.mode !== selectedModeIndex) {
          console.log(`Mode update from status: ${status.mode}`);
          setSelectedModeIndex(status.mode);
          setPendingModeIndex(status.mode);
        }

        // if autolock timer is active, reset it
        if (status.encoder_active) {
          console.log("Encoder activity detected - resetting auto-lock timer");
          resetAutoLockTimer();
        }
    
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
  }, [encoderConnected, rate, aOutput, vOutput, vviSensitivity, localControlActive, autoLockTimer, isLocked, isControlsLocked, selectedModeIndex]);

  // Handle pause button functionality
  // useEffect(() => {
  //   if (isPausing) {
  //     pauseTimerRef.current = window.setInterval(() => {
  //       setPauseTimeLeft((prev) => {
  //         if (prev <= 1) {
  //           setIsPausing(false);
  //           clearInterval(pauseTimerRef.current);
  //           return 10;
  //         }
  //         return prev - 1;
  //       });
  //     }, 1000);
  //   } else {
  //     clearInterval(pauseTimerRef.current);
  //     setPauseTimeLeft(10);
  //   }

  //   return () => {
  //     if (pauseTimerRef.current) {
  //       clearInterval(pauseTimerRef.current);
  //     }
  //   };
  // }, [isPausing]);

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

  // Activate emergency mode
  const handleEmergencyMode = useCallback(() => {
    resetAutoLockTimer();
    
    // Toggle DOO mode
    if (showDOOSettings) {
      // If already in DOO mode, exit to previous mode
      setShowDOOSettings(false);
      
      // Reset controls to previous values (optional)
      // You could store previous values in refs to restore them
      
      console.log("Exiting DOO emergency mode");
    } else {
      // Enter DOO mode
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
          mode: dooIndex  // Send mode index to hardware
        });
      }
      
      console.log("Entering DOO emergency mode");
    }
  }, [resetAutoLockTimer, modes, encoderConnected, showDOOSettings]);

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
  // const handlePauseStart = () => {
  //   resetAutoLockTimer();
    
  //   if (isControlsLocked()) {
  //     handleLockError();
  //     return;
  //   }
    
  //   setIsPausing(true);
  // };

  // const handlePauseEnd = () => {
  //   setIsPausing(false);
  // };
    
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
          encoderConnected={encoderConnected} // Add this line
        />
      );
    } else if (showVVISettings) {
      return (
        <VVISettings
          vSensitivity={vviSensitivity}
          onVSensitivityChange={handleVVISensitivityChange}
          onBack={handleLeftArrowPress}
          isLocked={isLocked}
          encoderConnected={encoderConnected} // Add this line
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
                // Special handling for DOO mode - show emergency content
                if (mode === 'DOO') {
                  handleEmergencyMode();
                  return;
                }
                
                if (!isLocked) {
                  setPendingModeIndex(index);
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
      {/* <BatteryHeader
        batteryLevel={batteryLevel}
        selectedMode={modes[pendingModeIndex]} // Use pendingModeIndex instead of selectedModeIndex
        isLocked={isLocked}
        onBatteryChange={setBatteryLevel}
      /> */}

    {/* <BatteryHeader
      selectedMode={modes[pendingModeIndex]}
      isLocked={isLocked}
    /> */}

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
        {showDOOSettings ? 'Exit Emergency Mode' : 'DOO Emergency Mode'}
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
          {/* <button
            onMouseDown={handlePauseStart}
            onMouseUp={handlePauseEnd}
            onMouseLeave={handlePauseEnd}
            className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center hover:bg-gray-50"
          >
            <Pause className="w-5 h-5 text-gray-600" />
          </button> */}
        </div>
      </div>

      {/* Notifications */}
      <Notifications
        showAsyncMessage={showAsyncMessage}
        showLockMessage={showLockMessage}
        isPausing={isPausing}
        // pauseTimeLeft={pauseTimeLeft}
      />
    </div>
  );
};

export default ControlPanel;