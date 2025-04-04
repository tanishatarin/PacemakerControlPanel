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

# Set up the Lock Button (from the screenshot, using GPIO 17)
lock_button = Button(17, bounce_time=0.05)  # Reduced bounce time for faster response

# Set up the Up & down Button  (using GPIO 26, 14)
up_button = Button(26, bounce_time=0.05)  # Added up button on pin 26
down_button = Button(14, bounce_time=0.05)  # Add down button on pin 14

# Set up LED for lock indicator (use GPIO 18 as shown in your screenshot)
# lock_led = LED(18)  # GPIO pin for the LED

# Initial values
rate_encoder.steps = 80
current_rate = 80

a_output_encoder.steps = 100  # 10.0 mA initially
current_a_output = 10.0

v_output_encoder.steps = 100  # 10.0 mA initially
current_v_output = 10.0

# Lock state
is_locked = False

# Min/max values
min_rate = 30
max_rate = 200

min_a_output = 0.0
max_a_output = 20.0

min_v_output = 0.0
max_v_output = 25.0

# Track last encoder position for outputs
last_a_output_steps = 100
last_v_output_steps = 100

# up button state
up_button_pressed = False
last_up_press_time = 0

# down button state
down_button_pressed = False
last_down_press_time = 0

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

# Function to update the current rate value
def update_rate():
    global current_rate
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



# API endpoints for Lock status
@app.route('/api/lock', methods=['GET'])
def get_lock():
    return jsonify({
        'locked': is_locked
    })

# @app.route('/api/lock/toggle', methods=['POST'])
# def set_lock():
#     global is_locked
#     is_locked = not is_locked
    
#     # Update LED based on lock state
#     if is_locked:
#         lock_led.on()
#     else:
#         lock_led.off()
        
#     print(f"Lock state toggled via API: {'Locked' if is_locked else 'Unlocked'}")
#     return jsonify({'success': True, 'locked': is_locked})
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

@app.route('/api/rate/set', methods=['POST'])
def set_rate():
    global current_rate
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
    update_a_output()
    return jsonify({
        'value': current_a_output,
        'min': min_a_output,
        'max': max_a_output
    })

@app.route('/api/a_output/set', methods=['POST'])
def set_a_output():
    global current_a_output, last_a_output_steps
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
    update_v_output()
    return jsonify({
        'value': current_v_output,
        'min': min_v_output,
        'max': max_v_output
    })

@app.route('/api/v_output/set', methods=['POST'])
def set_v_output():
    global current_v_output, last_v_output_steps
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

# health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    global up_button_pressed, down_button_pressed
    status_data = {
        'status': 'ok',
        'rate': current_rate,
        'a_output': current_a_output,
        'v_output': current_v_output,
        'locked': is_locked,
        'buttons': {
            'up_pressed': up_button_pressed,
            'down_pressed': down_button_pressed
        }
    }
    
    # Reset the flags after reporting
    was_up_pressed = up_button_pressed
    was_down_pressed = down_button_pressed
    up_button_pressed = False
    down_button_pressed = False
    
    if was_up_pressed:
        print("Reporting up button press via health check")
    if was_down_pressed:
        print("Reporting down button press via health check")
        
    return jsonify(status_data)


# API endpoint to get hardware information
@app.route('/api/hardware', methods=['GET'])
def get_hardware_info():
    global up_button_pressed, down_button_pressed
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
                'down_pressed': down_button_pressed
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
    app.run(host='0.0.0.0', port=5000, debug=False)