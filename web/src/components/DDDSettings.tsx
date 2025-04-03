import React from 'react';

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
}

const DDDSettings: React.FC<DDDSettingsProps> = ({
  settings,
  onSettingsChange,
  isLocked,
  selectedSetting = 'aSensitivity',
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
      </div>
    </div>
  );
};

export default DDDSettings;