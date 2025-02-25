import React from 'react';
import CircularControl from './CircularControl';

interface MainControlsProps {
  rate: number;
  aOutput: number;
  vOutput: number;
  isLocked: boolean;
  onRateChange: (value: number) => void;
  onAOutputChange: (value: number) => void;
  onVOutputChange: (value: number) => void;
  onLockError: () => void;
}

const MainControls: React.FC<MainControlsProps> = ({
  rate,
  aOutput,
  vOutput,
  isLocked,
  onRateChange,
  onAOutputChange,
  onVOutputChange,
  onLockError,
}) => {
  return (
    <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
      <CircularControl
        title="Rate"
        value={rate}
        unit="ppm"
        onChange={onRateChange}
        isLocked={isLocked}
        minValue={30}
        maxValue={200}
        onLockError={onLockError}
      />
      
      <CircularControl
        title="A. Output"
        value={aOutput}
        unit="mA"
        onChange={onAOutputChange}
        isLocked={isLocked}
        minValue={0}
        maxValue={20}
        onLockError={onLockError}
        isDimmed={aOutput === 0}
      />
      
      <CircularControl
        title="V. Output"
        value={vOutput}
        unit="mA"
        onChange={onVOutputChange}
        isLocked={isLocked}
        minValue={0}
        maxValue={25}
        onLockError={onLockError}
        isDimmed={vOutput === 0}
      />
    </div>
  );
};

export default MainControls;