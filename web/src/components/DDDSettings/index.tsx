import React, { useEffect } from 'react';

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
  onRapidPacing?: () => void;
  isLocked: boolean;
}

const DDDSettings: React.FC<DDDSettingsProps> = ({
  settings,
  onSettingsChange,
  isLocked
}) => {
  const handleChange = (key: string, value: any) => {
    if (isLocked) return;
    onSettingsChange(key, value);
  };

  // Function to get slider color based on value
  const getSliderColor = (value: number, min: number, max: number) => {
    const percentage = ((value - min) / (max - min)) * 100;
    if (percentage < 33) return '#4ade80'; // green
    if (percentage < 66) return '#fbbf24'; // yellow
    return '#ef4444'; // red
  };

  // Function to determine step size for A sensitivity
  const getASensitivityStep = (value: number): number => {
    if (value <= 0.8) return 0.1;
    if (value <= 2) return 0.2;
    if (value <= 3) return 0.5;
    return 1;
  };

  // Function to determine step size for V sensitivity
  const getVSensitivityStep = (value: number): number => {
    if (value <= 1) return 0.2;
    if (value <= 3) return 0.5;
    if (value <= 10) return 1;
    return 2;
  };

  // Convert a value from the slider range (0-100) to the actual sensitivity value
  const aSliderToValue = (sliderValue: number): number => {
    if (sliderValue >= 99.5) return 0; // ASYNC when at maximum position
    // Map from 0-99.5 to 10-0.4 range (inverted)
    return 10 - (sliderValue / 99.5) * 9.6;
  };

  // Convert actual sensitivity value to slider range (0-100)
  const aValueToSlider = (actualValue: number): number => {
    if (actualValue === 0) return 100; // Slider at maximum for ASYNC
    // Map from 10-0.4 range to 0-99.5 (inverted)
    return ((10 - actualValue) / 9.6) * 99.5;
  };

  // Similar conversion functions for V sensitivity
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

  // Handle A sensitivity slider change
  const handleASliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sliderValue = parseFloat(e.target.value);
    const actualValue = aSliderToValue(sliderValue);
    handleChange('aSensitivity', parseFloat(actualValue.toFixed(1)));
  };

  // Handle V sensitivity slider change
  const handleVSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sliderValue = parseFloat(e.target.value);
    const actualValue = vSliderToValue(sliderValue);
    handleChange('vSensitivity', parseFloat(actualValue.toFixed(1)));
  };

  // Check if sensitivities are disabled (ASYNC mode)
  const isASensitivityDisabled = settings.aSensitivity === 0;
  const isVSensitivityDisabled = settings.vSensitivity === 0;
  
  // Effects to handle PVARP and Upper Rate disappearing in ASYNC mode
  useEffect(() => {
    if (isASensitivityDisabled || isVSensitivityDisabled) {
      // If either sensitivity is 0, make other changes that happen in ASYNC mode
      // This could include disabling other settings or showing different UI elements
      console.log("ASYNC mode active");
    }
  }, [isASensitivityDisabled, isVSensitivityDisabled]);

  return (
    <div className="">
      <div className="bg-white rounded-xl ">
        <div className="flex justify-between items-center border-b">
          <h2 className="text-lg font-semibold">DDD Settings</h2>
          <div className="w-5"></div> {/* Spacer for alignment */}
        </div>
        
        <div className="p-3 space-y-1">
          {/* A Sensitivity - Enabled */}
          <div className={isASensitivityDisabled ? "opacity-50" : ""}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-700">A Sensitivity</span>
              <span className="text-sm font-medium">
                {settings.aSensitivity === 0 ? "ASYNC" : `${settings.aSensitivity.toFixed(1)} mV`}
              </span>
            </div>
            <div className="relative">
              <div className="h-2 bg-gray-100 rounded-full">
                <div 
                  className="absolute h-full rounded-full transition-all duration-150 ease-out"
                  style={{ 
                    left: '0',
                    width: `${aValueToSlider(settings.aSensitivity)}%`,
                    backgroundColor: isASensitivityDisabled ? "#9ca3af" : getSliderColor(settings.aSensitivity, 0.4, 10)
                  }}
                />
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={aValueToSlider(settings.aSensitivity)}
                onChange={handleASliderChange}
                className="absolute top-0 w-full h-2 opacity-0 cursor-pointer"
                disabled={isLocked}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-500">
              <span>10 mV</span>
              <span>0.4 mV</span>
            </div>
            {isASensitivityDisabled && (
              <p className="text-xs text-gray-500 mt-1">Adjust value to reactivate</p>
            )}
          </div>
          
          {/* V Sensitivity - Enabled */}
          <div className={isVSensitivityDisabled ? "opacity-50" : ""}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-700">V Sensitivity</span>
              <span className="text-sm font-medium">
                {settings.vSensitivity === 0 ? "ASYNC" : `${settings.vSensitivity.toFixed(1)} mV`}
              </span>
            </div>
            <div className="relative">
              <div className="h-2 bg-gray-100 rounded-full">
                <div 
                  className="absolute h-full rounded-full transition-all duration-150 ease-out"
                  style={{ 
                    left: '0',
                    width: `${vValueToSlider(settings.vSensitivity)}%`,
                    backgroundColor: isVSensitivityDisabled ? "#9ca3af" : getSliderColor(settings.vSensitivity, 0.8, 20)
                  }}
                />
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={vValueToSlider(settings.vSensitivity)}
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
          
          {/* Disabled controls - same as before */}
          <div className="opacity-60 space-y-3">
            {/* AV Delay */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-700">AV Delay</span>
                <span className="text-sm font-medium">{settings.avDelay} ms</span>
              </div>
              <div className="relative">
                <div className="h-2 bg-gray-100 rounded-full">
                  <div 
                    className="absolute h-full bg-gray-400 rounded-full"
                    style={{ width: `${((settings.avDelay - 20) / (300 - 20)) * 100}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={20}
                  max={300}
                  value={settings.avDelay}
                  className="absolute top-0 w-full h-2 opacity-0 cursor-not-allowed"
                  disabled={true}
                />
              </div>
            </div>
            
            {/* Upper Rate */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-700">Upper Rate</span>
                <span className="text-sm font-medium">{settings.upperRate} ppm</span>
              </div>
              <div className="relative">
                <div className="h-2 bg-gray-100 rounded-full">
                  <div 
                    className="absolute h-full bg-gray-400 rounded-full"
                    style={{ width: `${((settings.upperRate - 86) / (230 - 86)) * 100}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={86}
                  max={230}
                  value={settings.upperRate}
                  className="absolute top-0 w-full h-2 opacity-0 cursor-not-allowed"
                  disabled={true}
                />
              </div>
            </div>
            
            {/* PVARP */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-700">PVARP</span>
                <span className="text-sm font-medium">{settings.pvarp} ms</span>
              </div>
              <div className="relative">
                <div className="h-2 bg-gray-100 rounded-full">
                  <div 
                    className="absolute h-full bg-gray-400 rounded-full"
                    style={{ width: `${((settings.pvarp - 150) / (500 - 150)) * 100}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={150}
                  max={500}
                  value={settings.pvarp}
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
                  settings.aTracking ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                } cursor-not-allowed`}
                disabled={true}
              >
                {settings.aTracking ? 'On' : 'Off'}
              </button>
            </div>

            {/* Settings */}
            <div className="flex justify-between items-center py-1">
              <span className="text-sm text-gray-700">Settings</span>
              <select
                value={settings.settings}
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
    </div>
  );
};

export default DDDSettings;