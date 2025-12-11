import cv2
import mediapipe as mp
import time

# --- 設定常數 ---
# 使用 MediaPipe 姿態估計模型
mp_pose = mp.solutions.pose
# 使用 MediaPipe 繪圖工具，用於視覺化關節點
mp_drawing = mp.solutions.drawing_utils

# 設定 MediaPipe Pose 參數
# static_image_mode=False: 啟用視訊流模式
# model_complexity=1: 使用中等模型複雜度，兼顧準確度和速度
# enable_segmentation=False: 不啟用分割功能，節省資源
# min_detection_confidence=0.5: 最小偵測信心水準
# min_tracking_confidence=0.5: 最小追蹤信心水準
# ** upper_body_only=True: 只偵測上半身以加快處理速度 (可選) **
# ** smooth_landmarks=True: 平滑化關節點，減少畫面跳動 **

# **** 關鍵點：在 MediaPipe 官方文檔中，Pose 模型通常是針對單人進行優化。
# **** 為了實現多人物，我們通常會使用更高階的 API 或調整設定。
# **** 在單一 Pose 解決方案中，它會嘗試在畫面中找到最顯著的單個人。
# **** 為了應對多人物，我們將使用一個通用的 Pose 實例，並依賴其多人物處理能力，或尋找 Multi-Pose 解決方案。
# **** 為了簡化，我們先使用標準 Pose，並依賴 OpenCV 處理多個偵測目標。

# 這裡使用標準的 Pose 實例，並假設 MediaPipe 在高性能 PC 上能較好地處理兩個緊鄰目標。

# 啟動 Pose 實例
pose = mp_pose.Pose(
    static_image_mode=False,
    model_complexity=1, 
    enable_segmentation=False,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5)

# --- 相機設定 ---
cap = cv2.VideoCapture(0) # 0 通常是第一個攝影機

# 設置攝影機解析度 (高解析度有利於多人物識別，但會佔用更多資源)
# 建議使用 1280x720 試驗
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

if not cap.isOpened():
    print("錯誤：無法開啟攝影機。")
    exit()

# --- 主循環 ---
prev_time = time.time()

while cap.isOpened():
    success, image = cap.read()
    if not success:
        continue

    # 鏡像翻轉影像 (讓玩家的動作與螢幕鏡像一致)
    image = cv2.flip(image, 1)

    # 轉換顏色空間：OpenCV 讀取的是 BGR，MediaPipe 需要 RGB
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    
    # 設置影像為不可寫，提高處理效率
    image_rgb.flags.writeable = False
    
    # 進行姿態估計
    results = pose.process(image_rgb)
    
    # 設置影像為可寫
    image.flags.writeable = True

    current_time = time.time()
    fps = 1 / (current_time - prev_time)
    prev_time = current_time

    # --- 關鍵：處理多人物結果 ---
    # MediaPipe Pose 在單一實例下，主要輸出畫面中佔比最大的單個人物。
    # 為了實現多人物，我們需要依賴 MediaPipe 能夠在畫面中偵測到不同 'regions' 的能力，
    # 或者轉而使用 MediaPipe 的 Holistic 解決方案，但它資源消耗更大。
    
    # *** 最簡單的解決方案：依賴 MediaPipe Face/Pose/Hand 模組的組合來間接支援多人。
    # *** 由於我們只需要 Pose，我們先假設 MediaPipe 能夠偵測到一個或兩個顯著目標。
    
    if results.pose_landmarks:
        # 在這裡，我們需要手動處理多個偵測到的 'instance'，但 MediaPipe Pose 的 API 主要設計是輸出一個 'results' 物件。
        # 如果畫面中有兩人，結果可能會在兩者之間跳動，或只鎖定其中一人。
        
        # 為了 PVP，我們先將偵測到的結果視為 Player 1 (P1)。
        
        # 繪製關節點和連線
        mp_drawing.draw_landmarks(
            image, 
            results.pose_landmarks, 
            mp_pose.POSE_CONNECTIONS,
            landmark_drawing_spec=mp_drawing.DrawingSpec(color=(255, 0, 0), thickness=2, circle_radius=2), # 藍色點
            connection_drawing_spec=mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2) # 綠色線
        )
        
        # --- 身份鎖定與分離邏輯佔位 ---
        # P1_landmarks = results.pose_landmarks # (假設)
        # P2_landmarks = None # (目前無法從單一 Pose 實例中可靠獲得 P2)
        # 這裡需要一個強大的多人物分離與鎖定機制！

    # 顯示 FPS
    cv2.putText(image, f'FPS: {int(fps)}', (10, 30), 
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2, cv2.LINE_AA)
    
    cv2.imshow('Ultraman PVP Detector - Press Q to exit', image)

    if cv2.waitKey(5) & 0xFF == ord('q'):
        break

# 釋放資源
pose.close()
cap.release()
cv2.destroyAllWindows()
