# import { PacingMode } from './types';

# # // Configuration - change this to your API URL
# const API_URL = process.env.NODE_ENV === 'production' 
#   ? 'http://your-raspberry-pi-ip:5000' 
#   : 'http://localhost:5000';

# // Interface for encoder status
# interface EncoderStatus {
#   value: number;
#   min: number;
#   max: number;
#   hardwareConnected: boolean;
#   lastUpdate: number;
# }

# # /**
# #  * Get the current encoder status
# #  */
# export const getEncoderStatus = async (): Promise<EncoderStatus> => {
#   try {
#     const response = await fetch(`${API_URL}/api/status`);
#     if (!response.ok) {
#       throw new Error(`API error: ${response.status}`);
#     }
#     return await response.json();
#   } catch (error) {
#     console.error('Error fetching encoder status:', error);
#     // Return a default status when API is unreachable
#     return {
#       value: 80,
#       min: 30,
#       max: 200,
#       hardwareConnected: false,
#       lastUpdate: Date.now() / 1000
#     };
#   }
# };

# # /**
# #  * Update the encoder value
# #  */
# export const updateEncoderValue = async (value: number): Promise<EncoderStatus> => {
#   try {
#     const response = await fetch(`${API_URL}/api/value`, {
#       method: 'POST',
#       headers: {
#         'Content-Type': 'application/json',
#       },
#       body: JSON.stringify({ value }),
#     });
    
#     if (!response.ok) {
#       throw new Error(`API error: ${response.status}`);
#     }
    
#     return await response.json();
#   } catch (error) {
#     console.error('Error updating encoder value:', error);
#     throw error;
#   }
# };

# /**
#  * Reset the encoder value to 30
#  */
# export const resetEncoder = async (): Promise<EncoderStatus> => {
#   try {
#     const response = await fetch(`${API_URL}/api/reset`, {
#       method: 'POST',
#       headers: {
#         'Content-Type': 'application/json',
#       },
#     });
    
#     if (!response.ok) {
#       throw new Error(`API error: ${response.status}`);
#     }
    
#     return await response.json();
#   } catch (error) {
#     console.error('Error resetting encoder:', error);
#     throw error;
#   }
# };

# // Integration with your existing ControlPanel component
# export const useEncoderWithControlPanel = (
#   selectedMode: PacingMode,
#   onRateChange: (value: number) => void
# ) => {
#   // This function periodically fetches the encoder value and updates the rate
#   // Call this in a useEffect hook in your control panel component
#   return async () => {
#     try {
#       // Only poll if we're in a mode that uses the encoder
#       if (selectedMode === 'DOO') {
#         const status = await getEncoderStatus();
#         // Update the rate in your app state
#         onRateChange(status.value);
#         return status.hardwareConnected;
#       }
#       return false;
#     } catch (error) {
#       console.error('Error in encoder polling:', error);
#       return false;
#     }
#   };
# };