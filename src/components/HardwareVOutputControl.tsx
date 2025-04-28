import React, { useState, useEffect } from 'react';
import CircularControl from './CircularControl';

interface HardwareVOutputControlProps {
  value: number;
  onChange: (value: number) => void;
  isLocked: boolean;
  onLockError: () => void;
}

const HardwareVOutputControl: React.FC<HardwareVOutputControlProps> = ({
  value,
  onChange,
  isLocked,
  onLockError
}) => {
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  
  // Function to fetch the current encoder value from Raspberry Pi
  // const fetchVOutputFromHardware = async () => {
  //   try {
  //     const response = await fetch('http://raspberrypi.local:5000/api/v_output');
      
  //     if (response.ok) {
  //       const data = await response.json();
  //       // Only update if value has changed
  //       if (Math.abs(data.value - value) > 0.05) {
  //         if (isLocked) {
  //           onLockError();
  //         } else {
  //           onChange(data.value);
  //         }
  //       }
  //       setConnectionStatus('connected');
  //     } else {
  //       setConnectionStatus('error');
  //     }
  //   } catch (err) {
  //     console.error('Error fetching V. Output:', err);
  //     setConnectionStatus('error');
  //   }
  // };
  // In HardwareVOutputControl.tsx - Ensure fetch is using the correct URL and error handling
  const fetchVOutputFromHardware = async () => {
    try {
      const response = await fetch('http://raspberrypi.local:5000/api/v_output');
      
      if (response.ok) {
        const data = await response.json();
        console.log("V Output from hardware:", data.value); // Debug logging
        
        // Only update if value has changed significantly
        if (Math.abs(data.value - value) > 0.05) {
          if (isLocked) {
            onLockError();
          } else {
            onChange(data.value);
          }
        }
        setConnectionStatus('connected');
      } else {
        console.error("Error fetching V Output:", response.status, response.statusText);
        setConnectionStatus('error');
      }
    } catch (err) {
      console.error('Error fetching V. Output:', err);
      setConnectionStatus('error');
    }
  };

  // Send V. Output changes back to the hardware
  const updateHardwareVOutput = async (newValue: number) => {
    try {
      await fetch('http://raspberrypi.local:5000/api/v_output/set', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value: newValue })
      });
    } catch (err) {
      console.error('Error updating hardware V. Output:', err);
    }
  };
  
  // Set up polling to fetch the V. Output from hardware
  useEffect(() => {
    // Initial fetch
    fetchVOutputFromHardware();
    
    // Poll every 200ms
    const intervalId = setInterval(fetchVOutputFromHardware, 200);
    
    return () => clearInterval(intervalId);
  }, []);
  
  // Update hardware when the V. Output is changed in UI
  useEffect(() => {
    updateHardwareVOutput(value);
  }, [value]);
  
  // Function to handle V. Output changes from UI
  const handleVOutputChange = (newValue: number) => {
    if (isLocked) {
      onLockError();
      return;
    }
    onChange(newValue);
  };
  
  // Render the status indicator
  const renderStatusIndicator = () => {
    let color = '#cccccc';
    let text = '';
    
    switch (connectionStatus) {
      case 'connected':
        color = '#4CAF50'; // Green
        text = 'Hardware connected';
        break;
      case 'error':
        color = '#F44336'; // Red
        text = 'Connection error';
        break;
      default:
        color = '#FFC107'; // Yellow
        text = 'Connecting...';
    }
    
    return (
      <div className="flex items-center gap-1 mt-1">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></div>
        <span className="text-xs text-gray-500">{text}</span>
      </div>
    );
  };
  
  return (
    <div>
      <CircularControl
        title="V. Output"
        value={value}
        unit="mA"
        onChange={handleVOutputChange}
        isLocked={isLocked}
        minValue={0}
        maxValue={25}
        onLockError={onLockError}
        isDimmed={value === 0}
      />
      <div className="flex justify-center">
        {renderStatusIndicator()}
      </div>
    </div>
  );
};

export default HardwareVOutputControl;