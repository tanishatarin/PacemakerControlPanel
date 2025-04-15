## Run locally

#### Terminal 1 - GPIO WebSocket Server:
1. start a virtual environment:
    ```bash
    python3 -m venv myenv
    source myenv/bin/activate
    install the required packages:
    pip install -r requirements.txt
    ```

2. then run the pythn files in the virtual environment:
    ```bash
    sudo python3 enhanced_pacemaker_server.py
    ```
    * the enhanced version has the websocket configured to send data to the modules app 



#### Terminal 2 - React Application:
```bash
cd web
pnpm install
pnpm dev
```
Open the browser and navigate to <http://localhost:5173/>. 


## Authentication Tokens
### Two tokens are pre-configured:

* pacemaker_token_123: Admin access (can control the pacemaker)
* secondary_app_token_456: View-only access (can only receive data)


### GPIO Pins for Encoders 

#### Rate:
Clock 27, DT 22


#### A Output: 
Clock 21, DT 20 
* for a output turning, for some reason 0.3mA does not show up on the screen but the rest of the steps work perfectly! 

#### V Output: 
Clock 13, DT 6

### mode scroll output:
Clock 8, DT 7

#### Buttons ?!?!

Lock 17, LED 18 

Up 26

Down 14

Left 15

DOO 23

Power 5, LED 16 

pause ??


to ensure things work properly: 
 black = ground 
 red = 5 volts 
 blue = logic pin 
 yellow = ground 

