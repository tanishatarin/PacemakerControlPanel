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

// Keep track of API health
let lastSuccessfulHealthCheck = 0;
let consecutiveFailures = 0;
const MAX_FAILURES = 3;

// Function to get the appropriate base URL
const getBaseUrl = () => {
  return useLocalhost ? 'http://localhost:5000/api' : apiBaseUrl;
};

// Add timeout to fetch requests
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 3000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
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
    // First try raspberrypi.local
    const response = await fetchWithTimeout(`${getBaseUrl()}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      lastSuccessfulHealthCheck = Date.now();
      consecutiveFailures = 0;
      return data;
    }
    
    consecutiveFailures++;
    
    // If raspberrypi.local fails and we haven't tried localhost yet, try that
    if (!useLocalhost) {
      console.log("Trying localhost fallback...");
      useLocalhost = true;
      return checkEncoderStatus();
    }
    
    // If both fail, log the error and return null
    console.error(`API health check failed with status ${response.status}`);
    return null;
  } catch (error) {
    console.error('Error checking encoder status:', error);
    consecutiveFailures++;
    
    // If raspberrypi.local fails and we haven't tried localhost yet, try that
    if (!useLocalhost) {
      console.log("Trying localhost fallback after error...");
      useLocalhost = true;
      return checkEncoderStatus();
    }
    
    // If both fail, log the error and return null
    if (error instanceof Error) {
      console.error(`API connection error: ${error.message}`);
    }
    return null;
  } finally {
    // Switch back to raspberrypi.local periodically to try reconnecting
    if (useLocalhost && consecutiveFailures > MAX_FAILURES) {
      useLocalhost = false;
      console.log("Switching back to raspberrypi.local after multiple localhost failures");
    }
  }
};

// Update control values on the hardware
export const updateControls = async (data: EncoderControlData): Promise<void> => {
  try {
    const promises = [];
    
    // Check if we've lost connection
    if (Date.now() - lastSuccessfulHealthCheck > 5000 && consecutiveFailures > MAX_FAILURES) {
      // Try to reconnect first
      await checkEncoderStatus();
      
      // If we're still failing, throw an error
      if (consecutiveFailures > MAX_FAILURES) {
        throw new Error("Unable to update controls - connection to hardware lost");
      }
    }
    
    if (data.rate !== undefined) {
      promises.push(
        fetchWithTimeout(`${getBaseUrl()}/rate/set`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: data.rate }),
        }).then(handleApiError)
      );
    }
    
    if (data.a_output !== undefined) {
      promises.push(
        fetchWithTimeout(`${getBaseUrl()}/a_output/set`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: data.a_output }),
        }).then(handleApiError)
      );
    }
    
    if (data.v_output !== undefined) {
      promises.push(
        fetchWithTimeout(`${getBaseUrl()}/v_output/set`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: data.v_output }),
        }).then(handleApiError)
      );
    }

    if (data.mode !== undefined) {
      promises.push(
        fetchWithTimeout(`${getBaseUrl()}/mode/set`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: data.mode }),
        }).then(handleApiError)
      );
    }
    
    await Promise.all(promises);
  } catch (error) {
    console.error('Error updating controls:', error);
    consecutiveFailures++;
    throw error;
  }
};

// Toggle the lock state
export const toggleLock = async (): Promise<boolean | null> => {
  try {
    const response = await fetchWithTimeout(`${getBaseUrl()}/lock/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(handleApiError);
    
    const data = await response.json();
    return data.locked;
  } catch (error) {
    console.error('Error toggling lock:', error);
    consecutiveFailures++;
    return null;
  }
};

// Get the current lock state
export const getLockState = async (): Promise<boolean | null> => {
  try {
    const response = await fetchWithTimeout(`${getBaseUrl()}/lock`, {
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
    consecutiveFailures++;
    return null;
  }
};

// Start polling the encoder API with error recovery
export const startEncoderPolling = (
  onDataUpdate: (data: EncoderControlData) => void,
  onStatusUpdate: (status: ApiStatus) => void,
  pollInterval = 100,
  ignoreUpdateSources: string[] = []
) => {
  let isPolling = true;
  let failedPolls = 0;
  const MAX_FAILED_POLLS = 5;
  
  // Set up error recovery
  const recoverConnection = async () => {
    console.warn(`Attempting to recover connection after ${failedPolls} failed polls`);
    
    // Try to reconnect
    try {
      // First, reset useLocalhost to try raspberrypi.local again
      useLocalhost = false;
      
      const status = await checkEncoderStatus();
      if (status) {
        console.log('Successfully recovered connection to encoder API');
        failedPolls = 0;
        return true;
      } else {
        console.error('Failed to recover connection, will retry');
        return false;
      }
    } catch (error) {
      console.error('Error during connection recovery:', error);
      return false;
    }
  };
  
  const pollHealth = async () => {
    if (!isPolling) return;
    
    try {
      const status = await checkEncoderStatus();
      
      if (status) {
        // Update status data
        onStatusUpdate(status);
        failedPolls = 0;
        
        // Extract control values and pass to data update handler
        const controlData: EncoderControlData = {
          rate: status.rate,
          a_output: status.a_output,
          v_output: status.v_output,
          locked: status.locked,
          mode: status.mode
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
      } else {
        failedPolls++;
        console.warn(`Failed health poll #${failedPolls}`);
        
        // If we've failed too many times in a row, try to recover
        if (failedPolls >= MAX_FAILED_POLLS) {
          await recoverConnection();
        }
      }
    } catch (error) {
      failedPolls++;
      console.error('Polling error:', error);
      
      // If we've failed too many times in a row, try to recover
      if (failedPolls >= MAX_FAILED_POLLS) {
        await recoverConnection();
      }
    } finally {
      if (isPolling) {
        // Use a dynamic polling interval based on connection state
        // Poll more frequently when everything is working well,
        // and back off when having connection issues
        const dynamicInterval = failedPolls > 0 
          ? Math.min(pollInterval * (1 + failedPolls), 2000) // Back off up to 2 seconds
          : pollInterval;
          
        setTimeout(pollHealth, dynamicInterval);
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