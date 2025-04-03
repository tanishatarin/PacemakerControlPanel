// Hardware Encoder API utilities

export interface ButtonState {
  up?: number;
  down?: number;
  left?: number;
  doo?: number;
}

export interface EncoderControlData {
  rate?: number;
  a_output?: number;
  v_output?: number;
  locked?: boolean;
  active_control?: string;
  buttons?: ButtonState;
  is_doo_emergency?: boolean;
}

export interface HardwareButtons {
  up_presses: number;
  down_presses: number;
  left_presses: number;
  doo_presses: number;
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
    buttons?: HardwareButtons;
  };
  is_doo_emergency?: boolean;
}

const API_BASE_URL = 'http://raspberrypi.local:5000'; // Update with your Raspberry Pi hostname or IP

// Button press tracking
let lastButtonState = {
  up: 0,
  down: 0,
  left: 0,
  doo: 0
};

// Check if the encoder API is available
export async function checkEncoderStatus(): Promise<ApiStatus | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Short timeout to avoid hanging UI
      signal: AbortSignal.timeout(2000),
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

// Get button states
export async function getButtonStates(): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/buttons`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('Error getting button states:', error);
    return null;
  }
}

// Toggle DOO emergency mode
export async function toggleDOOEmergency(): Promise<boolean | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/doo_emergency/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.is_doo_emergency;
    }
    return null;
  } catch (error) {
    console.error('Error toggling DOO emergency mode:', error);
    return null;
  }
}

// Get DOO emergency state
export async function getDOOEmergencyState(): Promise<boolean | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/doo_emergency`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.is_doo_emergency;
    }
    return null;
  } catch (error) {
    console.error('Error getting DOO emergency state:', error);
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

// Function to detect and handle button presses
function checkButtonPresses(data: { buttons?: ButtonState }, callback: (button: string) => void) {
  if (!data.buttons) return;
  
  // Check each button for changes
  if (data.buttons.up !== undefined && data.buttons.up > lastButtonState.up) {
    callback('up');
    lastButtonState.up = data.buttons.up;
  }
  
  if (data.buttons.down !== undefined && data.buttons.down > lastButtonState.down) {
    callback('down');
    lastButtonState.down = data.buttons.down;
  }
  
  if (data.buttons.left !== undefined && data.buttons.left > lastButtonState.left) {
    callback('left');
    lastButtonState.left = data.buttons.left;
  }
  
  if (data.buttons.doo !== undefined && data.buttons.doo > lastButtonState.doo) {
    callback('doo');
    lastButtonState.doo = data.buttons.doo;
  }
  
  // Update our tracking
  if (data.buttons.up !== undefined) lastButtonState.up = data.buttons.up;
  if (data.buttons.down !== undefined) lastButtonState.down = data.buttons.down;
  if (data.buttons.left !== undefined) lastButtonState.left = data.buttons.left;
  if (data.buttons.doo !== undefined) lastButtonState.doo = data.buttons.doo;
}

// Start polling the encoder hardware at regular intervals
export function startEncoderPolling(
  onControlUpdate: (data: EncoderControlData) => void,
  onStatusUpdate: (status: ApiStatus) => void,
  interval = 200,
  ignoreSourceList: string[] = [],
  onButtonPress?: (button: string) => void // New callback for button presses
): () => void {
  let lastSourceRef = { source: 'init', time: Date.now() };
  
  const poller = setInterval(async () => {
    try {
      const status = await checkEncoderStatus();
      
      if (!status) {
        return;
      }
      
      // Check for button presses if callback provided
      if (onButtonPress && status.hardware?.buttons) {
        const buttonData = {
          buttons: {
            up: status.hardware.buttons.up_presses,
            down: status.hardware.buttons.down_presses,
            left: status.hardware.buttons.left_presses,
            doo: status.hardware.buttons.doo_presses
          }
        };
        checkButtonPresses(buttonData, onButtonPress);
      }
      
      // Update with status information
      onStatusUpdate(status);
      
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
      
      if (status.locked !== undefined) {
        controlData.locked = status.locked;
      }
      
      if (status.is_doo_emergency !== undefined) {
        controlData.is_doo_emergency = status.is_doo_emergency;
      }
      
      // Check if we should ignore this update based on source
      const now = Date.now();
      const timeSinceLastUpdate = now - lastSourceRef.time;
      
      if (
        timeSinceLastUpdate < 500 && 
        ignoreSourceList.includes(lastSourceRef.source)
      ) {
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
  return () => clearInterval(poller);
}