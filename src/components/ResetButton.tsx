import React from 'react';
import { RefreshCw } from 'lucide-react';

interface ResetButtonProps {
  onReset: () => void;
}

const ResetButton: React.FC<ResetButtonProps> = ({ onReset }) => {
  return (
    <div>
      <button
        onClick={onReset}
        className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 transition-colors"
        title="Reset to default values"
      >
        <RefreshCw className="w-5 h-5 text-gray-600"/>
      </button>
      <span className="flex justify-center text-xs text-gray-500"> 
        refresh
      </span>
    </div>
  );
};

export default ResetButton;