import React from 'react';

interface ControlSectionProps {
  title: string;
  value: number;
  unit: string;
  onChange: (value: number) => void;
  isLocked?: boolean;
  minValue: number;
  maxValue: number;
  onLockError?: () => void;
  isDimmed?: boolean;
}

const CircularControl: React.FC<ControlSectionProps> = ({ 
    title, 
    value, 
    unit, 
    onChange,
    isLocked,
    minValue,
    maxValue,
    onLockError,
    isDimmed = false
  }) => {
    const getColor = (value: number) => {
      const percentage = (value - minValue) / (maxValue - minValue) * 100;
      if (percentage < 33) return '#4ade80';
      if (percentage < 66) return '#fbbf24';
      return '#ef4444';
    };
  
    const percentage = ((value - minValue) / (maxValue - minValue)) * 100;
    const color = getColor(value);
    
    // SVG parameters
    const radius = 34;
    const stroke = 8;
    const normalizedRadius = radius - stroke / 2;
    
    // Arc parameters
    const startAngle = -120; // Degrees where arc starts
    const endAngle = 120;   // Degrees where arc ends
    const angleRange = endAngle - startAngle;
    
    // Calculate the SVG path for the arc
    const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
      const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
      return {
        x: centerX + (radius * Math.cos(angleInRadians)),
        y: centerY + (radius * Math.sin(angleInRadians))
      };
    };
  
    const createArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
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
  
    const handleChange = (newValue: number) => {
      if (isLocked) {
        onLockError?.();
      } else {
        onChange(newValue);
      }
    };
  
    // Calculate position for min/max labels
    const minPos = polarToCartesian(center, center, normalizedRadius + 14, startAngle);
    const maxPos = polarToCartesian(center, center, normalizedRadius + 14, endAngle);

    // Determine if control should be visually disabled (at 0.0 mA for outputs)
    const isVisuallyDisabled = (title.includes("Output") && value === 0) || isDimmed;
  
    return (
      <div className={`mb-1 transition-opacity duration-300 ${isVisuallyDisabled ? 'opacity-40' : 'opacity-100'}`}>
        <div className="flex flex-col">
          <div className="flex items-center mb-4">
            <div className="flex-1 pl-4">
              <h2 className="text-xl text-gray-800">{title}</h2>
              {isVisuallyDisabled && (
                <p className="text-sm text-gray-500">Adjust value to reactivate</p>
              )}
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
                    {minValue}
                    </text>
                    <text 
                    x={maxPos.x - 21} 
                    y={maxPos.y + 8} 
                    className="text-[13px] fill-gray-400"
                    textAnchor="start"
                    dominantBaseline="middle"
                    >
                    {maxValue}
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
                    className="transition-all duration-150 ease-out"
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
                    {value.toFixed(unit === 'ppm' ? 0 : 1)}
                  </text>
                </svg>
              </div>
              <div className="w-30 text-right pr-4">
                <span className="text-2xl font-bold" style={{ color }}>
                  {value.toFixed(unit === 'ppm' ? 0 : 1)} {unit}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

export default CircularControl;