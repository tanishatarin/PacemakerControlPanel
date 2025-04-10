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

# mode_output_encoder = RotaryEncoder(8, 7, max_steps=200, wrap=False)
mode_output_encoder = RotaryEncoder(8, 7, max_steps=200, wrap=False, bounce_time=0.001)

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

mode_output_encoder.steps = 50 # 5.0 mA initially
current_mode_output = 5.0 

# Add these initializations near the top with other initial values
a_sensitivity = 0.5  # Initial A sensitivity (mV)
v_sensitivity = 2.0  # Initial V sensitivity (mV)
active_control = 'none'  # Initial active control (none, a_sensitivity, v_sensitivity)

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

min_a_sensitivity = 0.4  # mV
max_a_sensitivity = 10.0  # mV

min_v_sensitivity = 0.8  # mV
max_v_sensitivity = 20.0  # mV

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

last_mode_encoder_activity = time.time()


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
    global last_left_press_time, left_button_pressed
    current_time = time.time()
    
    # Debounce logic - only register a press if it's been at least 300ms since the last one
    if current_time - last_left_press_time > 0.3:
        last_left_press_time = current_time
        left_button_pressed = True
        print("Left button pressed")

def handle_emergency_button():
    global last_emergency_press_time, emergency_button_pressed
    current_time = time.time()
    
    # Debounce logic - only register a press if it's been at least 300ms since the last one
    if current_time - last_emergency_press_time > 0.3:
        last_emergency_press_time = current_time
        emergency_button_pressed = True
        print("Emergency button pressed")

# Function to update the current rate value
def update_rate():
    global current_rate
    
    # Skip updating if locked, but allow in DOO mode
    if is_locked:
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

# Function to update the current A. Output value
def update_a_output():
    global current_a_output, last_a_output_steps
    
    # Skip updating if locked, but allow in DOO mode
    if is_locked:
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
    
    # Skip updating if locked, but allow in DOO mode
    if is_locked:
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


# Completely rewrite the update_mode_output function
def update_mode_output():
    global a_sensitivity, v_sensitivity, active_control, mode_output_encoder, last_mode_encoder_activity
    
    # Skip if locked or no active control
    if is_locked or active_control == 'none':
        return
    
    # Get current steps
    current_steps = mode_output_encoder.steps
    
    # Initialize tracking if needed
    if not hasattr(update_mode_output, 'last_steps'):
        update_mode_output.last_steps = current_steps
        return
    
    # Calculate difference
    step_diff = current_steps - update_mode_output.last_steps
    
    # Skip if no real movement
    if step_diff == 0:
        return
        
    # Update activity timestamp
    last_mode_encoder_activity = time.time()
    
    # Record the steps IMMEDIATELY to prevent drift
    update_mode_output.last_steps = current_steps
    
    # Movement direction (reversed for expected behavior)
    direction = -1 if step_diff > 0 else 1
    
    # Process based on control type
    if active_control == 'a_sensitivity':
        # Handle A sensitivity adjustments
        step_size = get_sensitivity_step_size(a_sensitivity, True)
        
        if a_sensitivity == 0 and direction < 0:
            a_sensitivity = min_a_sensitivity
            print(f"A Sensitivity: ASYNC → {a_sensitivity} mV")
        elif a_sensitivity == min_a_sensitivity and direction > 0:
            a_sensitivity = 0
            print(f"A Sensitivity: {min_a_sensitivity} mV → ASYNC")
        else:
            if a_sensitivity > 0:
                new_value = a_sensitivity + (direction * step_size)
                if min_a_sensitivity <= new_value <= max_a_sensitivity:
                    a_sensitivity = round(new_value, 1)  # Round to 1 decimal
                    print(f"A Sensitivity: {a_sensitivity} mV")
    
    elif active_control == 'v_sensitivity':
        # Handle V sensitivity adjustments
        step_size = get_sensitivity_step_size(v_sensitivity, False)
        
        if v_sensitivity == 0 and direction < 0:
            v_sensitivity = min_v_sensitivity
            print(f"V Sensitivity: ASYNC → {v_sensitivity} mV")
        elif v_sensitivity == min_v_sensitivity and direction > 0:
            v_sensitivity = 0
            print(f"V Sensitivity: {min_v_sensitivity} mV → ASYNC")
        else:
            if v_sensitivity > 0:
                new_value = v_sensitivity + (direction * step_size)
                if min_v_sensitivity <= new_value <= max_v_sensitivity:
                    v_sensitivity = round(new_value, 1)  # Round to 1 decimal
                    print(f"V Sensitivity: {v_sensitivity} mV")


# Add near your other hardware functions
def hardware_reset_mode_encoder():
    """Force reset of mode encoder state at hardware level"""
    global mode_output_encoder, update_mode_output
    
    # Get current position
    current_steps = mode_output_encoder.steps
    
    # Force reset tracking variable
    if hasattr(update_mode_output, 'last_steps'):
        update_mode_output.last_steps = current_steps
    
    print(f"Hard reset of mode encoder to steps={current_steps}")


# Add this function to periodically reset the encoder state if it gets stuck
def reset_stuck_encoders():
    global mode_output_encoder, last_mode_encoder_activity
    
    current_time = time.time()
    
    # If it's been more than 3 seconds since last activity and there's an active control
    if current_time - last_mode_encoder_activity > 3 and active_control != 'none':
        # Reset the steps to match the logical state
        current_steps = mode_output_encoder.steps
        
        # Only reset if update_mode_output.last_steps exists and differs
        if hasattr(update_mode_output, 'last_steps') and update_mode_output.last_steps != current_steps:
            print(f"Resetting stuck encoder: {update_mode_output.last_steps} → {current_steps}")
            update_mode_output.last_steps = current_steps


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
mode_output_encoder.when_rotated = update_mode_output
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
    update_rate()
    return jsonify({
        'value': current_rate,
        'min': min_rate,
        'max': max_rate
    })

# API endpoints for Rate
@app.route('/api/rate/set', methods=['POST'])
def set_rate():
    global current_rate
    # Check if locked, but allow in DOO mode
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
    # Check if locked
    if is_locked or current_mode == 5:  # 5 = DOO mode
        return jsonify({'error': 'Device is locked or in DOO mode'}), 403
        
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
    update_a_output()
    return jsonify({
        'value': current_a_output,
        'min': min_a_output,
        'max': max_a_output
    })

@app.route('/api/a_output/set', methods=['POST'])
def set_a_output():
    global current_a_output, last_a_output_steps
    # Check if locked, but allow in DOO mode
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
    # Check if locked
    if is_locked or current_mode == 5:  # 5 = DOO mode
        return jsonify({'error': 'Device is locked or in DOO mode'}), 403
        
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
    update_v_output()
    return jsonify({
        'value': current_v_output,
        'min': min_v_output,
        'max': max_v_output
    })


@app.route('/api/v_output/set', methods=['POST'])
def set_v_output():
    global current_v_output, last_v_output_steps
    # Check if locked, but allow in DOO mode
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
    # Check if locked
    if is_locked or current_mode == 5:  # 5 = DOO mode
        return jsonify({'error': 'Device is locked or in DOO mode'}), 403
        
    reset_v_output()
    return jsonify({'success': True, 'value': current_v_output})

# Function to reset the V. Output to default
def reset_v_output():
    global current_v_output, last_v_output_steps
    v_output_encoder.steps = 100
    last_v_output_steps = 100
    current_v_output = 10.0
    print("V. Output reset to 10.0 mA!")
    
# New API endpoint for sensitivity controls
@app.route('/api/sensitivity', methods=['GET'])
def get_sensitivity():
    return jsonify({
        'a_sensitivity': a_sensitivity,
        'v_sensitivity': v_sensitivity,
        'active_control': active_control
    })

@app.route('/api/sensitivity/set', methods=['POST'])
def set_sensitivity():
    global a_sensitivity, v_sensitivity, active_control, mode_output_encoder, last_mode_encoder_activity
    
    # Check if locked
    if is_locked:
        return jsonify({'error': 'Device is locked'}), 403
        
    data = request.json
    updated = False
    
    # Handle active_control changes
    if 'active_control' in data:
        new_control = data['active_control']
        
        if new_control in ['none', 'a_sensitivity', 'v_sensitivity']:
            if active_control != new_control:
                # Important: Reset encoder state when changing controls
                active_control = new_control
                # Force reset of encoder tracking state
                if hasattr(update_mode_output, 'last_steps'):
                    delattr(update_mode_output, 'last_steps')
                last_mode_encoder_activity = time.time()
                updated = True
                print(f"Active control changed to: {active_control}")
                
                # Set encoder position appropriately for the new control
                if new_control == 'none':
                    mode_output_encoder.steps = 50  # Neutral position
                else:
                    # Don't change encoder steps - just reset tracking
                    pass
        else:
            return jsonify({'error': 'Invalid active control value'}), 400
    
    # Handle a_sensitivity
    if 'a_sensitivity' in data:
        try:
            new_value = float(data['a_sensitivity'])
            # Validate range
            if new_value == 0 or min_a_sensitivity <= new_value <= max_a_sensitivity:
                a_sensitivity = round(new_value, 1)  # Round to 1 decimal place
                updated = True
                print(f"A sensitivity set to: {a_sensitivity}")
            else:
                return jsonify({'error': f'A sensitivity value out of range ({min_a_sensitivity}-{max_a_sensitivity} or 0)'}), 400
        except Exception as e:
            return jsonify({'error': str(e)}), 400
    
    # Handle v_sensitivity
    if 'v_sensitivity' in data:
        try:
            new_value = float(data['v_sensitivity'])
            # Validate range
            if new_value == 0 or min_v_sensitivity <= new_value <= max_v_sensitivity:
                v_sensitivity = round(new_value, 1)  # Round to 1 decimal place
                updated = True
                print(f"V sensitivity set to: {v_sensitivity}")
            else:
                return jsonify({'error': f'V sensitivity value out of range ({min_v_sensitivity}-{max_v_sensitivity} or 0)'}), 400
        except Exception as e:
            return jsonify({'error': str(e)}), 400
    
     # Return success
    if updated:
        # Also reset the watchdog timer
        last_mode_encoder_activity = time.time()
        
        return jsonify({
            'success': True,
            'a_sensitivity': a_sensitivity,
            'v_sensitivity': v_sensitivity,
            'active_control': active_control
        })
    else:
        return jsonify({'error': 'No valid parameters provided'}), 400
    
# Add a new API endpoint for emergency reset
@app.route('/api/reset_encoder', methods=['POST'])
def api_reset_encoder():
    encoder_type = request.json.get('type', 'mode')
    
    if encoder_type == 'mode':
        hardware_reset_mode_encoder()
        return jsonify({'success': True, 'message': 'Mode encoder reset successful'})
    else:
        return jsonify({'error': 'Unknown encoder type'}), 400
     
    
# API endpoint for setting mode
@app.route('/api/mode/set', methods=['POST'])
def set_mode():
    global current_mode
    
    # Check if locked
    if is_locked:
        return jsonify({'error': 'Device is locked'}), 403
        
    data = request.json
    if 'mode' in data:
        new_mode = int(data['mode'])
        # Valid mode is between 0-7
        if 0 <= new_mode <= 7:
            current_mode = new_mode
            # If setting to DOO mode (5), apply emergency settings
            if new_mode == 5:
                reset_rate()  # Set rate to 80 ppm
                current_a_output = 20.0  # Set A output to 20 mA
                current_v_output = 25.0  # Set V output to 25 mA
            return jsonify({'success': True, 'mode': current_mode})
        else:
            return jsonify({'error': 'Invalid mode value'}), 400
    return jsonify({'error': 'No mode provided'}), 400

# health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    global up_button_pressed, down_button_pressed, left_button_pressed, emergency_button_pressed
    
    # Create response data
    status_data = {
        'status': 'ok',
        'rate': current_rate,
        'a_output': current_a_output,
        'v_output': current_v_output,
        'locked': is_locked,
        'mode': current_mode,
        'a_sensitivity': a_sensitivity,  # Add this
        'v_sensitivity': v_sensitivity,  # Add this
        'active_control': active_control,  # Add this
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
    print(f"Mode Output encoder on pins CLK=8, DT=7 (initial value: {current_mode_output})")
    print(f"Lock button on pin GPIO 17 (initial state: {'Locked' if is_locked else 'Unlocked'})")
    print(f"Up button on pin GPIO 26")
    print(f"Down button on pin GPIO 14")
    print(f"Left button on pin GPIO 8")
    print(f"Emergency DOO button on pin GPIO 23")
    app.run(host='0.0.0.0', port=5000, debug=False)