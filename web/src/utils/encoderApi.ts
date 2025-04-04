export interface EncoderControlData {
  rate?: number;
  a_output?: number;
  v_output?: number;
  locked?: boolean;
  active_control?: string;
}

export interface ApiStatus {
  status: string;
  rate?: number;
  a_output?: number;
  v_output?: number;
  locked?: boolean;
  hardware?: {
    rate_encoder?: {
      rotation_count: number;
    };
    a_output_encoder?: {
      rotation_count: number;
    };
    v_output_encoder?: {
      rotation_count: number;
    };
  };
  buttons?: {
    up_pressed?: boolean;
    down_pressed?: boolean;
    left_pressed?: boolean;
  };
}

// Change this to your actual Raspberry Pi IP address or hostname
const API_BASE_URL = 'http://localhost:5000';

// Check if the encoder API is available
export async function checkEncoderStatus(): Promise<ApiStatus | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Shorter timeout
      signal: AbortSignal.timeout(1000),
    });
    
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('Error checking encoder status:', error);
    return null;
  }
}

// Toggle lock state
export async function toggleLock(): Promise<boolean | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/lock/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log("Lock toggle response:", data);
      return data.locked;
    }
    return null;
  } catch (error) {
    console.error('Error toggling lock state:', error);
    return null;
  }
}

// Get lock state
export async function getLockState(): Promise<boolean | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/lock`, {
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
}

// Update control values on the hardware
export async function updateControls(data: EncoderControlData): Promise<boolean> {
  try {
    // Process each control individually if present
    const promises = [];
    
    if (data.rate !== undefined) {
      promises.push(updateRate(data.rate));
    }
    
    if (data.a_output !== undefined) {
      promises.push(updateAOutput(data.a_output));
    }
    
    if (data.v_output !== undefined) {
      promises.push(updateVOutput(data.v_output));
    }
    
    // Wait for all updates to complete
    await Promise.all(promises);
    return true;
  } catch (error) {
    console.error('Error updating controls:', error);
    return false;
  }
}

// Update rate on hardware
async function updateRate(value: number): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/rate/set`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ value }),
    });
    
    if (response.ok) {
      return true;
    }
    
    // If device is locked, handle gracefully
    if (response.status === 403) {
      console.log('Cannot update rate: device is locked');
      return false;
    }
    
    throw new Error(`Failed to update rate: ${response.statusText}`);
  } catch (error) {
    console.error('Error updating rate:', error);
    return false;
  }
}

// Update A Output on hardware
async function updateAOutput(value: number): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/a_output/set`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ value }),
    });
    
    if (response.ok) {
      return true;
    }
    
    // If device is locked, handle gracefully
    if (response.status === 403) {
      console.log('Cannot update A Output: device is locked');
      return false;
    }
    
    throw new Error(`Failed to update A Output: ${response.statusText}`);
  } catch (error) {
    console.error('Error updating A Output:', error);
    return false;
  }
}

// Update V Output on hardware
async function updateVOutput(value: number): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v_output/set`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ value }),
    });
    
    if (response.ok) {
      return true;
    }
    
    // If device is locked, handle gracefully
    if (response.status === 403) {
      console.log('Cannot update V Output: device is locked');
      return false;
    }
    
    throw new Error(`Failed to update V Output: ${response.statusText}`);
  } catch (error) {
    console.error('Error updating V Output:', error);
    return false;
  }
}

// Start polling the encoder hardware at regular intervals
export function startEncoderPolling(
  onControlUpdate: (data: EncoderControlData) => void,
  onStatusUpdate: (status: ApiStatus) => void,
  interval = 200,
  ignoreSourceList: string[] = []
): () => void {
  let lastSourceRef = { source: 'init', time: Date.now() };
  let lastLockState: boolean | null = null;
  
  // Add a specific interval for checking lock state (more frequent)
  const lockCheckInterval = 100; // Check lock state every 100ms
  
  // Create a dedicated lock state poller
  const lockPoller = setInterval(async () => {
    try {
      const lockState = await getLockState();
      if (lockState !== null && lockState !== lastLockState) {
        // If lock state changed, update it immediately
        lastLockState = lockState;
        onControlUpdate({ locked: lockState });
      }
    } catch (error) {
      console.error('Error checking lock state:', error);
    }
  }, lockCheckInterval);
  
  // Main poller for other controls
  const mainPoller = setInterval(async () => {
    try {
      const status = await checkEncoderStatus();
      
      if (!status) {
        return;
      }
      
      // Update with status information
      onStatusUpdate(status);
      
      // Detect and dispatch button presses
      if (status.buttons?.up_pressed) {
        console.log("Up button press detected via health check");
        const upEvent = new CustomEvent('hardware-up-button-pressed');
        window.dispatchEvent(upEvent);
      }
      
      if (status.buttons?.down_pressed) {
        console.log("Down button press detected via health check");
        const downEvent = new CustomEvent('hardware-down-button-pressed');
        window.dispatchEvent(downEvent);
      }
      
      // In the mainPoller function in startEncoderPolling
      if (status.buttons?.left_pressed) {
        // Add more detailed logging
        console.log("Left button press detected via health check", JSON.stringify(status.buttons));
        
        // Create a new event with a clean name
        const leftEvent = new CustomEvent('hardware-left-button-pressed');
        
        // Dispatch the event and log it
        window.dispatchEvent(leftEvent);
        console.log("Left button event dispatched");
      }
      
      // Prepare control update data
      const controlData: EncoderControlData = {};
      
      if (status.rate !== undefined) {
        controlData.rate = status.rate;
      }
      
      if (status.a_output !== undefined) {
        controlData.a_output = status.a_output;
      }
      
      if (status.v_output !== undefined) {
        controlData.v_output = status.v_output;
      }
      
      // We handle lock state separately now, but include it for completeness
      if (status.locked !== undefined && status.locked !== lastLockState) {
        lastLockState = status.locked;
        controlData.locked = status.locked;
      }
      
      // Check if we should ignore this update based on source
      const now = Date.now();
      const timeSinceLastUpdate = now - lastSourceRef.time;
      
      const ignoreUpdate = 
        timeSinceLastUpdate < 500 && 
        ignoreSourceList.includes(lastSourceRef.source);
        
      // Don't ignore lock state updates regardless of source
      if (ignoreUpdate && !controlData.hasOwnProperty('locked')) {
        return;
      }
      
      // Send control updates if there's data
      if (Object.keys(controlData).length > 0) {
        onControlUpdate(controlData);
      }
    } catch (error) {
      console.error('Error in encoder polling:', error);
    }
  }, interval);
  
  // Return a function to stop polling
  return () => {
    clearInterval(mainPoller);
    clearInterval(lockPoller);
  };
}