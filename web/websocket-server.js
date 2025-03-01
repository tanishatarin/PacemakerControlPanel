// import { WebSocketServer, WebSocket } from 'ws';
// import fs from 'fs';
// import path from 'path';

// // GPIO Pin Configuration
// const CLK_PIN = 27;   
// const DT_PIN = 22;    
// const BUTTON_PIN = 25; 

// // GPIO Utility Functions
// class RaspberryPiGPIO {
//   constructor(pin, direction = 'in') {
//     this.pin = pin;
//     this.direction = direction;
//     this.path = `/sys/class/gpio/gpio${pin}`;
    
//     this.export();
//     this.setDirection();
//   }

//   export() {
//     const exportPath = '/sys/class/gpio/export';
//     try {
//       if (!fs.existsSync(this.path)) {
//         fs.writeFileSync(exportPath, this.pin.toString());
//       }
//     } catch (err) {
//       console.error(`Error exporting pin ${this.pin}:`, err);
//     }
//   }

//   setDirection() {
//     try {
//       fs.writeFileSync(path.join(this.path, 'direction'), this.direction);
//     } catch (err) {
//       console.error(`Error setting direction for pin ${this.pin}:`, err);
//     }
//   }

//   readValue() {
//     try {
//       return parseInt(fs.readFileSync(path.join(this.path, 'value'), 'utf8').trim());
//     } catch (err) {
//       console.error(`Error reading value for pin ${this.pin}:`, err);
//       return 0;
//     }
//   }

//   watchValue(callback) {
//     let lastValue = this.readValue();
//     const watcher = fs.watch(path.join(this.path, 'value'), (eventType) => {
//       if (eventType === 'change') {
//         const currentValue = this.readValue();
//         if (currentValue !== lastValue) {
//           callback(currentValue);
//           lastValue = currentValue;
//         }
//       }
//     });

//     return () => watcher.close();
//   }

//   unexport() {
//     try {
//       fs.writeFileSync('/sys/class/gpio/unexport', this.pin.toString());
//     } catch (err) {
//       console.error(`Error unexporting pin ${this.pin}:`, err);
//     }
//   }
// }

// // Encoder state variables
// let encoderSteps = 30; // Initial value
// let lastClkState = 0;
// let lastDebounceTime = Date.now();
// const DEBOUNCE_DELAY = 50; // milliseconds

// // Initialize GPIO pins
// const clkPin = new RaspberryPiGPIO(CLK_PIN);
// const dtPin = new RaspberryPiGPIO(DT_PIN);
// const buttonPin = new RaspberryPiGPIO(BUTTON_PIN);

// // Set up WebSocket server
// const wss = new WebSocketServer({ port: 8080 });
// console.log('WebSocket server running on port 8080');

// // Broadcast current value to all connected clients
// function broadcastValue(value) {
//   wss.clients.forEach((client) => {
//     if (client.readyState === WebSocket.OPEN) {
//       client.send(JSON.stringify({ type: 'value', value }));
//     }
//   });
// }

// // WebSocket connection handling
// wss.on('connection', (ws) => {
//   console.log('Client connected');
  
//   // Send current value immediately on connection
//   ws.send(JSON.stringify({ type: 'value', value: encoderSteps }));
  
//   // Handle client messages
//   ws.on('message', (message) => {
//     try {
//       const data = JSON.parse(message.toString());
//       console.log('Received:', data);
      
//       // Handle manual value update from client
//       if (data.type === 'setValue') {
//         // Ensure value is within allowed range
//         encoderSteps = Math.min(Math.max(data.value, 30), 200);
//         broadcastValue(encoderSteps);
//       }
//     } catch (error) {
//       console.error('Error parsing message:', error);
//     }
//   });
  
//   ws.on('close', () => {
//     console.log('Client disconnected');
//   });
// });

// // Encoder rotation detection
// let rotationTimeout;
// function detectRotation() {
//   const now = Date.now();
  
//   // Debounce
//   if (now - lastDebounceTime < DEBOUNCE_DELAY) {
//     return;
//   }
//   lastDebounceTime = now;

//   // Read current states
//   const currentClkState = clkPin.readValue();
//   const dtState = dtPin.readValue();

//   // Detect rotation
//   if (currentClkState !== lastClkState) {
//     if (dtState !== currentClkState) {
//       // Clockwise rotation
//       encoderSteps = Math.min(encoderSteps + 1, 200);
//     } else {
//       // Counter-clockwise rotation
//       encoderSteps = Math.max(encoderSteps - 1, 30);
//     }

//     console.log(`Current value: ${encoderSteps}`);
//     broadcastValue(encoderSteps);
//   }

//   lastClkState = currentClkState;
// }

// // Watch for encoder rotation
// const stopClkWatch = clkPin.watchValue(() => {
//   clearTimeout(rotationTimeout);
//   rotationTimeout = setTimeout(detectRotation, 10);
// });

// // Button press handler - reset to initial value
// const stopButtonWatch = buttonPin.watchValue((value) => {
//   if (value === 1) {
//     // Reset to initial value
//     encoderSteps = 30;
//     console.log('Reset to 30');
//     broadcastValue(encoderSteps);
//   }
// });

// // Cleanup on exit
// process.on('SIGINT', () => {
//   stopClkWatch();
//   stopButtonWatch();
//   clkPin.unexport();
//   dtPin.unexport();
//   buttonPin.unexport();
//   process.exit();
// });

// console.log("Rotary Encoder Ready. Rotate to change values between 30-200.");