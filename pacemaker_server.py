from flask import Flask, jsonify, request
from flask_cors import CORS
from gpiozero import RotaryEncoder, Button, LED
import time

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Set up the Rate rotary encoder (pins defined as in your example)
rate_encoder = RotaryEncoder(27, 22, max_steps=200, wrap=False)

# Set up the A Output rotary encoder (Clock 21, DT 20)
a_output_encoder = RotaryEncoder(21, 20, max_steps=200, wrap=False)

# Set up the V Output rotary encoder (Clock 13, DT 6)
v_output_encoder = RotaryEncoder(13, 6, max_steps=200, wrap=False)

mode_output_encoder = RotaryEncoder(8, 7, max_steps=200, wrap=False)

# Set up the Lock Button (from the screenshot, using GPIO 17)
lock_button = Button(17, bounce_time=0.05)  # Reduced bounce time for faster response

# Set up the Up & down Button  (using GPIO 26, 14)
up_button = Button(26, bounce_time=0.05)  # Added up button on pin 26
down_button = Button(14, bounce_time=0.05)  # Add down button on pin 14
left_button = Button(15, bounce_time=0.05)  # Add left button on pin 8

# Set up the Emergency DOO button (pin 23)
emergency_button = Button(23, bounce_time=0.05)  # Add emergency button on pin 23

# Initial values
rate_encoder.steps = 80
current_rate = 80

a_output_encoder.steps = 100  # 10.0 mA initially
current_a_output = 10.0

v_output_encoder.steps = 100  # 10.0 mA initially
current_v_output = 10.0

# Lock state
is_locked = False

# Current mode (0 = VOO, 5 = DOO, etc.)
current_mode = 0

# Min/max values
min_rate = 30
max_rate = 200

min_a_output = 0.0
max_a_output = 20.0

min_v_output = 0.0
max_v_output = 25.0

# Mode indices
DOO_MODE_INDEX = 5  # Index 5 corresponds to 'DOO' in the modes array
DDD_MODE_INDEX = 6  # Index 6 corresponds to 'DDD' in the modes array

# DOO mode emergency values
DOO_RATE = 80
DOO_A_OUTPUT = 20.0
DOO_V_OUTPUT = 25.0

# Track last encoder position for outputs
last_a_output_steps = 100
last_v_output_steps = 100

# Button state trackers
up_button_pressed = False
last_up_press_time = 0

down_button_pressed = False
last_down_press_time = 0

left_button_pressed = False
last_left_press_time = 0

emergency_button_pressed = False
last_emergency_press_time = 0

# DOO mode UI state tracker
in_doo_settings = False

def handle_down_button():
    global last_down_press_time, down_button_pressed
    current_time = time.time()
    
    # Debounce logic - only register a press if it's been at least 300ms since the last one
    if current_time - last_down_press_time > 0.3:
        last_down_press_time = current_time
        down_button_pressed = True
        print("Down button pressed")


def handle_up_button():
    global last_up_press_time, up_button_pressed
    current_time = time.time()
    
    # Debounce logic - only register a press if it's been at least 300ms since the last one
    if current_time - last_up_press_time > 0.3:
        last_up_press_time = current_time
        up_button_pressed = True
        print("Up button pressed")
        
        
def handle_left_button():
    global last_left_press_time, left_button_pressed, in_doo_settings, current_mode
    current_time = time.time()
    
    # Debounce logic - only register a press if it's been at least 300ms since the last one
    if current_time - last_left_press_time > 0.3:
        last_left_press_time = current_time
        left_button_pressed = True
        print("Left button pressed")
        
        # If in DOO settings, transition to DDD mode on left press
        if in_doo_settings and current_mode == DOO_MODE_INDEX:
            current_mode = DDD_MODE_INDEX
            in_doo_settings = False
            print("Exiting DOO mode, switching to DDD mode")


def handle_emergency_button():
    global last_emergency_press_time, emergency_button_pressed, current_mode, in_doo_settings
    current_time = time.time()
    
    # Debounce logic - only register a press if it's been at least 300ms since the last one
    if current_time - last_emergency_press_time > 0.3:
        last_emergency_press_time = current_time
        emergency_button_pressed = True
        in_doo_settings = True
        print("Emergency button pressed")
        
        # Set DOO mode directly
        set_doo_emergency_mode()

# Function to set DOO emergency mode
def set_doo_emergency_mode():
    global current_mode, current_rate, current_a_output, current_v_output, in_doo_settings
    
    # Set DOO mode
    current_mode = DOO_MODE_INDEX
    in_doo_settings = True
    
    # Set emergency values
    current_rate = DOO_RATE
    current_a_output = DOO_A_OUTPUT
    current_v_output = DOO_V_OUTPUT
    
    # Update encoder positions to match
    rate_encoder.steps = DOO_RATE
    
    # Update A and V output encoders (without triggering their callbacks)
    a_output_encoder.steps = 100  # arbitrary value - we're enforcing the output values
    v_output_encoder.steps = 100  # arbitrary value - we're enforcing the output values
    
    print(f"DOO Emergency Mode set: Rate={DOO_RATE}ppm, A={DOO_A_OUTPUT}mA, V={DOO_V_OUTPUT}mA")

# Check if in DOO mode
def is_in_doo_mode():
    return current_mode == DOO_MODE_INDEX

# Function to update the current rate value
def update_rate():
    global current_rate
    
    # Skip updating if locked or in DOO mode
    if is_locked or is_in_doo_mode():
        # If in DOO mode, force the rate to emergency value
        if is_in_doo_mode():
            current_rate = DOO_RATE
            rate_encoder.steps = DOO_RATE  # Reset the encoder position to match
        return
        
    current_rate = max(min_rate, min(rate_encoder.steps, max_rate))
    rate_encoder.steps = current_rate
    print(f"Rate updated: {current_rate} ppm")

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
    
    # Skip updating if locked or in DOO mode
    if is_locked or is_in_doo_mode():
        # If in DOO mode, force the A output to emergency value
        if is_in_doo_mode():
            current_a_output = DOO_A_OUTPUT
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
        
        print(f"A. Output updated: {current_a_output} mA (step size: {step_size}, diff: {diff})")

# Function to update the current V. Output value
def update_v_output():
    global current_v_output, last_v_output_steps
    
    # Skip updating if locked or in DOO mode
    if is_locked or is_in_doo_mode():
        # If in DOO mode, force the V output to emergency value
        if is_in_doo_mode():
            current_v_output = DOO_V_OUTPUT
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
        
        print(f"V. Output updated: {current_v_output} mA (step size: {step_size}, diff: {diff})")

# Function to toggle lock state
def toggle_lock():
    global is_locked
    is_locked = not is_locked
    
    # Update LED based on lock state
    if is_locked:
        # lock_led.on()  # Turn on LED when locked
        print("Device LOCKED")
    else:
        # lock_led.off()  # Turn off LED when unlocked
        print("Device UNLOCKED")

# Change the event binding - only toggle on release
# This ensures a complete click cycle is required
lock_button.when_released = toggle_lock  # Change from when_pressed to when_released

# Attach event listeners
rate_encoder.when_rotated = update_rate
a_output_encoder.when_rotated = update_a_output
v_output_encoder.when_rotated = update_v_output
lock_button.when_pressed = toggle_lock

up_button.when_released = handle_up_button
down_button.when_released = handle_down_button
left_button.when_released = handle_left_button
emergency_button.when_pressed = handle_emergency_button  # Use pressed for emergency instead of released


# API endpoints for Lock status
@app.route('/api/lock', methods=['GET'])
def get_lock():
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
    global current_rate
    
    # If in DOO mode, ensure rate is at emergency value
    if is_in_doo_mode():
        current_rate = DOO_RATE
    else:
        update_rate()
        
    return jsonify({
        'value': current_rate,
        'min': min_rate,
        'max': max_rate
    })

@app.route('/api/rate/set', methods=['POST'])
def set_rate():
    global current_rate
    
    # Check if in DOO mode - reject any changes
    if is_in_doo_mode():
        return jsonify({'error': 'Device is in DOO mode, rate is fixed at 80ppm'}), 403
        
    # Check if locked
    if is_locked:
        return jsonify({'error': 'Device is locked'}), 403
        
    data = request.json
    if 'value' in data:
        new_rate = int(data['value'])
        rate_encoder.steps = new_rate
        update_rate()
        return jsonify({'success': True, 'value': current_rate})
    return jsonify({'error': 'No value provided'}), 400

@app.route('/api/rate/reset', methods=['POST'])
def api_reset_rate():
    global current_rate
    
    # Check if in DOO mode - reject any changes
    if is_in_doo_mode():
        return jsonify({'error': 'Device is in DOO mode, rate is fixed at 80ppm'}), 403
        
    # Check if locked
    if is_locked:
        return jsonify({'error': 'Device is locked'}), 403
        
    reset_rate()
    return jsonify({'success': True, 'value': current_rate})

# Function to reset the rate to default
def reset_rate():
    global current_rate
    rate_encoder.steps = 80
    current_rate = 80
    print("Rate reset to 80 ppm!")

# API endpoints for A. Output
@app.route('/api/a_output', methods=['GET'])
def get_a_output():
    global current_a_output
    
    # If in DOO mode, ensure a_output is at emergency value
    if is_in_doo_mode():
        current_a_output = DOO_A_OUTPUT
    else:
        update_a_output()
        
    return jsonify({
        'value': current_a_output,
        'min': min_a_output,
        'max': max_a_output
    })

@app.route('/api/a_output/set', methods=['POST'])
def set_a_output():
    global current_a_output, last_a_output_steps
    
    # Check if in DOO mode - reject any changes
    if is_in_doo_mode():
        return jsonify({'error': 'Device is in DOO mode, A Output is fixed at 20.0mA'}), 403
        
    # Check if locked
    if is_locked:
        return jsonify({'error': 'Device is locked'}), 403
        
    data = request.json
    if 'value' in data:
        new_a_output = float(data['value'])
        # Apply the new value
        current_a_output = new_a_output
        # Round to the nearest valid step size
        step_size = get_output_step_size(current_a_output)
        current_a_output = round(current_a_output / step_size) * step_size
        # Make sure it's within bounds
        current_a_output = max(min_a_output, min(current_a_output, max_a_output))
        return jsonify({'success': True, 'value': current_a_output})
    return jsonify({'error': 'No value provided'}), 400

@app.route('/api/a_output/reset', methods=['POST'])
def api_reset_a_output():
    global current_a_output
    
    # Check if in DOO mode - reject any changes
    if is_in_doo_mode():
        return jsonify({'error': 'Device is in DOO mode, A Output is fixed at 20.0mA'}), 403
        
    # Check if locked
    if is_locked:
        return jsonify({'error': 'Device is locked'}), 403
        
    reset_a_output()
    return jsonify({'success': True, 'value': current_a_output})

# Function to reset the A. Output to default
def reset_a_output():
    global current_a_output, last_a_output_steps
    a_output_encoder.steps = 100
    last_a_output_steps = 100
    current_a_output = 10.0
    print("A. Output reset to 10.0 mA!")

# API endpoints for V. Output
@app.route('/api/v_output', methods=['GET'])
def get_v_output():
    global current_v_output
    
    # If in DOO mode, ensure v_output is at emergency value
    if is_in_doo_mode():
        current_v_output = DOO_V_OUTPUT
    else:
        update_v_output()
        
    return jsonify({
        'value': current_v_output,
        'min': min_v_output,
        'max': max_v_output
    })

@app.route('/api/v_output/set', methods=['POST'])
def set_v_output():
    global current_v_output, last_v_output_steps
    
    # Check if in DOO mode - reject any changes
    if is_in_doo_mode():
        return jsonify({'error': 'Device is in DOO mode, V Output is fixed at 25.0mA'}), 403
        
    # Check if locked
    if is_locked:
        return jsonify({'error': 'Device is locked'}), 403
        
    data = request.json
    if 'value' in data:
        new_v_output = float(data['value'])
        # Apply the new value
        current_v_output = new_v_output
        # Round to the nearest valid step size
        step_size = get_output_step_size(current_v_output)
        current_v_output = round(current_v_output / step_size) * step_size
        # Make sure it's within bounds
        current_v_output = max(min_v_output, min(current_v_output, max_v_output))
        return jsonify({'success': True, 'value': current_v_output})
    return jsonify({'error': 'No value provided'}), 400

@app.route('/api/v_output/reset', methods=['POST'])
def api_reset_v_output():
    global current_v_output
    
    # Check if in DOO mode - reject any changes
    if is_in_doo_mode():
        return jsonify({'error': 'Device is in DOO mode, V Output is fixed at 25.0mA'}), 403
        
    # Check if locked
    if is_locked:
        return jsonify({'error': 'Device is locked'}), 403
        
    reset_v_output()
    return jsonify({'success': True, 'value': current_v_output})

# Function to reset the V. Output to default
def reset_v_output():
    global current_v_output, last_v_output_steps
    v_output_encoder.steps = 100
    last_v_output_steps = 100
    current_v_output = 10.0
    print("V. Output reset to 10.0 mA!")

# API endpoint for setting mode
@app.route('/api/mode/set', methods=['POST'])
def set_mode():
    global current_mode, in_doo_settings
    
    # Check if locked
    if is_locked:
        return jsonify({'error': 'Device is locked'}), 403
        
    data = request.json
    if 'mode' in data:
        new_mode = int(data['mode'])
        # Valid mode is between 0-7
        if 0 <= new_mode <= 7:
            # Special case for DDD mode when exiting DOO
            if current_mode == DOO_MODE_INDEX and new_mode == DDD_MODE_INDEX:
                in_doo_settings = False
            
            current_mode = new_mode
            
            # If setting to DOO mode (5), apply emergency settings
            if new_mode == DOO_MODE_INDEX:
                set_doo_emergency_mode()
                
            return jsonify({'success': True, 'mode': current_mode})
        else:
            return jsonify({'error': 'Invalid mode value'}), 400
    return jsonify({'error': 'No mode provided'}), 400

# API endpoint for exiting DOO mode to DDD mode
@app.route('/api/exit_doo', methods=['POST'])
def exit_doo_mode():
    global current_mode, in_doo_settings
    
    if current_mode == DOO_MODE_INDEX:
        current_mode = DDD_MODE_INDEX
        in_doo_settings = False
        print("Exiting DOO mode, switching to DDD mode")
        
    return jsonify({
        'success': True,
        'mode': current_mode
    })

# API endpoint to explicitly set DOO emergency mode
@app.route('/api/emergency/doo', methods=['POST'])
def api_set_doo_emergency():
    # Always allow DOO emergency mode, even if locked
    set_doo_emergency_mode()
    return jsonify({
        'success': True,
        'mode': current_mode,
        'rate': current_rate,
        'a_output': current_a_output,
        'v_output': current_v_output
    })

# health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    global current_rate, current_a_output, current_v_output
    global up_button_pressed, down_button_pressed, left_button_pressed, emergency_button_pressed
    
    # If in DOO mode, ensure values are at emergency levels
    if is_in_doo_mode():
        current_rate = DOO_RATE
        current_a_output = DOO_A_OUTPUT
        current_v_output = DOO_V_OUTPUT
    
    # Create response data
    status_data = {
        'status': 'ok',
        'rate': current_rate,
        'a_output': current_a_output,
        'v_output': current_v_output,
        'locked': is_locked,
        'mode': current_mode,
        'in_doo_settings': in_doo_settings,
        'buttons': {
            'up_pressed': up_button_pressed,
            'down_pressed': down_button_pressed,
            'left_pressed': left_button_pressed,
            'emergency_pressed': emergency_button_pressed
        }
    }
    
    # Reset button states
    was_up_pressed = up_button_pressed
    was_down_pressed = down_button_pressed
    was_left_pressed = left_button_pressed
    was_emergency_pressed = emergency_button_pressed
    up_button_pressed = False
    down_button_pressed = False
    left_button_pressed = False
    emergency_button_pressed = False
    
    return jsonify(status_data)

# API endpoint to get hardware information
@app.route('/api/hardware', methods=['GET'])
def get_hardware_info():
    global up_button_pressed, down_button_pressed, left_button_pressed, emergency_button_pressed
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
            'buttons': {
                'up_pressed': up_button_pressed,
                'down_pressed': down_button_pressed,
                'left_pressed': left_button_pressed,
                'emergency_pressed': emergency_button_pressed
            }
        }
    })


if __name__ == '__main__':
    # Set initial LED state based on lock state
    # if is_locked:
    #     # lock_led.on()
    # else:
    #     # lock_led.off()
        
    print("Pacemaker Server Started")
    print(f"Rate encoder on pins CLK=27, DT=22 (initial value: {current_rate} ppm)")
    print(f"A. Output encoder on pins CLK=21, DT=20 (initial value: {current_a_output} mA)")
    print(f"V. Output encoder on pins CLK=13, DT=6 (initial value: {current_v_output} mA)")
    print(f"Lock button on pin GPIO 17 (initial state: {'Locked' if is_locked else 'Unlocked'})")
    print(f"Up button on pin GPIO 26")
    print(f"Down button on pin GPIO 14")
    print(f"Left button on pin GPIO 15")
    print(f"Emergency DOO button on pin GPIO 23")
    app.run(host='0.0.0.0', port=5000, debug=False)