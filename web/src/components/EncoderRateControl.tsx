import React, { useState, useEffect, useRef } from 'react';

interface EncoderRateControlProps {
  onRateChange: (value: number) => void;
  isLocked?: boolean;
  onLockError?: () => void;
  initialRate?: number;
  minRate?: number;
  maxRate?: number;
}

// Shared WebSocket instance to prevent multiple connections
let sharedWebSocket: WebSocket | null = null;
let wsConnectionAttempts = 0;

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
  const [rotationDirection, setRotationDirection] = useState<'left' | 'right' | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  
  // Use ref for values that don't trigger re-renders
  const lastValueRef = useRef(initialRate);
  const reconnectTimerRef = useRef<number | null>(null);
  
  // Connect or reuse WebSocket
  const setupWebSocket = () => {
    if (sharedWebSocket !== null && sharedWebSocket.readyState === WebSocket.OPEN) {
      // Reuse existing connection
      setConnectionStatus('connected');
      return;
    }
    
    // Clean up any existing connections
    if (sharedWebSocket && (sharedWebSocket.readyState === WebSocket.OPEN || sharedWebSocket.readyState === WebSocket.CONNECTING)) {
      console.log('Closing existing WebSocket');
      sharedWebSocket.close();
      sharedWebSocket = null;
    }
    
    // Delay based on connection attempts (simple exponential backoff)
    const delay = Math.min(wsConnectionAttempts * 500, 3000);
    wsConnectionAttempts++;
    
    // Update UI state
    setConnectionStatus('connecting');
    
    setTimeout(() => {
      try {
        // Create new connection
        const serverUrl = 'ws://localhost:8080';
        const socket = new WebSocket(serverUrl);
        sharedWebSocket = socket;
        
        // Handle connection events
        socket.onopen = () => {
          console.log('WebSocket connected');
          setConnectionStatus('connected');
          wsConnectionAttempts = 0; // Reset counter on successful connection
        };
        
        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'value' && !isLocked) {
              const newValue = data.value;
              // Only update if value changed
              if (newValue !== lastValueRef.current) {
                const direction = newValue > lastValueRef.current ? 'right' : 'left';
                setRotationDirection(direction);
                setRate(newValue);
                onRateChange(newValue);
                lastValueRef.current = newValue;
                
                // Visual feedback
                setIsRotating(true);
                setTimeout(() => {
                  setIsRotating(false);
                  setRotationDirection(null);
                }, 200);
              }
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
        
        socket.onclose = () => {
          console.log('WebSocket disconnected');
          setConnectionStatus('disconnected');
          
          // Schedule reconnection attempt
          if (reconnectTimerRef.current === null) {
            reconnectTimerRef.current = window.setTimeout(() => {
              reconnectTimerRef.current = null;
              setupWebSocket();
            }, delay) as unknown as number;
          }
        };
        
        socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          // Let onclose handle reconnection
        };
      } catch (error) {
        console.error('Error creating WebSocket:', error);
        setConnectionStatus('disconnected');
        
        // Schedule reconnection attempt
        if (reconnectTimerRef.current === null) {
          reconnectTimerRef.current = window.setTimeout(() => {
            reconnectTimerRef.current = null;
            setupWebSocket();
          }, delay) as unknown as number;
        }
      }
    }, delay > 0 ? delay : 0);
  };
  
  // Send value to server
  const sendValueToServer = (newValue: number) => {
    if (sharedWebSocket && sharedWebSocket.readyState === WebSocket.OPEN) {
      sharedWebSocket.send(JSON.stringify({ type: 'setValue', value: newValue }));
    }
  };
  
  // Set up WebSocket on component mount
  useEffect(() => {
    setupWebSocket();
    
    // Clean up on unmount
    return () => {
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, []);
  
  // Handle manual rotation buttons
  const handleRotate = (direction: 'left' | 'right') => {
    if (isLocked) {
      onLockError();
      return;
    }
    
    setIsRotating(true);
    setRotationDirection(direction);
    
    // Calculate new rate based on direction - always change by 1
    const newRate = direction === 'right' 
      ? Math.min(maxRate, rate + 1)
      : Math.max(minRate, rate - 1);
    
    // Update local state
    setRate(newRate);
    onRateChange(newRate);
    lastValueRef.current = newRate;
    
    // Send to server
    sendValueToServer(newRate);
    
    // Reset rotation visual feedback
    setTimeout(() => {
      setIsRotating(false);
      setRotationDirection(null);
    }, 200);
  };
  
  // Handle reset button press
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
    lastValueRef.current = resetValue;
    
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
              <div 
                className={`ml-2 w-3 h-3 rounded-full transition-colors duration-300 ${
                  connectionStatus === 'connected' ? 'bg-green-500' : 
                  connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
                }`} 
                title={`Status: ${connectionStatus}`}
              />
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
                  className={`transition-all duration-150 ease-out ${isRotating ? rotationDirection === 'right' ? 'animate-pulse' : 'animate-pulse' : ''}`}
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
              {isRotating && rotationDirection && (
                <span className="ml-2 text-sm">
                  {rotationDirection === 'right' ? '▶' : '◀'}
                </span>
              )}
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
            onClick={() => handleRotate('left')}
            className={`px-3 py-1 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isLocked}
          >
            ◀ Rotate Left (-1)
          </button>
          <div className="text-xs text-gray-500">
            {connectionStatus === 'connected' ? 'Connected to Hardware' : 
             connectionStatus === 'connecting' ? 'Connecting to Hardware...' : 
             'Reconnecting...'}
          </div>
          <button
            onClick={() => handleRotate('right')}
            className={`px-3 py-1 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isLocked}
          >
            Rotate Right (+1) ▶
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
              lastValueRef.current = newValue;
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