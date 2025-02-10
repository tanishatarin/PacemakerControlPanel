import React from 'react';

interface EmergencyButtonProps {
  onClick: () => void;
}

export const EmergencyButton: React.FC<EmergencyButtonProps> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="w-full mb-4 bg-red-500 text-white py-2 px-4 rounded-xl hover:bg-red-600 transition-colors"
    >
      DOO Emergency Mode
    </button>
  );
};