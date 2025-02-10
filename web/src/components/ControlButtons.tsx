import React from 'react';
import { Key, ChevronUp, ChevronDown, Pause } from 'lucide-react';

interface ControlButtonsProps {
  onLockToggle: () => void;
  onModeUp: () => void;
  onModeDown: () => void;
  onPauseStart: () => void;
  onPauseEnd: () => void;
}

export const ControlButtons: React.FC<ControlButtonsProps> = ({
  onLockToggle,
  onModeUp,
  onModeDown,
  onPauseStart,
  onPauseEnd,
}) => {
  return (
    <div className="flex justify-between">
      <button 
        onClick={onLockToggle}
        className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center hover:bg-gray-50"
      >
        <Key className="w-5 h-5 text-gray-600" />
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
      <button
        onMouseDown={onPauseStart}
        onMouseUp={onPauseEnd}
        onMouseLeave={onPauseEnd}
        className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center hover:bg-gray-50"
      >
        <Pause className="w-5 h-5 text-gray-600" />
      </button>
    </div>
  );
};