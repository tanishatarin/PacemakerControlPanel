import React from 'react';

interface ModeSelectorProps {
  modes: string[];
  pendingModeIndex: number;
  selectedModeIndex: number; // Add this prop to track the active mode
  isLocked: boolean;
  onModeSelect?: (index: number) => void;
  // Add a new prop for direct update
  onModeActivate?: (index: number) => void;
}

const ModeSelector: React.FC<ModeSelectorProps> = ({
  modes,
  pendingModeIndex,
  selectedModeIndex,
  isLocked,
  onModeSelect,
  onModeActivate
}) => {
  const handleModeClick = (index: number) => {
    if (isLocked) return;
    
    if (onModeSelect) {
      onModeSelect(index);
    }
    
    // If we're already showing this exact mode, activate it immediately
    if (index === pendingModeIndex && pendingModeIndex !== selectedModeIndex && onModeActivate) {
      onModeActivate(index);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {modes.map((mode, index) => (
        <button
          key={mode}
          onClick={() => handleModeClick(index)}
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
};

export default ModeSelector;