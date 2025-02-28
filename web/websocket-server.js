import { WebSocketServer, WebSocket } from 'ws';
import Gpio from 'onoff';

// Rotary Encoder Configuration
const CLK_PIN = 27;   // GPIO17
const DT_PIN = 22;    // GPIO18
const BUTTON_PIN = 25; // GPIO25

// Initialize GPIO pins
const clkPin = new Gpio.Gpio(CLK_PIN, 'in', 'both');
const dtPin = new Gpio.Gpio(DT_PIN, 'in', 'both');
const buttonPin = new Gpio.Gpio(BUTTON_PIN, 'in', 'rising');

// Encoder state variables
let encoderSteps = 30; // Initial value
let lastClkState = clkPin.readSync();
let lastDebounceTime = Date.now();
const DEBOUNCE_DELAY = 1; // milliseconds

// Set up WebSocket server
const wss = new WebSocketServer({ port: 8080 });
console.log('WebSocket server running on port 8080');

// Broadcast current value to all connected clients
function broadcastValue(value) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'value', value }));
    }
  });
}

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected');
  
  // Send current value immediately on connection
  ws.send(JSON.stringify({ type: 'value', value: encoderSteps }));
  
  // Handle client messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received:', data);
      
      // Handle manual value update from client
      if (data.type === 'setValue') {
        // Ensure value is within allowed range
        encoderSteps = Math.min(Math.max(data.value, 30), 200);
        broadcastValue(encoderSteps);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Encoder rotation detection
clkPin.watch((err, clkState) => {
  if (err) {
    console.error('Error watching CLK pin:', err);
    return;
  }

  // Debounce
  const now = Date.now();
  if (now - lastDebounceTime < DEBOUNCE_DELAY) {
    return;
  }
  lastDebounceTime = now;

  // Read current states
  const currentClkState = clkState;
  const dtState = dtPin.readSync();

  // Detect rotation
  if (currentClkState !== lastClkState) {
    if (dtState !== currentClkState) {
      // Clockwise rotation
      encoderSteps = Math.min(encoderSteps + 1, 200);
    } else {
      // Counter-clockwise rotation
      encoderSteps = Math.max(encoderSteps - 1, 30);
    }

    console.log(`Current value: ${encoderSteps}`);
    broadcastValue(encoderSteps);
  }

  lastClkState = currentClkState;
});

// Button press handler - reset to initial value
buttonPin.watch((err) => {
  if (err) {
    console.error('Error watching button pin:', err);
    return;
  }

  // Reset to initial value
  encoderSteps = 30;
  console.log('Reset to 30');
  broadcastValue(encoderSteps);
});

// Cleanup on exit
process.on('SIGINT', () => {
  clkPin.unexport();
  dtPin.unexport();
  buttonPin.unexport();
  process.exit();
});

console.log("Rotary Encoder Ready. Rotate to change values between 30-200.");