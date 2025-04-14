from flask import Flask, jsonify, request
from flask_cors import CORS
from gpiozero import RotaryEncoder, Button, LED
import time
import json
import threading
import socket
import select

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Simple WebSocket server configuration
WS_PORT = 5001
connected_clients = []

# Use your existing encoder and button setup from pacemaker_server.py
rate_encoder = RotaryEncoder(27, 22, max_steps=200, wrap=False)
a_output_encoder = RotaryEncoder(21, 20, max_steps=200, wrap=False)
v_output_encoder = RotaryEncoder(13, 6, max_steps=200, wrap=False)
mode_output_encoder = RotaryEncoder(8, 7, max_steps=200, wrap=False)
lock_button = Button(17, bounce_time=0.05)
up_button = Button(26, bounce_time=0.05)
down_button = Button(14, bounce_time=0.05)
left_button = Button(15, bounce_time=0.05)
emergency_button = Button(23, bounce_time=0.05)


# Initial values - copied from your working server
rate_encoder.steps = 80
current_rate = 80
a_output_encoder.steps = 100
current_a_output = 10.0
v_output_encoder.steps = 100
current_v_output = 10.0
mode_output_encoder.steps = 50
current_mode_output = 5.0
a_sensitivity = 0.5
v_sensitivity = 2.0
active_control = 'none'
is_locked = False
current_mode = 0

# Min/max values
min_rate = 30
max_rate = 200
min_a_output = 0.0
max_a_output = 20.0
min_v_output = 0.0
max_v_output = 25.0
min_a_sensitivity = 0.4
max_a_sensitivity = 10.0
min_v_sensitivity = 0.8
max_v_sensitivity = 20.0

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
encoder_activity_flag = False

# Current state to be shared with WebSocket clients
current_state = {
    "rate": current_rate,
    "a_output": current_a_output,
    "v_output": current_v_output,
    "aSensitivity": a_sensitivity,
    "vSensitivity": v_sensitivity,
    "mode": current_mode,
    "isLocked": is_locked,
    "isPaused": False,
    "pauseTimeLeft": 0,
    "batteryLevel": 100,
    "lastUpdate": time.time()
}


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
# Update the step size function for more precise control at upper ranges
def get_sensitivity_step_size(value, is_a_sensitivity=True):
    if is_a_sensitivity:
        # For A sensitivity (0.4-10.0 mV)
        if value <= 1:
            return 0.1
        if value <= 2:
            return 0.2
        if value <= 5:
            return 0.5
        if value <= 9:  # Special case for approaching max
            return 1.0
        return 0.5  # Smaller steps near the maximum
    else:
        # For V sensitivity (0.8-20.0 mV)
        if value <= 1:
            return 0.2
        if value <= 3:
            return 0.5
        if value <= 10:
            return 1.0
        if value <= 18:  # Special case for approaching max
            return 2.0
        return 0.5  # Smaller steps near the maximum

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


def update_mode_output():
    global a_sensitivity, v_sensitivity, active_control, mode_output_encoder, last_mode_encoder_activity, encoder_activity_flag
    
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
    
    # Only process if there's actual movement
    if step_diff == 0:
        return
    
    # Update activity timestamp and set flag
    last_mode_encoder_activity = time.time()
    encoder_activity_flag = True
    
    # Update tracking
    update_mode_output.last_steps = current_steps
    
    # Process based on control type
    if active_control == 'a_sensitivity':
        # For A sensitivity (clockwise decreases, counter-clockwise increases)
        if step_diff > 0:  # Clockwise - decrease
            if a_sensitivity > min_a_sensitivity:
                a_sensitivity = max(min_a_sensitivity, a_sensitivity - 0.1)
            elif a_sensitivity == min_a_sensitivity:
                a_sensitivity = 0  # Set to ASYNC
        else:  # Counter-clockwise - increase
            if a_sensitivity == 0:
                a_sensitivity = min_a_sensitivity  # Come out of ASYNC
            elif a_sensitivity < max_a_sensitivity:
                a_sensitivity = min(max_a_sensitivity, a_sensitivity + 0.1)
                
        a_sensitivity = round(a_sensitivity, 1)
        print(f"A Sensitivity: {a_sensitivity if a_sensitivity > 0 else 'ASYNC'}")
    
    elif active_control == 'v_sensitivity':
        # For V sensitivity (clockwise decreases, counter-clockwise increases)
        if step_diff > 0:  # Clockwise - decrease
            if v_sensitivity > min_v_sensitivity:
                v_sensitivity = max(min_v_sensitivity, v_sensitivity - 0.2)
            elif v_sensitivity == min_v_sensitivity:
                v_sensitivity = 0  # Set to ASYNC
        else:  # Counter-clockwise - increase
            if v_sensitivity == 0:
                v_sensitivity = min_v_sensitivity  # Come out of ASYNC
            elif v_sensitivity < max_v_sensitivity:
                v_sensitivity = min(max_v_sensitivity, v_sensitivity + 0.2)
                
        v_sensitivity = round(v_sensitivity, 1)
        print(f"V Sensitivity: {v_sensitivity if v_sensitivity > 0 else 'ASYNC'}")
        

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
lock_button.when_pressed = toggle_lock
up_button.when_released = handle_up_button
down_button.when_released = handle_down_button
left_button.when_released = handle_left_button
emergency_button.when_pressed = handle_emergency_button





def broadcast_state_update(updates=None):
    """Update the current state and broadcast to all connected clients"""
    global current_state
    
    # Update the state with the new values
    if updates:
        for key, value in updates.items():
            current_state[key] = value
    
    current_state["lastUpdate"] = time.time()
    
    # Only broadcast if there are connected clients
    if not connected_clients:
        return
        
    # Create the message as a JSON string
    message = json.dumps(current_state)
    
    # Add WebSocket frame headers (simplified)
    frame = bytearray([0x81])  # Text frame
    length = len(message)
    
    if length < 126:
        frame.append(length)
    elif length < 65536:
        frame.append(126)
        frame.extend(length.to_bytes(2, byteorder='big'))
    else:
        frame.append(127)
        frame.extend(length.to_bytes(8, byteorder='big'))
    
    # Add the message content
    frame.extend(message.encode())
    
    # Send to all clients
    clients_to_remove = []
    for client in connected_clients:
        try:
            client.sendall(frame)
        except:
            clients_to_remove.append(client)
    
    # Remove disconnected clients
    for client in clients_to_remove:
        if client in connected_clients:
            connected_clients.remove(client)
            try:
                client.close()
            except:
                pass

def handle_websocket_client(client_socket):
    """Handle communication with a WebSocket client"""
    try:
        # Wait for initial handshake
        data = client_socket.recv(1024).decode('utf-8')
        
        # Basic WebSocket handshake response
        if "Upgrade: websocket" in data and "Sec-WebSocket-Key:" in data:
            # Extract the key
            key = ""
            for line in data.split('\r\n'):
                if line.startswith("Sec-WebSocket-Key:"):
                    key = line.split(': ')[1].strip()
                    break
            
            if key:
                import hashlib
                import base64
                
                # Calculate the accept key (simplified)
                accept_key = key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
                accept_key = base64.b64encode(hashlib.sha1(accept_key.encode()).digest()).decode()
                
                # Send handshake response
                handshake = (
                    "HTTP/1.1 101 Switching Protocols\r\n"
                    "Upgrade: websocket\r\n"
                    "Connection: Upgrade\r\n"
                    f"Sec-WebSocket-Accept: {accept_key}\r\n\r\n"
                )
                client_socket.sendall(handshake.encode())
                
                # Add to connected clients
                connected_clients.append(client_socket)
                print(f"WebSocket client connected: {client_socket.getpeername()}")
                
                # Send initial state
                broadcast_state_update()
                
                # Keep connection open to receive messages
                while True:
                    ready = select.select([client_socket], [], [], 1)
                    if ready[0]:
                        frame = client_socket.recv(1024)
                        if not frame:
                            break
                        
                        # Process incoming message if needed
                        # This is a simplified implementation that doesn't decode frames
                    
    except Exception as e:
        print(f"WebSocket client error: {e}")
    finally:
        if client_socket in connected_clients:
            connected_clients.remove(client_socket)
        try:
            client_socket.close()
        except:
            pass
        print("WebSocket client disconnected")

def run_websocket_server():
    """Run a simple WebSocket server"""
    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server_socket.bind(('0.0.0.0', WS_PORT))
    server_socket.listen(5)
    
    print(f"WebSocket server started on port {WS_PORT}")
    
    while True:
        try:
            client_socket, address = server_socket.accept()
            client_thread = threading.Thread(
                target=handle_websocket_client,
                args=(client_socket,),
                daemon=True
            )
            client_thread.start()
        except Exception as e:
            print(f"WebSocket server error: {e}")



# New endpoint for WebSocket clients to get full state
@app.route('/api/state', methods=['GET'])
def get_full_state():
    return jsonify(current_state)

if __name__ == '__main__':
    # Start WebSocket server in background thread
    ws_thread = threading.Thread(target=run_websocket_server, daemon=True)
    ws_thread.start()
    
    print("Pacemaker Server Started with WebSocket support")
    print(f"WebSocket server on port {WS_PORT} for real-time data sharing")
    print(f"Rate encoder on pins CLK=27, DT=22 (initial value: {current_rate} ppm)")
    print(f"A. Output encoder on pins CLK=21, DT=20 (initial value: {current_a_output} mA)")
    print(f"V. Output encoder on pins CLK=13, DT=6 (initial value: {current_v_output} mA)")
    
    # Start Flask app
    app.run(host='0.0.0.0', port=5000, debug=False)

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
    
    status_data = {
        'status': 'ok',
        'rate': current_rate,
        'a_output': current_a_output,
        'v_output': current_v_output,
        'locked': is_locked,
        'mode': current_mode,
        'buttons': {
            'up_pressed': up_button_pressed,
            'down_pressed': down_button_pressed,
            'left_pressed': left_button_pressed,
            'emergency_pressed': emergency_button_pressed
        }
    }
    
    # Reset button states
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