import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronUp, ChevronDown, Key, Lock, LockOpen, Pause } from 'lucide-react';
import CircularControl from './CircularControl';
import { BatteryHeader } from './BatteryHeader';
import Notifications from './Notifications';

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

  // Handle mode navigation
  const handleModeNavigation = (direction: 'up' | 'down') => {
    resetAutoLockTimer();
    
    if (isLocked) {
      handleLockError();
      return;
    }
    
    if (direction === 'up') {
      setPendingModeIndex(prev => (prev === 0 ? modes.length - 1 : prev - 1));
    } else {
      setPendingModeIndex(prev => (prev === modes.length - 1 ? 0 : prev + 1));
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
    
    // Otherwise, apply the selected mode and show appropriate settings
    setSelectedModeIndex(pendingModeIndex);
    const newMode = modes[pendingModeIndex];
    
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
    } else {
      setShowDDDSettings(false);
      setShowVVISettings(false);
      setShowDOOSettings(false);
    }
    
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

  // Function to get slider color based on value
  const getSliderColor = (value: number, min: number, max: number) => {
    const percentage = ((value - min) / (max - min)) * 100;
    if (percentage < 33) return '#4ade80'; // green
    if (percentage < 66) return '#fbbf24'; // yellow
    return '#ef4444'; // red
  };

  // Render the DDD Settings panel
  const renderDDDSettings = () => {
    return (
      <div className="h-full flex flex-col">
        <div className="mb-4">
          <h3 className="text-xl font-bold">DDD Settings</h3>
        </div>
        
        <div className="space-y-4 flex-grow">
          {/* A Sensitivity - Enabled */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-700">A Sensitivity</span>
              <span className="text-sm font-medium">{dddSettings.aSensitivity.toFixed(1)} mV</span>
            </div>
            <div className="relative">
              <div className="h-2 bg-gray-100 rounded-full">
                <div 
                  className="absolute h-full rounded-full transition-all duration-150 ease-out"
                  style={{ 
                    width: `${((dddSettings.aSensitivity - 0.4) / (10 - 0.4)) * 100}%`,
                    backgroundColor: getSliderColor(dddSettings.aSensitivity, 0.4, 10)
                  }}
                />
              </div>
              <input
                type="range"
                min={0.4}
                max={10}
                step={0.1}
                value={dddSettings.aSensitivity}
                onChange={(e) => {
                  if (!isLocked) {
                    setDddSettings(prev => ({
                      ...prev,
                      aSensitivity: parseFloat(e.target.value)
                    }));
                  }
                }}
                className="absolute top-0 w-full h-2 opacity-0 cursor-pointer"
                disabled={isLocked}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-500">
              <span>0.4 mV</span>
              <span>10 mV</span>
            </div>
          </div>
          
          {/* V Sensitivity - Enabled */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-700">V Sensitivity</span>
              <span className="text-sm font-medium">{dddSettings.vSensitivity.toFixed(1)} mV</span>
            </div>
            <div className="relative">
              <div className="h-2 bg-gray-100 rounded-full">
                <div 
                  className="absolute h-full rounded-full transition-all duration-150 ease-out"
                  style={{ 
                    width: `${((dddSettings.vSensitivity - 0.8) / (20 - 0.8)) * 100}%`,
                    backgroundColor: getSliderColor(dddSettings.vSensitivity, 0.8, 20)
                  }}
                />
              </div>
              <input
                type="range"
                min={0.8}
                max={20}
                step={0.1}
                value={dddSettings.vSensitivity}
                onChange={(e) => {
                  if (!isLocked) {
                    setDddSettings(prev => ({
                      ...prev,
                      vSensitivity: parseFloat(e.target.value)
                    }));
                  }
                }}
                className="absolute top-0 w-full h-2 opacity-0 cursor-pointer"
                disabled={isLocked}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-500">
              <span>0.8 mV</span>
              <span>20 mV</span>
            </div>
          </div>
          
          {/* Disabled controls */}
          <div className="opacity-60 space-y-3">
            {/* AV Delay */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-700">AV Delay</span>
                <span className="text-sm font-medium">{dddSettings.avDelay} ms</span>
              </div>
              <div className="relative">
                <div className="h-2 bg-gray-100 rounded-full">
                  <div 
                    className="absolute h-full bg-gray-400 rounded-full"
                    style={{ width: `${((dddSettings.avDelay - 20) / (300 - 20)) * 100}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={20}
                  max={300}
                  value={dddSettings.avDelay}
                  className="absolute top-0 w-full h-2 opacity-0 cursor-not-allowed"
                  disabled={true}
                />
              </div>
            </div>
            
            {/* Upper Rate */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-700">Upper Rate</span>
                <span className="text-sm font-medium">{dddSettings.upperRate} ppm</span>
              </div>
              <div className="relative">
                <div className="h-2 bg-gray-100 rounded-full">
                  <div 
                    className="absolute h-full bg-gray-400 rounded-full"
                    style={{ width: `${((dddSettings.upperRate - 86) / (230 - 86)) * 100}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={86}
                  max={230}
                  value={dddSettings.upperRate}
                  className="absolute top-0 w-full h-2 opacity-0 cursor-not-allowed"
                  disabled={true}
                />
              </div>
            </div>
            
            {/* PVARP */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-700">PVARP</span>
                <span className="text-sm font-medium">{dddSettings.pvarp} ms</span>
              </div>
              <div className="relative">
                <div className="h-2 bg-gray-100 rounded-full">
                  <div 
                    className="absolute h-full bg-gray-400 rounded-full"
                    style={{ width: `${((dddSettings.pvarp - 150) / (500 - 150)) * 100}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={150}
                  max={500}
                  value={dddSettings.pvarp}
                  className="absolute top-0 w-full h-2 opacity-0 cursor-not-allowed"
                  disabled={true}
                />
              </div>
            </div>
            
            {/* A. Tracking */}
            <div className="flex justify-between items-center py-1">
              <span className="text-sm text-gray-700">A. Tracking</span>
              <button
                className={`px-3 py-1 rounded-full text-sm ${
                  dddSettings.aTracking ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                } cursor-not-allowed`}
                disabled={true}
              >
                {dddSettings.aTracking ? 'On' : 'Off'}
              </button>
            </div>

            {/* Settings */}
            <div className="flex justify-between items-center py-1">
              <span className="text-sm text-gray-700">Settings</span>
              <select
                value={dddSettings.settings}
                className="px-3 py-1 rounded-lg bg-gray-100 text-gray-800 text-sm cursor-not-allowed"
                disabled={true}
              >
                <option value="Automatic">Automatic</option>
                <option value="Manual">Manual</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-500">Only A and V sensitivity can be adjusted. Other settings require provider access.</p>
        </div>
      </div>
    );
  };

  // Render the VVI Settings panel
  const renderVVISettings = () => {
    return (
      <div className="h-full flex flex-col">
        <div className="mb-4">
          <h3 className="text-xl font-bold">VVI Settings</h3>
        </div>
        
        <div className="flex-grow">
          {/* V Sensitivity - Enabled */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-700">V Sensitivity</span>
              <span className="text-sm font-medium">{vviSensitivity.toFixed(1)} mV</span>
            </div>
            <div className="relative">
              <div className="h-2 bg-gray-100 rounded-full">
                <div 
                  className="absolute h-full rounded-full transition-all duration-150 ease-out"
                  style={{ 
                    width: `${((vviSensitivity - 0.8) / (20 - 0.8)) * 100}%`,
                    backgroundColor: getSliderColor(vviSensitivity, 0.8, 20)
                  }}
                />
              </div>
              <input
                type="range"
                min={0.8}
                max={20}
                step={0.1}
                value={vviSensitivity}
                onChange={(e) => {
                  if (!isLocked) {
                    setVviSensitivity(parseFloat(e.target.value));
                  }
                }}
                className="absolute top-0 w-full h-2 opacity-0 cursor-pointer"
                disabled={isLocked}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-500">
              <span>0.8 mV</span>
              <span>20 mV</span>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-2 border-t border-gray-100">
          <p className="text-sm font-medium">VVI Mode (Ventricular Inhibited)</p>
          <p className="text-xs text-gray-500 mt-1">Paces the ventricle when no natural ventricular activity is detected. Commonly used for atrial fibrillation or other atrial arrhythmias.</p>
        </div>
      </div>
    );
  };

  // Render the DOO Settings panel
  const renderDOOSettings = () => {
    return (
      <div className="h-full flex flex-col">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-red-600">DOO Emergency Mode</h3>
        </div>
        
        <div className="flex-grow space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <h3 className="text-red-600 font-medium mb-1">Asynchronous Pacing Active</h3>
            <p className="text-sm text-red-700">
              DOO mode is an emergency asynchronous pacing mode that paces both chambers at fixed rates.
            </p>
          </div>
          
          <div className="mt-2">
            <p className="text-sm text-gray-700">Emergency settings have been applied:</p>
            <ul className="mt-2 space-y-2 text-sm">
              <li className="flex justify-between">
                <span>Rate:</span>
                <span className="font-medium">80 ppm</span>
              </li>
              <li className="flex justify-between">
                <span>A. Output:</span>
                <span className="font-medium">20.0 mA</span>
              </li>
              <li className="flex justify-between">
                <span>V. Output:</span>
                <span className="font-medium">25.0 mA</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-auto pt-2 border-t border-gray-100">
          <p className="text-sm font-medium">When to use DOO mode:</p>
          <p className="text-xs text-gray-500">For emergency situations when patient's underlying heart rate isn't visible or during rapid decrease in blood pressure.</p>
        </div>
      </div>
    );
  };

  // Render the appropriate mode selection or settings panel
  const renderModePanel = () => {
    if (showDDDSettings) {
      return renderDDDSettings();
    } else if (showVVISettings) {
      return renderVVISettings();
    } else if (showDOOSettings) {
      return renderDOOSettings();
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

      {/* Emergency Mode Button */}
      <button
        onClick={handleEmergencyMode}
        className="w-full mb-4 bg-red-500 text-white py-2 px-4 rounded-xl hover:bg-red-600 transition-colors"
      >
        DOO Emergency Mode
      </button>

      {/* Main Controls */}
      <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
        <CircularControl
          title="Rate"
          value={rate}
          unit="ppm"
          onChange={setRate}
          isLocked={isLocked}
          minValue={30}
          maxValue={200}
          onLockError={handleLockError}
        />
        
        <CircularControl
          title="A. Output"
          value={aOutput}
          unit="mA"
          onChange={setAOutput}
          isLocked={isLocked}
          minValue={0}
          maxValue={20}
          onLockError={handleLockError}
          isDimmed={aOutput === 0}
        />
        
        <CircularControl
          title="V. Output"
          value={vOutput}
          unit="mA"
          onChange={setVOutput}
          isLocked={isLocked}
          minValue={0}
          maxValue={25}
          onLockError={handleLockError}
          isDimmed={vOutput === 0}
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