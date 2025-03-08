// import React, { useState, useEffect } from 'react';
// import CircularControl from './CircularControl';

// interface HardwareRateControlProps {
//   value: number;
//   onChange: (value: number) => void;
//   isLocked: boolean;
//   onLockError: () => void;
// }

// const HardwareRateControl: React.FC<HardwareRateControlProps> = ({
//   value,
//   onChange,
//   isLocked,
//   onLockError
// }) => {
//   const [connectionStatus, setConnectionStatus] = useState('connecting');
  
//   // Function to fetch the current encoder value from Raspberry Pi
//   const fetchRateFromHardware = async () => {
//     try {
//       const response = await fetch('http://raspberrypi.local:5000/api/rate');
      
//       if (response.ok) {
//         const data = await response.json();
//         // Only update if value has changed
//         if (data.value !== value) {
//           if (isLocked) {
//             onLockError();
//           } else {
//             onChange(data.value);
//           }
//         }
//         setConnectionStatus('connected');
//       } else {
//         setConnectionStatus('error');
//       }
//     } catch (err) {
//       console.error('Error fetching rate:', err);
//       setConnectionStatus('error');
//     }
//   };
  
//   // Send rate changes back to the hardware
//   const updateHardwareRate = async (newValue: number) => {
//     try {
//       await fetch('http://raspberrypi.local:5000/api/rate/set', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json'
//         },
//         body: JSON.stringify({ value: newValue })
//       });
//     } catch (err) {
//       console.error('Error updating hardware rate:', err);
//     }
//   };
  
//   // Set up polling to fetch the rate from hardware
//   useEffect(() => {
//     // Initial fetch
//     fetchRateFromHardware();
    
//     // Poll every 200ms
//     const intervalId = setInterval(fetchRateFromHardware, 200);
    
//     return () => clearInterval(intervalId);
//   }, []);
  
//   // Update hardware when the rate is changed in UI
//   useEffect(() => {
//     updateHardwareRate(value);
//   }, [value]);
  
//   // Function to handle rate changes from UI
//   const handleRateChange = (newRate: number) => {
//     if (isLocked) {
//       onLockError();
//       return;
//     }
//     onChange(newRate);
//   };
  
//   // Render the status indicator
//   const renderStatusIndicator = () => {
//     let color = '#cccccc';
//     let text = '';
    
//     switch (connectionStatus) {
//       case 'connected':
//         color = '#4CAF50'; // Green
//         text = 'Hardware connected';
//         break;
//       case 'error':
//         color = '#F44336'; // Red
//         text = 'Connection error';
//         break;
//       default:
//         color = '#FFC107'; // Yellow
//         text = 'Connecting...';
//     }
    
//     return (
//       <div className="flex items-center gap-1 mt-1">
//         <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></div>
//         <span className="text-xs text-gray-500">{text}</span>
//       </div>
//     );
//   };
  
//   return (
//     <div>
//       <CircularControl
//         title="Rate"
//         value={value}
//         unit="ppm"
//         onChange={handleRateChange}
//         isLocked={isLocked}
//         minValue={30}
//         maxValue={200}
//         onLockError={onLockError}
//       />
//       <div className="flex justify-center">
//         {renderStatusIndicator()}
//       </div>
//     </div>
//   );
// };

// export default HardwareRateControl;


import React from 'react';
import CircularControl from './CircularControl';
import { updateControls, ApiStatus } from '../utils/encoderApi';

interface HardwareRateControlProps {
  value: number;
  onChange: (value: number) => void;
  isLocked: boolean;
  onLockError: () => void;
  hardwareStatus?: ApiStatus | null;
  encoderConnected: boolean;
  localControlActive: boolean;
}

const HardwareRateControl: React.FC<HardwareRateControlProps> = ({
  value,
  onChange,
  isLocked,
  onLockError,
  hardwareStatus,
  encoderConnected,
}) => {
  // Function to handle rate changes from UI
  const handleRateChange = async (newValue: number) => {
    if (isLocked) {
      onLockError();
      return;
    }
    
    // Update local state
    onChange(newValue);
    
    // Send to hardware if connected
    if (encoderConnected) {
      await updateControls({ 
        rate: newValue,
        active_control: 'rate'
      });
    }
  };
  
  // Render the status indicator if connected to hardware
  const renderStatusIndicator = () => {
    if (!encoderConnected) return null;
    
    const rotationCount = hardwareStatus?.hardware?.rate_encoder?.rotation_count || 0;
    const isActive = hardwareStatus?.hardware?.rate_encoder?.rotation_count !== undefined;
    
    return (
      <div className="flex items-center gap-1 mt-1">
        <div 
          className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-400'}`}
        />
        <span className="text-xs text-gray-500">
          {isActive 
            ? `Hardware connected (${rotationCount} rotations)` 
            : 'Hardware not detected'}
        </span>
      </div>
    );
  };
  
  return (
    <div>
      <CircularControl
        title="Rate"
        value={value}
        unit="ppm"
        onChange={handleRateChange}
        isLocked={isLocked}
        minValue={30}
        maxValue={200}
        onLockError={onLockError}
      />
      <div className="flex justify-center">
        {renderStatusIndicator()}
      </div>
    </div>
  );
};

export default HardwareRateControl;