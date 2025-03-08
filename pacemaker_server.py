# from flask import Flask, jsonify, request
# from flask_cors import CORS
# from gpiozero import RotaryEncoder, Button
# import time

# app = Flask(__name__)
# CORS(app)  # Enable CORS for all routes

# # Set up the Rate rotary encoder (pins defined as in your example)
# rate_encoder = RotaryEncoder(27, 22, max_steps=200, wrap=False)
# # rate_button = Button(25) -- getting rid of to see if needed

# # Initial value
# rate_encoder.steps = 80
# current_rate = 80

# # Min/max values
# min_rate = 30
# max_rate = 200

# # Function to update the current rate value
# def update_rate():
#     global current_rate
#     current_rate = max(min_rate, min(rate_encoder.steps, max_rate))
#     rate_encoder.steps = current_rate
#     print(f"Rate updated: {current_rate} ppm")

# # Function to reset the rate to default
# def reset_rate():
#     global current_rate
#     rate_encoder.steps = 80
#     current_rate = 80
#     print("Rate reset to 80 ppm!")

# # Attach event listeners
# rate_encoder.when_rotated = update_rate
# # rate_button.when_pressed = reset_rate --  -- getting rid of to see if needed

# # API endpoints
# @app.route('/api/rate', methods=['GET'])
# def get_rate():
#     global current_rate
#     # Ensure we're returning the most up-to-date value
#     update_rate()
#     return jsonify({
#         'value': current_rate,
#         'min': min_rate,
#         'max': max_rate
#     })

# @app.route('/api/rate/set', methods=['POST'])
# def set_rate():
#     global current_rate
#     data = request.json
#     if 'value' in data:
#         new_rate = int(data['value'])
#         rate_encoder.steps = new_rate
#         update_rate()
#         return jsonify({'success': True, 'value': current_rate})
#     return jsonify({'error': 'No value provided'}), 400

# @app.route('/api/rate/reset', methods=['POST'])
# def api_reset_rate():
#     reset_rate()
#     return jsonify({'success': True, 'value': current_rate})

# @app.route('/api/health', methods=['GET'])
# def health_check():
#     return jsonify({'status': 'ok'})

# if __name__ == '__main__':
#     print("Rate Encoder Server Started. Connect to /api/rate to get current value.")
#     app.run(host='0.0.0.0', port=5000, debug=False)










from flask import Flask, jsonify, request
from flask_cors import CORS
from gpiozero import RotaryEncoder, Button
import time
import json

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Set up the Rate rotary encoder (pins defined as in your example)
rate_encoder = RotaryEncoder(27, 22, max_steps=200, wrap=False)

# Set up the A Output rotary encoder (Clock 21, DT 20)
a_output_encoder = RotaryEncoder(21, 20, max_steps=200, wrap=False)

# Initial values
rate_encoder.steps = 80
current_rate = 80

a_output_encoder.steps = 100  # 10.0 mA initially (scaled by 10)
current_a_output = 10.0

# Default for v_output (not connected to hardware yet)
current_v_output = 10.0

# Currently active control (which encoder is being adjusted)
active_control = "rate"

# Min/max values
min_rate = 30
max_rate = 200

min_a_output = 0.0
max_a_output = 20.0

min_v_output = 0.0
max_v_output = 25.0

# Track request counter and rotations
request_counter = 0
rate_rotation_count = 0
a_output_rotation_count = 0

# Last update source for sync between frontend and backend
last_update_source = "init"

# Function to update the current rate value
def update_rate():
    global current_rate, rate_rotation_count, active_control, last_update_source
    current_rate = max(min_rate, min(rate_encoder.steps, max_rate))
    rate_encoder.steps = current_rate
    rate_rotation_count += 1
    active_control = "rate"
    last_update_source = "hardware"
    print(f"Rate updated: {current_rate} ppm")

# Function to update the current A. Output value
def update_a_output():
    global current_a_output, a_output_rotation_count, active_control, last_update_source
    # Get raw steps from encoder (0-200 range)
    raw_steps = a_output_encoder.steps
    
    # Ensure it's within our limits (0-200)
    raw_steps = max(0, min(raw_steps, 200))
    a_output_encoder.steps = raw_steps
    
    # Convert to mA value (0.0 to 20.0)
    raw_value = raw_steps / 10
    
    # Apply the step size logic from CircularControl.tsx
    if raw_value < 0.4:
        # Round to nearest 0.1
        current_a_output = round(raw_value * 10) / 10
    elif raw_value < 1:
        # Round to nearest 0.2
        current_a_output = round(raw_value * 5) / 5
    elif raw_value < 5:
        # Round to nearest 0.5
        current_a_output = round(raw_value * 2) / 2
    else:
        # Round to nearest 1.0
        current_a_output = round(raw_value)
    
    a_output_rotation_count += 1
    active_control = "a_output"
    last_update_source = "hardware"
    print(f"A. Output updated: {current_a_output} mA")

# Attach event listeners
rate_encoder.when_rotated = update_rate
a_output_encoder.when_rotated = update_a_output

# API endpoints using the new structure
@app.route('/api/controls', methods=['GET'])
def get_controls():
    global request_counter
    request_counter += 1
    return jsonify({
        'rate': current_rate,
        'a_output': current_a_output,
        'v_output': current_v_output,
        'active_control': active_control,
        'last_update_source': last_update_source
    })

@app.route('/api/controls', methods=['POST'])
def set_controls():
    global current_rate, current_a_output, current_v_output, active_control, last_update_source
    
    try:
        data = request.json
        
        # Update source to prevent feedback loops
        last_update_source = "frontend"
        
        # Update rate if provided
        if 'rate' in data:
            new_rate = int(data['rate'])
            if min_rate <= new_rate <= max_rate:
                current_rate = new_rate
                rate_encoder.steps = new_rate
                print(f"Rate set to {current_rate} ppm from frontend")
        
        # Update A. Output if provided
        if 'a_output' in data:
            new_a_output = float(data['a_output'])
            if min_a_output <= new_a_output <= max_a_output:
                current_a_output = new_a_output
                a_output_encoder.steps = int(new_a_output * 10)
                print(f"A. Output set to {current_a_output} mA from frontend")
        
        # Update V. Output if provided (no hardware yet)
        if 'v_output' in data:
            new_v_output = float(data['v_output'])
            if min_v_output <= new_v_output <= max_v_output:
                current_v_output = new_v_output
                print(f"V. Output set to {current_v_output} mA from frontend")
        
        # Update active control if provided
        if 'active_control' in data:
            active_control = data['active_control']
            print(f"Active control switched to {active_control}")
        
        return jsonify({
            'success': True,
            'rate': current_rate,
            'a_output': current_a_output,
            'v_output': current_v_output,
            'active_control': active_control
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

@app.route('/api/status', methods=['GET'])
def api_status():
    global request_counter
    request_counter += 1
    
    return jsonify({
        'status': 'ok',
        'hardware': {
            'gpio_available': True,
            'encoder_running': True,
            'rate_encoder': {
                'clk': 27,
                'dt': 22,
                'rotation_count': rate_rotation_count
            },
            'a_output_encoder': {
                'clk': 21,
                'dt': 20,
                'rotation_count': a_output_rotation_count
            },
            'button_press_count': 0,
            'last_encoder_update': int(time.time() * 1000)
        },
        'request_counter': request_counter,
        'last_update_source': last_update_source
    })

# Debug endpoints
@app.route('/api/debug/hardware', methods=['GET'])
def debug_hardware():
    return jsonify({
        'rate_encoder': {
            'pins': {'clk': 27, 'dt': 22},
            'steps': rate_encoder.steps,
            'rotation_count': rate_rotation_count
        },
        'a_output_encoder': {
            'pins': {'clk': 21, 'dt': 20},
            'steps': a_output_encoder.steps,
            'rotation_count': a_output_rotation_count
        },
        'current_values': {
            'rate': current_rate,
            'a_output': current_a_output,
            'v_output': current_v_output,
            'active_control': active_control
        }
    })

@app.route('/api/debug/simulate', methods=['GET'])
def debug_simulate():
    encoder_type = request.args.get('encoder', 'rate')
    direction = int(request.args.get('direction', 1))
    
    if encoder_type == 'rate':
        # Simulate rotation of rate encoder
        rate_encoder.steps += direction
        update_rate()
    elif encoder_type == 'a_output':
        # Simulate rotation of A. Output encoder
        a_output_encoder.steps += direction
        update_a_output()
    
    return jsonify({'success': True})

# Legacy endpoints for backward compatibility
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
    global current_rate, last_update_source
    data = request.json
    if 'value' in data:
        new_rate = int(data['value'])
        rate_encoder.steps = new_rate
        update_rate()
        return jsonify({'success': True, 'value': current_rate})
    return jsonify({'error': 'No value provided'}), 400

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
    global current_a_output, last_update_source
    data = request.json
    if 'value' in data:
        new_a_output = float(data['value'])
        a_output_encoder.steps = int(new_a_output * 10)
        update_a_output()
        return jsonify({'success': True, 'value': current_a_output})
    return jsonify({'error': 'No value provided'}), 400

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    print("Pacemaker Server Started with Rate and A. Output encoder support.")
    print(f"Rate encoder pins: CLK=27, DT=22 (initial value: {current_rate} ppm)")
    print(f"A. Output encoder pins: CLK=21, DT=20 (initial value: {current_a_output} mA)")
    print("Connect to /api/controls to interact with the pacemaker.")
    app.run(host='0.0.0.0', port=5000, debug=False)