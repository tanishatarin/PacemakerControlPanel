import React from 'react';
import { Lock, LockOpen } from 'lucide-react';

interface BatteryHeaderProps {
  batteryLevel: number;
  selectedMode: string;
  isLocked: boolean;
}

export const BatteryHeader: React.FC<BatteryHeaderProps> = ({
  batteryLevel,
  selectedMode,
  isLocked,
}) => {
  return (
    <div className="bg-white rounded-3xl shadow-sm p-4 mb-6 flex justify-between items-center">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, index) => {
              const threshold = (index + 1) * 20;
              const isActive = batteryLevel >= threshold;
              return (
                <div
                  key={index}
                  className={`w-2 h-6 rounded-sm transition-colors ${
                    isActive 
                      ? batteryLevel > 20 
                        ? 'bg-green-500' 
                        : 'bg-red-500'
                      : 'bg-gray-200'
                  }`}
                />
              );
            })}
          </div>
          <span className={`${
            batteryLevel > 20 ? 'text-green-500' : 'text-red-500'
          }`}>{batteryLevel}%</span>
        </div>
      </div>
      <div className="text-xl font-bold text-gray-800">
        Mode: {selectedMode}
      </div>
      <div>
        {isLocked ? 
          <Lock className="w-6 h-6 text-green-500" /> : 
          <LockOpen className="w-6 h-6 text-gray-400" />
        }
      </div>
    </div>
  );
};