/**
 * API utilities for connecting to the Raspberry Pi encoder
 * with bidirectional control support
 */

// Update this with your Raspberry Pi's IP address
const API_URL = 'http://localhost:8080/api';

/**
 * Interface for the pacemaker control data
 */
export interface EncoderControlData {
  rate: number;
  a_output: number;
  v_output: number;
  active_control: 'rate' | 'a_output' | 'v_output';
  last_update_source?: string;
}

export interface HardwareStatus {
  gpio_available: boolean;
  encoder_running: boolean;
  rate_encoder?: {
    clk: number | null;
    dt: number | null;
    button: number | null;
    rotation_count: number;
  };
  a_output_encoder?: {
    clk: number | null;
    dt: number | null;
    rotation_count: number;
  };
  button_press_count: number;
  last_encoder_update: number;
}

export interface ApiStatus {
  status: string;
  hardware: HardwareStatus;
  request_counter: number;
  last_update_source?: string;
}

// This tracks the last time we sent controls to the backend
let lastControlUpdateTime = 0;
// Minimum time between frontend-initiated updates (milliseconds)
const MIN_UPDATE_INTERVAL = 50; 

/**
 * Check if the encoder API is running and get hardware status
 * @returns Promise with API status details
 */
export async function checkEncoderStatus(): Promise<ApiStatus | null> {
  try {
    console.log('Checking encoder API status...');
    const response = await fetch(`${API_URL}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error('API status check failed:', response.status, response.statusText);
      return null;
    }
    
    const data = await response.json() as ApiStatus;
    return data;
  } catch (error) {
    console.error('Error checking encoder status:', error);
    return null;
  }
}

/**
 * Fetch the current encoder control values
 * @returns Promise with control values or null on error
 */
export async function getEncoderControls(): Promise<EncoderControlData | null> {
  try {
    const response = await fetch(`${API_URL}/controls`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error('Error fetching controls:', response.status, response.statusText);
      return null;
    }
    
    const data = await response.json() as EncoderControlData;
    return data;
  } catch (error) {
    console.error('Error fetching encoder controls:', error);
    return null;
  }
}

/**
 * Send updated control values to the backend
 * @param controls The updated control values 
 * @returns Promise indicating success or failure
 */
export async function updateControls(controls: Partial<EncoderControlData>): Promise<boolean> {
  // Check if we've updated too recently
  const now = Date.now();
  if (now - lastControlUpdateTime < MIN_UPDATE_INTERVAL) {
    // If we've sent an update very recently, buffer it
    return new Promise(resolve => {
      setTimeout(async () => {
        const result = await sendControlsUpdate(controls);
        resolve(result);
      }, MIN_UPDATE_INTERVAL - (now - lastControlUpdateTime));
    });
  }
  
  return sendControlsUpdate(controls);
}

async function sendControlsUpdate(controls: Partial<EncoderControlData>): Promise<boolean> {
  try {
    console.log('Sending control update to API:', controls);
    
    const response = await fetch(`${API_URL}/controls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(controls),
    });
    
    if (!response.ok) {
      console.error('Error updating controls:', response.status, response.statusText);
      return false;
    }
    
    lastControlUpdateTime = Date.now();
    return true;
  } catch (error) {
    console.error('Error updating controls:', error);
    return false;
  }
}

/**
 * Get detailed hardware debugging information
 */
export async function getHardwareDebugInfo(): Promise<any> {
  try {
    const response = await fetch(`${API_URL}/debug/hardware`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error('Error fetching hardware debug info:', response.status, response.statusText);
      return null;
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching hardware debug info:', error);
    return null;
  }
}

/**
 * Simulate an encoder rotation for testing
 * @param encoderType Which encoder to simulate (rate or a_output)
 * @param direction 1 for clockwise, -1 for counter-clockwise
 */
export async function simulateRotation(encoderType: 'rate' | 'a_output', direction: 1 | -1): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/debug/simulate?encoder=${encoderType}&direction=${direction}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`Error simulating ${encoderType} rotation:`, error);
    return false;
  }
}

/**
 * Start polling the encoder API for updates
 * @param callback Function to call with updated control values
 * @param statusCallback Optional function to call with API status updates
 * @param interval Polling interval in milliseconds 
 * @param skipIfSource Optional array of update sources to ignore (e.g. ["frontend"])
 * @returns Function to stop polling
 */
export function startEncoderPolling(
  callback: (data: EncoderControlData) => void,
  statusCallback?: (status: ApiStatus) => void,
  interval = 100,
  skipIfSource: string[] = []
): () => void {
  let isPolling = true;
  let consecutiveErrors = 0;
  let lastValuesReceived: EncoderControlData | null = null;
  
  const poll = async () => {
    if (!isPolling) return;
    
    try {
      // Check status occasionally
      if (statusCallback && Math.random() < 0.1) { // ~10% of the time
        const status = await checkEncoderStatus();
        if (status) {
          statusCallback(status);
        }
      }
      
      // Get control values
      const data = await getEncoderControls();
      if (data) {
        // Only trigger the callback if:
        // 1. There's been a change, AND
        // 2. The update source isn't in the skipIfSource list
        const hasChanges = !lastValuesReceived || 
          data.rate !== lastValuesReceived.rate ||
          data.a_output !== lastValuesReceived.a_output ||
          data.v_output !== lastValuesReceived.v_output ||
          data.active_control !== lastValuesReceived.active_control;
        
        const shouldSkip = data.last_update_source && 
          skipIfSource.includes(data.last_update_source);
        
        if (hasChanges && !shouldSkip) {
          console.log('Encoder values changed:', 
            lastValuesReceived ? `${JSON.stringify(lastValuesReceived)} -> ${JSON.stringify(data)}` 
            : data);
          callback(data);
        }
        
        lastValuesReceived = {...data};
        consecutiveErrors = 0;
      } else {
        consecutiveErrors++;
      }
      
      // If we've had too many errors, slow down polling
      const adjustedInterval = consecutiveErrors > 5 
        ? Math.min(interval * 2, 1000) // Max 1 second
        : interval;
      
      setTimeout(poll, adjustedInterval);
    } catch (error) {
      console.error('Error in polling loop:', error);
      consecutiveErrors++;
      // Back off on errors
      setTimeout(poll, Math.min(interval * consecutiveErrors, 5000));
    }
  };
  
  // Start polling
  poll();
  
  // Return function to stop polling
  return () => {
    console.log('Stopping encoder polling');
    isPolling = false;
  };
}