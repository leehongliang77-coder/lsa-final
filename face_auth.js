// face_auth.js
let labeledFaceDescriptors = []; 
let faceMatcher = null;

// 判定門檻：數值越小越嚴格 (建議 0.45)
const MATCH_THRESHOLD = 0.45; 

// 我們繼續使用原始的 GitHub 模型庫，因為它與新版庫通常是兼容的
// 如果載入失敗，您可以嘗試下載模型到本地專案的 /models 資料夾
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

export async function loadFaceModels() {
    console.log("正在載入 Face ID 模型...");
    try {
        // 確保 faceapi 物件存在
        if (typeof faceapi === 'undefined') {
            throw new Error("FaceAPI library not loaded!");
        }

        // 載入 SSD MobileNet (偵測)
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        // 載入五官 (68點)
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        // 載入識別器
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        
        console.log("Face ID 模型載入成功！");
        loadRegisteredFaces();
    } catch (error) {
        console.error("Face ID 模型載入失敗:", error);
        // 不阻擋遊戲進行，只提示
        console.log("將無法使用 Face ID 功能，請改用手動輸入。");
    }
}

export async function registerFace(videoElement, name) {
    if (!videoElement || videoElement.paused || videoElement.readyState < 2) {
        alert("請確認攝影機畫面正常後再試一次。");
        return false;
    }

    try {
        // 使用 SsdMobilenetv1Options
        // 注意：新版庫可能需要 minConfidence 參數
        const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
        
        const detection = await faceapi.detectSingleFace(videoElement, options)
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (detection) {
            // 檢查重複 (避免同一人重複註冊)
            if (faceMatcher) {
                const checkMatch = faceMatcher.findBestMatch(detection.descriptor);
                if (checkMatch.label !== 'unknown' && checkMatch.distance < MATCH_THRESHOLD) {
                    alert(`⚠️ 這張臉看起來很像已註冊的 "${checkMatch.label}"`);
                    // 這裡不強制 return，讓使用者可以覆蓋或新增
                }
            }

            const descriptor = detection.descriptor;
            // 建立新的標籤
            const newLabel = new faceapi.LabeledFaceDescriptors(name, [descriptor]);
            labeledFaceDescriptors.push(newLabel);
            
            // 更新比對器
            faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, MATCH_THRESHOLD);
            saveToStorage();
            
            alert(`✅ Face ID 註冊成功！已記住玩家：${name}`);
            return true;
        } else {
            alert("❌ 註冊失敗：偵測不到人臉，請正對鏡頭並保持光線充足。");
            return false;
        }
    } catch (error) {
        console.error("註冊過程發生錯誤:", error);
        return false;
    }
}

export async function loginWithFace(videoElement) {
    if (!faceMatcher) return null;
    if (!videoElement || videoElement.paused || videoElement.readyState < 2) return null;

    try {
        const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
        const detection = await faceapi.detectSingleFace(videoElement, options)
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (detection) {
            const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
            console.log(`Face ID 掃描: ${bestMatch.toString()}`);

            if (bestMatch.label !== 'unknown') {
                return bestMatch.label;
            }
        }
    } catch (error) {
        // 忽略偵測中的錯誤 (例如移動過快導致的模糊)
    }
    return null;
}

export function clearFaceData() {
    if (confirm("確定要清除所有 Face ID 註冊資料嗎？")) {
        localStorage.removeItem('faceAuthDB');
        labeledFaceDescriptors = [];
        faceMatcher = null;
        alert("🗑️ 所有 Face ID 資料已清除！");
    }
}

function saveToStorage() {
    try {
        const dataToSave = labeledFaceDescriptors.map(ld => ({
            label: ld.label,
            descriptors: ld.descriptors.map(d => Array.from(d))
        }));
        localStorage.setItem('faceAuthDB', JSON.stringify(dataToSave));
    } catch (e) {
        console.error("儲存人臉數據失敗:", e);
    }
}

function loadRegisteredFaces() {
    try {
        const dataStr = localStorage.getItem('faceAuthDB');
        if (dataStr) {
            const data = JSON.parse(dataStr);
            labeledFaceDescriptors = data.map(item => {
                const descriptors = item.descriptors.map(d => new Float32Array(d));
                return new faceapi.LabeledFaceDescriptors(item.label, descriptors);
            });
            
            if (labeledFaceDescriptors.length > 0) {
                faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, MATCH_THRESHOLD);
                console.log(`已載入 ${labeledFaceDescriptors.length} 位玩家的臉部數據。`);
            }
        }
    } catch (e) {
        console.error("讀取人臉數據失敗:", e);
        localStorage.removeItem('faceAuthDB');
    }
}
