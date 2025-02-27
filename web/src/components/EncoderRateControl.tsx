import React, { useState, useEffect, useRef } from 'react';

const EncoderRateControl = ({ 
  onRateChange, 
  isLocked = false, 
  onLockError = () => {},
  initialRate = 80,
  minRate = 30,
  maxRate = 200
}) => {
  const [rate, setRate] = useState(initialRate);
  const [isButtonPressed, setIsButtonPressed] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const rotationTimer = useRef(null);
  
  // Simulate encoder behavior
  const handleRotate = (direction) => {
    if (isLocked) {
      onLockError();
      return;
    }
    
    setIsRotating(true);
    
    setRate(prevRate => {
      // Calculate new rate based on current rate and direction
      let newRate;
      // Implement variable step size similar to CircularControl
      if (prevRate < 50) {
        newRate = prevRate + (direction * 5);
      } else if (prevRate < 100) {
        newRate = prevRate + (direction * 2);
      } else if (prevRate < 170) {
        newRate = prevRate + (direction * 5);
      } else {
        newRate = prevRate + (direction * 6);
      }
      
      // Clamp between min and max
      newRate = Math.max(minRate, Math.min(maxRate, newRate));
      
      // Notify parent component
      onRateChange(newRate);
      
      return newRate;
    });
    
    // Clear previous timer if any
    if (rotationTimer.current) {
      clearTimeout(rotationTimer.current);
    }
    
    // Set a timer to turn off rotation indicator
    rotationTimer.current = setTimeout(() => {
      setIsRotating(false);
    }, 300);
  };
  
  // Handle button press (reset to 30)
  const handleButtonPress = () => {
    if (isLocked) {
      onLockError();
      return;
    }
    
    setIsButtonPressed(true);
    
    // Reset to 30 (as in the Python code)
    setRate(30);
    onRateChange(30);
    
    // Reset button state after a short delay
    setTimeout(() => {
      setIsButtonPressed(false);
    }, 300);
  };
  
  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (rotationTimer.current) {
        clearTimeout(rotationTimer.current);
      }
    };
  }, []);
  
  // Map rate to percentage for UI (similar to original CircularControl)
  const percentage = ((rate - minRate) / (maxRate - minRate)) * 100;
  
  // Get color based on value
  const getColor = (value) => {
    const percentage = (value - minRate) / (maxRate - minRate) * 100;
    if (percentage < 33) return '#4ade80'; // green
    if (percentage < 66) return '#fbbf24'; // yellow
    return '#ef4444'; // red
  };
  
  const color = getColor(rate);
  
  // Calculate the SVG parameters for the arc
  const radius = 34;
  const stroke = 8;
  const normalizedRadius = radius - stroke / 2;
  
  // Arc parameters
  const startAngle = -120; // Degrees where arc starts
  const endAngle = 120;   // Degrees where arc ends
  const angleRange = endAngle - startAngle;
  
  // Calculate the SVG path for the arc
  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };

  const createArc = (x, y, radius, startAngle, endAngle) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    
    return [
      "M", start.x, start.y, 
      "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
    ].join(" ");
  };

  // Calculate progress endpoint based on current value
  const progressAngle = startAngle + (percentage / 100) * angleRange;
  
  const center = radius + stroke;
  const backgroundArc = createArc(center, center, normalizedRadius, startAngle, endAngle);
  const progressArc = createArc(center, center, normalizedRadius, startAngle, progressAngle);

  // Calculate position for min/max labels
  const minPos = polarToCartesian(center, center, normalizedRadius + 14, startAngle);
  const maxPos = polarToCartesian(center, center, normalizedRadius + 14, endAngle);

  return (
    <div className="mb-8">
      <div className="flex flex-col">
        <div className="flex items-center mb-4">
          <div className="flex-1 pl-4">
            <h2 className="text-xl text-gray-800">Rate (Pin 27/22)</h2>
            <p className="text-sm text-gray-500">Button Pin: 25</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-24 h-24">
              <svg className="w-full h-full">
                {/* Range text */}
                <text 
                  x={minPos.x + 18} 
                  y={minPos.y + 8} 
                  className="text-[13px] fill-gray-400"
                  textAnchor="end"
                  dominantBaseline="middle"
                >
                  {minRate}
                </text>
                <text 
                  x={maxPos.x - 21} 
                  y={maxPos.y + 8} 
                  className="text-[13px] fill-gray-400"
                  textAnchor="start"
                  dominantBaseline="middle"
                >
                  {maxRate}
                </text>

                {/* Background arc */}
                <path
                  d={backgroundArc}
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  className="opacity-50"
                />
                
                {/* Progress arc */}
                <path
                  d={progressArc}
                  fill="none"
                  stroke={color}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  className={`transition-all duration-150 ease-out ${isRotating ? 'opacity-80' : ''}`}
                />
                
                {/* Current value */}
                <text
                  x={center}
                  y={center}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={color}
                  className="text-lg font-bold"
                >
                  {rate}
                </text>
              </svg>
            </div>
            <div className="w-30 text-right pr-4">
              <span className="text-2xl font-bold" style={{ color }}>
                {rate} ppm
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="px-4">
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm text-gray-600">Simulate Rotary Encoder:</label>
          <button 
            onClick={handleButtonPress}
            className={`ml-2 px-3 py-1 rounded-lg ${isButtonPressed ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'} transition-colors`}
          >
            Reset to 30
          </button>
        </div>
        
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => handleRotate(-1)}
            className="px-3 py-1 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
          >
            ◀ Rotate Left
          </button>
          <button
            onClick={() => handleRotate(1)}
            className="px-3 py-1 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
          >
            Rotate Right ▶
          </button>
        </div>
        
        <div className="relative">
          <div className="h-2 bg-gray-100 rounded-full">
            <div 
              className="absolute h-full rounded-full transition-all duration-150 ease-out"
              style={{ 
                width: `${percentage}%`,
                backgroundColor: color
              }}
            />
          </div>
          <input
            type="range"
            min={minRate}
            max={maxRate}
            value={rate}
            step={1}
            onChange={(e) => {
              if (isLocked) {
                onLockError();
                return;
              }
              const newValue = parseInt(e.target.value);
              setRate(newValue);
              onRateChange(newValue);
            }}
            className="absolute top-0 w-full h-2 opacity-0 cursor-pointer"
            disabled={isLocked}
          />
        </div>
        
        <div className="mt-4 text-sm text-gray-500">
          <p>• CLK connected to GPIO27, DT connected to GPIO22</p>
          <p>• Button connected to GPIO25</p>
          <p>• Range: {minRate}-{maxRate}, with reset to 30</p>
        </div>
      </div>
    </div>
  );
};

export default EncoderRateControl;