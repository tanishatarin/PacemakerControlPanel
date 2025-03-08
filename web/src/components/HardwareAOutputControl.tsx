import React, { useState, useEffect } from 'react';
import CircularControl from './CircularControl';

interface HardwareAOutputControlProps {
  value: number;
  onChange: (value: number) => void;
  isLocked: boolean;
  onLockError: () => void;
}

const HardwareAOutputControl: React.FC<HardwareAOutputControlProps> = ({
  value,
  onChange,
  isLocked,
  onLockError
}) => {
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  
  // Function to fetch the current encoder value from Raspberry Pi
  const fetchAOutputFromHardware = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/a_output');
      
      if (response.ok) {
        const data = await response.json();
        // Only update if value has changed
        if (Math.abs(data.value - value) > 0.05) {
          if (isLocked) {
            onLockError();
          } else {
            onChange(data.value);
          }
        }
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('error');
      }
    } catch (err) {
      console.error('Error fetching A. Output:', err);
      setConnectionStatus('error');
    }
  };
  
  // Send A. Output changes back to the hardware
  const updateHardwareAOutput = async (newValue: number) => {
    try {
      await fetch('http://localhost:5000/api/a_output/set', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value: newValue })
      });
    } catch (err) {
      console.error('Error updating hardware A. Output:', err);
    }
  };
  
  // Set up polling to fetch the A. Output from hardware
  useEffect(() => {
    // Initial fetch
    fetchAOutputFromHardware();
    
    // Poll every 200ms
    const intervalId = setInterval(fetchAOutputFromHardware, 200);
    
    return () => clearInterval(intervalId);
  }, []);
  
  // Update hardware when the A. Output is changed in UI
  useEffect(() => {
    updateHardwareAOutput(value);
  }, [value]);
  
  // Function to handle A. Output changes from UI
  const handleAOutputChange = (newValue: number) => {
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
        title="A. Output"
        value={value}
        unit="mA"
        onChange={handleAOutputChange}
        isLocked={isLocked}
        minValue={0}
        maxValue={20}
        onLockError={onLockError}
        isDimmed={value === 0}
      />
      <div className="flex justify-center">
        {renderStatusIndicator()}
      </div>
    </div>
  );
};

export default HardwareAOutputControl;