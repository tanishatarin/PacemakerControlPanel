// Define API response interfaces
export interface ApiStatus {
  status?: string;
  rate?: number;
  a_output?: number;
  v_output?: number;
  locked?: boolean;
  mode?: number;
  buttons?: {
    up_pressed?: boolean;
    down_pressed?: boolean;
    left_pressed?: boolean;
    emergency_pressed?: boolean;
  };
  encoder_active?: boolean;
  a_sensitivity?: number;
  v_sensitivity?: number;
  active_control?: string;
  hardware?: {
    rate_encoder?: {
      rotation_count?: number;
    };
    a_output_encoder?: {
      rotation_count?: number;
    };
    v_output_encoder?: {
      rotation_count?: number;
    };
    mode_output_encoder?: {
      rotation_count?: number;
    };
    buttons?: {
      up_pressed?: boolean;
      down_pressed?: boolean;
      left_pressed?: boolean;
      emergency_pressed?: boolean;
    };
  };
}

export interface EncoderControlData {
  rate?: number;
  a_output?: number;
  v_output?: number;
  locked?: boolean;
  mode?: number;
  active_control?: string;
  a_sensitivity?: number;
  v_sensitivity?: number;
}

// Base URL for API calls
const apiBaseUrl = 'http://raspberrypi.local:5000/api';

// Fallback to localhost if raspberrypi.local is not available
let useLocalhost = false;

// Function to get the appropriate base URL
const getBaseUrl = () => {
  return useLocalhost ? 'http://localhost:5000/api' : apiBaseUrl;
};

// Utility function to handle API errors
const handleApiError = async (response: Response) => {
  if (!response.ok) {
    // Try to parse error message from response
    try {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error ${response.status}`);
    } catch (e) {
      throw new Error(`HTTP error ${response.status}`);
    }
  }
  return response;
};

// Add this function to your encoderApi.ts
export const resetEncoder = async (type: string = 'mode'): Promise<void> => {
  try {
    await fetch(`${getBaseUrl()}/reset_encoder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });
    console.log(`Reset ${type} encoder requested`);
  } catch (error) {
    console.error(`Failed to reset ${type} encoder:`, error);
  }
};

// Check encoder API status
export const checkEncoderStatus = async (): Promise<ApiStatus | null> => {
  try {
    const response = await fetch(`${getBaseUrl()}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      return await response.json();
    }
    
    // If raspberrypi.local fails, try localhost
    if (!useLocalhost) {
      useLocalhost = true;
      return checkEncoderStatus();
    }
    
    return null;
  } catch (error) {
    console.error('Error checking encoder status:', error);
    
    // If raspberrypi.local fails, try localhost
    if (!useLocalhost) {
      useLocalhost = true;
      return checkEncoderStatus();
    }
    
    return null;
  }
};

// Add this in encoderApi.ts
export const getSensitivityDebug = async (): Promise<void> => {
  try {
    const response = await fetch(`${getBaseUrl()}/sensitivity`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('Sensitivity API response:', data);
    }
  } catch (error) {
    console.error('Error getting sensitivity debug:', error);
  }
};

// Update control values on the hardware
export const updateControls = async (data: EncoderControlData): Promise<void> => {
  try {
    const promises = [];
    
    if (data.rate !== undefined) {
      promises.push(
        fetch(`${getBaseUrl()}/rate/set`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: data.rate }),
        }).then(handleApiError)
      );
    }
    
    if (data.a_output !== undefined) {
      promises.push(
        fetch(`${getBaseUrl()}/a_output/set`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: data.a_output }),
        }).then(handleApiError)
      );
    }
    
    if (data.v_output !== undefined) {
      promises.push(
        fetch(`${getBaseUrl()}/v_output/set`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: data.v_output }),
        }).then(handleApiError)
      );
    }

    // Handle sensitivity updates
     // Modified sensitivity update logic with better error handling
     if (data.a_sensitivity !== undefined || data.v_sensitivity !== undefined || data.active_control !== undefined) {
      const sensitivityData: any = {};
      
      if (data.a_sensitivity !== undefined) {
        sensitivityData.a_sensitivity = data.a_sensitivity;
      }
      
      if (data.v_sensitivity !== undefined) {
        sensitivityData.v_sensitivity = data.v_sensitivity;
      }
      
      if (data.active_control !== undefined) {
        sensitivityData.active_control = data.active_control;
      }
      
      if (Object.keys(sensitivityData).length > 0) {
        try {
          const response = await fetch(`${getBaseUrl()}/sensitivity/set`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sensitivityData),
          });
          
          // If we get a 403, it's likely because the device is locked
          // Just log it rather than treating it as a fatal error
          if (response.status === 403) {
            console.log('Device locked - sensitivity update rejected');
          } else if (!response.ok) {
            console.error(`Sensitivity update failed: ${response.status}`);
          }
        } catch (err) {
          console.error('Error in sensitivity update:', err);
        }
      }
    }

    if (data.mode !== undefined) {
      promises.push(
        fetch(`${getBaseUrl()}/mode/set`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: data.mode }),
        }).then(handleApiError)
      );
    }
    
    await Promise.all(promises);
  } catch (error) {
    console.error('Error updating controls:', error);
    throw error;
  }
};

// Toggle the lock state
export const toggleLock = async (): Promise<boolean | null> => {
  try {
    const response = await fetch(`${getBaseUrl()}/lock/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(handleApiError);
    
    const data = await response.json();
    return data.locked;
  } catch (error) {
    console.error('Error toggling lock:', error);
    return null;
  }
};

// Get the current lock state
export const getLockState = async (): Promise<boolean | null> => {
  try {
    const response = await fetch(`${getBaseUrl()}/lock`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.locked;
    }
    return null;
  } catch (error) {
    console.error('Error getting lock state:', error);
    return null;
  }
};

// Get the current sensitivity settings
export const getSensitivity = async (): Promise<{a_sensitivity: number, v_sensitivity: number, active_control: string} | null> => {
  try {
    const response = await fetch(`${getBaseUrl()}/sensitivity`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        a_sensitivity: data.a_sensitivity,
        v_sensitivity: data.v_sensitivity,
        active_control: data.active_control
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting sensitivity settings:', error);
    return null;
  }
};

// Add a debounce utility function
const debounce = <F extends (...args: any[]) => any>(
  func: F,
  waitFor: number
): ((...args: Parameters<F>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<F>): void => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => func(...args), waitFor);
  };
};

// Then use it for updateControls calls that relate to sensitivity
export const updateSensitivityControlDebounced = debounce(
  async (data: {active_control?: string, a_sensitivity?: number, v_sensitivity?: number}) => {
    try {
      const response = await fetch(`${getBaseUrl()}/sensitivity/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      await handleApiError(response);
    } catch (error) {
      console.error('Error updating sensitivity controls:', error);
    }
  },
  100 // 100ms debounce time
);

export const startEncoderPolling = (
  onDataUpdate: (data: EncoderControlData) => void,
  onStatusUpdate: (status: ApiStatus) => void,
  pollInterval = 100,
  ignoreUpdateSources: string[] = []
) => {
  let isPolling = true;
  
  // Button state trackers to prevent duplicate events
  let lastButtonStates = {
    up: false,
    down: false,
    left: false,
    emergency: false
  };
  
  const pollHealth = async () => {
    if (!isPolling) return;
    
    try {
      const status = await checkEncoderStatus();
      
      if (status) {
        // Update status data
        onStatusUpdate(status);
        
        // Extract control values and pass to data update handler
        const controlData: EncoderControlData = {
          rate: status.rate,
          a_output: status.a_output,
          v_output: status.v_output,
          locked: status.locked,
          mode: status.mode,
          a_sensitivity: status.a_sensitivity,
          v_sensitivity: status.v_sensitivity
        };
        
        onDataUpdate(controlData);
        
        // Check for button presses - with guard against duplicate events
        if (status.buttons) {
          // Handle up button press - only trigger once per press
          if (status.buttons.up_pressed && !lastButtonStates.up) {
            console.log("Detected UP button press from hardware");
            window.dispatchEvent(new CustomEvent('hardware-up-button-pressed'));
            lastButtonStates.up = true;
          } else if (!status.buttons.up_pressed && lastButtonStates.up) {
            lastButtonStates.up = false; // Reset the state tracking
          }
          
          // Handle down button press - only trigger once per press
          if (status.buttons.down_pressed && !lastButtonStates.down) {
            console.log("Detected DOWN button press from hardware");
            window.dispatchEvent(new CustomEvent('hardware-down-button-pressed'));
            lastButtonStates.down = true;
          } else if (!status.buttons.down_pressed && lastButtonStates.down) {
            lastButtonStates.down = false; // Reset the state tracking
          }
          
          // Handle left button press - only trigger once per press
          if (status.buttons.left_pressed && !lastButtonStates.left) {
            console.log("Detected LEFT button press from hardware");
            window.dispatchEvent(new CustomEvent('hardware-left-button-pressed'));
            lastButtonStates.left = true;
          } else if (!status.buttons.left_pressed && lastButtonStates.left) {
            lastButtonStates.left = false; // Reset the state tracking
          }
          
          // Handle emergency button press - only trigger once per press
          if (status.buttons.emergency_pressed && !lastButtonStates.emergency) {
            console.log("Detected EMERGENCY button press from hardware");
            window.dispatchEvent(new CustomEvent('hardware-emergency-button-pressed'));
            lastButtonStates.emergency = true;
          } else if (!status.buttons.emergency_pressed && lastButtonStates.emergency) {
            lastButtonStates.emergency = false; // Reset the state tracking
          }
        }
      }
    } catch (error) {
      console.error('Polling error:', error);
    } finally {
      if (isPolling) {
        setTimeout(pollHealth, pollInterval);
      }
    }
  };
  
  // Start initial poll
  pollHealth();
  
  // Return a function to stop polling
  return () => {
    isPolling = false;
  };
};