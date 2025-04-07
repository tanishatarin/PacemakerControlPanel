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
}

// Base URL for API calls
const apiBaseUrl = 'http://raspberrypi.local:5000/api';

// Fallback to localhost if raspberrypi.local is not available
let useLocalhost = false;

// DOO mode constants
export const DOO_MODE_INDEX = 5;
export const DOO_RATE = 80;
export const DOO_A_OUTPUT = 20.0;
export const DOO_V_OUTPUT = 25.0;

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

// Update control values on the hardware
export const updateControls = async (data: EncoderControlData): Promise<void> => {
  try {
    const promises = [];
    
    // If setting mode to DOO, use dedicated endpoint
    if (data.mode === DOO_MODE_INDEX) {
      promises.push(
        fetch(`${getBaseUrl()}/emergency/doo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }).then(handleApiError)
      );
      
      // Since DOO emergency endpoint handles all values, we can return early
      await Promise.all(promises);
      return;
    }
    
    // For non-DOO modes, update individual settings
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

// Activate DOO emergency mode
export const activateDOOEmergencyMode = async (): Promise<void> => {
  try {
    await fetch(`${getBaseUrl()}/emergency/doo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(handleApiError);
  } catch (error) {
    console.error('Error activating DOO emergency mode:', error);
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

// Check if mode is DOO mode
export const isDOOMode = (mode: number): boolean => {
  return mode === DOO_MODE_INDEX;
};

// Start polling the encoder API
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
          mode: status.mode
        };
        
        // Handle DOO mode specifically - ensure emergency values
        if (status.mode === DOO_MODE_INDEX) {
          controlData.rate = DOO_RATE;
          controlData.a_output = DOO_A_OUTPUT;
          controlData.v_output = DOO_V_OUTPUT;
        }
        
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
            
            // Also ensure DOO emergency values are applied
            if (status.mode !== DOO_MODE_INDEX) {
              activateDOOEmergencyMode().catch(err => 
                console.error('Failed to activate DOO emergency mode:', err)
              );
            }
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