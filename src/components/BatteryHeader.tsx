import React from 'react';
import { Lock, LockOpen } from 'lucide-react';
import ResetButton from './ResetButton';

interface BatteryHeaderProps {
  selectedMode: string;
  isLocked: boolean;
  onReset: () => void;
}

export const BatteryHeader: React.FC<BatteryHeaderProps> = ({
  selectedMode,
  isLocked,
  onReset
}) => {
  return (
    <div className="bg-white rounded-3xl shadow-sm py-2 px-4 mb-6 flex justify-between items-center">
      <div className="flex-none">
        <ResetButton onReset={onReset} />
      </div>
      
      <div className="flex-1 text-center text-xl font-bold text-gray-800">
        Mode: {selectedMode}
      </div>
      
      <div className="flex-none">
        {isLocked ? 
          <Lock className="w-8 h-8 text-red-500" /> : 
          <LockOpen className="w-8 h-8 text-gray-400" />
        }
      </div>
    </div>
  );
};