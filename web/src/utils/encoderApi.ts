// src/utils/encoderApi.ts

/**
 * API utilities for connecting to the Raspberry Pi encoder
 */

const API_URL = 'http://localhost:8080/api';  // Update with your Raspberry Pi IP

/**
 * Interface for the pacemaker control data
 */
export interface EncoderControlData {
  rate: number;
  a_output: number;
  v_output: number;
  active_control: 'rate' | 'a_output' | 'v_output';
}

/**
 * Check if the encoder API is running
 * @returns Promise<boolean> True if the API is running
 */
export async function checkEncoderStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    return data.status === 'running';
  } catch (error) {
    console.error('Error checking encoder status:', error);
    return false;
  }
}

/**
 * Fetch the current encoder control values
 * @returns Promise<EncoderControlData | null> The current control values or null if there was an error
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
      return null;
    }
    
    return await response.json() as EncoderControlData;
  } catch (error) {
    console.error('Error fetching encoder controls:', error);
    return null;
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
  interval = 100
): () => void {
  let isPolling = true;
  
  const poll = async () => {
    if (!isPolling) return;
    
    const data = await getEncoderControls();
    if (data) {
      callback(data);
    }
    
    setTimeout(poll, interval);
  };
  
  poll();
  
  // Return function to stop polling
  return () => {
    isPolling = false;
  };
}