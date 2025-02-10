import React from 'react';

interface ModeSelectorProps {
  modes: string[];
  pendingModeIndex: number;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  modes,
  pendingModeIndex,
}) => {
  return (
    <div className="grid grid-cols-2 gap-2">
      {modes.map((mode, index) => (
        <button
          key={mode}
          className={`py-2 px-4 rounded-xl text-sm font-medium transition-all
            ${index === pendingModeIndex 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
        >
          {mode}
        </button>
      ))}
    </div>
  );
};