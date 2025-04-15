from flask import Flask, jsonify, request
from flask_cors import CORS
from gpiozero import RotaryEncoder, Button, LED
import time
import json
import threading
import socket
import base64
import hashlib
import struct

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# WebSocket server configuration
WS_PORT = 5001
connected_clients = []

# Use your existing encoder and button setup from pacemaker_server.py
rate_encoder = RotaryEncoder(27, 22, max_steps=200, wrap=False)
a_output_encoder = RotaryEncoder(21, 20, max_steps=200, wrap=False)
v_output_encoder = RotaryEncoder(13, 6, max_steps=200, wrap=False)
mode_output_encoder = RotaryEncoder(10, 9, max_steps=200, wrap=False)
lock_button = Button(17, bounce_time=0.05)
up_button = Button(26, bounce_time=0.05)
down_button = Button(16, bounce_time=0.05)
left_button = Button(18, bounce_time=0.05)
emergency_button = Button(23, bounce_time=0.05)

# Initial values
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

# Add this near the start of the main code
def initialize_encoder_trackers():
    # Set initial tracking values for encoders
    if not hasattr(update_rate, 'last_steps'):
        update_rate.last_steps = rate_encoder.steps
    
    if not hasattr(update_mode_output, 'last_steps'):
        update_mode_output.last_steps = mode_output_encoder.steps
    
    print(f"Initialized mode encoder tracking: steps={mode_output_encoder.steps}")

# Call this function before starting the server
initialize_encoder_trackers()


# Copy all the handler functions and other code from your original pacemaker_server.py
def handle_down_button():
    global last_down_press_time, down_button_pressed, current_state
    current_time = time.time()
    
    # Debounce logic - only register a press if it's been at least 300ms since the last one
    if current_time - last_down_press_time > 0.3:
        last_down_press_time = current_time
        down_button_pressed = True
        current_state["lastUpdate"] = time.time()
        print("Down button pressed")


def handle_up_button():
    global last_up_press_time, up_button_pressed, current_state
    current_time = time.time()
    
    # Debounce logic - only register a press if it's been at least 300ms since the last one
    if current_time - last_up_press_time > 0.3:
        last_up_press_time = current_time
        up_button_pressed = True
        current_state["lastUpdate"] = time.time()
        print("Up button pressed")
        
        
def handle_left_button():
    global last_left_press_time, left_button_pressed, current_state
    current_time = time.time()
    
    # Debounce logic - only register a press if it's been at least 300ms since the last one
    if current_time - last_left_press_time > 0.3:
        last_left_press_time = current_time
        left_button_pressed = True
        current_state["lastUpdate"] = time.time()
        print("Left button pressed")

def handle_emergency_button():
    global last_emergency_press_time, emergency_button_pressed, current_state
    current_time = time.time()
    
    # Debounce logic - only register a press if it's been at least 300ms since the last one
    if current_time - last_emergency_press_time > 0.3:
        last_emergency_press_time = current_time
        emergency_button_pressed = True
        current_state["lastUpdate"] = time.time()
        print("Emergency button pressed")

# Function to update the current rate value
def update_rate():
    global current_rate, current_state

    if is_locked:
        return

    # Get current steps
    current_steps = rate_encoder.steps

    # Initialize tracking
    if not hasattr(update_rate, 'last_steps'):
        update_rate.last_steps = current_steps
        return

    # Compute delta
    step_diff = current_steps - update_rate.last_steps

    # Sanity check: encoder reports a weird jump?
    if abs(step_diff) > 10:
        print(f"[Rate Encoder] Ignoring jump: {step_diff} steps")
        update_rate.last_steps = current_steps
        return

    if step_diff != 0:
        new_rate = current_rate + step_diff
        new_rate = max(min_rate, min(new_rate, max_rate))
        current_rate = new_rate

        # Update state
        current_state["rate"] = current_rate
        current_state["lastUpdate"] = time.time()

        print(f"Rate updated: {current_rate} (Δ {step_diff})")

    update_rate.last_steps = current_steps


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
    global current_a_output, last_a_output_steps, current_state
    
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
        
        # Update state
        current_state["a_output"] = current_a_output
        current_state["lastUpdate"] = time.time()
        
        print(f"A. Output updated: {current_a_output} mA (step size: {step_size}, diff: {diff})")

# Function to update the current V. Output value
def update_v_output():
    global current_v_output, last_v_output_steps, current_state
    
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
        
        # Update state
        current_state["v_output"] = current_v_output
        current_state["lastUpdate"] = time.time()
        
        print(f"V. Output updated: {current_v_output} mA (step size: {step_size}, diff: {diff})")

def update_mode_output():
    global a_sensitivity, v_sensitivity, active_control, mode_output_encoder, last_mode_encoder_activity, encoder_activity_flag, current_state
    # Add this at the start of update_mode_output
    print(f"Mode encoder update called, steps={mode_output_encoder.steps}")
    
    # Skip if locked or no active control
    if is_locked or active_control == 'none':
        return
    
    # Get current steps
    current_steps = mode_output_encoder.steps
    
    # Initialize tracking if needed
    if not hasattr(update_mode_output, 'last_steps'):
        update_mode_output.last_steps = current_steps
        print(f"Initialized mode encoder tracking: steps={current_steps}")
        return
    
    # Calculate difference
    step_diff = current_steps - update_mode_output.last_steps
    
    # Only process if there's actual movement
    if step_diff == 0:
        return
    
    # Sanity check: encoder reports a weird jump?
    if abs(step_diff) > 10:
        print(f"[Mode Encoder] Ignoring jump: {step_diff} steps")
        update_mode_output.last_steps = current_steps
        return
    
    # Update activity timestamp and set flag
    last_mode_encoder_activity = time.time()
    encoder_activity_flag = True
    
    # Update tracking immediately to prevent multiple processing
    last_steps = update_mode_output.last_steps
    update_mode_output.last_steps = current_steps
    
    print(f"Mode encoder movement detected: {step_diff} steps")
    
    # Process based on control type
    if active_control == 'a_sensitivity':
        # Use step_diff directly instead of comparing again
        process_a_sensitivity_change(step_diff)
    elif active_control == 'v_sensitivity':
        process_v_sensitivity_change(step_diff)

# Helper functions to make the code cleaner
def process_a_sensitivity_change(step_diff):
    global a_sensitivity, current_state
    
    # Clockwise - decrease, counter-clockwise - increase
    if step_diff > 0:  # Clockwise
        if a_sensitivity > min_a_sensitivity:
            a_sensitivity = max(min_a_sensitivity, a_sensitivity - 0.1)
        elif a_sensitivity == min_a_sensitivity:
            a_sensitivity = 0  # ASYNC
    else:  # Counter-clockwise
        if a_sensitivity == 0:
            a_sensitivity = min_a_sensitivity  # Come out of ASYNC
        elif a_sensitivity < max_a_sensitivity:
            a_sensitivity = min(max_a_sensitivity, a_sensitivity + 0.1)
            
    a_sensitivity = round(a_sensitivity, 1)
    current_state["aSensitivity"] = a_sensitivity
    current_state["lastUpdate"] = time.time()
    print(f"A Sensitivity: {a_sensitivity if a_sensitivity > 0 else 'ASYNC'}")

def process_v_sensitivity_change(step_diff):
    global v_sensitivity, current_state
    
    # Clockwise - decrease, counter-clockwise - increase
    if step_diff > 0:  # Clockwise
        if v_sensitivity > min_v_sensitivity:
            v_sensitivity = max(min_v_sensitivity, v_sensitivity - 0.2)
        elif v_sensitivity == min_v_sensitivity:
            v_sensitivity = 0  # ASYNC
    else:  # Counter-clockwise
        if v_sensitivity == 0:
            v_sensitivity = min_v_sensitivity  # Come out of ASYNC
        elif v_sensitivity < max_v_sensitivity:
            v_sensitivity = min(max_v_sensitivity, v_sensitivity + 0.2)
            
    v_sensitivity = round(v_sensitivity, 1)
    current_state["vSensitivity"] = v_sensitivity
    current_state["lastUpdate"] = time.time()
    print(f"V Sensitivity: {v_sensitivity if v_sensitivity > 0 else 'ASYNC'}")
    
def hardware_reset_mode_encoder():
    """Force reset of mode encoder state at hardware level"""
    global mode_output_encoder
    
    # Get current position
    current_steps = mode_output_encoder.steps
    
    # Force reset tracking variable
    if hasattr(update_mode_output, 'last_steps'):
        update_mode_output.last_steps = current_steps
    
    print(f"Hard reset of mode encoder to steps={current_steps}")

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
    global is_locked, current_state
    is_locked = not is_locked
    
    # Update state
    current_state["isLocked"] = is_locked
    current_state["lastUpdate"] = time.time()
    
    # Update LED based on lock state
    if is_locked:
        # lock_led.on()  # Turn on LED when locked
        print("Device LOCKED")
    else:
        # lock_led.off()  # Turn off LED when unlocked
        print("Device UNLOCKED")

# Function to reset the rate to default
def reset_rate():
    global current_rate, current_state
    rate_encoder.steps = 80
    current_rate = 80
    update_rate.last_steps = 80  # <-- ADD THIS
    current_state["rate"] = current_rate
    current_state["lastUpdate"] = time.time()
    print("Rate reset to 80 ppm!")

# Function to reset the A. Output to default
def reset_a_output():
    global current_a_output, last_a_output_steps, current_state
    a_output_encoder.steps = 100
    last_a_output_steps = 100  # tracking
    current_a_output = 10.0
    # last_a_output_steps = a_output_encoder.steps
    current_state["a_output"] = current_a_output
    current_state["lastUpdate"] = time.time()
    print("A. Output reset to 10.0 mA!")

# Function to reset the V. Output to default
def reset_v_output():
    global current_v_output, last_v_output_steps, current_state
    v_output_encoder.steps = 100
    last_v_output_steps = 100 # tracking
    current_v_output = 10.0
    # last_v_output_steps = v_output_encoder.steps
    current_state["v_output"] = current_v_output
    current_state["lastUpdate"] = time.time()
    print("V. Output reset to 10.0 mA!")

# Simple WebSocket handling functions
def parse_websocket_frame(data):
    """Parse a WebSocket frame and return the payload"""
    if len(data) < 6:
        return None

    # Get the FIN bit and opcode
    fin = (data[0] & 0x80) >> 7
    opcode = data[0] & 0x0F

    # Get the MASK bit and payload length
    mask = (data[1] & 0x80) >> 7
    payload_len = data[1] & 0x7F

    # Determine the actual payload length
    if payload_len == 126:
        mask_offset = 4
        payload_len = int.from_bytes(data[2:4], byteorder='big')
    elif payload_len == 127:
        mask_offset = 10
        payload_len = int.from_bytes(data[2:10], byteorder='big')
    else:
        mask_offset = 2

    # Get the masking key and payload
    if mask:
        masking_key = data[mask_offset:mask_offset+4]
        payload_offset = mask_offset + 4
        payload = data[payload_offset:payload_offset+payload_len]

        # Unmask the payload
        unmasked = bytearray(payload_len)
        for i in range(payload_len):
            unmasked[i] = payload[i] ^ masking_key[i % 4]
        payload = unmasked
    else:
        payload_offset = mask_offset
        payload = data[payload_offset:payload_offset+payload_len]

    # Return the payload as string for text frames
    if opcode == 0x1:  # Text frame
        return payload.decode('utf-8')
    else:
        return payload

def create_websocket_frame(data, opcode=0x1):
    """Create a WebSocket frame for the given data"""
    if isinstance(data, str):
        data = data.encode('utf-8')

    # Create the frame header
    frame = bytearray()
    frame.append(0x80 | opcode)  # FIN bit set, text frame

    # Set the payload length
    if len(data) < 126:
        frame.append(len(data))
    elif len(data) < 65536:
        frame.append(126)
        frame.extend(len(data).to_bytes(2, byteorder='big'))
    else:
        frame.append(127)
        frame.extend(len(data).to_bytes(8, byteorder='big'))

    # Add the payload
    frame.extend(data)
    return frame

def handle_websocket_handshake(client_socket):
    """Handle the WebSocket handshake"""
    try:
        # Receive the handshake request
        data = client_socket.recv(1024).decode('utf-8')
        if not data:
            return False

        # Parse the Sec-WebSocket-Key header
        key = None
        for line in data.split('\r\n'):
            if line.startswith('Sec-WebSocket-Key:'):
                key = line.split(':')[1].strip()
                break

        if not key:
            return False

        # Create the WebSocket accept key
        accept_key = key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
        accept_key = base64.b64encode(hashlib.sha1(accept_key.encode()).digest()).decode()

        # Send the handshake response
        response = (
            'HTTP/1.1 101 Switching Protocols\r\n'
            'Upgrade: websocket\r\n'
            'Connection: Upgrade\r\n'
            f'Sec-WebSocket-Accept: {accept_key}\r\n\r\n'
        )
        client_socket.sendall(response.encode())
        return True
    except Exception as e:
        print(f"Handshake error: {e}")
        return False

def handle_websocket_client(client_socket):
    """Handle communication with a WebSocket client"""
    global connected_clients, current_state

    # Perform the WebSocket handshake
    if not handle_websocket_handshake(client_socket):
        print("Handshake failed")
        try:
            client_socket.close()
        except:
            pass
        return

    # Add the client to the connected clients list
    connected_clients.append(client_socket)
    print(f"New WebSocket client connected: {client_socket.getpeername()}")

    # Send the initial state
    try:
        initial_state = json.dumps(current_state)
        client_socket.sendall(create_websocket_frame(initial_state))
    except Exception as e:
        print(f"Error sending initial state: {e}")

    # Process client messages
    client_auth_token = None
    try:
        while True:
            try:
                # Set a timeout for receive operations
                client_socket.settimeout(0.5)
                data = client_socket.recv(1024)
                if not data:
                    break

                # Parse the WebSocket frame
                message = parse_websocket_frame(data)
                if not message:
                    continue

                # Process the message as JSON
                try:
                    parsed = json.loads(message)
                    
                    # Handle authentication
                    if 'token' in parsed:
                        client_auth_token = parsed['token']
                        print(f"Client authenticated with token: {client_auth_token}")
                        
                        # Send confirmation
                        response = json.dumps({
                            "type": "info",
                            "message": "Authentication successful"
                        })
                        client_socket.sendall(create_websocket_frame(response))
                    
                    # Handle control updates
                    elif 'type' in parsed and parsed['type'] == 'control_update' and 'updates' in parsed:
                        # Check if this is an admin token or allow sensitivity updates for all
                        if client_auth_token == 'pacemaker_token_123':
                            # Admin can update everything
                            apply_control_updates(parsed['updates'])
                            response = json.dumps({
                                "type": "info",
                                "message": "Control updated successfully"
                            })
                            client_socket.sendall(create_websocket_frame(response))
                        elif client_auth_token and ('vSensitivity' in parsed['updates'] or 'aSensitivity' in parsed['updates']):
                            # Non-admin can only update sensitivity
                            updates = {
                                k: v for k, v in parsed['updates'].items() 
                                if k in ['vSensitivity', 'aSensitivity']
                            }
                            apply_control_updates(updates)
                            response = json.dumps({
                                "type": "info",
                                "message": "Sensitivity updated successfully"
                            })
                            client_socket.sendall(create_websocket_frame(response))
                        else:
                            # Unauthorized
                            response = json.dumps({
                                "type": "error",
                                "message": "Unauthorized control update"
                            })
                            client_socket.sendall(create_websocket_frame(response))
                except json.JSONDecodeError:
                    print(f"Invalid JSON from client: {message}")

            except socket.timeout:
                # This is just a timeout on the socket.recv - continue the loop
                pass
            except Exception as e:
                print(f"Error processing client message: {e}")
                break

    except Exception as e:
        print(f"WebSocket client error: {e}")
    finally:
        if client_socket in connected_clients:
            connected_clients.remove(client_socket)
        try:
            client_socket.close()
        except:
            pass
        print(f"WebSocket client disconnected")

def apply_control_updates(updates):
    """Apply updates from client to the current state"""
    global current_state, a_sensitivity, v_sensitivity, current_rate, current_a_output, current_v_output, is_locked
    
    # Only apply specific updates that we support
    if 'aSensitivity' in updates:
        a_sensitivity = float(updates['aSensitivity'])
        current_state["aSensitivity"] = a_sensitivity
    
    if 'vSensitivity' in updates:
        v_sensitivity = float(updates['vSensitivity'])
        current_state["vSensitivity"] = v_sensitivity
    
    if 'rate' in updates:
        current_rate = int(updates['rate'])
        current_state["rate"] = current_rate
        rate_encoder.steps = current_rate
        if hasattr(update_rate, 'last_steps'):
            update_rate.last_steps = current_rate

    if 'a_output' in updates:
        current_a_output = float(updates['a_output'])
        current_state["a_output"] = current_a_output
        a_output_encoder.steps = int(current_a_output * 10)  # Optional: depends on scale
        last_a_output_steps = a_output_encoder.steps

    if 'v_output' in updates:
        current_v_output = float(updates['v_output'])
        current_state["v_output"] = current_v_output
        v_output_encoder.steps = int(current_v_output * 10)
        last_v_output_steps = v_output_encoder.steps

    
    if 'isLocked' in updates:
        is_locked = bool(updates['isLocked'])
        current_state["isLocked"] = is_locked
    
    # Update the timestamp
    current_state["lastUpdate"] = time.time()

def broadcast_state():
    """Broadcast the current state to all WebSocket clients"""
    global connected_clients, current_state
    
    if not connected_clients:
        return
    
    # Create the message
    try:
        message = json.dumps(current_state)
        frame = create_websocket_frame(message)
        
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
    except Exception as e:
        print(f"Error broadcasting state: {e}")

def periodic_broadcast():
    """Periodically broadcast the state to all clients"""
    while True:
        try:
            # Only broadcast if there are clients connected
            if connected_clients:
                broadcast_state()
        except Exception as e:
            print(f"Error in periodic broadcast: {e}")
        time.sleep(0.1)  # Broadcast 10 times per second

def run_websocket_server():
    """Run the WebSocket server"""
    try:
        # Create a socket
        server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server_socket.bind(('0.0.0.0', WS_PORT))
        server_socket.listen(5)
        
        print(f"WebSocket server running on port {WS_PORT}")
        
        # Start a thread for periodic broadcasts
        broadcast_thread = threading.Thread(target=periodic_broadcast)
        broadcast_thread.daemon = True
        broadcast_thread.start()
        
        # Accept client connections
        while True:
            try:
                client_socket, address = server_socket.accept()
                print(f"New connection from {address}")
                
                # Handle the client in a separate thread
                client_thread = threading.Thread(target=handle_websocket_client, args=(client_socket,))
                client_thread.daemon = True
                client_thread.start()
            except Exception as e:
                print(f"Error accepting connection: {e}")
    except Exception as e:
        print(f"WebSocket server error: {e}")
    finally:
        try:
            server_socket.close()
        except:
            pass

# Attach event listeners
rate_encoder.when_rotated = update_rate
a_output_encoder.when_rotated = update_a_output
v_output_encoder.when_rotated = update_v_output
mode_output_encoder.when_rotated = update_mode_output
lock_button.when_released = toggle_lock
up_button.when_released = handle_up_button
down_button.when_released = handle_down_button
left_button.when_released = handle_left_button
emergency_button.when_released = handle_emergency_button

# New endpoint for WebSocket clients to get full state
@app.route('/api/state', methods=['GET'])
def get_full_state():
    return jsonify(current_state)

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
    # if is_locked or current_mode == 5:  # 5 = DOO mode
    if is_locked:
        return jsonify({'error': 'Device is locked '}), 403 # removed dooo mode error 
        
    reset_rate()
    return jsonify({'success': True, 'value': current_rate})

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
        # Update state
        current_state["a_output"] = current_a_output
        current_state["lastUpdate"] = time.time()
        return jsonify({'success': True, 'value': current_a_output})
    return jsonify({'error': 'No value provided'}), 400

@app.route('/api/a_output/reset', methods=['POST'])
def api_reset_a_output():
    # Check if locked
    if is_locked or current_mode == 5:  # 5 = DOO mode
        return jsonify({'error': 'Device is locked or in DOO mode'}), 403
        
    reset_a_output()
    return jsonify({'success': True, 'value': current_a_output})

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
        # Update state
        current_state["v_output"] = current_v_output
        current_state["lastUpdate"] = time.time()
        return jsonify({'success': True, 'value': current_v_output})
    return jsonify({'error': 'No value provided'}), 400

@app.route('/api/v_output/reset', methods=['POST'])
def api_reset_v_output():
    # Check if locked
    if is_locked or current_mode == 5:  # 5 = DOO mode
        return jsonify({'error': 'Device is locked or in DOO mode'}), 403
        
    reset_v_output()
    return jsonify({'success': True, 'value': current_v_output})
    
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
                # Update state
                current_state["aSensitivity"] = a_sensitivity
                current_state["lastUpdate"] = time.time()
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
                # Update state
                current_state["vSensitivity"] = v_sensitivity
                current_state["lastUpdate"] = time.time()
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
    global current_mode, current_state
    
    # Check if locked
    if is_locked:
        return jsonify({'error': 'Device is locked'}), 403
        
    data = request.json
    if 'mode' in data:
        new_mode = int(data['mode'])
        # Valid mode is between 0-7
        if 0 <= new_mode <= 7:
            current_mode = new_mode
            # Update state
            current_state["mode"] = current_mode
            current_state["lastUpdate"] = time.time()
            
            # If setting to DOO mode (5), apply emergency settings
            if new_mode == 5:
                reset_rate()  # Set rate to 80 ppm
                current_a_output = 20.0  # Set A output to 20 mA
                current_v_output = 25.0  # Set V output to 25 mA
                # Update state
                current_state["a_output"] = current_a_output
                current_state["v_output"] = current_v_output
            
            return jsonify({'success': True, 'mode': current_mode})
        else:
            return jsonify({'error': 'Invalid mode value'}), 400
    return jsonify({'error': 'No mode provided'}), 400

# health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    global up_button_pressed, down_button_pressed, left_button_pressed, emergency_button_pressed, encoder_activity_flag
    
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
        'encoder_active': encoder_activity_flag,
        'buttons': {
            'up_pressed': up_button_pressed,
            'down_pressed': down_button_pressed,
            'left_pressed': left_button_pressed,
            'emergency_pressed': emergency_button_pressed
        }
    }
    
    # Reset flags
    was_up_pressed = up_button_pressed
    was_down_pressed = down_button_pressed
    was_left_pressed = left_button_pressed
    was_emergency_pressed = emergency_button_pressed
    up_button_pressed = False
    down_button_pressed = False
    left_button_pressed = False
    emergency_button_pressed = False
    encoder_activity_flag = False
    
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
    # Start WebSocket server in a separate thread
    websocket_thread = threading.Thread(target=run_websocket_server)
    websocket_thread.daemon = True
    websocket_thread.start()
    
    # Initialize state with current values
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
    
    # Ensure mode encoder starts synced
    update_mode_output.last_steps = mode_output_encoder.steps
    
    print("Pacemaker Server Started with WebSocket support")
    print(f"WebSocket server on port {WS_PORT} for real-time data sharing")
    print(f"HTTP API server on port 5000")
    print(f"Rate encoder on pins CLK=27, DT=22 (initial value: {current_rate} ppm)")
    print(f"A. Output encoder on pins CLK=21, DT=20 (initial value: {current_a_output} mA)")
    print(f"V. Output encoder on pins CLK=13, DT=6 (initial value: {current_v_output} mA)")
    print(f"Mode Output encoder on pins CLK=8, DT=7 (initial value: {current_mode_output})")
    print(f"Lock button on pin GPIO 17 (initial state: {'Locked' if is_locked else 'Unlocked'})")
    print(f"Up button on pin GPIO 26")
    print(f"Down button on pin GPIO 14")
    print(f"Left button on pin GPIO 15")
    print(f"Emergency DOO button on pin GPIO 23")
    
    app.run(host='0.0.0.0', port=5000, debug=False)