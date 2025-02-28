import { WebSocketServer, WebSocket } from 'ws';
import { createRequire } from 'module';

// Create a require function for importing CommonJS modules
const require = createRequire(import.meta.url);

// Set up WebSocket server
const wss = new WebSocketServer({ port: 8080 });
console.log('WebSocket server running on port 8080');

// Set up GPIO pins - using the same pins as in your Python reference code
let clkPin, dtPin, buttonPin;
let simulationMode = false;

try {
  // Try to import the 'onoff' module
  const Gpio = require('onoff').Gpio;
  
  // GPIO 27 for CLK, GPIO 22 for DT, GPIO 25 for button
  clkPin = new Gpio(27, 'in', 'both');
  dtPin = new Gpio(22, 'in', 'both');
  buttonPin = new Gpio(25, 'in', 'both');
  console.log('GPIO pins initialized successfully');
  
  // Initial state reading
  console.log(`Initial CLK state: ${clkPin.readSync()}`);
  console.log(`Initial DT state: ${dtPin.readSync()}`);
  console.log(`Initial Button state: ${buttonPin.readSync()}`);
} catch (error) {
  console.error('Error initializing GPIO pins:', error);
  console.log('Running in mock mode with minimal simulation for testing');
  simulationMode = true;
  
  // Create mock GPIO for testing without hardware
  class MockGpio {
    constructor() {
      this.value = 0;
      this.callbacks = [];
    }
    
    readSync() {
      return this.value;
    }
    
    writeSync(value) {
      this.value = value;
    }
    
    watch(callback) {
      this.callbacks.push(callback);
    }
    
    trigger(value) {
      this.value = value;
      this.callbacks.forEach(cb => cb(null, value));
    }
    
    unexport() {
      // Do nothing
    }
  }
  
  clkPin = new MockGpio();
  dtPin = new MockGpio();
  buttonPin = new MockGpio();
  
  // Add minimal simulation for testing - one rotation every 10 seconds
  // This helps confirm the server is working
  setInterval(() => {
    console.log("Simulating a single clockwise rotation");
    
    // Simulate CLK going from 0 to 1
    clkPin.trigger(1);
    // Simulate DT staying at 0 (for clockwise)
    dtPin.trigger(0);
    
    // Wait 50ms
    setTimeout(() => {
      // Simulate CLK going back to 0
      clkPin.trigger(0);
    }, 50);
  }, 10000);
}

// Encoder state variables
let value = 30; // Initial value as in your Python code
let clkLastState = clkPin.readSync();
let dtLastState = dtPin.readSync();
let lastEncoderTime = Date.now();

console.log(`Starting value: ${value}`);
console.log(`Initial CLK last state: ${clkLastState}`);
console.log(`Initial DT last state: ${dtLastState}`);

// Debounce time (milliseconds)
const DEBOUNCE_MS = 5;  // Reduced debounce time for better responsiveness

// WebSocket connections management
wss.on('connection', (ws) => {
  console.log('Client connected');
  
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
        console.log(`Value set manually to: ${value}`);
        broadcastValue();
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
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

// Watch for encoder CLK pin changes with improved direction detection
clkPin.watch((err, clkState) => {
  if (err) {
    console.error('Error with CLK pin:', err);
    return;
  }
  
  // Print raw state changes for debugging
  console.log(`CLK changed to: ${clkState}, DT is: ${dtPin.readSync()}`);
  
  // Check if enough time has passed since last event (debounce)
  const now = Date.now();
  if (now - lastEncoderTime < DEBOUNCE_MS) {
    console.log(`Debounced: too soon (${now - lastEncoderTime}ms)`);
    return;
  }
  lastEncoderTime = now;
  
  // Read current DT pin state
  const dtState = dtPin.readSync();
  
  // Only process when CLK state changes
  if (clkState !== clkLastState) {
    console.log(`CLK state changed from ${clkLastState} to ${clkState}`);
    
    if (clkState === 0) {  // Falling edge of CLK
      // Determine direction based on DT state
      if (dtState !== clkState) {
        // DT is different from CLK - this is clockwise (right)
        const oldValue = value;
        value = Math.min(200, value + 1);  // Always increment by 1
        console.log(`Clockwise (right), value changed from ${oldValue} to ${value}`);
      } else {
        // DT is same as CLK - this is counter-clockwise (left)
        const oldValue = value;
        value = Math.max(30, value - 1);  // Always decrement by 1
        console.log(`Counter-clockwise (left), value changed from ${oldValue} to ${value}`);
      }
      
      // Broadcast new value to all clients
      broadcastValue();
    } else {
      console.log('CLK rising edge - no action taken');
    }
  } else {
    console.log('Duplicate CLK state - ignored');
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
  
  console.log(`Button state changed to: ${state}`);
  
  if (state === 1) {
    // Button pressed - reset to 30
    console.log('Button pressed, resetting to 30');
    value = 30;
    broadcastValue();
  }
});

// Keep track of clients
setInterval(() => {
  const clientCount = [...wss.clients].length;
  console.log(`Active connections: ${clientCount}`);
  if (clientCount > 0) {
    console.log(`Current value: ${value}`);
  }
}, 5000);

// Clean up GPIO on server shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  clkPin.unexport();
  dtPin.unexport();
  buttonPin.unexport();
  console.log('GPIO pins cleaned up');
  process.exit();
});

console.log('Server setup complete. Waiting for encoder signals...');