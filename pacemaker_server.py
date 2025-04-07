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
    # Set up the Rate rotary encoder (pins defined as in your example)
    rate_encoder = RotaryEncoder(27, 22, max_steps=200, wrap=False)

    # Set up the A Output rotary encoder (Clock 21, DT 20)
    a_output_encoder = RotaryEncoder(21, 20, max_steps=200, wrap=False)

    # Set up the V Output rotary encoder (Clock 13, DT 6)
    v_output_encoder = RotaryEncoder(13, 6, max_steps=200, wrap=False)

    # Set up the Mode Output encoder (Clock 8, DT 7)
    mode_output_encoder = RotaryEncoder(8, 7, max_steps=200, wrap=False)

    # Set up the Lock Button (from the screenshot, using GPIO 17)
    lock_button = Button(17, bounce_time=0.05)  # Reduced bounce time for faster response

    # Set up the Up & down Button  (using GPIO 26, 14)
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
        def __init__(self, pin1, pin2, max_steps=200, wrap=False):
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

mode_output_encoder.steps = 100  # Middle position for sensitivity
current_mode_output = 100

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

# Track last encoder position for outputs
last_a_output_steps = 100
last_v_output_steps = 100
last_mode_output_steps = 100

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
    global current_a_output, last_a_output_steps
    
    with encoder_lock:
        # Skip updating if locked
        if is_locked or current_mode == 5:  # 5 = DOO mode
            return
        
        # Get current steps from encoder
        current_steps = a_output_encoder.steps
        
        # Calculate the difference in steps
        diff = current_steps - last_a_output_steps
        
        # If there's a change in steps
        if diff != 0:
            # Get the step size based on the current value
            step_size = get_output_step_size(current_a_output)
            
            # Apply the change - one encoder step = one logical step
            # If diff is positive, increase by one step; if negative, decrease by one step
            if diff > 0:
                current_a_output += step_size
            else:
                current_a_output -= step_size
                
            # Ensure the value stays within bounds
            current_a_output = max(min_a_output, min(current_a_output, max_a_output))
            
            # Round to the nearest step size to prevent floating point errors
            current_a_output = round(current_a_output / step_size) * step_size
            
            # Update the encoder position to match the current value
            last_a_output_steps = current_steps
            
            logger.info(f"A. Output updated: {current_a_output} mA (step size: {step_size}, diff: {diff})")

# Function to update the current V. Output value
def update_v_output():
    global current_v_output, last_v_output_steps
    
    with encoder_lock:
        # Skip updating if locked
        if is_locked or current_mode == 5:  # 5 = DOO mode
            return
        
        # Get current steps from encoder
        current_steps = v_output_encoder.steps
        
        # Calculate the difference in steps
        diff = current_steps - last_v_output_steps
        
        # If there's a change in steps
        if diff != 0:
            # Get the step size based on the current value
            step_size = get_output_step_size(current_v_output)
            
            # Apply the change - one encoder step = one logical step
            # If diff is positive, increase by one step; if negative, decrease by one step
            if diff > 0:
                current_v_output += step_size
            else:
                current_v_output -= step_size
                
            # Ensure the value stays within bounds
            current_v_output = max(min_v_output, min(current_v_output, max_v_output))
            
            # Round to the nearest step size to prevent floating point errors
            current_v_output = round(current_v_output / step_size) * step_size
            
            # Update the encoder position to match the current value
            last_v_output_steps = current_steps
            
            logger.info(f"V. Output updated: {current_v_output} mA (step size: {step_size}, diff: {diff})")

# Function to convert between slider values and sensitivity values
def slider_to_sensitivity(slider_value, is_a_sensitivity=True):
    if slider_value >= 99.5:  # Special case for ASYNC mode (0 mV)
        return 0
    
    if is_a_sensitivity:
        # Map from 0-99.5 to 10-0.4 mV range (inverted)
        return max_a_sensitivity - (slider_value / 99.5) * (max_a_sensitivity - min_a_sensitivity)
    else:
        # Map from 0-99.5 to 20-0.8 mV range (inverted)
        return max_v_sensitivity - (slider_value / 99.5) * (max_v_sensitivity - min_v_sensitivity)

def sensitivity_to_slider(sensitivity_value, is_a_sensitivity=True):
    if sensitivity_value == 0:  # Special case for ASYNC mode
        return 100
    
    if is_a_sensitivity:
        # Map from 10-0.4 mV to 0-99.5 range (inverted)
        return ((max_a_sensitivity - sensitivity_value) / (max_a_sensitivity - min_a_sensitivity)) * 99.5
    else:
        # Map from 20-0.8 mV to 0-99.5 range (inverted)
        return ((max_v_sensitivity - sensitivity_value) / (max_v_sensitivity - min_v_sensitivity)) * 99.5

# Get step size for sensitivity values
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

# Function to update the current Mode Output value (for sensitivity controls)
def update_mode_output():
    global a_sensitivity, v_sensitivity, last_mode_output_steps, active_control
    
    with encoder_lock:
        # Skip updating if locked or in DOO mode or if no control is active
        if is_locked or current_mode == 5 or active_control == 'none':
            return
        
        # Get current steps from encoder
        current_steps = mode_output_encoder.steps
        
        # Calculate the difference in steps
        diff = current_steps - last_mode_output_steps
        
        # If there's a change in steps
        if diff != 0:
            # Update the last steps first to prevent multiple updates
            last_mode_output_steps = current_steps
            
            # Handle A Sensitivity adjustment
            if active_control == 'a_sensitivity':
                # Get step size based on current value
                step_size = get_sensitivity_step_size(a_sensitivity, True)
                
                # Adjust sensitivity (note: inverted because higher sensitivity = lower mV)
                if diff < 0:  # Turning clockwise (increase sensitivity = decrease mV)
                    a_sensitivity -= step_size
                else:  # Turning counter-clockwise (decrease sensitivity = increase mV)
                    a_sensitivity += step_size
                
                # Bounds check
                if a_sensitivity < min_a_sensitivity and a_sensitivity != 0:
                    a_sensitivity = min_a_sensitivity
                elif a_sensitivity > max_a_sensitivity:
                    a_sensitivity = max_a_sensitivity
                
                # Round to avoid floating point issues
                a_sensitivity = round(a_sensitivity / step_size) * step_size
                
                # Check for special case: toggle between minimum sensitivity and ASYNC (0)
                if abs(a_sensitivity - min_a_sensitivity) < 0.01 and diff < 0:
                    a_sensitivity = 0  # Set to ASYNC (0)
                elif a_sensitivity == 0 and diff > 0:
                    a_sensitivity = min_a_sensitivity  # Set to minimum sensitivity
                
                logger.info(f"A Sensitivity updated: {a_sensitivity} mV (step size: {step_size}, diff: {diff})")
            
            # Handle V Sensitivity adjustment
            elif active_control == 'v_sensitivity':
                # Get step size based on current value
                step_size = get_sensitivity_step_size(v_sensitivity, False)
                
                # Adjust sensitivity (note: inverted because higher sensitivity = lower mV)
                if diff < 0:  # Turning clockwise (increase sensitivity = decrease mV)
                    v_sensitivity -= step_size
                else:  # Turning counter-clockwise (decrease sensitivity = increase mV)
                    v_sensitivity += step_size
                
                # Bounds check
                if v_sensitivity < min_v_sensitivity and v_sensitivity != 0:
                    v_sensitivity = min_v_sensitivity
                elif v_sensitivity > max_v_sensitivity:
                    v_sensitivity = max_v_sensitivity
                
                # Round to avoid floating point issues
                v_sensitivity = round(v_sensitivity / step_size) * step_size
                
                # Check for special case: toggle between minimum sensitivity and ASYNC (0)
                if abs(v_sensitivity - min_v_sensitivity) < 0.01 and diff < 0:
                    v_sensitivity = 0  # Set to ASYNC (0)
                elif v_sensitivity == 0 and diff > 0:
                    v_sensitivity = min_v_sensitivity  # Set to minimum sensitivity
                
                logger.info(f"V Sensitivity updated: {v_sensitivity} mV (step size: {step_size}, diff: {diff})")

# Function to toggle lock state
def toggle_lock():
    global is_locked
    
    with encoder_lock:
        is_locked = not is_locked
        logger.info(f"Device {'LOCKED' if is_locked else 'UNLOCKED'}")

# Change the event binding - only toggle on release
# This ensures a complete click cycle is required
lock_button.when_released = toggle_lock  # Change from when_pressed to when_released

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
    global current_a_output, last_a_output_steps
    
    with encoder_lock:
        # Check if locked
        if is_locked or current_mode == 5:  # 5 = DOO mode
            return jsonify({'error': 'Device is locked or in DOO mode'}), 403
            
        data = request.json
        if 'value' in data:
            try:
                new_a_output = float(data['value'])
                # Apply the new value
                current_a_output = new_a_output
                # Round to the nearest valid step size
                step_size = get_output_step_size(current_a_output)
                current_a_output = round(current_a_output / step_size) * step_size
                # Make sure it's within bounds
                current_a_output = max(min_a_output, min(current_a_output, max_a_output))
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
    global current_v_output, last_v_output_steps
    
    with encoder_lock:
        # Check if locked
        if is_locked or current_mode == 5:  # 5 = DOO mode
            return jsonify({'error': 'Device is locked or in DOO mode'}), 403
        
        data = request.json
        if 'value' in data:
            try:
                new_v_output = float(data['value'])
                # Apply the new value
                current_v_output = new_v_output
                # Round to the nearest valid step size
                step_size = get_output_step_size(current_v_output)
                current_v_output = round(current_v_output / step_size) * step_size
                # Make sure it's within bounds
                current_v_output = max(min_v_output, min(current_v_output, max_v_output))
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
    global a_sensitivity, v_sensitivity, active_control
    
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
                else:
                    return jsonify({'error': f'V sensitivity value out of range ({min_v_sensitivity}-{max_v_sensitivity} or 0)'}), 400
            except Exception as e:
                logger.error(f"Error setting V sensitivity: {e}")
                return jsonify({'error': str(e)}), 400
        
        if 'active_control' in data:
            new_control = data['active_control']
            if new_control in ['none', 'a_sensitivity', 'v_sensitivity']:
                active_control = new_control
                updated = True
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