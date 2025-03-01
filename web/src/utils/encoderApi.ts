// src/utils/encoderApi.ts

/**
 * API utilities for connecting to the Raspberry Pi encoder
 * with enhanced debugging
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
}

export interface HardwareStatus {
  gpio_available: boolean;
  encoder_running: boolean;
  pin_values: {
    clk: number | null;
    dt: number | null;
    button: number | null;
  };
  rotation_count: number;
  button_press_count: number;
}

export interface ApiStatus {
  status: string;
  hardware: HardwareStatus;
  request_counter: number;
}

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
    console.log('API status response:', data);
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
    console.log('Hardware debug info:', data);
    return data;
  } catch (error) {
    console.error('Error fetching hardware debug info:', error);
    return null;
  }
}

/**
 * Simulate an encoder rotation for testing
 * @param direction 1 for clockwise, -1 for counter-clockwise
 */
export async function simulateRotation(direction: 1 | -1): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/debug/simulate?direction=${direction}`, {
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
    console.error('Error simulating rotation:', error);
    return false;
  }
}

/**
 * Start polling the encoder API for updates
 * @param callback Function to call with updated control values
 * @param interval Polling interval in milliseconds
 * @returns Function to stop polling
 */
export function startEncoderPolling(
  callback: (data: EncoderControlData) => void,
  statusCallback?: (status: ApiStatus) => void,
  interval = 100
): () => void {
  let isPolling = true;
  let consecutiveErrors = 0;
  
  const poll = async () => {
    if (!isPolling) return;
    
    try {
      // Check status occasionally
      if (statusCallback && Math.random() < 0.1) { // ~10% of the time
        const status = await checkEncoderStatus();
        if (status) {
          statusCallback(status);
          consecutiveErrors = 0;
        }
      }
      
      // Always get control values
      const data = await getEncoderControls();
      if (data) {
        callback(data);
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