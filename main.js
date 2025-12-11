import * as config from './config.js';
import * as state from './state.js';
import {
    setPlayerNames,
    setGameState,
    resetAllState,
    setGameTimeAndFlag,
    setHPDisplay,
    setHP,
    setEnergy,
    setCooldownTime,
    setDamagePending,
    updateStats,
    setIsGameOver,
    setRemainingTime,
    setViewingProfile
} from './state.js';
import { processGameLogic, randomizeGrid } from './game_logic.js';
import {
    saveScoreToLeaderboard,
    getLeaderboard,
    calculateScore,
    getRank,
    getRankColor,
    saveMatchRecord,
    getPlayerStats
} from './ranking.js';
import { loadFaceModels, registerFace, loginWithFace, clearFaceData } from './face_auth.js';

const SOCKET_URL = 'http://192.168.1.22:3000';
let socket = null;

try {
    socket = io(SOCKET_URL);
    socket.on('connect', () => console.log(`已連線到 LED (${SOCKET_URL})`));
    socket.on('connect_error', (err) => console.warn("LED 連線失敗", err));
} catch (e) {
    console.warn("Socket.io 未載入");
}

function triggerLedEffect(effectName) {
    if (socket && socket.connected) socket.emit('effect', effectName);
}

const audioFiles = {
    intro: new Audio('sounds/intro.mp3'),
    bgm: new Audio('sounds/bgm.mp3'),
    hit: new Audio('sounds/hit.mp3'),
    charge: new Audio('sounds/charge.mp3'),
    super: new Audio('sounds/super.mp3'),
    win: new Audio('sounds/win.mp3')
};
audioFiles.intro.loop = true;
audioFiles.bgm.loop = true;
audioFiles.intro.volume = 0.6;
audioFiles.bgm.volume = 0.5;

function playSound(name) {
    try {
        if (audioFiles[name]) {
            const s = audioFiles[name].cloneNode();
            s.volume = 1.0;
            s.play().catch(e => {});
        }
    } catch (e) {}
}

function playIntroMusic() {
    audioFiles.bgm.pause();
    audioFiles.bgm.currentTime = 0;
    audioFiles.intro.play().catch(e => {});
}

function playBattleMusic() {
    audioFiles.intro.pause();
    audioFiles.intro.currentTime = 0;
    audioFiles.bgm.play().catch(e => {});
}

function stopAllMusic() {
    audioFiles.intro.pause();
    audioFiles.bgm.pause();
}

const video = document.getElementById('webcam-video');
const canvas = document.getElementById('output-canvas');
const ctx = canvas.getContext('2d');
const webcamContainer = document.getElementById('webcam-container');
const loadingText = document.getElementById('loading-text');
const lbOverlay = document.getElementById('leaderboard-overlay');
const lbList = document.getElementById('leaderboard-list');
const closeLbBtn = document.getElementById('close-lb-btn');
const pauseBtn = document.getElementById('pause-btn');
const pauseMenu = document.getElementById('pause-menu');
const btnResume = document.getElementById('btn-resume');
const btnRestart = document.getElementById('btn-restart');
const btnQuit = document.getElementById('btn-quit');

let detector;
let videoReadyPromise = null;
let lastTime = 0;

let previousP1Keypoints = null;
let previousP2Keypoints = null;
let lastChargeSentP1 = 0;
let lastChargeSentP2 = 0;

canvas.width = config.VIDEO_WIDTH;
canvas.height = config.VIDEO_HEIGHT;

closeLbBtn.addEventListener('click', () => {
    lbOverlay.style.display = 'none';
    setGameState('start');
});
pauseBtn.addEventListener('click', () => {
    if (state.gameState === 'playing') {
        setGameState('paused');
        audioFiles.bgm.pause();
    }
});
btnResume.addEventListener('click', () => {
    setGameState('playing');
    pauseMenu.style.display = 'none';
    audioFiles.bgm.play();
});
btnRestart.addEventListener('click', () => {
    pauseMenu.style.display = 'none';
    resetGame();
});
btnQuit.addEventListener('click', () => {
    pauseMenu.style.display = 'none';
    playIntroMusic();
    setGameState('start');
    resetAllState();
});
document.body.addEventListener('click', () => {
    if (state.gameState === 'start' && audioFiles.intro.paused) audioFiles.intro.play();
}, { once: true });

function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

function smoothKeypoints(newKeypoints, oldKeypoints, minScore) {
    if (!newKeypoints) return oldKeypoints;
    if (!oldKeypoints) return newKeypoints;
    return newKeypoints.map((newPoint, index) => {
        const oldPoint = oldKeypoints[index];
        if (newPoint.score < minScore && oldPoint) return { ...oldPoint, score: minScore };
        if (oldPoint) {
            return { ...newPoint, x: lerp(oldPoint.x, newPoint.x, 0.5), y: lerp(oldPoint.y, newPoint.y, 0.5) };
        }
        return newPoint;
    });
}

async function setupCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('不支援攝影機！');
        return null;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            'audio': false,
            'video': { facingMode: 'user', width: config.VIDEO_WIDTH, height: config.VIDEO_HEIGHT }
        });
        video.srcObject = stream;
        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                video.play();
                resolve(video);
            };
        });
    } catch (error) {
        console.error(error);
        return null;
    }
}

async function loadMoveNetModel() {
    const model = poseDetection.SupportedModels.MoveNet;
    const detectorConfig = {
        modelType: poseDetection.movenet.modelType.MULTIPOSE_LIGHTNING,
        maxPoses: 2,
        scoreThreshold: 0.3,
        enableSmoothing: true
    };
    detector = await poseDetection.createDetector(model, detectorConfig);
}

function resetGame() {
    resetAllState();
    const now = performance.now();
    setGameTimeAndFlag(now, 60, false);
    setGameState('playing');
    previousP1Keypoints = null;
    previousP2Keypoints = null;
    lastTime = now;

    randomizeGrid();
    playBattleMusic();
    triggerLedEffect('hp_mode');
    if (socket && socket.connected) socket.emit('update_hp', { p1: 100, p2: 100 });
}

function addEnergyOnHit(player, amount) {
    const current = player === 'P1' ? state.P1_Energy : state.P2_Energy;
    const newEnergy = Math.min(config.MAX_ENERGY, current + amount);
    const p1E = player === 'P1' ? newEnergy : state.P1_Energy;
    const p2E = player === 'P2' ? newEnergy : state.P2_Energy;
    setEnergy(p1E, p2E);
}

function drawKeypoints(keypoints, color) {
    if (!keypoints) return;
    ctx.shadowBlur = 15;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    for (const keypoint of keypoints) {
        if (keypoint.score > 0.2) {
            ctx.beginPath();
            ctx.arc(keypoint.x, keypoint.y, 8, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
        }
    }
    ctx.shadowBlur = 0;
}

function drawHealthBar(x, y, width, height, currentHP, displayHP, maxHP, color, playerName) {
    ctx.fillStyle = 'white';
    ctx.font = 'bold 22px "Noto Sans TC"';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 5;
    ctx.fillText(playerName, x + width / 2, y - 15);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(20, 20, 20, 0.8)';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    const displayPercent = Math.max(0, displayHP / maxHP);
    const currentPercent = Math.max(0, currentHP / maxHP);
    ctx.fillStyle = 'rgba(255, 200, 0, 0.8)';
    ctx.fillRect(x + 2, y + 2, (width - 4) * displayPercent, height - 4);
    ctx.fillStyle = color;
    ctx.fillRect(x + 2, y + 2, (width - 4) * currentPercent, height - 4);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 20px "Black Ops One"';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 4;
    ctx.fillText(`${Math.ceil(currentHP)} / ${maxHP}`, x + width / 2, y + height - 6);
    ctx.shadowBlur = 0;
}

function drawEnergyBar(x, y, width, height, energy, maxEnergy) {
    ctx.fillStyle = 'rgba(20, 20, 20, 0.8)';
    ctx.fillRect(x, y, width, height);
    const percent = Math.max(0, energy / maxEnergy);
    const gradient = ctx.createLinearGradient(x, y, x + width, y);
    if (percent >= 1.0) {
        gradient.addColorStop(0, `rgba(255, 0, 255, 1)`);
        gradient.addColorStop(1, `rgba(255, 100, 255, 1)`);
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'magenta';
    } else {
        gradient.addColorStop(0, '#00ffff');
        gradient.addColorStop(1, '#0088ff');
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(x + 2, y + 2, (width - 4) * percent, height - 4);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 14px "Black Ops One"';
    ctx.textAlign = 'center';
    if (percent >= 1.0) ctx.fillText('MAX POWER', x + width / 2, y + height - 4);
    else ctx.fillText(`${Math.floor(energy)}%`, x + width / 2, y + height - 4);
}

function drawGrid() {
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let row = 0; row < config.GRID_ROWS; row++) {
        for (let col = 0; col < config.GRID_COLS; col++) {
            const x = col * config.CELL_WIDTH;
            const y = row * config.CELL_HEIGHT;
            const cellNum = row * config.GRID_COLS + col + 1;
            const action = state.currentGridLayout[cellNum];
            if (action) {
                ctx.fillStyle = action.color;
                ctx.fillRect(x, y, config.CELL_WIDTH, config.CELL_HEIGHT);
                ctx.font = 'bold 16px "Noto Sans TC"';
                let color = action.action === 'ultimate' ? 'yellow' : action.action === 'attack' ? '#ffaa00' : action.action === 'defend' ? '#00ff00' : 'magenta';
                if (action.action === 'counter') color = 'gold';
                ctx.fillStyle = color;
                ctx.shadowColor = 'black';
                ctx.shadowBlur = 4;
                ctx.fillText(`${action.player}`, x + config.CELL_WIDTH / 2, y + config.CELL_HEIGHT / 2 - 10);
                let actionName = action.action;
                if (action.action === 'attack') actionName = '攻擊';
                if (action.action === 'defend') actionName = '防禦';
                if (action.action === 'charge') actionName = '蓄力';
                if (action.action === 'ultimate') actionName = '招式';
                if (action.action === 'super') actionName = '必殺';
                if (action.action === 'counter') actionName = '反擊';
                ctx.font = '14px "Noto Sans TC"';
                ctx.fillText(actionName, x + config.CELL_WIDTH / 2, y + config.CELL_HEIGHT / 2 + 10);
                ctx.shadowBlur = 0;
            }
            ctx.strokeRect(x, y, config.CELL_WIDTH, config.CELL_HEIGHT);
        }
    }
}

function drawStartScreen() {
    ctx.clearRect(0, 0, config.VIDEO_WIDTH, config.VIDEO_HEIGHT);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, config.VIDEO_WIDTH, config.VIDEO_HEIGHT);
    ctx.textAlign = 'center';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 20;
    ctx.font = 'italic 80px "Black Ops One"';
    ctx.fillStyle = 'white';
    ctx.fillText('REAL-TIME COMBAT', config.VIDEO_WIDTH / 2, 120);
    ctx.shadowBlur = 0;
    ctx.font = 'bold 40px "Noto Sans TC"';
    ctx.fillStyle = '#00ffff';
    ctx.fillText('真人體感格鬥', config.VIDEO_WIDTH / 2, 180);
    const p1X = config.VIDEO_WIDTH / 4;
    const p2X = config.VIDEO_WIDTH * 3 / 4;
    ctx.font = 'bold 30px "Black Ops One"';
    ctx.fillStyle = '#0088ff';
    ctx.fillText('PLAYER 1', p1X, 260);
    ctx.fillStyle = '#ff0055';
    ctx.fillText('PLAYER 2', p2X, 260);
    ctx.font = 'bold 35px "Noto Sans TC"';
    ctx.fillStyle = 'white';
    ctx.fillText(state.P1_Name, p1X, 310);
    ctx.fillText(state.P2_Name, p2X, 310);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#00ff00';
    ctx.font = 'bold 24px "Noto Sans TC"';
    ctx.fillText('操作指南:', 100, 400);
    ctx.font = '20px "Noto Sans TC"';
    ctx.fillStyle = '#ddd';
    ctx.fillText('隨機戰場：P1 在左，P2 在右，位置每場都變！', 120, 440);
    ctx.fillText('攻擊(5)、招式(10)、必殺(20)', 120, 470);
    ctx.fillText('防禦無傷 /攻擊扣對手5滴', 120, 500);
    ctx.textAlign = 'center';
    const pulse = Math.sin(Date.now() / 200) * 0.5 + 0.5;
    ctx.globalAlpha = 0.5 + pulse * 0.5;
    ctx.font = 'bold 40px "Noto Sans TC"';
    ctx.fillStyle = 'yellow';
    ctx.fillText('點擊畫面開始戰鬥', config.VIDEO_WIDTH / 2, config.VIDEO_HEIGHT - 120);
    ctx.globalAlpha = 1.0;
    ctx.font = '20px "Noto Sans TC"';
    ctx.fillStyle = 'cyan';
    ctx.fillText('查看個人戰績 (Profile)   |   全球排行榜 (Rank)', config.VIDEO_WIDTH / 2, config.VIDEO_HEIGHT - 50);
}

function drawProfileScreen() {
    ctx.clearRect(0, 0, config.VIDEO_WIDTH, config.VIDEO_HEIGHT);
    ctx.fillStyle = 'rgba(0, 20, 40, 0.95)';
    ctx.fillRect(0, 0, config.VIDEO_WIDTH, config.VIDEO_HEIGHT);
    const stats = getPlayerStats(state.viewingProfileName);
    ctx.textAlign = 'center';
    ctx.font = 'bold 50px "Noto Sans TC"';
    ctx.fillStyle = 'white';
    ctx.fillText(`戰績資料: ${stats.name}`, config.VIDEO_WIDTH / 2, 80);
    const startX = config.VIDEO_WIDTH / 2 - 350;
    const statY = 200;

    function drawStatBox(label, value, color, x) {
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(x - 60, statY - 40, 120, 100);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 60, statY - 40, 120, 100);
        ctx.font = '20px "Noto Sans TC"';
        ctx.fillStyle = '#aaa';
        ctx.fillText(label, x, statY - 10);
        ctx.font = 'bold 40px "Black Ops One"';
        ctx.fillStyle = color;
        ctx.fillText(value, x, statY + 40);
    }
    drawStatBox('總場次', stats.totalGames, 'white', startX);
    drawStatBox('勝場', stats.wins, 'lime', startX + 180);
    drawStatBox('敗場', stats.losses, 'red', startX + 360);
    drawStatBox('勝率', `${stats.winRate}%`, 'gold', startX + 540);
    drawStatBox('均分', stats.avgScore, 'orange', startX + 720);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'cyan';
    ctx.font = 'bold 24px "Noto Sans TC"';
    ctx.fillText("近期對戰紀錄", 150, 380);
    ctx.strokeStyle = 'cyan';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(150, 390);
    ctx.lineTo(config.VIDEO_WIDTH - 150, 390);
    ctx.stroke();
    if (stats.recentMatches.length === 0) {
        ctx.textAlign = 'center';
        ctx.fillStyle = 'gray';
        ctx.font = '24px "Noto Sans TC"';
        ctx.fillText("尚無對戰紀錄", config.VIDEO_WIDTH / 2, 500);
    } else {
        stats.recentMatches.forEach((match, index) => {
            const y = 430 + index * 50;
            const isP1 = match.p1 === stats.name;
            const opponent = isP1 ? match.p2 : match.p1;
            const myScore = isP1 ? match.p1Score : match.p2Score;
            let result = 'DRAW';
            if (match.winner !== 'Draw') result = (isP1 && match.winner === 'P1') || (!isP1 && match.winner === 'P2') ? 'WIN' : 'LOSE';
            const resultColor = result === 'WIN' ? '#00ff00' : (result === 'DRAW' ? '#ffffff' : '#ff0000');
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.fillRect(150, y - 30, config.VIDEO_WIDTH - 300, 40);
            ctx.font = 'bold 20px "Black Ops One"';
            ctx.fillStyle = resultColor;
            ctx.textAlign = 'left';
            ctx.fillText(result, 180, y);
            ctx.font = '20px "Noto Sans TC"';
            ctx.fillStyle = 'white';
            ctx.fillText(`VS   ${opponent}`, 300, y);
            ctx.font = '20px "Black Ops One"';
            ctx.fillStyle = 'gold';
            ctx.textAlign = 'center';
            ctx.fillText(`SCORE: ${myScore}`, config.VIDEO_WIDTH / 2 + 100, y);
            ctx.font = '16px monospace';
            ctx.fillStyle = '#888';
            ctx.textAlign = 'right';
            ctx.fillText(match.date, config.VIDEO_WIDTH - 180, y);
        });
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = 'yellow';
    ctx.font = '24px "Noto Sans TC"';
    ctx.fillText('點擊任意處返回', config.VIDEO_WIDTH / 2, config.VIDEO_HEIGHT - 40);
}

async function drawLeaderboardScreen(getLeaderboardFunc) {
    if (lbOverlay.style.display !== 'flex') {
        lbOverlay.style.display = 'flex';
        let leaderboard = await getLeaderboardFunc();
        lbList.innerHTML = '';
        if (leaderboard.length === 0) lbList.innerHTML = '<div style="text-align:center; padding:20px; font-family: \'Noto Sans TC\'">尚無紀錄</div>';
        else {
            const count = Math.min(50, leaderboard.length);
            for (let i = 0; i < count; i++) {
                const entry = leaderboard[i];
                let rankColor = (i === 0) ? '#FFD700' : (i === 1) ? '#C0C0C0' : (i === 2) ? '#CD7F32' : 'white';
                const row = document.createElement('div');
                row.className = 'lb-row';
                row.innerHTML = `<div class="col-rank" style="color:${rankColor}">#${i + 1}</div><div class="col-name">${entry.name}</div><div class="col-score">${entry.score}</div><div class="col-grade" style="color:${getRankColor(entry.rank)}">${entry.rank}</div><div class="col-date">${entry.date.split(' ')[0]}</div>`;
                lbList.appendChild(row);
            }
        }
    }
}

async function drawGameOverScreen(P1_Score, P2_Score, isP1Win) {
    let winnerName = "DRAW",
        winnerColor = "white";
    if (isP1Win === true) {
        winnerName = state.P1_Name + " WINS!";
        winnerColor = "#0088ff";
    } else if (isP1Win === false) {
        winnerName = state.P2_Name + " WINS!";
        winnerColor = "#ff0055";
    }
    ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
    ctx.fillRect(0, 0, config.VIDEO_WIDTH, config.VIDEO_HEIGHT);
    ctx.textAlign = 'center';
    ctx.font = 'italic bold 80px "Black Ops One"';
    ctx.shadowColor = winnerColor;
    ctx.shadowBlur = 30;
    ctx.fillStyle = winnerColor;
    ctx.fillText(winnerName, config.VIDEO_WIDTH / 2, 150);
    ctx.shadowBlur = 0;
    ctx.font = '40px "Black Ops One"';
    ctx.fillStyle = 'white';
    ctx.fillText('GAME OVER', config.VIDEO_WIDTH / 2, 220);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(config.VIDEO_WIDTH / 4, 260);
    ctx.lineTo(config.VIDEO_WIDTH * 3 / 4, 260);
    ctx.stroke();
    const p1X = config.VIDEO_WIDTH / 4 + 50;
    const p2X = config.VIDEO_WIDTH * 3 / 4 - 50;
    ctx.font = 'bold 30px "Noto Sans TC"';
    ctx.fillStyle = '#0088ff';
    ctx.fillText(state.P1_Name, p1X, 300);
    ctx.fillStyle = '#ff0055';
    ctx.fillText(state.P2_Name, p2X, 300);
    ctx.font = '24px "Noto Sans TC"';
    ctx.fillStyle = '#ccc';
    const showStat = (label, v1, v2, y) => {
        ctx.textAlign = 'right';
        ctx.fillText(`${label}: ${v1}`, p1X + 20, y);
        ctx.textAlign = 'left';
        ctx.fillText(`${label}: ${v2}`, p2X - 20, y);
    };
    showStat('總傷害', state.P1_Stats.totalDamage, state.P2_Stats.totalDamage, 350);
    showStat('攻擊次數', state.P1_Stats.attackCount, state.P2_Stats.attackCount, 390);
    showStat('防禦成功', state.P1_Stats.defendCount, state.P2_Stats.defendCount, 430);
    showStat('必殺技', state.P1_Stats.superUsed, state.P2_Stats.superUsed, 470);
    const P1_Rank = getRank(P1_Score);
    const P2_Rank = getRank(P2_Score);
    ctx.textAlign = 'center';
    ctx.font = 'bold 40px "Black Ops One"';
    ctx.fillStyle = getRankColor(P1_Rank);
    ctx.fillText(`${P1_Score} (${P1_Rank})`, p1X, 550);
    ctx.fillStyle = getRankColor(P2_Rank);
    ctx.fillText(`${P2_Score} (${P2_Rank})`, p2X, 550);
    ctx.font = '24px "Noto Sans TC"';
    ctx.fillStyle = 'white';
    const restartPulse = Math.sin(Date.now() / 200) * 0.5 + 0.5;
    ctx.globalAlpha = 0.5 + restartPulse * 0.5;
    ctx.fillText('點擊畫面重新開始 (Tap to Restart)', config.VIDEO_WIDTH / 2, config.VIDEO_HEIGHT - 60);
    ctx.globalAlpha = 1.0;
}

function renderAttackPrompt(damagePending, isP1) {
    const currentTime = performance.now();
    if (damagePending.damage > 0 && (currentTime - damagePending.time) < config.DEFENSE_REACTION_MS) {
        const player = isP1 ? 'P1' : 'P2';
        const text = damagePending.type === 'Super' ? `${player} 必殺技!` : `${player} ${damagePending.type}!`;
        ctx.save();
        ctx.fillStyle = isP1 ? '#0088ff' : '#ff0055';
        ctx.font = 'italic bold 60px "Black Ops One"';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'white';
        ctx.shadowBlur = 10;
        ctx.fillText(text, config.VIDEO_WIDTH / 2, config.VIDEO_HEIGHT / 2);
        ctx.font = '30px "Noto Sans TC"';
        ctx.fillStyle = 'white';
        ctx.shadowBlur = 0;
        ctx.fillText('快防禦! (DEFEND!)', config.VIDEO_WIDTH / 2, config.VIDEO_HEIGHT / 2 + 60);
        ctx.restore();
    }
}


async function startPoseDetection() {
    if (!detector) await loadMoveNetModel();
    if (!detector) return;
    lastTime = performance.now();
    const poseDetectionFrame = async () => {
        const currentTime = performance.now();
        ctx.clearRect(0, 0, config.VIDEO_WIDTH, config.VIDEO_HEIGHT);

        if (state.gameState !== 'leaderboard') lbOverlay.style.display = 'none';
        if (state.gameState === 'playing') pauseBtn.style.display = 'block';
        else pauseBtn.style.display = 'none';
        if (state.gameState === 'paused') {
            pauseMenu.style.display = 'flex';
            ctx.save();
            ctx.scale(-1, 1);
            ctx.translate(-config.VIDEO_WIDTH, 0);
            ctx.drawImage(video, 0, 0, config.VIDEO_WIDTH, config.VIDEO_HEIGHT);
            ctx.restore();
            requestAnimationFrame(poseDetectionFrame);
            return;
        }

        if (state.gameState === 'start') {
            drawStartScreen();
            requestAnimationFrame(poseDetectionFrame);
            return;
        }
        if (state.gameState === 'leaderboard') {
            drawLeaderboardScreen(getLeaderboard);
            requestAnimationFrame(poseDetectionFrame);
            return;
        }
        if (state.gameState === 'profile') {
            drawProfileScreen();
            requestAnimationFrame(poseDetectionFrame);
            return;
        }
        if (state.gameState === 'gameover') {
            let P1_Score = calculateScore(state.P1_Stats, state.P1_HP);
            let P2_Score = calculateScore(state.P2_Stats, state.P2_HP);
            let isP1Win = null;
            if (state.P1_HP > state.P2_HP) isP1Win = true;
            else if (state.P2_HP > state.P1_HP) isP1Win = false;
            if (isP1Win === true) P1_Score += config.WIN_BONUS;
            else if (isP1Win === false) P2_Score += config.WIN_BONUS;
            if (!state.scoreSaved) {
                await saveScoreToLeaderboard(state.P1_Name, P1_Score, getRank(P1_Score));
                if (state.P1_Name !== state.P2_Name) await saveScoreToLeaderboard(state.P2_Name, P2_Score, getRank(P2_Score));
                saveMatchRecord(state.P1_Name, P1_Score, state.P2_Name, P2_Score, isP1Win === true ? 'P1' : (isP1Win === false ? 'P2' : 'Draw'));
                triggerLedEffect(isP1Win === true ? 'win_p1' : (isP1Win === false ? 'win_p2' : 'win'));
                stopAllMusic();
                playSound('win');
                setGameTimeAndFlag(state.gameStartTime, state.remainingTime, true);
            }
            drawGameOverScreen(P1_Score, P2_Score, isP1Win);
            requestAnimationFrame(poseDetectionFrame);
            return;
        }

        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-config.VIDEO_WIDTH, 0);
        ctx.drawImage(video, 0, 0, config.VIDEO_WIDTH, config.VIDEO_HEIGHT);
        ctx.restore();
        let poses;
        try {
            poses = await detector.estimatePoses(video, { flipHorizontal: false });
        } catch (e) {}
        let newP1Keypoints = null;
        let newP2Keypoints = null;
        if (poses && poses.length >= 1) {
            poses.forEach(pose => {
                const rawAvgX = pose.keypoints.reduce((sum, kp) => sum + kp.x, 0) / pose.keypoints.length;
                pose.screenX = config.VIDEO_WIDTH - rawAvgX;
            });
            poses.sort((a, b) => a.screenX - b.screenX);
            if (poses.length >= 1) newP1Keypoints = poses[0].keypoints;
            if (poses.length >= 2) newP2Keypoints = poses[1].keypoints;
        }
        const smoothedP1 = smoothKeypoints(newP1Keypoints, previousP1Keypoints, 0.2);
        const smoothedP2 = smoothKeypoints(newP2Keypoints, previousP2Keypoints, 0.2);
        previousP1Keypoints = smoothedP1;
        previousP2Keypoints = smoothedP2;
        if (smoothedP1) {
            let mirrored = smoothedP1.map(kp => ({ ...kp, x: config.VIDEO_WIDTH - kp.x }));
            drawKeypoints(mirrored, '#0088ff');
        }
        if (smoothedP2) {
            let mirrored = smoothedP2.map(kp => ({ ...kp, x: config.VIDEO_WIDTH - kp.x }));
            drawKeypoints(mirrored, '#ff0055');
        }

        processGameLogic(smoothedP1 ? smoothedP1.map(kp => ({ ...kp, x: config.VIDEO_WIDTH - kp.x })) : null, smoothedP2 ? smoothedP2.map(kp => ({ ...kp, x: config.VIDEO_WIDTH - kp.x })) : null);

        if (state.P1_IsCharging) {
            if (currentTime - lastChargeSentP1 > 1500) {
                triggerLedEffect('charge_p1');
                lastChargeSentP1 = currentTime;
            }
            if (Math.random() > 0.98) playSound('charge');
        }
        if (state.P2_IsCharging) {
            if (currentTime - lastChargeSentP2 > 1500) {
                triggerLedEffect('charge_p2');
                lastChargeSentP2 = currentTime;
            }
            if (Math.random() > 0.98) playSound('charge');
        }

        if (state.P1_DamagePending.damage > 0 && state.P1_DamagePending.type !== 'Hidden') {
            const time_elapsed = currentTime - state.P1_DamagePending.time;
            if (state.P2_IsDefending && state.P2_HP > 0) {
                if (state.P2_IsCountering) {
                    const counterDamage = state.P1_DamagePending.damage;
                    setHP(Math.max(0, state.P1_HP - counterDamage), state.P2_HP);
                    updateStats('P2', 'counterSuccess', 1);
                    playSound('hit');
                } else updateStats('P2', 'defendCount', 1);
                setDamagePending('P1', 0, 0, '');
            } else if (time_elapsed >= config.DEFENSE_REACTION_MS) {
                if (state.P2_HP > 0) {
                    const damage = state.P1_DamagePending.damage;
                    setHP(state.P1_HP, Math.max(0, state.P2_HP - damage));
                    updateStats('P1', 'totalDamage', damage);
                    if (state.P1_DamagePending.type === 'Attack') addEnergyOnHit('P1', config.ENERGY_PER_ATTACK);
                    if (state.P1_DamagePending.type === 'Skill') addEnergyOnHit('P1', config.ENERGY_PER_ULTIMATE);
                    if (state.P1_DamagePending.type === 'Super') {
                        triggerLedEffect('super');
                        playSound('super');
                    } else {
                        triggerLedEffect('hit_p2');
                        playSound('hit');
                    }
                }
                setDamagePending('P1', 0, 0, '');
            }
        }
        if (state.P2_DamagePending.damage > 0 && state.P2_DamagePending.type !== 'Hidden') {
            const time_elapsed = currentTime - state.P2_DamagePending.time;
            if (state.P1_IsDefending && state.P1_HP > 0) {
                if (state.P1_IsCountering) {
                    const counterDamage = state.P2_DamagePending.damage;
                    setHP(state.P1_HP, Math.max(0, state.P2_HP - counterDamage));
                    updateStats('P1', 'counterSuccess', 1);
                    playSound('hit');
                } else updateStats('P1', 'defendCount', 1);
                setDamagePending('P2', 0, 0, '');
            } else if (time_elapsed >= config.DEFENSE_REACTION_MS) {
                if (state.P1_HP > 0) {
                    const damage = state.P2_DamagePending.damage;
                    setHP(Math.max(0, state.P1_HP - damage), state.P2_HP);
                    updateStats('P2', 'totalDamage', damage);
                    if (state.P2_DamagePending.type === 'Attack') addEnergyOnHit('P2', config.ENERGY_PER_ATTACK);
                    if (state.P2_DamagePending.type === 'Skill') addEnergyOnHit('P2', config.ENERGY_PER_ULTIMATE);
                    if (state.P2_DamagePending.type === 'Super') {
                        triggerLedEffect('super');
                        playSound('super');
                    } else {
                        triggerLedEffect('hit_p1');
                        playSound('hit');
                    }
                }
                setDamagePending('P2', 0, 0, '');
            }
        }

        const HP_ANIMATION_SPEED = 0.5;
        let newP1Display = (state.P1_HP_Display > state.P1_HP) ? Math.max(state.P1_HP, state.P1_HP_Display - HP_ANIMATION_SPEED) : state.P1_HP;
        let newP2Display = (state.P2_HP_Display > state.P2_HP) ? Math.max(state.P2_HP, state.P2_HP_Display - HP_ANIMATION_SPEED) : state.P2_HP;
        setHPDisplay(newP1Display, newP2Display);
        if (socket && socket.connected) socket.emit('update_hp', { p1: state.P1_HP, p2: state.P2_HP });

        drawGrid();
        let p1Color = state.P1_HP <= 30 ? 'red' : (state.P1_HP <= 60 ? 'orange' : '#0088ff');
        drawHealthBar(50, 50, 300, 30, state.P1_HP, state.P1_HP_Display, 100, p1Color, state.P1_Name);
        drawEnergyBar(50, 90, 300, 20, state.P1_Energy, config.MAX_ENERGY);
        let p2Color = state.P2_HP <= 30 ? 'red' : (state.P2_HP <= 60 ? 'orange' : '#ff0055');
        drawHealthBar(config.VIDEO_WIDTH - 350, 50, 300, 30, state.P2_HP, state.P2_HP_Display, 100, p2Color, state.P2_Name);
        drawEnergyBar(config.VIDEO_WIDTH - 350, 90, 300, 20, state.P2_Energy, config.MAX_ENERGY);

        const elapsedTime = currentTime - state.gameStartTime;
        const currentRemaining = Math.max(0, Math.ceil((config.GAME_TIME_LIMIT - elapsedTime) / 1000));
        setRemainingTime(currentRemaining);
        ctx.font = 'bold 60px "Black Ops One"';
        ctx.textAlign = 'center';
        ctx.shadowColor = currentRemaining <= 10 ? 'red' : 'black';
        ctx.shadowBlur = 10;
        ctx.fillStyle = currentRemaining <= 10 ? 'red' : 'white';
        ctx.fillText(`${currentRemaining}`, config.VIDEO_WIDTH / 2, 80);
        ctx.shadowBlur = 0;

        const now = performance.now();
        const fps = 1000 / (now - lastTime);
        lastTime = now;
        ctx.fillStyle = 'yellow';
        ctx.font = '16px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`FPS: ${fps.toFixed(1)}`, 10, 20);

        if (state.P1_HP <= 0 || state.P2_HP <= 0 || state.remainingTime <= 0) {
            if (!state.isGameOver) {
                setIsGameOver(true);
                setGameState('gameover');
            }
        }
        requestAnimationFrame(poseDetectionFrame);
    };
    poseDetectionFrame();
}

async function handlePlayerLogin(roleName, defaultName) {
    alert(`請 ${roleName} 看向鏡頭進行 Face ID 識別...`);
    let detectedName = await loginWithFace(video);
    if (detectedName) {
        if (confirm(`Face ID 識別到您是 "${detectedName}"！\n要以這個身分登入 ${roleName} 嗎？`)) return detectedName;
    }
    const inputName = prompt(`請輸入 ${roleName} 名字:`, defaultName);
    const finalName = (inputName && inputName.trim()) ? inputName.trim() : defaultName;
    if (finalName !== defaultName) {
        if (confirm(`想要為 "${finalName}" 註冊 Face ID 嗎？\n下次可以直接刷臉登入喔！`)) await registerFace(video, finalName);
    }
    return finalName;
}

async function handleCanvasClick(event) {
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    if (clickX < 50 && clickY < 50) {
        clearFaceData();
        return;
    }
    if (state.gameState === 'start') {
        if (clickY > config.VIDEO_HEIGHT - 60) {
            if (clickX < config.VIDEO_WIDTH / 2) {
                let detectedName = await loginWithFace(video);
                let queryName = detectedName;
                if (!queryName) queryName = prompt("請輸入要查詢的玩家名字:");
                if (queryName) {
                    setViewingProfile(queryName);
                    setGameState('profile');
                }
            } else {
                setGameState('leaderboard');
            }
        } else {
            const p1 = await handlePlayerLogin('Player 1 (藍色)', state.P1_Name);
            alert(`${p1} 已就位！\n\n接下來請 Player 2 看向鏡頭...`);
            const p2 = await handlePlayerLogin('Player 2 (紅色)', state.P2_Name);
            setPlayerNames(p1, p2);
            resetGame();
        }
    } else if (state.gameState === 'leaderboard' || state.gameState === 'gameover' || state.gameState === 'profile') {
        setGameState('start');
        stopAllMusic();
        playIntroMusic();
        triggerLedEffect('idle');
    }
}

async function main() {
    webcamContainer.style.display = 'flex';
    if (loadingText) loadingText.style.display = 'block';
    playIntroMusic();
    const cameraPromise = setupCamera();
    const faceModelPromise = loadFaceModels();
    await Promise.all([cameraPromise, faceModelPromise]);
    videoReadyPromise = cameraPromise;
    const videoReady = await videoReadyPromise;
    if (loadingText) loadingText.style.display = 'none';
    if (videoReady) {
        startPoseDetection();
        canvas.addEventListener('click', handleCanvasClick);
    } else {
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, config.VIDEO_WIDTH, config.VIDEO_HEIGHT);
        ctx.font = '40px Arial';
        ctx.fillStyle = 'red';
        ctx.textAlign = 'center';
        ctx.fillText('攝影機啟動失敗！請檢查權限。', config.VIDEO_WIDTH / 2, config.VIDEO_HEIGHT / 2);
    }
}
main();
