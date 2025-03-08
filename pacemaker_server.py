from flask import Flask, jsonify, request
from flask_cors import CORS
from gpiozero import RotaryEncoder, Button
import time

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Set up the Rate rotary encoder (pins defined as in your example)
rate_encoder = RotaryEncoder(27, 22, max_steps=200, wrap=False)
# rate_button = Button(25) -- getting rid of to see if needed

# Initial value
rate_encoder.steps = 80
current_rate = 80

# Min/max values
min_rate = 30
max_rate = 200

# Function to update the current rate value
def update_rate():
    global current_rate
    current_rate = max(min_rate, min(rate_encoder.steps, max_rate))
    rate_encoder.steps = current_rate
    print(f"Rate updated: {current_rate} ppm")

# Function to reset the rate to default
def reset_rate():
    global current_rate
    rate_encoder.steps = 80
    current_rate = 80
    print("Rate reset to 80 ppm!")

# Attach event listeners
rate_encoder.when_rotated = update_rate
# rate_button.when_pressed = reset_rate --  -- getting rid of to see if needed

# API endpoints
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

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    print("Rate Encoder Server Started. Connect to /api/rate to get current value.")
    app.run(host='0.0.0.0', port=5000, debug=False)