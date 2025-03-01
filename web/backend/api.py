from flask import Flask, jsonify, request
from flask_cors import CORS
import time
import threading
import json
import os
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

try:
    import RPi.GPIO as GPIO
    RPI_AVAILABLE = True
    logger.info("RPi.GPIO module successfully imported - Hardware connection possible")
except ImportError:
    logger.warning("RPi.GPIO not available. Running in mock mode.")
    RPI_AVAILABLE = False

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for cross-origin requests from frontend

# Disable Flask's default logging to reduce noise
import logging
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

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
    "current_clk": None,
    "current_dt": None,
    "last_button_time": 0,
    "is_running": False,
    "rotation_count": 0,
    "button_press_count": 0
}

# Mutex for thread-safe state updates
state_lock = threading.Lock()

# Counter for debugging
request_counter = 0

# GPIO setup function
def setup_gpio():
    if not RPI_AVAILABLE:
        logger.warning("Cannot set up GPIO - hardware not available")
        return False
    
    try:
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(CLK_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        GPIO.setup(DT_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        GPIO.setup(SW_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        
        # Set initial state and log pin values
        encoder_state["last_clk"] = GPIO.input(CLK_PIN)
        encoder_state["current_clk"] = encoder_state["last_clk"]
        encoder_state["current_dt"] = GPIO.input(DT_PIN)
        
        logger.info(f"GPIO setup complete - Initial pin values: CLK={encoder_state['current_clk']}, DT={encoder_state['current_dt']}, SW={GPIO.input(SW_PIN)}")
        
        # Set up button event detection
        GPIO.add_event_detect(
            SW_PIN, 
            GPIO.FALLING, 
            callback=button_callback, 
            bouncetime=300
        )
        logger.info("Button event detection enabled")
        
        return True
    except Exception as e:
        logger.error(f"Error setting up GPIO: {e}")
        return False

# Button press callback
def button_callback(channel):
    with state_lock:
        # Debounce
        current_time = time.time()
        if current_time - encoder_state["last_button_time"] < 0.3:
            return
        encoder_state["last_button_time"] = current_time
        encoder_state["button_press_count"] += 1
        
        # Cycle through active controls
        if pacemaker_state["active_control"] == "rate":
            pacemaker_state["active_control"] = "a_output"
        elif pacemaker_state["active_control"] == "a_output":
            pacemaker_state["active_control"] = "v_output"
        else:
            pacemaker_state["active_control"] = "rate"
        
        logger.info(f"Button pressed (count: {encoder_state['button_press_count']}) - Active control switched to: {pacemaker_state['active_control']}")

# Function to read encoder and update state
def read_encoder():
    if not RPI_AVAILABLE:
        return
    
    clk = GPIO.input(CLK_PIN)
    dt = GPIO.input(DT_PIN)
    
    encoder_state["current_clk"] = clk
    encoder_state["current_dt"] = dt
    
    # If CLK state changed, rotation detected
    if clk != encoder_state["last_clk"]:
        # Clockwise if CLK and DT differ, counter-clockwise if they match
        direction = 1 if dt != clk else -1
        encoder_state["rotation_count"] += 1
        
        logger.info(f"Encoder rotation detected (count: {encoder_state['rotation_count']}) - CLK={clk}, DT={dt}, Direction={direction}")
        
        with state_lock:
            adjust_value(direction)
    
    encoder_state["last_clk"] = clk

# Adjust the active control value
def adjust_value(direction):
    control = pacemaker_state["active_control"]
    old_value = pacemaker_state[control]
    
    if control == "rate":
        # Rate adjustment - step by 5 ppm
        step = 5
        new_value = pacemaker_state["rate"] + (direction * step)
        pacemaker_state["rate"] = max(RATE_LIMITS[0], min(RATE_LIMITS[1], new_value))
        
    elif control == "a_output":
        # A. Output adjustment - step by 0.5 mA
        step = 0.5
        new_value = pacemaker_state["a_output"] + (direction * step)
        pacemaker_state["a_output"] = max(A_OUTPUT_LIMITS[0], min(A_OUTPUT_LIMITS[1], new_value))
        
    elif control == "v_output":
        # V. Output adjustment - step by 0.5 mA
        step = 0.5
        new_value = pacemaker_state["v_output"] + (direction * step)
        pacemaker_state["v_output"] = max(V_OUTPUT_LIMITS[0], min(V_OUTPUT_LIMITS[1], new_value))
    
    logger.info(f"{control.upper()} adjusted: {old_value} → {pacemaker_state[control]} ({direction > 0 and 'increase' or 'decrease'})")

# API routes
@app.route('/api/status', methods=['GET'])
def get_status():
    """Return the current status of the encoder API"""
    global request_counter
    request_counter += 1
    
    if request_counter % 10 == 0:  # Log every 10th request to reduce output
        logger.info(f"Status request #{request_counter} received")
    
    hardware_status = {
        "gpio_available": RPI_AVAILABLE,
        "encoder_running": encoder_state["is_running"],
        "pin_values": {
            "clk": encoder_state["current_clk"],
            "dt": encoder_state["current_dt"],
            "button": None  # Can't read continuously due to event detection
        },
        "rotation_count": encoder_state["rotation_count"],
        "button_press_count": encoder_state["button_press_count"]
    }
    
    if RPI_AVAILABLE:
        try:
            # Try to read button state
            hardware_status["pin_values"]["button"] = GPIO.input(SW_PIN)
        except:
            pass
    
    response = {
        "status": "running",
        "hardware": hardware_status,
        "request_counter": request_counter
    }
    return jsonify(response)

@app.route('/api/controls', methods=['GET'])
def get_controls():
    """Return the current pacemaker control values"""
    global request_counter
    request_counter += 1
    
    with state_lock:
        controls_copy = pacemaker_state.copy()
    
    if request_counter % 10 == 0:  # Log every 10th request
        logger.info(f"Controls request #{request_counter} received - Current values: rate={controls_copy['rate']}, a_output={controls_copy['a_output']}, v_output={controls_copy['v_output']}")
    
    return jsonify(controls_copy)

@app.route('/api/controls', methods=['POST'])
def set_controls():
    """Update the pacemaker control values from the frontend"""
    data = request.json
    logger.info(f"POST request received to update controls: {data}")
    
    with state_lock:
        if "rate" in data:
            pacemaker_state["rate"] = max(RATE_LIMITS[0], min(RATE_LIMITS[1], data["rate"]))
        
        if "a_output" in data:
            pacemaker_state["a_output"] = max(A_OUTPUT_LIMITS[0], min(A_OUTPUT_LIMITS[1], data["a_output"]))
        
        if "v_output" in data:
            pacemaker_state["v_output"] = max(V_OUTPUT_LIMITS[0], min(V_OUTPUT_LIMITS[1], data["v_output"]))
        
        if "active_control" in data and data["active_control"] in ["rate", "a_output", "v_output"]:
            pacemaker_state["active_control"] = data["active_control"]
        
        logger.info(f"Controls updated to: {pacemaker_state}")
    
    return jsonify({"success": True, "controls": pacemaker_state})

# Debug endpoint to check hardware
@app.route('/api/debug/hardware', methods=['GET'])
def debug_hardware():
    """Return detailed hardware status information"""
    hardware_info = {
        "rpi_available": RPI_AVAILABLE,
        "encoder_state": encoder_state,
        "gpio_pins": {
            "clk_pin": CLK_PIN,
            "dt_pin": DT_PIN,
            "sw_pin": SW_PIN
        }
    }
    
    if RPI_AVAILABLE:
        try:
            hardware_info["current_readings"] = {
                "clk": GPIO.input(CLK_PIN),
                "dt": GPIO.input(DT_PIN),
                "sw": GPIO.input(SW_PIN)
            }
        except Exception as e:
            hardware_info["error"] = str(e)
    
    return jsonify(hardware_info)

# Debug endpoint to test control updates
@app.route('/api/debug/simulate', methods=['GET'])
def simulate_rotation():
    """Simulate an encoder rotation for testing"""
    direction = request.args.get('direction', '1')
    try:
        direction = int(direction)
    except:
        direction = 1
    
    logger.info(f"Simulating encoder rotation: direction={direction}")
    
    with state_lock:
        adjust_value(direction)
    
    return jsonify({
        "success": True,
        "message": f"Simulated rotation with direction {direction}",
        "updated_state": pacemaker_state
    })

# Mock encoder functionality for testing without actual hardware
def mock_encoder_thread():
    """Simulate encoder inputs using keyboard for testing"""
    logger.info("Running in MOCK MODE with simulated encoder")
    logger.info("Use keyboard controls: Arrow Up/Down to adjust values, Tab to switch controls")
    
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
            logger.info(f"Mock: Active control switched to {pacemaker_state['active_control']}")
        
        def on_up():
            with state_lock:
                adjust_value(1)
            logger.info(f"Mock: Increased {pacemaker_state['active_control']} to {pacemaker_state[pacemaker_state['active_control']]}")
        
        def on_down():
            with state_lock:
                adjust_value(-1)
            logger.info(f"Mock: Decreased {pacemaker_state['active_control']} to {pacemaker_state[pacemaker_state['active_control']]}")
        
        keyboard.on_press_key("tab", lambda _: on_tab())
        keyboard.on_press_key("up", lambda _: on_up())
        keyboard.on_press_key("down", lambda _: on_down())
        
        # Keep the thread running
        while True:
            time.sleep(0.1)
            
    except ImportError:
        logger.warning("Keyboard module not available for mock encoder")
        logger.info("Please install with: pip install keyboard")
        
        # Fallback to periodic value changes for testing
        while True:
            time.sleep(5)
            with state_lock:
                logger.info("Mock: Simulating automatic value change for testing")
                adjust_value(1)

# Main encoder reading thread
def encoder_thread():
    """Thread for continuously reading the rotary encoder"""
    if RPI_AVAILABLE:
        logger.info("Hardware encoder thread started")
        encoder_state["is_running"] = True
        
        try:
            while True:
                read_encoder()
                time.sleep(0.001)  # Small delay to prevent CPU overuse
        except Exception as e:
            logger.error(f"Encoder thread error: {e}")
        finally:
            encoder_state["is_running"] = False
            logger.info("Encoder thread stopped")
    else:
        mock_encoder_thread()

# Start the application
def start_app():
    """Initialize and start the encoder API"""
    # Setup GPIO if available
    if RPI_AVAILABLE:
        logger.info("Setting up GPIO for hardware encoder...")
        success = setup_gpio()
        if not success:
            logger.warning("Failed to set up GPIO, running in mock mode")
    
    # Start encoder reading in a separate thread
    thread = threading.Thread(target=encoder_thread, daemon=True)
    thread.start()
    logger.info("Encoder monitoring thread started")
    
    # Save initial state
    try:
        save_state()
        logger.info("Initial state saved")
    except Exception as e:
        logger.error(f"Could not save initial state: {e}")
    
    # Start Flask app
    logger.info("Starting Flask API server on port 8080")
    app.run(host='0.0.0.0', port=8080, debug=False, threaded=True)

# Save/load state to maintain settings between restarts
def save_state():
    """Save current state to a file"""
    try:
        with open('pacemaker_state.json', 'w') as f:
            json.dump(pacemaker_state, f)
    except Exception as e:
        logger.error(f"Error saving state: {e}")

def load_state():
    """Load saved state from file if available"""
    try:
        if os.path.exists('pacemaker_state.json'):
            with open('pacemaker_state.json', 'r') as f:
                state = json.load(f)
                for key, value in state.items():
                    if key in pacemaker_state:
                        pacemaker_state[key] = value
            logger.info(f"Loaded state from file: {pacemaker_state}")
        else:
            logger.info("No saved state file found, using defaults")
    except Exception as e:
        logger.error(f"Error loading state: {e}")

# Clean up GPIO on exit
def cleanup():
    """Clean up GPIO pins when program exits"""
    if RPI_AVAILABLE:
        try:
            GPIO.cleanup()
            logger.info("GPIO pins cleaned up")
        except:
            pass

# Main entry point
if __name__ == '__main__':
    logger.info("=== Pacemaker Encoder API Starting ===")
    logger.info(f"Hardware mode: {'Available' if RPI_AVAILABLE else 'NOT Available (Running in Mock Mode)'}")
    
    try:
        # Load previously saved state
        load_state()
        # Start the application
        start_app()
    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received, stopping...")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
    finally:
        # Save state and clean up
        logger.info("Shutting down...")
        save_state()
        cleanup()
        logger.info("=== Pacemaker Encoder API Stopped ===")