import React, { useEffect, useCallback } from 'react';
import { updateControls } from '../utils/encoderApi';

// Interface for the DDD Settings component
interface DDDSettingsProps {
  settings: {
    aSensitivity: number;
    vSensitivity: number;
    avDelay: number;
    upperRate: number;
    pvarp: number;
    aTracking: boolean;
    settings: string;
  };
  onSettingsChange: (key: string, value: any) => void;
  onBack: () => void;
  isLocked: boolean;
  selectedSetting?: 'aSensitivity' | 'vSensitivity';
  onNavigate?: (direction: 'up' | 'down') => void;
  encoderConnected?: boolean;
}

const DDDSettings: React.FC<DDDSettingsProps> = ({
  settings,
  onSettingsChange,
  isLocked,
  selectedSetting = 'aSensitivity',
  encoderConnected = false
}) => {
  const handleChange = (key: string, value: any) => {
    if (isLocked) return;
    onSettingsChange(key, value);
  };

  // Convert value functions
  const aSliderToValue = (sliderValue: number): number => {
    if (sliderValue >= 99.5) return 0;
    return 10 - (sliderValue / 99.5) * 9.6;
  };

  const aValueToSlider = (actualValue: number): number => {
    if (actualValue === 0) return 100;
    return ((10 - actualValue) / 9.6) * 99.5;
  };

  const vSliderToValue = (sliderValue: number): number => {
    if (sliderValue >= 99.5) return 0;
    return 20 - (sliderValue / 99.5) * 19.2;
  };

  const vValueToSlider = (actualValue: number): number => {
    if (actualValue === 0) return 100;
    return ((20 - actualValue) / 19.2) * 99.5;
  };

  // Handle slider changes
  const handleASliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sliderValue = parseFloat(e.target.value);
    const actualValue = aSliderToValue(sliderValue);
    handleChange('aSensitivity', parseFloat(actualValue.toFixed(1)));
  };

  const handleVSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sliderValue = parseFloat(e.target.value);
    const actualValue = vSliderToValue(sliderValue);
    handleChange('vSensitivity', parseFloat(actualValue.toFixed(1)));
  };

  // Effect to update hardware encoder active control based on selected setting
  // Inside the useEffect for hardware controls
  // Add this function after the component declaration
  const optimizeEncoderTransition = useCallback(() => {
    if (encoderConnected && selectedSetting) {
      const controlType = selectedSetting === 'aSensitivity' ? 'a_sensitivity' : 'v_sensitivity';
      const sensitivityValue = selectedSetting === 'aSensitivity' ? settings.aSensitivity : settings.vSensitivity;
      
      // Skip debouncing for control type changes to make them immediate
      updateControls({ 
        active_control: controlType,
        [controlType]: sensitivityValue
      }).catch(err => console.error('Failed to set control:', err));
    }
  }, [encoderConnected, selectedSetting, settings.aSensitivity, settings.vSensitivity]);

  // Replace the existing useEffect with this
  useEffect(() => {
    if (encoderConnected && selectedSetting) {
      // Determine which sensitivity is active
      const controlType = selectedSetting === 'aSensitivity' ? 'a_sensitivity' : 'v_sensitivity';
      const sensitivityValue = selectedSetting === 'aSensitivity' ? settings.aSensitivity : settings.vSensitivity;
      
      console.log(`DDD Settings: Setting active control to ${controlType} with value ${sensitivityValue}`);
      
      // Use setTimeout to ensure state is stable before API call
      const timer = setTimeout(() => {
        updateControls({ 
          active_control: controlType,
          [controlType]: sensitivityValue
        }).catch(err => {
          console.error('Failed to set active control:', err);
        });
      }, 50);
      
      // Add a periodic reset to prevent sticking
      const resetInterval = setInterval(() => {
        // Refresh the control with current values
        updateControls({
          active_control: controlType,
          [controlType]: selectedSetting === 'aSensitivity' ? settings.aSensitivity : settings.vSensitivity
        }).catch(err => console.error('Failed to refresh control:', err));
      }, 5000); // Check every 5 seconds
      
      // Reset active control when component unmounts
      return () => {
        clearTimeout(timer);
        clearInterval(resetInterval);
        console.log('DDD Settings: Resetting active control on unmount');
        updateControls({ active_control: 'none' })
          .catch(err => console.error('Failed to reset active control:', err));
      };
    }
  }, [encoderConnected, selectedSetting, settings.aSensitivity, settings.vSensitivity]);


  // Check if sensitivities are disabled
  const isASensitivityDisabled = settings.aSensitivity === 0;
  const isVSensitivityDisabled = settings.vSensitivity === 0;

  return (
    <div className="bg-white rounded-xl">
      <div className="flex justify-between items-center border-b p-2">
        <h2 className="text-lg font-semibold">DDD Settings</h2>
      </div>
      
      <div className="p-3 space-y-4">
        {/* A Sensitivity */}
        <div className={`transition-all ${selectedSetting === 'aSensitivity' ? 'bg-blue-50 p-2 rounded' : 'opacity-50'}`}>
          <div className="flex justify-between items-center mb-1">
            <span className={`text-sm ${selectedSetting === 'aSensitivity' ? 'text-blue-700 font-medium' : 'text-gray-500'}`}>
              {selectedSetting === 'aSensitivity' && "➤ "}A Sensitivity
            </span>
            <span className="text-sm font-medium">
              {settings.aSensitivity === 0 ? "ASYNC" : `${settings.aSensitivity.toFixed(1)} mV`}
            </span>
          </div>
          <div className="relative">
            <div className="h-2 bg-gray-100 rounded-full">
              <div 
                className="absolute h-full rounded-full transition-all duration-150 ease-out"
                style={{ 
                  width: `${aValueToSlider(settings.aSensitivity)}%`,
                  backgroundColor: selectedSetting === 'aSensitivity' ? "#3b82f6" : "#9ca3af" 
                }}
              />
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={aValueToSlider(settings.aSensitivity)}
              onChange={handleASliderChange}
              className="absolute top-0 w-full h-2 opacity-0 cursor-pointer"
              disabled={isLocked || selectedSetting !== 'aSensitivity'} 
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-gray-500">
            <span>10 mV</span>
            <span>0.4 mV</span>
          </div>
        </div>

        {/* V Sensitivity */}
        <div className={`transition-all ${selectedSetting === 'vSensitivity' ? 'bg-blue-50 p-2 rounded' : 'opacity-50'}`}>
          <div className="flex justify-between items-center mb-1">
            <span className={`text-sm ${selectedSetting === 'vSensitivity' ? 'text-blue-700 font-medium' : 'text-gray-500'}`}>
              {selectedSetting === 'vSensitivity' && "➤ "}V Sensitivity
            </span>
            <span className="text-sm font-medium">
              {settings.vSensitivity === 0 ? "ASYNC" : `${settings.vSensitivity.toFixed(1)} mV`}
            </span>
          </div>
          <div className="relative">
            <div className="h-2 bg-gray-100 rounded-full">
              <div 
                className="absolute h-full rounded-full transition-all duration-150 ease-out"
                style={{ 
                  width: `${vValueToSlider(settings.vSensitivity)}%`,
                  backgroundColor: selectedSetting === 'vSensitivity' ? "#3b82f6" : "#9ca3af" 
                }}
              />
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={vValueToSlider(settings.vSensitivity)}
              onChange={handleVSliderChange}
              className="absolute top-0 w-full h-2 opacity-0 cursor-pointer"
              disabled={isLocked || selectedSetting !== 'vSensitivity'} 
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-gray-500">
            <span>20 mV</span>
            <span>0.8 mV</span>
          </div>
        </div>
        
        {/* Simple instructions */}
        <div className="text-xs text-center text-gray-500 mt-2">
          Use ↑/↓ to navigate
        </div>
        
        {encoderConnected && (
          <div className="mt-2 text-xs text-green-600 text-center">
            Hardware encoder active for {selectedSetting === 'aSensitivity' ? 'A' : 'V'} Sensitivity control
          </div>
        )}
      </div>
    </div>
  );
};

export default DDDSettings;