// // server.js
// // const express = require('express');
// const cors = require('cors');
// const Gpio = require('onoff').Gpio; // Popular library for GPIO access
// const app = express();

// app.use(cors());
// app.use(express.json());

// // Set up GPIO pins
// const clkPin = new Gpio(27, 'in', 'both'); // GPIO 27 for CLK
// const dtPin = new Gpio(22, 'in', 'both');  // GPIO 22 for DT
// const buttonPin = new Gpio(25, 'in', 'both'); // GPIO 25 for button

// let value = 30; // Initial value
// let clkLastState = clkPin.readSync();

// // Handle encoder rotation
// clkPin.watch((err, clkState) => {
//   if (err) {
//     console.error('Error with CLK pin', err);
//     return;
//   }
  
//   if (clkState !== clkLastState) {
//     const dtState = dtPin.readSync();
//     if (clkState !== dtState) {
//       // Clockwise rotation
//       value = Math.min(200, value + getStepSize(value));
//     } else {
//       // Counter-clockwise rotation
//       value = Math.max(30, value - getStepSize(value));
//     }
//     console.log('New value:', value);
//     // This will be accessible via the /value endpoint
//   }
//   clkLastState = clkState;
// });

// // Handle button press
// buttonPin.watch((err, state) => {
//   if (err) {
//     console.error('Error with button pin', err);
//     return;
//   }
  
//   if (state === 1) { // Button pressed (assuming active high)
//     value = 30; // Reset to 30
//     console.log('Reset to:', value);
//   }
// });

// function getStepSize(value) {
//   if (value < 50) return 5;
//   if (value < 100) return 2;
//   if (value < 170) return 5;
//   return 6;
// }

// // API endpoints
// app.get('/value', (req, res) => {
//   res.json({ value });
// });

// // Clean up GPIO on exit
// process.on('SIGINT', () => {
//   clkPin.unexport();
//   dtPin.unexport();
//   buttonPin.unexport();
//   process.exit();
// });

// const PORT = 3001;
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });