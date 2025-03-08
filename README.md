## Run locally

#### Terminal 1 - GPIO WebSocket Server:
1. start a virtual environment:
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    install the required packages:
    pip install -r requirements.txt
    ```

2. then run the pythn files in the virtual environment:
    ```bash
    sudo python3 pacemaker_server.py
    ```



#### Terminal 2 - React Application:
```bash
cd web
pnpm install
pnpm dev
```
Open the browser and navigate to <http://localhost:5173/>. 




### GPIO Pins for Encoders 

#### Rate:
Clock 27, DT 22, Push 25 


#### A Output: 
Clock 21, DT 20 


