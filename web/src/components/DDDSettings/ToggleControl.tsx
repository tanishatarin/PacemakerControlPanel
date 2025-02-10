import React from 'react';

interface ToggleControlProps {
  title: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export const ToggleControl: React.FC<ToggleControlProps> = ({
  title,
  value,
  onChange
}) => {
  return (
    <div className="mb-2">
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-700">{title}</span>
        <button
          onClick={() => onChange(!value)}
          className={`px-3 py-1 rounded-full text-sm ${
            value ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
          }`}
        >
          {value ? 'On' : 'Off'}
        </button>
      </div>
    </div>
  );
};