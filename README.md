## Concept Development
製作這個專題的目的是因為我們隊員最近的生活壓力都蠻大的，再加上我們平時都喜歡玩街機對打的遊戲。因此想要復刻一些有趣的對打來讓我們釋放一些壓力，並且也可以征服輸的人。
## Implementation Resources
* Raspberry Pi 3 Model B
* led strip WS2812 NT260
* 杜邦線 NT50
## Existing Library/Software
* ```TensorFlow.js```：瀏覽器端的機器學習
* ```MoveNet```：負責偵測人體姿態模型
* ```Face-api.js```：用於偵測臉部特徵與定位
* ```Flask```：負責處理API請求
* ```PySerial```：實現電腦與樹莓派直接的連接
* ```Socket.IO```：實現系統與樹莓派之間的傳輸
* ```HTML5.Canvas```：遊戲畫面繪製
## Implementation Process
* 一開始我們希望對打的方式更接近於用攝像機偵測到人體擺出的各種招式進行攻擊，但最後因為只能偵測到一些簡單的動作，因此改為使用人體手腕的點去觸碰畫面中的各個格子就能發出各種攻擊。
## Knowledge from Lecture
* ssh
* raspberry pi
## Installation
### 燈條安裝
在樹莓派中安裝
```
sudo apt-get install python3-pip python3-dev
# 安裝通訊與 GPIO 套件
sudo pip3 install rpi_ws281x python-socketio eventlet
```
當需要啟用燈條時必須在樹莓派中輸入```sudo python3 led_server.py```才能啟動燈條
### 樹莓派的接線
Raspberry Pi GPIO18 –-> LED DIN（綠線）
Raspberry Pi 5V –––> LED 5V（紅線）
Raspberry Pi GND ––-> LED GND（白線）
需更改```main.js```中的```const SOCKET_URL = 'http://192.168.1.22:3000'```將ip改為你的樹莓派的ip。
## Usage
需開啟```browser-sync start --server --files "index.html, script.js" --host 0.0.0.0 --port 8081```接著在網頁輸入```localhost:8081/index.html```
就可以開始玩了
## Job Assignment

## References
