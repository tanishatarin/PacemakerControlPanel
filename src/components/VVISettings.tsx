import React, { useEffect, useCallback } from 'react';
import { updateControls } from '../utils/encoderApi';

interface VVISettingsProps {
  vSensitivity: number;
  onVSensitivityChange: (value: number) => void;
  onBack: () => void;
  isLocked: boolean;
  encoderConnected?: boolean;
}

const VVISettings: React.FC<VVISettingsProps> = ({
  vSensitivity,
  onVSensitivityChange,
  isLocked,
  encoderConnected = false
}) => {
  // Conversion functions for V sensitivity
  const vSliderToValue = (sliderValue: number): number => {
    if (sliderValue >= 99.5) return 0; // ASYNC when at maximum position
    // Map from 0-99.5 to 20-0.8 range (inverted)
    return 20 - (sliderValue / 99.5) * 19.2;
  };

  const vValueToSlider = (actualValue: number): number => {
    if (actualValue === 0) return 100; // Slider at maximum for ASYNC
    // Map from 20-0.8 range to 0-99.5 (inverted)
    return ((20 - actualValue) / 19.2) * 99.5;
  };

  // Handle V sensitivity slider change
  const handleVSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLocked) return;
    
    const sliderValue = parseFloat(e.target.value);
    const actualValue = vSliderToValue(sliderValue);
    onVSensitivityChange(parseFloat(actualValue.toFixed(1)));
  };

  // Effect to activate the V sensitivity control in hardware
  useEffect(() => {
    if (encoderConnected) {
      // Set V sensitivity as the active control with a slight delay
      const timer = setTimeout(() => {
        updateControls({ 
          active_control: 'v_sensitivity',
          v_sensitivity: vSensitivity
        }).catch(err => console.error('Failed to set active control:', err));
      }, 50);
      
      // Add a periodic reset to prevent sticking
      const resetInterval = setInterval(() => {
        // Only refresh the control if we're still mounted
        updateControls({
          active_control: 'v_sensitivity',
          v_sensitivity: vSensitivity
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
  }, [encoderConnected, vSensitivity]);

  const isVSensitivityDisabled = vSensitivity === 0;

  return (
    <div className="">
      <div className="bg-white rounded-xl">
        <div className="flex justify-between items-center border-b p-2">
          <h2 className="text-lg font-semibold">VVI Settings</h2>
          <div className="w-5"></div> {/* Spacer for alignment */}
        </div>
        
        <div className="p-4 space-y-4">
          {/* V Sensitivity - Using blue color scheme like DDD Settings */}
          <div className={`bg-blue-50 p-2 rounded ${isVSensitivityDisabled ? "opacity-50" : ""}`}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-blue-700 font-medium">V Sensitivity</span>
              <span className="text-sm font-medium">
                {vSensitivity === 0 ? "ASYNC" : `${vSensitivity.toFixed(1)} mV`}
              </span>
            </div>
            <div className="relative">
              <div className="h-2 bg-gray-100 rounded-full">
                <div 
                  className="absolute h-full rounded-full transition-all duration-150 ease-out"
                  style={{ 
                    left: '0',
                    width: `${vValueToSlider(vSensitivity)}%`,
                    backgroundColor: "#3b82f6" // Blue color to match DDD settings
                  }}
                />
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={vValueToSlider(vSensitivity)}
                onChange={handleVSliderChange}
                className="absolute top-0 w-full h-2 opacity-0 cursor-pointer"
                disabled={isLocked}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-500">
              <span>20 mV</span>
              <span>0.8 mV</span>
            </div>
            {isVSensitivityDisabled && (
              <p className="text-xs text-gray-500 mt-1">Adjust value to reactivate</p>
            )}
          </div>

          <div className="mt-4 pt-2 border-t border-gray-100">
            <p className="text-sm text-gray-600">VVI Mode (Ventricular Inhibited)</p>
            <p className="text-xs text-gray-500 mt-1">Paces the ventricle when no natural ventricular activity is detected. Commonly used for atrial fibrillation or other atrial arrhythmias.</p>
          </div>
          
          {encoderConnected && (
            <div className="mt-2 text-xs text-green-600">
              Hardware encoder active for V Sensitivity control
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VVISettings;