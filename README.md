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
Clock 27, DT 22


#### A Output: 
Clock 21, DT 20 
* for a output turning, for some reason 0.3mA does not show up on the screen but the rest of the steps work perfectly! 

#### V Output: 
Clock 13, DT 6

#### Buttons ?!?!

Lock 17, LED 18 
Up 26
Down 14
Left / select 8, LED 7 
DOO 23, LED 24 
Power 5, LED 16 


pasue ? if neeeeded later 