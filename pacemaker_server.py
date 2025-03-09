from flask import Flask, jsonify, request
from flask_cors import CORS
from gpiozero import RotaryEncoder, Button
import time

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

# Min/max values
min_rate = 30
max_rate = 200

min_a_output = 0.0
max_a_output = 20.0

# Last values to detect changes
last_a_output_steps = 100

# Function to update the current rate value
def update_rate():
    global current_rate
    current_rate = max(min_rate, min(rate_encoder.steps, max_rate))
    rate_encoder.steps = current_rate
    print(f"Rate updated: {current_rate} ppm")

# Function to update the current A. Output value
def update_a_output():
    global current_a_output, last_a_output_steps
    # Get current steps
    current_steps = a_output_encoder.steps
    
    # Ensure steps are within limits
    current_steps = max(0, min(current_steps, 200))
    a_output_encoder.steps = current_steps
    
    # Only update if steps have changed
    if current_steps != last_a_output_steps:
        # Calculate the step difference
        step_diff = current_steps - last_a_output_steps
        
        # Get the current step size based on current value
        if current_a_output < 0.4:
            step_size = 0.1
        elif current_a_output < 1.0:
            step_size = 0.2
        elif current_a_output < 5.0:
            step_size = 0.5
        else:
            step_size = 1.0
            
        # Apply the change directly to the current value
        current_a_output += step_diff * step_size / 10  # Adjust for sensitivity
        
        # Ensure value is within bounds
        current_a_output = max(min_a_output, min(current_a_output, max_a_output))
        
        # Update last steps to the current
        last_a_output_steps = current_steps
        
        print(f"A. Output updated: {current_a_output} mA (step: {step_size}, diff: {step_diff})")

# Function to reset the rate to default
def reset_rate():
    global current_rate
    rate_encoder.steps = 80
    current_rate = 80
    print("Rate reset to 80 ppm!")

# Function to reset the A. Output to default
def reset_a_output():
    global current_a_output, last_a_output_steps
    a_output_encoder.steps = 100
    last_a_output_steps = 100
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
    global current_a_output, last_a_output_steps
    data = request.json
    if 'value' in data:
        current_a_output = float(data['value'])
        # Don't change the encoder steps directly, just update the last_a_output_steps
        # to avoid inadvertent changes when turning the physical encoder
        return jsonify({'success': True, 'value': current_a_output})
    return jsonify({'error': 'No value provided'}), 400

# Health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    print("Pacemaker Server Started")
    print(f"Rate encoder on pins CLK=27, DT=22 (initial value: {current_rate} ppm)")
    print(f"A. Output encoder on pins CLK=21, DT=20 (initial value: {current_a_output} mA)")
    app.run(host='0.0.0.0', port=5000, debug=False)