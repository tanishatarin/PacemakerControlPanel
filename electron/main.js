const { app, BrowserWindow } = require('electron');
const path = require('path');
const url = require('url');
const { spawn } = require('child_process');

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;
let serverProcess;

function startServer() {
  // Start the Python server
  serverProcess = spawn('sudo', ['python3', path.join(__dirname, '../..', 'pacemaker_server.py')], {
    detached: false
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`Server stdout: ${data}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`Server stderr: ${data}`);
  });

  serverProcess.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
  });
}

function createWindow() {
  // Start the server before creating the window
  startServer();

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    autoHideMenuBar: true,
    fullscreen: true,
  });

  // Load the index.html from the build folder
  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, '../dist/index.html'),
      protocol: 'file:',
      slashes: true,
    })
  );

  // Open DevTools in development mode
  // mainWindow.webContents.openDevTools();

  // Handle window closed
  mainWindow.on('closed', function() {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(createWindow);

// Quit when all windows are closed
app.on('window-all-closed', function() {
  if (process.platform !== 'darwin') {
    // Kill the server process when the app is closed
    if (serverProcess) {
      serverProcess.kill();
    }
    app.quit();
  }
});

app.on('activate', function() {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  // Kill the server process when the app is about to quit
  if (serverProcess) {
    serverProcess.kill();
  }
});