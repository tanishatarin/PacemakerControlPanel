import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';

interface RapidPacingScreenProps {
  onBack: () => void;
  isLocked: boolean;
}

const RapidPacingScreen: React.FC<RapidPacingScreenProps> = ({ 
  onBack,
  isLocked 
}) => {
  const [rapValue, setRapValue] = useState(250);
  const [isDelivering, setIsDelivering] = useState(false);
  const deliveryTimeout = useRef<number>();

  useEffect(() => {
    return () => {
      if (deliveryTimeout.current) {
        clearTimeout(deliveryTimeout.current);
      }
    };
  }, []);

  const handleDeliveryStart = () => {
    if (isLocked) return;
    setIsDelivering(true);
    deliveryTimeout.current = window.setTimeout(() => {
      setIsDelivering(false);
    }, 5000);
  };

  const handleDeliveryEnd = () => {
    setIsDelivering(false);
    if (deliveryTimeout.current) {
      clearTimeout(deliveryTimeout.current);
    }
  };

  const handleRapChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLocked) return;
    setRapValue(parseInt(e.target.value));
  };

  return (
    <div className="max-w-2xl mx-auto p-8 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-3xl shadow-sm p-6">
        <div className="flex items-center mb-6">
          <button
            onClick={onBack}
            className="mr-4 hover:bg-gray-100 p-2 rounded-lg"
            disabled={isLocked}
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-bold">Rapid Atrial Pacing</h2>
        </div>

        <div className="mb-8">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-700">RAP Rate</span>
            <span className="text-sm font-medium">{rapValue} ppm</span>
          </div>
          <div className="relative mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>60</span>
              <span>600</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full">
              <div 
                className="absolute h-full bg-yellow-500 rounded-full transition-all duration-150 ease-out"
                style={{ width: `${(rapValue - 60) / (600 - 60) * 100}%` }}
              />
            </div>
            <input
              type="range"
              min={60}
              max={600}
              value={rapValue}
              onChange={handleRapChange}
              disabled={isLocked}
              className="absolute top-0 w-full h-2 opacity-0 cursor-pointer"
            />
          </div>
        </div>

        <div className="mt-8">
          <button
            onMouseDown={handleDeliveryStart}
            onMouseUp={handleDeliveryEnd}
            onMouseLeave={handleDeliveryEnd}
            disabled={isLocked}
            className={`w-full py-4 rounded-xl text-white text-lg font-medium ${
              isDelivering
                ? 'bg-red-500'
                : isLocked
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-yellow-500 hover:bg-yellow-600'
            }`}
          >
            {isDelivering ? 'DELIVERING...' : 'Hold to DELIVER Rapid Atrial Pacing'}
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500">Note: Rapid atrial pacing should only be used under direct provider supervision.</p>
        </div>
      </div>
    </div>
  );
};

export default RapidPacingScreen;