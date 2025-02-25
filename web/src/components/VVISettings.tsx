import React from 'react';

interface VVISettingsProps {
  vSensitivity: number;
  onVSensitivityChange: (value: number) => void;
  onBack: () => void;
  isLocked: boolean;
}

const VVISettings: React.FC<VVISettingsProps> = ({
  vSensitivity,
  onVSensitivityChange,
  onBack,
  isLocked
}) => {
  // Function to get slider color based on value
  const getSliderColor = (value: number, min: number, max: number) => {
    const percentage = ((value - min) / (max - min)) * 100;
    if (percentage < 33) return '#4ade80'; // green
    if (percentage < 66) return '#fbbf24'; // yellow
    return '#ef4444'; // red
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
          <h2 className="text-lg font-semibold">VVI Settings</h2>
          <div className="w-5"></div> {/* Spacer for alignment */}
        </div>
        
        <div className="p-3 space-y-4">
          {/* V Sensitivity - Enabled */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-700">V Sensitivity</span>
              <span className="text-sm font-medium">{vSensitivity.toFixed(1)} mV</span>
            </div>
            <div className="relative">
              <div className="h-2 bg-gray-100 rounded-full">
                <div 
                  className="absolute h-full rounded-full transition-all duration-150 ease-out"
                  style={{ 
                    width: `${((vSensitivity - 0.8) / (20 - 0.8)) * 100}%`,
                    backgroundColor: getSliderColor(vSensitivity, 0.8, 20) 
                  }}
                />
              </div>
              <input
                type="range"
                min={0.8}
                max={20}
                step={getVSensitivityStep(vSensitivity)}
                value={vSensitivity}
                onChange={(e) => onVSensitivityChange(parseFloat(e.target.value))}
                className="absolute top-0 w-full h-2 opacity-0 cursor-pointer"
                disabled={isLocked}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-500">0.8 mV</span>
              <span className="text-xs text-gray-500">20 mV</span>
            </div>
          </div>

          <div className="mt-4 pt-2 border-t border-gray-100">
            <p className="text-sm text-gray-600">VVI Mode (Ventricular Inhibited)</p>
            <p className="text-xs text-gray-500 mt-1">Paces the ventricle when no natural ventricular activity is detected. Commonly used for atrial fibrillation or other atrial arrhythmias.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VVISettings;