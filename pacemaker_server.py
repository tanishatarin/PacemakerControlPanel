from flask import Flask, jsonify, request
from flask_cors import CORS
from gpiozero import RotaryEncoder, Button
import time

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Set up the Rate rotary encoder (pins defined as in your example)
rate_encoder = RotaryEncoder(27, 22, max_steps=200, wrap=False)

# Set up the A Output rotary encoder (Clock 21, DT 20)
# Increased max_steps for finer control at lower values
a_output_encoder = RotaryEncoder(21, 20, max_steps=400, wrap=False)

# Initial values
rate_encoder.steps = 80
current_rate = 80

# For A. Output, we'll scale by 20 for increased precision
a_output_encoder.steps = 200  # 10.0 mA initially (scaled by 20)
current_a_output = 10.0

# Min/max values
min_rate = 30
max_rate = 200

min_a_output = 0.0
max_a_output = 20.0

# Track encoder rotations
rate_rotation_count = 0
a_output_rotation_count = 0

# Function to update the current rate value
def update_rate():
    global current_rate, rate_rotation_count
    current_rate = max(min_rate, min(rate_encoder.steps, max_rate))
    rate_encoder.steps = current_rate
    rate_rotation_count += 1
    print(f"Rate updated: {current_rate} ppm")

# Function to update the current A. Output value with appropriate step sizes
def update_a_output():
    global current_a_output, a_output_rotation_count
    
    # Get raw steps from encoder (0-400 range with higher resolution)
    raw_steps = a_output_encoder.steps
    
    # Ensure raw_steps is within limits
    raw_steps = max(0, min(raw_steps, 400))
    a_output_encoder.steps = raw_steps
    
    # Convert to mA value (0.0 to 20.0) - now scaled by 20 for more precision
    raw_value = raw_steps / 20
    
    # Determine step size based on current value range
    if raw_value < 0.4:
        # For values < 0.4 mA, use 0.1 mA steps
        step_size = 0.1
    elif raw_value < 1.0:
        # For values between 0.4-1.0 mA, use 0.2 mA steps
        step_size = 0.2
    elif raw_value < 5.0:
        # For values between 1.0-5.0 mA, use 0.5 mA steps
        step_size = 0.5
    else:
        # For values >= 5.0 mA, use 1.0 mA steps
        step_size = 1.0
    
    # Round to the nearest appropriate step
    current_a_output = round(raw_value / step_size) * step_size
    
    # Ensure value stays within bounds
    current_a_output = max(min_a_output, min(current_a_output, max_a_output))
    
    # Update step count in the encoder to match the quantized value
    # This prevents drift when turning the encoder slowly
    a_output_encoder.steps = int(current_a_output * 20)
    
    a_output_rotation_count += 1
    print(f"A. Output updated: {current_a_output} mA (step size: {step_size})")

# Function to reset the rate to default
def reset_rate():
    global current_rate
    rate_encoder.steps = 80
    current_rate = 80
    print("Rate reset to 80 ppm!")

# Function to reset the A. Output to default
def reset_a_output():
    global current_a_output
    a_output_encoder.steps = 200  # 10.0 mA (scaled by 20)
    current_a_output = 10.0
    print("A. Output reset to 10.0 mA!")

# Attach event listeners
rate_encoder.when_rotated = update_rate
a_output_encoder.when_rotated = update_a_output

# API endpoints for Rate
@app.route('/api/rate', methods=['GET'])
def get_rate():
    global current_rate
    # Ensure we're returning the most up-to-date value
    update_rate()
    return jsonify({
        'value': current_rate,
        'min': min_rate,
        'max': max_rate
    })

@app.route('/api/rate/set', methods=['POST'])
def set_rate():
    global current_rate
    data = request.json
    if 'value' in data:
        new_rate = int(data['value'])
        rate_encoder.steps = new_rate
        update_rate()
        return jsonify({'success': True, 'value': current_rate})
    return jsonify({'error': 'No value provided'}), 400

@app.route('/api/rate/reset', methods=['POST'])
def api_reset_rate():
    reset_rate()
    return jsonify({'success': True, 'value': current_rate})

# API endpoints for A. Output
@app.route('/api/a_output', methods=['GET'])
def get_a_output():
    global current_a_output
    # Ensure we're returning the most up-to-date value
    update_a_output()
    return jsonify({
        'value': current_a_output,
        'min': min_a_output,
        'max': max_a_output
    })

@app.route('/api/a_output/set', methods=['POST'])
def set_a_output():
    global current_a_output
    data = request.json
    if 'value' in data:
        new_a_output = float(data['value'])
        # Scale to match our increased resolution
        a_output_encoder.steps = int(new_a_output * 20)
        update_a_output()
        return jsonify({'success': True, 'value': current_a_output})
    return jsonify({'error': 'No value provided'}), 400

@app.route('/api/a_output/reset', methods=['POST'])
def api_reset_a_output():
    reset_a_output()
    return jsonify({'success': True, 'value': current_a_output})

# API endpoint for hardware status
@app.route('/api/hardware', methods=['GET'])
def get_hardware_status():
    return jsonify({
        'status': 'ok',
        'rate_encoder': {
            'pin_clk': 27,
            'pin_dt': 22,
            'current_value': current_rate,
            'rotation_count': rate_rotation_count
        },
        'a_output_encoder': {
            'pin_clk': 21,
            'pin_dt': 20,
            'current_value': current_a_output,
            'rotation_count': a_output_rotation_count
        }
    })

# Health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    print("Pacemaker Server Started")
    print(f"Rate encoder on pins CLK=27, DT=22 (initial value: {current_rate} ppm)")
    print(f"A. Output encoder on pins CLK=21, DT=20 (initial value: {current_a_output} mA)")
    app.run(host='0.0.0.0', port=5000, debug=False)