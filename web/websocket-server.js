import { WebSocketServer, WebSocket } from 'ws';
import { createRequire } from 'module';

// Create a require function for importing CommonJS modules
const require = createRequire(import.meta.url);

// Set up WebSocket server
const wss = new WebSocketServer({ port: 8080 });
console.log('WebSocket server running on port 8080');

// Set up GPIO pins - using the same pins as in your Python reference code
let clkPin, dtPin, buttonPin;

try {
  // Try to import the 'onoff' module
  const Gpio = require('onoff').Gpio;
  
  // GPIO 27 for CLK, GPIO 22 for DT, GPIO 25 for button
  clkPin = new Gpio(27, 'in', 'both');
  dtPin = new Gpio(22, 'in', 'both');
  buttonPin = new Gpio(25, 'in', 'both');
  console.log('GPIO pins initialized successfully');
} catch (error) {
  console.error('Error initializing GPIO pins:', error);
  console.log('Running in simulation mode');
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
  
  // For testing: simulate encoder rotation every 5 seconds
  let mockValue = 1;
  setInterval(() => {
    mockValue = 1 - mockValue; // Toggle between 0 and 1
    clkPin.trigger(mockValue);
    dtPin.trigger(mockValue === 1 ? 0 : 1); // Opposite for clockwise rotation
    console.log('Simulated encoder rotation, CLK:', mockValue);
  }, 5000);
  
  // Simulate button press every 15 seconds
  setInterval(() => {
    buttonPin.trigger(1);
    console.log('Simulated button press');
    setTimeout(() => {
      buttonPin.trigger(0);
    }, 200); // Release button after 200ms
  }, 15000);
}

// Encoder state variables
let value = 30; // Initial value as in your Python code
let clkLastState = clkPin.readSync();

// WebSocket connections management
wss.on('connection', (ws) => {
  console.log('Client connected');
  
  // Send current value immediately on connection
  ws.send(JSON.stringify({ type: 'value', value }));
  
  // Handle client messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received:', data);
      
      // Handle manual value update from client
      if (data.type === 'setValue') {
        value = data.value;
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
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'value', value }));
    }
  });
}

// Variable step size similar to your CircularControl component
function getStepSize(value) {
  if (value < 50) return 5;
  if (value < 100) return 2;
  if (value < 170) return 5;
  return 6;
}

// Watch for encoder CLK pin changes
clkPin.watch((err, clkState) => {
  if (err) {
    console.error('Error with CLK pin:', err);
    return;
  }
  
  // Only process when CLK state changes
  if (clkState !== clkLastState) {
    // Read DT pin to determine direction
    const dtState = dtPin.readSync();
    
    if (clkState !== dtState) {
      // Clockwise rotation - increase value
      value = Math.min(200, value + getStepSize(value));
      console.log('Clockwise, new value:', value);
    } else {
      // Counter-clockwise rotation - decrease value
      value = Math.max(30, value - getStepSize(value));
      console.log('Counter-clockwise, new value:', value);
    }
    
    // Broadcast new value to all clients
    broadcastValue();
  }
  
  // Update last CLK state
  clkLastState = clkState;
});

// Watch for button presses
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

// Clean up GPIO on server shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  clkPin.unexport();
  dtPin.unexport();
  buttonPin.unexport();
  console.log('GPIO pins cleaned up');
  process.exit();
});