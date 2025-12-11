import * as config from './config.js';
import * as state from './state.js';
import { getRankColor } from './ranking.js';

const canvas = document.getElementById('output-canvas');
const ctx = canvas.getContext('2d');

export function drawKeypoints(keypoints, color = 'blue') {
    for (const keypoint of keypoints) {
        if (keypoint.score > config.SCORE_THRESHOLD) {
            ctx.beginPath();
            ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
        }
    }
}

export function drawHealthBar(x, y, width, height, currentHP, displayHP, maxHP, color) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; ctx.fillRect(x, y, width, height);
    const displayPercent = displayHP / maxHP; ctx.fillStyle = 'rgba(255, 200, 0, 0.8)'; ctx.fillRect(x, y, width * displayPercent, height);
    const currentPercent = currentHP / maxHP; ctx.fillStyle = color; ctx.fillRect(x, y, width * currentPercent, height);
    ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = 'white'; ctx.font = '20px Arial'; ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(currentHP)}/${maxHP}`, x + width / 2, y + height / 2 + 7);
}

export function drawEnergyBar(x, y, width, height, energy, maxEnergy) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; ctx.fillRect(x, y, width, height);
    const percent = energy / maxEnergy;
    const gradient = ctx.createLinearGradient(x, y, x + width, y);
    if (percent >= 1.0) {
        const flash = Math.sin(Date.now() / 100) * 0.3 + 0.7;
        gradient.addColorStop(0, `rgba(255, 0, 255, ${flash})`);
        gradient.addColorStop(1, `rgba(255, 100, 255, ${flash})`);
    } else {
        gradient.addColorStop(0, 'rgba(100, 200, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(0, 150, 255, 0.8)');
    }
    ctx.fillStyle = gradient; ctx.fillRect(x, y, width * percent, height);
    ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = 'white'; ctx.font = '16px Arial'; ctx.textAlign = 'center';
    if (percent >= 1.0) { ctx.fillStyle = 'yellow'; ctx.fillText('READY!', x + width / 2, y + height / 2 + 5); }
    else { ctx.fillText(`${Math.floor(energy)}%`, x + width / 2, y + height / 2 + 5); }
}

export function drawGrid() {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; ctx.lineWidth = 1; ctx.font = '20px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let row = 0; row < config.GRID_ROWS; row++) {
        for (let col = 0; col < config.GRID_COLS; col++) {
            const x = col * config.CELL_WIDTH; const y = row * config.CELL_HEIGHT; const cellNum = row * config.GRID_COLS + col + 1;
            if (config.GRID_ACTIONS[cellNum]) { ctx.fillStyle = config.GRID_ACTIONS[cellNum].color; ctx.fillRect(x, y, config.CELL_WIDTH, config.CELL_HEIGHT); }
            ctx.strokeRect(x, y, config.CELL_WIDTH, config.CELL_HEIGHT); ctx.fillStyle = 'white'; ctx.fillText(cellNum.toString(), x + config.CELL_WIDTH / 2, y + 30);
            if (config.GRID_ACTIONS[cellNum]) {
                const action = config.GRID_ACTIONS[cellNum]; ctx.font = '16px Arial';
                let color;
                if (action.action === 'ultimate') color = 'yellow';
                else if (action.action === 'attack') color = 'orange';
                else if (action.action === 'defend') color = 'lightgreen';
                else if (action.action === 'charge' || action.action === 'super') color = 'magenta';
                else if (action.action === 'counter') color = 'gold';
                ctx.fillStyle = color;
                ctx.fillText(`${action.player} ${action.action === 'ultimate' ? '招式' : action.action === 'attack' ? '攻擊' : action.action === 'defend' ? '防禦' : action.action === 'charge' ? '蓄力' : action.action === 'counter' ? '反擊' : '必殺'}`, x + config.CELL_WIDTH / 2, y + config.CELL_HEIGHT / 2);
            }
        }
    }
}

export function drawStartScreen() {
    ctx.clearRect(0, 0, config.VIDEO_WIDTH, config.VIDEO_HEIGHT);
    const video = document.getElementById('webcam-video');
    
    if (state.gameState === 'start' && video.readyState >= 2) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    } else {
        ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    }

    ctx.fillRect(0, 0, config.VIDEO_WIDTH, config.VIDEO_HEIGHT);
    ctx.font = 'bold 80px Arial';
    ctx.fillStyle = 'yellow';
    ctx.textAlign = 'center';
    ctx.fillText('AI FIGHTING GAME', config.VIDEO_WIDTH / 2, 150);
    ctx.font = '30px Arial';
    ctx.fillStyle = 'white';
    ctx.fillText('姿勢識別格鬥遊戲', config.VIDEO_WIDTH / 2, 200);
    ctx.font = 'bold 40px Arial';
    ctx.fillStyle = 'cyan';
    ctx.fillText('Player 1 (Left - Blue)', config.VIDEO_WIDTH / 4, 300);
    ctx.fillStyle = 'orange';
    ctx.fillText('Player 2 (Right - Red)', config.VIDEO_WIDTH * 3 / 4, 300);
    ctx.font = '35px Arial';
    ctx.fillStyle = 'white';
    ctx.fillText(state.P1_Name, config.VIDEO_WIDTH / 4, 350);
    ctx.fillText(state.P2_Name, config.VIDEO_WIDTH * 3 / 4, 350);
    ctx.font = '25px Arial';
    ctx.fillStyle = 'lightgreen';
    ctx.textAlign = 'left';
    ctx.fillText('📋 遊戲說明:', 100, 450);
    ctx.font = '20px Arial';
    ctx.fillStyle = 'white';
    ctx.fillText('• 普通攻擊 (傷害 5)：單手伸到攻擊格', 120, 490);
    ctx.fillText('• 招式攻擊 (傷害 10)：單手伸到招式格', 120, 520);
    ctx.fillText('• 蓄力攻擊 (傷害 15)：雙手伸到蓄力格', 120, 550);
    ctx.fillText('• 必殺技 (傷害 25)：雙手伸到必殺格 + 能量滿', 120, 580);
    ctx.fillText('• 防守：雙手伸到防守格可格擋', 120, 610);
    ctx.fillText('• 反擊：雙手伸到反擊格可反彈傷害', 120, 640);
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'yellow';
    const pulse = Math.sin(Date.now() / 300) * 0.3 + 0.7;
    ctx.globalAlpha = pulse;
    ctx.fillText('👆 點擊畫面開始遊戲 👆', config.VIDEO_WIDTH / 2, config.VIDEO_HEIGHT - 80);
    ctx.globalAlpha = 1.0;
    ctx.font = '25px Arial';
    ctx.fillStyle = 'cyan';
    ctx.fillText('或點此查看排行榜 🏆', config.VIDEO_WIDTH / 2, config.VIDEO_HEIGHT - 30);
}

export async function drawLeaderboardScreen(getLeaderboardFunc) {
    ctx.clearRect(0, 0, config.VIDEO_WIDTH, config.VIDEO_HEIGHT);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(0, 0, config.VIDEO_WIDTH, config.VIDEO_HEIGHT);
    ctx.font = 'bold 60px Arial';
    ctx.fillStyle = 'gold';
    ctx.textAlign = 'center';
    ctx.fillText('🏆 全球排行榜 🏆', config.VIDEO_WIDTH / 2, 80);
    
    let leaderboard = await getLeaderboardFunc();
    
    if (leaderboard.length === 0) {
        ctx.font = '30px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText('目前還沒有任何記錄', config.VIDEO_WIDTH / 2, config.VIDEO_HEIGHT / 2);
    } else {
        ctx.font = 'bold 25px Arial';
        ctx.fillStyle = 'yellow';
        ctx.textAlign = 'left';
        ctx.fillText('排名', 100, 140);
        ctx.fillText('玩家名稱', 200, 140);
        ctx.fillText('分數', 500, 140);
        ctx.fillText('評級', 650, 140);
        ctx.fillText('日期', 800, 140);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(80, 155);
        ctx.lineTo(config.VIDEO_WIDTH - 80, 155);
        ctx.stroke();
        
        const displayCount = Math.min(10, leaderboard.length);
        ctx.font = '22px Arial';
        
        for (let i = 0; i < displayCount; i++) {
            const entry = leaderboard[i];
            const y = 195 + i * 45;
            let rankColor = (i === 0) ? 'gold' : (i === 1) ? 'silver' : (i === 2) ? '#CD7F32' : 'white';
            ctx.fillStyle = rankColor;
            ctx.textAlign = 'center';
            ctx.fillText(`${i + 1}`, 120, y);
            ctx.fillStyle = 'white';
            ctx.textAlign = 'left';
            const displayName = entry.name.length > 15 ? entry.name.substring(0, 15) + '...' : entry.name;
            ctx.fillText(displayName, 200, y);
            ctx.fillStyle = 'cyan';
            ctx.fillText(entry.score.toString(), 500, y);
            ctx.fillStyle = getRankColor(entry.rank);
            ctx.fillText(entry.rank, 650, y);
            ctx.fillStyle = 'gray';
            ctx.font = '18px Arial';
            ctx.fillText(entry.date, 800, y);
        }
        ctx.font = '20px Arial';
        ctx.fillStyle = 'lightgray';
        ctx.textAlign = 'center';
        ctx.fillText(`共 ${leaderboard.length} 筆記錄`, config.VIDEO_WIDTH / 2, 620);
    }
    
    ctx.font = '30px Arial';
    ctx.fillStyle = 'yellow';
    const backPulse = Math.sin(Date.now() / 300) * 0.3 + 0.7;
    ctx.globalAlpha = backPulse;
    ctx.fillText('點擊返回主選單', config.VIDEO_WIDTH / 2, config.VIDEO_HEIGHT - 30);
    ctx.globalAlpha = 1.0;
}

export async function drawGameOverScreen(P1_Score, P2_Score, isP1Win) {
    let winner, winnerColor;
    if (state.P1_HP <= 0 && state.P2_HP <= 0) { winner = "平手"; winnerColor = 'white'; }
    else if (state.P1_HP <= 0) { winner = state.P2_Name; winnerColor = 'red'; }
    else if (state.P2_HP <= 0) { winner = state.P1_Name; winnerColor = 'cyan'; }
    else {
        if (state.P1_HP > state.P2_HP) { winner = state.P1_Name; winnerColor = 'cyan'; }
        else if (state.P2_HP > state.P1_HP) { winner = state.P2_Name; winnerColor = 'red'; }
        else { winner = "平手"; winnerColor = 'white'; }
    }
    
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)"; ctx.fillRect(0, 0, config.VIDEO_WIDTH, config.VIDEO_HEIGHT);
    ctx.font = 'bold 80px Arial'; ctx.textAlign = 'center'; ctx.fillStyle = winnerColor; ctx.fillText(`${winner} WINS!`, config.VIDEO_WIDTH / 2, 120);
    ctx.font = '40px Arial'; ctx.fillStyle = 'yellow'; ctx.fillText('GAME OVER', config.VIDEO_WIDTH / 2, 180);
    ctx.font = 'bold 35px Arial'; ctx.fillStyle = 'white'; ctx.fillText('📊 戰鬥統計 & 評分', config.VIDEO_WIDTH / 2, 240);
    ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(config.VIDEO_WIDTH / 4, 260); ctx.lineTo(config.VIDEO_WIDTH * 3 / 4, 260); ctx.stroke();
    
    const p1X = config.VIDEO_WIDTH / 4;
    ctx.font = 'bold 30px Arial'; ctx.fillStyle = 'cyan'; ctx.textAlign = 'center'; ctx.fillText(state.P1_Name, p1X, 300);
    ctx.font = '22px Arial'; ctx.fillStyle = 'white'; ctx.textAlign = 'left';
    ctx.fillText(`總傷害: ${state.P1_Stats.totalDamage}`, p1X - 100, 340);
    ctx.fillText(`攻擊次數: ${state.P1_Stats.attackCount}`, p1X - 100, 370);
    ctx.fillText(`防守次數: ${state.P1_Stats.defendCount}`, p1X - 100, 400);
    ctx.fillText(`必殺技: ${state.P1_Stats.superUsed}`, p1X - 100, 430);
    ctx.fillText(`反擊成功: ${state.P1_Stats.counterSuccess}`, p1X - 100, 460);
    
    const p2X = config.VIDEO_WIDTH * 3 / 4;
    ctx.font = 'bold 30px Arial'; ctx.fillStyle = 'orange'; ctx.textAlign = 'center'; ctx.fillText(state.P2_Name, p2X, 300);
    ctx.font = '22px Arial'; ctx.fillStyle = 'white'; ctx.textAlign = 'left';
    ctx.fillText(`總傷害: ${state.P2_Stats.totalDamage}`, p2X - 100, 340);
    ctx.fillText(`攻擊次數: ${state.P2_Stats.attackCount}`, p2X - 100, 370);
    ctx.fillText(`防守次數: ${state.P2_Stats.defendCount}`, p2X - 100, 400);
    ctx.fillText(`必殺技: ${state.P2_Stats.superUsed}`, p2X - 100, 430);
    ctx.fillText(`反擊成功: ${state.P2_Stats.counterSuccess}`, p2X - 100, 460);
    
    const P1_Rank = getRank(P1_Score); ctx.fillStyle = getRankColor(P1_Rank); ctx.font = 'bold 30px Arial'; ctx.textAlign = 'center'; ctx.fillText(`評分: ${P1_Score}`, p1X, 510); ctx.fillText(`評級: ${P1_Rank}`, p1X, 545);
    if (isP1Win === true) { ctx.fillStyle = 'lime'; ctx.font = '20px Arial'; ctx.fillText(`+${config.WIN_BONUS} 勝利獎勵`, p1X, 570); }
    
    const P2_Rank = getRank(P2_Score); ctx.fillStyle = getRankColor(P2_Rank); ctx.font = 'bold 30px Arial'; ctx.fillText(`評分: ${P2_Score}`, p2X, 510); ctx.fillText(`評級: ${P2_Rank}`, p2X, 545);
    if (isP1Win === false) { ctx.fillStyle = 'lime'; ctx.font = '20px Arial'; ctx.fillText(`+${config.WIN_BONUS} 勝利獎勵`, p2X, 570); }
    
    ctx.font = 'bold 35px Arial'; ctx.fillStyle = 'gold'; ctx.textAlign = 'center';
    const mvp = P1_Score > P2_Score ? state.P1_Name : (P2_Score > P1_Score ? state.P2_Name : '平手');
    ctx.fillText(`🏆 MVP: ${mvp}`, config.VIDEO_WIDTH / 2, 620);
    
    ctx.font = '25px Arial'; ctx.fillStyle = 'white';
    const restartPulse = Math.sin(Date.now() / 300) * 0.3 + 0.7;
    ctx.globalAlpha = restartPulse;
    ctx.fillText('點擊畫面重新開始', config.VIDEO_WIDTH / 2, config.VIDEO_HEIGHT - 50);
    ctx.globalAlpha = 1.0;
}

export function renderAttackPrompt(damagePending, isP1) {
    const currentTime = performance.now();
    if (damagePending.damage > 0 && (currentTime - damagePending.time) < config.DEFENSE_REACTION_MS) {
        const player = isP1 ? 'P1' : 'P2';
        const attackType = damagePending.type;
        const text = attackType === 'Super' ? `🔥 ${player} SUPER ATTACK! 🔥` : `${player} ${attackType.toUpperCase()}!`;
        
        let color;
        if (attackType === 'Super') color = 'magenta';
        else if (attackType === 'Ultimate') color = 'yellow';
        else color = isP1 ? 'blue' : 'red';
        
        ctx.fillStyle = color;
        ctx.font = '50px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(text, config.VIDEO_WIDTH / 2, config.VIDEO_HEIGHT / 2);
        ctx.font = '30px Arial';
        ctx.fillText('(1s to DEFEND!)', config.VIDEO_WIDTH / 2, config.VIDEO_HEIGHT / 2 + 50);
    }
}
