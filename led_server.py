import time
import threading
import math
import socketio
import eventlet
from rpi_ws281x import PixelStrip, Color

# ==========================================
# 1. 硬體與參數設定 (已修正)
# ==========================================
LED_COUNT = 26        
LED_PIN = 18          # GPIO Pin (PWM)
LED_FREQ_HZ = 800000  
LED_DMA = 10          
LED_BRIGHTNESS = 255  
LED_INVERT = False    
LED_CHANNEL = 0       

# 區域定義
# P1: 索引 0 ~ 11 (共12顆)
# MID: 索引 12, 13 (共2顆，不亮)
# P2: 索引 14 ~ 25 (共12顆)
P1_RANGE = range(0, 12)
MID_RANGE = range(12, 14)
P2_RANGE = range(14, 26)

# 顏色定義
COLOR_P1 = Color(0, 0, 255)      # P1 藍色
COLOR_P2 = Color(255, 0, 0)      # P2 紅色
COLOR_HIT = Color(255, 255, 0)   # 受傷 黃色
COLOR_LOW = Color(255, 0, 0)     # 殘血 紅色 (跑馬燈用)
COLOR_OFF = Color(0, 0, 0)

# 狀態定義
MODE_IDLE = 'IDLE'
MODE_GAME = 'GAME'
MODE_WIN_P1 = 'WIN_P1'
MODE_WIN_P2 = 'WIN_P2'

# ==========================================
# 2. 狀態管理
# ==========================================
class GameState:
    def __init__(self):
        self.mode = MODE_IDLE
        self.p1_hp = 100
        self.p2_hp = 100
        self.p1_hit_timer = 0
        self.p2_hit_timer = 0
        self.running = True

state = GameState()

# 初始化 LED
strip = PixelStrip(LED_COUNT, LED_PIN, LED_FREQ_HZ, LED_DMA, LED_INVERT, LED_BRIGHTNESS, LED_CHANNEL)
strip.begin()

# ==========================================
# 3. Socket.IO 通訊
# ==========================================
sio = socketio.Server(cors_allowed_origins='*')
app = socketio.WSGIApp(sio)

@sio.event
def connect(sid, environ):
    print(f"🔗 前端已連線: {sid}")
    state.mode = MODE_IDLE # 連線時重置為待機動畫

@sio.event
def disconnect(sid):
    print("❌ 前端斷線")
    state.mode = MODE_IDLE

@sio.on('update_hp')
def on_update_hp(sid, data):
    state.p1_hp = data.get('p1', 100)
    state.p2_hp = data.get('p2', 100)
    # 有收到血量就進入遊戲模式
    if state.mode == MODE_IDLE:
        state.mode = MODE_GAME

@sio.on('effect')
def on_effect(sid, effect_name):
    print(f"⚡ 特效: {effect_name}")
    current_time = time.time()
    
    if effect_name == 'hit_p1':
        state.p1_hit_timer = current_time + 0.3 # 閃爍持續時間
    elif effect_name == 'hit_p2':
        state.p2_hit_timer = current_time + 0.3
    elif effect_name == 'win_p1':
        state.mode = MODE_WIN_P1
    elif effect_name == 'win_p2':
        state.mode = MODE_WIN_P2
    elif effect_name == 'idle':
        state.mode = MODE_IDLE

# ==========================================
# 4. 動畫渲染引擎 (60 FPS)
# ==========================================

def wheel(pos):
    """彩虹顏色生成器"""
    if pos < 85: return Color(pos * 3, 255 - pos * 3, 0)
    elif pos < 170: pos -= 85; return Color(255 - pos * 3, 0, pos * 3)
    else: pos -= 170; return Color(0, pos * 3, 255 - pos * 3)

def render_loop():
    print("✨ LED 動畫引擎啟動...")
    offset = 0 
    
    while state.running:
        current_time = time.time()
        offset += 1
        if offset > 255: offset = 0
        
        # --- A. 待機模式 (彩虹跑馬燈) ---
        if state.mode == MODE_IDLE:
            for i in range(strip.numPixels()):
                # 略過中間那兩顆
                if i in MID_RANGE:
                    strip.setPixelColor(i, COLOR_OFF)
                    continue
                # 產生流動彩虹
                pixel_index = (i * 256 // strip.numPixels()) + offset
                strip.setPixelColor(i, wheel(pixel_index & 255))
        
        # --- B. 遊戲模式 (血條) ---
        elif state.mode == MODE_GAME:
            
            # 1. P1 (左側 0-11)
            # ---------------------------
            if current_time < state.p1_hit_timer:
                # 受傷：黃色閃爍
                flash_on = int(current_time * 20) % 2 == 0 # 快速閃爍
                color = COLOR_HIT if flash_on else COLOR_OFF
                for i in P1_RANGE: strip.setPixelColor(i, color)
                
            elif state.p1_hp <= 30:
                # 殘血：紅色快速跑馬燈
                for i in P1_RANGE:
                    # 讓燈光向中間流動
                    if ((i + int(offset)) % 3) == 0: 
                        strip.setPixelColor(i, COLOR_LOW)
                    else:
                        strip.setPixelColor(i, COLOR_OFF)
            else:
                # 正常血條：映射 100 HP -> 12 顆燈
                # P1 是從左(0)亮到右(11)
                leds_lit = math.ceil(12 * (state.p1_hp / 100))
                for i in P1_RANGE:
                    if i < leds_lit:
                        strip.setPixelColor(i, COLOR_P1)
                    else:
                        strip.setPixelColor(i, COLOR_OFF)

            # 2. P2 (右側 14-25)
            # ---------------------------
            if current_time < state.p2_hit_timer:
                # 受傷：黃色閃爍
                flash_on = int(current_time * 20) % 2 == 0
                color = COLOR_HIT if flash_on else COLOR_OFF
                for i in P2_RANGE: strip.setPixelColor(i, color)
                
            elif state.p2_hp <= 30:
                # 殘血：紅色快速跑馬燈 (方向反過來)
                for i in P2_RANGE:
                    if ((i - int(offset)) % 3) == 0:
                        strip.setPixelColor(i, COLOR_LOW)
                    else:
                        strip.setPixelColor(i, COLOR_OFF)
            else:
                # 正常血條：映射 100 HP -> 12 顆燈
                # P2 是從右(25)亮回來(14)
                # 例如滿血 12 顆，從 26-12=14 開始亮，亮到 25
                leds_lit = math.ceil(12 * (state.p2_hp / 100))
                start_index = 26 - leds_lit 
                
                for i in P2_RANGE:
                    if i >= start_index:
                        strip.setPixelColor(i, COLOR_P2)
                    else:
                        strip.setPixelColor(i, COLOR_OFF)

            # 3. 中間燈恆滅
            for i in MID_RANGE:
                strip.setPixelColor(i, COLOR_OFF)

        # --- C. 獲勝模式 ---
        elif state.mode == MODE_WIN_P1:
            # P1 全亮藍色，P2 全滅
            for i in range(strip.numPixels()):
                if i in P1_RANGE: strip.setPixelColor(i, COLOR_P1)
                else: strip.setPixelColor(i, COLOR_OFF)
                
        elif state.mode == MODE_WIN_P2:
            # P2 全亮紅色，P1 全滅
            for i in range(strip.numPixels()):
                if i in P2_RANGE: strip.setPixelColor(i, COLOR_P2)
                else: strip.setPixelColor(i, COLOR_OFF)

        strip.show()
        time.sleep(0.02) # 控制更新速度

# ==========================================
# 5. 啟動
# ==========================================
if __name__ == '__main__':
    t = threading.Thread(target=render_loop)
    t.daemon = True
    t.start()

    PORT = 3000
    print(f"🚀 LED Server 啟動 (總燈數: {LED_COUNT})")
    try:
        eventlet.wsgi.server(eventlet.listen(('0.0.0.0', PORT)), app)
    except KeyboardInterrupt:
        state.running = False
        # 關燈
        for i in range(strip.numPixels()):
            strip.setPixelColor(i, Color(0,0,0))
        strip.show()
