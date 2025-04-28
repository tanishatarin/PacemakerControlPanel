// import React, { useState, useEffect } from 'react';
// import CircularControl from './CircularControl';

// interface HardwareVOutputControlProps {
//   value: number;
//   onChange: (value: number) => void;
//   isLocked: boolean;
//   onLockError: () => void;
// }

// const HardwareVOutputControl: React.FC<HardwareVOutputControlProps> = ({
//   value,
//   onChange,
//   isLocked,
//   onLockError
// }) => {
//   const [connectionStatus, setConnectionStatus] = useState('connecting');
  
//   // Function to fetch the current encoder value from Raspberry Pi
//   const fetchVOutputFromHardware = async () => {
//     try {
//       const response = await fetch('http://raspberrypi.local:5000/api/v_output');
      
//       if (response.ok) {
//         const data = await response.json();
//         // Only update if value has changed
//         if (Math.abs(data.value - value) > 0.05) {
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
//       console.error('Error fetching V. Output:', err);
//       setConnectionStatus('error');
//     }
//   };
  
//   // Send V. Output changes back to the hardware
//   const updateHardwareVOutput = async (newValue: number) => {
//     try {
//       await fetch('http://raspberrypi.local:5000/api/v_output/set', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json'
//         },
//         body: JSON.stringify({ value: newValue })
//       });
//     } catch (err) {
//       console.error('Error updating hardware V. Output:', err);
//     }
//   };
  
//   // Set up polling to fetch the V. Output from hardware
//   useEffect(() => {
//     // Initial fetch
//     fetchVOutputFromHardware();
    
//     // Poll every 200ms
//     const intervalId = setInterval(fetchVOutputFromHardware, 200);
    
//     return () => clearInterval(intervalId);
//   }, []);
  
//   // Update hardware when the V. Output is changed in UI
//   useEffect(() => {
//     updateHardwareVOutput(value);
//   }, [value]);
  
//   // Function to handle V. Output changes from UI
//   const handleVOutputChange = (newValue: number) => {
//     if (isLocked) {
//       onLockError();
//       return;
//     }
//     onChange(newValue);
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
//         title="V. Output"
//         value={value}
//         unit="mA"
//         onChange={handleVOutputChange}
//         isLocked={isLocked}
//         minValue={0}
//         maxValue={25}
//         onLockError={onLockError}
//         isDimmed={value === 0}
//       />
//       <div className="flex justify-center">
//         {renderStatusIndicator()}
//       </div>
//     </div>
//   );
// };

// export default HardwareVOutputControl;




import React, { useState, useEffect, useRef } from 'react';
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
  const [rotationCount, setRotationCount] = useState(0);
  const lastValueRef = useRef(value);
  const localChangeRef = useRef(false);
  
  // Function to fetch the current encoder value from Raspberry Pi
  const fetchVOutputFromHardware = async () => {
    try {
      // Skip if we just made a local change
      if (localChangeRef.current) {
        localChangeRef.current = false;
        return;
      }
      
      const response = await fetch('http://raspberrypi.local:5000/api/v_output');
      
      if (response.ok) {
        const data = await response.json();
        // Only update if value has changed significantly
        if (Math.abs(data.value - value) > 0.05) {
          if (isLocked) {
            onLockError();
          } else {
            onChange(data.value);
          }
        }
        setConnectionStatus('connected');
        
        // Fetch hardware status occasionally to get rotation count
        if (Math.random() < 0.1) { // ~10% chance per poll
          fetchHardwareStatus();
        }
      } else {
        setConnectionStatus('error');
      }
    } catch (err) {
      console.error('Error fetching V. Output:', err);
      setConnectionStatus('error');
    }
  };
  
  // Function to fetch hardware status including rotation counts
  const fetchHardwareStatus = async () => {
    try {
      const response = await fetch('http://raspberrypi.local:5000/api/hardware');
      if (response.ok) {
        const data = await response.json();
        if (data.hardware?.v_output_encoder && 
            typeof data.hardware.v_output_encoder.rotation_count === 'number') {
          setRotationCount(data.hardware.v_output_encoder.rotation_count);
        }
      }
    } catch (err) {
      console.error('Error fetching hardware status:', err);
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
    
    // Poll every 150ms (slightly faster than before)
    const intervalId = setInterval(fetchVOutputFromHardware, 150);
    
    return () => clearInterval(intervalId);
  }, []);
  
  // Update hardware when the V. Output is changed in UI
  useEffect(() => {
    // Skip if value hasn't changed
    if (value === lastValueRef.current) return;
    
    // Set flag that we're making a local change
    localChangeRef.current = true;
    
    // Update our reference
    lastValueRef.current = value;
    
    // Send to hardware
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
        text = rotationCount > 0 
          ? `Hardware connected (${rotationCount} rotations)` 
          : 'Hardware connected';
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