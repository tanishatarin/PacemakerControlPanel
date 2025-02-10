import React from 'react';

interface DDDModeControlProps {
  title: string;
  value: number;
  unit: string;
  onChange: (value: number) => void;
  minValue: number;
  maxValue: number;
  showMinMax?: boolean;
}

export const DDDModeControl: React.FC<DDDModeControlProps> = ({
  title,
  value,
  unit,
  onChange,
  minValue,
  maxValue,
}) => {
  const percentage = ((value - minValue) / (maxValue - minValue)) * 100;
  
  return (
    <div className="mb-2">
      <div className="flex justify-between mb-1">
        <span className="text-sm text-gray-700">{title}</span>
        <span className="text-sm font-medium">{value.toFixed(1)} {unit}</span>
      </div>
      <div className="relative">
        <div className="h-2 bg-gray-100 rounded-full">
          <div 
            className="absolute h-full bg-blue-500 rounded-full transition-all duration-150 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <input
          type="range"
          min={minValue}
          max={maxValue}
          value={value}
          step={0.1}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute top-0 w-full h-2 opacity-0 cursor-pointer"
        />
      </div>
    </div>
  );
};