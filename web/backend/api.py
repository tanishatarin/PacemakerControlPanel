from flask import Flask, jsonify, request
from flask_cors import CORS
import time
import threading
import json
import os

try:
    import RPi.GPIO as GPIO
    RPI_AVAILABLE = True
except ImportError:
    print("Warning: RPi.GPIO not available. Running in mock mode.")
    RPI_AVAILABLE = False

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for cross-origin requests from frontend

# GPIO pin definitions
CLK_PIN = 27  # Encoder clock pin
DT_PIN = 22   # Encoder data pin
SW_PIN = 25   # Encoder button/switch pin

# State variables
pacemaker_state = {
    "rate": 80,
    "a_output": 10.0,
    "v_output": 10.0,
    "active_control": "rate"  # Which control is being adjusted
}

# Control limits
RATE_LIMITS = (30, 200)
A_OUTPUT_LIMITS = (0, 20)
V_OUTPUT_LIMITS = (0, 25)

# Encoder state
encoder_state = {
    "last_clk": None,
    "last_button_time": 0,
    "is_running": False
}

# Mutex for thread-safe state updates
state_lock = threading.Lock()

# GPIO setup function
def setup_gpio():
    if not RPI_AVAILABLE:
        return False
    
    try:
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(CLK_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        GPIO.setup(DT_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        GPIO.setup(SW_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        
        # Set initial state
        encoder_state["last_clk"] = GPIO.input(CLK_PIN)
        
        # Set up button event detection
        GPIO.add_event_detect(
            SW_PIN, 
            GPIO.FALLING, 
            callback=button_callback, 
            bouncetime=300
        )
        
        return True
    except Exception as e:
        print(f"Error setting up GPIO: {e}")
        return False

# Button press callback
def button_callback(channel):
    with state_lock:
        # Debounce
        current_time = time.time()
        if current_time - encoder_state["last_button_time"] < 0.3:
            return
        encoder_state["last_button_time"] = current_time
        
        # Cycle through active controls
        if pacemaker_state["active_control"] == "rate":
            pacemaker_state["active_control"] = "a_output"
        elif pacemaker_state["active_control"] == "a_output":
            pacemaker_state["active_control"] = "v_output"
        else:
            pacemaker_state["active_control"] = "rate"
        
        print(f"Active control switched to: {pacemaker_state['active_control']}")

# Function to read encoder and update state
def read_encoder():
    if not RPI_AVAILABLE:
        return
    
    clk = GPIO.input(CLK_PIN)
    dt = GPIO.input(DT_PIN)
    
    # If CLK state changed, rotation detected
    if clk != encoder_state["last_clk"]:
        # Clockwise if CLK and DT differ, counter-clockwise if they match
        direction = 1 if dt != clk else -1
        
        with state_lock:
            adjust_value(direction)
    
    encoder_state["last_clk"] = clk

# Adjust the active control value
def adjust_value(direction):
    control = pacemaker_state["active_control"]
    
    if control == "rate":
        # Rate adjustment - step by 5 ppm
        step = 5
        new_value = pacemaker_state["rate"] + (direction * step)
        pacemaker_state["rate"] = max(RATE_LIMITS[0], min(RATE_LIMITS[1], new_value))
        print(f"Rate adjusted to: {pacemaker_state['rate']} ppm")
        
    elif control == "a_output":
        # A. Output adjustment - step by 0.5 mA
        step = 0.5
        new_value = pacemaker_state["a_output"] + (direction * step)
        pacemaker_state["a_output"] = max(A_OUTPUT_LIMITS[0], min(A_OUTPUT_LIMITS[1], new_value))
        print(f"A. Output adjusted to: {pacemaker_state['a_output']} mA")
        
    elif control == "v_output":
        # V. Output adjustment - step by 0.5 mA
        step = 0.5
        new_value = pacemaker_state["v_output"] + (direction * step)
        pacemaker_state["v_output"] = max(V_OUTPUT_LIMITS[0], min(V_OUTPUT_LIMITS[1], new_value))
        print(f"V. Output adjusted to: {pacemaker_state['v_output']} mA")

# API routes
@app.route('/api/status', methods=['GET'])
def get_status():
    """Return the current status of the encoder API"""
    return jsonify({
        "status": "running",
        "rpi_available": RPI_AVAILABLE,
        "encoder_running": encoder_state["is_running"]
    })

@app.route('/api/controls', methods=['GET'])
def get_controls():
    """Return the current pacemaker control values"""
    with state_lock:
        return jsonify(pacemaker_state)

@app.route('/api/controls', methods=['POST'])
def set_controls():
    """Update the pacemaker control values from the frontend"""
    data = request.json
    
    with state_lock:
        if "rate" in data:
            pacemaker_state["rate"] = max(RATE_LIMITS[0], min(RATE_LIMITS[1], data["rate"]))
        
        if "a_output" in data:
            pacemaker_state["a_output"] = max(A_OUTPUT_LIMITS[0], min(A_OUTPUT_LIMITS[1], data["a_output"]))
        
        if "v_output" in data:
            pacemaker_state["v_output"] = max(V_OUTPUT_LIMITS[0], min(V_OUTPUT_LIMITS[1], data["v_output"]))
        
        if "active_control" in data and data["active_control"] in ["rate", "a_output", "v_output"]:
            pacemaker_state["active_control"] = data["active_control"]
    
    return jsonify({"success": True, "controls": pacemaker_state})

# Mock encoder functionality for testing without actual hardware
def mock_encoder_thread():
    """Simulate encoder inputs using keyboard for testing"""
    print("Running mock encoder. Use keyboard controls:")
    print("  Arrow Up/Down: Adjust current value")
    print("  Tab: Switch between rate, a_output, v_output")
    print("  Ctrl+C: Exit")
    
    # Only import if available for mock mode
    try:
        import keyboard
        
        def on_tab():
            if pacemaker_state["active_control"] == "rate":
                pacemaker_state["active_control"] = "a_output"
            elif pacemaker_state["active_control"] == "a_output":
                pacemaker_state["active_control"] = "v_output"
            else:
                pacemaker_state["active_control"] = "rate"
            print(f"Active control: {pacemaker_state['active_control']}")
        
        def on_up():
            with state_lock:
                adjust_value(1)
        
        def on_down():
            with state_lock:
                adjust_value(-1)
        
        keyboard.on_press_key("tab", lambda _: on_tab())
        keyboard.on_press_key("up", lambda _: on_up())
        keyboard.on_press_key("down", lambda _: on_down())
        
        # Keep the thread running
        while True:
            time.sleep(0.1)
            
    except ImportError:
        print("Keyboard module not available for mock encoder")
        print("Please install with: pip install keyboard")

# Main encoder reading thread
def encoder_thread():
    """Thread for continuously reading the rotary encoder"""
    if RPI_AVAILABLE:
        print("Encoder thread started")
        encoder_state["is_running"] = True
        
        try:
            while True:
                read_encoder()
                time.sleep(0.001)  # Small delay to prevent CPU overuse
        except Exception as e:
            print(f"Encoder thread error: {e}")
        finally:
            encoder_state["is_running"] = False
            print("Encoder thread stopped")
    else:
        mock_encoder_thread()

# Start the application
def start_app():
    """Initialize and start the encoder API"""
    # Setup GPIO if available
    if RPI_AVAILABLE:
        success = setup_gpio()
        if not success:
            print("Failed to set up GPIO, running in mock mode")
    
    # Start encoder reading in a separate thread
    thread = threading.Thread(target=encoder_thread, daemon=True)
    thread.start()
    
    # Save initial state
    try:
        save_state()
    except:
        print("Could not save initial state")
    
    # Start Flask app
    print("Starting Flask API server")
    app.run(host='0.0.0.0', port=8080, debug=False)

# Save/load state to maintain settings between restarts
def save_state():
    """Save current state to a file"""
    try:
        with open('pacemaker_state.json', 'w') as f:
            json.dump(pacemaker_state, f)
    except Exception as e:
        print(f"Error saving state: {e}")

def load_state():
    """Load saved state from file if available"""
    try:
        if os.path.exists('pacemaker_state.json'):
            with open('pacemaker_state.json', 'r') as f:
                state = json.load(f)
                for key, value in state.items():
                    if key in pacemaker_state:
                        pacemaker_state[key] = value
    except Exception as e:
        print(f"Error loading state: {e}")

# Clean up GPIO on exit
def cleanup():
    """Clean up GPIO pins when program exits"""
    if RPI_AVAILABLE:
        GPIO.cleanup()

# Main entry point
if __name__ == '__main__':
    try:
        # Load previously saved state
        load_state()
        # Start the application
        start_app()
    except KeyboardInterrupt:
        print("Stopping...")
    finally:
        # Save state and clean up
        save_state()
        cleanup()