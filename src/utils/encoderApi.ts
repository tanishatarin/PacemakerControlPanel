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
  a_sensitivity?: number;
  v_sensitivity?: number;
  active_control?: string;
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
        promises.push(
          fetch(`${getBaseUrl()}/sensitivity/set`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sensitivityData),
          }).then(handleApiError)
        );
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

// Add to the polling function to ensure hardware emergency button works
export const startEncoderPolling = (
  onDataUpdate: (data: EncoderControlData) => void,
  onStatusUpdate: (status: ApiStatus) => void,
  pollInterval = 100,
  ignoreUpdateSources: string[] = []
) => {
  let isPolling = true;
  
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
          v_sensitivity: status.v_sensitivity,
          active_control: status.active_control
        };
        
        onDataUpdate(controlData);
        
        // Check for button presses
        if (status.buttons) {
          // Handle up button press
          if (status.buttons.up_pressed) {
            window.dispatchEvent(new CustomEvent('hardware-up-button-pressed'));
          }
          
          // Handle down button press
          if (status.buttons.down_pressed) {
            window.dispatchEvent(new CustomEvent('hardware-down-button-pressed'));
          }
          
          // Handle left button press
          if (status.buttons.left_pressed) {
            window.dispatchEvent(new CustomEvent('hardware-left-button-pressed'));
          }
          
          // Handle emergency button press
          if (status.buttons.emergency_pressed) {
            window.dispatchEvent(new CustomEvent('hardware-emergency-button-pressed'));
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