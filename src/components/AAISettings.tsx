import React, { useEffect } from 'react';
import { updateControls } from '../utils/encoderApi';

interface AAISettingsProps {
  aSensitivity: number;
  onASensitivityChange: (value: number) => void;
  onBack: () => void;
  isLocked: boolean;
  encoderConnected?: boolean;
}

const AAISettings: React.FC<AAISettingsProps> = ({
  aSensitivity,
  onASensitivityChange,
  isLocked,
  encoderConnected = false
}) => {
  // Conversion functions for A sensitivity
  const aSliderToValue = (sliderValue: number): number => {
    if (sliderValue >= 99.5) return 0; // ASYNC when at maximum position
    // Map from 0-99.5 to 10-0.4 range (inverted)
    return 10 - (sliderValue / 99.5) * 9.6;
  };

  const aValueToSlider = (actualValue: number): number => {
    if (actualValue === 0) return 100; // Slider at maximum for ASYNC
    // Map from 10-0.4 range to 0-99.5 (inverted)
    return ((10 - actualValue) / 9.6) * 99.5;
  };

  // Handle A sensitivity slider change
  const handleASliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLocked) return;
    
    const sliderValue = parseFloat(e.target.value);
    const actualValue = aSliderToValue(sliderValue);
    onASensitivityChange(parseFloat(actualValue.toFixed(1)));
  };

  // Effect to activate the A sensitivity control in hardware
  useEffect(() => {
    if (encoderConnected) {
      // Set A sensitivity as the active control with a slight delay
      const timer = setTimeout(() => {
        updateControls({ 
          active_control: 'a_sensitivity',
          a_sensitivity: aSensitivity
        }).catch(err => console.error('Failed to set active control:', err));
      }, 50);
      
      // Add a periodic reset to prevent sticking
      const resetInterval = setInterval(() => {
        // Only refresh the control if we're still mounted
        updateControls({
          active_control: 'a_sensitivity',
          a_sensitivity: aSensitivity
        }).catch(err => console.error('Failed to refresh control:', err));
      }, 5000); // Check every 5 seconds
      
      // Reset active control when component unmounts
      return () => {
        clearTimeout(timer);
        clearInterval(resetInterval);
        updateControls({ active_control: 'none' })
          .catch(err => console.error('Failed to reset active control:', err));
      };
    }
  }, [encoderConnected, aSensitivity]);

  const isASensitivityDisabled = aSensitivity === 0;

  return (
    <div className="">
      <div className="bg-white rounded-xl">
        <div className="flex justify-between items-center border-b p-4">
          <h2 className="text-lg font-semibold">AAI Settings</h2>
          <div className="w-5"></div> {/* Spacer for alignment */}
        </div>
        
        <div className="p-4 space-y-4">
          {/* A Sensitivity - Using blue color scheme like DDD Settings */}
          <div className={`bg-blue-50 p-2 rounded ${isASensitivityDisabled ? "opacity-50" : ""}`}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-blue-700 font-medium">A Sensitivity</span>
              <span className="text-sm font-medium">
                {aSensitivity === 0 ? "ASYNC" : `${aSensitivity.toFixed(1)} mV`}
              </span>
            </div>
            <div className="relative">
              <div className="h-2 bg-gray-100 rounded-full">
                <div 
                  className="absolute h-full rounded-full transition-all duration-150 ease-out"
                  style={{ 
                    left: '0',
                    width: `${aValueToSlider(aSensitivity)}%`,
                    backgroundColor: "#3b82f6" // Blue color to match DDD settings
                  }}
                />
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={aValueToSlider(aSensitivity)}
                onChange={handleASliderChange}
                className="absolute top-0 w-full h-2 opacity-0 cursor-pointer"
                disabled={isLocked}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-600">
              <span>10 mV</span>
              <span>0.4 mV</span>
            </div>
            {isASensitivityDisabled && (
              <p className="text-xs text-gray-600 mt-1">Adjust value to reactivate</p>
            )}
          </div>

          <div className="mt-4 pt-2 border-t border-gray-100">
            <p className="text-sm text-gray-600">AAI Mode (Atrial Inhibited)</p>
            <p className="text-xs text-gray-600 mt-1">Paces the atrium when no natural atrial activity is detected. Commonly used for sinus node dysfunction with intact AV conduction.</p>
          </div>
          
          {encoderConnected && (
            <div className="mt-2 text-xs text-green-600">
              Hardware encoder active for A Sensitivity control
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AAISettings;