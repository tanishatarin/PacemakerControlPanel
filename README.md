## Run locally

Terminal 1 - GPIO WebSocket Server:
```bash
cd web
node websocket-server.js
```

Terminal 2 - React Application:
```bash
cd web
pnpm install
pnpm dev
```
Open the browser and navigate to <http://localhost:5173/>. 


Hardware Requirements and Permissions
If you're running this on a Raspberry Pi or similar device with GPIO pins:

Make sure Node.js and npm/pnpm are installed
You may need to run the WebSocket server with elevated permissions:
```bash
sudo node websocket-server.js
```