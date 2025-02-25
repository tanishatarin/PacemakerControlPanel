import React from 'react';

interface EmergencyButtonProps {
  onClick: () => void;
  isLocked?: boolean;
}

const EmergencyButton: React.FC<EmergencyButtonProps> = ({ onClick, isLocked }) => {
  const handleClick = () => {
    if (!isLocked) {
      onClick();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full mb-4 bg-red-500 text-white py-2 px-4 rounded-xl hover:bg-red-600 transition-colors ${
        isLocked ? 'opacity-70 cursor-not-allowed' : ''
      }`}
    >
      DOO Emergency Mode
    </button>
  );
};

export default EmergencyButton;