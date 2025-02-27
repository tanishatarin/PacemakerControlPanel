import React, { useState, useEffect, useRef } from 'react';

interface EncoderRateControlProps {
  onRateChange: (value: number) => void;
  isLocked?: boolean;
  onLockError?: () => void;
  initialRate?: number;
  minRate?: number;
  maxRate?: number;
}

const EncoderRateControl: React.FC<EncoderRateControlProps> = ({ 
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
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  
  // Connect to WebSocket server
  const connectWebSocket = () => {
    // Clean up any existing connection
    if (ws.current) {
      ws.current.close();
    }
    
    // Update status
    setConnectionStatus('connecting');
    
    // Create new WebSocket connection
    const serverUrl = 'ws://localhost:8080'; // Change to your server's address if needed
    const newWs = new WebSocket(serverUrl);
    ws.current = newWs;
    
    // WebSocket event handlers
    newWs.onopen = () => {
      console.log('Connected to encoder WebSocket server');
      setConnectionStatus('connected');
    };
    
    newWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'value' && !isLocked) {
          if (data.value !== rate) {
            setRate(data.value);
            onRateChange(data.value);
            
            // Visual feedback for rotation
            setIsRotating(true);
            setTimeout(() => setIsRotating(false), 300);
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    newWs.onclose = () => {
      console.log('Disconnected from encoder WebSocket server');
      setConnectionStatus('disconnected');
      
      // Automatically try to reconnect
      if (reconnectTimerRef.current === null) {
        reconnectTimerRef.current = window.setTimeout(() => {
          reconnectTimerRef.current = null;
          connectWebSocket();
        }, 5000); // Try to reconnect after 5 seconds
      }
    };
    
    newWs.onerror = (error) => {
      console.error('WebSocket error:', error);
      newWs.close();
    };
  };
  
  // Send value to WebSocket server
  const sendValueToServer = (newValue: number) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'setValue', value: newValue }));
    }
  };
  
  // Initialize WebSocket connection
  useEffect(() => {
    connectWebSocket();
    
    // Clean up on component unmount
    return () => {
      if (ws.current) {
        ws.current.close();
      }
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, []);
  
  // Simulate encoder rotation (for UI only)
  const handleRotate = (direction: number) => {
    if (isLocked) {
      onLockError();
      return;
    }
    
    setIsRotating(true);
    
    // Calculate new rate based on current rate and direction
    let newRate;
    if (rate < 50) {
      newRate = rate + (direction * 5);
    } else if (rate < 100) {
      newRate = rate + (direction * 2);
    } else if (rate < 170) {
      newRate = rate + (direction * 5);
    } else {
      newRate = rate + (direction * 6);
    }
    
    // Clamp between min and max
    newRate = Math.max(minRate, Math.min(maxRate, newRate));
    
    // Update local state
    setRate(newRate);
    onRateChange(newRate);
    
    // Send to server
    sendValueToServer(newRate);
    
    // Reset rotation visual feedback
    setTimeout(() => setIsRotating(false), 300);
  };
  
  // Handle button press (reset to 30)
  const handleButtonPress = () => {
    if (isLocked) {
      onLockError();
      return;
    }
    
    setIsButtonPressed(true);
    
    // Reset to 30 (as in the Python code)
    const resetValue = 30;
    setRate(resetValue);
    onRateChange(resetValue);
    
    // Send to server
    sendValueToServer(resetValue);
    
    // Reset button visual state after a short delay
    setTimeout(() => setIsButtonPressed(false), 300);
  };
  
  // Map rate to percentage for UI
  const percentage = ((rate - minRate) / (maxRate - minRate)) * 100;
  
  // Get color based on value
  const getColor = (value: number) => {
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

  // Calculate position for min/max labels
  const minPos = polarToCartesian(center, center, normalizedRadius + 14, startAngle);
  const maxPos = polarToCartesian(center, center, normalizedRadius + 14, endAngle);

  return (
    <div className="mb-8">
      <div className="flex flex-col">
        <div className="flex items-center mb-4">
          <div className="flex-1 pl-4">
            <div className="flex items-center">
              <h2 className="text-xl text-gray-800">Rate</h2>
              <div className={`ml-2 w-3 h-3 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' : 
                connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
            </div>
            <p className="text-sm text-gray-500">CLK: GPIO27, DT: GPIO22, BTN: GPIO25</p>
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
                  className={`transition-all duration-150 ease-out ${isRotating ? 'animate-pulse' : ''}`}
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
          <label className="block text-sm text-gray-600">Manual Control:</label>
          <button 
            onClick={handleButtonPress}
            className={`ml-2 px-3 py-1 rounded-lg ${isButtonPressed ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'} transition-colors ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isLocked}
          >
            Reset to 30
          </button>
        </div>
        
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => handleRotate(-1)}
            className={`px-3 py-1 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isLocked}
          >
            ◀ Rotate Left
          </button>
          <div className="text-xs text-gray-500">
            {connectionStatus === 'connected' ? 'Connected to Hardware' : 
             connectionStatus === 'connecting' ? 'Connecting to Hardware...' : 
             'Hardware Disconnected - Retrying...'}
          </div>
          <button
            onClick={() => handleRotate(1)}
            className={`px-3 py-1 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isLocked}
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
              sendValueToServer(newValue);
            }}
            className="absolute top-0 w-full h-2 opacity-0 cursor-pointer"
            disabled={isLocked}
          />
        </div>
      </div>
    </div>
  );
};

export default EncoderRateControl;