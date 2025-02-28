import { WebSocketServer, WebSocket } from 'ws';
import { createRequire } from 'module';
import http from 'http';

// Create a require function for importing CommonJS modules
const require = createRequire(import.meta.url);

// Create an HTTP server to make WebSocket more stable
const server = http.createServer();
const wss = new WebSocketServer({ server });

console.log('Starting WebSocket server...');

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
  console.log('Running in mock mode');
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
}

// Encoder state variables
let value = 30; // Initial value as in your Python code
let clkLastState = clkPin ? clkPin.readSync() : 0;
let dtLastState = dtPin ? dtPin.readSync() : 0;
let lastEncoderTime = Date.now();

console.log(`Starting value: ${value}`);

// Debounce time (milliseconds)
const DEBOUNCE_MS = 1;  // Reduced debounce time for better responsiveness

// Very simple client tracking
let activeClients = 0;

// WebSocket connections management
wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  activeClients++;
  console.log(`Client connected from ${ip}. Active clients: ${activeClients}`);
  
  // Send current value immediately on connection
  ws.send(JSON.stringify({ type: 'value', value }));
  
  // Handle client messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
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
    activeClients--;
    console.log(`Client disconnected from ${ip}. Active clients: ${activeClients}`);
  });
  
  ws.on('error', (error) => {
    console.error(`WebSocket error for ${ip}:`, error);
  });
});

// Broadcast current value to all connected clients
function broadcastValue() {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'value', value }));
    }
  });
}

// Watch for encoder CLK pin changes with improved direction detection
if (clkPin) {
  clkPin.watch((err, clkState) => {
    if (err) {
      console.error('Error with CLK pin:', err);
      return;
    }
    
    // Check if enough time has passed since last event (debounce)
    const now = Date.now();
    if (now - lastEncoderTime < DEBOUNCE_MS) {
      return;
    }
    lastEncoderTime = now;
    
    // Read current DT pin state
    const dtState = dtPin.readSync();
    
    // Only process when CLK state changes
    if (clkState !== clkLastState) {
      if (clkState === 0) {  // Falling edge of CLK
        // Determine direction based on DT state
        if (dtState !== clkState) {
          // DT is different from CLK - this is clockwise (right)
          value = Math.min(200, value + 1);  // Always increment by 1
          console.log(`Clockwise (right), new value: ${value}`);
        } else {
          // DT is same as CLK - this is counter-clockwise (left)
          value = Math.max(30, value - 1);  // Always decrement by 1
          console.log(`Counter-clockwise (left), new value: ${value}`);
        }
        
        // Broadcast new value to all clients
        broadcastValue();
      }
    }
    
    // Update last states
    clkLastState = clkState;
    dtLastState = dtState;
  });
}

// Watch for button presses
if (buttonPin) {
  buttonPin.watch((err, state) => {
    if (err) {
      console.error('Error with button pin:', err);
      return;
    }
    
    if (state === 1) {
      // Button pressed - reset to 30
      console.log('Button pressed, resetting to 30');
      value = 30;
      broadcastValue();
    }
  });
}

// Report server status periodically
setInterval(() => {
  console.log(`Active connections: ${activeClients}`);
  if (activeClients > 0) {
    console.log(`Current value: ${value}`);
  }
}, 30000); // Every 30 seconds

// Clean up on server shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  
  if (clkPin) clkPin.unexport();
  if (dtPin) dtPin.unexport();
  if (buttonPin) buttonPin.unexport();
  
  server.close(() => {
    console.log('HTTP server closed');
  });
  
  console.log('GPIO pins cleaned up');
  process.exit();
});

// Start the server
server.listen(8080, () => {
  console.log('WebSocket server running on port 8080');
  console.log('Waiting for encoder signals...');
});