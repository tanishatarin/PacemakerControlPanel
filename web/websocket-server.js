import { WebSocketServer, WebSocket } from 'ws';
import { createRequire } from 'module';
import http from 'http';

const CLIENT_LIMIT = 1;  // Only allow one active client at a time

// Create a require function for importing CommonJS modules
const require = createRequire(import.meta.url);

// Create an HTTP server first to make WebSocket more stable
const server = http.createServer();
const wss = new WebSocketServer({ server });

// Ping intervals to keep connections alive
const PING_INTERVAL = 5000;
const CONNECTION_TIMEOUT = 15000;

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
//   class MockGpio {
//     constructor() {
//       this.value = 0;
//       this.callbacks = [];
//     }
    
//     readSync() {
//       return this.value;
//     }
    
//     writeSync(value) {
//       this.value = value;
//     }
    
//     watch(callback) {
//       this.callbacks.push(callback);
//     }
    
//     trigger(value) {
//       this.value = value;
//       this.callbacks.forEach(cb => cb(null, value));
//     }
    
//     unexport() {
//       // Do nothing
//     }
//   }
  
//   clkPin = new MockGpio();
//   dtPin = new MockGpio();
//   buttonPin = new MockGpio();
}

// Encoder state variables
let value = 30; // Initial value as in your Python code
let clkLastState = clkPin.readSync();
let dtLastState = dtPin.readSync();
let lastEncoderTime = Date.now();

console.log(`Starting value: ${value}`);

// Debounce time (milliseconds)
const DEBOUNCE_MS = 1;  // Reduced debounce time for better responsiveness

// Track clients and their heartbeats
const clients = new Map();

// Initialize heartbeat interval to keep connections alive
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    const client = clients.get(ws);
    
    if (client && (Date.now() - client.lastPing > CONNECTION_TIMEOUT)) {
      console.log("Client timed out - terminating connection");
      return ws.terminate();
    }
    
    // Send ping to all clients to keep connections alive
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  });
}, PING_INTERVAL);

// WebSocket connections management
wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`Client connected from ${ip}`);
  

  // Check if we already have too many clients
  if (clients.size >= CLIENT_LIMIT) {
    console.log(`Client limit (${CLIENT_LIMIT}) reached - disconnecting newer connections`);
    // Keep only the newest connection
    const clientEntries = Array.from(clients.entries());
    // Sort by connection time, newest first
    clientEntries.sort((a, b) => b[1].connectedAt - a[1].connectedAt);
    
    // Keep the newest connection, disconnect the rest
    for (let i = CLIENT_LIMIT; i < clientEntries.length; i++) {
      const [oldWs, _] = clientEntries[i];
      console.log(`Closing older connection from ${clients.get(oldWs)?.ip}`);
      oldWs.close(1000, 'Too many connections');
      clients.delete(oldWs);
    }
  }
  
  // Add client to tracking
  clients.set(ws, { 
    lastPing: Date.now(),
    connectedAt: Date.now(),
    ip: ip 
  });
  
  // Send current value immediately on connection
  ws.send(JSON.stringify({ type: 'value', value }));
  
  // Handle ping messages to track connection health
  ws.on('ping', () => {
    const client = clients.get(ws);
    if (client) {
      client.lastPing = Date.now();
    }
  });
  
  // Handle client messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      // Handle manual value update from client
      if (data.type === 'setValue') {
        value = data.value;
        console.log(`Value set manually to: ${value}`);
        broadcastValue();
      } else if (data.type === 'ping') {
        // Client ping/pong for connection checking
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log(`Client disconnected from ${ip}`);
    clients.delete(ws);
  });
  
  ws.on('error', (error) => {
    console.error(`WebSocket error for ${ip}:`, error);
    clients.delete(ws);
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

// Report server status periodically
setInterval(() => {
  const clientCount = clients.size;
  console.log(`Active connections: ${clientCount}`);
  if (clientCount > 0) {
    console.log(`Current value: ${value}`);
  }
}, 30000); // Every 30 seconds

// Clean up on server shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  clearInterval(heartbeatInterval);
  
  clkPin.unexport();
  dtPin.unexport();
  buttonPin.unexport();
  
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