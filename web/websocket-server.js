import { WebSocketServer, WebSocket } from 'ws';
import { createRequire } from 'module';

// Create a require function for importing CommonJS modules
const require = createRequire(import.meta.url);

// Set up WebSocket server
const wss = new WebSocketServer({ port: 8080 });
console.log('WebSocket server running on port 8080');

// Set up GPIO pins
let clkPin, dtPin, buttonPin;

try {
  // Try to import the 'onoff' module
  const Gpio = require('onoff').Gpio;
  
  console.log('Attempting to initialize GPIO pins...');
  
  try {
    // GPIO 27 for CLK, GPIO 22 for DT, GPIO 25 for button
    clkPin = new Gpio(27, 'in', 'both');
    dtPin = new Gpio(22, 'in', 'both');
    buttonPin = new Gpio(25, 'in', 'both');
    console.log('GPIO pins initialized successfully');
  } catch (pinError) {
    console.error('Error initializing GPIO pins:', pinError);
    console.error('Possible reasons:');
    console.error('1. Incorrect pin numbers');
    console.error('2. Insufficient permissions (try running with sudo)');
    console.error('3. Hardware not properly connected');
    process.exit(1);
  }
} catch (moduleError) {
  console.error('Failed to import onoff module:', moduleError);
  console.error('To resolve this:');
  console.error('1. Install onoff: npm install onoff');
  console.error('2. Ensure you are running on a Raspberry Pi');
  console.error('3. Check Node.js and npm installations');
  process.exit(1);
}

// Encoder state variables
let value = 30; // Initial value
let clkLastState = 0;
let dtLastState = 0;
let lastEncoderTime = Date.now();

// Debounce time (milliseconds)
const DEBOUNCE_MS = 10;

// Function to safely read pin state
function safePinRead(pin) {
  try {
    return pin.readSync();
  } catch (error) {
    console.error('Error reading pin:', error);
    return 0;
  }
}

// WebSocket connections management
wss.on('connection', (ws) => {
  console.log('WebSocket Client Connected');
  
  // Send current value immediately on connection
  ws.send(JSON.stringify({ type: 'value', value }));
  
  // Handle client messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received from client:', data);
      
      // Handle manual value update from client
      if (data.type === 'setValue') {
        value = data.value;
        console.log(`Manual value set to: ${value}`);
        broadcastValue();
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('WebSocket Client Disconnected');
  });
});

// Broadcast current value to all connected clients
function broadcastValue() {
  console.log(`Broadcasting value: ${value}`);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'value', value }));
    }
  });
}

// Fallback manual rotation testing function
function manualRotationTest() {
  console.log('Using manual rotation test mode');
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  readline.question('Enter rotation direction (r for right, l for left, b for button): ', (input) => {
    switch(input.toLowerCase()) {
      case 'r':
        value = Math.min(200, value + 1);
        console.log(`>>> Rotated right, new value: ${value}`);
        break;
      case 'l':
        value = Math.max(30, value - 1);
        console.log(`<<< Rotated left, new value: ${value}`);
        break;
      case 'b':
        value = 30;
        console.log('Button pressed - Reset value to:', value);
        break;
      default:
        console.log('Invalid input');
    }
    broadcastValue();
    manualRotationTest();
  });
}

// Primary rotation detection
try {
  // Read initial states
  clkLastState = safePinRead(clkPin);
  dtLastState = safePinRead(dtPin);

  // Watch for encoder CLK pin changes
  clkPin.watch((err, clkState) => {
    if (err) {
      console.error('Error with CLK pin:', err);
      return;
    }
    
    // Check if enough time has passed since last event (debounce)
    const now = Date.now();
    if (now - lastEncoderTime < DEBOUNCE_MS) {
      console.log('Encoder event ignored due to debounce');
      return;
    }
    lastEncoderTime = now;
    
    // Read current DT pin state
    const dtState = safePinRead(dtPin);
    
    console.log(`Encoder event - CLK: ${clkState}, DT: ${dtState}, Last CLK: ${clkLastState}`);
    
    // Only process when CLK state changes
    if (clkState !== clkLastState) {
      if (clkState === 0) {  // Falling edge of CLK
        // Determine direction based on DT state
        if (dtState !== clkState) {
          // DT is different from CLK - this is clockwise (right)
          value = Math.min(200, value + 1);  
          console.log('>>> Clockwise (right) rotation detected, new value:', value);
        } else {
          // DT is same as CLK - this is counter-clockwise (left)
          value = Math.max(30, value - 1);  
          console.log('<<< Counter-clockwise (left) rotation detected, new value:', value);
        }
        
        // Broadcast new value to all clients
        broadcastValue();
      }
    }
    
    // Update last states
    clkLastState = clkState;
    dtLastState = dtState;
  });

  // Watch for button presses
  buttonPin.watch((err, state) => {
    if (err) {
      console.error('Error with button pin:', err);
      return;
    }

    console.log(`Button press detected - State: ${state}`);
    
    // When button is pressed (assuming active high)
    if (state === 1) {
      // Reset to initial value
    //   value = 30;
      console.log('Button pressed - ?', value);
      broadcastValue();
    }
  });

} catch (watchError) {
  console.error('Error setting up pin watchers:', watchError);
  console.log('Falling back to manual rotation test mode');
  manualRotationTest();
}

// Clean up GPIO on server shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  try {
    clkPin.unexport();
    dtPin.unexport();
    buttonPin.unexport();
    console.log('GPIO pins cleaned up');
  } catch (error) {
    console.error('Error during GPIO cleanup:', error);
  }
  process.exit();
});