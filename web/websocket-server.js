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
  // Import the 'onoff' module for Raspberry Pi GPIO
  const Gpio = require('onoff').Gpio;
  
  // GPIO 27 for CLK, GPIO 22 for DT, GPIO 25 for button
  clkPin = new Gpio(27, 'in', 'both');
  dtPin = new Gpio(22, 'in', 'both');
  buttonPin = new Gpio(25, 'in', 'both');
  console.log('GPIO pins initialized successfully');
} catch (error) {
  console.error('Error initializing GPIO pins:', error);
  console.log('Ensure you are running this on a Raspberry Pi with onoff module');
  process.exit(1);
}

// Encoder state variables
let value = 30; // Initial value
let clkLastState = clkPin.readSync();
let dtLastState = dtPin.readSync();
let lastEncoderTime = Date.now();

// Debounce time (milliseconds)
const DEBOUNCE_MS = 10;

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

// Watch for encoder CLK pin changes with improved direction detection
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
  const dtState = dtPin.readSync();
  
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
    // value = 30;
    console.log('Button pressed?');
    broadcastValue();
  }
});

// Clean up GPIO on server shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  clkPin.unexport();
  dtPin.unexport();
  buttonPin.unexport();
  console.log('GPIO pins cleaned up');
  process.exit();
});