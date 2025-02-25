import React from 'react';
import { DDDModeControl } from '../DDDModeControl';

// Define the DDDSettingsState type directly here to avoid import errors
interface DDDSettingsState {
  aSensitivity: number;
  vSensitivity: number;
  avDelay: number;
  upperRate: number;
  pvarp: number;
  aTracking: boolean;
  settings: string;
}

interface DDDSettingsProps {
  settings: DDDSettingsState;
  onSettingsChange: (key: string, value: any) => void;
  onBack: () => void;
  onRapidPacing?: () => void;
  isLocked: boolean;
}

const DDDSettings: React.FC<DDDSettingsProps> = ({
  settings,
  onSettingsChange,
  onBack,
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

  return (
    <div className="p-4">
      <div className="bg-white rounded-xl shadow-sm mb-6">
        <div className="flex justify-between items-center px-4 py-3 border-b">
          <h2 className="text-lg font-semibold">DDD Settings</h2>
          <div className="w-5"></div> {/* Spacer for alignment */}
        </div>
        
        <div className="p-3 space-y-4">
          {/* A Sensitivity - Enabled */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-700">A Sensitivity</span>
              <span className="text-sm font-medium">{settings.aSensitivity.toFixed(1)} mV</span>
            </div>
            <div className="relative">
              <div className="h-2 bg-gray-100 rounded-full">
                <div 
                  className="absolute h-full rounded-full transition-all duration-150 ease-out"
                  style={{ 
                    width: `${((settings.aSensitivity - 0.4) / (10 - 0.4)) * 100}%`,
                    backgroundColor: getSliderColor(settings.aSensitivity, 0.4, 10)
                  }}
                />
              </div>
              <input
                type="range"
                min={0.4}
                max={10}
                step={getASensitivityStep(settings.aSensitivity)}
                value={settings.aSensitivity}
                onChange={(e) => handleChange('aSensitivity', parseFloat(e.target.value))}
                className="absolute top-0 w-full h-2 opacity-0 cursor-pointer"
                disabled={isLocked}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-500">0.4 mV</span>
              <span className="text-xs text-gray-500">10 mV</span>
            </div>
          </div>
          
          {/* V Sensitivity - Enabled */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-700">V Sensitivity</span>
              <span className="text-sm font-medium">{settings.vSensitivity.toFixed(1)} mV</span>
            </div>
            <div className="relative">
              <div className="h-2 bg-gray-100 rounded-full">
                <div 
                  className="absolute h-full rounded-full transition-all duration-150 ease-out"
                  style={{ 
                    width: `${((settings.vSensitivity - 0.8) / (20 - 0.8)) * 100}%`,
                    backgroundColor: getSliderColor(settings.vSensitivity, 0.8, 20) 
                  }}
                />
              </div>
              <input
                type="range"
                min={0.8}
                max={20}
                step={getVSensitivityStep(settings.vSensitivity)}
                value={settings.vSensitivity}
                onChange={(e) => handleChange('vSensitivity', parseFloat(e.target.value))}
                className="absolute top-0 w-full h-2 opacity-0 cursor-pointer"
                disabled={isLocked}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-500">0.8 mV</span>
              <span className="text-xs text-gray-500">20 mV</span>
            </div>
          </div>
          
          {/* Disabled controls that show current values */}
          <div className="opacity-60">
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
          
          <div className="opacity-60">
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
          
          <div className="opacity-60">
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
          
          <div className="flex justify-between items-center py-1 opacity-60">
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

          <div className="flex justify-between items-center py-1 opacity-60">
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

          <div className="mt-4 pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-500">Only A and V sensitivity can be adjusted. Other settings require provider access.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DDDSettings;