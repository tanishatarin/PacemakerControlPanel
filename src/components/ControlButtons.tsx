import React from 'react';
import { ChevronLeft, ChevronUp, ChevronDown, Key, Pause } from 'lucide-react';

interface ControlButtonsProps {
  onLockToggle: () => void;
  onBackPress: () => void;
  onModeUp: () => void;
  onModeDown: () => void;
  onPauseStart: () => void;
  onPauseEnd: () => void;
}

const ControlButtons: React.FC<ControlButtonsProps> = ({
  onLockToggle,
  onBackPress,
  onModeUp,
  onModeDown,
  onPauseStart,
  onPauseEnd,
}) => {
  return (
    <div className="flex flex-col gap-3">
      <button 
        onClick={onLockToggle}
        className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center hover:bg-gray-50"
      >
        <Key className="w-5 h-5 text-gray-600" />
      </button>
      <button 
        onClick={onBackPress}
        className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center hover:bg-gray-50"
      >
        <ChevronLeft className="w-5 h-5 text-gray-600" />
      </button>
      <button 
        onClick={onModeUp}
        className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center hover:bg-gray-50"
      >
        <ChevronUp className="w-5 h-5 text-gray-600" />
      </button>
      <button 
        onClick={onModeDown}
        className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center hover:bg-gray-50"
      >
        <ChevronDown className="w-5 h-5 text-gray-600" />
      </button>
      {/* <button
        onMouseDown={onPauseStart}
        onMouseUp={onPauseEnd}
        onMouseLeave={onPauseEnd}
        className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center hover:bg-gray-50"
      >
        <Pause className="w-5 h-5 text-gray-600" />
      </button> */}
    </div>
  );
};

export default ControlButtons;