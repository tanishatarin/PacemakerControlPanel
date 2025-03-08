import React from 'react';
import CircularControl from './CircularControl';
import { updateControls, ApiStatus } from '../utils/encoderApi';

interface HardwareAOutputControlProps {
  value: number;
  onChange: (value: number) => void;
  isLocked: boolean;
  onLockError: () => void;
  hardwareStatus?: ApiStatus | null;
  encoderConnected: boolean;
  localControlActive: boolean;
}

const HardwareAOutputControl: React.FC<HardwareAOutputControlProps> = ({
  value,
  onChange,
  isLocked,
  onLockError,
  hardwareStatus,
  encoderConnected,
}) => {
  // Function to handle A. Output changes from UI
  const handleAOutputChange = async (newValue: number) => {
    if (isLocked) {
      onLockError();
      return;
    }
    
    // Update local state
    onChange(newValue);
    
    // Send to hardware if connected
    if (encoderConnected) {
      await updateControls({ 
        a_output: newValue,
        active_control: 'a_output'
      });
    }
  };
  
  // Render the status indicator if connected to hardware
  const renderStatusIndicator = () => {
    if (!encoderConnected) return null;
    
    const rotationCount = hardwareStatus?.hardware?.a_output_encoder?.rotation_count || 0;
    const isActive = hardwareStatus?.hardware?.a_output_encoder?.rotation_count !== undefined;
    
    return (
      <div className="flex items-center gap-1 mt-1">
        <div 
          className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-400'}`}
        />
        <span className="text-xs text-gray-500">
          {isActive 
            ? `Hardware connected (${rotationCount} rotations)` 
            : 'Hardware not detected'}
        </span>
      </div>
    );
  };
  
  return (
    <div>
      <CircularControl
        title="A. Output"
        value={value}
        unit="mA"
        onChange={handleAOutputChange}
        isLocked={isLocked}
        minValue={0}
        maxValue={20}
        onLockError={onLockError}
        isDimmed={value === 0}
      />
      <div className="flex justify-center">
        {renderStatusIndicator()}
      </div>
    </div>
  );
};

export default HardwareAOutputControl;