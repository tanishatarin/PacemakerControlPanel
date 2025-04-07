from flask import Flask, jsonify, request
from flask_cors import CORS
from gpiozero import RotaryEncoder, Button, LED
import time
import threading
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('pacemaker_server.log')
    ]
)

logger = logging.getLogger("PacemakerServer")

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Use a safeguard to protect hardware access
try:
    # Improved encoder setup with specific configuration
    rate_encoder = RotaryEncoder(27, 22, max_steps=None, wrap=True)
    a_output_encoder = RotaryEncoder(21, 20, max_steps=None, wrap=True)
    v_output_encoder = RotaryEncoder(13, 6, max_steps=None, wrap=True)
    
    # Important: Set mode encoder to use no max steps and enable wrap
    # This ensures continuous rotation
    mode_output_encoder = RotaryEncoder(8, 7, max_steps=None, wrap=True)

    # Set up the Lock Button (using GPIO 17)
    lock_button = Button(17, bounce_time=0.05)  # Reduced bounce time for faster response

    # Set up the Up & down Button (using GPIO 26, 14)
    up_button = Button(26, bounce_time=0.05)  # Added up button on pin 26
    down_button = Button(14, bounce_time=0.05)  # Add down button on pin 14
    left_button = Button(15, bounce_time=0.05)  # Add left button on pin 15

    # Set up the Emergency DOO button (pin 23)
    emergency_button = Button(23, bounce_time=0.05)  # Add emergency button on pin 23
    
except Exception as e:
    logger.error(f"Error initializing hardware: {e}")
    # Create mock objects for testing without hardware
    from unittest.mock import MagicMock
    
    class MockEncoder:
        def __init__(self, pin1, pin2, max_steps=None, wrap=True):
            self.steps = 100
            self.when_rotated = None
            
        def close(self):
            pass
            
    class MockButton:
        def __init__(self, pin, bounce_time=0.05):
            self.when_pressed = None
            self.when_released = None
            
        def close(self):
            pass
    
    rate_encoder = MockEncoder(27, 22)
    a_output_encoder = MockEncoder(21, 20)
    v_output_encoder = MockEncoder(13, 6)
    mode_output_encoder = MockEncoder(8, 7)
    lock_button = MockButton(17)
    up_button = MockButton(26)
    down_button = MockButton(14)
    left_button = MockButton(15)
    emergency_button = MockButton(23)
    logger.warning("Using mock hardware objects for testing")

# Initial values
rate_encoder.steps = 80
current_rate = 80

a_output_encoder.steps = 100  # 10.0 mA initially
current_a_output = 10.0

v_output_encoder.steps = 100  # 10.0 mA initially
current_v_output = 10.0

mode_output_encoder.steps = 50  # Middle position for encoder
current_mode_output = 50

# Current active control (used for the mode encoder)
# Options: 'none', 'a_sensitivity', 'v_sensitivity'
active_control = 'none'

# Sensitivity values
a_sensitivity = 0.5  # Default value (mV)
v_sensitivity = 2.0  # Default value (mV)

# Lock state
is_locked = False

# Current mode (0 = VOO, 1 = VVI, 5 = DOO, 6 = DDD, etc.)
current_mode = 0

# Min/max values
min_rate = 30
max_rate = 200

min_a_output = 0.0
max_a_output = 20.0

min_v_output = 0.0
max_v_output = 25.0

min_a_sensitivity = 0.4  # mV
max_a_sensitivity = 10.0  # mV

min_v_sensitivity = 0.8  # mV
max_v_sensitivity = 20.0  # mV

# Button state trackers
up_button_pressed = False
last_up_press_time = 0

down_button_pressed = False
last_down_press_time = 0

left_button_pressed = False
last_left_press_time = 0

emergency_button_pressed = False
last_emergency_press_time = 0

# Thread safety
encoder_lock = threading.RLock()

def handle_down_button():
    global last_down_press_time, down_button_pressed
    current_time = time.time()
    
    # Debounce logic - only register a press if it's been at least 300ms since the last one
    if current_time - last_down_press_time > 0.3:
        last_down_press_time = current_time
        down_button_pressed = True
        logger.info("Down button pressed")


def handle_up_button():
    global last_up_press_time, up_button_pressed
    current_time = time.time()
    
    # Debounce logic - only register a press if it's been at least 300ms since the last one
    if current_time - last_up_press_time > 0.3:
        last_up_press_time = current_time
        up_button_pressed = True
        logger.info("Up button pressed")
        
        
def handle_left_button():
    global last_left_press_time, left_button_pressed
    current_time = time.time()
    
    # Debounce logic - only register a press if it's been at least 300ms since the last one
    if current_time - last_left_press_time > 0.3:
        last_left_press_time = current_time
        left_button_pressed = True
        logger.info("Left button pressed")

def handle_emergency_button():
    global last_emergency_press_time, emergency_button_pressed
    current_time = time.time()
    
    # Debounce logic - only register a press if it's been at least 300ms since the last one
    if current_time - last_emergency_press_time > 0.3:
        last_emergency_press_time = current_time
        emergency_button_pressed = True
        logger.info("Emergency button pressed")

# Function to update the current rate value
def update_rate():
    global current_rate
    
    with encoder_lock:
        # Skip updating if locked
        if is_locked or current_mode == 5:  # 5 = DOO mode
            return
            
        current_rate = max(min_rate, min(rate_encoder.steps, max_rate))
        rate_encoder.steps = current_rate
        logger.info(f"Rate updated: {current_rate} ppm")

# Function to determine the appropriate step size based on the current value
def get_output_step_size(value):
    if value < 0.4:
        return 0.1
    elif value < 1.0:
        return 0.2
    elif value < 5.0:
        return 0.5
    else:
        return 1.0

# Function to update the current A. Output value
def update_a_output():
    global current_a_output
    
    with encoder_lock:
        # Skip updating if locked
        if is_locked or current_mode == 5:  # 5 = DOO mode
            return
        
        # Get raw steps from encoder
        current_steps = a_output_encoder.steps
        
        # Map the raw encoder value directly to output values
        # This ensures we don't have state-tracking issues
        
        # Normalize the steps to be in range [0, 200]
        normalized_steps = current_steps % 200
        
        # Map normalized steps to output range (0-20mA)
        new_output = (normalized_steps / 200) * max_a_output
        
        # Apply appropriate step size rounding
        step_size = get_output_step_size(new_output)
        new_output = round(new_output / step_size) * step_size
        
        # Only update if there's a significant change
        if abs(new_output - current_a_output) > 0.01:
            logger.info(f"A. Output updated: {current_a_output} -> {new_output} mA (steps={current_steps})")
            current_a_output = new_output

# Function to update the current V. Output value
def update_v_output():
    global current_v_output
    
    with encoder_lock:
        # Skip updating if locked
        if is_locked or current_mode == 5:  # 5 = DOO mode
            return
        
        # Get raw steps from encoder
        current_steps = v_output_encoder.steps
        
        # Map the raw encoder value directly to output values
        # This ensures we don't have state-tracking issues
        
        # Normalize the steps to be in range [0, 250]
        normalized_steps = current_steps % 250
        
        # Map normalized steps to output range (0-25mA)
        new_output = (normalized_steps / 250) * max_v_output
        
        # Apply appropriate step size rounding
        step_size = get_output_step_size(new_output)
        new_output = round(new_output / step_size) * step_size
        
        # Only update if there's a significant change
        if abs(new_output - current_v_output) > 0.01:
            logger.info(f"V. Output updated: {current_v_output} -> {new_output} mA (steps={current_steps})")
            current_v_output = new_output

# Function to get step size for sensitivity values
def get_sensitivity_step_size(value, is_a_sensitivity=True):
    if is_a_sensitivity:
        if value <= 1:
            return 0.1
        if value <= 2:
            return 0.2
        if value <= 5:
            return 0.5
        return 1.0
    else:  # For V sensitivity
        if value <= 1:
            return 0.2
        if value <= 3:
            return 0.5
        if value <= 10:
            return 1.0
        return 2.0

# Updated function for the mode encoder that fixes the "sticking" issue
def update_mode_output():
    global a_sensitivity, v_sensitivity, active_control, current_mode_output
    
    with encoder_lock:
        # Skip updating if locked or in DOO mode or if no control is active
        if is_locked or current_mode == 5 or active_control == 'none':
            return
        
        # Get raw steps directly from encoder
        current_steps = mode_output_encoder.steps
        current_mode_output = current_steps  # Update tracking variable
        
        # IMPORTANT: Make clockwise increase values and counter-clockwise decrease values
        # This fixes the reversed direction issue
        
        if active_control == 'a_sensitivity':
            # Create a direct mapping from encoder to sensitivity
            # This ensures we won't get stuck due to state tracking issues
            
            # Map the raw encoder value to a sensitivity value range
            # Normalize steps to be in range [0, 100]
            normalized_steps = (current_steps % 100)
            
            # Map normalized steps to sensitivity range
            # Note: Reversed calculation to fix the direction
            if normalized_steps >= 95:  # Top 5% of range = ASYNC (0 mV)
                new_sensitivity = 0
            else:
                # Map 0-95 to max_sensitivity down to min_sensitivity
                # This way clockwise = more sensitive (lower mV value)
                new_sensitivity = max_a_sensitivity - (normalized_steps / 95) * (max_a_sensitivity - min_a_sensitivity)
                # Round to a reasonable step size to avoid tiny changes
                step_size = get_sensitivity_step_size(new_sensitivity, True)
                new_sensitivity = round(new_sensitivity / step_size) * step_size
            
            # Only log and update if there's an actual change
            if abs(new_sensitivity - a_sensitivity) > 0.001:
                logger.info(f"A Sensitivity direct update: {a_sensitivity} -> {new_sensitivity} mV (steps={current_steps})")
                a_sensitivity = new_sensitivity
                
        elif active_control == 'v_sensitivity':
            # Same approach for V sensitivity
            # Normalize steps to be in range [0, 100]
            normalized_steps = (current_steps % 100)
            
            # Map normalized steps to sensitivity range
            # Note: Reversed calculation to fix the direction
            if normalized_steps >= 95:  # Top 5% of range = ASYNC (0 mV)
                new_sensitivity = 0
            else:
                # Map 0-95 to max_sensitivity down to min_sensitivity
                # This way clockwise = more sensitive (lower mV value)
                new_sensitivity = max_v_sensitivity - (normalized_steps / 95) * (max_v_sensitivity - min_v_sensitivity)
                # Round to a reasonable step size to avoid tiny changes
                step_size = get_sensitivity_step_size(new_sensitivity, False)
                new_sensitivity = round(new_sensitivity / step_size) * step_size
            
            # Only log and update if there's an actual change
            if abs(new_sensitivity - v_sensitivity) > 0.001:
                logger.info(f"V Sensitivity direct update: {v_sensitivity} -> {new_sensitivity} mV (steps={current_steps})")
                v_sensitivity = new_sensitivity

# Function to toggle lock state
def toggle_lock():
    global is_locked
    
    with encoder_lock:
        is_locked = not is_locked
        logger.info(f"Device {'LOCKED' if is_locked else 'UNLOCKED'}")

# Change the event binding - only toggle on release
# This ensures a complete click cycle is required
lock_button.when_released = toggle_lock

# Attach event listeners
rate_encoder.when_rotated = update_rate
a_output_encoder.when_rotated = update_a_output
v_output_encoder.when_rotated = update_v_output
mode_output_encoder.when_rotated = update_mode_output
lock_button.when_pressed = toggle_lock

up_button.when_released = handle_up_button
down_button.when_released = handle_down_button
left_button.when_released = handle_left_button
emergency_button.when_pressed = handle_emergency_button  # Use pressed for emergency instead of released


# API endpoints for Lock status
@app.route('/api/lock', methods=['GET'])
def get_lock():
    with encoder_lock:
        return jsonify({
            'locked': is_locked
        })

@app.route('/api/lock/toggle', methods=['POST'])
def set_lock():
    toggle_lock()  # Use the same function to ensure consistent behavior
    return jsonify({'success': True, 'locked': is_locked})

# API endpoints for Rate
@app.route('/api/rate', methods=['GET'])
def get_rate():
    with encoder_lock:
        update_rate()
        return jsonify({
            'value': current_rate,
            'min': min_rate,
            'max': max_rate
        })

@app.route('/api/rate/set', methods=['POST'])
def set_rate():
    global current_rate
    
    with encoder_lock:
        # Check if locked
        if is_locked or current_mode == 5:  # 5 = DOO mode
            return jsonify({'error': 'Device is locked or in DOO mode'}), 403
            
        data = request.json
        if 'value' in data:
            try:
                new_rate = int(data['value'])
                rate_encoder.steps = new_rate
                update_rate()
                return jsonify({'success': True, 'value': current_rate})
            except Exception as e:
                logger.error(f"Error setting rate: {e}")
                return jsonify({'error': str(e)}), 400
        return jsonify({'error': 'No value provided'}), 400

# API endpoints for A. Output
@app.route('/api/a_output', methods=['GET'])
def get_a_output():
    with encoder_lock:
        update_a_output()
        return jsonify({
            'value': current_a_output,
            'min': min_a_output,
            'max': max_a_output
        })

@app.route('/api/a_output/set', methods=['POST'])
def set_a_output():
    global current_a_output
    
    with encoder_lock:
        # Check if locked
        if is_locked or current_mode == 5:  # 5 = DOO mode
            return jsonify({'error': 'Device is locked or in DOO mode'}), 403
            
        data = request.json
        if 'value' in data:
            try:
                new_a_output = float(data['value'])
                
                # Apply the new value, making sure it's in range
                new_a_output = max(min_a_output, min(new_a_output, max_a_output))
                
                # Round to the nearest valid step size
                step_size = get_output_step_size(new_a_output)
                new_a_output = round(new_a_output / step_size) * step_size
                
                # Update the encoder position to match the new value
                # Map the output value (0-20mA) to normalized steps (0-200)
                normalized_steps = int((new_a_output / max_a_output) * 200)
                a_output_encoder.steps = normalized_steps
                
                current_a_output = new_a_output
                logger.info(f"A. Output set via API: {current_a_output} mA")
                
                return jsonify({'success': True, 'value': current_a_output})
            except Exception as e:
                logger.error(f"Error setting A output: {e}")
                return jsonify({'error': str(e)}), 400
        return jsonify({'error': 'No value provided'}), 400

# API endpoints for V. Output
@app.route('/api/v_output', methods=['GET'])
def get_v_output():
    with encoder_lock:
        update_v_output()
        return jsonify({
            'value': current_v_output,
            'min': min_v_output,
            'max': max_v_output
        })

@app.route('/api/v_output/set', methods=['POST'])
def set_v_output():
    global current_v_output
    
    with encoder_lock:
        # Check if locked
        if is_locked or current_mode == 5:  # 5 = DOO mode
            return jsonify({'error': 'Device is locked or in DOO mode'}), 403
        
        data = request.json
        if 'value' in data:
            try:
                new_v_output = float(data['value'])
                
                # Apply the new value, ensuring it's in range
                new_v_output = max(min_v_output, min(new_v_output, max_v_output))
                
                # Round to the nearest valid step size
                step_size = get_output_step_size(new_v_output)
                new_v_output = round(new_v_output / step_size) * step_size
                
                # Update the encoder position to match the new value
                # Map the output value (0-25mA) to normalized steps (0-250)
                normalized_steps = int((new_v_output / max_v_output) * 250)
                v_output_encoder.steps = normalized_steps
                
                current_v_output = new_v_output
                logger.info(f"V. Output set via API: {current_v_output} mA")
                
                return jsonify({'success': True, 'value': current_v_output})
            except Exception as e:
                logger.error(f"Error setting V output: {e}")
                return jsonify({'error': str(e)}), 400
        return jsonify({'error': 'No value provided'}), 400

# New API endpoint for sensitivity controls
@app.route('/api/sensitivity', methods=['GET'])
def get_sensitivity():
    with encoder_lock:
        return jsonify({
            'a_sensitivity': a_sensitivity,
            'v_sensitivity': v_sensitivity,
            'active_control': active_control
        })

@app.route('/api/sensitivity/set', methods=['POST'])
def set_sensitivity():
    global a_sensitivity, v_sensitivity, active_control, mode_output_encoder
    
    with encoder_lock:
        # Check if locked
        if is_locked:
            return jsonify({'error': 'Device is locked'}), 403
            
        data = request.json
        updated = False
        
        if 'a_sensitivity' in data:
            try:
                new_value = float(data['a_sensitivity'])
                if new_value == 0 or min_a_sensitivity <= new_value <= max_a_sensitivity:
                    a_sensitivity = new_value
                    updated = True
                    
                    # If this sensitivity is currently being controlled, update encoder position
                    if active_control == 'a_sensitivity':
                        # Map sensitivity to encoder position
                        if new_value == 0:  # ASYNC mode
                            mode_output_encoder.steps = 95
                        else:
                            normalized_pos = 95 * (max_a_sensitivity - new_value) / (max_a_sensitivity - min_a_sensitivity)
                            mode_output_encoder.steps = int(normalized_pos)
                    
                else:
                    return jsonify({'error': f'A sensitivity value out of range ({min_a_sensitivity}-{max_a_sensitivity} or 0)'}), 400
            except Exception as e:
                logger.error(f"Error setting A sensitivity: {e}")
                return jsonify({'error': str(e)}), 400
        
        if 'v_sensitivity' in data:
            try:
                new_value = float(data['v_sensitivity'])
                if new_value == 0 or min_v_sensitivity <= new_value <= max_v_sensitivity:
                    v_sensitivity = new_value
                    updated = True
                    
                    # If this sensitivity is currently being controlled, update encoder position
                    if active_control == 'v_sensitivity':
                        # Map sensitivity to encoder position
                        if new_value == 0:  # ASYNC mode
                            mode_output_encoder.steps = 95
                        else:
                            normalized_pos = 95 * (max_v_sensitivity - new_value) / (max_v_sensitivity - min_v_sensitivity)
                            mode_output_encoder.steps = int(normalized_pos)
                    
                else:
                    return jsonify({'error': f'V sensitivity value out of range ({min_v_sensitivity}-{max_v_sensitivity} or 0)'}), 400
            except Exception as e:
                logger.error(f"Error setting V sensitivity: {e}")
                return jsonify({'error': str(e)}), 400
        
        if 'active_control' in data:
            new_control = data['active_control']
            old_control = active_control
            
            if new_control in ['none', 'a_sensitivity', 'v_sensitivity']:
                active_control = new_control
                updated = True
                
                # Important: Reset encoder position when changing active control
                # This prevents jumps in values when switching between controls
                if old_control != new_control:
                    if new_control == 'a_sensitivity':
                        # Map current a_sensitivity to a normalized encoder position
                        if a_sensitivity == 0:  # ASYNC mode
                            mode_output_encoder.steps = 95
                        else:
                            normalized_pos = 95 * (max_a_sensitivity - a_sensitivity) / (max_a_sensitivity - min_a_sensitivity)
                            mode_output_encoder.steps = int(normalized_pos)
                        logger.info(f"Reset mode encoder for A sensitivity: {a_sensitivity} mV -> steps={mode_output_encoder.steps}")
                    
                    elif new_control == 'v_sensitivity':
                        # Map current v_sensitivity to a normalized encoder position
                        if v_sensitivity == 0:  # ASYNC mode
                            mode_output_encoder.steps = 95
                        else:
                            normalized_pos = 95 * (max_v_sensitivity - v_sensitivity) / (max_v_sensitivity - min_v_sensitivity)
                            mode_output_encoder.steps = int(normalized_pos)
                        logger.info(f"Reset mode encoder for V sensitivity: {v_sensitivity} mV -> steps={mode_output_encoder.steps}")
                    
                    elif new_control == 'none':
                        # Reset to middle position when no control is active
                        mode_output_encoder.steps = 50
                        logger.info("Reset mode encoder to neutral position")
                
                logger.info(f"Active control set to: {active_control}")
            else:
                return jsonify({'error': 'Invalid active control value'}), 400
        
        if updated:
            return jsonify({
                'success': True,
                'a_sensitivity': a_sensitivity,
                'v_sensitivity': v_sensitivity,
                'active_control': active_control
            })
        else:
            return jsonify({'error': 'No valid parameters provided'}), 400

# API endpoint for setting mode
@app.route('/api/mode/set', methods=['POST'])
def set_mode():
    global current_mode
    
    with encoder_lock:
        # Check if locked
        if is_locked:
            return jsonify({'error': 'Device is locked'}), 403
            
        data = request.json
        if 'mode' in data:
            try:
                new_mode = int(data['mode'])
                # Valid mode is between 0-7
                if 0 <= new_mode <= 7:
                    current_mode = new_mode
                    logger.info(f"Mode changed to {current_mode}")
                    
                    # If setting to DOO mode (5), apply emergency settings
                    if new_mode == 5:
                        rate_encoder.steps = 80
                        current_rate = 80
                        current_a_output = 20.0  # Set A output to 20 mA
                        current_v_output = 25.0  # Set V output to 25 mA
                        logger.info("DOO Emergency mode activated with preset values")
                    
                    return jsonify({'success': True, 'mode': current_mode})
                else:
                    return jsonify({'error': 'Invalid mode value'}), 400
            except Exception as e:
                logger.error(f"Error setting mode: {e}")
                return jsonify({'error': str(e)}), 400
        return jsonify({'error': 'No mode provided'}), 400

# health check endpoint with improved reliability
@app.route('/api/health', methods=['GET'])
def health_check():
    global up_button_pressed, down_button_pressed, left_button_pressed, emergency_button_pressed
    
    try:
        with encoder_lock:
            # Create response data
            status_data = {
                'status': 'ok',
                'rate': current_rate,
                'a_output': current_a_output,
                'v_output': current_v_output,
                'locked': is_locked,
                'mode': current_mode,
                'a_sensitivity': a_sensitivity,
                'v_sensitivity': v_sensitivity,
                'active_control': active_control,
                'buttons': {
                    'up_pressed': up_button_pressed,
                    'down_pressed': down_button_pressed,
                    'left_pressed': left_button_pressed,
                    'emergency_pressed': emergency_button_pressed
                }
            }
            
            # Reset button states only after successful response creation
            was_up_pressed = up_button_pressed
            was_down_pressed = down_button_pressed
            was_left_pressed = left_button_pressed
            was_emergency_pressed = emergency_button_pressed
            
            if any([was_up_pressed, was_down_pressed, was_left_pressed, was_emergency_pressed]):
                logger.info(f"Button states: Up={was_up_pressed}, Down={was_down_pressed}, Left={was_left_pressed}, Emergency={was_emergency_pressed}")
            
            up_button_pressed = False
            down_button_pressed = False
            left_button_pressed = False
            emergency_button_pressed = False
            
            return jsonify(status_data)
    except Exception as e:
        logger.error(f"Error in health check: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

# API endpoint to get hardware information
@app.route('/api/hardware', methods=['GET'])
def get_hardware_info():
    try:
        with encoder_lock:
            return jsonify({
                'status': 'ok',
                'hardware': {
                    'rate_encoder': {
                        'rotation_count': rate_encoder.steps
                    },
                    'a_output_encoder': {
                        'rotation_count': a_output_encoder.steps
                    },
                    'v_output_encoder': {
                        'rotation_count': v_output_encoder.steps
                    },
                    'mode_output_encoder': {
                        'rotation_count': mode_output_encoder.steps
                    },
                    'buttons': {
                        'up_pressed': up_button_pressed,
                        'down_pressed': down_button_pressed,
                        'left_pressed': left_button_pressed,
                        'emergency_pressed': emergency_button_pressed
                    }
                }
            })
    except Exception as e:
        logger.error(f"Error getting hardware info: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

# Cleanup function to properly close all hardware connections
def cleanup():
    logger.info("Cleaning up hardware resources...")
    try:
        rate_encoder.close()
        a_output_encoder.close()
        v_output_encoder.close()
        mode_output_encoder.close()
        lock_button.close()
        up_button.close()
        down_button.close()
        left_button.close()
        emergency_button.close()
    except Exception as e:
        logger.error(f"Error during cleanup: {e}")

if __name__ == '__main__':
    try:
        logger.info("Pacemaker Server Started")
        logger.info(f"Rate encoder on pins CLK=27, DT=22 (initial value: {current_rate} ppm)")
        logger.info(f"A. Output encoder on pins CLK=21, DT=20 (initial value: {current_a_output} mA)")
        logger.info(f"V. Output encoder on pins CLK=13, DT=6 (initial value: {current_v_output} mA)")
        logger.info(f"Mode Output encoder on pins CLK=8, DT=7 (initial value: {current_mode_output})")
        logger.info(f"Lock button on pin GPIO 17 (initial state: {'Locked' if is_locked else 'Unlocked'})")
        logger.info(f"Up button on pin GPIO 26")
        logger.info(f"Down button on pin GPIO 14")
        logger.info(f"Left button on pin GPIO 15")
        logger.info(f"Emergency DOO button on pin GPIO 23")
        
        # Use threaded=True for better request handling
        app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
    except KeyboardInterrupt:
        logger.info("Server shutdown requested...")
    except Exception as e:
        logger.error(f"Error during server operation: {e}")
    finally:
        cleanup()
        logger.info("Server shutdown complete")