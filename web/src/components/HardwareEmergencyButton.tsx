import React, { useState, useEffect } from 'react';
import { activateEmergencyMode, getEmergencyModeStatus } from '../utils/encoderApi';

interface HardwareEmergencyButtonProps {
  isLocked: boolean;
  onEmergencyActivate: () => void;
  onLockError: () => void;
}

const HardwareEmergencyButton: React.FC<HardwareEmergencyButtonProps> = ({
  isLocked,
  onEmergencyActivate,
  onLockError
}) => {
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  
  // Check the current emergency mode status on mount
  useEffect(() => {
    const checkEmergencyStatus = async () => {
      try {
        const status = await getEmergencyModeStatus();
        if (status !== null) {
          setIsEmergencyActive(status);
          if (status) {
            onEmergencyActivate(); // Update UI if emergency is already active
          }
          setConnectionStatus('connected');
        } else {
          setConnectionStatus('error');
        }
      } catch (err) {
        console.error('Error checking emergency status:', err);
        setConnectionStatus('error');
      }
    };
    
    checkEmergencyStatus();
    
    // Also listen for emergency button press events from hardware
    const handleHardwareEmergencyPress = () => {
      console.log("Hardware emergency button press detected");
      if (isLocked) {
        onLockError();
      } else {
        handleEmergencyActivation();
      }
    };
    
    window.addEventListener('hardware-emergency-button-pressed', handleHardwareEmergencyPress);
    
    return () => {
      window.removeEventListener('hardware-emergency-button-pressed', handleHardwareEmergencyPress);
    };
  }, [isLocked, onEmergencyActivate, onLockError]);
  
  // Function to handle emergency activation
  const handleEmergencyActivation = async () => {
    if (isLocked) {
      onLockError();
      return;
    }
    
    try {
      const success = await activateEmergencyMode();
      if (success) {
        setIsEmergencyActive(true);
        onEmergencyActivate();
        setConnectionStatus('connected');
      }
    } catch (err) {
      console.error('Error activating emergency mode:', err);
      setConnectionStatus('error');
    }
  };
  
  // Render the status indicator
  const renderStatusIndicator = () => {
    let color = '#cccccc';
    let text = '';
    
    switch (connectionStatus) {
      case 'connected':
        color = isEmergencyActive ? '#F44336' : '#4CAF50'; // Red if emergency active, otherwise green
        text = isEmergencyActive ? 'Emergency active' : 'Hardware connected';
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
      <button
        onClick={handleEmergencyActivation}
        className={`w-full mb-4 bg-red-500 text-white py-2 px-4 rounded-xl hover:bg-red-600 transition-colors ${
          isLocked ? 'opacity-70 cursor-not-allowed' : ''
        } ${isEmergencyActive ? 'ring-2 ring-red-300 animate-pulse' : ''}`}
      >
        DOO Emergency Mode
      </button>
      <div className="flex justify-center">
        {renderStatusIndicator()}
      </div>
    </div>
  );
};

export default HardwareEmergencyButton;